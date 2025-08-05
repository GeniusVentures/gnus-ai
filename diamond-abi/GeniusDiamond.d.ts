
// Auto-generated Diamond ABI interface
// Generated at: 2025-08-05T15:42:15.627Z
// Diamond: GeniusDiamond
// Network: sepolia

export interface GeniusDiamondInterface {
  // Function selectors to facet mapping
  readonly selectorMap: {
    "0x1f931c1c": "DiamondCutFacet";
    "0xcdffacc6": "DiamondLoupeFacet";
    "0x52ef6b2c": "DiamondLoupeFacet";
    "0xadfca15e": "DiamondLoupeFacet";
    "0x7a0ed627": "DiamondLoupeFacet";
    "0x01ffc9a7": "DiamondLoupeFacet";
    "0xa217fddf": "GeniusOwnershipFacet";
    "0xf72c0d8b": "GeniusOwnershipFacet";
    "0x248a9ca3": "GeniusOwnershipFacet";
    "0x9010d07c": "GeniusOwnershipFacet";
    "0xca15c873": "GeniusOwnershipFacet";
    "0x2f2ff15d": "GeniusOwnershipFacet";
    "0x91d14854": "GeniusOwnershipFacet";
    "0x8da5cb5b": "GeniusOwnershipFacet";
    "0x36568abe": "GeniusOwnershipFacet";
    "0xd547741f": "GeniusOwnershipFacet";
    "0xf2fde38b": "GeniusOwnershipFacet";
    "0x8aeda25a": "GNUSNFTFactory";
    "0x101521f8": "GNUSNFTFactory";
    "0x52dbff7a": "GNUSNFTFactory";
    "0x00fdd58e": "GNUSNFTFactory";
    "0x4e1273f4": "GNUSNFTFactory";
    "0xf5298aca": "GNUSNFTFactory";
    "0x6b20c454": "GNUSNFTFactory";
    "0xf667ab7c": "GNUSNFTFactory";
    "0x1a9d2360": "GNUSNFTFactory";
    "0x4f558e79": "GNUSNFTFactory";
    "0xd188929f": "GNUSNFTFactory";
    "0xe985e9c5": "GNUSNFTFactory";
    "0x731133e9": "GNUSNFTFactory";
    "0x1f7fdffa": "GNUSNFTFactory";
    "0x8456cb59": "GNUSNFTFactory";
    "0x5c975abb": "GNUSNFTFactory";
    "0x2eb2c2d6": "GNUSNFTFactory";
    "0xf242432a": "GNUSNFTFactory";
    "0xa22cb465": "GNUSNFTFactory";
    "0x02fe5305": "GNUSNFTFactory";
    "0x862440e2": "GNUSNFTFactory";
    "0xbd85b039": "GNUSNFTFactory";
    "0x3f4ba83a": "GNUSNFTFactory";
    "0x0e89341c": "GNUSNFTFactory";
    "0xa2dd2453": "ERC1155ProxyOperator";
    "0xcd53d08e": "ERC1155ProxyOperator";
    "0xd37b34d7": "GNUSBlacklistFacet";
    "0xc707703e": "GNUSBlacklistFacet";
    "0x4886f62c": "GNUSBlacklistFacet";
    "0x442df1e3": "GNUSBlacklistFacet";
    "0x3dec790e": "GNUSBlacklistFacet";
    "0xa415c02c": "GNUSBlacklistFacet";
    "0xa9d1fd08": "GNUSBlacklistFacet";
    "0xfe575a87": "GNUSBlacklistFacet";
    "0x386679e2": "GNUSBlacklistFacet";
    "0x4c2a11de": "GNUSBlacklistFacet";
    "0x6d7331ed": "GNUSBlacklistFacet";
    "0x897f057a": "GNUSBlacklistFacet";
    "0x50d62a03": "GNUSWhitelistFacet";
    "0xfd4fa05a": "GNUSWhitelistFacet";
    "0x0a8244d2": "GNUSWhitelistFacet";
    "0x2927bacd": "GNUSWhitelistFacet";
    "0x184d69ab": "GNUSWhitelistFacet";
    "0x3af32abf": "GNUSWhitelistFacet";
    "0xed653ef4": "GNUSWhitelistFacet";
    "0x052d9e7e": "GNUSWhitelistFacet";
    "0xae3e3e5e": "GNUSWhitelistFacet";
    "0x170ae053": "GNUSWhitelistFacet";
    "0x63e0c2f8": "GNUSWhitelistFacet";
    "0x33984a97": "GNUSWhitelistFacet";
    "0x6ea9fd36": "GeniusAI";
    "0x31d6388d": "GeniusAI";
    "0x06fdde03": "GNUSNFTCollectionName";
    "0x7c88e3d9": "ERC20TransferBatch";
    "0x3b3e672f": "ERC20TransferBatch";
    "0x1bdc02ba": "ERC20TransferBatch";
    "0x01e33667": "GNUSContractAssets";
    "0x72f6ac43": "GNUSControl";
    "0x9e8e7134": "GNUSControl";
    "0x9ceb1593": "GNUSControl";
    "0x19a8b28a": "GNUSControl";
    "0x1307a4be": "GNUSControl";
    "0x93420cf4": "GNUSControl";
    "0xed8d47e6": "GNUSControl";
    "0xceba5598": "GNUSControl";
    "0x5a1c0366": "GNUSControl";
    "0x5e3e0c59": "GNUSBridge";
    "0xd5391393": "GNUSBridge";
    "0xdd62ed3e": "GNUSBridge";
    "0x095ea7b3": "GNUSBridge";
    "0x70a08231": "GNUSBridge";
    "0xe26d65a6": "GNUSBridge";
    "0x9dc29fac": "GNUSBridge";
    "0x313ce567": "GNUSBridge";
    "0xa457c2d7": "GNUSBridge";
    "0x39509351": "GNUSBridge";
    "0x156e29f6": "GNUSBridge";
    "0x40c10f19": "GNUSBridge";
    "0x95d89b41": "GNUSBridge";
    "0x18160ddd": "GNUSBridge";
    "0xa9059cbb": "GNUSBridge";
    "0x23b872dd": "GNUSBridge";
    "0x441a3e70": "GNUSBridge";
    "0xeae960b1": "DiamondInitFacet";
  };
  
  // Facet addresses
  readonly facetAddresses: string[];
  
  // ABI for ethers.js Contract instantiation
  readonly abi: any[];
}

export const GeniusDiamondABI: GeniusDiamondInterface;
