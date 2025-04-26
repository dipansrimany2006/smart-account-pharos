const { ethers } = require("hardhat");

async function main (){

    const ep = await ethers.deployContract("EntryPoint");
    await ep.waitForDeployment();
    console.log(`EP deployed to ${ep.target}`);
    

    const af = await ethers.deployContract("AccountFactory");
    await af.waitForDeployment();
    console.log(`AF deployed to ${af.target}`);

    const pm = await ethers.deployContract("Paymaster");
    await pm.waitForDeployment();
    console.log(`PM deployed to ${pm.target}`);


}

try {
    main();
} catch (error) {
    console.log(error);
    
}