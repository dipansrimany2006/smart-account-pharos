
const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("EntryPointModule", (m) => {
  const entrypoint = m.contract("EntryPoint");
  console.log(entrypoint);
  return { entrypoint };
});
