import debug from "debug";


const log: debug.Debugger = debug("GNUSVerify:log");
import hre from "hardhat";
import { di, IDeployInfo } from "../scripts/common";
import { deployments } from "../scripts/deployments";

export async function VerifyContracts(deployInfo: IDeployInfo) {
    log(`Verifing GNUS Diamdond at address ${deployInfo.DiamondAddress}`);
    await hre.run("verify:verify", {
        address: deployInfo.DiamondAddress,
        constructorArguments: [
            deployInfo.DeployerAddress,
            deployInfo.FacetCutAddress
        ],
    });

    log(`Verifing GNUS DiamdondCut at address ${deployInfo.FacetCutAddress}`);

    await hre.run("verify:verify", {
        address: deployInfo.FacetCutAddress,
    });

    for (let i=0; i< deployInfo.FacetAddresses.length; i++) {
        const facetAddress = deployInfo.FacetAddresses[i];
        log(`Verifing GNUS Facet at address ${facetAddress}`);

        await hre.run("verify:verify", {
            address: facetAddress,
        });
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
            const deployInfo = deployments[networkName as keyof typeof deployments] as IDeployInfo;
            log(`Finished Verifying GNUS Diamond at ${deployInfo.DiamondAddress}`);
        }
    }
}


// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
