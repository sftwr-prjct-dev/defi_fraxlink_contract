// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0 <0.7.0;

import "./XebPool.sol";

contract Pool_WBTC is XebPool {
    constructor(
        address _collateral_address,
        address _oracle_address,
        address _creator_address,
        address _timelock_address,
        uint256 _pool_ceiling
    ) 
    XebPool(_collateral_address, _oracle_address, _creator_address, _timelock_address, _pool_ceiling)
    public {
    	_setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }
}