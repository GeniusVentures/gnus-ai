import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { Diamond } from '@diamondslab/diamonds';
import {
	loadDiamondContract,
	LocalDiamondDeployer,
	LocalDiamondDeployerConfig,
} from '@diamondslab/hardhat-diamonds/dist/utils';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import { debug } from 'debug';
import { JsonRpcProvider } from 'ethers';
import hre, { ethers } from 'hardhat';
import { multichain } from 'hardhat-multichain';
import { GeniusDiamond } from '../../diamond-typechain-types';
import { toWei } from '../../scripts/utils/helpers';

chai.use(chaiAsPromised);

/**
 * Phase 9 — GNUSTreasury test scaffold.
 *
 * Wave-0 stub per 09-VALIDATION.md "Wave 0 Requirements". All `it` bodies are
 * placeholders (`it.skip`) to be filled in by Plans 09-04 (Treasury facet
 * implementation) and 09-05 (invariant/cross-chain provenance tests).
 *
 * Suite names are literal grep targets for the Per-Task Verification Map in
 * 09-VALIDATION.md; do NOT rename.
 */
describe('GNUS Treasury Tests', async function () {
	const diamondName = 'GeniusDiamond';
	const log: debug.Debugger = debug('GNUSTreasury:log:${diamondName}');
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

			before(async function () {
				const config = {
					diamondName: diamondName,
					networkName: networkName,
					provider: provider,
					chainId: (await provider.getNetwork()).chainId,
					writeDeployedDiamondData: false,
					configFilePath: `diamonds/GeniusDiamond/geniusdiamond.config.json`,
				} as LocalDiamondDeployerConfig;
				const diamondDeployer = await LocalDiamondDeployer.getInstance(hre, config);
				await diamondDeployer.setVerbose(true);
				diamond = await diamondDeployer.getDiamondDeployed();
				const deployedDiamondData = diamond.getDeployedDiamondData();

				// Load the Diamond contract using the utility function
				geniusDiamond = await loadDiamondContract<GeniusDiamond>(
					diamond,
					deployedDiamondData.DiamondAddress! || '',
					hre.ethers,
				);

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
				owner = diamond.getDeployedDiamondData().DeployerAddress || '';
				if (!owner) {
					diamond.setSigner(signers[0]);
					owner = signer0;
				}
				ownerSigner = await ethersMultichain.getSigner(owner);
				ownerDiamond = geniusDiamond.connect(ownerSigner);
			});

			beforeEach(async function () {
				snapshotId = await provider.send('evm_snapshot', []);
			});

			afterEach(async () => {
				if (snapshotId) {
					await provider.send('evm_revert', [snapshotId]);
				}
			});

			describe('convert to GNUS', function () {
				it.skip('TODO: TREASURY-03/I6 — child→GNUS convert: exact amounts, I2 neutrality, limiter charged exactly once, super-admin bypass preserved', async function () {
					// Plan 09-04 fills in
				});
			});

			describe('GNUS to child', function () {
				it.skip('TODO: TREASURY-03 — GNUS→child convert: hook charges limiter automatically (no explicit charge), cap check on to-leg', async function () {
					// Plan 09-04 fills in
				});
			});

			describe('child to child', function () {
				it.skip('TODO: TREASURY-03 — childA→childB convert: no limiter charge, supply-neutral', async function () {
					// Plan 09-04 fills in
				});
			});

			describe('deep', function () {
				it.skip('TODO: TREASURY-03 — grandchild→GNUS single-hop convert; no tree walking; rate never applied in-transition', async function () {
					// Plan 09-04 fills in
				});
			});

			describe('reverts', function () {
				it.skip('TODO: convert same-id reverts', async function () {});
				it.skip('TODO: convert zero amount reverts', async function () {});
				it.skip('TODO: convert uncreated toId reverts', async function () {});
				it.skip('TODO: convert insufficient balance reverts', async function () {});
				it.skip('TODO: convert nonConvertible source reverts', async function () {});
				it.skip('TODO: convert nonConvertible destination reverts', async function () {});
			});

			describe('selector removed', function () {
				it.skip('TODO: withdraw(uint256,uint256) selector absent from loupe; stale calldata reverts', async function () {
					// Plan 09-04 fills in
				});
			});

			describe('provenance', function () {
				it.skip('TODO: TREASURY-04 — GNUSTreasury_Initialize300 seeds globalSupply and emits GlobalSupplyInitialized', async function () {});
				it.skip('TODO: TREASURY-04 — re-initialization reverts', async function () {});
				it.skip('TODO: TREASURY-04 — syncGlobalSupply emits event and is role-gated', async function () {});
				it.skip('TODO: TREASURY-04 — totalSupplyOfAll reverts pre-seed', async function () {});
			});

			describe('cross chain', function () {
				// Two-diamond fixture for I3 provenance consistency.
				// NEW pattern — see 09-PATTERNS.md "No Analog Found" table.
				let chainBDiamond: Diamond;
				let chainBGeniusDiamond: GeniusDiamond;
				const chainBDiamondName = 'GeniusDiamondChainB';

				before(async function () {
					// Scaffold a second LocalDiamondDeployer with a distinct diamondName.
					// Plan 09-05 wires the cross-chain provenance flow.
					const chainBConfig = {
						diamondName: chainBDiamondName,
						networkName: networkName,
						provider: provider,
						chainId: (await provider.getNetwork()).chainId,
						writeDeployedDiamondData: false,
						configFilePath: `diamonds/GeniusDiamond/geniusdiamond.config.json`,
					} as LocalDiamondDeployerConfig;
					const chainBDeployer = await LocalDiamondDeployer.getInstance(hre, chainBConfig);
					await chainBDeployer.setVerbose(true);
					chainBDiamond = await chainBDeployer.getDiamondDeployed();
					const chainBDeployedData = chainBDiamond.getDeployedDiamondData();
					chainBGeniusDiamond = await loadDiamondContract<GeniusDiamond>(
						chainBDiamond,
						chainBDeployedData.DiamondAddress! || '',
						hre.ethers,
					);
				});

				it.skip('TODO: I3 cross-chain provenance — source bridgeOut + dest mint → counters consistent under B1', async function () {
					// Plan 09-05 fills in
				});
			});

			describe('global cap', function () {
				it.skip('TODO: TREASURY-04/I5 — root mint beyond 50M tree-wide reverts', async function () {});
				it.skip('TODO: TREASURY-04/I5 — bridge-in beyond 50M tree-wide reverts', async function () {});
				it.skip('TODO: TREASURY-04/I5 — convert-to-GNUS never cap-checked', async function () {});
			});

			describe('display', function () {
				it.skip('TODO: TREASURY-05 — unitsOf/totalUnitsOf floor rounding', async function () {});
				it.skip('TODO: TREASURY-05 — unitsOf/totalUnitsOf revert on id 0', async function () {});
				it.skip('TODO: TREASURY-05 — unitsOf/totalUnitsOf revert when rate == 0', async function () {});
			});

			describe('counter untouched', function () {
				it.skip('TODO: Pitfall 2 — convert does NOT touch globalSupply', async function () {});
				it.skip('TODO: Pitfall 2 — factory mint does NOT touch globalSupply', async function () {});
			});

			describe('minter restriction', function () {
				it.skip('TODO: D10 — MINTER_ROLE mint id 0 succeeds', async function () {});
				it.skip('TODO: D10 — MINTER_ROLE mint non-zero id reverts', async function () {});
			});

			describe('minion cap', function () {
				it.skip('TODO: per-id maxSupply as minion cap — mint exactly to cap succeeds', async function () {});
				it.skip('TODO: per-id maxSupply as minion cap — cap+1 reverts', async function () {});
			});
		});
	}
});
