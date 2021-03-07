const BigNumber = require('bignumber.js');

const { expectEvent, send, shouldFail, time } = require('@openzeppelin/test-helpers');
const BIG6 = new BigNumber("1e6");
const BIG8 = new BigNumber("1e8");


const Address = artifacts.require("Utils/Address");
const BlockMiner = artifacts.require("Utils/BlockMiner");
const StringHelpers = artifacts.require("Utils/StringHelpers");
const Math = artifacts.require("Math/Math");
const SafeMath = artifacts.require("Math/SafeMath");
const Babylonian = artifacts.require("Math/Babylonian");
const FixedPoint = artifacts.require("Math/FixedPoint");
const UQ112x112 = artifacts.require("Math/UQ112x112");
const Owned = artifacts.require("Staking/Owned");
const ERC20 = artifacts.require("ERC20/ERC20");
const ERC20Custom = artifacts.require("ERC20/ERC20Custom");
const SafeERC20 = artifacts.require("ERC20/SafeERC20");

// Uniswap related
const TransferHelper = artifacts.require("Uniswap/TransferHelper");
const SwapToPrice = artifacts.require("Uniswap/SwapToPrice");
const UniswapV2ERC20 = artifacts.require("Uniswap/UniswapV2ERC20");
const UniswapV2Factory = artifacts.require("Uniswap/UniswapV2Factory");
const UniswapV2Library = artifacts.require("Uniswap/UniswapV2Library");
const UniswapV2OracleLibrary = artifacts.require("Uniswap/UniswapV2OracleLibrary");
const UniswapV2Pair = artifacts.require("Uniswap/UniswapV2Pair");
const UniswapV2Router02_Modified = artifacts.require("Uniswap/UniswapV2Router02_Modified");

// Collateral
// const WETH = artifacts.require("ERC20/WETH");
const WBTC = artifacts.require("ERC20/WBTC");
const FakeCollateral_WBTC = artifacts.require("FakeCollateral/FakeCollateral_WBTC");

// Collateral Pools
// const XebPoolLibrary = artifacts.require("Xeb/Pools/XebPoolLibrary");
const XebPoolLibrary = artifacts.require("Xeb/Pools/XebPoolLibrary");
const Pool_WBTC = artifacts.require("Xeb/Pools/Pool_WBTC");

// Oracles
const UniswapPairOracle_XEB_WBTC = artifacts.require("Oracle/Fakes/UniswapPairOracle_XEB_WBTC");
const UniswapPairOracle_XESH_WBTC = artifacts.require("Oracle/Fakes/UniswapPairOracle_XESH_WBTC");

// Chainlink Price Consumer
// const ChainlinkETHUSDPriceConsumer = artifacts.require("Oracle/ChainlinkETHUSDPriceConsumer");


// FRAX core
// const FRAXStablecoin = artifacts.require("Frax/FRAXStablecoin");
// const FRAXShares = artifacts.require("FXS/FRAXShares");
const XEBECStablecoin = artifacts.require("Xeb/XEBECStablecoin");
const XEBShares = artifacts.require("Xesh/XEBShares");

// Governance related
const GovernorAlpha = artifacts.require("Governance/GovernorAlpha");
const Timelock = artifacts.require("Governance/Timelock");
const TimelockGovernance = artifacts.require("Governance/TimelockGovernance");

// Staking contracts
const StakingRewards_XEB_WBTC = artifacts.require("Staking/Fake_Stakes/Stake_XEB_WBTC.sol");
const StakingRewards_XESH_WBTC = artifacts.require("Staking/Fake_Stakes/Stake_XESH_WBTC.sol");

const DUMP_ADDRESS = "0x6666666666666666666666666666666666666666";

// Make sure Ganache is running beforehand
module.exports = async function(deployer, network, accounts) {
	// // ======== Set Web3 ========
	// console.log("networks: ", networks);
	// console.log("network: ", network);
	// const { host, port } = (networks[network] || {})
    // if (!host || !port) {
    //   throw new Error(`Unable to find provider for network: ${network}`)
    // }
    // window.web3 = new Web3.providers.HttpProvider(`http://${host}:${port}`);

	// ======== Set the addresses ========
	const COLLATERAL_XEB_AND_XESH_OWNER = accounts[1];
	const ORACLE_ADDRESS = accounts[2];
	const POOL_CREATOR = accounts[3];
	const TIMELOCK_ADMIN = accounts[4];
	const GOVERNOR_GUARDIAN_ADDRESS = accounts[5];
	const STAKING_OWNER = accounts[6];
	const STAKING_REWARDS_DISTRIBUTOR = accounts[7];
	// const COLLATERAL_FRAX_AND_FXS_OWNER = accounts[1];
	// const ORACLE_ADDRESS = accounts[2];
	// const POOL_CREATOR = accounts[3];
	// const TIMELOCK_ADMIN = accounts[4];
	// const GOVERNOR_GUARDIAN_ADDRESS = accounts[5];
	// const STAKING_OWNER = accounts[6];
	// const STAKING_REWARDS_DISTRIBUTOR = accounts[7];
	// const COLLATERAL_FRAX_AND_FXS_OWNER = accounts[8];

	// ======== Set other constants ========
	const ONE_MILLION_DEC8 = new BigNumber("1000000e8");
	const FIVE_MILLION_DEC8 = new BigNumber("5000000e8");
	const TEN_MILLION_DEC8 = new BigNumber("10000000e8");
	const ONE_HUNDRED_MILLION_DEC8 = new BigNumber("100000000e8");
	const COLLATERAL_SEED_DEC8 = new BigNumber(339000e18);
	
	const REDEMPTION_FEE = 400; // 0.04%
	const MINTING_FEE = 300; // 0.03%
	const COLLATERAL_PRICE = 1000;
	const XEB_PRICE = 1000;
	const XESH_PRICE = 1000;
	const TIMELOCK_DELAY = 86400 * 2; // 2 days
	const DUMP_ADDRESS = "0x6666666666666666666666666666666666666666";
	const METAMASK_ADDRESS = "0xb276bA0532Ba10C7e76CE51e037ca26b99052C9A";

	// Print the addresses
	console.log(`====================================================`);

	// ======== Give Metamask some ether ========
	send.ether(COLLATERAL_XEB_AND_XESH_OWNER, METAMASK_ADDRESS, 2e8);

	// ======== Deploy most of the contracts ========
	await deployer.deploy(Address);
	await deployer.deploy(BlockMiner);
	await deployer.deploy(Babylonian);
	await deployer.deploy(UQ112x112);
	await deployer.deploy(StringHelpers);
	await deployer.link(UQ112x112, [UniswapV2Pair]);
	await deployer.link(Babylonian, [FixedPoint, SwapToPrice]);
	await deployer.deploy(FixedPoint);
	await deployer.link(FixedPoint, [UniswapV2OracleLibrary, UniswapPairOracle_XEB_WBTC, UniswapPairOracle_XESH_WBTC]);
	await deployer.link(Address, [ERC20, ERC20Custom, SafeERC20, WBTC, FakeCollateral_WBTC]);
	await deployer.deploy(Math);
	await deployer.link(Math, [StakingRewards_XEB_WBTC, StakingRewards_XESH_WBTC, UniswapV2ERC20, UniswapV2Pair]);
	await deployer.deploy(SafeMath);
	await deployer.link(SafeMath, [ERC20, ERC20Custom, SafeERC20, WBTC, FakeCollateral_WBTC, XEBECStablecoin, Pool_WBTC, XEBShares, StakingRewards_XEB_WBTC, StakingRewards_XESH_WBTC, UniswapV2ERC20, UniswapV2Library, UniswapV2Router02_Modified, SwapToPrice, Timelock, TimelockGovernance]);
	await deployer.deploy(TransferHelper);
	await deployer.link(TransferHelper, [UniswapV2Router02_Modified, SwapToPrice, StakingRewards_XEB_WBTC, StakingRewards_XESH_WBTC, Pool_WBTC]);
	await deployer.deploy(UniswapV2ERC20);
	await deployer.link(UniswapV2ERC20, [UniswapV2Pair]);
	await deployer.deploy(UniswapV2OracleLibrary);
	await deployer.link(UniswapV2OracleLibrary, [UniswapPairOracle_XEB_WBTC, UniswapPairOracle_XESH_WBTC]);
	await deployer.deploy(UniswapV2Library);
	await deployer.link(UniswapV2Library, [UniswapPairOracle_XEB_WBTC, UniswapPairOracle_XESH_WBTC, UniswapV2Router02_Modified, SwapToPrice]);
	await deployer.deploy(UniswapV2Pair);
	await deployer.link(UniswapV2Pair, [UniswapV2Factory]);
	await deployer.deploy(UniswapV2Factory, DUMP_ADDRESS);
	await deployer.deploy(SafeERC20);
	await deployer.link(SafeERC20, [WBTC, FakeCollateral_WBTC, XEBECStablecoin, Pool_WBTC, XEBShares, StakingRewards_XEB_WBTC, StakingRewards_XEB_WBTC, StakingRewards_XESH_WBTC]);
	await deployer.deploy(XebPoolLibrary);
	await deployer.link(XebPoolLibrary, [Pool_WBTC]);
	await deployer.deploy(Owned, COLLATERAL_XEB_AND_XESH_OWNER);
	// await deployer.deploy(ChainlinkETHUSDPriceConsumer);
	await deployer.deploy(Timelock, TIMELOCK_ADMIN, TIMELOCK_DELAY);
	const timelockInstance = await Timelock.deployed();
	await deployer.deploy(XEBECStablecoin, "XEB", COLLATERAL_XEB_AND_XESH_OWNER, timelockInstance.address);
	const xebInstance = await XEBECStablecoin.deployed();
	await deployer.deploy(XEBShares, "XESH", ONE_HUNDRED_MILLION_DEC8, ONE_HUNDRED_MILLION_DEC8, ORACLE_ADDRESS, COLLATERAL_XEB_AND_XESH_OWNER, timelockInstance.address);
	const xeshInstance = await XEBShares.deployed();

	// ======== Deploy the governance contract and its associated timelock ========
	await deployer.deploy(GovernorAlpha, timelockInstance.address, xeshInstance.address, GOVERNOR_GUARDIAN_ADDRESS);
	const governanceInstance = await GovernorAlpha.deployed();
	await deployer.deploy(TimelockGovernance, governanceInstance.address, TIMELOCK_DELAY);
	const timelockGovernanceInstance = await TimelockGovernance.deployed();
	await governanceInstance.__setTimelockAddress(timelockGovernanceInstance.address, { from: GOVERNOR_GUARDIAN_ADDRESS });
	
	// ======== Set the TimelockGovernance as an owner of the XEB contract ========
	await xebInstance.addOwner(timelockGovernanceInstance.address, { from: COLLATERAL_XEB_AND_XESH_OWNER });

	// // ======== Create the fake collateral ERC20 contracts ========
	await deployer.deploy(WBTC, COLLATERAL_XEB_AND_XESH_OWNER);
	const wbtcInstance = await WBTC.deployed();
	
	// // ======== Deploy the router and the SwapToPrice ========
	await deployer.deploy(UniswapV2Router02_Modified, UniswapV2Factory.address, WBTC.address);
	const routerInstance = await UniswapV2Router02_Modified.deployed(); 
	const uniswapFactoryInstance = await UniswapV2Factory.deployed(); 
	await deployer.deploy(SwapToPrice, uniswapFactoryInstance.address, routerInstance.address);

	// // ======== Set the Uniswap pairs and deploy the router ========
	await uniswapFactoryInstance.createPair(xebInstance.address, WBTC.address, { from: COLLATERAL_XEB_AND_XESH_OWNER });
	await uniswapFactoryInstance.createPair(xeshInstance.address, WBTC.address, { from: COLLATERAL_XEB_AND_XESH_OWNER });

	// // ======== Get the addresses of the pairs ========
	const pair_addr_XEB_WBTC = await uniswapFactoryInstance.getPair(xebInstance.address, WBTC.address, { from: COLLATERAL_XEB_AND_XESH_OWNER });
	const pair_addr_XESH_WBTC = await uniswapFactoryInstance.getPair(xeshInstance.address, WBTC.address, { from: COLLATERAL_XEB_AND_XESH_OWNER });

	// // ======== Deploy the staking contracts ========
	await deployer.link(XEBECStablecoin, [StakingRewards_XEB_WBTC, StakingRewards_XESH_WBTC]);
	await deployer.link(StringHelpers, [StakingRewards_XEB_WBTC, StakingRewards_XESH_WBTC]);
	await deployer.deploy(StakingRewards_XEB_WBTC, STAKING_OWNER, STAKING_REWARDS_DISTRIBUTOR, xeshInstance.address, pair_addr_XEB_WBTC, XEBECStablecoin.address);
	await deployer.deploy(StakingRewards_XESH_WBTC, STAKING_OWNER, STAKING_REWARDS_DISTRIBUTOR, xeshInstance.address, pair_addr_XESH_WBTC, XEBECStablecoin.address);
	const stakingInstance_XEB_WBTC = await StakingRewards_XEB_WBTC.deployed();
	const stakingInstance_XESH_WBTC = await StakingRewards_XESH_WBTC.deployed();

	// // ======== Get instances of the pairs ========
	const pair_instance_XEB_WBTC = await UniswapV2Pair.at(pair_addr_XEB_WBTC);
	const pair_instance_XESH_WBTC = await UniswapV2Pair.at(pair_addr_XESH_WBTC);

	// // ======== Add allowances to the Uniswap Router ========
	await wbtcInstance.approve(routerInstance.address, new BigNumber(2000000e8), { from: COLLATERAL_XEB_AND_XESH_OWNER });
	await xebInstance.approve(routerInstance.address, new BigNumber(1000000e8), { from: COLLATERAL_XEB_AND_XESH_OWNER });
	await xeshInstance.approve(routerInstance.address, new BigNumber(5000000e8), { from: COLLATERAL_XEB_AND_XESH_OWNER });

	// ======== Spread some XESH around ========
	// Transfer 1,000,000 XESH each to various accounts
	await xeshInstance.transfer(accounts[1], new BigNumber(ONE_MILLION_DEC8), { from: COLLATERAL_XEB_AND_XESH_OWNER });
	await xeshInstance.transfer(accounts[2], new BigNumber(ONE_MILLION_DEC8), { from: COLLATERAL_XEB_AND_XESH_OWNER });
	await xeshInstance.transfer(accounts[3], new BigNumber(ONE_MILLION_DEC8), { from: COLLATERAL_XEB_AND_XESH_OWNER });
	await xeshInstance.transfer(accounts[4], new BigNumber(ONE_MILLION_DEC8), { from: COLLATERAL_XEB_AND_XESH_OWNER });
	await xeshInstance.transfer(accounts[5], new BigNumber(ONE_MILLION_DEC8), { from: COLLATERAL_XEB_AND_XESH_OWNER });
	await xeshInstance.transfer(accounts[6], new BigNumber(ONE_MILLION_DEC8), { from: COLLATERAL_XEB_AND_XESH_OWNER });
	await xeshInstance.transfer(accounts[7], new BigNumber(ONE_MILLION_DEC8), { from: COLLATERAL_XEB_AND_XESH_OWNER });
	await xeshInstance.transfer(accounts[8], new BigNumber(ONE_MILLION_DEC8), { from: COLLATERAL_XEB_AND_XESH_OWNER });
	await xeshInstance.transfer(accounts[9], new BigNumber(ONE_MILLION_DEC8), { from: COLLATERAL_XEB_AND_XESH_OWNER });

	// // Transfer 1,000,000 XESH each to the staking contracts
	await xeshInstance.transfer(stakingInstance_XEB_WBTC.address, new BigNumber("10000000e8"), { from: COLLATERAL_XEB_AND_XESH_OWNER });
	await xeshInstance.transfer(stakingInstance_XESH_WBTC.address, new BigNumber("10000000e8"), { from: COLLATERAL_XEB_AND_XESH_OWNER });

	// ======== Add liquidity to the pairs so the oracle constructor doesn't error  ========
	// Initially, all prices will be 1:1, but that can be changed in further testing via arbitrage simulations to a known price

	const wbtc_balance_superowner = (new BigNumber(await wbtcInstance.balanceOf(COLLATERAL_XEB_AND_XESH_OWNER))).div(BIG8).toNumber();
	console.log("wbtc_balance_superowner: ", wbtc_balance_superowner);

	// Handle XEB / WBTC
	await routerInstance.addLiquidity(
		xebInstance.address, 
		wbtcInstance.address,
		new BigNumber(323000e8), 
		new BigNumber(1000e8), 
		new BigNumber(323000e8), 
		new BigNumber(1000e8), 
		COLLATERAL_XEB_AND_XESH_OWNER, 
		new BigNumber(2105300114), 
		{ from: COLLATERAL_XEB_AND_XESH_OWNER }
	);

	// Handle XESH / WBTC
	await routerInstance.addLiquidity(
		xeshInstance.address, 
		wbtcInstance.address,
		new BigNumber(1615000e8), 
		new BigNumber(1000e8), 
		new BigNumber(1615000e8), 
		new BigNumber(1000e8), 
		COLLATERAL_XEB_AND_XESH_OWNER, 
		new BigNumber(2105300114), 
		{ from: COLLATERAL_XEB_AND_XESH_OWNER }
	);

	// ======== Set the Uniswap oracles ========
	await deployer.deploy(UniswapPairOracle_XEB_WBTC, uniswapFactoryInstance.address, xebInstance.address, wbtcInstance.address);
	await deployer.deploy(UniswapPairOracle_XESH_WBTC, uniswapFactoryInstance.address, xeshInstance.address, wbtcInstance.address);

	// ======== Set the Xeb Pools ========
	await deployer.link(StringHelpers, [Pool_WBTC]);
	await deployer.deploy(Pool_WBTC, wbtcInstance.address, UniswapPairOracle_XEB_WBTC.address, POOL_CREATOR, timelockInstance.address, FIVE_MILLION_DEC8); 

	// ======== Get the pool instances ========
	const pool_instance_WBTC = await Pool_WBTC.deployed();

	// ======== Set XebPool various private variables ========
	// USDC
	await pool_instance_WBTC.setXEBAddress(xebInstance.address, { from: POOL_CREATOR });
	await pool_instance_WBTC.setXESHAddress(xeshInstance.address, { from: POOL_CREATOR });

	// ======== Set the governance timelock as a valid owner for the pool contracts ======== 
	await pool_instance_WBTC.addOwner(timelockGovernanceInstance.address, { from: POOL_CREATOR });

	// ======== Set the redemption and minting fees ========
	// Set the redemption fee to 0.04%
	await xebInstance.setRedemptionFee(REDEMPTION_FEE, { from: COLLATERAL_XEB_AND_XESH_OWNER });

	// Set the minting fee to 0.03%
	await xebInstance.setMintingFee(MINTING_FEE, { from: COLLATERAL_XEB_AND_XESH_OWNER });

	// ======== Set XEB and XESH oracles ========
	// Get the instances
	const oracle_instance_XEB_WBTC = await UniswapPairOracle_XEB_WBTC.deployed();
	const oracle_instance_XESH_WBTC = await UniswapPairOracle_XESH_WBTC.deployed();

	// Initialize ETH-USD Chainlink Oracle too
	// const oracle_chainlink_ETH_USD = await ChainlinkETHUSDPriceConsumer.deployed();

	// Link the XEB oracles
	await xebInstance.addStablecoinOracle(0, oracle_instance_XEB_WBTC.address, { from: COLLATERAL_XEB_AND_XESH_OWNER });

	// Link the XESH oracles
	await xebInstance.addStablecoinOracle(1, oracle_instance_XESH_WBTC.address, { from: COLLATERAL_XEB_AND_XESH_OWNER });

	// Add the ETH / USD Chainlink oracle too
	// await xebInstance.setETHUSDOracle(oracle_chainlink_ETH_USD.address, { from: COLLATERAL_XEB_AND_XESH_OWNER });

	// ======== Update the prices ========
	// Advance 24 hrs so the period can be computed
	await time.increase(86400 + 1);
	await time.advanceBlock();

	// Make sure the prices are updated
	await oracle_instance_XEB_WBTC.update({ from: COLLATERAL_XEB_AND_XESH_OWNER });
	await oracle_instance_XESH_WBTC.update({ from: COLLATERAL_XEB_AND_XESH_OWNER });
	
	// ======== Set XEB XESH address ========
	// Link the FAKE collateral pool to the XEB contract
	await xebInstance.setXESHAddress(xeshInstance.address, { from: COLLATERAL_XEB_AND_XESH_OWNER });

	// ======== Set XEB collateral pools ========
	// Link the FAKE collateral pool to the XEB contract
	await xebInstance.addPool(pool_instance_WBTC.address, { from: COLLATERAL_XEB_AND_XESH_OWNER });

	// ======== Set the XEB address inside of the XESH contract ========
	// Link the XEB contract to the XESH contract
	await xeshInstance.setXEBAddress(xebInstance.address, { from: accounts[2] });

	// ======== Display prices ========
	
	// Get the prices
	let xeb_price_from_XEB_WBTC = (new BigNumber("1000e8").div(BIG8)).toNumber();
	let xesh_price_from_XESH_WBTC = (new BigNumber("1000e8").div(BIG8)).toNumber();
	
	const xeb_price_initial = new BigNumber(await xebInstance.xeb_price({ from: COLLATERAL_XEB_AND_XESH_OWNER })).div(BIG8);
	const xesh_price_initial = new BigNumber(await xebInstance.xesh_price({ from: COLLATERAL_XEB_AND_XESH_OWNER })).div(BIG8);

	// Print the new prices
	console.log("xeb_price_initial: ", xeb_price_initial.toString() , " XEB = 1000 bitcoin satoshi");
	console.log("xesh_price_initial: ", xesh_price_initial.toString(), " XESH = 1000 bitcoin satoshi");
	console.log("xeb_price_from_XEB_WBTC: ", xeb_price_from_XEB_WBTC.toString(), " XEB = 1000 satoshi");
	console.log("xesh_price_from_XESH_WBTC: ", xesh_price_from_XESH_WBTC.toString(), " XESH = 1000 satoshi");

	// ======== Transfer some tokens and ETH to Metamask ========
	// ETH
	await xeshInstance.transfer(METAMASK_ADDRESS, new BigNumber("1000e8"), { from: COLLATERAL_XEB_AND_XESH_OWNER });

	// XEB and XESH
	await xeshInstance.transfer(METAMASK_ADDRESS, new BigNumber("1000e8"), { from: COLLATERAL_XEB_AND_XESH_OWNER });
	await xebInstance.transfer(METAMASK_ADDRESS, new BigNumber("777e8"), { from: COLLATERAL_XEB_AND_XESH_OWNER });

	// Collateral 
	await wbtcInstance.transfer(METAMASK_ADDRESS, new BigNumber("10000e8"), { from: COLLATERAL_XEB_AND_XESH_OWNER });

	// Liquidity tokens
	await pair_instance_XEB_WBTC.transfer(METAMASK_ADDRESS, new BigNumber("200e8"), { from: COLLATERAL_XEB_AND_XESH_OWNER });
	await pair_instance_XESH_WBTC.transfer(METAMASK_ADDRESS, new BigNumber("240e8"), { from: COLLATERAL_XEB_AND_XESH_OWNER });

	// ======== Initialize the staking rewards ========
	await stakingInstance_XEB_WBTC.initializeDefault({ from: STAKING_OWNER });
	await stakingInstance_XESH_WBTC.initializeDefault({ from: STAKING_OWNER });


	// ======== Seed the collateral pools ========
	// IF YOU ARE RUNNING MOCHA TESTS, SET THIS GROUP TO FALSE!
	// IF YOU ARE RUNNING MOCHA TESTS, SET THIS GROUP TO FALSE!
	// IF YOU ARE RUNNING MOCHA TESTS, SET THIS GROUP TO FALSE!
	if (false){
		await col_instance_USDC.transfer(pool_instance_USDC.address, COLLATERAL_SEED_DEC8, { from: COLLATERAL_XEB_AND_XESH_OWNER });
		await col_instance_USDT.transfer(pool_instance_USDT.address, COLLATERAL_SEED_DEC8, { from: COLLATERAL_XEB_AND_XESH_OWNER });
		await col_instance_yUSD.transfer(pool_instance_yUSD.address, COLLATERAL_SEED_DEC8, { from: COLLATERAL_XEB_AND_XESH_OWNER });
	
		// ======== Advance a block and 24 hours to catch things up ========
		await time.increase(86400 + 1);
		await time.advanceBlock();
		await xebInstance.refreshCollateralRatio();
	
		// ======== Make some governance proposals ========
	
		// Minting fee 0.04% -> 0.1%
		await governanceInstance.propose(
			[xebInstance.address],
			[0],
			['setMintingFee(uint256)'],
			[web3.eth.abi.encodeParameters(['uint256'], [1000])], // 0.1%
			"Minting fee increase",
			"I hereby propose to increase the minting fee from 0.04% to 0.1%",
			{ from: COLLATERAL_XEB_AND_XESH_OWNER }
		);
		
		// Redemption fee 0.04% -> 0.08%
		await governanceInstance.propose(
			[xebInstance.address],
			[0],
			['setMintingFee(uint256)'],
			[web3.eth.abi.encodeParameters(['uint256'], [800])], // 0.1%
			"Redemption fee increase",
			"I want to increase the redemption fee from 0.04% to 0.08%",
			{ from: GOVERNOR_GUARDIAN_ADDRESS }
		);
	
		// Increase the USDC pool ceiling from 10M to 15M
		// This mini hack is needed
		const num = 15000000 * (10 ** 18);
		const numAsHex = "0x" + num.toString(16);
		await governanceInstance.propose(
			[pool_instance_USDC.address],
			[0],
			['setPoolCeiling(uint256)'],
			[web3.eth.abi.encodeParameters(['uint256'], [numAsHex])], // 15M
			"USDC Pool ceiling raise",
			"Raise the USDC pool ceiling to 15M",
			{ from: STAKING_REWARDS_DISTRIBUTOR }
		);
	
		// Advance one block so voting can begin
		await time.increase(15);
		await time.advanceBlock();
	
		await governanceInstance.castVote(1, true, { from: COLLATERAL_XEB_AND_XESH_OWNER });
		await governanceInstance.castVote(2, true, { from: GOVERNOR_GUARDIAN_ADDRESS });
		await governanceInstance.castVote(3, true, { from: STAKING_REWARDS_DISTRIBUTOR });
	
		// ======== Advance a block and 24 hours to catch things up ========
		await time.increase(86400 + 1);
		await time.advanceBlock();
	}
	

	// ======== Note the addresses ========
	// If you are testing the frontend, you need to copy-paste the output of CONTRACT_ADDRESSES to the frontend src/misc/constants.tsx
	let CONTRACT_ADDRESSES = {
		ganache: {
			main: {
				XEB: xebInstance.address,
				XESH: xeshInstance.address
			},
			oracles: {
				XEB_WBTC: oracle_instance_XEB_WBTC.address,
				XESH_WBTC: oracle_instance_XESH_WBTC.address,
			},
			collateral: {
				WBTC: wbtcInstance.address,
			},
			governance: governanceInstance.address,
			pools: {
				WBTC: pool_instance_WBTC.address,
			},
			stake_tokens: {
				'Uniswap XEB/WBTC': pair_instance_XEB_WBTC.address,
				'Uniswap XESH/WBTC': pair_instance_XESH_WBTC.address,
			},
			staking_contracts_for_tokens: {
				'Uniswap XEB/WBTC': stakingInstance_XEB_WBTC.address,
				'Uniswap XESH/WBTC': stakingInstance_XESH_WBTC.address
			}
		}      
	}

	console.log("CONTRACT_ADDRESSES: ", CONTRACT_ADDRESSES);

	// deployer.deploy(UniswapPairOracle);
	console.log(`==========================================================`);
};
