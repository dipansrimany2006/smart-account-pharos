const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", await deployer.getAddress());

  const SampleToken = await ethers.getContractFactory("SampleToken");
  const token = await SampleToken.deploy(await deployer.getAddress());

  await token.waitForDeployment();

  console.log("Token deployed to:", token.target);
  console.log("Owner balance:", ethers.formatUnits(await token.balanceOf(await deployer.getAddress()), 18));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });