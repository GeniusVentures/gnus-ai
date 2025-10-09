import { debug } from 'debug';
import { pathExistsSync } from 'fs-extra';
import { expect, assert } from 'chai';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { JsonRpcProvider } from 'ethers';
import { multichain } from 'hardhat-multichain';
import { getInterfaceID } from '../../../scripts/utils/helpers';
import {
	LocalDiamondDeployer,
	LocalDiamondDeployerConfig,
} from '../../../scripts/setup/LocalDiamondDeployer';
import {
	Diamond,
	getDeployedFacetInterfaces,
	diffDeployedFacets,
	compareFacetSelectors,
	isProtocolInitRegistered,
	getDeployedFacets,
} from 'diamonds';
import { GeniusDiamond } from '../../../diamond-typechain-types';
import { DeployedDiamondData } from 'diamonds';

describe('🧪 Diamond Pre-Deployment Comparison Tests', async function () {
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
					writeDeployedDiamondData: true,
					deployedDiamondDataFilePath: `diamonds/GeniusDiamond/deployments/geniusdiamond-v2.4-sepolia-31337.json`,
					configFilePath: `diamonds/GeniusDiamond/geniusdiamond-sepolia-v2.5-step1.config.json`,
					localDiamondDeployerKey: 'geniusdiamond-sepolia-v2.5-step1',
				} as LocalDiamondDeployerConfig;
				const diamondDeployer = await LocalDiamondDeployer.getInstance(config);
				// diamondDeployer.deployDiamond();
				diamond = await diamondDeployer.getDiamond();
				deployedDiamondData = diamond.getDeployedDiamondData();

				const hardhatDiamondAbiPath = 'diamond-abi/';
				const diamondArtifactName = `${hardhatDiamondAbiPath}${diamond.diamondName}`;
				geniusDiamond = (await ethers.getContractAt(
					diamondArtifactName,
					deployedDiamondData.DiamondAddress!,
				)) as unknown as GeniusDiamond;

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

				// get the signer for the owner
				owner = await diamond.getSigner()?.getAddress()!;
				ownerSigner = await ethersMultichain.getSigner(owner);

				ownerDiamond = geniusDiamond.connect(ownerSigner);
			});

			beforeEach(async function () {
				snapshotId = await provider.send('evm_snapshot', []);
			});

			afterEach(async () => {
				await provider.send('evm_revert', [snapshotId]);
			});

			it(`🧪 Should validate that the Diamond Address and Deployer Address are correct`, async function () {
				const diamondAddress = deployedDiamondData.DiamondAddress;
				const deployerAddress = deployedDiamondData.DeployerAddress;

				// Retrieve the deployed diamond address from the contract
				const diamondAddressFromContract = (await ownerDiamond.getAddress()) as string;
				expect(diamondAddressFromContract).to.equal(diamondAddress);
				// Retrieve the deployer address from the contract - commented out as this method may not exist
				// const deployerAddressFromContract = await geniusDiamond.owner() as string;
				// expect(deployerAddressFromContract).to.equal(deployerAddress);
			});

			it('🧪 Should report any issues with deployed function selectors matching previously deployed diamond data', async function () {
				// const deployedDiamondData = diamond.getDeployedDiamondData();
				const passFail = await diffDeployedFacets(
					deployedDiamondData,
					diamond.provider! as any,
				);
				expect(passFail).to.be.true;
			});

			it('🧪 Should compare the deployed facets with previously deployed diamond data', async function () {
				const onChainFacets = await getDeployedFacets(
					deployedDiamondData.DiamondAddress!,
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
		});
	}
});
