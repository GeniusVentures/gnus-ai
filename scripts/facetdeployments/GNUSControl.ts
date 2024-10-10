import { GeniusDiamond } from "../../typechain-types/GeniusDiamond";
import { dc, debuglog, INetworkDeployInfo, AfterDeployInit, getSighash } from "../common";
import { Facets } from "../facets";
import hre, { ethers } from "hardhat";
import util from "util";

const OpenSeaProxyAddresses: {[key: string]: string } = {
    mumbai: "",
    polygon: "0x207Fa8Df3a17D96Ca7EA4f2893fcdCb78a304101",
    hardhat: "0x207Fa8Df3a17D96Ca7EA4f2893fcdCb78a304101" // for testing
};

const afterDeploy: AfterDeployInit = async (networkDeployInfo: INetworkDeployInfo) => {
    const chainID = hre.network.config.chainId || 1;

    debuglog(`In GNUSControl after Deploy function, chainID: ${chainID}`);

    const gnusDiamond = dc.GeniusDiamond as GeniusDiamond;
    await gnusDiamond.setChainID(chainID);

    const info = await gnusDiamond.protocolInfo();

    debuglog(`protocalinfo: \n${util.inspect(info)}`)

    // simulate orevious bad deployments
    //const signers = await ethers.getSigners();
    //const owner = signers[0];
    //await gnusDiamond.transferOwnership(owner.address);
}

Facets.GNUSControl = {
    priority: 110,
    versions: {
        0.0: {
            callback: afterDeploy
        },
        2.3: {
             deployInit: "GNUSControl_Initialize230()",
        }
    }
};
