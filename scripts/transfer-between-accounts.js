const { ethers } = require("hardhat");

// Configuration
const Factory_Nonce = 1;
const AF_address = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const EP_address = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const PM_address = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

// First account will be derived from signer0
// Second account will be derived from signer1
async function main() {
  const entryPoint = await ethers.getContractAt("EntryPoint", EP_address);
  const AccountFactory = await ethers.getContractFactory("AccountFactory");
  const Account = await ethers.getContractFactory("Account");
  
  // Get two signers for two different accounts
  const [signer0, signer1] = await ethers.getSigners();
  const address0 = await signer0.getAddress();
  const address1 = await signer1.getAddress();
  
  // Calculate the addresses of the counterfactual accounts
  const sender0 = ethers.getCreateAddress({
    from: AF_address,
    nonce: Factory_Nonce,
  });
  
  const sender1 = ethers.getCreateAddress({
    from: AF_address,
    nonce: Factory_Nonce + 1, // Using next nonce for second account
  });
  
  console.log("Account 1 address:", sender0);
  console.log("Account 2 address:", sender1);
  
  // Check if accounts exist and create them if needed
  const account0Code = await ethers.provider.getCode(sender0);
  const account1Code = await ethers.provider.getCode(sender1);
  
  const shouldCreateAccount0 = account0Code === "0x";
  const shouldCreateAccount1 = account1Code === "0x";
  
  let initCode0 = "0x";
  let initCode1 = "0x";
  
  if (shouldCreateAccount0) {
    initCode0 = AF_address + 
      AccountFactory.interface.encodeFunctionData("createAccount", [address0]).slice(2);
    console.log("Will create account 1");
  } else {
    console.log("Account 1 already exists");
    
    // Fund the existing account if needed
    if ((await ethers.provider.getBalance(sender0)) < ethers.parseEther("0.1")) {
      await signer0.sendTransaction({
        to: sender0,
        value: ethers.parseEther("0.1")
      });
      console.log("Funded account 1 with 0.1 ETH");
    }
  }
  
  if (shouldCreateAccount1) {
    initCode1 = AF_address + 
      AccountFactory.interface.encodeFunctionData("createAccount", [address1]).slice(2);
    console.log("Will create account 2");
  } else {
    console.log("Account 2 already exists");
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
  
  // Check if paymaster is funded
  const paymasterBalance = await entryPoint.balanceOf(PM_address);
  console.log("Paymaster balance:", ethers.formatEther(paymasterBalance), "ETH");
  
  if (paymasterBalance < ethers.parseEther("0.1")) {
    console.log("Funding paymaster with 1 ETH...");
    const fundTx = await entryPoint.depositTo(PM_address, { value: ethers.parseEther("1") });
    await fundTx.wait();
    console.log("Paymaster funded successfully!");
  }
  
  // Pack paymasterAndData correctly
  const paymasterVerificationGasLimit = 100000;
  const paymasterPostOpGasLimit = 100000;
  const paymasterAndData = ethers.concat([
    PM_address,
    ethers.zeroPadValue(ethers.toBeHex(paymasterVerificationGasLimit), 16),
    ethers.zeroPadValue(ethers.toBeHex(paymasterPostOpGasLimit), 16),
  ]);
  
  // Create and execute operation to initialize accounts if needed
  if (shouldCreateAccount0 || shouldCreateAccount1) {
    const initOps = [];
    
    if (shouldCreateAccount0) {
      const initOp0 = {
        sender: sender0,
        nonce: await entryPoint.getNonce(sender0, 0),
        initCode: initCode0,
        callData: Account.interface.encodeFunctionData("execute"),
        accountGasLimits,
        preVerificationGas: 50_000,
        gasFees,
        paymasterAndData,
        signature: "0x",
      };
      
      const userOpHash0 = await entryPoint.getUserOpHash(initOp0);
      initOp0.signature = await signer0.signMessage(ethers.getBytes(userOpHash0));
      initOps.push(initOp0);
    }
    
    if (shouldCreateAccount1) {
      const initOp1 = {
        sender: sender1,
        nonce: await entryPoint.getNonce(sender1, 0),
        initCode: initCode1,
        callData: Account.interface.encodeFunctionData("execute"),
        accountGasLimits,
        preVerificationGas: 50_000,
        gasFees,
        paymasterAndData,
        signature: "0x",
      };
      
      const userOpHash1 = await entryPoint.getUserOpHash(initOp1);
      initOp1.signature = await signer1.signMessage(ethers.getBytes(userOpHash1));
      initOps.push(initOp1);
    }
    
    if (initOps.length > 0) {
      console.log("Initializing accounts...");
      const tsx = await entryPoint.handleOps(initOps, address0);
      await tsx.wait();
      console.log("Accounts initialized");
    }
  }
  
  // Now perform a transfer from account0 to account1
  console.log("Sending ETH from account 1 to account 2...");
  
  // Create calldata for account0 to transfer 0.01 ETH to account1
  const transferAmount = ethers.parseEther("0.01");
  const transferCalldata = Account.interface.encodeFunctionData("executeTransaction", [
    sender1,  // target is account1
    transferAmount,  // 0.01 ETH
    "0x"  // empty calldata for simple ETH transfer
  ]);
  
  const transferOp = {
    sender: sender0,  // from account0
    nonce: await entryPoint.getNonce(sender0, 0),
    initCode: "0x",  // account already deployed
    callData: transferCalldata,
    accountGasLimits,
    preVerificationGas: 50_000,
    gasFees,
    paymasterAndData,
    signature: "0x",
  };
  
  const transferOpHash = await entryPoint.getUserOpHash(transferOp);
  transferOp.signature = await signer0.signMessage(ethers.getBytes(transferOpHash));
  
  console.log("Before transfer:");
  console.log("Account 1 balance:", ethers.formatEther(await ethers.provider.getBalance(sender0)));
  console.log("Account 2 balance:", ethers.formatEther(await ethers.provider.getBalance(sender1)));
  
  const transferTx = await entryPoint.handleOps([transferOp], address0);
  await transferTx.wait();
  
  console.log("After transfer:");
  console.log("Account 1 balance:", ethers.formatEther(await ethers.provider.getBalance(sender0)));
  console.log("Account 2 balance:", ethers.formatEther(await ethers.provider.getBalance(sender1)));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });