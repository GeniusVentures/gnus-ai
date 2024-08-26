import { FacetToDeployInfo, UpgradeInitInfo } from './common';
import { glob } from 'glob';

export const Facets: FacetToDeployInfo = {
  DiamondCutFacet: { priority: 10 },
  DiamondLoupeFacet: { priority: 20 },
  GeniusOwnershipFacet: { priority: 30 },
  GNUSNFTFactory: {
    priority: 40,
    versions: { 0.0: { init: 'GNUSNFTFactory_Initialize' }, 2.0: {} },
  },
  GNUSBridge: {
    priority: 50,
    versions: { 2.2: {} },
  },
  EscrowAIJob: { priority: 60, versions: { 0.0: { init: 'EscrowAIJob_Initialize' } } },
  GeniusAI: { priority: 70, versions: { 0.0: { init: 'GeniusAI_Initialize' } } },
  GNUSNFTCollectionName: { priority: 80 },
  ERC20TransferBatch: { priority: 90, versions: { 2.0: {} } },
  GNUSControl: { priority: 100 },
  GNUSContractAssets: { priority: 100 },
};

export const UpgradeInits: UpgradeInitInfo = {
  2.2: {
    initContractName: 'GNUSBridge',
    initFuncName: 'GNUSBridge_Initialize220',
    initArgs: [],
  },
};

export async function LoadFacetDeployments() {
  const imports = glob.sync(`${__dirname}/facetdeployments/*.ts`);
  for (const file of imports) {
    const deployLoad = file.replace(__dirname, '.').replace('.ts', '');
    await import(deployLoad);
  }
}
