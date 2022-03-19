import debug from "debug";


const log: debug.Debugger = debug("GNUSVerify:log");
import hre from "hardhat";
import { di, IDeployInfo, IFacetDeployInfo } from "../scripts/common";
import { deployments } from "../scripts/deployments";
import fs from "fs";
import util from "util";
import { BaseContract } from "ethers";
import { Facets } from "../scripts/deploy";
import { getInterfaceID } from "./FacetSelectors";
import { GetUpdatedFacets } from "./upgrade";

const ethers = hre.ethers;

export async function VerifyContracts(deployInfo: IDeployInfo) {
    // Can only verify GNUS Diamond Contract once.
    if (deployInfo.LastVerifiedIDs[0] === "") {
        log(`Verifing GNUS Diamdond at address ${deployInfo.DiamondAddress}`);
        await hre.run("verify:verify", {
            address: deployInfo.DiamondAddress,
            constructorArguments: [
                deployInfo.DeployerAddress,
                deployInfo.FacetAddresses[0]
            ],
        });
    }

    for (let i=0; i< deployInfo.FacetAddresses.length; i++) {
        if (deployInfo.LastDeployedIDs[i] !== deployInfo.LastVerifiedIDs[i]) {
            const facetAddress = deployInfo.FacetAddresses[i];
            log(`Verifing GNUS Facet at address ${facetAddress}`);
            const facetContract: BaseContract = await ethers.getContractAt(Facets[i].name, deployInfo.DiamondAddress);
            deployInfo.LastVerifiedIDs[i] = deployInfo.LastDeployedIDs[i];
            await hre.run("verify:verify", {
                address: facetAddress,
            });
        }
    }
}

async function main() {
    // Hardhat always runs the compile task when running scripts with its command
    // line interface.
    //
    // If this script is run directly using `node` you may want to call compile
    // manually to make sure everything is compiled
    // await hre.run('compile');

    if (require.main === module) {
        const networkName = hre.network.name;
        log.enabled = true;
        if (networkName in deployments) {
            const deployInfo: IDeployInfo = deployments[networkName as keyof typeof deployments];
            if (!["hardhat", "localhost"].includes(networkName))
            {
                await VerifyContracts(deployInfo);
                log(`Finished Verifying GNUS Diamond at ${deployInfo.DiamondAddress}`);
            }
            fs.writeFileSync('scripts/deployments.ts', `\nexport const deployments = ${util.inspect(deployments)};\n`, "utf8")
            log(`Finished Verifying GNUS Contracts/Facets at ${deployInfo.DiamondAddress}`);
        }
    }
}


// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
