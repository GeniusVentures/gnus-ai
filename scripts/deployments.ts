
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
          '0x02fe5305', '0x862440e2', '0x3f4ba83a',
          '0x0e89341c'
        ]
      },
      PolyGNUSBridge: {
        address: '0x3c3598FBcECE8d28bea1bf7969403183B8ecD4BA',
        tx_hash: '0x8f7d5d3b2d0de715a20df71be1b03c0f62492f0501ce69882f33cbc29b483ab7',
        version: 1,
        funcSelectors: [
          '0xe48bf15b', '0x8aedbf63',
          '0x30364234', '0xdd62ed3e',
          '0x095ea7b3', '0x70a08231',
          '0x313ce567', '0xa457c2d7',
          '0x47e7ef24', '0x39509351',
          '0x06fdde03', '0x95d89b41',
          '0x18160ddd', '0xa9059cbb',
          '0x23b872dd', '0x2e1a7d4d',
          '0x441a3e70'
        ],
        verified: true
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
        funcSelectors: []
      },
      ERC1155ProxyOperator: {
        address: '0x5c09695A166Af9596ceC43D0cb2De59A75bBFFb9',
        tx_hash: '0xb1a477d5ecf6ad7ac297597fb0e0388e9a1f3b671f4911ea5977933e28dc9f1f',
        version: 0,
        funcSelectors: [ '0xe985e9c5', '0xbd85b039', '0xcd53d08e' ],
        verified: true
      }
    }
  },
  polygon: {
    DiamondAddress: '0x127e47aba094a9a87d084a3a93732909ff031419',
    DeployerAddress: '0x55f36651B5B61B8286305740fA86AD996FC8bDc9',
    FacetDeployedInfo: {
      DiamondCutFacet: {
        address: '0xe30526ba2128f8cc4d05b013c65a623478b2ad80',
        tx_hash: '0x4153cc3bb95bfde6bd21482b2ac9b31e1e830c2106378e3a281314fe515aec40',
        funcSelectors: [ '0x1f931c1c' ],
        version: 0,
        verified: true
      },
      DiamondLoupeFacet: {
        address: '0x60d14bf965f3ea6392845183cd73304f4de6acbf',
        tx_hash: '0xdcf051c3f8f75bdece01fef0e5bf4d297c069382ed6447bed5057afd2e177bb9',
        verified: true,
        funcSelectors: [
          '0xcdffacc6',
          '0x52ef6b2c',
          '0xadfca15e',
          '0x7a0ed627',
          '0x01ffc9a7'
        ],
        version: 0
      },
      OwnershipFacet: {
        address: '0x7772723409a5c36fca74a0ad71e06214bdb09f5f',
        tx_hash: '0x6cbab5d9c70f673f37a961e45398f3fc152bc96b571b1295733c15a37e603a25',
        verified: true,
        funcSelectors: [ '0x8da5cb5b', '0xf2fde38b' ],
        version: 0
      },
      GNUSNFTFactory: {
        address: '0x7B83Cdb777AB471529aB4Ef1e81718dF453B4273',
        tx_hash: '0x02ee5c045b4c57ffb83bc3a40fce5c38d249032ac76230a27ae4fdd2adb76037',
        verified: true,
        version: 0,
        funcSelectors: [
          '0x8aeda25a', '0x101521f8',
          '0x00fdd58e', '0x4e1273f4',
          '0xf5298aca', '0x6b20c454',
          '0xf667ab7c', '0x1a9d2360',
          '0x4f558e79', '0xd188929f',
          '0x731133e9', '0x1f7fdffa',
          '0x8456cb59', '0x5c975abb',
          '0x2eb2c2d6', '0xf242432a',
          '0xa22cb465', '0x02fe5305',
          '0x862440e2', '0x3f4ba83a',
          '0x0e89341c'
        ]
      },
      PolyGNUSBridge: {
        address: '0x2f9303d1a6467b17A958b25417Ea219624a1d65C',
        tx_hash: '0xdbae59da8b93443eab11b2c1f8b2c6e0449d5756b0476612dd9269f4b70f9709',
        version: 1.1,
        funcSelectors: [
          '0xe48bf15b', '0x8aedbf63',
          '0x30364234', '0xdd62ed3e',
          '0x095ea7b3', '0x70a08231',
          '0x313ce567', '0xa457c2d7',
          '0x47e7ef24', '0x39509351',
          '0x06fdde03', '0x95d89b41',
          '0x18160ddd', '0xa9059cbb',
          '0x23b872dd', '0x2e1a7d4d',
          '0x441a3e70'
        ],
        verified: true
      },
      EscrowAIJob: {
        address: '0x1F1b7f3415011306B0859212923447f346a3ca8c',
        tx_hash: '0xdb8ff610e4df9cd80477f90bdc87926e3f1fa4b7042a3b5b7f809b6928252ba0',
        verified: true,
        version: 0,
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
        address: '0x25b3f982924f6d31eb8354a414C929D6107aFB8a',
        tx_hash: '0x50c5a94481fb301aaad06730e93e2a0862618b11ad9e24baf0f971f27859cc7a',
        verified: true,
        version: 0,
        funcSelectors: [ '0x6ea9fd36', '0x31d6388d' ]
      },
      GNUSNFTCollectionName: {
        address: '0xf95EB593dDd7806beCC4419bD67371244187EA05',
        tx_hash: '0xda7d8a1baa6ebb43ff66b3c3d2cb8709555f6aa9414155307253471c27795bc2',
        verified: true,
        funcSelectors: []
      },
      ERC1155ProxyOperator: {
        address: '0xb51c35507b2087471c90d493ca95c31fcfe0b8d8',
        tx_hash: '0x9c2f38ac02a1736334cb3210a1df477f85584728369e6a3212844db9af0a44ae',
        verified: true,
        version: 0,
        funcSelectors: [ '0xe985e9c5', '0xbd85b039', '0xcd53d08e', '0xa2dd2453' ]
      },
      GeniusOwnershipFacet: {
        address: '0x2765a3b1367EcAE882A427E9a188832934F6aD46',
        tx_hash: '0x1aded1efa82e1b95793c48369e2a7616a39b864069f7cd65c77bf9069a3e1e8b',
        version: 0,
        funcSelectors: [
          '0xa217fddf', '0xf72c0d8b',
          '0x248a9ca3', '0x9010d07c',
          '0xca15c873', '0x2f2ff15d',
          '0x91d14854', '0x8da5cb5b',
          '0x36568abe', '0xd547741f',
          '0xf2fde38b'
        ],
        verified: true
      },
      ERC20TransferBatch: {
        address: '0x9FBF65a9306Ef953967bd0b40dA58BB6B8cCb77D',
        tx_hash: '0xb9a7295fed4db2b8ecf50a4476f4547e95f5a541419a41301e940f94d41b96a2',
        version: 0,
        funcSelectors: [ '0x7c88e3d9', '0x3b3e672f', '0x1bdc02ba' ],
        verified: true
      }
    }
  },
  local: {
    DiamondAddress: '0x127e47aba094a9a87d084a3a93732909ff031419',
    DeployerAddress: '0x55f36651B5B61B8286305740fA86AD996FC8bDc9',
    FacetDeployedInfo: {
      DiamondCutFacet: {
        address: '0xe30526ba2128f8cc4d05b013c65a623478b2ad80',
        tx_hash: '0x4153cc3bb95bfde6bd21482b2ac9b31e1e830c2106378e3a281314fe515aec40',
        funcSelectors: [ '0x1f931c1c' ],
        version: 0,
        verified: true
      },
      DiamondLoupeFacet: {
        address: '0x60d14bf965f3ea6392845183cd73304f4de6acbf',
        tx_hash: '0xdcf051c3f8f75bdece01fef0e5bf4d297c069382ed6447bed5057afd2e177bb9',
        verified: true,
        funcSelectors: [
          '0xcdffacc6',
          '0x52ef6b2c',
          '0xadfca15e',
          '0x7a0ed627',
          '0x01ffc9a7'
        ],
        version: 0
      },
      OwnershipFacet: {
        address: '0x7772723409a5c36fca74a0ad71e06214bdb09f5f',
        tx_hash: '0x6cbab5d9c70f673f37a961e45398f3fc152bc96b571b1295733c15a37e603a25',
        verified: true,
        funcSelectors: [ '0x8da5cb5b', '0xf2fde38b' ],
        version: 0
      },
      GNUSNFTFactory: {
        address: '0x7B83Cdb777AB471529aB4Ef1e81718dF453B4273',
        tx_hash: '0x02ee5c045b4c57ffb83bc3a40fce5c38d249032ac76230a27ae4fdd2adb76037',
        verified: true,
        version: 0,
        funcSelectors: [
          '0x8aeda25a', '0xa217fddf', '0x101521f8',
          '0xf72c0d8b', '0x00fdd58e', '0x4e1273f4',
          '0xf5298aca', '0x6b20c454', '0xf667ab7c',
          '0x1a9d2360', '0x4f558e79', '0xd188929f',
          '0x248a9ca3', '0x9010d07c', '0xca15c873',
          '0x2f2ff15d', '0x91d14854', '0x731133e9',
          '0x1f7fdffa', '0x8456cb59', '0x5c975abb',
          '0x36568abe', '0xd547741f', '0x2eb2c2d6',
          '0xf242432a', '0xa22cb465', '0x02fe5305',
          '0x862440e2', '0x3f4ba83a', '0x0e89341c'
        ]
      },
      PolyGNUSBridge: {
        address: '0x2f9303d1a6467b17A958b25417Ea219624a1d65C',
        tx_hash: '0xdbae59da8b93443eab11b2c1f8b2c6e0449d5756b0476612dd9269f4b70f9709',
        version: 1.1,
        funcSelectors: [
          '0xe48bf15b', '0x8aedbf63',
          '0x30364234', '0xdd62ed3e',
          '0x095ea7b3', '0x70a08231',
          '0x313ce567', '0xa457c2d7',
          '0x47e7ef24', '0x39509351',
          '0x06fdde03', '0x95d89b41',
          '0x18160ddd', '0xa9059cbb',
          '0x23b872dd', '0x2e1a7d4d',
          '0x441a3e70'
        ],
        verified: true
      },
      EscrowAIJob: {
        address: '0x1F1b7f3415011306B0859212923447f346a3ca8c',
        tx_hash: '0xdb8ff610e4df9cd80477f90bdc87926e3f1fa4b7042a3b5b7f809b6928252ba0',
        verified: true,
        version: 0,
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
        address: '0x25b3f982924f6d31eb8354a414C929D6107aFB8a',
        tx_hash: '0x50c5a94481fb301aaad06730e93e2a0862618b11ad9e24baf0f971f27859cc7a',
        verified: true,
        version: 0,
        funcSelectors: [ '0x6ea9fd36', '0x31d6388d' ]
      },
      GNUSNFTCollectionName: {
        address: '0xf95EB593dDd7806beCC4419bD67371244187EA05',
        tx_hash: '0xda7d8a1baa6ebb43ff66b3c3d2cb8709555f6aa9414155307253471c27795bc2',
        verified: true,
        funcSelectors: []
      },
      ERC1155ProxyOperator: {
        address: '0xb51c35507b2087471c90d493ca95c31fcfe0b8d8',
        tx_hash: '0x9c2f38ac02a1736334cb3210a1df477f85584728369e6a3212844db9af0a44ae',
        verified: true,
        version: 0,
        funcSelectors: [ '0xe985e9c5', '0xbd85b039', '0xcd53d08e', '0xa2dd2453' ]
      }
    }
  },
  goerli: {
    DiamondAddress: '0xb42cC2B7C89b027362CaD03819366BA8739B04db',
    DeployerAddress: '0xc47E91E0672be2689b30aF2fCFAfd5f83238099b',
    FacetDeployedInfo: {
      DiamondCutFacet: {
        address: '0xCc33F61C2DA3C4B5d9B8623EeEE9a0f628FDEd99',
        tx_hash: '0x4f31f3580d606e00a4942c875fdc28f7a0129590747a786af91bb653f4b3407b',
        version: 0,
        funcSelectors: [ '0x1f931c1c' ],
        verified: true
      },
      DiamondLoupeFacet: {
        address: '0x8B27eDf767c3014EaBd6f28bbaa61f9884406EE3',
        tx_hash: '0xfb6cf2ec1c5804c87e7c127ad5861596d2dcffefdb5d14ad40803485877188a6',
        version: 0,
        funcSelectors: [
          '0xcdffacc6',
          '0x52ef6b2c',
          '0xadfca15e',
          '0x7a0ed627',
          '0x01ffc9a7'
        ],
        verified: true
      },
      OwnershipFacet: {
        address: '0x4dF74a6D5312B8EE1a7c30C3Ff0Fd68719477481',
        tx_hash: '0xae73a778f5e6cb95cf9aa86670c11712e3e3a379610cc6a0ab2a50c34f1c977c',
        version: 0,
        funcSelectors: [ '0x8da5cb5b', '0xf2fde38b' ],
        verified: true
      },
      ERC1155ProxyOperator: {
        address: '0x3812bC27d91212186884163C41A361406cd7E352',
        tx_hash: '0xcf889280b345ee0e29f79efc878c62643844af62810739a5baaaa2a12d5ac64a',
        version: 0,
        funcSelectors: [ '0xe985e9c5', '0xbd85b039', '0xcd53d08e', '0xa2dd2453' ],
        verified: true
      },
      GNUSNFTFactory: {
        address: '0xac39973D002b51dd63BDd12c1918E7b79145C3A9',
        tx_hash: '0x507067fc68e714cc3e8af9de2ba129a0d7779d942c08e46181965968f9448116',
        version: 0,
        funcSelectors: [
          '0x8aeda25a', '0xa217fddf', '0x101521f8',
          '0xf72c0d8b', '0x00fdd58e', '0x4e1273f4',
          '0xf5298aca', '0x6b20c454', '0xf667ab7c',
          '0x1a9d2360', '0x4f558e79', '0xd188929f',
          '0x248a9ca3', '0x9010d07c', '0xca15c873',
          '0x2f2ff15d', '0x91d14854', '0x731133e9',
          '0x1f7fdffa', '0x8456cb59', '0x5c975abb',
          '0x36568abe', '0xd547741f', '0x2eb2c2d6',
          '0xf242432a', '0xa22cb465', '0x02fe5305',
          '0x862440e2', '0x3f4ba83a', '0x0e89341c'
        ],
        verified: true
      },
      PolyGNUSBridge: {
        address: '0xeC5Ea0ce62215a210E1D235F077763576eaEEC18',
        tx_hash: '0x51df2fa4e7811d71aa3f29bc070aefe125f04862b0fbc482389e58a9177bc2d3',
        version: 1.1,
        funcSelectors: [
          '0xe48bf15b', '0x8aedbf63',
          '0x30364234', '0xdd62ed3e',
          '0x095ea7b3', '0x70a08231',
          '0x313ce567', '0xa457c2d7',
          '0x47e7ef24', '0x39509351',
          '0x06fdde03', '0x95d89b41',
          '0x18160ddd', '0xa9059cbb',
          '0x23b872dd', '0x2e1a7d4d',
          '0x441a3e70'
        ],
        verified: true
      },
      EscrowAIJob: {
        address: '0x37eD2d0a19AFD10B857b6D5EE132bF40634Fd3DF',
        tx_hash: '0x2b2701959e72c07d3c058354cf7a538627f874660e7758d872542f2fc8f691ec',
        version: 0,
        funcSelectors: [
          '0x0dbc00c7',
          '0xf340fa01',
          '0xe3a9db1a',
          '0x8129fc1c',
          '0x715018a6',
          '0x51cff8d9',
          '0x685ca194'
        ],
        verified: true
      },
      GeniusAI: {
        address: '0x5d0346Fa8F917CF6890F30F427A3047841a054d3',
        tx_hash: '0x4ad6359754a2e05050506c9c7fd203833dd2a7200e52eab6972230c09439e394',
        version: 0,
        funcSelectors: [ '0x6ea9fd36', '0x31d6388d' ],
        verified: true
      },
      GNUSNFTCollectionName: {
        address: '0x6585E0ec659986e2544dd570d452F87E4FCe7056',
        tx_hash: '0xf7ad8ddfa56664693e07a147413c43c4c438c7224bd266db15d2083be079c2fe',
        version: -1,
        verified: true
      },
      ERC20TransferBatch: {
        address: '0xB3a1fE131484374DD1ab2957fE66A7e2880d4c0e',
        tx_hash: '0xb967866bb8ae702588196e9de858bae6c87aa6f99f83ad6035e9a6e8b042e5c1',
        version: 0,
        funcSelectors: [ '0x7c88e3d9', '0x3b3e672f', '0x1bdc02ba' ],
        verified: true
      },
      Zether: {
        address: '0x7e842e60b6060323CFB098b8a01a2D2B033325a5',
        tx_hash: '0xddc872bda0e7979db953a2bcec45fc94518c94d9927cdd659ba8e967a3d6ab8b',
        version: 0,
        funcSelectors: [
          '0x77cd6ecd', '0xcfe8a73b',
          '0xced72f87', '0x21df0da7',
          '0x399ae724', '0x9b0d85d3',
          '0xad960d90', '0x0a566f2f',
          '0x79e543d0', '0x601fa93d',
          '0xa257a18d', '0x621f59a4'
        ],
        verified: true
      }
    },
    ExternalLibraries: {
      BurnVerifier: '0x323471F852eE402B79e38f55995871F5ddD48bfa',
      ZetherVerifier: '0x1da67bFbE71C93E165A7D680FD79f16401a327FC',
      libEncryption: '0xaa9BFFC8E0287E7f50e1C54C96F7C367f6D4611d'
    }
  },
  sepolia: {
    DiamondAddress: '0x300AF769B60987dceCE3Eb41BF49EC62c87a11df',
    DeployerAddress: '0xb4377b2850eE7C0b6fD928430481A814A0E0B1A6',
    FacetDeployedInfo: {
      DiamondCutFacet: {
        address: '0x6353e75415b299b5ee3A3848e0467D15Cc0606D7',
        tx_hash: '0x92747dfc1807a629b2efa8551de100b1fb203c9fc41e88f8e7c6ec8542e38c78',
        version: 0,
        funcSelectors: [ '0x1f931c1c' ],
        verified: true
      },
      DiamondLoupeFacet: {
        address: '0xFA16a3D53aC2E37f5368Cb46edD794246128E8e8',
        tx_hash: '0x7d19a79e67fad1d7884543ce36e07a8181508255f15daba01f4594b7f537422c',
        version: 0,
        funcSelectors: [
          '0xcdffacc6',
          '0x52ef6b2c',
          '0xadfca15e',
          '0x7a0ed627',
          '0x01ffc9a7'
        ],
        verified: true
      },
      OwnershipFacet: {
        address: '0x2C98D53187f718c06487e976c6C98C580034e7dD',
        tx_hash: '0xb283e9eb162c85be8efcbaa2ed8084301e44127716c542c4d49f226539ed0db7',
        version: 0,
        funcSelectors: [ '0x8da5cb5b', '0xf2fde38b' ],
        verified: true
      },
      ERC1155ProxyOperator: {
        address: '0x87E72D13FC9533Ec5C7dcAC488E1c5e309de7209',
        tx_hash: '0x38df1056e1215fd2c33624ea950d7b7a35e2322f89d3d07c6213ed0c9142c756',
        version: 0,
        funcSelectors: [ '0xe985e9c5', '0xbd85b039', '0xcd53d08e', '0xa2dd2453' ],
        verified: true
      },
      GNUSNFTFactory: {
        address: '0x900Ef10EE02430625808cf26B2e6A7907ac5c7d2',
        tx_hash: '0x5536bcc142b899f3ee64d5976d67da0815f093d2c8aebe191fedde62b1fc5918',
        version: 0,
        funcSelectors: [
          '0x8aeda25a', '0x101521f8',
          '0x00fdd58e', '0x4e1273f4',
          '0xf5298aca', '0x6b20c454',
          '0xf667ab7c', '0x1a9d2360',
          '0x4f558e79', '0xd188929f',
          '0x731133e9', '0x1f7fdffa',
          '0x8456cb59', '0x5c975abb',
          '0x2eb2c2d6', '0xf242432a',
          '0xa22cb465', '0x02fe5305',
          '0x862440e2', '0x3f4ba83a',
          '0x0e89341c'
        ],
        verified: true
      },
      PolyGNUSBridge: {
        address: '0x6508c0Cb0e60617D33D64f4b60d75d6C6bd171eA',
        tx_hash: '0xc1b3efdd98f2f0c354d59d47efb15c2968e48812d45879aead0995ffe3cb5587',
        version: 1.1,
        funcSelectors: [
          '0xe48bf15b', '0x8aedbf63',
          '0x30364234', '0xdd62ed3e',
          '0x095ea7b3', '0x70a08231',
          '0x313ce567', '0xa457c2d7',
          '0x47e7ef24', '0x39509351',
          '0x06fdde03', '0x95d89b41',
          '0x18160ddd', '0xa9059cbb',
          '0x23b872dd', '0x2e1a7d4d',
          '0x441a3e70'
        ],
        verified: true
      },
      EscrowAIJob: {
        address: '0x2DD796E2fe4Ea091906eE68b5F56774dAeC52177',
        tx_hash: '0xc568843cd081904c921174d954ae4b0d6cfe3ff8859b23b01b33127767a63090',
        version: 0,
        funcSelectors: [
          '0x0dbc00c7',
          '0xf340fa01',
          '0xe3a9db1a',
          '0x8129fc1c',
          '0x715018a6',
          '0x51cff8d9',
          '0x685ca194'
        ],
        verified: true
      },
      GeniusAI: {
        address: '0x897e39ce6A798565E3716C0CeDB39135E6d5e85C',
        tx_hash: '0x57cae8e95b2e5d38028a6c03895a1646233f888e1255b37bf4b59f7f68dd3d92',
        version: 0,
        funcSelectors: [ '0x6ea9fd36', '0x31d6388d' ],
        verified: true
      },
      GNUSNFTCollectionName: {
        address: '0x55bAB2DA8FAeFBa7891655841D38568BEE5Ddcd8',
        tx_hash: '0xb89caf5001591135e317884a2787b3238c81343fce60a11d7394e2d0f8f0bb09',
        version: 0,
        verified: true
      },
      GeniusOwnershipFacet: {
        address: '0x309F168c286deae524Ae062daF0A27d3e99e5591',
        tx_hash: '0xf8b5fe2c32b7910690d21f340bbbfdb854d56610fe7df01c2fa597f4a0f6b28d',
        version: 0,
        funcSelectors: [
          '0xa217fddf', '0xf72c0d8b',
          '0x248a9ca3', '0x9010d07c',
          '0xca15c873', '0x2f2ff15d',
          '0x91d14854', '0x8da5cb5b',
          '0x36568abe', '0xd547741f',
          '0xf2fde38b'
        ],
        verified: true
      },
      ERC20TransferBatch: {
        address: '0xC630a5128F94Ae1fdA4565F2bc6fd0C08dA2c6d1',
        tx_hash: '0x6aa0fae51f264722e8801237aa3c766a72f1e36a7f1d40804a4864d060c2dbb9',
        version: 0,
        funcSelectors: [ '0x7c88e3d9', '0x3b3e672f', '0x1bdc02ba' ],
        verified: true
      },
      Zether: {
        address: '0xDA7eE06e561e9b14B07B1b3901D9761445beE090',
        tx_hash: '0x5460ec8318649aacb25e58c4a2e9850cae5349ed1ac4a4a670f3461b8ca5297a',
        version: 0,
        funcSelectors: [
          '0x77cd6ecd', '0xcfe8a73b',
          '0xced72f87', '0x21df0da7',
          '0x399ae724', '0x9b0d85d3',
          '0xad960d90', '0x0a566f2f',
          '0x79e543d0', '0x601fa93d',
          '0xa257a18d', '0x621f59a4'
        ],
        verified: false
      }
    },
    ExternalLibraries: {
      BurnVerifier: '0x2BB00eB869B91F82098eb7731303A577730d5b04',
      ZetherVerifier: '0x9ffeb4429947aeA278E7699fE060a808D14b802c',
      libEncryption: '0x948e3DA35cFB978a10d6E515c03115aa4bB11172'
    }
  },
  mainnet: {
    DiamondAddress: '0x614577036F0a024DBC1C88BA616b394DD65d105a',
    DeployerAddress: '0x1804dECa63705e18edf04f242b325bCd54a8b463',
    FacetDeployedInfo: {
      DiamondCutFacet: {
        address: '0x2765a3b1367EcAE882A427E9a188832934F6aD46',
        tx_hash: '0xf225d1c56649ffb3cbf64ceeadff6f1a09e751b9cf72a5fc2fe33b967c9073fe',
        version: 0,
        funcSelectors: [ '0x1f931c1c' ],
        verified: true
      },
      DiamondLoupeFacet: {
        address: '0xef83085d338293ee91F5AfF9777551bbF8CF1a72',
        tx_hash: '0x411c94715d072b3f95b3e96d2b9f12decdf6d37d39d62d0d8653a730288bd5d5',
        version: 0,
        funcSelectors: [
          '0xcdffacc6',
          '0x52ef6b2c',
          '0xadfca15e',
          '0x7a0ed627',
          '0x01ffc9a7'
        ],
        verified: true
      },
      GeniusOwnershipFacet: {
        address: '0x9eB08b0A62C0551688b8192d1b1B9bdB2ec05E90',
        tx_hash: '0x550a3a0b9973a212574a04394b703eb09fbaa0d9df2269cf9bc424dc5a08bdea',
        version: 0,
        funcSelectors: [
          '0xa217fddf', '0xf72c0d8b',
          '0x248a9ca3', '0x9010d07c',
          '0xca15c873', '0x2f2ff15d',
          '0x91d14854', '0x8da5cb5b',
          '0x36568abe', '0xd547741f',
          '0xf2fde38b'
        ],
        verified: true
      },
      ERC1155ProxyOperator: {
        address: '0x9FBF65a9306Ef953967bd0b40dA58BB6B8cCb77D',
        tx_hash: '0xfa0f9525f30a180c8a854fa6b7e896382eea4c7cebc65a60380473557eaf2b50',
        version: 0,
        funcSelectors: [ '0xe985e9c5', '0xbd85b039', '0xcd53d08e', '0xa2dd2453' ],
        verified: true
      },
      GNUSNFTFactory: {
        address: '0x85403f882A57D61b4528E5C6FaA39f0D9ee9756C',
        tx_hash: '0x144d5dcb0b417cfca18823e986d99474ae4aeafdac0216fa013c7facd883bc83',
        version: 0,
        funcSelectors: [
          '0x8aeda25a', '0x101521f8',
          '0x00fdd58e', '0x4e1273f4',
          '0xf5298aca', '0x6b20c454',
          '0xf667ab7c', '0x1a9d2360',
          '0x4f558e79', '0xd188929f',
          '0x731133e9', '0x1f7fdffa',
          '0x8456cb59', '0x5c975abb',
          '0x2eb2c2d6', '0xf242432a',
          '0xa22cb465', '0x02fe5305',
          '0x862440e2', '0x3f4ba83a',
          '0x0e89341c'
        ],
        verified: true
      },
      PolyGNUSBridge: {
        address: '0x482c8998d8a2194CDFe92e616dbB906035fdae9E',
        tx_hash: '0x438757fca50358a60b8d549bcbadbb17bef93bca7745467a7786bd4a1b73ee9b',
        version: 1.1,
        funcSelectors: [
          '0xe48bf15b', '0x8aedbf63',
          '0x30364234', '0xdd62ed3e',
          '0x095ea7b3', '0x70a08231',
          '0x313ce567', '0xa457c2d7',
          '0x47e7ef24', '0x39509351',
          '0x06fdde03', '0x95d89b41',
          '0x18160ddd', '0xa9059cbb',
          '0x23b872dd', '0x2e1a7d4d',
          '0x441a3e70'
        ],
        verified: true
      },
      EscrowAIJob: {
        address: '0x303A1Fc237629b65FB723aF3c0A9aC415e46C125',
        tx_hash: '0xd85a7d119507620c3ae703a8881896fba60cb74f32a616e0e98ea79d24af5976',
        version: 0,
        funcSelectors: [
          '0x0dbc00c7',
          '0xf340fa01',
          '0xe3a9db1a',
          '0x8129fc1c',
          '0x715018a6',
          '0x51cff8d9',
          '0x685ca194'
        ],
        verified: true
      },
      GeniusAI: {
        address: '0x807fDd7410129393F517c5ECf57f009071be28Cb',
        tx_hash: '0xd0a4e1431993a05432355f3999af84bc91585b765ce5c60da74ed2c73bf8f149',
        version: 0,
        funcSelectors: [ '0x6ea9fd36', '0x31d6388d' ],
        verified: true
      },
      GNUSNFTCollectionName: {
        address: '0x8Bb02782B10293BD29410240E3781bad41Bdd588',
        tx_hash: '0x8387c61727ea18abc575f8fa507a6b64f62c284e4eb5ec787e5326e3dcdef85f',
        version: 0,
        verified: true
      },
      ERC20TransferBatch: {
        address: '0xC84567fCF259D0287fb632cB046cf47AA5Affee6',
        tx_hash: '0x356e362662022c89c11ebefc876e4e7a502539f98b467997999fb4ae1a05991a',
        version: 0,
        funcSelectors: [ '0x7c88e3d9', '0x3b3e672f', '0x1bdc02ba' ],
        verified: true
      }
    },
    ExternalLibraries: {}
  },
  bsc_mainnet: {
    DiamondAddress: '0x614577036F0a024DBC1C88BA616b394DD65d105a',
    DeployerAddress: '0x1804dECa63705e18edf04f242b325bCd54a8b463',
    FacetDeployedInfo: {
      DiamondCutFacet: {
        address: '0x2765a3b1367EcAE882A427E9a188832934F6aD46',
        tx_hash: '0x06bb3a6b91c94789f370898a1e33d3e4764b48896e4758da20e48a1cfc91ffe3',
        version: 0,
        funcSelectors: [ '0x1f931c1c' ],
        verified: true
      },
      DiamondLoupeFacet: {
        address: '0xef83085d338293ee91F5AfF9777551bbF8CF1a72',
        tx_hash: '0x5e11a9d55e93e5f9cf501e5975f55599b4cf9bd3f647d0259cd369132538270b',
        version: 0,
        funcSelectors: [
          '0xcdffacc6',
          '0x52ef6b2c',
          '0xadfca15e',
          '0x7a0ed627',
          '0x01ffc9a7'
        ],
        verified: true
      },
      GeniusOwnershipFacet: {
        address: '0x9eB08b0A62C0551688b8192d1b1B9bdB2ec05E90',
        tx_hash: '0xb5f85d6babf469183444da198f3cba1a2c00ea0d24ca4997668b01cf073b8e71',
        version: 0,
        funcSelectors: [
          '0xa217fddf', '0xf72c0d8b',
          '0x248a9ca3', '0x9010d07c',
          '0xca15c873', '0x2f2ff15d',
          '0x91d14854', '0x8da5cb5b',
          '0x36568abe', '0xd547741f',
          '0xf2fde38b'
        ],
        verified: true
      },
      ERC1155ProxyOperator: {
        address: '0x9FBF65a9306Ef953967bd0b40dA58BB6B8cCb77D',
        tx_hash: '0x003fbccfd04436d44c4da083df9bc7f87d3d0709cb1b41844529e316e5f6dbb8',
        version: 0,
        funcSelectors: [ '0xe985e9c5', '0xbd85b039', '0xcd53d08e', '0xa2dd2453' ],
        verified: true
      },
      GNUSNFTFactory: {
        address: '0x85403f882A57D61b4528E5C6FaA39f0D9ee9756C',
        tx_hash: '0xf57426e934ac3dae225a9d12e582144c1100e790eddad14e767adc95d2aa5b04',
        version: 0,
        funcSelectors: [
          '0x8aeda25a', '0x101521f8',
          '0x00fdd58e', '0x4e1273f4',
          '0xf5298aca', '0x6b20c454',
          '0xf667ab7c', '0x1a9d2360',
          '0x4f558e79', '0xd188929f',
          '0x731133e9', '0x1f7fdffa',
          '0x8456cb59', '0x5c975abb',
          '0x2eb2c2d6', '0xf242432a',
          '0xa22cb465', '0x02fe5305',
          '0x862440e2', '0x3f4ba83a',
          '0x0e89341c'
        ],
        verified: true
      },
      PolyGNUSBridge: {
        address: '0x482c8998d8a2194CDFe92e616dbB906035fdae9E',
        tx_hash: '0x753f187076744948c12a65fa1c78095fc675859ea94436cbd936b2fd69f67fb6',
        version: 1.1,
        funcSelectors: [
          '0xe48bf15b', '0x8aedbf63',
          '0x30364234', '0xdd62ed3e',
          '0x095ea7b3', '0x70a08231',
          '0x313ce567', '0xa457c2d7',
          '0x47e7ef24', '0x39509351',
          '0x06fdde03', '0x95d89b41',
          '0x18160ddd', '0xa9059cbb',
          '0x23b872dd', '0x2e1a7d4d',
          '0x441a3e70'
        ],
        verified: true
      },
      EscrowAIJob: {
        address: '0x303A1Fc237629b65FB723aF3c0A9aC415e46C125',
        tx_hash: '0x654f53bec0a57ce54fe525cbad293d62b73814d820cbb9e8e2c9c7cbcc2b30e1',
        version: 0,
        funcSelectors: [
          '0x0dbc00c7',
          '0xf340fa01',
          '0xe3a9db1a',
          '0x8129fc1c',
          '0x715018a6',
          '0x51cff8d9',
          '0x685ca194'
        ],
        verified: true
      },
      GeniusAI: {
        address: '0x807fDd7410129393F517c5ECf57f009071be28Cb',
        tx_hash: '0xabfb42bda2f41eb973eb2a54b0fd6f5988e5e75d3149ab5e076c71283bb5f986',
        version: 0,
        funcSelectors: [ '0x6ea9fd36', '0x31d6388d' ],
        verified: true
      },
      GNUSNFTCollectionName: {
        address: '0x8Bb02782B10293BD29410240E3781bad41Bdd588',
        tx_hash: '0xec19223a2b5182768f9bbb2dc9f4158afa6f1644745bc1c7dea70184aafc05e9',
        version: -1,
        verified: true
      },
      ERC20TransferBatch: {
        address: '0xC84567fCF259D0287fb632cB046cf47AA5Affee6',
        tx_hash: '0x99a9fe0dc0f5930bccc04c8514bcdae0f5e476904a6da439e1e930afb8bfdc27',
        version: 0,
        funcSelectors: [ '0x7c88e3d9', '0x3b3e672f', '0x1bdc02ba' ],
        verified: true
      }
    }
  },
  base: {
    DiamondAddress: '0x614577036F0a024DBC1C88BA616b394DD65d105a',
    DeployerAddress: '0x1804dECa63705e18edf04f242b325bCd54a8b463',
    FacetDeployedInfo: {
      DiamondCutFacet: {
        address: '0x2765a3b1367EcAE882A427E9a188832934F6aD46',
        tx_hash: '0x214f827d74b1209282d790b245b150fa3e57d7e78c5bf720064de3167277b58b',
        version: 0,
        funcSelectors: [ '0x1f931c1c' ],
        verified: true
      },
      DiamondLoupeFacet: {
        address: '0xef83085d338293ee91F5AfF9777551bbF8CF1a72',
        tx_hash: '0x8794df5232443d99246d4b84c06fa0fb825084af2b1ce92975190bf1d82913d3',
        version: 0,
        funcSelectors: [
          '0xcdffacc6',
          '0x52ef6b2c',
          '0xadfca15e',
          '0x7a0ed627',
          '0x01ffc9a7'
        ],
        verified: true
      },
      GeniusOwnershipFacet: {
        address: '0x9eB08b0A62C0551688b8192d1b1B9bdB2ec05E90',
        tx_hash: '0xb0e2f2fbfd1d5a978f08521711be74c7f0e802d771307daf890873d8619a8e37',
        version: 0,
        funcSelectors: [
          '0xa217fddf', '0xf72c0d8b',
          '0x248a9ca3', '0x9010d07c',
          '0xca15c873', '0x2f2ff15d',
          '0x91d14854', '0x8da5cb5b',
          '0x36568abe', '0xd547741f',
          '0xf2fde38b'
        ],
        verified: true
      },
      ERC1155ProxyOperator: {
        address: '0x9FBF65a9306Ef953967bd0b40dA58BB6B8cCb77D',
        tx_hash: '0x523a9dcd145d8f480c6c0fb303b6d058413b7f096e5ff7c10db2df3c7966d3cc',
        version: 0,
        funcSelectors: [ '0xe985e9c5', '0xbd85b039', '0xcd53d08e', '0xa2dd2453' ],
        verified: true
      },
      GNUSNFTFactory: {
        address: '0x85403f882A57D61b4528E5C6FaA39f0D9ee9756C',
        tx_hash: '0x31e12d12336ae0c520e35491476001c0dc333c6e680107396664755865da7e1e',
        version: 0,
        funcSelectors: [
          '0x8aeda25a', '0x101521f8',
          '0x00fdd58e', '0x4e1273f4',
          '0xf5298aca', '0x6b20c454',
          '0xf667ab7c', '0x1a9d2360',
          '0x4f558e79', '0xd188929f',
          '0x731133e9', '0x1f7fdffa',
          '0x8456cb59', '0x5c975abb',
          '0x2eb2c2d6', '0xf242432a',
          '0xa22cb465', '0x02fe5305',
          '0x862440e2', '0x3f4ba83a',
          '0x0e89341c'
        ],
        verified: true
      },
      PolyGNUSBridge: {
        address: '0x482c8998d8a2194CDFe92e616dbB906035fdae9E',
        tx_hash: '0x61dd30a20c021550606aae301009e524bf8e86f20180382106455a7415a03bc3',
        version: 1.1,
        funcSelectors: [
          '0xe48bf15b', '0x8aedbf63',
          '0x30364234', '0xdd62ed3e',
          '0x095ea7b3', '0x70a08231',
          '0x313ce567', '0xa457c2d7',
          '0x47e7ef24', '0x39509351',
          '0x06fdde03', '0x95d89b41',
          '0x18160ddd', '0xa9059cbb',
          '0x23b872dd', '0x2e1a7d4d',
          '0x441a3e70'
        ],
        verified: true
      },
      EscrowAIJob: {
        address: '0x303A1Fc237629b65FB723aF3c0A9aC415e46C125',
        tx_hash: '0x6f28b87c660e4b7c61aa3366ec02ea7586c08b917f589ed3b080b919ad0f7da7',
        version: 0,
        funcSelectors: [
          '0x0dbc00c7',
          '0xf340fa01',
          '0xe3a9db1a',
          '0x8129fc1c',
          '0x715018a6',
          '0x51cff8d9',
          '0x685ca194'
        ],
        verified: true
      },
      GeniusAI: {
        address: '0x807fDd7410129393F517c5ECf57f009071be28Cb',
        tx_hash: '0x3e242377511e4716ef49cf8ef1769517206f59ebd8d5242783943613c6f1e05f',
        version: 0,
        funcSelectors: [ '0x6ea9fd36', '0x31d6388d' ],
        verified: true
      },
      GNUSNFTCollectionName: {
        address: '0x8Bb02782B10293BD29410240E3781bad41Bdd588',
        tx_hash: '0x9aead2bcac04c37ccf61b2cca3991014bf62987f265d80b58c20a79612020b8c',
        version: -1,
        verified: true
      },
      ERC20TransferBatch: {
        address: '0xC84567fCF259D0287fb632cB046cf47AA5Affee6',
        tx_hash: '0x9b455a08a1d5bc3fb858b12f946c03cd411aeda6258eab5c74ac27601aac82a6',
        version: 0,
        funcSelectors: [ '0x7c88e3d9', '0x3b3e672f', '0x1bdc02ba' ],
        verified: true
      }
    }
  }
};
