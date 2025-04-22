
const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("AccountFactoryModule", (m) => {
  const accountfactory = m.contract("AccountFactory");
  return { accountfactory };
});
