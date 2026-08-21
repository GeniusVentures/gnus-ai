import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { Diamond } from '@geniusventures/diamonds';
import {
	loadDiamondContract,
	LocalDiamondDeployer,
	LocalDiamondDeployerConfig,
} from '@geniusventures/hardhat-diamonds/dist/utils';
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
 * Phase 11 — GNUSRedeemAdapter unit tests (caller-bound direct-burn rework).
 *
 * Pins PROXY-03 behaviorally after the Codex-P1 simplification:
 *   - redeem(childId, amount) is caller-bound: the caller IS the holder and recipient
 *   - direct burn/mint (no pull) — no operator approvals required
 *   - full revert matrix (exact strings from GNUSRedeemAdapter.sol)
 *   - CR-01: contract callers redeem without IERC1155Receiver (hook-free _mint)
 *   - WR-07 limiter attribution to the caller + super-admin bypass (raw topic)
 *   - no-custody invariant (diamond child balance == 0 after redeem)
 *   - unconditional receiver-hook reverts (direct single + batch transfers)
 *   - loupe selector presence post-upgrade
 *
 * Suite names are literal grep targets for the Per-Task Verification Map; do NOT rename.
 */
describe('GNUS Redeem Adapter Tests', async function () {
	const diamondName = 'GeniusDiamond';
	const log: debug.Debugger = debug(`GNUSRedeemAdapter:log:${diamondName}`);
	this.timeout(0); // Extended indefinitely for diamond deployment time

	const networkProviders = multichain.getProviders() || new Map<string, JsonRpcProvider>();

	if (process.argv.includes('test-multichain')) {
		const chainsIdx = process.argv.indexOf('--chains');
		const chainsArg = chainsIdx >= 0 ? process.argv[chainsIdx + 1] : undefined;
		const networkNames = (chainsArg ?? 'hardhat').split(',');
		if (networkNames.includes('hardhat')) {
			networkProviders.set('hardhat', ethers.provider as any);
		}
	} else if (process.argv.includes('test') || process.argv.includes('coverage')) {
		networkProviders.set('hardhat', ethers.provider as any);
	}

	// GNUS_TOKEN_ID is 0
	const GNUS_TOKEN_ID = 0n;
	// keccak256("gnus.ai.nft.factory.storage") — NFT struct mapping base slot
	const FACTORY_STORAGE_SLOT = ethers.keccak256(ethers.toUtf8Bytes('gnus.ai.nft.factory.storage'));
	// keccak256("gnus.ai.treasury.storage") — GNUSTreasury Layout base slot
	const TREASURY_STORAGE_SLOT = ethers.keccak256(ethers.toUtf8Bytes('gnus.ai.treasury.storage'));

	/**
	 * Compute the storage slot for NFTs[tokenId].nonConvertible (bool).
	 *
	 * Layout: NFT struct spans slots base+0..base+8.
	 *   +7 parentId | +8 nonConvertible
	 */
	function nftNonConvertibleSlot(tokenId: bigint): string {
		const mappingSlot = ethers.keccak256(
			ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'uint256'], [tokenId, FACTORY_STORAGE_SLOT]),
		);
		return ethers.toBeHex(BigInt(mappingSlot) + 8n, 32);
	}

	for (const [networkName, provider] of networkProviders.entries()) {
		describe(`🔗 Chain: ${networkName}  Diamond: ${diamondName}`, function () {
			let diamond: Diamond;
			let signers: SignerWithAddress[];
			let signer0: string;
			let signer1: string;
			let owner: string;
			let ownerSigner: SignerWithAddress;
			let geniusDiamond: GeniusDiamond;
			let signer1Diamond: GeniusDiamond;
			let ownerDiamond: GeniusDiamond;
			let diamondAddress: string;

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

				geniusDiamond = await loadDiamondContract<GeniusDiamond>(
					diamond,
					deployedDiamondData.DiamondAddress! || '',
					hre.ethers,
				);
				diamondAddress = deployedDiamondData.DiamondAddress!;

				ethersMultichain = ethers;
				ethersMultichain.provider = provider as any;

				signers = await ethersMultichain.getSigners();
				signer0 = signers[0].address;
				signer1 = signers[1].address;
				signer1Diamond = geniusDiamond.connect(signers[1]);

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

			/**
			 * Seed the provenance counter with 0 if not already initialized (the
			 * GeniusDiamond fixture is shared/cached across suites in this process).
			 */
			async function seedProvenanceIfNeeded(
				dContract: GeniusDiamond = ownerDiamond,
				address: string = diamondAddress,
			): Promise<void> {
				const initialized = await provider.send('eth_getStorageAt', [
					address,
					ethers.toBeHex(BigInt(TREASURY_STORAGE_SLOT) + 1n, 32),
				]);
				if (BigInt(initialized) === 0n) {
					await dContract.GNUSTreasury_SetSeedSupply(0n);
				}
			}

			/**
			 * Boot a fresh state: seed provenance, mint GNUS, create a direct child at
			 * rate 2e18, and mint 100 child minions to signer1 (the user). No operator
			 * approvals are needed — redeem burns the caller's balance directly.
			 * Returns the child token id (= 1).
			 */
			async function bootWithChild(): Promise<bigint> {
				await seedProvenanceIfNeeded();
				await ownerDiamond['mint(address,uint256)'](signer1, toWei('1000'));
				await ownerDiamond['mint(address,uint256)'](owner, toWei('1000'));
				const rate = toWei('2'); // 2e18
				await ownerDiamond.createNFT(
					GNUS_TOKEN_ID,
					'Child',
					'CHLD',
					rate,
					toWei('1000000'),
					'ipfs://child',
				);
				const childId = 1n;
				await ownerDiamond['mint(address,uint256,uint256,bytes)'](
					signer1,
					childId,
					toWei('100'),
					'0x',
				);
				return childId;
			}

			/**
			 * Same as bootWithChild but flips nonConvertible = true on the child via a
			 * direct storage write, then reads the slot back defensively (catches
			 * slot-layout drift before the test runs).
			 */
			async function bootWithNonConvertibleChild(): Promise<bigint> {
				const childId = await bootWithChild();
				await provider.send('hardhat_setStorageAt', [
					diamondAddress,
					nftNonConvertibleSlot(childId),
					ethers.zeroPadValue('0x01', 32),
				]);
				const readBack = await provider.send('eth_getStorageAt', [
					diamondAddress,
					nftNonConvertibleSlot(childId),
				]);
				expect(BigInt(readBack)).to.eq(1n);
				return childId;
			}

			describe('happy path', function () {
				it('redeems the caller child tokens for GNUS (happy path)', async function () {
					const childId = await bootWithChild();

					const childBefore = await geniusDiamond['balanceOf(address,uint256)'](signer1, childId);
					const gnusBefore = await geniusDiamond['balanceOf(address,uint256)'](signer1, GNUS_TOKEN_ID);
					const supplyChildBefore = await geniusDiamond['totalSupply(uint256)'](childId);
					const supplyGnusBefore = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);

					await expect(signer1Diamond.redeem(childId, toWei('30')))
						.to.emit(geniusDiamond, 'Redeemed')
						.withArgs(signer1, childId, toWei('30'));

					expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, childId)).to.eq(
						childBefore - toWei('30'),
					);
					expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, GNUS_TOKEN_ID)).to.eq(
						gnusBefore + toWei('30'),
					);
					// No-custody invariant: the diamond never holds child tokens.
					expect(await geniusDiamond['balanceOf(address,uint256)'](diamondAddress, childId)).to.eq(0n);
					// Supply-neutral reallocation
					expect(supplyChildBefore - (await geniusDiamond['totalSupply(uint256)'](childId))).to.eq(
						toWei('30'),
					);
					expect((await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID)) - supplyGnusBefore).to.eq(
						toWei('30'),
					);
				});

				it('redeem selector present on diamond (loupe check)', async function () {
					const redeemSelector = ethers.id('redeem(uint256,uint256)').slice(0, 10);
					const facetAddrs: string[] = await geniusDiamond.facetAddresses();
					let found = false;
					for (const facet of facetAddrs) {
						const selectors: string[] = await geniusDiamond.facetFunctionSelectors(facet);
						if (selectors.map((s) => s.toLowerCase()).includes(redeemSelector.toLowerCase())) {
							found = true;
							break;
						}
					}
					expect(found, 'redeem selector must be registered on a facet').to.be.true;
				});

				it('old four-argument redeem selector is NOT present (caller-bound rework)', async function () {
					const oldSelector = ethers.id('redeem(address,uint256,uint256,address)').slice(0, 10);
					const facetAddrs: string[] = await geniusDiamond.facetAddresses();
					for (const facet of facetAddrs) {
						const selectors: string[] = await geniusDiamond.facetFunctionSelectors(facet);
						expect(
							selectors.map((s) => s.toLowerCase()).includes(oldSelector.toLowerCase()),
							'old redeem(address,uint256,uint256,address) must not be registered',
						).to.be.false;
					}
				});
			});

			describe('revert matrix', function () {
				it('reverts when childId is GNUS_TOKEN_ID', async function () {
					await bootWithChild();
					await expect(
						signer1Diamond.redeem(GNUS_TOKEN_ID, toWei('10')),
					).to.be.revertedWith('Cannot redeem GNUS itself');
				});

				it('reverts when amount is zero', async function () {
					const childId = await bootWithChild();
					await expect(
						signer1Diamond.redeem(childId, 0n),
					).to.be.revertedWith('Amount must be greater than zero');
				});

				it('reverts when child token is not created', async function () {
					await bootWithChild();
					await expect(
						signer1Diamond.redeem(999n, toWei('10')),
					).to.be.revertedWith('Token not created.');
				});

				it('reverts when child token is nonConvertible', async function () {
					const childId = await bootWithNonConvertibleChild();
					await expect(
						signer1Diamond.redeem(childId, toWei('10')),
					).to.be.revertedWith('Token is non-convertible');
				});

				it('reverts when amount exceeds total supply (supply-exhaustion path)', async function () {
					const childId = await bootWithChild();
					// Only 100 child exist in total supply; redeeming 200 trips the
					// ERC1155Supply supply check before the caller-balance check.
					await expect(
						signer1Diamond.redeem(childId, toWei('200')),
					).to.be.revertedWith('ERC1155: burn amount exceeds totalSupply');
				});

				it('reverts when caller balance is insufficient (balance path)', async function () {
					const childId = await bootWithChild();
					// Mint another 100 to the owner so total supply (200) exceeds the
					// attempted redeem (150) but the caller's balance (100) does not.
					await ownerDiamond['mint(address,uint256,uint256,bytes)'](owner, childId, toWei('100'), '0x');
					await expect(
						signer1Diamond.redeem(childId, toWei('150')),
					).to.be.revertedWith('ERC1155: burn amount exceeds balance');
				});
			});

			describe('withdrawal limiter (WR-07)', function () {
				it('charges the withdrawal limiter against the caller', async function () {
					const childId = await bootWithChild();

					const userBefore = await geniusDiamond.getAccountWithdrawStatus(signer1);
					const diamondBefore = await geniusDiamond.getAccountWithdrawStatus(diamondAddress);

					await signer1Diamond.redeem(childId, toWei('25'));

					const userAfter = await geniusDiamond.getAccountWithdrawStatus(signer1);
					const diamondAfter = await geniusDiamond.getAccountWithdrawStatus(diamondAddress);

					expect(userAfter.currentUsage - userBefore.currentUsage).to.eq(toWei('25'));
					expect(diamondAfter.currentUsage).to.eq(diamondBefore.currentUsage);
				});

				it('emits SuperAdminBypass when caller is super admin (raw topic)', async function () {
					const childId = await bootWithChild();
					// Fund the owner with child tokens.
					await ownerDiamond['mint(address,uint256,uint256,bytes)'](owner, childId, toWei('50'), '0x');

					const ownerBefore = await geniusDiamond.getAccountWithdrawStatus(owner);

					const bypassTx = await ownerDiamond.redeem(childId, toWei('10'));
					const bypassReceipt = await bypassTx.wait();
					// SuperAdminBypass is declared in a library (GNUSWithdrawLimiterStorage),
					// not a facet, so it is absent from the diamond proxy ABI — parse the raw
					// log topic instead of chai's .to.emit.
					const bypassTopic = ethers.id('SuperAdminBypass(address,uint256,string)');
					const bypassLog = bypassReceipt!.logs.find((log) => log.topics[0] === bypassTopic);
					expect(bypassLog, 'SuperAdminBypass event not emitted').to.not.be.undefined;
					expect(bypassLog!.topics[1]).to.eq(ethers.zeroPadValue(owner, 32));
					const bypassDecoded = ethers.AbiCoder.defaultAbiCoder().decode(
						['uint256', 'string'],
						bypassLog!.data,
					);
					expect(bypassDecoded[0]).to.eq(toWei('10'));
					expect(bypassDecoded[1]).to.eq('GNUSRedeemAdapter.redeem');

					const ownerAfter = await geniusDiamond.getAccountWithdrawStatus(owner);
					expect(ownerAfter.currentUsage).to.eq(ownerBefore.currentUsage);
				});

				it('reverts with the limiter-exceeded string when caller exceeds the limit', async function () {
					const childId = await bootWithChild();
					// Tighten signer1's per-account limit to 30e18 so one redeem of 50
					// exceeds it; the charge must revert BEFORE the burn (CEI, T-11-01).
					await ownerDiamond.setAccountConfig(signer1, 0, 0, toWei('30'));

					// Charge exactly the limit first.
					await signer1Diamond.redeem(childId, toWei('30'));

					const userAfter = await geniusDiamond.getAccountWithdrawStatus(signer1);
					expect(userAfter.remainingCapacity).to.eq(0n);

					// The next redeem must hit the limiter — and the child balance must be
					// untouched, pinning charge-before-burn ordering.
					const childBefore = await geniusDiamond['balanceOf(address,uint256)'](signer1, childId);
					await expect(signer1Diamond.redeem(childId, toWei('10'))).to.be.revertedWith(
						'Withdrawal limit exceeded for time window',
					);
					expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, childId)).to.eq(childBefore);
					expect(await geniusDiamond['balanceOf(address,uint256)'](diamondAddress, childId)).to.eq(0n);
				});
			});

			describe('contract caller (CR-01)', function () {
				it('contract caller redeems successfully (hook-free mint)', async function () {
					const childId = await bootWithChild();

					// MockRedeemCaller implements IERC1155Receiver ONLY to receive its
					// child balance via GNUSNFTFactory.mint (which keeps the acceptance
					// check). The redeem mint-back (CR-01 _mint override) must succeed
					// without invoking any hook on the recipient — the discriminating
					// case below sets rejectTransfers and still expects success, which
					// would be impossible if the OZ acceptance check still ran.
					const mockFactory = await ethers.getContractFactory('MockRedeemCaller');
					const mock = await mockFactory.deploy();
					await mock.waitForDeployment();
					const mockAddress = await mock.getAddress();

					await ownerDiamond['mint(address,uint256,uint256,bytes)'](
						mockAddress,
						childId,
						toWei('40'),
						'0x',
					);

					const gnusBefore = await geniusDiamond['balanceOf(address,uint256)'](
						mockAddress,
						GNUS_TOKEN_ID,
					);

					await expect(mock.redeem(diamondAddress, childId, toWei('15')))
						.to.emit(geniusDiamond, 'Redeemed')
						.withArgs(mockAddress, childId, toWei('15'));

					expect(await mock.childBalance(diamondAddress, childId)).to.eq(toWei('25'));
					expect(
						await geniusDiamond['balanceOf(address,uint256)'](mockAddress, GNUS_TOKEN_ID),
					).to.eq(gnusBefore + toWei('15'));
				});

				it('redeem succeeds even when the recipient hook would reject (discriminates CR-01)', async function () {
					const childId = await bootWithChild();

					const mockFactory = await ethers.getContractFactory('MockRedeemCaller');
					const mock = await mockFactory.deploy();
					await mock.waitForDeployment();
					const mockAddress = await mock.getAddress();

					await ownerDiamond['mint(address,uint256,uint256,bytes)'](
						mockAddress,
						childId,
						toWei('40'),
						'0x',
					);

					// Flip rejectTransfers (slot 0) so the recipient hook REVERTS if invoked.
					// Pre-CR-01 the OZ acceptance check called onERC1155Received on the
					// mint-back, so this redeem reverted ('MockRedeemCaller: transfer
					// rejected'); post-fix the hook-free _mint override never calls it,
					// so the redeem must succeed. This is the case that fails if the
					// override is ever reverted.
					await provider.send('hardhat_setStorageAt', [
						mockAddress,
						ethers.toBeHex(0, 32),
						ethers.zeroPadValue('0x01', 32),
					]);
					expect(await mock.rejectTransfers()).to.be.true;

					await expect(mock.redeem(diamondAddress, childId, toWei('15')))
						.to.emit(geniusDiamond, 'Redeemed')
						.withArgs(mockAddress, childId, toWei('15'));

					expect(await mock.childBalance(diamondAddress, childId)).to.eq(toWei('25'));
					expect(await mock.gnusBalance(diamondAddress)).to.eq(toWei('15'));
				});
			});

			describe('no-custody receiver hooks', function () {
				it('reverts on direct single transfer to the diamond', async function () {
					const childId = await bootWithChild();
					await expect(
						signer1Diamond.safeTransferFrom(signer1, diamondAddress, childId, toWei('10'), '0x'),
					).to.be.revertedWith('GNUSRedeemAdapter: unexpected transfer');
				});

				it('reverts on batch transfer to the diamond', async function () {
					const childId = await bootWithChild();
					await expect(
						signer1Diamond.safeBatchTransferFrom(
							signer1,
							diamondAddress,
							[childId],
							[toWei('10')],
							'0x',
						),
					).to.be.revertedWith('GNUSRedeemAdapter: batch transfers not accepted');
				});
			});
		});
	}
});
