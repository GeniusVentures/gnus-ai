import { GeniusDiamond } from "../../typechain-types/GeniusDiamond";
import { dc, IFacetDeployedInfo, debuglog, INetworkDeployInfo, AfterDeployInit, getSighash } from "../common";
import { Facets } from "../facets";
import hre from "hardhat";

const OpenSeaProxyAddresses: {[key: string]: string } = {
    mumbai: "",
    polygon: "0x207Fa8Df3a17D96Ca7EA4f2893fcdCb78a304101",
    hardhat: "0x207Fa8Df3a17D96Ca7EA4f2893fcdCb78a304101"       // for testing
};

const afterDeploy: AfterDeployInit = async (networkDeployInfo: INetworkDeployInfo) =>  {
    debuglog("In ERC1155ProxyOperator after Deploy function");

    const gnusDiamond = dc.GeniusDiamond as GeniusDiamond;
    const NFTProxyRole = await gnusDiamond.NFT_PROXY_OPERATOR_ROLE();
    const networkName = hre.network.name;

    // allow OpenSea Proxy Operator
    if (networkName in OpenSeaProxyAddresses) {
        const proxyAddress: string = OpenSeaProxyAddresses[networkName];
        try {
            await gnusDiamond.grantRole(NFTProxyRole, proxyAddress);
        } catch (e) {
            debuglog(`Warning, couldn't grant proxy role for ${networkName} OpenSea NFT contract at ${proxyAddress}`);
        }
    }
    // initalize with proxy's deposit contract.
    Promise.resolve();
}

Facets.ERC1155ProxyOperator = {
     priority: 35, versions: { 0.0: {
        callback: afterDeploy, deployInclude:
            [  getSighash("function isApprovedForAll(address,address)"),
               getSighash("function totalSupply(uint256)"),
               getSighash("function creators(uint256)")
            ],
    } },
};

