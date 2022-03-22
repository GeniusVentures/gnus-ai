// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { debug } from "debug";
import { BaseContract } from "ethers";
import { ethers } from "hardhat";
import { FacetInfo, getSelectors, getDeployedFuncSelectors } from "../scripts/FacetSelectors";
import { dc, INetworkDeployInfo, FacetToDeployInfo, AfterDeployInit, writeDeployedInfo } from "../scripts/common";
import { DiamondCutFacet } from "../typechain-types/DiamondCutFacet";
import { deployments } from "../scripts/deployments";
import { Facets, LoadFacetDeployments } from "../scripts/facets";
import hre from "hardhat";
import * as util from "util";

const log: debug.Debugger = debug("GNUSDeploy:log");
log.color = "159";


const {
  FacetCutAction,
} = require("contracts-starter/scripts/libraries/diamond.js");

// Facets to deploy and cut in diamond.  init = one time init on first deployed/constructor (not upgrade), skipExisting = skip existing facet functions

const registeredFunctionSignatures = new Set<string>();

export async function deployGNUSDiamond(networkDeployInfo: INetworkDeployInfo) {
  const accounts = await ethers.getSigners();
  const contractOwner = accounts[0];

  // deploy DiamondCutFacet
  const DiamondCutFacet = await ethers.getContractFactory("DiamondCutFacet");
  const diamondCutFacet = await DiamondCutFacet.deploy() as DiamondCutFacet;
  await diamondCutFacet.deployed();
  networkDeployInfo.FacetDeployedInfo.DiamondCutFacet = { address: diamondCutFacet.address,
    tx_hash: diamondCutFacet.deployTransaction.hash };
  log(`DiamondCutFacet deployed: ${diamondCutFacet.deployTransaction.hash} tx_hash: ${diamondCutFacet.deployTransaction.hash}`);
  dc.DiamondCutFacet = diamondCutFacet;

  // deploy Diamond
  const Diamond = await ethers.getContractFactory("contracts/GeniusDiamond.sol:GeniusDiamond");
  const gnusDiamond = await Diamond.deploy(
      contractOwner.address,
      diamondCutFacet.address
  );
  await gnusDiamond.deployed();
  dc._GeniusDiamond = gnusDiamond;
  networkDeployInfo.DiamondAddress = gnusDiamond.address;

  dc.GeniusDiamond = (await ethers.getContractFactory("hardhat-diamond-abi/GeniusDiamond.sol:GeniusDiamond")).attach(gnusDiamond.address);

  log(`Diamond deployed ${gnusDiamond.address}`);

}

export async function deployGNUSDiamondFacets(networkDeployInfo: INetworkDeployInfo, facetsToDeploy: FacetToDeployInfo = Facets) {

  // deploy facets
  log("");
  log("Deploying facets");

  const deployedFacets = networkDeployInfo.FacetDeployedInfo;
  const deployedFuncSelectors = await getDeployedFuncSelectors(networkDeployInfo);

  const cut: FacetInfo[] = [];
  const facetsPriority = Object.keys(facetsToDeploy).sort((a, b) => facetsToDeploy[a].priority - facetsToDeploy[b].priority);
  for (const name of facetsPriority) {
    const facetDeployInfo = facetsToDeploy[name];
    let facet: BaseContract;

    const FacetContract = await ethers.getContractFactory(name);
    if (!facetDeployInfo.skipExisting) {
      log(`Deploying ${name} size: ${FacetContract.bytecode.length}`);
      facet = await FacetContract.deploy();
      await facet.deployed();
      deployedFacets[name] = { address: facet.address, tx_hash: facet.deployTransaction.hash };
      log(`${name} deployed: ${facet.address} tx_hash: ${facet.deployTransaction.hash}`);
    } else {
      facet = FacetContract.attach(deployedFacets[name].address!);
    }

    dc[name] = facet;

    const origSelectors = getSelectors(facet).values;
    const newFuncSelectors = facetDeployInfo.deployInclude ?? getSelectors(facet, registeredFunctionSignatures).values;
    const removedSelectors = origSelectors.filter((v) => !newFuncSelectors.includes(v));
    if (removedSelectors.length) {
      log(`${name} removed ${removedSelectors.length} selectors: [${removedSelectors}]`);
    }

    // remove any that were removed and are still deployed.
    if (name in deployedFuncSelectors.contractFacets) {
      const deployedContractFacetsSelectors = deployedFuncSelectors.contractFacets[name];
      const deployedToRemove = deployedContractFacetsSelectors.filter((v) => !newFuncSelectors.includes(v));
      deployedFuncSelectors.contractFacets[name] = newFuncSelectors;
      // removing any previous deployed function selectors from this contract
      if (deployedToRemove.length) {
        cut.unshift({
          facetAddress: ethers.constants.AddressZero,
          action: FacetCutAction.Remove,
          functionSelectors: deployedToRemove,
          name: name
        });

        for (const removedFacet of deployedToRemove) {
          delete deployedFuncSelectors.facets[removedFacet];
        }
      }
    }

    if (newFuncSelectors.length) {
      deployedFacets[name].funcSelectors = newFuncSelectors;
      if (!facetDeployInfo.skipExisting) {
        const replaceFuncSelectors: string[] = [];
        const addFuncSelectors = newFuncSelectors.filter((v) => {
            if (v in deployedFuncSelectors.facets) {
              replaceFuncSelectors.push(v);
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
            initFunc: facetDeployInfo.init,
          });
        }

        if (addFuncSelectors.length) {
          cut.push({
            facetAddress: facet.address,
            action: FacetCutAction.Add,
            functionSelectors: addFuncSelectors,
            name: name,
            initFunc: facetDeployInfo.init,
          });

        }
      }

      // add new registered function selector strings
      for (const funcSelector of newFuncSelectors) {
        registeredFunctionSignatures.add(funcSelector);
        deployedFuncSelectors.facets[funcSelector] = facet.address;
      }

      deployedFacets[name].funcSelectors = newFuncSelectors;

    } else {
        delete deployedFuncSelectors.contractFacets[name];
        delete deployedFacets[name].funcSelectors;
        log(`Pruned all selectors from ${name}`);
    }

  }

  // upgrade diamond with facets
  log("");
  log("Diamond Cut:", cut);
  const diamondCut = await ethers.getContractAt("IDiamondCut", networkDeployInfo.DiamondAddress);

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
    const tx = await diamondCut.diamondCut([facetCutInfo], initAddress, functionCall);
    log(`Diamond cut: ${facetCutInfo.name} tx hash: ${tx.hash}`);
    const receipt = await tx.wait();
    if (!receipt.status) {
      throw Error(`Diamond upgrade of ${facetCutInfo.name} failed: ${tx.hash}`);
    }

    if (facetsToDeploy[facetCutInfo.name].callback) {
      const fnCallback = facetsToDeploy[facetCutInfo.name].callback as AfterDeployInit;
      await fnCallback(networkDeployInfo);
    }
  }

  log("Completed diamond cut\n");

}

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  if (require.main === module) {
    debug.enable("GNUS.*:log");
    await LoadFacetDeployments();
    const deployer = (await ethers.getSigners())[0].address;
    const networkName = hre.network.name;
    if (!deployments[networkName]) {
      deployments[networkName] = {
        DiamondAddress: "",
        DeployerAddress: deployer,
        FacetDeployedInfo: {}
      };
    }
    const networkDeployedInfo = deployments[networkName];
    await deployGNUSDiamond(networkDeployedInfo);

    log(`Contract address deployed is ${networkDeployedInfo.DiamondAddress}`);

    await deployGNUSDiamondFacets(networkDeployedInfo);
    log(`Facets deployed to: ${util.inspect(networkDeployedInfo.FacetDeployedInfo)}`);
    writeDeployedInfo(deployments);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
