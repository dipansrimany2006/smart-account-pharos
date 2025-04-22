// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
// import "hardhat/console.sol";
import "node_modules/@account-abstraction/contracts/core/EntryPoint.sol";
import "node_modules/@account-abstraction/contracts/interfaces/IAccount.sol";


contract Account is IAccount {
    address public owner;
    uint256 public count;

    constructor(address _owner) {
        owner = _owner;
    }

    function validateUserOp(PackedUserOperation calldata, bytes32, uint256) external pure returns (uint256 validationData) {
        
        return 0;
    }


    function execute() external {
        count++;
    }
}


contract AccountFactory {
    function createAccount(address _owner) public returns (address) {
        Account acc = new Account(_owner);
        return address(acc);
    }
}