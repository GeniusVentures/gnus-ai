
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
    DiamondAddress: '0xA4899D35897033b927acFCf422bc745916139776',
    DeployerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    FacetDeployedInfo: {
      DiamondCutFacet: {
        address: '0x86A2EE8FAf9A840F7a2c64CA3d51209F9A02081D',
        tx_hash: '0x5b707e89e98f6168ec5b6b09137642a19747343f07a3da072498556570c7ce91',
        funcSelectors: [ '0x1f931c1c' ]
      },
      DiamondLoupeFacet: {
        address: '0xf953b3A269d80e3eB0F2947630Da976B896A8C5b',
        tx_hash: '0x523ce54eafd60fa6f22d76cee3461ec41a6a142381812717666bb20216dd74fa',
        funcSelectors: [
          '0xcdffacc6',
          '0x52ef6b2c',
          '0xadfca15e',
          '0x7a0ed627',
          '0x01ffc9a7'
        ]
      },
      OwnershipFacet: {
        address: '0xAA292E8611aDF267e563f334Ee42320aC96D0463',
        tx_hash: '0xc88da907df869279f3f181f0a1d7f3b0b38f6bc54c0c6aac56b3947db7357322',
        funcSelectors: [ '0x8da5cb5b', '0xf2fde38b' ]
      },
      ERC1155ProxyOperator: {
        address: '0x457cCf29090fe5A24c19c1bc95F492168C0EaFdb',
        tx_hash: '0x689a2fc56971e940613fb5457d122e839c4d61f026da49e1cfca464a1b5b8f68',
        version: 1,
        funcSelectors: [ '0xe985e9c5', '0x2693ebf2', '0xcd53d08e' ]
      },
      GNUSNFTFactory: {
        address: '0x720472c8ce72c2A2D711333e064ABD3E6BbEAdd3',
        tx_hash: '0x72ca9324cba1a91452f84d8aea9851188d3f1edb125127db758fccb599dbf366',
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
        address: '0xb9bEECD1A582768711dE1EE7B0A1d582D9d72a6C',
        tx_hash: '0xe6978805cae1bd6769fc128044c62adbdd31b27cc01cbac1755e5bf438f057dc',
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
        address: '0x5067457698Fd6Fa1C6964e416b3f42713513B3dD',
        tx_hash: '0xd54ce97652d474c1a4c49d487991039ea3870d866223805882866f30eb2f62d6',
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
        address: '0x18E317A7D70d8fBf8e6E893616b52390EbBdb629',
        tx_hash: '0x922b1e49feb3c6ccd619a1b0694ae429d5a3f892755f5e42e721dddcbf12ff27',
        funcSelectors: [ '0x6ea9fd36', '0x31d6388d' ]
      },
      GNUSNFTCollectionName: {
        address: '0x4b6aB5F819A515382B0dEB6935D793817bB4af28',
        tx_hash: '0x3faa896a6c11f8956166e1ba920460c47c88e445d045fd6a9f4d80bfae42580f'
      }
    }
  }
};
