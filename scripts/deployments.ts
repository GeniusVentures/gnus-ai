
import { INetworkDeployInfo } from "../scripts/common";
export const deployments: { [key: string]: INetworkDeployInfo } = {
  mumbai: {
    DiamondAddress: '0x127e47aba094a9a87d084a3a93732909ff031419',
    DeployerAddress: '0x55f36651B5B61B8286305740fA86AD996FC8bDc9',
    FacetDeployedInfo: {
      DiamondCutFacet: {
        address: '0xE30526ba2128f8cc4D05b013c65a623478b2AD80',
        tx_hash: '0xc12af3bbcdd0add0a96e5552f55c2859cd6d28da5cb9e0cbf09cbcc19ec80d34',
        verified: true,
        funcSelectors: [ '0x1f931c1c' ]
      },
      DiamondLoupeFacet: {
        address: '0x25b3f982924f6d31eb8354a414C929D6107aFB8a',
        tx_hash: '0xa3dcebf4e477d99a6e178d79898f938f7182542eab897fb9740081378b073843',
        verified: true,
        funcSelectors: [
          '0xcdffacc6',
          '0x52ef6b2c',
          '0xadfca15e',
          '0x7a0ed627',
          '0x01ffc9a7'
        ]
      },
      OwnershipFacet: {
        address: '0xf95EB593dDd7806beCC4419bD67371244187EA05',
        tx_hash: '0xcdc7b4725a816920846be757a7c12e7f16af4f8c2ad09e7ade4309e0e0c5ac54',
        verified: true,
        funcSelectors: [ '0x8da5cb5b', '0xf2fde38b' ]
      },
      GNUSNFTFactory: {
        address: '0xad36d09B567FD6eC5B580804902A728F074F6df4',
        tx_hash: '0x8f9a041126ea8a1ca0025a8cdf99d2de4f7d8d9d530989b79c0a8321f55d3926',
        verified: true,
        funcSelectors: [
          '0xa217fddf', '0x101521f8', '0x00fdd58e',
          '0x4e1273f4', '0xf5298aca', '0x6b20c454',
          '0xf667ab7c', '0x1a9d2360', '0x4f558e79',
          '0xd188929f', '0x248a9ca3', '0x9010d07c',
          '0xca15c873', '0x2f2ff15d', '0x91d14854',
          '0x731133e9', '0x1f7fdffa', '0x8456cb59',
          '0x5c975abb', '0x36568abe', '0xd547741f',
          '0x2eb2c2d6', '0xf242432a', '0xa22cb465',
          '0x02fe5305', '0x862440e2', '0xbd85b039',
          '0x3f4ba83a', '0x0e89341c'
        ]
      },
      PolyGNUSBridge: {
        address: '0x611449746E13035471B90901d9Fb08abd0707346',
        tx_hash: '0x4ab288bfe1dd9021c02fa1c355ce2ee8c554395b91a7054dfdf870cd439598b3',
        verified: true,
        funcSelectors: [
          '0xe48bf15b',
          '0x8aedbf63',
          '0x47e7ef24',
          '0x2e1a7d4d',
          '0x441a3e70'
        ]
      },
      EscrowAIJob: {
        address: '0xcEddE1968e33DC8F182e94EEE8738436867dd65A',
        tx_hash: '0xd7ef0068146e760746f1e33adadf6f0dace67ad5bc97fbfbea96386f2c258451',
        verified: true,
        funcSelectors: [
          '0x0dbc00c7',
          '0xf340fa01',
          '0xe3a9db1a',
          '0x8129fc1c',
          '0x715018a6',
          '0x51cff8d9',
          '0x685ca194'
        ]
      },
      GeniusAI: {
        address: '0xD3745fecBF088da6214CC472aa2Fd629f76eCb1B',
        tx_hash: '0x41dcbe94fa8498976ccb59fd37bbef5b26461c267c0a7a5f23f1d430f08f91a8',
        verified: true,
        funcSelectors: [ '0x6ea9fd36', '0x31d6388d' ]
      },
      GNUSNFTCollectionName: {
        address: '0x3B24ae057bE4fD492247714d903e3ec0ab0c4cf3',
        tx_hash: '0x8d0be3ba87894e7047cbc3cf7ce2a75718d7b90a1fe4faa1ddb001e6a96c3314',
        verified: true,
        funcSelectors: [ '0x06fdde03' ]
      },
      ERC1155ProxyOperator: {
        address: '0x39239e3aA10A223110B404AB8E3FEe9802868309',
        tx_hash: '',
        funcSelectors: [ '0xe985e9c5', '0x2693ebf2', '0xcd53d08e' ]
      }
    }
  },
  localhost: {
    DiamondAddress: '0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1',
    DeployerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    FacetDeployedInfo: {
      DiamondCutFacet: {
        address: '0x59b670e9fA9D0A427751Af201D676719a970857b',
        tx_hash: '0xcc8388def533f3e4ca955ecb05cf63b93f4fc9c00ac8de0c4daa2631843cd469',
        funcSelectors: [ '0x1f931c1c' ]
      },
      DiamondLoupeFacet: {
        address: '0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44',
        tx_hash: '0x2df30d5c2ef1e8077c4c1aa8856459585c554aeb16f1d8763f4d0b0725789fe5',
        funcSelectors: [
          '0xcdffacc6',
          '0x52ef6b2c',
          '0xadfca15e',
          '0x7a0ed627',
          '0x01ffc9a7'
        ]
      },
      OwnershipFacet: {
        address: '0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f',
        tx_hash: '0xd74d8410d75303134a73b551fd92b07358cac878425ace48524bda60345c21cb',
        funcSelectors: [ '0x8da5cb5b', '0xf2fde38b' ]
      },
      GNUSNFTFactory: {
        address: '0x4A679253410272dd5232B3Ff7cF5dbB88f295319',
        tx_hash: '0xd6d3cb4af78da801dd6582cb8c794edb630a22f5a491fdd5fdfe02b412d9c5ae',
        funcSelectors: [
          '0xa217fddf', '0x101521f8', '0x00fdd58e',
          '0x4e1273f4', '0xf5298aca', '0x6b20c454',
          '0xf667ab7c', '0x1a9d2360', '0x4f558e79',
          '0xd188929f', '0x248a9ca3', '0x9010d07c',
          '0xca15c873', '0x2f2ff15d', '0x91d14854',
          '0xe985e9c5', '0x731133e9', '0x1f7fdffa',
          '0x8456cb59', '0x5c975abb', '0x36568abe',
          '0xd547741f', '0x2eb2c2d6', '0xf242432a',
          '0xa22cb465', '0x02fe5305', '0x862440e2',
          '0xbd85b039', '0x3f4ba83a', '0x0e89341c'
        ]
      },
      PolyGNUSBridge: {
        address: '0x7a2088a1bFc9d81c55368AE168C2C02570cB814F',
        tx_hash: '0x7608bfb69b1c97c6bd4a2aed7bd0e0bd5f8a5036012cf633216753cc42a9114f',
        funcSelectors: [
          '0xe48bf15b',
          '0x8aedbf63',
          '0x47e7ef24',
          '0x2e1a7d4d',
          '0x441a3e70'
        ]
      },
      EscrowAIJob: {
        address: '0x09635F643e140090A9A8Dcd712eD6285858ceBef',
        tx_hash: '0x5e8ce89a1c9d8be41d1cfc33377f8e28829d06f008e26134fa9eb61b433f3106',
        funcSelectors: [
          '0x0dbc00c7',
          '0xf340fa01',
          '0xe3a9db1a',
          '0x8129fc1c',
          '0x715018a6',
          '0x51cff8d9',
          '0x685ca194'
        ]
      },
      GeniusAI: {
        address: '0xc5a5C42992dECbae36851359345FE25997F5C42d',
        tx_hash: '0x1fd6730c35bb9515c8c875f560de7dc084893d65914070575162db837be9a929',
        funcSelectors: [ '0x6ea9fd36', '0x31d6388d' ]
      },
      GNUSNFTCollectionName: {
        address: '0x67d269191c92Caf3cD7723F116c85e6E9bf55933',
        tx_hash: '0x9541611bd7a9c3d016cc2bcd61304e85be76f14a4249225b772e2e6c509eb696',
        funcSelectors: [ '0x06fdde03' ]
      },
      ERC1155ProxyOperator: {
        address: '0x4C4a2f8c81640e47606d3fd77B353E87Ba015584',
        tx_hash: '0x6bf2f6a177640a0ee04e97e388be1afefed332621437eac60b17bb0985d85f53'
      }
    }
  }
};
