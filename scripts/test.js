const { ethers } = require("hardhat");

const Smart_Addr = "0xCafac3dD18aC6c6e92c921884f9E4176737C052c";
const EP_address = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const PM_address = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

async function main() {
  const account = await ethers.getContractAt("Account", Smart_Addr);
  const count = await account.count();
  console.log(count);

  console.log("account balance", await ethers.provider.getBalance(Smart_Addr));

  const ep = await ethers.getContractAt("EntryPoint", EP_address);
  console.log("account balance on EP", await ep.balanceOf(Smart_Addr));
  console.log("Paymaster balance on EP", await ep.balanceOf(PM_address));
  
}

try {
  main();
} catch (error) {
  console.log(error);
}
