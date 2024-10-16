import { FacetToDeployInfo } from './common';
import { glob } from 'glob';

export const Facets: FacetToDeployInfo = {
  DiamondCutFacet: { priority: 10 },
  DiamondLoupeFacet: { priority: 20 },
  GeniusOwnershipFacet: { priority: 30 },
  GNUSNFTFactory: {
    priority: 40,
    versions: { 0.0: {  deployInit: 'GNUSNFTFactory_Initialize()' }, 2.3: { deployInit: 'GNUSNFTFactory_Initialize()', upgradeInit: "GNUSNFTFactory_Initialize230()", fromVersions: [0.0, 2.0] }  },
  },
  GNUSBridge: {
    priority: 110,
    versions: { 2.2: {} },
  },
  GeniusAI: { priority: 70, versions: { 0.0: { deployInit: 'GeniusAI_Initialize()' }   }  },
  GNUSNFTCollectionName: { priority: 80 },
  ERC20TransferBatch: { priority: 90, versions: { 2.0: {} } },
  GNUSContractAssets: { priority: 100 },
};

export async function LoadFacetDeployments() {
  const imports = glob.sync(`${__dirname}/facetdeployments/*.ts`);
  for (const file of imports) {
    const deployLoad = file.replace(__dirname, '.').replace('.ts', '');
    await import(deployLoad);
  }
}
