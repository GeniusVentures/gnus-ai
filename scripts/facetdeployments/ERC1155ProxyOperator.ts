import { GeniusDiamond } from "../../typechain-types/GeniusDiamond";
import { dc, IFacetDeployedInfo, debuglog, INetworkDeployInfo, AfterDeployInit, getSighash } from "../common";
import { Facets } from "../facets";
import hre from "hardhat";

const OpenSeaProxyAddresses: {[key: string]: string } = {
  mumbai: "",
  polygon: "0x207Fa8Df3a17D96Ca7EA4f2893fcdCb78a304101",
  hardhat: "0x207Fa8Df3a17D96Ca7EA4f2893fcdCb78a304101" // for testing
};

const afterDeploy: AfterDeployInit = async (networkDeployInfo: INetworkDeployInfo) => {
  debuglog("In ERC1155ProxyOperator after Deploy function");

  const gnusDiamond = dc.GeniusDiamond as GeniusDiamond;
  const NFTProxyRole = await gnusDiamond.NFT_PROXY_OPERATOR_ROLE({ gasLimit: 600000 });
  const networkName = hre.network.name;

  // allow OpenSea Proxy Operator
  if (networkName in OpenSeaProxyAddresses) {
    const proxyAddress: string = OpenSeaProxyAddresses[networkName];
    try {
      await gnusDiamond.grantRole(NFTProxyRole, proxyAddress, { gasLimit: 600000 });
    } catch (e) {
      debuglog(`Warning, couldn't grant proxy role for ${networkName} OpenSea NFT contract at ${proxyAddress}\n${e}`);
    }
  }
}

Facets.ERC1155ProxyOperator = {
  priority: 45,
  versions: {
    0.0: {
      callback: afterDeploy,
      deployInclude:
            [ getSighash("function isApprovedForAll(address,address)"),
              getSighash("function totalSupply(uint256)"),
              getSighash("function creators(uint256)"),
              getSighash("function NFT_PROXY_OPERATOR_ROLE()")
            ]
    }
  }
};
