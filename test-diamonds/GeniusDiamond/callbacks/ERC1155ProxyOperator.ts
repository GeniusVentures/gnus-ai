import hre from "hardhat";
import { debuglog, CallbackArgs } from "diamonds";
import { id } from "ethers";
import { Contract } from "ethers";

// Define or import NFTProxyRole
const NFTProxyRole = id("NFT_PROXY_ROLE");

const OpenSeaProxyAddresses: { [key: string]: string } = {
  mumbai: "",
  polygon: "0x207Fa8Df3a17D96Ca7EA4f2893fcdCb78a304101",
  hardhat: "0x207Fa8Df3a17D96Ca7EA4f2893fcdCb78a304101" // for testing
};

export async function setNFTProxyRoleForOpenSea(CallbackArgs: CallbackArgs) {
  console.log("Starting ERC1155ProxyOperator callback setNFTPRoxyRoleForOpenSea");
  // const { diamond } = CallbackArgs;

  // // Get the GeniusDiamond instance
  // const diamondName = diamond.diamondName;
  // const networkName = diamond.networkName;
  // const deployer = diamond.signer!;
  // const deployInfo = diamond.getDeployedDiamondData();
  // const diamondAddress = deployInfo.DiamondAddress;
  // const diamondArtifactName = `hardhat-diamond-abi/HardhatDiamondABI.sol:${diamondName}`;
  // const diamondArtifact = hre.artifacts.readArtifactSync(diamondArtifactName);
  // const geniusDiamond = new hre.ethers.Contract(diamondAddress, diamondArtifact.abi, diamond.provider) as GeniusDiamond;
  // const deployerDiamondContract = geniusDiamond.connect(deployer);

  // // TODO This is not working because it is relying on the deployInclude functionality working for function selectors.
  // const NFTProxyRole = await geniusDiamond.NFT_PROXY_OPERATOR_ROLE({ gasLimit: 600000 });

  // // allow OpenSea Proxy Operator
  // if (networkName in OpenSeaProxyAddresses) {
  //   const proxyAddress: string = OpenSeaProxyAddresses[networkName];
  //   try {
  //     geniusDiamond.grantRole(NFTProxyRole, proxyAddress, { gasLimit: 600000 });
  //   } catch (e) {
  //     debuglog(`Warning, couldn't grant proxy role for ${networkName} OpenSea NFT contract at ${proxyAddress}\n${e}`);
  //   }
  // }
}
