
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
  localhost: {
    DiamondAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    DeployerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    FacetDeployedInfo: {
      DiamondCutFacet: {
        address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        tx_hash: '0xbb1d07844e92aa78cf66eb6014db1f1ca7d240d733ccf934ef77b95d0775c4be',
        version: 0,
        funcSelectors: [ '0x1f931c1c' ]
      },
      DiamondLoupeFacet: {
        address: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
        tx_hash: '0xec7025683596f9aed47093c20b06f06a03e4c18f154bc3dbfd2f054145e65cd6',
        version: 0,
        funcSelectors: [
          '0xcdffacc6',
          '0x52ef6b2c',
          '0xadfca15e',
          '0x7a0ed627',
          '0x01ffc9a7'
        ]
      },
      OwnershipFacet: {
        address: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
        tx_hash: '0xa56b725eeb1030c4338aa760ca4c17ab76231586cc678c7adaaba925aceabff5',
        version: 0,
        funcSelectors: [ '0x8da5cb5b', '0xf2fde38b' ]
      },
      ERC1155ProxyOperator: {
        address: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
        tx_hash: '0x0dcb6f832ceeb08209800ba7ddb7b6965eb6fd4c8d76d4a5ff635e7fb3d8bf64',
        version: 0,
        funcSelectors: [ '0xe985e9c5', '0xbd85b039', '0xcd53d08e', '0xa2dd2453' ]
      },
      GNUSNFTFactory: {
        address: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
        tx_hash: '0x2178e0a388287c1cd7a0fa0435630248e6c6963c41cc3f84bb6819870735e52a',
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
        address: '0x67d269191c92Caf3cD7723F116c85e6E9bf55933',
        tx_hash: '0xceeacf143308e65f4926958bf92152e11db0acc2497465f53cfed0b4690cabcd',
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
        ]
      },
      EscrowAIJob: {
        address: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
        tx_hash: '0xabb12a6ef2ac3e7557d90f0dfe67dd04e4bdcbe168343973665a52d8585e10e4',
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
        address: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
        tx_hash: '0x397cbfca8882c190cd4d09a4395e720d8684a3b058286ce7abbd9d43039503ee',
        version: 0,
        funcSelectors: [ '0x6ea9fd36', '0x31d6388d' ]
      },
      GNUSNFTCollectionName: {
        address: '0xE6E340D132b5f46d1e472DebcD681B2aBc16e57E',
        tx_hash: '0xb0860b326c9b3d7ec37975e5a6540dd2f179488a5deb124f6f935f8ec94e2696',
        version: -1,
        funcSelectors: []
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
  }
};
