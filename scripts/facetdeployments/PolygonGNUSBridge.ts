import { IFacetDeployedInfo, debuglog, INetworkDeployInfo, AfterDeployInit, getSighash } from "../common";
import { Facets } from "../facets";

const afterDeploy: AfterDeployInit = async (networkDeployInfo: INetworkDeployInfo) =>  {
    debuglog("In PolygonGNUSBridge after Deploy function");
    // initalize with proxy's deposit contract.
    Promise.resolve();
}
// upgrade to 1.0 with ERC20 contract support, this upgrades all function selectors
Facets.PolyGNUSBridge.versions![1.0] =
        { fromVersion: 0.0, init: "PolyGNUSBridge_Initialize", upgrade_init: "PolyGNUSBridge_Initialize_V1_0", callback: afterDeploy };
