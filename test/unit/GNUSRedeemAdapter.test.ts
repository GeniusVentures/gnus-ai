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
import { Contract, JsonRpcProvider } from 'ethers';
import hre, { ethers } from 'hardhat';
import { multichain } from 'hardhat-multichain';
import { GeniusDiamond } from '../../diamond-typechain-types';
import { toWei } from '../../scripts/utils/helpers';

chai.use(chaiAsPromised);

/**
 * Phase 11 — GNUSRedeemAdapter unit tests (Plan 11-02).
 *
 * Pins PROXY-03 behaviorally:
 *   - happy path: direct-EOA redeem and proxy-mediated (contract-caller) redeem
 *   - full revert matrix (exact strings from GNUSRedeemAdapter.sol)
 *   - WR-07 limiter attribution to `from` (not the proxy, not the diamond)
 *   - super-admin bypass with raw-topic SuperAdminBypass assertion
 *   - receiver-hook enablement (happy path passing IS the Pitfall 1 regression)
 *   - batch rejection (stranded-custody defense, T-11-05)
 *   - loupe selector presence post-upgrade
 *   - no-custody invariant (diamond child balance == 0 after redeem)
 *
 * Suite names are literal grep targets for the Per-Task Verification Map in
 * 11-VALIDATION.md; do NOT rename.
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
			let signer2: string;
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
				signer2 = signers[2].address;
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
			 * rate 2e18, mint 100 child minions to signer1 (the user), and approve the
			 * diamond as ERC-1155 operator for signer1 so the redeem pull succeeds.
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
				// One-time operator approval: user approves the DIAMOND (never the proxy).
				await signer1Diamond.setApprovalForAll(diamondAddress, true);
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

			/**
			 * Deploy a fresh MockERC20Proxy pointed at the diamond, connected to `signer`.
			 */
			async function deployMockProxy(signer: SignerWithAddress): Promise<Contract> {
				const factory = await hre.ethers.getContractFactory(
					'contracts/gnus-ai/testing/MockERC20Proxy.sol:MockERC20Proxy',
					signer,
				);
				return factory.deploy(diamondAddress);
			}

			/**
			 * Deploy a malicious recipient whose onERC1155Received hook reenters
			 * redeem (CEI probe — the mint-leg hook must not enable a profitable
			 * reentrancy; limiter/approval state is already finalized by then).
			 */
			async function deployReenteringRecipient(): Promise<Contract> {
				const factory = await hre.ethers.getContractFactory('ReenteringRecipient');
				return factory.deploy(diamondAddress);
			}

			describe('happy path', function () {
				it('redeems child tokens for GNUS via the adapter (happy path)', async function () {
					const childId = await bootWithChild();

					const childBefore = await geniusDiamond['balanceOf(address,uint256)'](signer1, childId);
					const gnusBefore = await geniusDiamond['balanceOf(address,uint256)'](signer2, GNUS_TOKEN_ID);
					const supplyChildBefore = await geniusDiamond['totalSupply(uint256)'](childId);
					const supplyGnusBefore = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);

					await expect(signer1Diamond.redeem(signer1, childId, toWei('30'), signer2))
						.to.emit(geniusDiamond, 'RedeemedViaAdapter')
						.withArgs(signer1, signer1, childId, toWei('30'), signer2);

					expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, childId)).to.eq(
						childBefore - toWei('30'),
					);
					expect(await geniusDiamond['balanceOf(address,uint256)'](signer2, GNUS_TOKEN_ID)).to.eq(
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

				it('is callable by a contract (simulated external proxy)', async function () {
					const childId = await bootWithChild();
					const mockProxy = await deployMockProxy(signers[9]);

					const childBefore = await geniusDiamond['balanceOf(address,uint256)'](signer1, childId);
					const gnusBefore = await geniusDiamond['balanceOf(address,uint256)'](signer2, GNUS_TOKEN_ID);

					// The mock is driven by an unrelated third party (signers[9]) — the adapter
					// only cares that `from` approved the diamond as operator.
					await expect(
						mockProxy.connect(signers[9]).redeemOnBehalf(signer1, childId, toWei('20'), signer2),
					)
						.to.emit(geniusDiamond, 'RedeemedViaAdapter')
						.withArgs(await mockProxy.getAddress(), signer1, childId, toWei('20'), signer2);

					expect(childBefore - (await geniusDiamond['balanceOf(address,uint256)'](signer1, childId))).to.eq(
						toWei('20'),
					);
					expect((await geniusDiamond['balanceOf(address,uint256)'](signer2, GNUS_TOKEN_ID)) - gnusBefore).to.eq(
						toWei('20'),
					);
					expect(await geniusDiamond['balanceOf(address,uint256)'](diamondAddress, childId)).to.eq(0n);
				});

				it('redeem selector present on diamond (loupe check)', async function () {
					const redeemSelector = ethers.id('redeem(address,uint256,uint256,address)').slice(0, 10);
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
			});

			describe('revert matrix', function () {
				it('reverts when childId is GNUS_TOKEN_ID', async function () {
					const childId = await bootWithChild();
					await expect(
						signer1Diamond.redeem(signer1, GNUS_TOKEN_ID, toWei('10'), signer2),
					).to.be.revertedWith('Cannot redeem GNUS itself');
				});

				it('reverts when amount is zero', async function () {
					const childId = await bootWithChild();
					await expect(
						signer1Diamond.redeem(signer1, childId, 0n, signer2),
					).to.be.revertedWith('Amount must be greater than zero');
				});

				it('reverts when recipient is zero address', async function () {
					const childId = await bootWithChild();
					await expect(
						signer1Diamond.redeem(signer1, childId, toWei('10'), ethers.ZeroAddress),
					).to.be.revertedWith('ERC1155: mint to the zero address');
				});

				it('reverts when from is zero address', async function () {
					const childId = await bootWithChild();
					await expect(
						signer1Diamond.redeem(ethers.ZeroAddress, childId, toWei('10'), signer2),
					).to.be.revertedWith('ERC1155: transfer from the zero address');
				});

				it('reverts when child token is not created', async function () {
					await bootWithChild();
					await expect(
						signer1Diamond.redeem(signer1, 999n, toWei('10'), signer2),
					).to.be.revertedWith('Token not created.');
				});

				it('reverts when child token is nonConvertible', async function () {
					const childId = await bootWithNonConvertibleChild();
					await expect(
						signer1Diamond.redeem(signer1, childId, toWei('10'), signer2),
					).to.be.revertedWith('Token is non-convertible');
				});

				it('reverts when caller has insufficient balance', async function () {
					const childId = await bootWithChild();
					// signer1 has 100 child; try to redeem 200.
					await expect(
						signer1Diamond.redeem(signer1, childId, toWei('200'), signer2),
					).to.be.revertedWith('ERC1155: insufficient balance for transfer');
				});

				it('reverts when from has not approved the diamond as operator', async function () {
					const childId = await bootWithChild();
					const mockProxy = await deployMockProxy(signers[9]);
					// Revoke signer1's operator approval, then drive the redeem through the
					// mock proxy so the caller (proxy) is neither owner nor approved.
					await signer1Diamond.setApprovalForAll(diamondAddress, false);
					await expect(
						mockProxy.connect(signers[9]).redeemOnBehalf(signer1, childId, toWei('10'), signer2),
					).to.be.revertedWith('ERC1155: caller is not token owner or approved');
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

				it('reverts on direct (non-redeem) single transfer to the diamond (WR-01 hook gate)', async function () {
					const childId = await bootWithChild();
					await expect(
						signer1Diamond.safeTransferFrom(signer1, diamondAddress, childId, toWei('10'), '0x'),
					).to.be.revertedWith('GNUSRedeemAdapter: unexpected transfer');
				});
			});

			describe('withdrawal limiter (WR-07)', function () {
				it('charges the withdrawal limiter against from, not the proxy or the diamond', async function () {
					const childId = await bootWithChild();
					const mockProxy = await deployMockProxy(signers[9]);
					const proxyAddress = await mockProxy.getAddress();

					const userBefore = await geniusDiamond.getAccountWithdrawStatus(signer1);
					const proxyBefore = await geniusDiamond.getAccountWithdrawStatus(proxyAddress);
					const diamondBefore = await geniusDiamond.getAccountWithdrawStatus(diamondAddress);

					await mockProxy.connect(signers[9]).redeemOnBehalf(signer1, childId, toWei('25'), signer2);

					const userAfter = await geniusDiamond.getAccountWithdrawStatus(signer1);
					const proxyAfter = await geniusDiamond.getAccountWithdrawStatus(proxyAddress);
					const diamondAfter = await geniusDiamond.getAccountWithdrawStatus(diamondAddress);

					expect(userAfter.currentUsage - userBefore.currentUsage).to.eq(toWei('25'));
					expect(proxyAfter.currentUsage).to.eq(proxyBefore.currentUsage);
					expect(diamondAfter.currentUsage).to.eq(diamondBefore.currentUsage);
				});

				it('emits SuperAdminBypass when from is super admin (raw topic)', async function () {
					const childId = await bootWithChild();
					// Fund the owner with child tokens and approve the diamond.
					await ownerDiamond['mint(address,uint256,uint256,bytes)'](owner, childId, toWei('50'), '0x');
					await ownerDiamond.setApprovalForAll(diamondAddress, true);

					const ownerBefore = await geniusDiamond.getAccountWithdrawStatus(owner);

					const bypassTx = await ownerDiamond.redeem(owner, childId, toWei('10'), owner);
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

				it('reverts with the limiter-exceeded string when from exceeds the limit', async function () {
					const childId = await bootWithChild();
					// Tighten signer1's per-account limit to 30e18 so one redeem of 50
					// exceeds it; the charge must revert BEFORE the pull (CEI, T-11-01).
					await ownerDiamond.setAccountConfig(signer1, 0, 0, toWei('30'));

					// Charge exactly the limit first.
					await signer1Diamond.redeem(signer1, childId, toWei('30'), signer2);

					const userAfter = await geniusDiamond.getAccountWithdrawStatus(signer1);
					expect(userAfter.remainingCapacity).to.eq(0n);

					// The next redeem must hit the limiter — and the child balance must be
					// untouched, pinning charge-before-pull ordering.
					const childBefore = await geniusDiamond['balanceOf(address,uint256)'](signer1, childId);
					await expect(signer1Diamond.redeem(signer1, childId, toWei('10'), signer2)).to.be.revertedWith(
						'Withdrawal limit exceeded for time window',
					);
					expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, childId)).to.eq(childBefore);
					expect(await geniusDiamond['balanceOf(address,uint256)'](diamondAddress, childId)).to.eq(0n);
				});
			});

			describe('reentrancy (recipient hook)', function () {
				it('a reentering recipient cannot corrupt state via the mint-leg hook', async function () {
					const childId = await bootWithChild();
					const attacker = await deployReenteringRecipient();
					const attackerAddress = await attacker.getAddress();

					// Arm the hook to reenter redeem with signer1's params while the
					// mint-leg hook fires on the attacker as recipient.
					await attacker.armReentry(signer1, childId, toWei('5'));

					const childBefore = await geniusDiamond['balanceOf(address,uint256)'](signer1, childId);
					const gnusBefore = await geniusDiamond['balanceOf(address,uint256)'](attackerAddress, GNUS_TOKEN_ID);

					// Outer redeem must succeed even though the hook reenters. The reentrant
					// redeem does NOT revert (signer1 approved the DIAMOND as operator, so the
					// approval gate passes for any caller) — but it is equivalent to the
					// attacker calling redeem directly: no free mint, no custody, limiter
					// charged for every GNUS minted. This pins the CEI/no-state-corruption
					// invariant: outer 10 + reentrant 5 debited, 15 GNUS minted, all accounted.
					const limiterBefore = await geniusDiamond.getAccountWithdrawStatus(signer1);
					await signer1Diamond.redeem(signer1, childId, toWei('10'), attackerAddress);
					const limiterAfter = await geniusDiamond.getAccountWithdrawStatus(signer1);

					expect(await attacker.reentryAttempts()).to.eq(1n);
					// Exactly 10 (outer) + 5 (reentrant) GNUS minted — nothing extra.
					expect(
						(await geniusDiamond['balanceOf(address,uint256)'](attackerAddress, GNUS_TOKEN_ID)) - gnusBefore,
					).to.eq(toWei('15'));
					// Exactly 10 + 5 child tokens debited from signer1.
					expect(childBefore - (await geniusDiamond['balanceOf(address,uint256)'](signer1, childId))).to.eq(
						toWei('15'),
					);
					// Limiter charged for every minted GNUS (no under-charging via reentry).
					expect(limiterAfter.currentUsage - limiterBefore.currentUsage).to.eq(toWei('15'));
					// No-custody invariant holds through the reentrancy.
					expect(await geniusDiamond['balanceOf(address,uint256)'](diamondAddress, childId)).to.eq(0n);
				});
			});
		});
	}
});
