import { debug } from 'debug';
import { pathExistsSync } from "fs-extra";
import { expect, assert } from 'chai';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { JsonRpcProvider } from '@ethersproject/providers';
import { multichain } from 'hardhat-multichain';
import { getInterfaceID } from '../utils/helpers';
import { LocalDiamondDeployer, LocalDiamondDeployerConfig } from 'scripts/setup/LocalDiamondDeployer';
import {
  Diamond,
  getDeployedFacetInterfaces,
  diffDeployedFacets,
  compareFacetSelectors,
  isProtocolInitRegistered,
  getDeployedFacets
} from '@gnus.ai/diamonds';
import {
  GeniusDiamond
} from '../../typechain-types';
import { DeployedDiamondData } from '@gnus.ai/diamonds/src';

describe('🧪 Multichain Fork and Diamond Deployment Tests', async function () {
  const diamondName = 'GeniusDiamond';
  const log: debug.Debugger = debug('GNUSDeploy:log:${diamondName}');
  this.timeout(0); // Extended indefinitely for diamond deployment time

  let networkProviders = multichain.getProviders() || new Map<string, JsonRpcProvider>();

  if (process.argv.includes('test-multichain')) {
    const networkNames = process.argv[process.argv.indexOf('--chains') + 1].split(',');
    if (networkNames.includes('hardhat')) {
      networkProviders.set('hardhat', ethers.provider);
    }
  } else if (process.argv.includes('test') || process.argv.includes('coverage')) {
    networkProviders.set('hardhat', ethers.provider);
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
        geniusDiamond = await ethers.getContractAt(diamondArtifactName, deployedDiamondData.DiamondAddress!) as GeniusDiamond;

        ethersMultichain = ethers;
        ethersMultichain.provider = provider;

        // Retrieve the signers for the chain
        signers = await ethersMultichain.getSigners();
        signer0 = signers[0].address;
        signer1 = signers[1].address;
        signer2 = signers[2].address;
        signer0Diamond = geniusDiamond.connect(signers[0]);
        signer1Diamond = geniusDiamond.connect(signers[1]);
        signer2Diamond = geniusDiamond.connect(signers[2]);

        owner = diamond.getDeployedDiamondData().DeployerAddress;
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

      it('🧪 Should report any issues with deployed function selectors matching previously deployed diamond data',
        async function () {
          if (!deployedDiamondData?.DiamondAddress) {
            console.log("DiamondAddress blank: assuming nothing to compare pre-deployement.");
            return;
          }
          const passFail = await diffDeployedFacets(
            deployedDiamondData,
            diamond.provider!,
          );
          expect(passFail).to.be.true;
        });

      it('🧪 Should compare the deployed facets with previously deployed diamond data', async function () {
        if (!deployedDiamondData?.DiamondAddress) {
          console.log("DiamondAddress blank: assuming nothing to compare pre-deployement.");
          return;
        }
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
            console.warn(`🔎 Mismatch in ${facetName}:`);
            passFail = false;
            if (diff.extraOnChain.length) {
              console.warn("  Extra selectors on-chain:", diff.extraOnChain);
              passFail = false;
            }
            if (diff.missingOnChain.length) {
              console.warn("  Missing selectors on-chain:", diff.missingOnChain);
              passFail = false;
            }
          }
        }

        expect(passFail).to.be.true;
        console.log("✅ All facets match!");
      });
    });
  }
});

