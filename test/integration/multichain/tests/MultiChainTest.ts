import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { waitForNetwork } from '../../../../scripts/utils/network-utils';
import { createForkLogger } from '../../../../scripts/utils/logger';
import { Contract, BigNumber, EventFilter, ContractTransaction } from 'ethers';
import { ethers, network } from 'hardhat';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import '@nomiclabs/hardhat-ethers';
import { getSelectors, Selectors, getInterfaceID } from '../../../../scripts/FacetSelectors';
import {
  afterDeployCallbacks,
  deployAndInitDiamondFacets,
  deployDiamondFacets,
  deployExternalLibraries,
  deployFuncSelectors,
  deployGNUSDiamond,
} from '../../../../scripts/deploy';
import { GeniusDiamond, NFTStructOutput } from '../../../../typechain-types/GeniusDiamond';
import { GNUSNFTFactory } from '../../../../typechain-types/GNUSNFTFactory';
import { iObjToString } from '../../../iObjToString';
import {
  dc,
  debuglog,
  GNUS_TOKEN_ID,
  expect,
  toBN,
  toWei,
  INetworkDeployInfo,
  FacetToDeployInfo, PreviousVersionRecord
} from "../../../../scripts/common";
import { assert } from 'chai';
import { IERC1155Upgradeable__factory } from '../../../../typechain-types/factories/IERC1155Upgradeable__factory';
import { IERC165Upgradeable__factory } from '../../../../typechain-types/factories/IERC165Upgradeable__factory';
import { Facets, LoadFacetDeployments } from '../../../../scripts/facets';
import { deployments } from '../../../../scripts/deployments';
import util from 'util';
import { debug } from 'debug';

import { updateOwnerForTest } from '../../../utils/signer';


import * as MultichainGNUSERC20Tests from './MultichainGNUSERC20Tests';
import * as MultichainErc20BatchTests from './MultichainErc20BatchTests';
import * as MultichainGNUSBridgeTests from './MultichainGNUSBridgeTests';


const debugging = process.env.JB_IDE_HOST !== undefined;

export async function logEvents(tx: ContractTransaction) {
  const receipt = await tx.wait();
  
  if (receipt.events) {
    for (const event of receipt.events) {
      debuglog(`Event ${event.event} with args ${event.args}`);
    }
  }
}  

const { FacetCutAction } = require('contracts-starter/scripts/libraries/diamond.js');
let networkDeployedInfo: INetworkDeployInfo;
let forkedNetworkDeployedInfo: INetworkDeployInfo[] = [];
let gnusDiamond: GeniusDiamond;
let forks: { name: string, origin: string, chainId: number, url: string, port: number, blockNumber: number }[] = [];
let rpcUrl: { [key: string]: string } = {};
let processes: { [chain: string]: ChildProcessWithoutNullStreams } = {};

before(async function () {
  const forks = [
    // { name: "hardhat-ethereum", origin: "mainnet", chainId: 69, url: process.env.MAINNET_RPC, port: 8545, blockNumber: 21625925 },
    // { name: "hardhat-polygon", origin: "polygon", chainId: 42, url: process.env.POLYGON_RPC, port: 8546, blockNumber: 66703587 },
    // { name: "hardhat-sepolia", origin: "sepolia", chainId: 11169111, url: process.env.SEPOLIA_RPC, port: 8547, blockNumber: 7200064 },
    { name: "hardhat-amoy", origin: "polygon_amoy", chainId: 80042, url: process.env.POLYGON_AMOY_RPC, port: 8548, blockNumber: 16995897 },
  ];
  
  // Store network-specific deployment information, which includes addresses and other details.
  
  // Keep track of previously deployed versions for comparison during upgrades.
  let previousDeployedVersions: PreviousVersionRecord = {};

  // Check if debugging mode is enabled (set if running in JetBrains IDE) and configure logging.
  if (debugging) {
    // Enable debug logging for logs tagged with 'GNUS.*:log' to view detailed output.
    debug.enable('GNUS.*:log');
    
    // Enable the debug logging utility defined earlier (debuglog).
    debuglog.enabled = true;
    
    // Bind console.log to debuglog.log, so debug logs are sent to the console.
    debuglog.log = console.log.bind(console);
    
    // Log a message indicating that debugging options are set up.
    debuglog(
      'Disabling timeout, enabling debuglog, because code was run in Jet Brains (probably debugging)',
    );

    // Disable test timeout to avoid interference during debugging.
    this.timeout(0);
  }

  // TODO Abstract the multichain launcher away for modularity
  // Start forks in parallel
  await Promise.all(
    forks.map(async (fork) => {

      // Create log file for this fork
      const logger = createForkLogger(fork.name);
      logger.info(`Starting fork: ${fork.name}`);
    
      // Spawn the Hardhat node as a child process
      const child = spawn(
        "hardhat", 
        [
          // "hardhat",
          "node",
          "--fork",
          fork.url || "",
          "--port",
          fork.port.toString(),
          "--fork-block-number",
          fork.blockNumber.toString(),
          // "--hardfork",
          // "istanbul",
        ],
        {
          env: {
            ...process.env, // Preserve existing environment variables
            // HH_CHAIN_ID: fork.chainId.toString(), // Add the custom CHAIN_ID
          },
        }
      );
      
      // Redirect stdout and stderr to logger
      child.stdout.on("data", (data) => logger.info(data.toString()));
      child.stderr.on("data", (data) => logger.error(data.toString()));

      // Handle errors
      child.on("info", (err) => logger.info(`Log starting fork ${fork.name}: ${err.message}`));

      processes[fork.name] = child;

      // Ensure the node is ready before proceeding
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Validate the network is running
      rpcUrl[fork.name] = `http://localhost:${fork.port}`;
      try {
        await waitForNetwork(rpcUrl[fork.name], 100000);
        logger.info(`Network at ${rpcUrl[fork.name]} is ready.`);
      } catch (err) {
        if (err instanceof Error) {
          logger.error(`Network validation failed for ${rpcUrl[fork.name]}: ${err.message}`);
        } else {
          logger.error(`Network validation failed for ${rpcUrl[fork.name]}: ${String(err)}`);
        }
        throw err;
      }
      

      // Begin: Deploy the contracts
      // Create a provider for the fork
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl[fork.name]);
      ethers.provider = provider;
    
      // Get the the built in hardhat addresses
      const signerAddress_0 = (await provider.listAccounts())[0];
      
      // Get the deployer address for the forked network
      const deployerAddress = deployments[fork.origin].DeployerAddress;
      console.log(`Deployer Address ${deployerAddress}`);
      // Impersonate the deployer address
      await provider.send("hardhat_impersonateAccount", [deployerAddress]);
      // Get the signer for the deployer address
      const deployer = provider.getSigner(deployerAddress);
      
      // Fund the deployer account with setBalance
      await provider.send("hardhat_setBalance", [deployerAddress, "0x56BC75E2D63100000"]);
      console.log(`Deployer Balance ${await deployer.getBalance()}`);
  
      console.log(
        "Deployer account balance before transaction",
        ethers.utils.formatEther(await deployer.getBalance())
      );
      
      // Load previously deployed facet information to ensure that facets are correctly deployed and initialized.
      await LoadFacetDeployments();
    
      // Retrieve the current network's name (e.g., hardhat, mainnet).
      const networkName = fork.origin;
      console.log(`Network name: ${networkName}`);
    
      // Store the current network's deployment info in `networkDeployedInfo`.
      networkDeployedInfo = deployments[networkName];
      
      // Add local forked network deployment information to the `networkDeployedInfo` object.
      networkDeployedInfo.networkName = fork.name;
      networkDeployedInfo.chainID = fork.chainId;
      networkDeployedInfo.rpcURL = rpcUrl[fork.name];
    
      // ToDo -  This shouldn't be required for a fork with an existing deployment.  We can use the impersonated deployer. However, if the diamond contract is not deployed, this address should be set to the one of the supplied hardhat addresses.
      // // If the diamond contract has already been deployed, update the owner for testing.
      // if (networkDeployedInfo.DiamondAddress) {
      //   await updateOwnerForTest(networkDeployedInfo.DiamondAddress);
      // }
      
      // Initialize deployment information for the network if it doesn't already exist.
      if (!deployments[networkName]) {
        deployments[networkName] = {
          DiamondAddress: '',             // Address for the deployed diamond contract.
          DeployerAddress: deployerAddress,      // Address of the deployer.
          FacetDeployedInfo: {},          // Object to store information about each deployed facet.
        };
      }
    
      // TODO: Is this required for a fork with an existing deployment. A negative result for test of contract deployment vis a vis the deployments.ts should include a new diamond contract deployment. This may be part of the deployGNUSDiamond function already.
      // Deploy the GNUS Diamond contract and store deployment details in `networkDeployedInfo`.
      await deployGNUSDiamond(networkDeployedInfo);
    
      // Initialize `gnusDiamond` as the deployed GeniusDiamond contract instance.
      gnusDiamond = dc.GeniusDiamond as GeniusDiamond;
    
      // Log the successful deployment of the Diamond contract.
      debuglog('Diamond Deployed');
      
      // TODO the interface tests should be moved to their own test if possible.  This is actually testing that this is implemented correctly before moving forward with the facet deployment.
    
      // Create interfaces for the `IERC165Upgradeable` and `IERC1155Upgradeable` standards.
      const IERC165UpgradeableInterface = IERC165Upgradeable__factory.createInterface();
      const IERC1155UpgradeableInterface = IERC1155Upgradeable__factory.createInterface();
    
      // Calculate the interface ID for IERC165.
      const IERC165InterfaceID = getInterfaceID(IERC165UpgradeableInterface);
    
      // Calculate the interface ID for IERC1155 by XORing it with IERC165InterfaceID to exclude base contract functions.
      const IERC11InterfaceID = getInterfaceID(IERC1155UpgradeableInterface).xor(
        IERC165InterfaceID,
      );
    
      // const  supportsInterfaceTest = await gnusDiamond.supportsInterface(IERC11InterfaceID._hex);
      // // Assert that `gnusDiamond` supports the IERC1155Upgradeable interface, indicating compatibility.
      // assert(supportsInterfaceTest,
      //   "Doesn't support IERC1155Upgradeable"
      // );
    
      // Make a deep copy of `networkDeployedInfo` before upgrading to retain pre-upgrade information.
      const deployInfoBeforeUpgraded: INetworkDeployInfo = JSON.parse(
        JSON.stringify(networkDeployedInfo),
      );
    
      // Define facets to be deployed, sourced from the `Facets` object.
      let facetsToDeploy: FacetToDeployInfo = Facets;
    
      // Deploy facets in multiple steps for modular deployment, updating deployment info each time.
      await deployDiamondFacets(networkDeployedInfo, facetsToDeploy);
      debuglog(`${util.inspect(networkDeployedInfo, { depth: null })}`);
    
      // Copy deployment information into a new variable for comparison post-upgrade.
      const deployInfoWithOldFacet: INetworkDeployInfo = Object.assign(
        JSON.parse(JSON.stringify(networkDeployedInfo)),
      );
    
      // TODO: Answer:  isn't this bad?  Changing the keys of what we are iterating through?
      // Iterate through each facet's deployment information and update it with previous version data if available.
      for (const key in deployInfoWithOldFacet.FacetDeployedInfo) {
        if (deployInfoBeforeUpgraded.FacetDeployedInfo[key]) {
          deployInfoWithOldFacet.FacetDeployedInfo[key] =
            deployInfoBeforeUpgraded.FacetDeployedInfo[key];
        }
    
        // Build `previousDeployedVersions` to store versioning information for facets.
        const facetInfo = deployInfoWithOldFacet.FacetDeployedInfo[key];
        if (facetInfo && facetInfo.version !== undefined) {
          previousDeployedVersions[key] = facetInfo.version;
        } else {
          debuglog(`Facet ${key} does not have a version`);
        }
      }
    
      // Deploy function selectors for facets, updating `networkDeployedInfo` and `deployInfoWithOldFacet`.
      await deployFuncSelectors(networkDeployedInfo, deployInfoWithOldFacet, facetsToDeploy);
      debuglog(`${util.inspect(networkDeployedInfo, { depth: null })}`);
      
      // Why is this Redundant deployment running in test/index.ts for the function selectors, to confirm they were successfully added?
      // await deployFuncSelectors(networkDeployedInfo, deployInfoWithOldFacet, facetsToDeploy);
      
      // Execute any callbacks required after deployment, typically for post-deployment setups or checks.
      await afterDeployCallbacks(networkDeployedInfo, undefined, previousDeployedVersions);
      
      const  supportsInterfaceTest = await gnusDiamond.supportsInterface(IERC11InterfaceID._hex);
      // Assert that `gnusDiamond` supports the IERC1155Upgradeable interface, indicating compatibility.
      assert(supportsInterfaceTest,
        "Doesn't support IERC1155Upgradeable"
      );
      
      forkedNetworkDeployedInfo.push(networkDeployedInfo);
      debuglog(`${util.inspect(networkDeployedInfo, { depth: null })}`);
    })
  );
});

describe("Crosschain Contract Tests", function () {
  
});
it("Should fetch the current block number", async function () {
  for (const fork of forks) {
    console.log(`Checking block number for fork ${fork.name}...`);
    console.log(rpcUrl[fork.name]);
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl[fork.name]);
    const blockNumber = await provider.getBlockNumber();
    console.log(`Current block number: ${blockNumber}`);
    expect(blockNumber).to.be.a("number").and.greaterThan(0);
    expect(blockNumber).to.be.greaterThanOrEqual(fork.blockNumber);
  }
});

it("Should validate the chain ID", async function () {
  for (const fork of forks) {
    console.log(`Checking chain ID for fork ${fork.name}...`);
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl[fork.name]);  
    const networkInfo = await provider.getNetwork();
    console.log(`Chain ID: ${networkInfo.chainId}`);
    expect(networkInfo.chainId).to.equal(fork.chainId);
  }
});

it("Should retrieve the balance of an account", async function () {
  for (const fork of forks) {
    console.log(`Checking balance for fork ${fork.name}...`);
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl[fork.name]);
    const deployer = await ethers.getSigner(networkDeployedInfo.DeployerAddress); // Get the first signer
    const balance = await provider.getBalance(deployer.address);
    console.log(`Balance of ${deployer.address}: ${ethers.utils.formatEther(balance)} ETH`);
    expect(balance).to.be.instanceOf(ethers.BigNumber); // Check if balance is an instance of BigNumber
    expect(balance.gt(0)).to.be.true; // Check if balance is greater than 0
  }
});

it("Should query the latest block details", async function () {
  for (const fork of forks) {
    console.log(`Checking latest block details for fork ${fork.name}...`);
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl[fork.name]);
    const latestBlock = await provider.getBlock("latest");
    console.log("Latest block details:", latestBlock);
    expect(latestBlock).to.have.property("number").that.is.a("number");
    expect(latestBlock).to.have.property("hash").that.is.a("string");
  }
});

it("Should send a raw JSON-RPC request", async function () {
  for (const fork of forks) {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl[fork.name]);
    const rawChainId = await provider.send("eth_chainId", []);
    console.log(`Raw chain ID: ${parseInt(rawChainId, 16)}`);
    expect(parseInt(rawChainId, 16)).to.equal(fork.chainId); // Default Hardhat chain ID
  }
});

after(async function () {
  
  console.log("Starting secondary tests...");
  forkedNetworkDeployedInfo.forEach(async (networkDeployedInfo) => {
  // try {
  //     await new Promise<void>((resolve, reject) => {
  //       try {
          // await MultichainGNUSERC20Tests.suite(networkDeployedInfo);
          // await MultichainGNUSBridgeTests.suite(networkDeployedInfo);
          // await MultichainErc20BatchTests.suite(networkDeployedInfo);
    //     } catch (error) {
    //       reject(error);
    //     }
    //   });
    // } catch (error) {
    //   console.error(`Error running secondary multichain tests on ${networkDeployedInfo.networkName}`, error);
    // }
  });
  
  console.log("Stopping child forks...");
    
  // Stop all child processes
  for (const forkName in processes) {
    const child = processes[forkName];
    child.kill("SIGINT");
    console.log(`Fork ${forkName} stopped.`);
  }
});