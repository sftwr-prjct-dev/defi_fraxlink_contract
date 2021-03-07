// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "../../Math/SafeMath.sol";
import "../../Xesh/XESH.sol";
import "../../Xeb/Xeb.sol";
import "../../ERC20/ERC20.sol";
// import '../../Uniswap/TransferHelper.sol';
import "../../Oracle/UniswapPairOracle.sol";
import "../../Governance/AccessControl.sol";
// import "../../Utils/StringHelpers.sol";
import "./XebPoolLibrary.sol";

contract XebPool is AccessControl {
    using SafeMath for uint256;

    /* ========== STATE VARIABLES ========== */

    ERC20 private collateral_token;
    address private collateral_address;
    address[] private owners;
    address private oracle_address;
    address private xeb_contract_address;
    address private xesh_contract_address;
    address private timelock_address;
    XEBShares private XESH;
    XEBECStablecoin private XEB;
    UniswapPairOracle private oracle;

    mapping (address => uint256) private redeemXESHBalances;
    mapping (address => uint256) private redeemCollateralBalances;
    uint256 public unclaimedPoolCollateral;
    uint256 public unclaimedPoolXESH;
    mapping (address => uint256) lastRedeemed;
    
    // Pool_ceiling is the total units of collateral that a pool contract can hold
    uint256 private pool_ceiling = 0;

    // AccessControl Roles
    bytes32 private constant MINT_PAUSER = keccak256("MINT_PAUSER");
    bytes32 private constant REDEEM_PAUSER = keccak256("REDEEM_PAUSER");
    bytes32 private constant BUYBACK_PAUSER = keccak256("BUYBACK_PAUSER");
    
    // AccessControl state variables
    bool mintPaused = false;
    bool redeemPaused = false;
    bool buyBackPaused = false;

    /* ========== MODIFIERS ========== */

    modifier onlyByOwnerOrGovernance() {
        // Loop through the owners until one is found
        bool found = false;
        for (uint i = 0; i < owners.length; i++){ 
            if (owners[i] == msg.sender) {
                found = true;
                break;
            }
        }
        require(found, "You're not an owner");
        _;
    }

    // AccessControl Modifiers
    modifier onlyMintPauser() {
        require(hasRole(MINT_PAUSER, msg.sender));
        _;
    }

    modifier onlyRedeemPauser() {
        require(hasRole(REDEEM_PAUSER, msg.sender));
        _;
    }

    modifier onlyBuyBackPauser() {
        require(hasRole(BUYBACK_PAUSER, msg.sender));
        _;
    }

    modifier notRedeemPaused() {
        require(redeemPaused == false, "Redeeming is paused");
        _;
    }

    modifier notMintPaused() {
        require(mintPaused == false, "Minting is paused");
        _;
    }
 
    /* ========== CONSTRUCTOR ========== */
    
    constructor(
        address _collateral_address,
        address _oracle_address,
        address _creator_address,
        address _timelock_address,
        uint256 _pool_ceiling
    ) public {
        collateral_address = _collateral_address;
        oracle_address = _oracle_address;
        timelock_address = _timelock_address;
        owners.push(_creator_address);
        owners.push(_timelock_address);
        oracle = UniswapPairOracle(_oracle_address);
        collateral_token = ERC20(_collateral_address);
        pool_ceiling = _pool_ceiling;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        grantRole(MINT_PAUSER, oracle_address);
        grantRole(MINT_PAUSER, timelock_address);
        grantRole(REDEEM_PAUSER, oracle_address);
        grantRole(REDEEM_PAUSER, timelock_address);
        grantRole(BUYBACK_PAUSER, oracle_address);
        grantRole(BUYBACK_PAUSER, timelock_address);
    }

    /* ========== VIEWS ========== */

    
    function unclaimedXESH(address _account) public view returns (uint256) {
        return redeemXESHBalances[_account];
    }

    function unclaimedCollateral(address _account) public view returns (uint256) {
        return redeemCollateralBalances[_account];
    }

    function collatDollarBalance() public view returns (uint256) {
        return (collateral_token.balanceOf(address(this)) - unclaimedPoolCollateral)
                                .mul(oracle.consult(xeb_contract_address, 1e8))  // X XEB / 1 COLLAT
                                .div(XEB.xeb_price());
    }


    // (uint256 xeb_price, uint256 xesh_price, uint256 total_supply, uint256 global_collateral_ratio, uint256 global_collat_value, uint256 minting_fee, uint256 redemption_fee) = XEB.xeb_info();

    function availableExcessCollatDV() public view returns (uint256) {
        (uint256 xeb_price, , uint256 total_supply, uint256 global_collateral_ratio, uint256 global_collat_value, , ) = XEB.xeb_info();
        uint256 total_XEB_sats_value_d8 = total_supply.mul(1e8).div(xeb_price); 
        if (global_collateral_ratio > 1e8) global_collateral_ratio = 1e8; // Handles an overcollateralized contract with CR > 1
        uint256 required_collat_sats_value_d8 = (total_XEB_sats_value_d8.mul(global_collateral_ratio)).div(1e8);
        if (global_collat_value > required_collat_sats_value_d8) return global_collat_value.sub(required_collat_sats_value_d8);
        else return 0;
    }

    /* ========== PUBLIC FUNCTIONS ========== */
    
    // We separate out the 1t1, fractional and algorithmic minting functions for gas efficiency 
    // 100+% collateral-backed
    function mint1t1XEB(uint256 collateral_amount_d8) external notMintPaused {
        (uint256 xeb_price, , , uint256 global_collateral_ratio, , uint256 minting_fee, ) = XEB.xeb_info();
        require(global_collateral_ratio >= 1000000, "Collateral ratio must be >= 1");
        require((collateral_token.balanceOf(address(this))) + collateral_amount_d8 <= pool_ceiling, "[Pool's Closed]: Ceiling reached");
        
        (uint256 xeb_amount_d8) = XebPoolLibrary.calcMint1t1XEB(
            oracle.consult(xeb_contract_address, 1e8), // X XEB / 1 COLLAT
            xeb_price,
            minting_fee,
            collateral_amount_d8
        );

        // TransferHelper.safeTransferFrom(collateral_address, msg.sender, address(this), collateral_amount_d8);
        collateral_token.transferFrom(msg.sender, address(this), collateral_amount_d8);
        XEB.pool_mint(msg.sender, xeb_amount_d8);
    }

    // 0% collateral-backed
    function mintAlgorithmicXEB(uint256 xesh_amount_d8) external notMintPaused {
        (, uint256 xesh_price, , uint256 global_collateral_ratio, , uint256 minting_fee, ) = XEB.xeb_info();
        require(global_collateral_ratio == 0, "Collateral ratio must be 0");
        
        (uint256 xeb_amount_d8) = XebPoolLibrary.calcMintAlgorithmicXEB(
            minting_fee, 
            xesh_price, // X XESH / 1 USD
            xesh_amount_d8
        );

        XESH.pool_burn_from(msg.sender, xesh_amount_d8);
        XEB.pool_mint(msg.sender, xeb_amount_d8);
    }

    // Will fail if fully collateralized or fully algorithmic
    // > 0% and < 100% collateral-backed
    function mintFractionalXEB(uint256 collateral_amount, uint256 xesh_amount) external notMintPaused {
        (uint256 xeb_price, uint256 xesh_price, , uint256 global_collateral_ratio, , uint256 minting_fee, ) = XEB.xeb_info();
        require(global_collateral_ratio < 1000000 && global_collateral_ratio > 0, "Collateral ratio needs to be between .000001 and .999999");
        
        XebPoolLibrary.MintFF_Params memory input_params = XebPoolLibrary.MintFF_Params(
            minting_fee, 
            xesh_price, // X XESH / 1 USD
            xeb_price,
            oracle.consult(xeb_contract_address, 1e8),
            xesh_amount,
            collateral_amount,
            (collateral_token.balanceOf(address(this))),
            pool_ceiling,
            global_collateral_ratio
        );

        (uint256 collateral_needed, uint256 mint_amount, uint256 xesh_needed) = XebPoolLibrary.calcMintFractionalXEB(input_params);

        require((collateral_token.balanceOf(address(this))) + collateral_needed <= pool_ceiling, "[Pool's Closed]: Ceiling reached");

        // TransferHelper.safeTransferFrom(collateral_address, msg.sender, address(this), collateral_needed);
        collateral_token.transferFrom(msg.sender, address(this), collateral_needed);
        XEB.pool_mint(msg.sender, mint_amount);
        XESH.burnFrom(msg.sender, xesh_needed);
    }

    // Redeem collateral. 100+% collateral-backed
    function redeem1t1XEB(uint256 XEB_amount) external notRedeemPaused {
        (uint256 xeb_price, , , uint256 global_collateral_ratio, , , uint256 redemption_fee) = XEB.xeb_info();
        require(global_collateral_ratio >= 1000000, "Collateral ratio must be >= 1");

        (uint256 collateral_needed) = XebPoolLibrary.calcRedeem1t1XEB(
            xeb_price,
            oracle.consult(xeb_contract_address, 1e8).mul(1e8).div(xeb_price),
            XEB_amount,
            redemption_fee
        );

        collateral_token.approve(msg.sender, collateral_needed);
        redeemCollateralBalances[msg.sender] += collateral_needed;
        unclaimedPoolCollateral += collateral_needed;
        
        lastRedeemed[msg.sender] = block.number;

        XEB.pool_burn_from(msg.sender, XEB_amount);
    }

    // Will fail if fully collateralized or algorithmic
    // Redeem XEB for collateral and XESH. .000001% - .999999% collateral-backed
    function redeemFractionalXEB(uint256 XEB_amount) external notRedeemPaused {
        (uint256 xeb_price, uint256 xesh_price, , uint256 global_collateral_ratio, , , uint256 redemption_fee) = XEB.xeb_info();
        require(global_collateral_ratio < 1000000 && global_collateral_ratio > 0, "Collateral ratio needs to be between .000001 and .999999");
        uint256 xeb_sats_value_d8 = XEB_amount.mul(1e8).div(xeb_price);
        uint256 col_price_usd = oracle.consult(xeb_contract_address, 1e8).mul(1e8).div(xeb_price);

        xeb_sats_value_d8 = xeb_sats_value_d8.sub((xeb_sats_value_d8.mul(redemption_fee)).div(1e8));
        uint256 collateral_sats_value_d8 = xeb_sats_value_d8.mul(global_collateral_ratio).div(1e8);
        uint256 xesh_sats_value_d8 = xeb_sats_value_d8.sub(collateral_sats_value_d8);

        collateral_token.approve(msg.sender, collateral_sats_value_d8.mul(col_price_usd).div(1e8));
        redeemCollateralBalances[msg.sender] += collateral_sats_value_d8.mul(col_price_usd).div(1e8);
        unclaimedPoolCollateral += collateral_sats_value_d8.mul(col_price_usd).div(1e8);

        XESH.pool_mint(address(this), xesh_sats_value_d8.mul(xesh_price).div(1e8));
        XESH.approve(msg.sender, xesh_sats_value_d8.mul(xesh_price).div(1e8));
        redeemXESHBalances[msg.sender] += xesh_sats_value_d8.mul(xesh_price).div(1e8);
        unclaimedPoolXESH += xesh_sats_value_d8.mul(xesh_price).div(1e8);
        
        lastRedeemed[msg.sender] = block.number;

        XEB.pool_burn_from(msg.sender, XEB_amount);
    }

    // Redeem XEB for XESH. 0% collateral-backed
    function redeemAlgorithmicXEB(uint256 XEB_amount) external notRedeemPaused {
        (uint256 xeb_price, uint256 xesh_price, , uint256 global_collateral_ratio, , , uint256 redemption_fee) = XEB.xeb_info();
        require(global_collateral_ratio == 0, "Collateral ratio must be 0"); 
        uint256 xeb_sats_value_d8 = XEB_amount.mul(1e8).div(xeb_price);
        xeb_sats_value_d8 = xeb_sats_value_d8.sub((xeb_sats_value_d8.mul(redemption_fee)).div(1e8));

        XESH.pool_mint(address(this), xeb_sats_value_d8.mul(xesh_price).div(1e8));
        XESH.approve(msg.sender, xeb_sats_value_d8.mul(xesh_price).div(1e8));
        redeemXESHBalances[msg.sender] += xeb_sats_value_d8.mul(xesh_price).div(1e8);
        unclaimedPoolXESH += xeb_sats_value_d8.mul(xesh_price).div(1e8);
        
        lastRedeemed[msg.sender] = block.number;
        
        XEB.pool_burn_from(msg.sender, XEB_amount);
    }

    // After a redemption happens, transfer the newly minted XESH and owed collateral from this pool
    // contract to the user. Redemption is split into two functions to prevent flash loans from being able
    // to take out XEB/collateral from the system, use an AMM to trade the new price, and then mint back into the system.
    function collectRedemption() public {
        require(lastRedeemed[msg.sender] < block.number, "must wait at least one block before collecting redemption");
        if(redeemXESHBalances[msg.sender] > 0){
            XESH.transfer(msg.sender, redeemXESHBalances[msg.sender]);
            unclaimedPoolXESH -= redeemXESHBalances[msg.sender];
            redeemXESHBalances[msg.sender] = 0;
        }
        
        if(redeemCollateralBalances[msg.sender] > 0){
            collateral_token.transfer(msg.sender, redeemCollateralBalances[msg.sender]);
            unclaimedPoolCollateral -= redeemCollateralBalances[msg.sender];
            redeemCollateralBalances[msg.sender] = 0;
        }
    }


    // Function can be called by an XESH holder to have the protocol buy back XESH with excess collateral value from a desired collateral pool
    // This can also happen if the collateral ratio > 1
    function buyBackXESH(uint256 XESH_amount) external {
        require(buyBackPaused == false, "Buyback is paused");
        (uint256 xeb_price, uint256 xesh_price, , , , , uint256 redemption_fee) = XEB.xeb_info();
        
        XebPoolLibrary.BuybackXESH_Params memory input_params = XebPoolLibrary.BuybackXESH_Params(
            redemption_fee,
            availableExcessCollatDV(),
            xesh_price,
            oracle.consult(xeb_contract_address, 1e8).mul(1e8).div(xeb_price),
            XESH_amount
        );

        (uint256 collateral_equivalent_d8) = XebPoolLibrary.calcBuyBackXESH(input_params);

        // Give the sender their desired collateral and burn the XESH
        collateral_token.transfer(msg.sender, collateral_equivalent_d8);
        XESH.burnFrom(msg.sender, XESH_amount);
    }

    
    // When the protocol is recollateralizing, we need to give a discount of XESH to hit the new CR target
    // Returns value of collateral that must increase to reach recollateralization target (if 0 means no recollateralization)
    function recollateralizeAmount() public view returns (uint256 recollateralization_left) {
        ( , , uint256 total_supply, uint256 global_collateral_ratio, uint256 global_collat_value, , ) = XEB.xeb_info();
        uint256 target_collat_value = total_supply.mul(global_collateral_ratio).div(1e12); // We want 6 degrees of precision so divide by 1e12 
        // Subtract the current value of collateral from the target value needed, if higher than 0 then system needs to recollateralize
        if (target_collat_value > global_collat_value) recollateralization_left = target_collat_value.sub(global_collat_value); 
        
        else recollateralization_left = 0;
        
        return(recollateralization_left);
    }
    
    // Thus, if the target collateral ratio is higher than the actual value of collateral, minters get XESH for adding collateral
    // This function simply rewards anyone that sends collateral to a pool with the same amount of XESH + 1% 
    // Anyone can call this function to recollateralize the protocol and take the hardcoded 1% arb opportunity
    function recollateralizeXeb(uint256 collateral_amount_d8) public {
        require(recollateralizeAmount() > 0, "no extra collateral needed"); 

        (uint256 xeb_price, uint256 xesh_price, , , , , ) = XEB.xeb_info();
        // The discount rate is the extra XESH they get for the collateral they put in, essentially an open arb opportunity 
        uint256 col_price = oracle.consult(xeb_contract_address, 1e8); // X XEB / 1 COLLAT
        uint256 col_price_usd = col_price.mul(1e8).div(xeb_price);
        uint256 c_sats_value_d8 = (collateral_amount_d8.mul(col_price_usd)).div(1e8);
        uint256 recol_am = recollateralizeAmount();
        
        if (recol_am >= c_sats_value_d8)  recol_am = c_sats_value_d8;
        
        else {
           c_sats_value_d8 = recol_am;  
        }
        uint256 xesh_col_value = c_sats_value_d8.add(recol_am.div(1e2)); // Add the discount rate of 1% to the XESH amount 
        collateral_token.transferFrom(msg.sender, address(this), collateral_amount_d8);
        XESH.pool_mint(tx.origin, xesh_col_value.mul(xesh_price).div(1e8));

    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function toggleMinting() external onlyMintPauser {
        mintPaused = !mintPaused;
    }
    
    function toggleRedeeming() external onlyRedeemPauser {
        redeemPaused = !redeemPaused;
    }
    
    function toggleBuyBack() external onlyBuyBackPauser {
        buyBackPaused = !buyBackPaused;
    }

    function setPoolCeiling(uint256 new_ceiling) external onlyByOwnerOrGovernance {
        pool_ceiling = new_ceiling;
    }

    function setOracle(address new_oracle) external onlyByOwnerOrGovernance {
        oracle_address = new_oracle;
        oracle = UniswapPairOracle(oracle_address);
    }
    
    function setCollateralAdd(address _collateral_address) external onlyByOwnerOrGovernance {
        collateral_address = _collateral_address;
        collateral_token = ERC20(_collateral_address);
    }
    
    function setXEBAddress(address _xeb_contract_address) external onlyByOwnerOrGovernance {
        XEB = XEBECStablecoin(_xeb_contract_address);
        xeb_contract_address = _xeb_contract_address;
    }

    function setXESHAddress(address _xesh_contract_address) external onlyByOwnerOrGovernance {
        XESH = XEBShares(_xesh_contract_address);
        xesh_contract_address = _xesh_contract_address;
    }

    // Adds an owner 
    function addOwner(address owner_address) external onlyByOwnerOrGovernance {
        owners.push(owner_address);
    }

    // Removes an owner 
    function removeOwner(address owner_address) external onlyByOwnerOrGovernance {
        // 'Delete' from the array by setting the address to 0x0
        for (uint i = 0; i < owners.length; i++){ 
            if (owners[i] == owner_address) {
                owners[i] = address(0); // This will leave a null in the array and keep the indices the same
                break;
            }
        }
    }
    
    /* ========== EVENTS ========== */

}
