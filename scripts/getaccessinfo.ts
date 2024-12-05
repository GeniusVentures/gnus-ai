import hre, { ethers } from "hardhat";
import debug from 'debug';
import { dc, FacetToDeployInfo, INetworkDeployInfo } from "./common";
import { GeniusDiamond } from "../typechain-types";
import { BigNumber } from "ethers";
import { deployments } from "./deployments";
import { attachGNUSDiamond } from "./upgrade";
import util from "util";

const log: debug.Debugger = debug('GNUSAccessControl:log');
log.color = '32';

// Function to get the gas price and calculate cost
export async function getAccessControlInfo() {
    const gnusDiamond = dc.GeniusDiamond as GeniusDiamond;

    const adminRole: string =  await gnusDiamond.DEFAULT_ADMIN_ROLE();

    const roleCount =  await gnusDiamond.getRoleMemberCount(adminRole);
    log(`Role Count: ${roleCount}`);
    const roleCountNum = roleCount.toNumber();
    for (let i = 0; i < roleCountNum; i++) {
        const roleMember = await gnusDiamond.getRoleMember(adminRole, i);
        log(`Role Member ${i.toString()}: ${roleMember}`);
    }

    try {
        const NFTCreated = await gnusDiamond.getNFTInfo(0);
        log(`NFT Information: ${util.inspect(NFTCreated)}`);
    } catch(e)
    {
        if (e instanceof Error && 'reason' in e) {
            log(`Error getting NFT info: ${util.inspect(e.reason)}`);
        } else {
            log(`Error getting NFT info: ${util.inspect(e)}`);
        }
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
