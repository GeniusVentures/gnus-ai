import { JsonRpcProvider } from '@ethersproject/providers';
import dotenv from 'dotenv';
import { ethers, network } from 'hardhat';
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { waitForNetwork } from '../utils/network-utils';
import { createForkLogger } from '../utils/logger';

dotenv.config();

type ChainConfig = {
  name: string;
  rpcUrl: string;
  forkPort: number;
  blockNumber?: number;
  chainId?: number;
};

class ChainManager {
  private static instances: Map<string, JsonRpcProvider> = new Map();
  private static processes: Map<string, ChildProcessWithoutNullStreams> = new Map();

  static async setupChains(chains: string[]): Promise<Map<string, JsonRpcProvider>> {
    if (this.instances.size > 0) return this.instances;

    const processes: Record<string, ChildProcessWithoutNullStreams> = {};
    const rpcUrls: Record<string, string> = {};

    await Promise.all(
      chains.map(async (chainName) => {
        const logger = createForkLogger(chainName);
        const chainConfig = this.getChainConfig(chainName);
        if (!chainConfig) {
          throw new Error(`Unsupported chain: ${chainName}`);
        }

        logger.info(`Starting fork for chain: ${chainName}`);

        // Spawn the Hardhat fork process
        const child = spawn(
          'hardhat',
          [
            'node',
            '--fork',
            chainConfig.rpcUrl,
            '--port',
            chainConfig.forkPort.toString(),
            ...(chainConfig.blockNumber
              ? ['--fork-block-number', chainConfig.blockNumber.toString()]
              : []),
          ],
          {
            env: {
              ...process.env,
              HH_CHAIN_ID: chainConfig.chainId?.toString() || '31337',
            },
          }
        );

        // Redirect logs to custom logger
        child.stdout?.on('data', (data) => logger.info(data.toString()));
        child.stderr?.on('data', (data) => logger.error(data.toString()));

        // Handle errors
        child.on("info", (err) => logger.info(`Log starting fork ${chainConfig.name}: ${err.message}`));

        processes[chainName] = child;
        rpcUrls[chainName] = `http://127.0.0.1:${chainConfig.forkPort}`;

        // Ensure the node is ready before proceeding
        await new Promise((resolve) => setTimeout(resolve, 5000));

        try {
          await waitForNetwork(rpcUrls[chainName], 100000);
          logger.info(`Network at ${rpcUrls[chainName]} is ready.`);
        } catch (err) {
          if (err instanceof Error) {
            logger.error(`Network validation failed for ${chainName}: ${err.message}`);
          } else {
            logger.error(`Network validation failed for ${chainName}: ${String(err)}`);
          }
          throw err;
        }

        // Initialize and store the provider
        const provider = new ethers.providers.JsonRpcProvider(rpcUrls[chainName]);
        // ethers.provider = provider;
        const blockNumber = await provider.getBlockNumber();
        const chainId = (await provider.getNetwork()).chainId;
        this.instances.set(chainName, provider);
        this.processes.set(chainName, child);
      })
    );

    return this.instances;
  }
  
  static async getChain(chainName: string): Promise<JsonRpcProvider> {
    if (this.instances.has(chainName)) {
      return this.instances.get(chainName)!;
    }

    const chains = await this.setupChains([chainName]);
    return chains.get(chainName)!;
  }

  static cleanup(): void {
    console.log('Cleaning up chain forks...');
    this.processes.forEach((process, chainName) => {
      console.log(`Killing fork process for chain: ${chainName}`);
      process.kill('SIGINT');
    });
    this.processes.clear();
    this.instances.clear();
  }

  private static getChainConfig(chainName: string): ChainConfig | null {
    // convert the chain config values to constants based on the chain name
    const configBlockNumber = chainName.toUpperCase() + '_BLOCK_NUMBER';
    const configChainId = chainName.toUpperCase() + '_MOCK_CHAIN_ID';
    const configRpcUrl = chainName.toUpperCase() + '_RPC';
    const chainConfigs: Record<string, ChainConfig> = {
      [chainName]: {
        name: chainName,
        rpcUrl: process.env[configRpcUrl]!,
        forkPort: 8546,
        blockNumber: process.env[configBlockNumber]
          ? parseInt(process.env[configBlockNumber]!)
          : undefined,
        chainId: process.env[configChainId] !== undefined ? parseInt(process.env[configChainId]!) : undefined,
      },
    };

    return chainConfigs[chainName] || null;
  }
}

export default ChainManager;
