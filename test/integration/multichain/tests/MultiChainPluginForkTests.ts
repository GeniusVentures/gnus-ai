import { expect } from 'chai';
import { ethers } from 'hardhat';
import dotenv from 'dotenv';
import { multichain } from 'hardhat-multichain';
import hre from 'hardhat';

describe('Multichain Integration Tests', function () {
  this.timeout(0); // unlimited time for debugging
  const chains = multichain.getProviders();

  it('should check all chain providers are defined and have valid blocknumber ', async function () {
    for (const [chainName, provider] of chains.entries()) {
      console.log(`Chain: ${chainName}`);
      expect(provider).to.not.be.undefined;
      
      const blockNumber = await provider.getBlockNumber();
      console.log(`Block number for ${chainName} fork: ${blockNumber}`);
      console.log(`${chainName} block number:`, blockNumber);
      expect(blockNumber).to.be.a('number');
    }
  });
  
  it('Should perform check on getting a chain object and details that match config', async function () {
    for (const [chainName] of chains.entries()) {
      // This time we get the provider using the chain name
      const provider = await chains.get(chainName);
      expect(provider).to.not.be.undefined;

      const blockNumber = await provider?.getBlockNumber();
      const configBlockNumber = hre.config.chainManager?.chains?.[chainName]?.blockNumber;
      expect(blockNumber).to.be.gte(configBlockNumber);

      let ethersProvider = new ethers.providers.JsonRpcProvider(provider?.connection.url);
      const chainId = await (await ethersProvider.getNetwork()).chainId.toString();
      console.log(`${chainName} chain ID:, ${chainId}`);
      const configChainId = hre.config.chainManager?.chains?.[chainName]?.chainId?.toString();
      console.log(`${chainName} config chain ID:, ${configChainId}`);
      expect(chainId).to.be.eq(configChainId);
    }
  });
});
