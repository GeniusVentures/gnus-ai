
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
      },
      GNUSContractAssets: {
        address: '0xBB25CA9742c98Fd2F647dc5878B362164a918051',
        tx_hash: '0x6d95cc43ee8a626b9eea547124a9a607a5e82b9e3de8f2a1107ecc0508e8ab42',
        version: 0,
        funcSelectors: [ '0x01e33667' ],
        verified: true
      }
    },
    ExternalLibraries: {}
  },
  bsc: {
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
        address: '0x393211cC8e587DC3F446cF9320FcEc23ee350395',
        tx_hash: '0x48f8e4a653b0ea9e579a412a6b0460d4ae121ba02c365a6c028a4dbede548092',
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
        address: '0xE5d92FB546f5782E77B46a00fE20086C6F76D60e',
        tx_hash: '0x772f00ea77caa4b377e4a2a2d244721d62a4eff26068303339d752b2147dfad6',
        version: -1,
        verified: true
      },
      ERC20TransferBatch: {
        address: '0x5908aac3747751BE5c2a1799eB0EAfFA86303bf4',
        tx_hash: '0x4d5db5c1a6e818fb0f9d382d75a53fcd2f729d78f15d61fb5f9c4059f1656ebf',
        version: 2,
        funcSelectors: [ '0x7c88e3d9', '0x3b3e672f', '0x1bdc02ba' ],
        verified: true
      },
      GNUSBridge: {
        address: '0xB1cCbaEA15491E582E8B3dddaE4833c7FbAD6269',
        tx_hash: '0xcb1ab7241fd023c1bbe3e7ee24a9bec104e1c75456db987505150d2bf840f8e8',
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
        address: '0xc8Ad620Bb2a5B11e146E5D3C3679eaB889b43a15',
        tx_hash: '0xb4d0e06767316a29d581be6a9f2f3c2848e0c9faa5f272d3c0dd39cdd47ea1ee',
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
    ExternalLibraries: {
      BurnVerifier: '0x48a1831a8F4F701C26C0F72B1B7FA68aA3AE4731',
      ZetherVerifier: '0xC6FDeAEc9aAc1F5D0F21E0115B122867e0706e06',
      libEncryption: '0xF15096D50Ce6660be5B6F46e10C2137d0131C99C'
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
        address: '0xbd0b0A21B1e9873bc6e2a0e86d02AC3d48b3089b',
        tx_hash: '0xc52678b31229cf7d01decf5698d6894d6516585aeaa41b2baa253b185daddc3f',
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
        address: '0x46e0b90F6B6315346960b38aeeda796A8500B775',
        tx_hash: '0xc6065f434e09caec4e45557744fd8f8bc9bc26f55cd59588079a8df14531b7ff',
        version: -1,
        verified: true
      },
      ERC20TransferBatch: {
        address: '0x320BC456e55F08779147925d97Ed7108d4bf15d7',
        tx_hash: '0x4e36717932e6793979c74f931e2c07b14cb564af51642f8e844aa2eebaa0d86f',
        version: 2,
        funcSelectors: [ '0x7c88e3d9', '0x3b3e672f', '0x1bdc02ba' ],
        verified: true
      },
      GNUSBridge: {
        address: '0x3F1D9424dd35c8F516c0662Fc62EaF46Ca2b9992',
        tx_hash: '0xaff6679ecd76cb9c13cf2f97e1527fc3e9d051a412b949a5491d5c89902d8959',
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
        address: '0x8a8E2EF41867d4c14af1EbCe61e6d6D476E61C99',
        tx_hash: '0xbbd503cd2f36cf2a6190e4d47956daa3febb23e007114083df92fa3d0e039e83',
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
    ExternalLibraries: {
      BurnVerifier: '0x5011dedf9999B035EEa6ff303eb4cDf5585FD3Ac',
      ZetherVerifier: '0x097df55C349C0634156869689A0192b1004bA172',
      libEncryption: '0x2D62C2fB214D9343B8DdECEC963E6Dd7caa19ab6'
    }
  },
  sepolia: {
    DiamondAddress: '0x9af8050220D8C355CA3c6dC00a78B474cd3e3c70',
    DeployerAddress: '0x910bAa33DeB0D614Aa9d80e38b7f0BF87549c2fC',
    FacetDeployedInfo: {
      DiamondCutFacet: {
        address: '0xeC20bDf2f9f77dc37Ee8313f719A3cbCFA0CD1eB',
        tx_hash: '0x52e805ac946f940b5a6471dc996f1305991ab0478e6c7e1aa35a813920fce73c',
        version: 0,
        funcSelectors: [ '0x1f931c1c' ],
        verified: true
      },
      DiamondLoupeFacet: {
        address: '0x948423D1292F693BA0Aa8E394743099765e50b7A',
        tx_hash: '0xfdfd38f4c0e5ad761b4854ed7c0923b8881689c5518b294326472cc16e59f7dd',
        version: 0,
        verified: true,
        funcSelectors: [
          '0xcdffacc6',
          '0x52ef6b2c',
          '0xadfca15e',
          '0x7a0ed627',
          '0x01ffc9a7'
        ]
      },
      GeniusOwnershipFacet: {
        address: '0x55206d3647c045fA28B14C2E1713a8E8a0F465Ff',
        tx_hash: '0x3f68bcce423e3b4c6ceaedf459df4e8bdfb973b3289d27cc452f007305fcaee2',
        version: 0,
        verified: true,
        funcSelectors: [
          '0xa217fddf', '0xf72c0d8b',
          '0x248a9ca3', '0x9010d07c',
          '0xca15c873', '0x2f2ff15d',
          '0x91d14854', '0x8da5cb5b',
          '0x36568abe', '0xd547741f',
          '0xf2fde38b'
        ]
      },
      ERC1155ProxyOperator: {
        address: '0x3ef701015A79Bdf7e101342d5E2a9e430cCF98Be',
        tx_hash: '0xb56fe529ab660b5ff023bed159d5c0e22c58f7af35adefe3b923ee7ab3847325',
        version: 0,
        verified: true,
        funcSelectors: [ '0xe985e9c5', '0xbd85b039', '0xcd53d08e', '0xa2dd2453' ]
      },
      GNUSNFTFactory: {
        address: '0x587C328a1189eC813F13cBaE6e4003a556f17484',
        tx_hash: '0xb24dab0d4293cefa512192e2d2737f784a6030fde4ebec100e6ac98d6d93fc40',
        version: 2,
        verified: true,
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
      GNUSBridge: {
        address: '0xeC764eB165e04efE5C6A01b41805673714F930Ae',
        tx_hash: '0x143b49e11e582a3f674cd0111b6b4558228fe06f6f1d2510a3d3fbf66b7191fe',
        version: 2.2,
        verified: true,
        funcSelectors: [
          '0x179a4a53', '0xd5391393',
          '0xdd62ed3e', '0x095ea7b3',
          '0x70a08231', '0x9dc29fac',
          '0x313ce567', '0xa457c2d7',
          '0x39509351', '0x40c10f19',
          '0x06fdde03', '0x95d89b41',
          '0x18160ddd', '0xa9059cbb',
          '0x23b872dd', '0x441a3e70'
        ]
      },
      EscrowAIJob: {
        address: '0x182b78dDfd52199ec6582EbD2987E0aBe1C1bDF7',
        tx_hash: '0xc692a48f725b7289750083dca9e440c511092f3e7eee38b225c55d11391b5be9',
        version: 0,
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
        address: '0xa7A35Bf2035C35be384532D897C7E8Daf6692F12',
        tx_hash: '0xbe7609e9f8048e10798e6653f2715f895a9939500976a3a97aa5fbab159db78a',
        version: 0,
        verified: true,
        funcSelectors: [ '0x6ea9fd36', '0x31d6388d' ]
      },
      GNUSNFTCollectionName: {
        address: '0x478CC1529358b0cFcB4185E8D963B52468e406e3',
        tx_hash: '0x946a7c6ae7b78f84d3faaf8325bfa542d627ed4fa285e0a0ea57cafc41b065c2',
        version: -1,
        verified: true
      },
      ERC20TransferBatch: {
        address: '0x29Df5345Eb5404EeBEBAD6125C7E43e0baCb816f',
        tx_hash: '0x9e577141c96500db2df5590a33cd67d85fe69f5c8e2ae426181e459ba191b588',
        version: 2,
        verified: true,
        funcSelectors: [ '0x7c88e3d9', '0x3b3e672f', '0x1bdc02ba' ]
      },
      GNUSControl: {
        address: '0xB76042F7edF3Ee7AECc3143cA46A2f357491EBC0',
        tx_hash: '0xbefe438bc6d6adf235947e0f03694d1934ad10ca6cec50e9edf413da4ae5a0c8',
        version: 0,
        verified: true,
        funcSelectors: [
          '0x9e8e7134',
          '0x9ceb1593',
          '0x19a8b28a',
          '0x1307a4be',
          '0x93420cf4',
          '0x5a1c0366'
        ]
      },
      GNUSContractAssets: {
        address: '0x7a37ef45DfeBC2204991DAB26bDe8C8cbCB17ca9',
        tx_hash: '0x5a02cea3b2e71bf045037b1954292cb61383a60d5901da1f7e7c3e4a0684a62d',
        version: 0,
        verified: true,
        funcSelectors: [ '0x01e33667' ]
      }
    }
  },
  base_sepolia: {
    DiamondAddress: '0xeC20bDf2f9f77dc37Ee8313f719A3cbCFA0CD1eB',
    DeployerAddress: '0x910bAa33DeB0D614Aa9d80e38b7f0BF87549c2fC',
    FacetDeployedInfo: {
      DiamondCutFacet: {
        address: '0x5e5443C23Fa2B5A69F6B1A174A2D9E67AbA2117a',
        tx_hash: '0x18c1dfef794115a4a94d75f1c6883b157b52b50bf845585f282387229b7212f9',
        version: 0,
        funcSelectors: [ '0x1f931c1c' ],
        verified: true
      },
      DiamondLoupeFacet: {
        address: '0x9af8050220D8C355CA3c6dC00a78B474cd3e3c70',
        tx_hash: '0xb888fe7231524d50ba17c0d606c861e8cb7ceeee0949f4fceb7fdd14c04777f5',
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
        address: '0x948423D1292F693BA0Aa8E394743099765e50b7A',
        tx_hash: '0x928f74cecf81174b774791e54a047140e83bde6511c9d90648f9c382ebf97bd8',
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
        address: '0x55206d3647c045fA28B14C2E1713a8E8a0F465Ff',
        tx_hash: '0x4e21c388cc295bc9c3c1596495491d61c578dad2d908e2f737995b14fecfba75',
        version: 0,
        funcSelectors: [ '0xe985e9c5', '0xbd85b039', '0xcd53d08e', '0xa2dd2453' ],
        verified: true
      },
      GNUSNFTFactory: {
        address: '0x3ef701015A79Bdf7e101342d5E2a9e430cCF98Be',
        tx_hash: '0x91af2f0f631ccd50599959d6abe92770b2b0e14201345713c88053263c606ed8',
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
      GNUSBridge: {
        address: '0x587C328a1189eC813F13cBaE6e4003a556f17484',
        tx_hash: '0x65b4ccb47a69969055d4ecae02adbdbc1a9933ce6d8feb18128e8766d878a288',
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
      EscrowAIJob: {
        address: '0xeC764eB165e04efE5C6A01b41805673714F930Ae',
        tx_hash: '0x0e3038547660196b4880b226a8b28279d33812e0983905135c84a60305935d03',
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
        address: '0x182b78dDfd52199ec6582EbD2987E0aBe1C1bDF7',
        tx_hash: '0x44d98fd2f819e1100ebcec493aac763c30a33f587f6c889718591b932ae38b46',
        version: 0,
        funcSelectors: [ '0x6ea9fd36', '0x31d6388d' ],
        verified: true
      },
      GNUSNFTCollectionName: {
        address: '0xa7A35Bf2035C35be384532D897C7E8Daf6692F12',
        tx_hash: '0x43c5a065d5988e560bf1b0f3adb6b86c74022087207ec90425252807e5213b29',
        version: -1,
        verified: true
      },
      ERC20TransferBatch: {
        address: '0x34Aa1c9f996BaDC688dF2149F72cC6e6B842575e',
        tx_hash: '0xfce21bc0fd5f9ec7faed6170e4da1f3b5388a5f8bfeca502124e2a67df1254c7',
        version: 2,
        funcSelectors: [ '0x7c88e3d9', '0x3b3e672f', '0x1bdc02ba' ],
        verified: true
      },
      GNUSControl: {
        address: '0x29Df5345Eb5404EeBEBAD6125C7E43e0baCb816f',
        tx_hash: '0xf9f60adae64a8c9bdf4c562bcc7e48c162bdde60d58344db48c95595f4b76f05',
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
      },
      GNUSContractAssets: {
        address: '0xB76042F7edF3Ee7AECc3143cA46A2f357491EBC0',
        tx_hash: '0xa517d1e82264d949c23b84b92b99c74b39863a59d82117b4292954a7357ddd60',
        version: 0,
        funcSelectors: [ '0x01e33667' ],
        verified: true
      }
    }
  },
  bsc_testnet: {
    DiamondAddress: '0xeC20bDf2f9f77dc37Ee8313f719A3cbCFA0CD1eB',
    DeployerAddress: '0x910bAa33DeB0D614Aa9d80e38b7f0BF87549c2fC',
    FacetDeployedInfo: {
      DiamondCutFacet: {
        address: '0x5e5443C23Fa2B5A69F6B1A174A2D9E67AbA2117a',
        tx_hash: '0x1a64f3502f221bdb3453e07cdeeaa00037b8853937d1d9a70d631c1c270815b8',
        version: 0,
        funcSelectors: [ '0x1f931c1c' ],
        verified: true
      },
      DiamondLoupeFacet: {
        address: '0x9af8050220D8C355CA3c6dC00a78B474cd3e3c70',
        tx_hash: '0x88f6d18d7463db121c6924deb7583d60d8557e2bd04c290b168728e23f36c231',
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
        address: '0x948423D1292F693BA0Aa8E394743099765e50b7A',
        tx_hash: '0xe5d78353c9659ad08402155ce50c70cc807f78ef3c11b2f213129f9aed7b1249',
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
        address: '0x55206d3647c045fA28B14C2E1713a8E8a0F465Ff',
        tx_hash: '0xa36804fbdd23cd988572722da585adf2826c3a4865cfd33fa4aac184d76bdbbd',
        version: 0,
        funcSelectors: [ '0xe985e9c5', '0xbd85b039', '0xcd53d08e', '0xa2dd2453' ],
        verified: true
      },
      GNUSNFTFactory: {
        address: '0x3ef701015A79Bdf7e101342d5E2a9e430cCF98Be',
        tx_hash: '0x9011d49a9f5c832ac1605dc6b1b8cad6628583996de0237b87ac8db1a8e751a1',
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
      GNUSBridge: {
        address: '0x587C328a1189eC813F13cBaE6e4003a556f17484',
        tx_hash: '0x5a93c8b94a89a4e49b61fa384568438f1e9c0d80eaf5ca65ca72ab12581488f2',
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
      EscrowAIJob: {
        address: '0xeC764eB165e04efE5C6A01b41805673714F930Ae',
        tx_hash: '0x9f08e40ed16d191dd4359427af4012a8fb287e89d49f4d5df95fd0a1f7cf6909',
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
        address: '0x182b78dDfd52199ec6582EbD2987E0aBe1C1bDF7',
        tx_hash: '0x9a28b58541f01ea67e33d73c987c45799fc007c0de1ba38580ad28e915121e2b',
        version: 0,
        funcSelectors: [ '0x6ea9fd36', '0x31d6388d' ],
        verified: true
      },
      GNUSNFTCollectionName: {
        address: '0xa7A35Bf2035C35be384532D897C7E8Daf6692F12',
        tx_hash: '0x0848baec26570a99a4301ca9a993523815cde99b8b58af621fc14474799edfec',
        version: -1,
        verified: true
      },
      ERC20TransferBatch: {
        address: '0x34Aa1c9f996BaDC688dF2149F72cC6e6B842575e',
        tx_hash: '0xcdbe624ac32d466f7df1c31ee6129cc0e5803d22d8ea1312f6afa4d1387c55e5',
        version: 2,
        funcSelectors: [ '0x7c88e3d9', '0x3b3e672f', '0x1bdc02ba' ],
        verified: true
      },
      GNUSControl: {
        address: '0x29Df5345Eb5404EeBEBAD6125C7E43e0baCb816f',
        tx_hash: '0xde3a42ebd8e7e2c78f7e01007df794c4cbfcb541178ec5dba14f11c3c6a1e9b2',
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
      },
      GNUSContractAssets: {
        address: '0xB76042F7edF3Ee7AECc3143cA46A2f357491EBC0',
        tx_hash: '0xd8158e797faa02d93cd2dfab449742c1e9eb3f7b4ec74748dd992f2bc922c354',
        version: 0,
        funcSelectors: [ '0x01e33667' ],
        verified: true
      }
    }
  },
  polygon_amoy: {
    DiamondAddress: '0xeC20bDf2f9f77dc37Ee8313f719A3cbCFA0CD1eB',
    DeployerAddress: '0x910bAa33DeB0D614Aa9d80e38b7f0BF87549c2fC',
    FacetDeployedInfo: {
      DiamondCutFacet: {
        address: '0x5e5443C23Fa2B5A69F6B1A174A2D9E67AbA2117a',
        tx_hash: '0x102fffa5c9d27a7b94e2acd4a58288590174087cfe192d6602f97ced1ac8bffd',
        version: 0,
        funcSelectors: [ '0x1f931c1c' ],
        verified: true
      },
      DiamondLoupeFacet: {
        address: '0x9af8050220D8C355CA3c6dC00a78B474cd3e3c70',
        tx_hash: '0x262fda123f5eef41d9e9125332db87ce0c0125c4edfe156298935d14288fa6cc',
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
        address: '0x948423D1292F693BA0Aa8E394743099765e50b7A',
        tx_hash: '0xa6d45448df96ea839d017efcad78d1f9256fa8ac791011fc935461548df17c0d',
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
        address: '0x55206d3647c045fA28B14C2E1713a8E8a0F465Ff',
        tx_hash: '0x46cea5ec691d0399d038d90f078dd7821a32d0762742665f0525c0efd5bd2f3e',
        version: 0,
        funcSelectors: [ '0xe985e9c5', '0xbd85b039', '0xcd53d08e', '0xa2dd2453' ],
        verified: true
      },
      GNUSNFTFactory: {
        address: '0x3ef701015A79Bdf7e101342d5E2a9e430cCF98Be',
        tx_hash: '0xd7d88533af831930d06884fc5befdf3c9efbd2c5d66366f70d98c9b5f66e009d',
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
      GNUSBridge: {
        address: '0x587C328a1189eC813F13cBaE6e4003a556f17484',
        tx_hash: '0x8117945f23042a4bc917e0af5f935a1aeec1c72b20ad1b6f2b46a3e2c3c2a7cc',
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
      EscrowAIJob: {
        address: '0xeC764eB165e04efE5C6A01b41805673714F930Ae',
        tx_hash: '0xdc1fedd09064679883109c5293d271e7c454aa2a078df08e4916ff7b8342c29d',
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
        address: '0x182b78dDfd52199ec6582EbD2987E0aBe1C1bDF7',
        tx_hash: '0x68d6352e4bdb1324a7bd051505abbcf5a5741ec8b8354d2b93082a17ef5fc7e0',
        version: 0,
        funcSelectors: [ '0x6ea9fd36', '0x31d6388d' ],
        verified: true
      },
      GNUSNFTCollectionName: {
        address: '0xa7A35Bf2035C35be384532D897C7E8Daf6692F12',
        tx_hash: '0xe0ff346b341441bc1dbc2f45ed3f97c86815ca031ec5aa392ba18b7eec90d0ce',
        version: -1,
        verified: true
      },
      ERC20TransferBatch: {
        address: '0x34Aa1c9f996BaDC688dF2149F72cC6e6B842575e',
        tx_hash: '0x58f4a75b1600703be4458de22e0a989fe6315ff99c287e8ae58458fe3a80b576',
        version: 2,
        funcSelectors: [ '0x7c88e3d9', '0x3b3e672f', '0x1bdc02ba' ],
        verified: true
      },
      GNUSControl: {
        address: '0x29Df5345Eb5404EeBEBAD6125C7E43e0baCb816f',
        tx_hash: '0x3feb7ccac1a5e17e9a52bd33876f4553915e62fe42599cd1d7db1ff6aa50ed1b',
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
      },
      GNUSContractAssets: {
        address: '0xB76042F7edF3Ee7AECc3143cA46A2f357491EBC0',
        tx_hash: '0x40ebf862881e0effeb9f896f23e5e17575a8f1e7c1e02d98f80427f5810548dd',
        version: 0,
        funcSelectors: [ '0x01e33667' ],
        verified: true
      }
    }
  },
  localhost: {
    DiamondAddress: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    DeployerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    FacetDeployedInfo: {
      DiamondCutFacet: {
        address: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
        tx_hash: '0xaa24678246c33b0f335ecbd6db23bef4dc7ae35e38771cc391da78409eb09087',
        version: 0,
        funcSelectors: [ '0x1f931c1c' ]
      },
      DiamondLoupeFacet: {
        address: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
        tx_hash: '0xe5e84ecefdb70318929e6fe3d200b87bb3b9b5f5ab9e24f92de6a9f98cfd540e',
        version: 0,
        funcSelectors: [
          '0xcdffacc6',
          '0x52ef6b2c',
          '0xadfca15e',
          '0x7a0ed627',
          '0x01ffc9a7'
        ]
      },
      GeniusOwnershipFacet: {
        address: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
        tx_hash: '0x917a839b3057380b88d88479d6e0baf983b60864c004be731602faac28e5e70c',
        version: 0,
        funcSelectors: [
          '0xa217fddf', '0xf72c0d8b',
          '0x248a9ca3', '0x9010d07c',
          '0xca15c873', '0x2f2ff15d',
          '0x91d14854', '0x8da5cb5b',
          '0x36568abe', '0xd547741f',
          '0xf2fde38b'
        ]
      },
      GNUSNFTFactory: {
        address: '0x59b670e9fA9D0A427751Af201D676719a970857b',
        tx_hash: '0x3781ba9692a2b6382b612e613f5b8c52c5c0eca264367d5f0ca322f858520110',
        version: 2.3,
        funcSelectors: [
          '0x8aeda25a', '0x101521f8',
          '0x52dbff7a', '0x00fdd58e',
          '0x4e1273f4', '0xf5298aca',
          '0x6b20c454', '0xf667ab7c',
          '0x1a9d2360', '0x4f558e79',
          '0xd188929f', '0xe985e9c5',
          '0x731133e9', '0x1f7fdffa',
          '0x8456cb59', '0x5c975abb',
          '0x2eb2c2d6', '0xf242432a',
          '0xa22cb465', '0x02fe5305',
          '0x862440e2', '0xbd85b039',
          '0x3f4ba83a', '0x0e89341c'
        ]
      },
      ERC1155ProxyOperator: {
        address: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
        tx_hash: '0xa0f52dc5dc44936670123c13648c12408878438e8c9a3b22ef5b5d65667889cc',
        version: 0,
        funcSelectors: [ '0xa2dd2453', '0xcd53d08e' ]
      },
      GeniusAI: {
        address: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
        tx_hash: '0xb51d3b69f9f9cc96bfd175ec56b888ae26b2e341ebd479d4b6f095f3f13377da',
        version: 0,
        funcSelectors: [ '0x6ea9fd36', '0x31d6388d' ]
      },
      GNUSNFTCollectionName: {
        address: '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
        tx_hash: '0xba17502bd6236ab7c8b0ee8fd477f647d1e263bdcc26dc7c09dde383dd174850',
        version: 0,
        funcSelectors: [ '0x06fdde03' ]
      },
      ERC20TransferBatch: {
        address: '0x610178dA211FEF7D417bC0e6FeD39F05609AD788',
        tx_hash: '0xb41987fcfbaf0d6c50621aa9701753111e37edfce3f2a3ea1c4e9f98f058563b',
        version: 2,
        funcSelectors: [ '0x7c88e3d9', '0x3b3e672f', '0x1bdc02ba' ]
      },
      GNUSContractAssets: {
        address: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',
        tx_hash: '0x4e012e45e12f8862c5b0e1b12e7c37e9cd562e654e58dcf7448815fe035ee77d',
        version: 0,
        funcSelectors: [ '0x01e33667' ]
      },
      GNUSBridge: {
        address: '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0',
        tx_hash: '0x646e7c05bcb619957842b0494568c63300b669a7f42046d9f9b26e288612865f',
        version: 2.2,
        funcSelectors: [
          '0xd5391393', '0xdd62ed3e',
          '0x095ea7b3', '0x70a08231',
          '0xe26d65a6', '0x9dc29fac',
          '0x313ce567', '0xa457c2d7',
          '0x39509351', '0x156e29f6',
          '0x40c10f19', '0x95d89b41',
          '0x18160ddd', '0xa9059cbb',
          '0x23b872dd', '0x441a3e70'
        ]
      },
      GNUSControl: {
        address: '0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1',
        tx_hash: '0x0191e76d522c23b658a9ef2b4d998f7b3b7145dc979f8a038bacaecfb724a85d',
        version: 2.3,
        funcSelectors: [
          '0x72f6ac43',
          '0x9e8e7134',
          '0x9ceb1593',
          '0x19a8b28a',
          '0x1307a4be',
          '0x93420cf4',
          '0xed8d47e6',
          '0x5a1c0366'
        ]
      }
    },
    ExternalLibraries: {
      BurnVerifier: '0x68B1D87F95878fE05B998F19b66F4baba5De1aed',
      ZetherVerifier: '0x3Aa5ebB10DC797CAC828524e59A333d0A371443c',
      libEncryption: '0xc6e7DF5E7b4f2A278906862b61205850344D4e7d'
    }
  }
};
