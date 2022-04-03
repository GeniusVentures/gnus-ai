import { IFacetDeployedInfo, debuglog, INetworkDeployInfo, AfterDeployInit, getSighash } from "../common";
import { Facets } from "../facets";

// upgrade to 1.0 with ERC20 contract support, this upgrades all function selectors
Facets.PolyGNUSBridge = {
    priority: 50, init: "PolyGNUSBridge_Initialize_V1_0", version: 1.0
}
