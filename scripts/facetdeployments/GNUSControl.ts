import { GeniusDiamond } from "../../typechain-types/GeniusDiamond";
import { dc, debuglog, INetworkDeployInfo, AfterDeployInit, getSighash } from "../common";
import { Facets } from "../facets";
import hre from "hardhat";

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
}

Facets.GNUSControl = {
    priority: 100,
    versions: {
        2.3: {
            deployInit: "GNUSControl_Initialize230()",
            callback: afterDeploy
        }
    }
};
