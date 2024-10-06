import hre, { ethers } from "hardhat";
import debug from 'debug';
import { dc, FacetToDeployInfo, INetworkDeployInfo } from "./common";
import { GeniusDiamond } from "../typechain-types";
import { BigNumber } from "ethers";
import { deployments } from "./deployments";
import { attachGNUSDiamond } from "./upgrade";

const log: debug.Debugger = debug('GNUSAccessControl:log');
log.color = '32';

// Function to get the gas price and calculate cost
export async function getAccessControlInfo() {
    const gnusDiamond = dc.GeniusDiamond as GeniusDiamond;

    const adminRole: string =  await gnusDiamond.DEFAULT_ADMIN_ROLE();

    const roleCount =  await gnusDiamond.getRoleMemberCount(adminRole);
    log(`Role Count: ${roleCount}`);
    for (let i:BigNumber = BigNumber.from(0); i.lt(roleCount); i.add(1)) {
        const roleMember = await gnusDiamond.getRoleMember(adminRole, i);
        log(`Role Member ${i.toString()}: ${roleMember}`);
    }
}

// Main function to allow Yarn or other calls
async function main() {
    if (require.main === module) {
        debug.enable('GNUS.*:log');
        const networkName = hre.network.name;
        log.enabled = true;
        const deployer = (await ethers.getSigners())[0];
        log(`Deployer address: ${deployer.address}`);

        if (networkName in deployments) {
            const networkDeployInfo: INetworkDeployInfo = deployments[networkName];
            await attachGNUSDiamond(networkDeployInfo);
            await getAccessControlInfo();
        }
    }
}

// Execute if run directly as Yarn command
if (require.main === module) {
    main().catch((error) => {
        log(error);
        process.exit(1);
    });
}
