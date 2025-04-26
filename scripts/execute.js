const { ethers } = require("hardhat");

const Factory_Nonce = 1;
const AF_address = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const EP_address = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const PM_address = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

async function main() {
  const epcode = await ethers.provider.getCode(EP_address);
  const afcode = await ethers.provider.getCode(AF_address);
  if (epcode === "0x") {
    console.error("No contract deployed at EntryPoint address:", EP_address);
    return;
  }

  if (afcode === "0x") {
    console.error("No contract deployed at EntryPoint address:", AF_address);
    return;
  }

  console.log("Both contracts exist");

  const entryPoint = await ethers.getContractAt("EntryPoint", EP_address);

  const sender = ethers.getCreateAddress({
    from: AF_address,
    nonce: Factory_Nonce,
  });

  const AccountFactory = await ethers.getContractFactory("AccountFactory");
  const [signer0] = await ethers.getSigners();
  const address0 = await signer0.getAddress();
  const initCode =
    AF_address +
    AccountFactory.interface
      .encodeFunctionData("createAccount", [address0])
      .slice(2);

  console.log(sender);

  const Account = await ethers.getContractFactory("Account");

  // Pack the gas limits correctly for accountGasLimits
  const verificationGasLimit = 1000000;
  const callGasLimit = 500000;
  const accountGasLimits = ethers.concat([
    ethers.zeroPadValue(ethers.toBeHex(verificationGasLimit), 16),
    ethers.zeroPadValue(ethers.toBeHex(callGasLimit), 16),
  ]);

  // Pack the gas fees correctly
  const maxPriorityFeePerGas = ethers.parseUnits("5", "gwei");
  const maxFeePerGas = ethers.parseUnits("10", "gwei");
  const gasFees = ethers.concat([
    ethers.zeroPadValue(ethers.toBeHex(maxPriorityFeePerGas), 16),
    ethers.zeroPadValue(ethers.toBeHex(maxFeePerGas), 16),
  ]);

  // Check if the account already exists
  const accountCode = await ethers.provider.getCode(sender);
  const shouldUseInitCode = accountCode === "0x";

  // await entryPoint.depositTo(PM_address, { value: ethers.parseEther("100") });

  // Pack paymasterAndData correctly
  const paymasterVerificationGasLimit = 100000;
  const paymasterPostOpGasLimit = 100000;
  const paymasterAndData = ethers.concat([
    PM_address,
    ethers.zeroPadValue(ethers.toBeHex(paymasterVerificationGasLimit), 16),
    ethers.zeroPadValue(ethers.toBeHex(paymasterPostOpGasLimit), 16),
  ]);

  const packedUserOp = {
    sender, //smart account address
    nonce: await entryPoint.getNonce(sender, 0),
    initCode: shouldUseInitCode ? initCode : "0x",
    callData: Account.interface.encodeFunctionData("execute"),
    accountGasLimits: accountGasLimits,
    preVerificationGas: 50_000,
    gasFees: gasFees,
    paymasterAndData: paymasterAndData,
    signature: "0x",
  };

  console.log("Account exists:", !shouldUseInitCode);
  console.log("Using initCode:", shouldUseInitCode);
  console.log("UserOp details:", {
    sender: packedUserOp.sender,
    nonce: packedUserOp.nonce.toString(),
    initCodeLength: packedUserOp.initCode.length,
    verificationGasLimit,
    callGasLimit,
  });

  const tsx = await entryPoint.handleOps([packedUserOp], address0);
  const receipt = await tsx.wait();
  console.log(receipt);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });