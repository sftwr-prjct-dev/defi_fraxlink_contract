// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../../Math/SafeMath.sol";



library XebPoolLibrary {
    using SafeMath for uint256;

    // ================ Structs ================
    // Needed to lower stack size
    struct MintFF_Params {
        uint256 mint_fee; 
        uint256 xesh_price_usd; 
        uint256 xeb_price_usd; 
        uint256 col_price_xeb;
        uint256 xesh_amount;
        uint256 collateral_amount;
        uint256 collateral_token_balance;
        uint256 pool_ceiling;
        uint256 col_ratio;
    }

    struct BuybackXESH_Params {
        uint256 buyback_fee;
        uint256 excess_collateral_satoshi_value_d8;
        uint256 xesh_price_usd;
        uint256 col_price_usd;
        uint256 XESH_amount;
    }

    // ================ Functions ================

    function calcMint1t1XEB(uint256 col_price, uint256 xeb_price, uint256 mint_fee, uint256 collateral_amount_d8) public pure returns (uint256) {
        uint256 col_price_usd = col_price.mul(1e8).div(xeb_price);
        uint256 c_satoshi_value_d8 = (collateral_amount_d8.mul(1e8)).div(col_price_usd);
        return c_satoshi_value_d8.sub((c_satoshi_value_d8.mul(mint_fee)).div(1e8));
    }

    function calcMintAlgorithmicXEB(uint256 mint_fee, uint256 xesh_price_usd, uint256 xesh_amount_d8) public pure returns (uint256) {
        uint256 xesh_satoshi_value_d8 = xesh_amount_d8.mul(1e8).div(xesh_price_usd);
        return xesh_satoshi_value_d8.sub((xesh_satoshi_value_d8.mul(mint_fee)).div(1e8));
    }

    // Must be internal because of the struct
    function calcMintFractionalXEB(MintFF_Params memory params) internal pure returns (uint256, uint256, uint256) {
        // Since solidity truncates division, every division operation must be the last operation in the equation to ensure minimum error
        // The contract must check the proper ratio was sent to mint XEB. We do this by seeing the minimum mintable XEB based on each amount 
        uint256 xesh_needed;
        uint256 collateral_needed;
        uint256 xesh_satoshi_value_d8;
        uint256 c_satoshi_value_d8;
        
        // Scoping for stack concerns
        {
            uint256 col_price_usd = params.col_price_xeb.mul(1e8).div(params.xeb_price_usd);
        
            // USD amounts of the collateral and the XESH
            xesh_satoshi_value_d8 = params.xesh_amount.mul(1e8).div(params.xesh_price_usd);
            c_satoshi_value_d8 = params.collateral_amount.mul(1e8).div(col_price_usd);

            // Recalculate and round down
            collateral_needed = c_satoshi_value_d8.mul(col_price_usd).div(1e8);
        }
        require(params.collateral_token_balance + collateral_needed < params.pool_ceiling, "Pool ceiling reached, no more XEB can be minted with this collateral");
        
        xesh_needed = ((c_satoshi_value_d8.mul(1e8).div(params.col_ratio)).sub(c_satoshi_value_d8)).mul(params.xesh_price_usd).div(1e8);
        xesh_satoshi_value_d8 = xesh_needed.mul(1e8).div(params.xesh_price_usd);

        return (
            collateral_needed,
            (c_satoshi_value_d8 + xesh_satoshi_value_d8).sub(((c_satoshi_value_d8 + xesh_satoshi_value_d8).mul(params.mint_fee)).div(1e8)),
            xesh_needed
        );
    }

    function calcRedeem1t1XEB(uint256 xeb_price_usd, uint256 col_price_usd, uint256 XEB_amount, uint256 redemption_fee) public pure returns (uint256) {
        uint256 xeb_satoshi_value_d8 = XEB_amount.mul(1e8).div(xeb_price_usd);
        uint256 collateral_needed_d8 = xeb_satoshi_value_d8.mul(col_price_usd).div(1e8);
        return collateral_needed_d8.sub((collateral_needed_d8.mul(redemption_fee)).div(1e8));
    }

    // Must be internal because of the struct
    function calcBuyBackXESH(BuybackXESH_Params memory params) internal pure returns (uint256) {
        // If the total collateral value is higher than the amount required at the current collateral ratio then buy back up to the possible XESH with the desired collateral
        require(params.excess_collateral_satoshi_value_d8 > 0, "No excess collateral to buy back!");

        // Make sure not to take more than is available
        uint256 xesh_satoshi_value_d8 = params.XESH_amount.mul(1e8).div(params.xesh_price_usd);
        require(xesh_satoshi_value_d8 <= params.excess_collateral_satoshi_value_d8, "You are trying to buy back more than the excess!");

        // Get the equivalent amount of collateral based on the market value of XESH provided 
        uint256 collateral_equivalent_d8 = xesh_satoshi_value_d8.mul(1e8).div(params.col_price_usd);
        collateral_equivalent_d8 = collateral_equivalent_d8.sub((collateral_equivalent_d8.mul(params.buyback_fee)).div(1e8));

        return (
            collateral_equivalent_d8
        );

    }

}
