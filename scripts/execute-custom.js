const { ethers } = require("hardhat");

// Configuration
const Factory_Nonce = 1;
const AF_address = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const EP_address = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const PM_address = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

/**
 * Execute a custom transaction from a smart account
 * @param {string} targetAddress - Address to call
 * @param {string} value - ETH value in wei
 * @param {string} callData - Encoded function call data
 * @param {number} accountIndex - Index of the account to use (0 for first account, 1 for second)
 */
async function executeFromAccount(targetAddress, value, callData, accountIndex = 0) {
  const entryPoint = await ethers.getContractAt("EntryPoint", EP_address);
  const AccountFactory = await ethers.getContractFactory("AccountFactory");
  const Account = await ethers.getContractFactory("Account");
  
  // Get signers
  const signers = await ethers.getSigners();
  const signer = signers[accountIndex];
  const signerAddress = await signer.getAddress();
  
  // Calculate smart account address
  const sender = ethers.getCreateAddress({
    from: AF_address,
    nonce: Factory_Nonce + accountIndex,
  });
  
  console.log(`Using smart account ${accountIndex + 1} at address:`, sender);
  
  // Check if account exists
  const accountCode = await ethers.provider.getCode(sender);
  const shouldCreateAccount = accountCode === "0x";
  
  let initCode = "0x";
  if (shouldCreateAccount) {
    initCode = AF_address + 
      AccountFactory.interface.encodeFunctionData("createAccount", [signerAddress]).slice(2);
    console.log(`Will create account ${accountIndex + 1}`);
  } else {
    console.log(`Account ${accountIndex + 1} already exists`);
  }
  
  // Common parameters for UserOperations
  const verificationGasLimit = 1000000;
  const callGasLimit = 500000;
  const accountGasLimits = ethers.concat([
    ethers.zeroPadValue(ethers.toBeHex(verificationGasLimit), 16),
    ethers.zeroPadValue(ethers.toBeHex(callGasLimit), 16),
  ]);
  
  const maxPriorityFeePerGas = ethers.parseUnits("5", "gwei");
  const maxFeePerGas = ethers.parseUnits("10", "gwei");
  const gasFees = ethers.concat([
    ethers.zeroPadValue(ethers.toBeHex(maxPriorityFeePerGas), 16),
    ethers.zeroPadValue(ethers.toBeHex(maxFeePerGas), 16),
  ]);
  
  // Pack paymasterAndData correctly
  const paymasterVerificationGasLimit = 100000;
  const paymasterPostOpGasLimit = 100000;
  const paymasterAndData = ethers.concat([
    PM_address,
    ethers.zeroPadValue(ethers.toBeHex(paymasterVerificationGasLimit), 16),
    ethers.zeroPadValue(ethers.toBeHex(paymasterPostOpGasLimit), 16),
  ]);
  
  // Create calldata for account to execute the transaction
  const executeTransactionCalldata = Account.interface.encodeFunctionData("executeTransaction", [
    targetAddress,  // target address
    value,          // ETH value
    callData        // calldata
  ]);
  
  const userOp = {
    sender,
    nonce: await entryPoint.getNonce(sender, 0),
    initCode: shouldCreateAccount ? initCode : "0x",
    callData: executeTransactionCalldata,
    accountGasLimits,
    preVerificationGas: 50_000,
    gasFees,
    paymasterAndData,
    signature: "0x",
  };
  
  const userOpHash = await entryPoint.getUserOpHash(userOp);
  userOp.signature = await signer.signMessage(ethers.getBytes(userOpHash));
  
  console.log(`Executing transaction from account ${accountIndex + 1}...`);
  const tx = await entryPoint.handleOps([userOp], signerAddress);
  const receipt = await tx.wait();
  
  console.log("Transaction executed successfully!");
  console.log("Gas used:", receipt.gasUsed.toString());
  
  return receipt;
}

// Example usage: Transfer ETH between accounts
async function main() {
  // Deploy a sample token if one doesn't exist yet
  let sampleTokenAddress;
  try {
    const deployedCode = await ethers.provider.getCode("0x5FC8d32690cc91D4c39d9d3abcBD16989F875707");
    if (deployedCode === "0x") {
      console.log("Deploying a sample token first...");
      const [deployer] = await ethers.getSigners();
      const SampleToken = await ethers.getContractFactory("SampleToken");
      const token = await SampleToken.deploy(await deployer.getAddress());
      await token.waitForDeployment();
      sampleTokenAddress = token.target;
      console.log("Sample token deployed at:", sampleTokenAddress);
    } else {
      sampleTokenAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
      console.log("Using existing sample token at:", sampleTokenAddress);
    }
  } catch (error) {
    console.log("Error checking for token, deploying a new one:", error);
    const [deployer] = await ethers.getSigners();
    const SampleToken = await ethers.getContractFactory("SampleToken");
    const token = await SampleToken.deploy(await deployer.getAddress());
    await token.waitForDeployment();
    sampleTokenAddress = token.target;
    console.log("Sample token deployed at:", sampleTokenAddress);
  }

  // You can uncomment and use any of these example transactions:
  
  // 1. Example: Transfer 0.01 ETH from account 0 to account 1
  /*
  const account1 = ethers.getCreateAddress({
    from: AF_address,
    nonce: Factory_Nonce + 1,
  });
  
  await executeFromAccount(
    account1,                    // target: the recipient account
    ethers.parseEther("0.01"),   // value: 0.01 ETH
    "0x",                        // calldata: empty for simple ETH transfer
    0                            // accountIndex: using first account
  );
  */
  
  // 2. Example: Transfer 10 tokens from account 0 to account 1
  /*
  const account1 = ethers.getCreateAddress({
    from: AF_address,
    nonce: Factory_Nonce + 1,
  });
  
  const ERC20Interface = new ethers.Interface([
    "function transfer(address to, uint256 amount) returns (bool)"
  ]);
  
  const tokenTransferData = ERC20Interface.encodeFunctionData("transfer", [
    account1,
    ethers.parseUnits("10", 18)
  ]);
  
  await executeFromAccount(
    sampleTokenAddress,          // target: the token contract
    0,                           // value: 0 ETH
    tokenTransferData,           // calldata: token transfer
    0                            // accountIndex: using first account
  );
  */
  
  // 3. Example: Call a custom function on any contract
  /*
  const YourContractInterface = new ethers.Interface([
    "function yourFunction(uint256 param1, string param2) returns (bool)"
  ]);
  
  const customCalldata = YourContractInterface.encodeFunctionData("yourFunction", [
    123,
    "hello"
  ]);
  
  await executeFromAccount(
    "0xYourContractAddress",     // target: your contract
    0,                           // value: 0 ETH
    customCalldata,              // calldata: custom function call
    0                            // accountIndex: using first account
  );
  */
}

// Uncomment this to run the main function
// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });

// Export the executeFromAccount function for use in other scripts
module.exports = { executeFromAccount };