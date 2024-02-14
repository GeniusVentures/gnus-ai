// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { debug } from 'debug';
import { BaseContract } from 'ethers';
import hre, { ethers } from 'hardhat';
import { AdminClient } from '@openzeppelin/defender-admin-client';
import { Network } from '@openzeppelin/defender-base-client';
import {
  FacetInfo,
  getSelectors,
  getDeployedFuncSelectors,
} from '../scripts/FacetSelectors';
import {
  dc,
  INetworkDeployInfo,
  FacetToDeployInfo,
  AfterDeployInit,
  writeDeployedInfo,
} from '../scripts/common';
import { DiamondCutFacet } from '../typechain-types/DiamondCutFacet';
import { IDiamondCut } from '../typechain-types/IDiamondCut';
import { deployments } from '../scripts/deployments';
import { Facets, LoadFacetDeployments } from '../scripts/facets';
import * as util from 'util';

const log: debug.Debugger = debug('GNUSDeploy:log');
log.color = '159';

const GAS_LIMIT_PER_FACET = 60000;
const GAS_LIMIT_CUT_BASE = 70000;

const { FacetCutAction } = require('contracts-starter/scripts/libraries/diamond.js');

const client = new AdminClient({
  apiKey: process.env.DEFENDER_API_KEY || '',
  apiSecret: process.env.DEFENDER_API_SECRET || '',
});

export async function deployGNUSDiamond(networkDeployInfo: INetworkDeployInfo) {
  const accounts = await ethers.getSigners();
  const contractOwner = accounts[0];

  // deploy DiamondCutFacet
  if (networkDeployInfo.FacetDeployedInfo['DiamondCutFacet']?.address) {
    dc.DiamondCutFacet = await ethers.getContractAt(
      networkDeployInfo.FacetDeployedInfo['DiamondCutFacet']?.address,
      'DiamondCutFacet',
    );
  } else {
    const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet');
    const diamondCutFacet = (await DiamondCutFacet.deploy()) as DiamondCutFacet;
    await diamondCutFacet.deployed();
    log(
      `DiamondCutFacet deployed: ${diamondCutFacet.deployTransaction.hash} tx_hash: ${diamondCutFacet.deployTransaction.hash}`,
    );
    dc.DiamondCutFacet = diamondCutFacet;
  }

  // deploy Diamond
  const Diamond = await ethers.getContractFactory(
    'contracts/GeniusDiamond.sol:GeniusDiamond',
  );
  const gnusDiamond = await Diamond.deploy(contractOwner.address, dc.DiamondCutFacet.address);
  await gnusDiamond.deployed();
  dc._GeniusDiamond = gnusDiamond;
  networkDeployInfo.DiamondAddress = gnusDiamond.address;

  dc.GeniusDiamond = (
    await ethers.getContractFactory('hardhat-diamond-abi/GeniusDiamond.sol:GeniusDiamond')
  ).attach(gnusDiamond.address);

  // update deployed info for DiamondCutFacet since Diamond contract constructor already adds DiamondCutFacet::diamondCut
  const funcSelectors = getSelectors(diamondCutFacet);
  networkDeployInfo.FacetDeployedInfo.DiamondCutFacet = {
    address: diamondCutFacet.address,
    tx_hash: diamondCutFacet.deployTransaction.hash,
    version: 0.0,
    funcSelectors: funcSelectors.values,
  };

  log(`Diamond deployed ${gnusDiamond.address}`);
}

export async function deployFuncSelectors(
  networkDeployInfo: INetworkDeployInfo,
  oldNetworkDeployInfo: INetworkDeployInfo,
  facetsToDeploy: FacetToDeployInfo = Facets,
) {
  const cut: FacetInfo[] = [];
  const deployedFacets = networkDeployInfo.FacetDeployedInfo;
  const deployedFuncSelectors = await getDeployedFuncSelectors(oldNetworkDeployInfo);
  const registeredFunctionSignatures = new Set<string>();

  const facetsPriority = Object.keys(facetsToDeploy).sort(
    (a, b) => facetsToDeploy[a].priority - facetsToDeploy[b].priority,
  );
  let protocolUpgradeVersion = 0;
  for (const name of facetsPriority) {
    const facetDeployVersionInfo = facetsToDeploy[name];
    let facetVersions = ['0.0'];
    // sort version high to low
    if (facetDeployVersionInfo.versions) {
      facetVersions = Object.keys(facetDeployVersionInfo.versions).sort((a, b) => +b - +a);
    }

    const upgradeVersion = +facetVersions[0];
    protocolUpgradeVersion = Math.max(upgradeVersion, protocolUpgradeVersion);
    const facetDeployInfo = facetDeployVersionInfo.versions
      ? facetDeployVersionInfo.versions[upgradeVersion]
      : {};

    const deployedVersion =
      deployedFacets[name]?.version ?? (deployedFacets[name]?.tx_hash ? 0.0 : -1.0);

    const FacetContract = await ethers.getContractFactory(
      name,
      facetDeployVersionInfo.libraries
        ? {
            libraries: networkDeployInfo.ExternalLibraries,
          }
        : undefined,
    );
    const facet = FacetContract.attach(deployedFacets[name].address!);

    const facetNeedsUpgrade =
      !(name in deployedFuncSelectors.contractFacets) || upgradeVersion !== deployedVersion;
    dc[name] = facet;

    const origSelectors = getSelectors(facet).values;
    const newFuncSelectors =
      facetDeployInfo.deployInclude ??
      getSelectors(facet, registeredFunctionSignatures).values;
    const removedSelectors = origSelectors.filter((v) => !newFuncSelectors.includes(v));
    if (removedSelectors.length) {
      log(`${name} removed ${removedSelectors.length} selectors: [${removedSelectors}]`);
    }

    let numFuncSelectorsCut = 0;
    // remove any function selectors from this facet that were previously deployed but no longer exist
    const deployedContractFacetsSelectors = deployedFuncSelectors.contractFacets[name];
    const deployedToRemove =
      deployedContractFacetsSelectors?.filter((v) => !newFuncSelectors.includes(v)) ?? [];
    // removing any previous deployed function selectors that were removed from this contract
    if (deployedToRemove.length) {
      cut.unshift({
        facetAddress: ethers.constants.AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: deployedToRemove,
        name: name,
      });
      numFuncSelectorsCut++;
    }

    if (newFuncSelectors.length) {
      const initFunc = facetNeedsUpgrade
        ? deployedVersion === facetDeployInfo.fromVersion
          ? facetDeployInfo.upgradeInit
          : facetDeployInfo.init
        : null;
      deployedFacets[name].funcSelectors = newFuncSelectors;
      const replaceFuncSelectors: string[] = [];
      const addFuncSelectors = newFuncSelectors.filter((v) => {
        if (v in deployedFuncSelectors.facets) {
          if (
            deployedFuncSelectors.facets[v].toLowerCase() !== facet.address.toLowerCase()
          ) {
            replaceFuncSelectors.push(v);
          }
          return false;
        } else {
          return true;
        }
      });

      if (replaceFuncSelectors.length) {
        cut.push({
          facetAddress: facet.address,
          action: FacetCutAction.Replace,
          functionSelectors: replaceFuncSelectors,
          name: name,
          initFunc: initFunc,
        });
        numFuncSelectorsCut++;
      }

      if (addFuncSelectors.length) {
        cut.push({
          facetAddress: facet.address,
          action: FacetCutAction.Add,
          functionSelectors: addFuncSelectors,
          name: name,
          initFunc: initFunc,
        });
        numFuncSelectorsCut++;
      }

      // add new registered function selector strings
      for (const funcSelector of newFuncSelectors) {
        registeredFunctionSignatures.add(funcSelector);
      }

      deployedFacets[name].funcSelectors = newFuncSelectors;
      deployedFacets[name].version = upgradeVersion;
    } else {
      delete deployedFuncSelectors.contractFacets[name];
      log(`Pruned all selectors from ${name}`);
    }

    if (numFuncSelectorsCut === 0) {
      log(
        `*** Skipping ${name} as there were no modifications to deployed facet function selectors`,
      );
    }
  }

  // upgrade diamond with facets
  log('');
  log('Diamond Cut:', cut);
  const diamondCut = dc.GeniusDiamond as IDiamondCut;
  if (process.env.DEFENDER_DEPLOY_ON) {
    log('Deploying contract on defender');
    const listedContracts = await client.listContracts();
    if (listedContracts.find((e) => e.address === diamondCut.address)) {
      log('Diamond Contract was listed on defender');
    } else {
      const res = await client.addContract({
        address: diamondCut.address,
        abi: JSON.stringify(diamondCut.interface.fragments),
        network: hre.network.name as Network,
        name: 'Gnus.ai Diamond',
      });
      if (res.address) {
        log('Diamond Contract was listed on defender', res.address);
      }
    }
  }

  for (const facetCutInfo of cut) {
    const contract = dc[facetCutInfo.name]!;
    let functionCall;
    let initAddress;
    if (facetCutInfo.initFunc) {
      functionCall = contract.interface.encodeFunctionData(facetCutInfo.initFunc!);
      initAddress = facetCutInfo.facetAddress;
      log(`Calling Function ${facetCutInfo.initFunc}`);
    } else {
      functionCall = [];
      initAddress = ethers.constants.AddressZero;
    }
    log('Cutting: ', facetCutInfo);
    try {
      if (process.env.DEFENDER_DEPLOY_ON) {
        const diamondCutFuncAbi = {
          inputs: [
            {
              components: [
                {
                  name: 'facetAddress',
                  type: 'address',
                },
                {
                  name: 'action',
                  type: 'uint8',
                },
                {
                  name: 'functionSelectors',
                  type: 'bytes4[]',
                },
              ],
              name: '_diamondCut',
              type: 'tuple[]',
            },
            {
              name: '_init',
              type: 'address',
            },
            {
              name: '_calldata',
              type: 'bytes',
            },
          ],
          name: 'diamondCut',
        };
        const response = await client.createProposal({
          contract: { address: diamondCut.address, network: hre.network.name as Network }, // Target contract
          title: 'Add facet ' + facetCutInfo.name, // Title of the proposal
          description: 'Add facet', // Description of the proposal
          type: 'custom', // Use 'custom' for custom admin actions
          functionInterface: diamondCutFuncAbi, // Function ABI
          functionInputs: [
            [
              [
                facetCutInfo.facetAddress,
                facetCutInfo.action.toString(),
                facetCutInfo.functionSelectors,
              ],
            ],
            initAddress,
            functionCall,
          ], // Arguments to the function
          via: process.env.DEFENDER_SIGNER,
          viaType: 'Gnosis Multisig',
        });        
      } else {
        const tx = await diamondCut.diamondCut([facetCutInfo], initAddress, functionCall, {
          gasLimit:
            GAS_LIMIT_CUT_BASE +
            facetCutInfo.functionSelectors.length * GAS_LIMIT_PER_FACET,
        });
        log(`Diamond cut: ${facetCutInfo.name} tx hash: ${tx.hash}`);
        const receipt = await tx.wait();
        if (!receipt.status) {
          throw Error(`Diamond upgrade of ${facetCutInfo.name} failed: ${tx.hash}`);
        }
      }
    } catch (e) {
      log(`unable to cut facet: ${facetCutInfo.name}\n ${e}`);
      continue;
    }

    for (const facetModified of facetCutInfo.functionSelectors) {
      switch (facetCutInfo.action) {
        case FacetCutAction.Add:
        case FacetCutAction.Replace:
          deployedFuncSelectors.facets[facetModified] = facetCutInfo.facetAddress;
          break;
        case FacetCutAction.Remove:
          delete deployedFuncSelectors.facets[facetModified];
          break;
      }
    }
  }

  log('Diamond Facets cuts completed');
}

export async function afterDeployCallbacks(
  networkDeployInfo: INetworkDeployInfo,
  facetsToDeploy: FacetToDeployInfo = Facets,
) {
  const facetsPriority = Object.keys(facetsToDeploy).sort(
    (a, b) => facetsToDeploy[a].priority - facetsToDeploy[b].priority,
  );
  for (const name of facetsPriority) {
    const facetDeployVersionInfo = facetsToDeploy[name];
    let facetVersions = ['0.0'];
    // sort version high to low
    if (facetDeployVersionInfo.versions) {
      facetVersions = Object.keys(facetDeployVersionInfo.versions).sort((a, b) => +b - +a);
    }

    const upgradeVersion = +facetVersions[0];
    const facetDeployInfo = facetDeployVersionInfo.versions
      ? facetDeployVersionInfo.versions[upgradeVersion]
      : {};
    if (facetDeployInfo.callback) {
      const afterDeployCallback = facetDeployInfo.callback;
      try {
        await afterDeployCallback(networkDeployInfo);
      } catch (e) {
        log(`Failure in after deploy callbacks for ${name}: \n${e}`);
      }
    }
  }
}

export async function deployAndInitDiamondFacets(
  networkDeployInfo: INetworkDeployInfo,
  facetsToDeploy: FacetToDeployInfo = Facets,
) {
  const deployInfoBeforeUpgraded: INetworkDeployInfo = JSON.parse(
    JSON.stringify(networkDeployInfo),
  );

  await deployDiamondFacets(networkDeployInfo, facetsToDeploy);
  const deployInfoWithOldFacet: INetworkDeployInfo = Object.assign(
    JSON.parse(JSON.stringify(networkDeployInfo)),
  );
  for (const key in deployInfoWithOldFacet.FacetDeployedInfo) {
    if (deployInfoBeforeUpgraded.FacetDeployedInfo[key])
      deployInfoWithOldFacet.FacetDeployedInfo[key] =
        deployInfoBeforeUpgraded.FacetDeployedInfo[key];
  }
  await deployFuncSelectors(networkDeployInfo, deployInfoWithOldFacet, facetsToDeploy);
  await afterDeployCallbacks(networkDeployInfo, facetsToDeploy);
}

export async function deployDiamondFacets(
  networkDeployInfo: INetworkDeployInfo,
  facetsToDeploy: FacetToDeployInfo = Facets,
) {
  // deploy facets
  log('');
  log('Deploying facets');
  const deployedFacets = networkDeployInfo.FacetDeployedInfo;

  const facetsPriority = Object.keys(facetsToDeploy).sort(
    (a, b) => facetsToDeploy[a].priority - facetsToDeploy[b].priority,
  );
  for (const name of facetsPriority) {
    const facetDeployVersionInfo = facetsToDeploy[name];
    let facet: BaseContract;
    let facetVersions = ['0.0'];
    // sort version high to low, could be used for future upgrading from version X to version Y
    if (facetDeployVersionInfo.versions) {
      facetVersions = Object.keys(facetDeployVersionInfo.versions).sort((a, b) => +b - +a);
    }

    const upgradeVersion = +facetVersions[0];

    const deployedVersion =
      deployedFacets[name]?.version ?? (deployedFacets[name]?.tx_hash ? 0.0 : -1.0);
    const facetNeedsDeployment =
      !(name in deployedFacets) || deployedVersion != upgradeVersion;

    const externalLibraries = {} as any;
    Object.keys(networkDeployInfo.ExternalLibraries)?.forEach((libraryName: string) => {
      if (facetDeployVersionInfo.libraries?.includes(libraryName))
        externalLibraries[libraryName] = networkDeployInfo.ExternalLibraries[libraryName];
    });
    const FacetContract = await ethers.getContractFactory(
      name,
      facetDeployVersionInfo.libraries
        ? {
            libraries: externalLibraries,
          }
        : undefined,
    );

    if (facetNeedsDeployment) {
      log(`Deploying ${name} size: ${FacetContract.bytecode.length}`);
      try {
        facet = await FacetContract.deploy();
        await facet.deployed();
      } catch (e) {
        log(`Unable to deploy, continuing: ${e}`);
        continue;
      }
      deployedFacets[name] = {
        address: facet.address,
        tx_hash: facet.deployTransaction.hash,
        version: deployedVersion,
      };
      log(`${name} deployed: ${facet.address} tx_hash: ${facet.deployTransaction.hash}`);
    }
  }

  log('Completed Facet deployments\n');
}

export async function deployExternalLibraries(networkDeployedInfo: INetworkDeployInfo) {
  const innerVerifierContract = await ethers.getContractFactory('InnerVerifier');
  const innerVerifier = await innerVerifierContract.deploy();
  const burnVerifierContract = await ethers.getContractFactory('BurnVerifier', {
    libraries: {
      InnerVerifier: innerVerifier.address,
    },
  });
  const burnVerifier = await burnVerifierContract.deploy();
  const zetherVerifierContract = await ethers.getContractFactory('ZetherVerifier', {
    libraries: {
      InnerVerifier: innerVerifier.address,
    },
  });
  const zetherVerifier = await zetherVerifierContract.deploy();
  const LibEncryptionContract = await ethers.getContractFactory('libEncryption');
  const libEncryption = await LibEncryptionContract.deploy();
  networkDeployedInfo.ExternalLibraries = {};
  networkDeployedInfo.ExternalLibraries.BurnVerifier = burnVerifier.address;
  networkDeployedInfo.ExternalLibraries.ZetherVerifier = zetherVerifier.address;
  networkDeployedInfo.ExternalLibraries.libEncryption = libEncryption.address;
}

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  if (require.main === module) {
    debug.enable('GNUS.*:log');
    await LoadFacetDeployments();
    const deployer = (await ethers.getSigners())[0].address;
    const networkName = hre.network.name;
    if (!deployments[networkName]) {
      deployments[networkName] = {
        DiamondAddress: '',
        DeployerAddress: deployer,
        FacetDeployedInfo: {},
      };
    }
    const networkDeployedInfo = deployments[networkName];
    await deployGNUSDiamond(networkDeployedInfo);

    log(`Contract address deployed is ${networkDeployedInfo.DiamondAddress}`);
    // await deployExternalLibraries(networkDeployedInfo);
    await deployAndInitDiamondFacets(networkDeployedInfo);
    log(
      `Facets deployed to: ${
        (util.inspect(networkDeployedInfo.FacetDeployedInfo), { depth: null })
      }`,
    );
    writeDeployedInfo(deployments);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
