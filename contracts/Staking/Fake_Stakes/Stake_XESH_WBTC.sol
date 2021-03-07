// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "../StakingRewards.sol";

contract Stake_XESH_WBTC is StakingRewards {
    constructor(
        address _owner,
        address _rewardsDistribution,
        address _rewardsToken,
        address _stakingToken,
        address _xeb_address
    ) 
    StakingRewards(_owner, _rewardsDistribution, _rewardsToken, _stakingToken, _xeb_address)
    public {}
}