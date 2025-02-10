import { expect } from 'chai';
import ChainManager from '../setup/chainManager';
import { ethers } from 'hardhat';
import dotenv from 'dotenv';

dotenv.config();

describe('Multichain Integration Tests', function () {
  this.timeout(0); // Extend timeout to 5 minutes
    let chains: Map<string, any>;

  before(async function () {
    // Setup chains based on command-line arguments
    const chainArgs = process.env.CHAINS?.split(',') || ['sepolia'];
    chains = await ChainManager.setupChains(chainArgs);
  });

  after(function () {
    // Cleanup chain processes
    ChainManager.cleanup();
  });

  it('should check chain provider is defined and has valid blocknumber ', async function () {
    for (const [chainName, provider] of chains.entries()) {
      console.log(`Chain: ${chainName}`);
      const forkProvider = chains.get(chainName);
      expect(forkProvider).to.not.be.undefined;
      
      ethers.provider = forkProvider;
      const blockNumber = await ethers.provider.getBlockNumber();
      console.log(`Block number for ${chainName} fork: ${blockNumber}`);
      console.log(`${chainName} block number:`, blockNumber);
      expect(blockNumber).to.be.a('number');
    }
  });
  
  it('Should perform check on getting a chain object and details that match config', async function () {
    for (const [chainName] of chains.entries()) {
      const provider = await ChainManager.getChain(chainName);
      expect(provider).to.not.be.undefined;
      
      ethers.provider = provider;
      const blockNumber = await ethers.provider.getBlockNumber();
      console.log(`${chainName} block number:`, blockNumber);
      expect(blockNumber).to.be.a('number');
      const parsedConfig = dotenv.config().parsed;
      expect(parsedConfig).to.not.be.undefined;
      const expectedBlockNumber = parsedConfig ? parseInt(parsedConfig[`${chainName.toUpperCase()}_BLOCK_NUMBER`], 10) : undefined;
      expect(blockNumber).to.be.gt(expectedBlockNumber);
      const chainId = await (await ethers.provider.getNetwork()).chainId.toString();
      console.log(`${chainName} chain ID:, ${chainId}`);
      const configChainId = chainName.toUpperCase() + '_MOCK_CHAIN_ID';
      const expectedChainId = parsedConfig ? parsedConfig[`${configChainId}`] : undefined;
      expect(chainId).to.be.eq(expectedChainId);
    }
  });
});
