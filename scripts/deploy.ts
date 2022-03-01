// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { BaseContract, BytesLike } from "ethers";
import { ethers } from "hardhat";
import "./FacetSelectors";
import { FacetInfo, getSelectors } from "./FacetSelectors";

const {
  FacetCutAction,
} = require("contracts-starter/scripts/libraries/diamond.js");

// Facets to deploy and cut in diamond.  init = one time init on first deployed/constructor (not upgrade), skipExisting = skip existing facet functions
export const Facets = [
  { name: "DiamondLoupeFacet", init: null },
  { name: "OwnershipFacet", init: null },
  { name: "GNUSNFTFactory", init: "GNUSNFTFactory_Initialize" },
  { name: "PolyGNUSBridge", init: null, skipExisting: true },
  { name: "EscrowAIJob", init: "EscrowAIJob_Initialize" },
  { name: "GeniusAI", init: "GeniusAI_Initialize" },          // must be last one to initialize as it set one time init is completely finished
];

const registeredFunctionSignatures = new Set<string>();

const contracts: BaseContract[] = [];

export async function deployGNUSDiamond() {
  const accounts = await ethers.getSigners();
  const contractOwner = accounts[0];

  // deploy DiamondCutFacet
  const DiamondCutFacet = await ethers.getContractFactory("DiamondCutFacet");
  const diamondCutFacet = await DiamondCutFacet.deploy();
  await diamondCutFacet.deployed();
  console.log("DiamondCutFacet deployed:", diamondCutFacet.address);

  // deploy Diamond
  const Diamond = await ethers.getContractFactory("GeniusDiamond");
  const diamond = await Diamond.deploy(
    contractOwner.address,
    diamondCutFacet.address
  );
  await diamond.deployed();
  console.log("Diamond deployed:", diamond.address);

  // deploy DiamondInit
  // DiamondInit provides a function that is called when the diamond is upgraded to initialize state variables
  // Read about how the diamondCut function works here: https://eips.ethereum.org/EIPS/eip-2535#addingreplacingremoving-functions
  const DiamondInit = await ethers.getContractFactory("DiamondInit");
  const diamondInit = await DiamondInit.deploy();
  await diamondInit.deployed();
  console.log("DiamondInit deployed:", diamondInit.address);

  // deploy facets
  console.log("");
  console.log("Deploying facets");

  const cut: FacetInfo[] = [];
  for (let index =0; index < Facets.length; index++) {
    const Facet = Facets[index];
    const FacetContract = await ethers.getContractFactory(Facet.name);
    const facet = await FacetContract.deploy();
    await facet.deployed();
    contracts.push(facet);
    console.log(`${Facet.name} deployed: ${facet.address}`);
    const origSelectors = getSelectors(facet);
    const funcSelectors = getSelectors(facet, registeredFunctionSignatures);
    const removedSelectors = origSelectors.values.filter((v) => !funcSelectors.values.includes(v));
    if (removedSelectors.values.length > 0) {
      // console.log(`Removed ${removedSelectors.values.length} Selectors: ${removedSelectors.values}`);
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
      });
    } else if (process.env.VERBOSE_TEST) {
        console.log(`Pruned all selectors from ${funcSelectors.contract}`);
    }
  }

  // upgrade diamond with facets
  if (process.env.VERBOSE_TEST) {
    console.log("");
    console.log("Diamond Cut:", cut);
  }
  const diamondCut = await ethers.getContractAt("IDiamondCut", diamond.address);
  // call to init function
  const functionCall = diamondInit.interface.encodeFunctionData("init");
  const tx = await diamondCut.diamondCut(
    [],
    diamondInit.address,
    functionCall
  );
  console.log("Diamond cut tx: ", tx.hash);
  const receipt = await tx.wait();
  if (!receipt.status) {
    throw Error(`Diamond upgrade failed: ${tx.hash}`);
  }

  for (let index = 0; index < cut.length; index++) {
    const contract = contracts[index];
    const facetInfo  = cut[index];
    let functionCall;
    let initAddress;
    if (Facets[index].init) {
      functionCall = contract.interface.encodeFunctionData(Facets[index].init!);
      initAddress = facetInfo.facetAddress;
      if (process.env.VERBOSE_TEST) {
        console.log(`Calling Function ${Facets[index].init}`);
      }
    } else {
      functionCall = [];
      initAddress = ethers.constants.AddressZero;
    }
    const tx = await diamondCut.diamondCut([facetInfo], initAddress, functionCall);
    console.log(`Diamond cut: ${Facets[index].name} tx hash: ${tx.hash}`);
    const receipt = await tx.wait();
    if (!receipt.status) {
      throw Error(`Diamond upgrade of ${Facets[index].name} failed: ${tx.hash}`);
    }
  }

  console.log("Completed diamond cut\n");

  return diamond.address;
}

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  if (require.main === module) {
    const contractAddress: string = await deployGNUSDiamond();
    console.log(`Contract address deployed is ${contractAddress}`);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
