
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
      GNUSNFTFactory: {
        address: '0xC84567fCF259D0287fb632cB046cf47AA5Affee6',
        tx_hash: '0x985ca59ff1df8bd2ffddfdea2f1dfd238da323a28e990e466d20f63c055829e3',
        verified: true,
        version: 2,
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
        address: '0x70302da5ed34ec4047b13fA43D720E52571E73CD',
        tx_hash: '0x71266cee18ab90fa16bd1e9207e1b38e42616703997fa7e23706d9ce18dae6b4',
        version: 2,
        funcSelectors: [ '0x7c88e3d9', '0x3b3e672f', '0x1bdc02ba' ],
        verified: true
      },
      GNUSBridge: {
        address: '0xeCAaBA2DbBB9F9fF1a4541881AEF271c8FC42D0a',
        tx_hash: '0x3563e63a745def0dc3751b62e5ebdea6c1e31d96d218f6bd1aea9f0d0f40d8a7',
        version: 2.2,
        funcSelectors: [
          '0x179a4a53', '0xd5391393',
          '0xdd62ed3e', '0x095ea7b3',
          '0x70a08231', '0x9dc29fac',
          '0x313ce567', '0xa457c2d7',
          '0x39509351', '0x40c10f19',
          '0x06fdde03', '0x95d89b41',
          '0x18160ddd', '0xa9059cbb',
          '0x23b872dd', '0x441a3e70'
        ],
        verified: true
      },
      GNUSControl: {
        address: '0x19fd60e6e3Bf3F1191A3E78B69F1bC125BC5B257',
        tx_hash: '0xf5d4da37b2e0744a60cacc8bde85306cb7774d4321a00604d4dcb49930499dc5',
        version: 0,
        funcSelectors: [
          '0x9e8e7134',
          '0x9ceb1593',
          '0x19a8b28a',
          '0x1307a4be',
          '0x93420cf4',
          '0x5a1c0366'
        ],
        verified: true
      }
    },
    ExternalLibraries: {}
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
      ERC1155ProxyOperator: {
        address: '0x87E72D13FC9533Ec5C7dcAC488E1c5e309de7209',
        tx_hash: '0x38df1056e1215fd2c33624ea950d7b7a35e2322f89d3d07c6213ed0c9142c756',
        version: 0,
        funcSelectors: [ '0xe985e9c5', '0xbd85b039', '0xcd53d08e', '0xa2dd2453' ],
        verified: true
      },
      GNUSNFTFactory: {
        address: '0x995a8eC2790AAeFb5375A6690CecfAb0c9674534',
        tx_hash: '0xa9407fba31d8126aefeafe5ab9d1cefbb31c4b171eac9435dc94800930b414b9',
        version: 2,
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
        address: '0xFf68733Ab12e4998f2FD87eB330caf9628b04589',
        tx_hash: '0x93f3577a85bd9b81a05e0db42c64bf1f7e17ca9b207f157dc7847eef4750e21e',
        version: 2,
        funcSelectors: [ '0x7c88e3d9', '0x3b3e672f', '0x1bdc02ba' ],
        verified: true
      },
      GNUSBridge: {
        address: '0xC93F28101af566e357fE44aba630AEA1bA86Aff7',
        tx_hash: '0xcb34b4f2593121bec08abb0af46c20e9362027eb055d284fa2071082f414a073',
        version: 2.2,
        funcSelectors: [
          '0x5e3e0c59', '0xd5391393',
          '0xdd62ed3e', '0x095ea7b3',
          '0x70a08231', '0x9dc29fac',
          '0x313ce567', '0xa457c2d7',
          '0x39509351', '0x40c10f19',
          '0x06fdde03', '0x95d89b41',
          '0x18160ddd', '0xa9059cbb',
          '0x23b872dd', '0x441a3e70'
        ],
        verified: true
      },
      GNUSControl: {
        address: '0xd3a13800db6397Fd537AAE3ff9Ae94baF7DfEb7C',
        tx_hash: '0x9d29c47fcc2c01927caf4c8b2e48706e354bd831b81c383c20963a8a2dabe7fb',
        version: 0,
        funcSelectors: [
          '0x9e8e7134',
          '0x9ceb1593',
          '0x19a8b28a',
          '0x1307a4be',
          '0x5a1c0366'
        ],
        verified: true
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
        address: '0x0f0282167dB481A24A5c14B6C3A6d164B2bf3bB4',
        tx_hash: '0x9209f8f6f4ba2e5c22006f5c778e0489b3f9b767d578601f052e355208f4220e',
        version: 2,
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
        address: '0x48a1831a8F4F701C26C0F72B1B7FA68aA3AE4731',
        tx_hash: '0xf394be658114b477ae85b20db9590366326b87cc5b91edd8622f11c19319cc1a',
        version: 2,
        funcSelectors: [ '0x7c88e3d9', '0x3b3e672f', '0x1bdc02ba' ],
        verified: true
      },
      GNUSBridge: {
        address: '0x0B81898d67481574F86c0E09ce22d1264623E28C',
        tx_hash: '0x7170b2c764a00e6c415722979410c86ddf20d8be138213eb1b050b6bf3410ad2',
        version: 2.2,
        funcSelectors: [
          '0x179a4a53', '0xd5391393',
          '0xdd62ed3e', '0x095ea7b3',
          '0x70a08231', '0x9dc29fac',
          '0x313ce567', '0xa457c2d7',
          '0x39509351', '0x40c10f19',
          '0x06fdde03', '0x95d89b41',
          '0x18160ddd', '0xa9059cbb',
          '0x23b872dd', '0x441a3e70'
        ],
        verified: true
      },
      GNUSControl: {
        address: '0xC6FDeAEc9aAc1F5D0F21E0115B122867e0706e06',
        tx_hash: '0xc383e1b7634558fe785e1326c4e5819aa441753673f23742254578c6feff429d',
        version: 0,
        funcSelectors: [
          '0x9e8e7134',
          '0x9ceb1593',
          '0x19a8b28a',
          '0x1307a4be',
          '0x93420cf4',
          '0x5a1c0366'
        ],
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
  arbitrum_sepolia: {
    DiamondAddress: '0xa5DC601F8FEF68da1b62d28f567E0496FB119008',
    DeployerAddress: '0x2A460a4add016324399b703F4BE7be476E31f04B',
    FacetDeployedInfo: {
      DiamondCutFacet: {
        address: '0x23edde9fd0deef44d2c7bacf368363d9b65a3a67',
        tx_hash: '0xed3bc6738c5af4677a563dd24d4186fb0570f8ed2fbedb1ffbf810afab3c6b05',
        version: 0,
        funcSelectors: [ '0x1f931c1c' ],
        verified: true
      },
      DiamondLoupeFacet: {
        address: '0x2BB00eB869B91F82098eb7731303A577730d5b04',
        tx_hash: '0xd55255a6312e6780deb03036fd1646fe5ec38a1c6f1a8291e32bd2699f934c37',
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
        address: '0x9ffeb4429947aeA278E7699fE060a808D14b802c',
        tx_hash: '0x7c09788aa008715126df1caf39963bfc9223ddf9d34e5368609e46568317943c',
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
        address: '0x948e3DA35cFB978a10d6E515c03115aa4bB11172',
        tx_hash: '0xd74bccbc6a7039d43b735662c4a9b491502aa8dd685ca5f9105d6b9c7ae9e24a',
        version: 0,
        funcSelectors: [ '0xe985e9c5', '0xbd85b039', '0xcd53d08e', '0xa2dd2453' ],
        verified: true
      },
      GNUSNFTFactory: {
        address: '0x1723a1A4c18E5c31F0013839846FF519B81eDc7d',
        tx_hash: '0x6f74b6393e044b5a05018204f4cb2b9f9da0e4533ffbbd253548a559a20ff01c',
        version: 2,
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
      EscrowAIJob: {
        address: '0xa9fFbc9E8230265184d0276dE2081fB68D968c9A',
        tx_hash: '0xa574fd57b7b4f652dfac1313412d8640b8ade16793ac691d46cec4e8682b93b6',
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
        address: '0xC630a5128F94Ae1fdA4565F2bc6fd0C08dA2c6d1',
        tx_hash: '0x4ebf1996e668a97d752410815babdf85ac053787af7360890df626f549e249a4',
        version: 0,
        funcSelectors: [ '0x6ea9fd36', '0x31d6388d' ],
        verified: true
      },
      GNUSNFTCollectionName: {
        address: '0xDA7eE06e561e9b14B07B1b3901D9761445beE090',
        tx_hash: '0xa7f0190b97e7dc0f8dd2af477b6a58c369783cd1da6085df5ecac4f0883b31a4',
        version: 0,
        verified: true
      },
      ERC20TransferBatch: {
        address: '0xD19bE541d32Eaf1D837Af30456ee6ABb51618a96',
        tx_hash: '0x6b6446bcaa8231aeeda1297796bca247a32f45cfa0e97b4990c60ade30e00afc',
        version: 2,
        funcSelectors: [ '0x7c88e3d9', '0x3b3e672f', '0x1bdc02ba' ],
        verified: true
      },
      GNUSBridge: {
        address: '0x6BEBf5cD52CdAE579dDA03be6Af6adE1195f8052',
        tx_hash: '0x82bbed4b7546d0e5d1f3fa520e5f699eeeb5a809742ecca97bc2031ee0b13885',
        version: 2.2,
        funcSelectors: [
          '0x5e3e0c59', '0xd5391393',
          '0xdd62ed3e', '0x095ea7b3',
          '0x70a08231', '0x9dc29fac',
          '0x313ce567', '0xa457c2d7',
          '0x39509351', '0x40c10f19',
          '0x06fdde03', '0x95d89b41',
          '0x18160ddd', '0xa9059cbb',
          '0x23b872dd', '0x441a3e70'
        ],
        verified: true
      },
      GNUSControl: {
        address: '0x8f54E78FC629165d936663Cbe5288194106B9BC4',
        tx_hash: '0xe2a95cb5183c6b517736f11f4591931f49d2dc4260b6b0aa388782dc9780b221',
        version: 0,
        funcSelectors: [
          '0x9e8e7134',
          '0x9ceb1593',
          '0x19a8b28a',
          '0x1307a4be',
          '0x5a1c0366'
        ]
      }
    },
    ExternalLibraries: {
      BurnVerifier: '0x265659cBf9faA45Ad186c3431D7FAB39aC36218C',
      ZetherVerifier: '0x6D82F56C298C518f1c309067074E597D095944f9',
      libEncryption: '0xAA014dDeDD78044F984955dD46CD1Ed76c5C7149'
    }
  },
  base_sepolia: {
    DiamondAddress: '0x2bb00eb869b91f82098eb7731303a577730d5b04',
    DeployerAddress: '0x2A460a4add016324399b703F4BE7be476E31f04B',
    FacetDeployedInfo: {
      DiamondCutFacet: {
        address: '0xa5DC601F8FEF68da1b62d28f567E0496FB119008',
        tx_hash: '0x30ac2f95dc34cf29a76ce6ff0d677545e3cca0bf29f100a2a67c3b7f2c5a5e7a',
        version: 0,
        funcSelectors: [ '0x1f931c1c' ],
        verified: true
      },
      DiamondLoupeFacet: {
        address: '0x309F168c286deae524Ae062daF0A27d3e99e5591',
        tx_hash: '0xcdcf65862a4d89ec832e6a2d1be892fbdbcf4010af1e90882b12165cf22061df',
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
        address: '0x75651da9f62fec64e3cdcf8FF0F1dBd9640718A4',
        tx_hash: '0x7a1dfc049990ce7858ba0e0342393f053af43ee182b9850c3befb04b69180b9c',
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
        address: '0xa9fFbc9E8230265184d0276dE2081fB68D968c9A',
        tx_hash: '0xb4d33cc86df0ba423f043f97c45340114282051348b7b300e99bae4269d8b882',
        version: 0,
        funcSelectors: [ '0xe985e9c5', '0xbd85b039', '0xcd53d08e', '0xa2dd2453' ],
        verified: true
      },
      GNUSNFTFactory: {
        address: '0x6BEBf5cD52CdAE579dDA03be6Af6adE1195f8052',
        tx_hash: '0xe79afb865ba9b7970e451762673cb7b73b762bece440d8e06e7fa66a8c4edf79',
        version: 2,
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
      EscrowAIJob: {
        address: '0xD418E420F63bb84C25840F2C5A35d671ceBCEC2c',
        tx_hash: '0x2edbf499c2c2774fceb0294c80332519e97e8a7f45ede5be24dc6a654c730d81',
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
        address: '0xB47Ca768a3A59987BC388C32c8dc54d5ECb4b379',
        tx_hash: '0x4ebf1996e668a97d752410815babdf85ac053787af7360890df626f549e249a4',
        version: 0,
        funcSelectors: [ '0x6ea9fd36', '0x31d6388d' ],
        verified: true
      },
      GNUSNFTCollectionName: {
        address: '0x8729e3028b5E63796224A838E0e6f9EF8b788B04',
        tx_hash: '0xba97b1d96ccaecd743c1ba57e09ecc720b60f6c271911de034546a55e4dfcfe6',
        version: 0,
        verified: true
      },
      ERC20TransferBatch: {
        address: '0x145d02e5a81E2a892EDa063B444a79e126D2Ff8e',
        tx_hash: '0x78d65bb910ea39aa7fddeaa8b79d9f2d5380e9efcb1fcfe791348d7a6295a150',
        version: 2,
        funcSelectors: [ '0x7c88e3d9', '0x3b3e672f', '0x1bdc02ba' ],
        verified: true
      },
      GNUSBridge: {
        address: '0x601e679E9A84a6b49980463975B3df4Aff89a029',
        tx_hash: '0x140a74b559458a239fa170a34efcf1b1584a8e8ad969f7cdf05eadc213e5f5fc',
        version: 2.2,
        funcSelectors: [
          '0x5e3e0c59', '0xd5391393',
          '0xdd62ed3e', '0x095ea7b3',
          '0x70a08231', '0x9dc29fac',
          '0x313ce567', '0xa457c2d7',
          '0x39509351', '0x40c10f19',
          '0x06fdde03', '0x95d89b41',
          '0x18160ddd', '0xa9059cbb',
          '0x23b872dd', '0x441a3e70'
        ],
        verified: true
      },
      GNUSControl: {
        address: '0x35080D98bd003DD12b658120b4F475ff088d5Dfc',
        tx_hash: '0x7b779fa36162023778ea0fb36579c4dc5c2154ac9e8f4a575f0d031331cb9847',
        version: 0,
        funcSelectors: [
          '0x9e8e7134',
          '0x9ceb1593',
          '0x19a8b28a',
          '0x1307a4be',
          '0x5a1c0366'
        ]
      }
    },
    ExternalLibraries: {
      BurnVerifier: '0x4B1430342D1CDEe87c744BD4aAEc6B306Ee39284',
      ZetherVerifier: '0x1723a1A4c18E5c31F0013839846FF519B81eDc7d',
      libEncryption: '0xB93F64E084B100006EF6c501eDC0b275EEeec8D0'
    }
  },
  hardhat: {
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
        address: '0x0f0282167dB481A24A5c14B6C3A6d164B2bf3bB4',
        tx_hash: '0x9209f8f6f4ba2e5c22006f5c778e0489b3f9b767d578601f052e355208f4220e',
        version: 2,
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
      },
      GNUSBridge: {
        address: '0x0B81898d67481574F86c0E09ce22d1264623E28C',
        tx_hash: '0x7170b2c764a00e6c415722979410c86ddf20d8be138213eb1b050b6bf3410ad2',
        version: 2.2,
        funcSelectors: [
          '0x5e3e0c59', '0xd5391393',
          '0xdd62ed3e', '0x095ea7b3',
          '0x70a08231', '0x9dc29fac',
          '0x313ce567', '0xa457c2d7',
          '0x39509351', '0x40c10f19',
          '0x06fdde03', '0x95d89b41',
          '0x18160ddd', '0xa9059cbb',
          '0x23b872dd', '0x441a3e70'
        ],
        verified: true
      }
    },
    ExternalLibraries: {}
  }
};
