
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
  localhost: {
    DiamondAddress: '0x66F625B8c4c635af8b74ECe2d7eD0D58b4af3C3d',
    DeployerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    FacetDeployedInfo: {
      DiamondCutFacet: {
        address: '0xB377a2EeD7566Ac9fCb0BA673604F9BF875e2Bab',
        tx_hash: '0xa0b751622e5c64ad7f4e4c270c3f1dea54593e2dfb057cc30124368e82c0aa84',
        version: 0,
        funcSelectors: [ '0x1f931c1c' ]
      },
      DiamondLoupeFacet: {
        address: '0x02b0B4EFd909240FCB2Eb5FAe060dC60D112E3a4',
        tx_hash: '0xeb90ed87daeafd2c79011e4b981214137cdb41e53905ed8ab396cbb5dcce7c15',
        version: 0,
      },
      OwnershipFacet: {
        address: '0x638A246F0Ec8883eF68280293FFE8Cfbabe61B44',
        tx_hash: '0xfceb01212d4fd6aa0d5072acc2232bba0dfd89f68c8c2add17445d106ddfa1ec',
        version: 0,
        funcSelectors: [ '0x8da5cb5b', '0xf2fde38b' ]
      },
      ERC1155ProxyOperator: {
        address: '0x6C2d83262fF84cBaDb3e416D527403135D757892',
        tx_hash: '0x815fd595b3a7963bdc5d2639a0eaf222dd3d999484fec43d6caf01b6c256a50c',
        version: 0,
        funcSelectors: [ '0xe985e9c5', '0xbd85b039', '0xcd53d08e' ]
      },
      GNUSNFTFactory: {
        address: '0xFD6F7A6a5c21A3f503EBaE7a473639974379c351',
        tx_hash: '0x686fac51f645cd6728c3d890c72fd4b3132310646154c8fa836a0bb89754c3a1',
        version: 0,
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
        address: '0xc582Bc0317dbb0908203541971a358c44b1F3766',
        tx_hash: '0x6486d8ffbd0e81f5a3bfcbfd6ad3e013416dc0eaa0c222325f74c8e5c3d3d83d',
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
        ]
      },
      EscrowAIJob: {
        address: '0x5302E909d1e93e30F05B5D6Eea766363D14F9892',
        tx_hash: '0x4ede402a3c041f15b205522774b8e601a343587263cace3d55ed426bae0ec671',
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
        address: '0x0ed64d01D0B4B655E410EF1441dD677B695639E7',
        tx_hash: '0x0d643d487b720f5bd9605b230f405edaf9653568ec5d3a58a85eb40d1b99acf3',
        version: 0,
        funcSelectors: [ '0x6ea9fd36', '0x31d6388d' ]
      },
      GNUSNFTCollectionName: {
        address: '0x4bf010f1b9beDA5450a8dD702ED602A104ff65EE',
        tx_hash: '0xceb16dd9a15e59518c516f678c42582819036551bb4e0b09ce488c8910019804',
        version: 0
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
        verified: true
      },
      DiamondLoupeFacet: {
        address: '0x60d14bf965f3ea6392845183cd73304f4de6acbf',
        tx_hash: '0xdcf051c3f8f75bdece01fef0e5bf4d297c069382ed6447bed5057afd2e177bb9',
        verified: true
      },
      OwnershipFacet: {
        address: '0x7772723409a5c36fca74a0ad71e06214bdb09f5f',
        tx_hash: '0x6cbab5d9c70f673f37a961e45398f3fc152bc96b571b1295733c15a37e603a25',
        verified: true
      },
      GNUSNFTFactory: {
        address: '0xb51c35507b2087471c90d493ca95c31fcfe0b8d8',
        tx_hash: '0x02ee5c045b4c57ffb83bc3a40fce5c38d249032ac76230a27ae4fdd2adb76037',
        verified: true
      },
      PolyGNUSBridge: {
        address: '0x7b83cdb777ab471529ab4ef1e81718df453b4273',
        tx_hash: '0x1d5a89bd9ce5e44d85fd46596c26447981eb841da6936ce8ac3d134f8ae29378',
        version: 1,
        verified: true
      },
      EscrowAIJob: {
        address: '0x03716e22f6ef17773d3c7d8db10be5bf12a52f9a',
        tx_hash: '0xdb8ff610e4df9cd80477f90bdc87926e3f1fa4b7042a3b5b7f809b6928252ba0',
        verified: true
      },
      GeniusAI: {
        address: '0x1f1b7f3415011306b0859212923447f346a3ca8c',
        tx_hash: '0x50c5a94481fb301aaad06730e93e2a0862618b11ad9e24baf0f971f27859cc7a',
        verified: true
      },
      GNUSNFTCollectionName: {
        address: '0x25b3f982924f6d31eb8354a414c929d6107afb8a',
        tx_hash: '0xda7d8a1baa6ebb43ff66b3c3d2cb8709555f6aa9414155307253471c27795bc2',
        verified: true
      },
      ERC1155ProxyOperator: {
        address: '0xf95eb593ddd7806becc4419bd67371244187ea05',
        tx_hash: '0x9c2f38ac02a1736334cb3210a1df477f85584728369e6a3212844db9af0a44ae',
        version: 0,
        verified: true
      }
    }
  }
};
