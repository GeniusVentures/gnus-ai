import {
	compareFacetSelectors,
	DeployedDiamondData,
	Diamond,
	diffDeployedFacets,
	getDeployedFacets,
	isProtocolInitRegistered,
} from '@diamondslab/diamonds';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import { debug } from 'debug';
import { JsonRpcProvider } from 'ethers';
import { ethers } from 'hardhat';
import { multichain } from 'hardhat-multichain';
import { GeniusDiamond } from '../../../diamond-typechain-types';
import {
	LocalDiamondDeployer,
	LocalDiamondDeployerConfig,
} from '../../../scripts/setup/LocalDiamondDeployer';
import { loadDiamondContract } from '../../../scripts/utils/loadDiamondArtifact';

// Type alias for provider compatibility
type ProviderType = JsonRpcProvider | any;

describe('🧪 Diamond Post-Deployment Comparison Tests', async function () {
	const diamondName = 'GeniusDiamond';
	const log: debug.Debugger = debug('GNUSDeploy:log:${diamondName}');
	this.timeout(0); // Extended indefinitely for diamond deployment time

	const networkProviders = multichain.getProviders() || new Map<string, JsonRpcProvider>();

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
					deployedDiamondDataFilePath: `diamonds/GeniusDiamond/deployments/geniusdiamond-sepolia-11155112.json`,
				} as LocalDiamondDeployerConfig;
				const diamondDeployer = await LocalDiamondDeployer.getInstance(config);
				// diamondDeployer.deployDiamond();
				diamond = await diamondDeployer.getDiamond();
				deployedDiamondData = diamond.getDeployedDiamondData();

				let geniusDiamondPlain: GeniusDiamond;

				let geniusDiamondContract: GeniusDiamond;

				// Load the Diamond contract using the utility function
				geniusDiamondContract = await loadDiamondContract<GeniusDiamond>(
					diamond,
					deployedDiamondData.DiamondAddress!,
				);
				geniusDiamond = geniusDiamondContract;

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
					ownerSigner;
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

			it('🧪 Should report any issues with facets and selectors that do not match', async function () {
				const newDeployedDiamondData = diamond.getDeployedDiamondData();
				const passFail = await diffDeployedFacets(
					newDeployedDiamondData,
					diamond.provider! as any,
				);
				expect(passFail).to.be.true;
			});

			it('🧪 Should compare the deployed facets with the config', async function () {
				const newDeployedDiamondData = diamond.getDeployedDiamondData();
				const onChainFacets = await getDeployedFacets(
					newDeployedDiamondData.DiamondAddress!,
					ownerSigner,
					undefined,
					// true  // uncheck for console list of deployedContracts
				);

				const comparison = compareFacetSelectors(
					deployedDiamondData.DeployedFacets!,
					onChainFacets,
				);
				let passFail: boolean = true;
				for (const [facetName, diff] of Object.entries(comparison)) {
					if (diff.extraOnChain.length || diff.missingOnChain.length) {
						console.warn(`🔎 Mismatch in ${facetName}:`);
						passFail = false;
						if (diff.extraOnChain.length) {
							console.warn('  Extra selectors on-chain:', diff.extraOnChain);
							passFail = false;
						}
						if (diff.missingOnChain.length) {
							console.warn('  Missing selectors on-chain:', diff.missingOnChain);
							passFail = false;
						}
					}
				}

				expect(passFail).to.be.true;
				console.log('✅ All facets match!');
			});

			it('🧪 Should compare the deployed facet initializer setup with the config', async function () {
				const facetInit = diamond.getDeployConfig().protocolInitFacet;
				const protocolVersion = diamond.getDeployConfig().protocolVersion;
				const initFunctionName =
					diamond.getDeployConfig().facets[facetInit!].versions?.[protocolVersion]
						?.deployInit;
				const protocolFacetOk = await isProtocolInitRegistered(
					deployedDiamondData,
					facetInit!,
					initFunctionName!,
				);
				console.log(
					protocolFacetOk
						? '✅ Protocol initializer present.'
						: '❌ Protocol initializer missing.',
				);
				expect(protocolFacetOk).to.be.true;
			});
		});
	}
});
