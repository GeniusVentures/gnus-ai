import { IDefenderViaInfo } from "./common";

export const defenderSigners: { [key: string]: IDefenderViaInfo } = {
    polygon: { via: '0xA390c06D129A0B0288FE4E33B2540bD9f99DC333', viaType: 'Safe'},
    mainnet: { via: '0xc365BaC723295e0d56DB30219d249FDbc19B63CF', viaType: 'Safe'},
    bsc: { via: '0x45A920727578222B6AFA5ce4044dd35A2218c900', viaType: 'Safe'},
    base: { via: '0x70E78057Ffdb0Cfc5B2923C741A67Ca4A41E4b18', viaType: 'Safe'},
    sepolia: { via: '0x34cF9B07A7703d82689D28f2200067c050e7a861', viaType: 'Safe'},
    base_sepolia: { via: '0x808543489F248420e40e809C565Ffd0B4343305f', viaType: 'Safe'},
    bsc_testnet: { via: '0x910bAa33DeB0D614Aa9d80e38b7f0BF87549c2fC', viaType: 'EOA'},
    polygon_amoy: { via: '0x910bAa33DeB0D614Aa9d80e38b7f0BF87549c2fC', viaType: 'EOA'},
}