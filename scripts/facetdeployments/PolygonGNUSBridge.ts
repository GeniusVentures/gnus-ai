import { GeniusDiamond } from "../../typechain-types/GeniusDiamond";
import { dc, IFacetDeployedInfo, debuglog, INetworkDeployInfo, AfterDeployInit, getSighash } from "../common";
import { Facets } from "../facets";
import hre from "hardhat";

const PolygonProxyAddresses: {[key: string]: string } = {
    mumbai: "0xb5505a6d998549090530911180f38aC5130101c6",
    polygon: "0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa",
    hardhat: "0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa"       // for testing
};

const afterDeploy: AfterDeployInit = async (networkDeployInfo: INetworkDeployInfo) =>  {
    debuglog("In PolygonGNUSBridge after Deploy function");

    const gnusDiamond = dc.GeniusDiamond as GeniusDiamond;
    const proxyRole = await gnusDiamond.PROXY_ROLE( { gasLimit: 600000 });
    const networkName = hre.network.name;

    // allow Polygon ChildChainManagerProxis
    if (networkName in PolygonProxyAddresses) {
        const proxyAddress: string = PolygonProxyAddresses[networkName];
        try {
            await gnusDiamond.grantRole(proxyRole, proxyAddress, { gasLimit: 600000 });
        } catch (e) {
            debuglog(`Warning, couldn't grant proxy role for ${networkName} Deposit/Withdrawal contract at ${proxyAddress}`);
        }
    }
}
// upgrade to 1.0 with ERC20 contract support, this upgrades all function selectors
Facets.PolyGNUSBridge.versions![1.0] =
        { fromVersion: 0.0, init: "PolyGNUSBridge_Initialize", upgrade_init: "PolyGNUSBridge_Initialize_V1_0", callback: afterDeploy };
