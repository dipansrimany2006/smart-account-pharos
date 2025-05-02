const { ethers } = require("hardhat");

// Configuration - use your deployed contract addresses
const EP_address = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const PM_address = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

async function main() {
  console.log("Funding paymaster...");
  
  // Get EntryPoint contract
  const entryPoint = await ethers.getContractAt("EntryPoint", EP_address);
  
  // Check current balance
  const balanceBefore = await entryPoint.balanceOf(PM_address);
  console.log("Paymaster balance before:", ethers.formatEther(balanceBefore), "ETH");
  
  // Deposit 1 ETH to the paymaster
  const tx = await entryPoint.depositTo(PM_address, { value: ethers.parseEther("100") });
  await tx.wait();
  
  // Check new balance
  const balanceAfter = await entryPoint.balanceOf(PM_address);
  console.log("Paymaster balance after:", ethers.formatEther(balanceAfter), "ETH");
  console.log("Successfully funded paymaster!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });