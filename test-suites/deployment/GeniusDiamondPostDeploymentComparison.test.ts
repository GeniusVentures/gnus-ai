import { debug } from 'debug';
import { pathExistsSync } from "fs-extra";
import { expect, assert } from 'chai';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { JsonRpcProvider } from 'ethers';
import { multichain } from 'hardhat-multichain';

// Type alias for provider compatibility
type ProviderType = JsonRpcProvider | any;
import { getInterfaceID } from '../../scripts/utils/helpers';
import { LocalDiamondDeployer, LocalDiamondDeployerConfig } from '../../scripts/setup/LocalDiamondDeployer';
import {
  Diamond,
  getDeployedFacetInterfaces,
  diffDeployedFacets,
  compareFacetSelectors,
  isProtocolInitRegistered,
  getDeployedFacets
} from 'diamonds';
import {
  GeniusDiamond,
} from '../../diamond-typechain-types';
import { DeployedDiamondData } from 'diamonds';

describe('🧪 Multichain Fork and Diamond Deployment Tests', async function () {
  const diamondName = 'GeniusDiamond';
  const log: debug.Debugger = debug('GNUSDeploy:log:${diamondName}');
  this.timeout(0); // Extended indefinitely for diamond deployment time

  let networkProviders = multichain.getProviders() || new Map<string, ProviderType>();

  if (process.argv.includes('test-multichain')) {
    const networkNames = process.argv[process.argv.indexOf('--chains') + 1].split(',');
    if (networkNames.includes('hardhat')) {
      networkProviders.set('hardhat', ethers.provider as any);
    }
  } else if (process.argv.includes('test') || process.argv.includes('coverage')) {
    networkProviders.set('hardhat', ethers.provider as any);
  }

  for (const [networkName, provider] of networkProviders.entries()) {
    describe(`🔗 Chain: ${networkName}  Diamond: ${diamondName}`, function () {
      let diamond: Diamond;
      let signers: SignerWithAddress[];
      let signer0: string;
      let signer1: string;
      let signer2: string;
      let owner: string;
      let ownerSigner: SignerWithAddress;
      let geniusDiamond: GeniusDiamond;
      let signer0Diamond: GeniusDiamond;
      let signer1Diamond: GeniusDiamond;
      let signer2Diamond: GeniusDiamond;
      let ownerDiamond: GeniusDiamond;

      let ethersMultichain: typeof ethers;
      let snapshotId: string;

      let deployedDiamondData: DeployedDiamondData;
      before(async function () {
        const config = {
          diamondName: diamondName,
          networkName: networkName,
          provider: provider,
          chainId: (await provider.getNetwork()).chainId,
          writeDeployedDiamondData: false,
          configFilePath: `diamonds/GeniusDiamond/geniusdiamond.config.json`,
        } as LocalDiamondDeployerConfig;
        const diamondDeployer = await LocalDiamondDeployer.getInstance(config);
        // diamondDeployer.deployDiamond();
        diamond = await diamondDeployer.getDiamond();
        deployedDiamondData = diamond.getDeployedDiamondData();

        const hardhatDiamondAbiPath = 'hardhat-diamond-abi/HardhatDiamondABI.sol:';
        const diamondArtifactName = `${hardhatDiamondAbiPath}${diamond.diamondName}`;
        geniusDiamond = await ethers.getContractAt(diamondArtifactName, deployedDiamondData.DiamondAddress!) as unknown as GeniusDiamond;

        ethersMultichain = ethers;
        ethersMultichain.provider = provider as any;

        // Retrieve the signers for the chain
        signers = await ethersMultichain.getSigners();
        signer0 = signers[0].address;
        signer1 = signers[1].address;
        signer2 = signers[2].address;
        signer0Diamond = geniusDiamond.connect(signers[0]);
        signer1Diamond = geniusDiamond.connect(signers[1]);
        signer2Diamond = geniusDiamond.connect(signers[2]);

        owner = diamond.getDeployedDiamondData().DeployerAddress!;
        if (!owner) {
          diamond.setSigner(signers[0]);
          owner = signer0;
          ownerSigner
        }
        ownerSigner = await ethersMultichain.getSigner(owner);

        ownerDiamond = geniusDiamond.connect(ownerSigner);
      });

      beforeEach(async function () {
        snapshotId = await provider.send('evm_snapshot', []);
      });

      afterEach(async () => {
        await provider.send('evm_revert', [snapshotId]);
      });

      it('🧪 Should report any issues with facets and selectors that do not match',
        async function () {
          const passFail = await diffDeployedFacets(
            deployedDiamondData,
            diamond.provider! as any as any,
            true,
          );
          expect(passFail).to.be.true;
        });

      it('🧪 Should compare the deployed facets with the config', async function () {
        const onChainFacets = await getDeployedFacets(
          deployedDiamondData.DiamondAddress!,
          ownerSigner,
          undefined,
          // true  // uncheck for console list of deployedContracts
        );

        const comparison = compareFacetSelectors(deployedDiamondData.DeployedFacets!, onChainFacets);
        let passFail: boolean = true;;
        for (const [facetName, diff] of Object.entries(comparison)) {
          if (diff.extraOnChain.length || diff.missingOnChain.length) {
            console.log(`🔎 Mismatch in ${facetName}:`);
            passFail = false;
            if (diff.extraOnChain.length) {
              console.log("  Extra selectors on-chain:", diff.extraOnChain);
              passFail = false;
            }
            if (diff.missingOnChain.length) {
              console.log("  Missing selectors on-chain:", diff.missingOnChain);
              passFail = false;
            }
          }
        }

        expect(passFail).to.be.true;
        console.log("✅ All facets match!");
      });

      it('🧪 Should compare the deployed facet initializer setup with the config', async function () {
        if (!diamond.getDeployConfig().protocolInitFacet) {
          console.log("No ProtocolInitFacet defined: Skipping post-deployment validation.");
          return;
        }
        const facetInit = diamond.getDeployConfig().protocolInitFacet;
        const protocolVersion = diamond.getDeployConfig().protocolVersion;
        const initFunctionName = diamond.getDeployConfig().facets[facetInit!].versions?.[protocolVersion]?.deployInit;
        const protocolFacetOk = await isProtocolInitRegistered(deployedDiamondData, facetInit!, initFunctionName!);
        console.log(protocolFacetOk ? "✅ Protocol initializer present." : "❌ Protocol initializer missing.");
        expect(protocolFacetOk).to.be.true;
      });
    });
  }
});

