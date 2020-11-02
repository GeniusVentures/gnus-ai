const GNUSToken = artifacts.require('GNUSToken');
const ComPayChannel = artifacts.require('ComPayChannel');
const StorageTest = artifacts.require('StorageTest');
// require('@openzeppelin/test-helpers/configure')({ provider: web3.currentProvider, environment: 'truffle' });

// const { singletons } = require('@openzeppelin/test-helpers');

module.exports = async function (deployer, network, accounts) {
  
  await deployer.deploy(GNUSToken);
  const geniusToken = await GNUSToken.deployed();
  await deployer.deploy(ComPayChannel, geniusToken.address); 
  // const comPayChannel = await ComPayChannel.deployed();  
  await deployer.deploy(StorageTest);
  
  
};
