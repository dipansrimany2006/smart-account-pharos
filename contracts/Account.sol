// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
// import "hardhat/console.sol";
import "@account-abstraction/contracts/core/EntryPoint.sol";
import "@account-abstraction/contracts/interfaces/IAccount.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract Account is IAccount {
    address public owner;
    uint256 public count;
    
    // Add this to receive ETH
    receive() external payable {}
    
    constructor(address _owner) {
        owner = _owner;
    }

    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256
    ) external view returns (uint256 validationData) {
        address recovered = ECDSA.recover(
            MessageHashUtils.toEthSignedMessageHash(userOpHash),
            userOp.signature
        );
        return owner == recovered ? 0 : 1;
    }
    
    // Keep the original execute for backward compatibility
    function execute() external {
        count++;
    }
    
    // Add new function to execute arbitrary calls
    function executeTransaction(
        address target,
        uint256 value,
        bytes calldata data
    ) external returns (bytes memory) {
        // Only EntryPoint can call this
        require(msg.sender == address(0x5FbDB2315678afecb367f032d93F642f64180aa3), "Only EntryPoint can call");
        
        count++; // Maintain counter functionality
        
        // Execute the requested transaction
        (bool success, bytes memory result) = target.call{value: value}(data);
        require(success, "Transaction execution failed");
        
        return result;
    }
}

contract AccountFactory {
    function createAccount(address _owner) public returns (address) {
        Account acc = new Account(_owner);
        return address(acc);
    }
}