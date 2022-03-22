// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { debug } from "debug";
import { FacetToDeployInfo, FacetDeployedInfo, writeDeployedInfo } from "../scripts/common";
import { deployments } from "../scripts/deployments";
import { Facets, LoadFacetDeployments } from "../scripts/facets";
import { deployGNUSDiamondFacets } from "./deploy";
const log: debug.Debugger = debug("GNUSUpgrade:log");
import hre from "hardhat";
import fs from "fs";
import util from "util";

// @ts-ignore
log.color = "158";

export async function GetUpdatedFacets(facetsDeployed: FacetDeployedInfo) : Promise<FacetToDeployInfo> {
  const updatedFacetsToDeploy: FacetToDeployInfo = {};

  for (const name in Facets ) {
    updatedFacetsToDeploy[name] = Facets[name];
    // if transaction hash is undefined, null or empty string, don't skip, double negatives with truthy :)
    updatedFacetsToDeploy[name].skipExisting = !(!facetsDeployed[name]?.tx_hash);
  }
  return updatedFacetsToDeploy;
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
    const networkName = hre.network.name;
    if (networkName in deployments) {
      const deployInfo = deployments[networkName];
      await LoadFacetDeployments();
      const updatedFacetsToDeploy = await GetUpdatedFacets(deployInfo.FacetDeployedInfo);
      log(util.inspect(updatedFacetsToDeploy));
      await deployGNUSDiamondFacets(deployInfo, updatedFacetsToDeploy);
      log(`Contract address deployed is ${deployInfo.DiamondAddress}`);
      writeDeployedInfo(deployments);
    } else {
      log(`No deployments found to attach to for ${networkName}, aborting.`);
    }

  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
