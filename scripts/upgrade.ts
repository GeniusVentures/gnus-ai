// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { debug } from "debug";
// @ts-ignore
import { ethers } from "hardhat";
import {di, IDeployInfo} from "../scripts/common";
import { GeniusDiamond } from "../typechain-types/GeniusDiamond";
import { DiamondCutFacet } from "../typechain-types/DiamondCutFacet";
import { deployments } from "../scripts/deployments";
import { deployGNUSDiamondFacets } from "./deploy";
const log: debug.Debugger = debug("GNUSUpgrade:log");
import hre from "hardhat";
import fs from "fs";
import util from "util";

// @ts-ignore
log.color = "158";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  if (require.main === module) {
    log.enabled = true;
    //const network = await ethers.getDefaultProvider().getNetwork();
    const networkName = hre.network.name;
    if (networkName in deployments) {
      const deployInfo = deployments[networkName as keyof typeof deployments] as IDeployInfo;
      const diamondAddress: string = deployInfo.DiamondAddress;
      const Diamond = await ethers.getContractFactory("hardhat-diamond-abi/GeniusDiamond.sol:GeniusDiamond");
      di.gnusDiamond = Diamond.attach(diamondAddress) as GeniusDiamond;
      di.diamondCutFacet = await ethers.getContractAt("DiamondCutFacet", di.gnusDiamond.address) as DiamondCutFacet;
      // TODO: check ABI for contract or time updated and only deploy updated contracts
      deployInfo.FacetAddresses = [];
      await deployGNUSDiamondFacets(deployInfo);
      deployInfo.LastDeployed = Date.now();
      log(`Contract address deployed is ${di.gnusDiamond.address}`);
      fs.writeFileSync('scripts/deployments.ts', `\nexport const deployments = ${util.inspect(deployments)};\n`, "utf8")
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
