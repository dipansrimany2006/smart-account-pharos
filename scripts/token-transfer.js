const { ethers } = require("hardhat");

// Configuration
const Factory_Nonce = 1;
const AF_address = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const EP_address = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const PM_address = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
// You'll need to deploy the token first and put its address here
let TOKEN_ADDRESS = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

async function main() {
  const entryPoint = await ethers.getContractAt("EntryPoint", EP_address);
  const AccountFactory = await ethers.getContractFactory("AccountFactory");
  const Account = await ethers.getContractFactory("Account");
  
  // Get signers
  const [signer0, signer1] = await ethers.getSigners();
  const address0 = await signer0.getAddress();
  const address1 = await signer1.getAddress();
  
  // Deploy token if not already deployed
  if (!TOKEN_ADDRESS) {
    console.log("Deploying sample token...");
    const SampleToken = await ethers.getContractFactory("SampleToken");
    const token = await SampleToken.deploy(address0);
    await token.waitForDeployment();
    TOKEN_ADDRESS = token.target;
    console.log("Sample token deployed at:", TOKEN_ADDRESS);
  }
  
  const token = await ethers.getContractAt("SampleToken", TOKEN_ADDRESS);
  
  // Calculate smart account addresses
  const sender0 = ethers.getCreateAddress({
    from: AF_address,
    nonce: Factory_Nonce,
  });
  
  const sender1 = ethers.getCreateAddress({
    from: AF_address,
    nonce: Factory_Nonce + 1,
  });
  
  console.log("Account 1 address:", sender0);
  console.log("Account 2 address:", sender1);
  
  // Check if accounts exist and create them if needed
  const account0Code = await ethers.provider.getCode(sender0);
  const account1Code = await ethers.provider.getCode(sender1);
  
  const shouldCreateAccount0 = account0Code === "0x";
  const shouldCreateAccount1 = account1Code === "0x";
  
  // Initialize accounts if needed
  if (shouldCreateAccount0 || shouldCreateAccount1) {
    console.log("Need to create accounts first. Run transfer-between-accounts.js first.");
    return;
  }
  
  // Check if the paymaster is funded
  const paymasterBalance = await entryPoint.balanceOf(PM_address);
  console.log("Paymaster balance:", ethers.formatEther(paymasterBalance), "ETH");
  
  if (paymasterBalance < ethers.parseEther("0.1")) {
    console.log("Funding paymaster with 1 ETH...");
    const fundTx = await entryPoint.depositTo(PM_address, { value: ethers.parseEther("1") });
    await fundTx.wait();
    console.log("Paymaster funded successfully!");
  }
  
  // Transfer some tokens to the first smart account
  const balance0 = await token.balanceOf(sender0);
  
  // Fixed: Changed isZero() to compare with zero
  if (balance0 == 0) {
    console.log("Transferring initial tokens to smart account 1...");
    const transferTx = await token.transfer(sender0, ethers.parseUnits("100", 18));
    await transferTx.wait();
    console.log("Tokens transferred to smart account 1");
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
  
  // Now perform a token transfer from account0 to account1
  console.log("Sending tokens from account 1 to account 2...");
  
  // Get ERC20 interface for transfer
  const transferAmount = ethers.parseUnits("10", 18); // 10 tokens
  const ERC20Interface = new ethers.Interface([
    "function transfer(address to, uint256 amount) returns (bool)"
  ]);
  
  // Create calldata for account0 to transfer tokens to account1
  const tokenTransferData = ERC20Interface.encodeFunctionData("transfer", [
    sender1,
    transferAmount
  ]);
  
  const executeTransactionCalldata = Account.interface.encodeFunctionData("executeTransaction", [
    TOKEN_ADDRESS,  // target is the token contract
    0,  // No ETH value
    tokenTransferData  // tokenTransfer calldata
  ]);
  
  const transferOp = {
    sender: sender0,  // from account0
    nonce: await entryPoint.getNonce(sender0, 0),
    initCode: "0x",  // account already deployed
    callData: executeTransactionCalldata,
    accountGasLimits,
    preVerificationGas: 50_000,
    gasFees,
    paymasterAndData,
    signature: "0x",
  };
  
  const transferOpHash = await entryPoint.getUserOpHash(transferOp);
  transferOp.signature = await signer0.signMessage(ethers.getBytes(transferOpHash));
  
  console.log("Before token transfer:");
  console.log("Account 1 token balance:", ethers.formatUnits(await token.balanceOf(sender0), 18));
  console.log("Account 2 token balance:", ethers.formatUnits(await token.balanceOf(sender1), 18));
  
  const transferTx = await entryPoint.handleOps([transferOp], address0);
  await transferTx.wait();
  
  console.log("After token transfer:");
  console.log("Account 1 token balance:", ethers.formatUnits(await token.balanceOf(sender0), 18));
  console.log("Account 2 token balance:", ethers.formatUnits(await token.balanceOf(sender1), 18));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });