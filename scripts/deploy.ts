import { debug } from 'debug';
import { BaseContract } from 'ethers';
import hre, { ethers, network } from 'hardhat';
import { AdminClient } from '@openzeppelin/defender-admin-client';
import { Network } from '@openzeppelin/defender-base-client';
import {
  FacetInfo,
  getSelectors,
  getDeployedFuncSelectors,
  getSelector
} from "../scripts/FacetSelectors";
import {
  dc,
  INetworkDeployInfo,
  FacetToDeployInfo,
  AfterDeployInit,
  writeDeployedInfo,
  diamondCutFuncAbi,
  getSighash, PreviousVersionRecord
} from "../scripts/common";
import { DiamondCutFacet } from '../typechain-types/DiamondCutFacet';
import { IDiamondCut } from '../typechain-types/IDiamondCut';
import { deployments } from '../scripts/deployments';
import { Facets, LoadFacetDeployments } from '../scripts/facets';
import * as util from 'util';
import { getGasCost } from '../scripts/getgascost';
import { defenderSigners } from "./DefenderSigners";
import { GeniusDiamond } from "../typechain-types";

const log: debug.Debugger = debug('GNUSDeploy:log');
log.color = '159';

const GAS_LIMIT_PER_FACET = 60000;
const GAS_LIMIT_CUT_BASE = 100000;

// Load the FacetCutAction from the diamond.js library to manage actions: adding, replacing facets.
const { FacetCutAction } = require('contracts-starter/scripts/libraries/diamond.js');

// Declare an AdminClient object for OpenZeppelin Defender, if integration with Defender is used.
let client: AdminClient;

/**
 * Deploys the Genius Diamond contract, which serves as the main entry point of the GNUS protocol.
 * This function deploys the DiamondCutFacet and GeniusDiamond contracts if they haven't been deployed yet,
 * and updates the network deployment information to keep track of deployed facets and their function selectors.
 *
 * @param networkDeployInfo - The deployment information for the current network, including addresses and transaction hashes.
 */
export async function deployGNUSDiamond(networkDeployInfo: INetworkDeployInfo) {
  
  // Retrieve the list of available accounts on the network.
  const accounts = await ethers.getSigners();
  let diamondCutFacet;
  const contractOwner = accounts[0]; // Use the first account as the contract owner.

  // Check if DiamondCutFacet is already deployed by looking up its address in the deployment info.
  if (networkDeployInfo.FacetDeployedInfo['DiamondCutFacet']?.address) {
    // Attach the already deployed DiamondCutFacet contract instance to `dc` for further use.
    dc.DiamondCutFacet = await ethers.getContractAt(
      'DiamondCutFacet',
      networkDeployInfo.FacetDeployedInfo['DiamondCutFacet']?.address,
    );
  } else {
    // If DiamondCutFacet is not yet deployed, deploy it.
    const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet');
    diamondCutFacet = (await DiamondCutFacet.deploy()) as DiamondCutFacet;
    await diamondCutFacet.deployed();
    log(
      `DiamondCutFacet deployed: ${diamondCutFacet.deployTransaction.hash} tx_hash: ${diamondCutFacet.deployTransaction.hash}`,
    );
    // Save the deployed DiamondCutFacet instance in `dc` for global reference.
    dc.DiamondCutFacet = diamondCutFacet;
  }

  let gnusDiamond;
  // Check if the main GeniusDiamond contract has already been deployed.
  if (!networkDeployInfo.DiamondAddress) {
    // If not, deploy the GeniusDiamond contract, passing the contract owner's address and the DiamondCutFacet address.
    const Diamond = await ethers.getContractFactory(
      'contracts/GeniusDiamond.sol:GeniusDiamond',
    );
    gnusDiamond = await Diamond.deploy(contractOwner.address, dc.DiamondCutFacet.address);
    await gnusDiamond.deployed();
  } else {
    // If GeniusDiamond is already deployed, attach to it using the stored address in deployment info.
    gnusDiamond = await ethers.getContractAt(
      'contracts/GeniusDiamond.sol:GeniusDiamond',
      networkDeployInfo.DiamondAddress,
    );
  }

  // Save the GeniusDiamond instance in the `dc` object for future reference within the deployment process.
  dc._GeniusDiamond = gnusDiamond;
  networkDeployInfo.DiamondAddress = gnusDiamond.address;

  // Attach the GeniusDiamond contract to the `dc` object using the ABI for interaction through `hardhat-diamond-abi`.
  dc.GeniusDiamond = (
    await ethers.getContractFactory('hardhat-diamond-abi/GeniusDiamond.sol:GeniusDiamond')
  ).attach(gnusDiamond.address);

  // Update the deployment info for DiamondCutFacet, since the GeniusDiamond contract constructor already references it.
  const funcSelectors = getSelectors(dc.DiamondCutFacet); // Retrieve the function selectors for DiamondCutFacet.
  networkDeployInfo.FacetDeployedInfo.DiamondCutFacet = {
    address: dc.DiamondCutFacet.address,
    tx_hash:
      dc.DiamondCutFacet.deployTransaction?.hash ||
      networkDeployInfo.FacetDeployedInfo['DiamondCutFacet'].tx_hash,
    version: 0.0,
    funcSelectors: funcSelectors.values, // Store all function selectors for this facet.
  };

  log(`Diamond deployed ${gnusDiamond.address}`); // Log the address of the deployed GeniusDiamond contract.
}

export async function deployFuncSelectors(
  networkDeployInfo: INetworkDeployInfo,
  oldNetworkDeployInfo: INetworkDeployInfo | undefined = undefined,
  facetsToDeploy: FacetToDeployInfo = Facets,
) {
  // Array to store facet cut operations (add, replace, remove selectors)
  const cut: FacetInfo[] = [];
  // Retrieve deployed facet information from network deployment data
  const deployedFacets = networkDeployInfo.FacetDeployedInfo;
  // Retrieve function selectors from previously deployed facets
  const deployedFuncSelectors = await getDeployedFuncSelectors(
    oldNetworkDeployInfo || networkDeployInfo,
  );
  // Set to track registered function signatures to prevent duplication
  const registeredFunctionSignatures = new Set<string>();

  // Determine facet deployment priority based on configured priorities
  const facetsPriority = Object.keys(facetsToDeploy).sort(
    (a, b) => facetsToDeploy[a].priority - facetsToDeploy[b].priority,
  );

  // Variable to track the protocol's maximum upgrade version
  let protocolUpgradeVersion = 0;
  const selectorsToBeRemoved: string[] = []; // Track selectors to be removed
  const facetNamesToBeRemoved: string[] = []; // Track facet names to be removed

  // Loop through deployed facets to identify facets and selectors no longer in the deployment list
  for (const facetName of Object.keys(deployedFacets)) {
    if (!Object.keys(facetsToDeploy).includes(facetName)) {
      // Collect selectors to remove for facets not in the new deployment list
      selectorsToBeRemoved.push(
        ...(deployedFacets[facetName].funcSelectors?.filter((e) =>
          Object.keys(deployedFuncSelectors?.facets).includes(e),
        ) || []),
      );
      // Add facet name to the removal list and delete from deployed facets
      facetNamesToBeRemoved.push(facetName);
      delete deployedFacets[facetName];
    }
  }

  // If there are selectors to be removed, add a remove operation to the facet cut
  if (selectorsToBeRemoved.length > 0)
    cut.push({
      facetAddress: ethers.constants.AddressZero, // Address zero indicates removal
      action: FacetCutAction.Remove,
      functionSelectors: selectorsToBeRemoved,
      name: facetNamesToBeRemoved.join(','),
    });

  // Loop through facets based on deployment priority
  for (const name of facetsPriority) {
    const facetDeployVersionInfo = facetsToDeploy[name];
    let facetVersions = ['0.0']; // Default to version 0.0 if no versions are provided

    // Sort facet versions from highest to lowest
    if (facetDeployVersionInfo.versions) {
      facetVersions = Object.keys(facetDeployVersionInfo.versions).sort((a, b) => +b - +a);
    }

    // Determine the upgrade version for the current facet
    const upgradeVersion = +facetVersions[0];
    protocolUpgradeVersion = Math.max(upgradeVersion, protocolUpgradeVersion); // Update protocol version if higher
    const facetDeployInfo = facetDeployVersionInfo.versions
      ? facetDeployVersionInfo.versions[upgradeVersion]
      : {};

    // Determine the deployed version of the facet
    const deployedVersion =
      deployedFacets[name]?.version ?? (deployedFacets[name]?.tx_hash ? 0.0 : -1.0);

    // Load the facet contract using its name and linked libraries if applicable
    const FacetContract = await ethers.getContractFactory(
      name,
      facetDeployVersionInfo.libraries
        ? {
            libraries: networkDeployInfo.ExternalLibraries,
          }
        : undefined,
    );
    const facet = FacetContract.attach(deployedFacets[name].address!);

    // Determine if the facet needs an upgrade based on version comparison or missing selectors
    const facetNeedsUpgrade =
      !(name in deployedFuncSelectors.contractFacets) || upgradeVersion !== deployedVersion;
    dc[name] = facet; // Store the facet instance globally for future reference

    // Retrieve selectors for the facet and filter them based on deployment inclusion rules
    const origSelectors = getSelectors(facet).values;
    const includeSelectors: Set<String> | null = facetDeployInfo.deployInclude ? new Set(facetDeployInfo.deployInclude) : null;
    const newFuncSelectors = getSelectors(facet, registeredFunctionSignatures, includeSelectors).values;
    const removedSelectors = origSelectors.filter((v) => !newFuncSelectors.includes(v));
    if (removedSelectors.length) {
      log(`${name} removed ${removedSelectors.length} selectors: [${removedSelectors}]`);
    }

    let numFuncSelectorsCut = 0; // Counter for selectors removed, added, or replaced

    // Retrieve selectors from the previously deployed contract for the current facet
    const deployedContractFacetsSelectors = deployedFuncSelectors.contractFacets[name];
    const deployedToRemove =
      deployedContractFacetsSelectors?.filter((v) => !newFuncSelectors.includes(v)) ?? [];

    // Add a remove operation to the facet cut for selectors that are no longer included
    if (deployedToRemove.length) {
      cut.unshift({
        facetAddress: ethers.constants.AddressZero, // Address zero indicates removal
        action: FacetCutAction.Remove,
        functionSelectors: deployedToRemove,
        name: name,
      });
      numFuncSelectorsCut++;
    }    if (newFuncSelectors.length) {
      let initFunc: string | undefined; // Variable to store the name of the initialization function (if any)
      let initFuncSelector: string | null = null; // Variable to store the selector for the initialization function

      // Determine if we need to call an upgrade or deploy initialization function
      if (facetNeedsUpgrade) {
        // Check if the deployed version is in the list of versions that require an upgrade
        if (facetDeployInfo.fromVersions?.includes(deployedVersion)) {
          initFunc = facetDeployInfo.upgradeInit; // Set the upgrade initialization function
        } else if (deployedVersion == -1) {
          // If the facet was never deployed before, set the deploy initialization function
          initFunc = facetDeployInfo.deployInit;
        }
      } else {
         // If no upgrade is needed, use the deploy initialization function (if defined)
         initFunc = facetDeployInfo.deployInit;
      }

      // Retrieve the selector for the initialization function (if defined)
      if (initFunc) {
        initFuncSelector = getSelector(facet, initFunc); 
        log(`contract: ${facet.address}, initFuncSelector: ${initFuncSelector}`); // Log the initialization function selector
      }

      // Update the deployment information for the facet with the new function selectors
      deployedFacets[name].funcSelectors = newFuncSelectors;
      const replaceFuncSelectors: string[] = []; // Track selectors that need to be replaced
      const addFuncSelectors = newFuncSelectors.filter((v) => {
        if (v in deployedFuncSelectors.facets) {
          // If the selector exists but is associated with a different facet address, mark it for replacement
          if (
            deployedFuncSelectors.facets[v].toLowerCase() !== facet.address.toLowerCase()
          ) {
            replaceFuncSelectors.push(v);
          }
          return false; // Exclude selectors already deployed
        } else {
          return true; // Include new selectors
        }
      });

      // Add a replace operation to the facet cut for selectors that need to be updated
      if (replaceFuncSelectors.length) {
        cut.push({
          facetAddress: facet.address, // Address of the facet containing the updated selectors
          action: FacetCutAction.Replace, // Replace operation
          functionSelectors: replaceFuncSelectors, // List of selectors to replace
          name: name, // Facet name
          initFunc: initFuncSelector, // Initialization function selector (if any)
        });
        numFuncSelectorsCut++; // Increment the counter for function selectors modified
      }

      // Add an add operation to the facet cut for new selectors
      if (addFuncSelectors.length) {
        cut.push({
          facetAddress: facet.address, // Address of the facet containing the new selectors
          action: FacetCutAction.Add, // Add operation
          functionSelectors: addFuncSelectors, // List of selectors to add
          name: name, // Facet name
          initFunc: initFuncSelector, // Initialization function selector (if any)
        });
        numFuncSelectorsCut++; // Increment the counter for function selectors modified
      }

      // Register the new function selectors to prevent duplication in future deployments
      for (const funcSelector of newFuncSelectors) {
        registeredFunctionSignatures.add(funcSelector);
      }

      // Update the facet deployment information with the new selectors and version
      deployedFacets[name].funcSelectors = newFuncSelectors;
      deployedFacets[name].version = upgradeVersion;
    } else {
      // If there are no new selectors, remove the facet from the deployed function selectors
      delete deployedFuncSelectors.contractFacets[name];
      log(`Pruned all selectors from ${name}`); // Log the pruning of selectors
    }

    // If no function selectors were modified for the facet, log that the facet is being skipped
    if (numFuncSelectorsCut === 0) {
      log(
        `*** Skipping ${name} as there were no modifications to deployed facet function selectors`,
      );
    }
  }

  networkDeployInfo.protocolVersion = protocolUpgradeVersion;

  // Upgrade the diamond contract with the new facets and function selectors
  const diamondCut = dc.GeniusDiamond as IDiamondCut;

  // If Defender deployment is enabled and a signer is configured for the current network
  if (process.env.DEFENDER_DEPLOY_ON &&
      defenderSigners[network.name]) {
    log('Deploying contract on defender');

    // Initialize the AdminClient for OpenZeppelin Defender
    client = new AdminClient({
      apiKey: process.env.DEFENDER_API_KEY || '', // Defender API key
      apiSecret: process.env.DEFENDER_API_SECRET || '', // Defender API secret
    });

    // Retrieve the list of contracts managed on Defender
    const listedContracts = await client.listContracts();

    // Check if the diamond contract is already listed on Defender
    if (
      listedContracts.find(
        (e) => e.address.toLowerCase() === diamondCut.address.toLowerCase(),
      )
    ) {
      log('Diamond Contract was listed on defender');
    } else {
      // Add the diamond contract to Defender if it isn't listed
      const res = await client.addContract({
        address: diamondCut.address, // Address of the diamond contract
        abi: JSON.stringify(diamondCut.interface.fragments), // Contract ABI
        network: hre.network.name as Network, // Current network
        name: 'Gnus.ai Diamond', // Name for the contract on Defender
      });

      if (res.address) {
        log('Diamond Contract was listed on defender', res.address);
      }
    }
  }

  // Prepare the function selectors for replacement
  const replacedFunctionSelectors = [];
  for (const facetCutInfo of cut) {
    if (facetCutInfo.action === FacetCutAction.Replace) {
      replacedFunctionSelectors.push(...facetCutInfo.functionSelectors);
    }
  }

  // Prepare the list of operations (facet cuts) for the diamond upgrade
  const upgradeCut = [];
  for (const facetCutInfo of cut) {
    if (facetCutInfo.action === FacetCutAction.Remove) {
      // Filter out function selectors that have already been replaced
      const newFunctionSelectors = [];
      for (const removedFuncSelector of facetCutInfo.functionSelectors) {
        if (!replacedFunctionSelectors.includes(removedFuncSelector)) {
          newFunctionSelectors.push(removedFuncSelector);
        }
      }

      // If no new selectors remain to be removed, skip this facet cut
      if (newFunctionSelectors.length === 0) {
        continue;
      } else {
        facetCutInfo.functionSelectors = newFunctionSelectors;
      }
    }
    upgradeCut.push(facetCutInfo); // Add the facet cut to the upgrade list
  }

  log('');
  log('Diamond Cut:', upgradeCut); // Log the details of the diamond cut operations

  let functionCall: any = []; // Placeholder for initialization function call
  let initAddress = ethers.constants.AddressZero; // Default initialization address

  try {
    let totalSelectors = 0; // Count the total number of function selectors being modified
    upgradeCut.forEach((e) => {
      totalSelectors += e.functionSelectors.length;
    });

    // If Defender deployment is enabled, create a proposal for the diamond upgrade
    if (process.env.DEFENDER_DEPLOY_ON &&
        defenderSigners[network.name]) {
      const upgradeFunctionInputs: (string | boolean | (string | string[])[])[] = [];

      // Format the inputs for the diamond cut operation
      upgradeCut.forEach((e) =>
        upgradeFunctionInputs.push([
          e.facetAddress, // Address of the facet
          e.action.toString(), // Action type (Add, Replace, Remove)
          e.functionSelectors, // Function selectors for the operation
        ]),
      );

      // Create a Defender proposal for the diamond cut
      const response = await client.createProposal({
        contract: {
          address: diamondCut.address, // Diamond contract address
          network: hre.network.name == 'polygon' ? 'matic' : (hre.network.name as Network), // Current network
        },
        title: `Update facet ${protocolUpgradeVersion}`, // Proposal title
        description: `Update facet`, // Proposal description
        type: 'custom', // Custom admin action
        functionInterface: diamondCutFuncAbi, // ABI of the diamondCut function
        functionInputs: [upgradeFunctionInputs, initAddress, functionCall], // Inputs for the diamondCut function
        via: defenderSigners[network.name].via, // Signer via address
        viaType: defenderSigners[network.name].viaType, // Signer via type
      });
      log(`created proposal on defender ${response.proposalId} `);
    } else {
      // Execute the diamond cut directly if not using Defender
      const tx = await diamondCut.diamondCut(upgradeCut, initAddress, functionCall, {
        gasLimit: GAS_LIMIT_CUT_BASE + totalSelectors * GAS_LIMIT_PER_FACET, // Calculate gas limit
      });
      log(`Diamond cut: tx hash: ${tx.hash}`); // Log the transaction hash

      // Wait for the transaction to be confirmed
      const receipt = await tx.wait();
      if (!receipt.status) {
        throw Error(`Diamond upgrade was failed: ${tx.hash}`);
      }
    }
  } catch (e) {
    log(`unable to cut facet: \n ${e}`); // Log any errors during the diamond cut
  }

  // Update the deployment information with the results of the diamond cut
  for (const facetCutInfo of upgradeCut) {
    for (const facetModified of facetCutInfo.functionSelectors) {
      switch (facetCutInfo.action) {
        case FacetCutAction.Add:
        case FacetCutAction.Replace:
          deployedFuncSelectors.facets[facetModified] = facetCutInfo.facetAddress; // Add or replace selectors
          break;
        case FacetCutAction.Remove:
          delete deployedFuncSelectors.facets[facetModified]; // Remove selectors
          break;
      }
    }
  }

  log('Diamond Facets cuts completed'); // Log completion of the diamond cut operations
}

export async function afterDeployCallbacks(
  networkDeployInfo: INetworkDeployInfo,
  facetsToDeploy: FacetToDeployInfo = Facets,
  previousVersions: PreviousVersionRecord,
) {
  // Retrieve the list of signers and assign the first signer as the owner
  const signers = await ethers.getSigners();
  const owner = signers[0];

  // Reference the GeniusDiamond contract instance for interaction
  const gnusDiamond = dc.GeniusDiamond as GeniusDiamond;

  // Sort facets by deployment priority to ensure proper initialization order
  const facetsPriority = Object.keys(facetsToDeploy).sort(
    (a, b) => facetsToDeploy[a].priority - facetsToDeploy[b].priority,
  );

  // Loop through each facet based on priority
  for (const name of facetsPriority) {
    const facetDeployVersionInfo = facetsToDeploy[name];
    let facetVersions = ['0.0'];

    // Sort facet versions from highest to lowest
    if (facetDeployVersionInfo.versions) {
      facetVersions = Object.keys(facetDeployVersionInfo.versions).sort((a, b) => +b - +a);
    }

    // Retrieve the most recent deployed version
    const deployedVersion = +facetVersions[0];
    const facetDeployInfo = facetDeployVersionInfo.versions
      ? facetDeployVersionInfo.versions[deployedVersion]
      : {};

    // Retrieve the previous version of the facet from deployment records
    let previousVersion = previousVersions[name];

    let initFunction: keyof GeniusDiamond | undefined = undefined;

    // Determine the initialization function to call based on the version change
    if (facetDeployInfo.upgradeInit && (facetDeployInfo.fromVersions?.includes(previousVersion || -1))) {
      initFunction = facetDeployInfo.upgradeInit as keyof GeniusDiamond; // Use the upgrade initialization function
    } else if (previousVersion != deployedVersion) {
      initFunction = facetDeployInfo.deployInit as keyof GeniusDiamond; // Use the deploy initialization function
    }

    // Log the facet deployment status
    log(`Facet: ${name}, Last Deployed Version: ${previousVersion}, Deployed Version: ${deployedVersion}`);

    // If an initialization function is defined, execute it
    if (initFunction) {
      const funcSelector = getSighash(`function ${initFunction}`); // Get the function selector
      if (!funcSelector) {
        throw new Error("Function selector cannot be null or undefined");
      }

      log(`initFunction being called is ${initFunction}`);

      // Create a transaction object for the initialization call
      const tx = {
        to: gnusDiamond.address, // Address of the GeniusDiamond contract
        data: funcSelector, // Function selector for the initialization function
        gasLimit: ethers.utils.hexlify(1000000), // Set gas limit for the transaction
      };

      try {
        // Send the initialization transaction
        const txResponse = await owner.sendTransaction(tx);
        log("Transaction hash:", txResponse.hash); // Log the transaction hash
        await txResponse.wait(); // Wait for the transaction to be confirmed
        log("Transaction confirmed!"); // Log confirmation
      } catch (error) {
        log(`Error sending transaction: ${error}`); // Log any errors during the transaction
      }
    }

    // If a callback is defined for the facet and the version has changed, execute the callback
    if (facetDeployInfo.callback && (previousVersion != deployedVersion)) {
      log(`callback function being called is ${facetDeployInfo.callback.name}`);

      const afterDeployCallback = facetDeployInfo.callback;
      try {
        await afterDeployCallback(networkDeployInfo); // Execute the callback function
      } catch (e) {
        log(`Failure in after deploy callbacks for ${name}: \n${e}`); // Log any errors during the callback execution
      }
    }
  }
}

export async function deployAndInitDiamondFacets(
  networkDeployInfo: INetworkDeployInfo,
  facetsToDeploy: FacetToDeployInfo = Facets
) {
  // Create a record to store the versions of facets deployed prior to upgrades
  const previousDeployedVersions: PreviousVersionRecord = {};

  // Deep copy the network deployment info before any upgrades
  const deployInfoBeforeUpgraded: INetworkDeployInfo = JSON.parse(
    JSON.stringify(networkDeployInfo),
  );

  // Deploy the diamond facets using the provided deployment information
  await deployDiamondFacets(networkDeployInfo, facetsToDeploy);

  // Deep copy the updated network deployment info after facet deployment
  const deployInfoWithOldFacet: INetworkDeployInfo = Object.assign(
    JSON.parse(JSON.stringify(networkDeployInfo)),
  );

  // Iterate over deployed facets to reconcile their deployment history
  for (const key in deployInfoWithOldFacet.FacetDeployedInfo) {
    if (deployInfoBeforeUpgraded.FacetDeployedInfo[key]) {
      deployInfoWithOldFacet.FacetDeployedInfo[key] =
        deployInfoBeforeUpgraded.FacetDeployedInfo[key];
    }

    // Build a record of previously deployed versions for future upgrades
    const facetInfo = deployInfoWithOldFacet.FacetDeployedInfo[key];
    if (facetInfo.version !== undefined) {
      previousDeployedVersions[key] = facetInfo.version;
    } else {
      log(`Facet ${key} does not have a version`); // Log any facets missing version info
    }
  }

  // Deploy function selectors for the facets and initialize after deployment
  await deployFuncSelectors(networkDeployInfo, deployInfoWithOldFacet, facetsToDeploy);
  await afterDeployCallbacks(networkDeployInfo, facetsToDeploy, previousDeployedVersions);
}

export async function deployDiamondFacets(
  networkDeployInfo: INetworkDeployInfo,
  facetsToDeploy: FacetToDeployInfo = Facets,
) {
  // Log the beginning of the facet deployment process
  log('');
  log('Deploying facets');

  // Retrieve the facets that have already been deployed from the network deployment info
  const deployedFacets = networkDeployInfo.FacetDeployedInfo;

  // Sort facets by their deployment priority
  const facetsPriority = Object.keys(facetsToDeploy).sort(
    (a, b) => facetsToDeploy[a].priority - facetsToDeploy[b].priority,
  );

  // Iterate over each facet in the deployment list
  for (const name of facetsPriority) {
    const facetDeployVersionInfo = facetsToDeploy[name];
    let facet: BaseContract;
    let facetVersions = ['0.0'];

    // Sort facet versions from highest to lowest to determine the most recent version
    if (facetDeployVersionInfo.versions) {
      facetVersions = Object.keys(facetDeployVersionInfo.versions).sort((a, b) => +b - +a);
    }

    const upgradeVersion = +facetVersions[0]; // Most recent version to deploy

    // Determine the deployed version or mark as undeployed (-1.0)
    const deployedVersion =
      deployedFacets[name]?.version ?? (deployedFacets[name]?.tx_hash ? 0.0 : -1.0);

    // Check if the facet needs deployment (not deployed or version mismatch)
    const facetNeedsDeployment =
      !(name in deployedFacets) || deployedVersion != upgradeVersion;

    // Prepare external libraries if required by the facet
    const externalLibraries = {} as any;
    if (networkDeployInfo.ExternalLibraries) {
      Object.keys(networkDeployInfo.ExternalLibraries)?.forEach((libraryName: string) => {
        if (facetDeployVersionInfo.libraries?.includes(libraryName)) {
          externalLibraries[libraryName] = networkDeployInfo.ExternalLibraries[libraryName];
        }
      });
    }

    // Create the facet contract factory with the required libraries (if any)
    const FacetContract = await ethers.getContractFactory(
      name,
      facetDeployVersionInfo.libraries
        ? {
            libraries: externalLibraries,
          }
        : undefined,
    );

    if (facetNeedsDeployment) {
      log(`Deploying ${name} size: ${FacetContract.bytecode.length}`); // Log facet deployment details

      try {
        // Retrieve the current gas price from the network
        const gasPrice = await ethers.provider.getGasPrice();
        log(`Current gas price: ${gasPrice.toString()}`);

        // Deploy the facet contract with a slightly increased gas price for reliability
        facet = await FacetContract.deploy({
          gasPrice: gasPrice.mul(110).div(100),
        });
        await facet.deployed(); // Wait for the deployment transaction to confirm
      } catch (e) {
        log(`Unable to deploy, continuing: ${e}`); // Log any errors during deployment
        continue; // Skip to the next facet
      }

      // Record the deployment details for the facet in the network deployment info
      deployedFacets[name] = {
        address: facet.address, // Deployed contract address
        tx_hash: facet.deployTransaction.hash, // Transaction hash for deployment
        version: deployedVersion, // Version of the deployed facet
      };

      log(`${name} deployed: ${facet.address} tx_hash: ${facet.deployTransaction.hash}`); // Log successful deployment
    }
  }

  log('Completed Facet deployments\n'); // Log the completion of the facet deployment process
}

export async function deployExternalLibraries(networkDeployedInfo: INetworkDeployInfo) {
  // Deploy the InnerVerifier contract
  const innerVerifierContract = await ethers.getContractFactory('InnerVerifier');
  const innerVerifier = await innerVerifierContract.deploy();

  // Deploy the BurnVerifier contract, linking it to the InnerVerifier library
  const burnVerifierContract = await ethers.getContractFactory('BurnVerifier', {
    libraries: {
      InnerVerifier: innerVerifier.address, // Link InnerVerifier to BurnVerifier
    },
  });
  const burnVerifier = await burnVerifierContract.deploy();

  // Deploy the ZetherVerifier contract, linking it to the InnerVerifier library
  const zetherVerifierContract = await ethers.getContractFactory('ZetherVerifier', {
    libraries: {
      InnerVerifier: innerVerifier.address, // Link InnerVerifier to ZetherVerifier
    },
  });
  const zetherVerifier = await zetherVerifierContract.deploy();

  // Deploy the libEncryption library
  const LibEncryptionContract = await ethers.getContractFactory('libEncryption');
  const libEncryption = await LibEncryptionContract.deploy();

  // Update the network deployment information with the addresses of the deployed libraries
  networkDeployedInfo.ExternalLibraries = {};
  networkDeployedInfo.ExternalLibraries.BurnVerifier = burnVerifier.address;
  networkDeployedInfo.ExternalLibraries.ZetherVerifier = zetherVerifier.address;
  networkDeployedInfo.ExternalLibraries.libEncryption = libEncryption.address;
}

async function main() {
  // Hardhat automatically compiles contracts when running scripts, but if this script
  // is executed directly with `node`, you may need to manually run the compile step.
  // await hre.run('compile');

  if (require.main === module) {
    // Enable debugging for logs with the specified namespace
    debug.enable('GNUS.*:log');

    // Load facet deployment data
    await LoadFacetDeployments();

    // Retrieve the deployer account from the available signers
    const deployer = (await ethers.getSigners())[0];

    log(`Deployer address: ${deployer.address}`); // Log the deployer's address

    // Get the deployer's current balance in ETH
    const deployerBalance = await ethers.provider.getBalance(deployer.address);
    log(`Deployer balance (in ETH): ${ethers.utils.formatEther(deployerBalance)} ETH`);

    // Estimate the gas cost for the deployment
    const estimatedGasCost = await getGasCost();
    log(`Estimated Gas Cost: ${estimatedGasCost} ETH`);

    // Convert the estimated gas cost to wei for comparison
    const estimatedGasCostInWei = ethers.utils.parseUnits(estimatedGasCost, 'ether');

    // Enable detailed logging for the Hardhat network during local testing
    if (hre.network.name === "hardhat") {
      hre.config.networks["hardhat"].loggingEnabled = true;
    }

    // Check if the deployer has sufficient funds to cover the deployment gas cost
    if (deployerBalance.lt(estimatedGasCostInWei)) {
      throw new Error(`Not enough funds to deploy. Deployer balance: ${ethers.utils.formatEther(deployerBalance)} ETH, Required: ${estimatedGasCost} ETH`);
    }

    log(`Sufficient balance to deploy on ${network.name}`); // Confirm sufficient funds

    // Initialize the deployment record for the current network if it doesn't exist
    const networkName = hre.network.name;
    if (!deployments[networkName]) {
      deployments[networkName] = {
        DiamondAddress: '', // Address of the deployed diamond contract
        DeployerAddress: deployer.address, // Address of the deployer
        FacetDeployedInfo: {}, // Information about deployed facets
      };
    }

    // Retrieve the deployment info for the current network
    const networkDeployedInfo = deployments[networkName];

    // Deploy the Genius Diamond contract
    await deployGNUSDiamond(networkDeployedInfo);

    log(`Contract address deployed is ${networkDeployedInfo.DiamondAddress}`); // Log the diamond address

    // Deploy external libraries if required (commented out here but can be enabled)
    // await deployExternalLibraries(networkDeployedInfo);

    // Deploy and initialize the facets for the diamond contract
    await deployAndInitDiamondFacets(networkDeployedInfo);

    // Log the details of deployed facets for debugging
    log(
      `Facets deployed to: ${
        (util.inspect(networkDeployedInfo.FacetDeployedInfo, { depth: null }))
      }`,
    );

    // Save deployment information for non-Hardhat networks
    if (networkName !== 'hardhat') {
      writeDeployedInfo(deployments);
    }
  }
}

// Handle errors gracefully if the script fails
main().catch((error) => {
  if (error instanceof Error) {
    console.error(`Deployment error: ${error.message}`);
  } else {
    console.error(`Unknown error occurred: ${error}`);
  }
  process.exitCode = 1; // Exit with error code
});
