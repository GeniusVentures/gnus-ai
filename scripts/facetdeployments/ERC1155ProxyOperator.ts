import { IFacetDeployedInfo, debuglog, INetworkDeployInfo, AfterDeployInit, getSighash } from "../common";
import { Facets } from "../facets";


const afterDeploy: AfterDeployInit = async AfterDeployInit => {
    debuglog("In ERC1155ProxyOperator after Deploy function");
    // initalize with proxy's like OpenSea.
    Promise.resolve();
}

Facets.ERC1155ProxyOperator = {
     priority: 35, callback: afterDeploy, deployInclude:
         [getSighash("function isApprovedForAll(address,address)"),
             getSighash("function tokenSupply(uint256)"),
             getSighash("function creators(uint256)")
         ]
};

