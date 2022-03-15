// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { debug } from "debug";
import { BaseContract, BytesLike } from "ethers";
import { ethers } from "hardhat";
import { FacetInfo, getSelectors, getInterfaceID } from "../scripts/FacetSelectors";
import { di, IDeployInfo, IFacetDeployInfo } from "../scripts/common";
import { GeniusDiamond } from "../typechain-types/GeniusDiamond";
import { DiamondCutFacet } from "../typechain-types/DiamondCutFacet";
import { DiamondLoupeFacet } from "../typechain-types/DiamondLoupeFacet";
import { OwnershipFacet } from "../typechain-types/OwnershipFacet";
import { deployments } from "../scripts/deployments";
import * as fs from "fs";
import hre from "hardhat";
import * as util from "util";
import assert from "assert";

const log: debug.Debugger = debug("GNUSDeploy:log");
log.color = "159";


const {
  FacetCutAction,
} = require("contracts-starter/scripts/libraries/diamond.js");

// Facets to deploy and cut in diamond.  init = one time init on first deployed/constructor (not upgrade), skipExisting = skip existing facet functions
export const Facets: IFacetDeployInfo[] = [
  { name: "DiamondCutFacet", init: null, skipExisting: true },
  { name: "DiamondLoupeFacet", init: null, skipExisting: false },
  { name: "OwnershipFacet", init: null, skipExisting: false },
  { name: "GNUSNFTFactory", init: "GNUSNFTFactory_Initialize", skipExisting: false },
  { name: "PolyGNUSBridge", init: "PolyGNUSBridge_Initialize", skipExisting: false },
  { name: "EscrowAIJob", init: "EscrowAIJob_Initialize", skipExisting: false },
  { name: "GeniusAI", init: "GeniusAI_Initialize", skipExisting: false }, // must be last one to initialize as it set one time init is completely finished
  { name: "GNUSNFTCollectionName", init: null, skipExisting: false }
];

const registeredFunctionSignatures = new Set<string>();


const contracts: BaseContract[] = [];

export async function deployGNUSDiamond() {
  const accounts = await ethers.getSigners();
  const contractOwner = accounts[0];

  // deploy DiamondCutFacet
  const DiamondCutFacet = await ethers.getContractFactory("DiamondCutFacet");
  const diamondCutFacet = await DiamondCutFacet.deploy() as DiamondCutFacet;
  await diamondCutFacet.deployed();
  log("DiamondCutFacet deployed:", diamondCutFacet.address);

  // deploy Diamond
  const Diamond = await ethers.getContractFactory("contracts/GeniusDiamond.sol:GeniusDiamond");
  const gnusDiamond = await Diamond.deploy(
      contractOwner.address,
      diamondCutFacet.address
  );
  await gnusDiamond.deployed();

  di.diamondCutFacet = await ethers.getContractAt("DiamondCutFacet", gnusDiamond.address) as DiamondCutFacet;
  di.gnusDiamond = await ethers.getContractAt("hardhat-diamond-abi/GeniusDiamond.sol:GeniusDiamond", gnusDiamond.address) as GeniusDiamond
  log("Diamond deployed:", di.gnusDiamond.address);

}

export async function deployGNUSDiamondFacets(deployInfo: IDeployInfo, facets:IFacetDeployInfo[] = Facets) {

  // deploy facets
  log("");
  log("Deploying facets");

  deployInfo.FacetAddresses[0] = di.diamondCutFacet.address;
  deployInfo.LastDeployedIDs[0] = getInterfaceID(di.diamondCutFacet.interface)._hex;
  const cut: FacetInfo[] = [];
  for (let index =0; index < facets.length; index++) {
    const FacetDeployInfo = facets[index];
    assert(facets.length === deployInfo.FacetAddresses.length, `Need ${facets.length} items in deployInfo FacetAddresses array`);
    if (!FacetDeployInfo.skipExisting) {
      const FacetContract = await ethers.getContractFactory(FacetDeployInfo.name);
      const facet = await FacetContract.deploy();
      await facet.deployed();
      contracts.push(facet);
      deployInfo.FacetAddresses[index] = facet.address;
      deployInfo.LastDeployedIDs[index] = getInterfaceID(facet.interface)._hex;
      log(`${FacetDeployInfo.name} deployed: ${facet.address}`);
      const origSelectors = getSelectors(facet);
      const funcSelectors = getSelectors(facet, registeredFunctionSignatures);
      const removedSelectors = origSelectors.values.filter((v) => !funcSelectors.values.includes(v));
      if (removedSelectors.values.length > 0) {
        log(`Removed ${removedSelectors.values.length} Selectors: ${removedSelectors.values}`);
      }
      // add new registered function selector strings
      for (let index = 0; index < funcSelectors.values.length; index++) {
        const funcSelector = funcSelectors.values[index];
        registeredFunctionSignatures.add(funcSelector);
      }

      if (funcSelectors.values.length > 0) {
        cut.push({
          facetAddress: facet.address,
          action: FacetCutAction.Add,
          functionSelectors: funcSelectors.values,
          name: Facets[index].name,
          initFunc: Facets[index].init,
        });
      } else {
          log(`Pruned all selectors from ${funcSelectors.contract}`);
      }
    }
  }

  // upgrade diamond with facets
  log("");
  log("Diamond Cut:", cut);
  const diamondCut = await ethers.getContractAt("IDiamondCut", di.gnusDiamond.address);

  for (let index = 0; index < cut.length; index++) {
    const contract = contracts[index];
    const facetInfo  = cut[index];
    let functionCall;
    let initAddress;
    if (facetInfo.initFunc) {
      functionCall = contract.interface.encodeFunctionData(facetInfo.initFunc!);
      initAddress = facetInfo.facetAddress;
      log(`Calling Function ${facetInfo.initFunc}`);
    } else {
      functionCall = [];
      initAddress = ethers.constants.AddressZero;
    }
    const tx = await diamondCut.diamondCut([facetInfo], initAddress, functionCall);
    log(`Diamond cut: ${facetInfo.name} tx hash: ${tx.hash}`);
    const receipt = await tx.wait();
    if (!receipt.status) {
      throw Error(`Diamond upgrade of ${facetInfo.name} failed: ${tx.hash}`);
    }
  }

  di.diamondLoupeFacet = await ethers.getContractAt(
      "DiamondLoupeFacet",
      di.gnusDiamond.address
  ) as DiamondLoupeFacet;

  di.ownershipFacet = await ethers.getContractAt(
      "OwnershipFacet",
      di.gnusDiamond.address
  ) as OwnershipFacet;

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
    log.enabled = true;
    await deployGNUSDiamond();
    const deployer = (await ethers.getSigners())[0].address;
    const networkName = hre.network.name;
    if (!(networkName in deployments)) {
      deployments[networkName as keyof typeof deployments] = {
        DiamondAddress: di.gnusDiamond.address,
        DeployerAddress: deployer,
        FacetAddresses: Array(Facets.length).fill(""),
        LastDeployedIDs: Array(Facets.length).fill(""),
        LastVerifiedIDs: Array(Facets.length).fill(""),
      };
    }
    const deployInfo: IDeployInfo = deployments[networkName as keyof typeof deployments];
    log(`Contract address deployed is ${di.gnusDiamond.address}`);

    await deployGNUSDiamondFacets(deployInfo);
    log(`Facets deployed to: ${util.inspect(deployInfo.FacetAddresses)}`);
    fs.writeFileSync('scripts/deployments.ts', `\nexport const deployments = ${util.inspect(deployments)};\n`, "utf8")
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
