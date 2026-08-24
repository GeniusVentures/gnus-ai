import {
	LocalDiamondDeployer,
	loadDiamondContract,
} from '@geniusventures/hardhat-diamonds/dist/utils';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { Wallet } from 'ethers';
import type { HDNodeWallet } from 'ethers';
import { GeniusDiamond } from '../../diamond-typechain-types';
import { toWei } from '../../scripts/utils/helpers';
import {
	BridgeInMessage,
	aggregateCertificate,
	buildValidatorMerkleTree,
	computeBridgeInStructHash,
	signBridgeInCertificate,
} from '../utils/bridge-certificate';
import { setupLifecyclePolicyLinking } from '../../scripts/utils/GNUSLifecyclePolicyLinking';

/**
 * Phase 10 unit tests — GNUSBridge.bridgeIn + setValidatorSet.
 *
 * Mirrors the LocalDiamondDeployer / snapshot / treasury-seed scaffold in
 * `test/unit/GNUSBridgeEnhanced.test.ts`. Validator keys are generated
 * deterministically (Wallet.createRandom in a fixed seed order is NOT
 * deterministic — we use three freshly created random wallets per suite run,
 * then build the merkle tree on the resulting addresses). The canonical test
 * vector at the bottom of the file uses a HARDCODED private key so the SG-side
 * `SignEVM` cross-check has a stable reference.
 *
 * Revert strings asserted below must match `contracts/gnus-ai/GNUSBridge.sol`
 * exactly — see Plan 10-02 SUMMARY for the authoritative list.
 */
describe('GNUSBridge bridgeIn', function () {
	// keccak256("gnus.ai.treasury.storage") — GNUSTreasuryStorage layout base slot
	const TREASURY_STORAGE_SLOT = ethers.keccak256(ethers.toUtf8Bytes('gnus.ai.treasury.storage'));

	// Hardhat's well-known account #0 private key — ONLY used for the canonical
	// cross-repo test vector (the last `it` block). NEVER used to send transactions.
	const CANONICAL_TEST_PRIVATE_KEY =
		'0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

	let geniusDiamond: GeniusDiamond;
	let owner: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let user3: SignerWithAddress;
	let initialSnapshotId: string;
	let snapshotId: string;

	let diamondAddress: string;
	let localChainId: bigint;
	let validator1: HDNodeWallet;
	let validator2: HDNodeWallet;
	let validator3: HDNodeWallet;
	let nonValidator: HDNodeWallet;
	let validatorRoot: string;
	let validatorProofs: Map<string, string[]>;
	// 2-of-3 validator set — threshold used across all happy-path and revert tests.
	const VALIDATOR_THRESHOLD = 2n;

	before(async function () {
				// 13-04: deploy GNUSLifecyclePolicy library + install factory linker before diamond deploy.
				await setupLifecyclePolicyLinking();
		const config = {
			diamondName: 'GeniusDiamond',
			network: 'hardhat',
		};

		const deployer = await LocalDiamondDeployer.getInstance(hre, config);
		const diamond = await deployer.getDiamondDeployed();
		const deployedData = diamond.getDeployedDiamondData();
		diamondAddress = deployedData.DiamondAddress || '';

		geniusDiamond = await loadDiamondContract<GeniusDiamond>(diamond, diamondAddress, hre.ethers);

		[owner, user1, user2, user3] = await ethers.getSigners();

		// Seed the provenance counter so the global-cap check in _mintWithBridgeFee
		// can run (reverts when uninitialized, Phase 9 D8/Pitfall 4). Guarded by a
		// storage probe so re-runs against a cached diamond don't revert.
		const initialized = await hre.network.provider.send('eth_getStorageAt', [
			diamondAddress,
			ethers.toBeHex(BigInt(TREASURY_STORAGE_SLOT) + 1n, 32),
		]);
		if (BigInt(initialized) === 0n) {
			await geniusDiamond.GNUSTreasury_SetSeedSupply(0n);
		}

		// Record the live chain id — used as destChainID in every certificate so
		// the diamond's `require(block.chainid == chainID)` passes.
		const network = await ethers.provider.getNetwork();
		localChainId = network.chainId;
		// Point the diamond's chainID at the live chain so bridgeIn's D-08 check passes.
		await geniusDiamond.setChainID(localChainId);

		// Build a 3-validator set. Fresh random wallets per suite run are fine —
		// the merkle tree is constructed after creation, and the suite has its
		// own snapshot isolation. No relationship to Hardhat accounts.
		validator1 = Wallet.createRandom();
		validator2 = Wallet.createRandom();
		validator3 = Wallet.createRandom();
		nonValidator = Wallet.createRandom();

		const tree = buildValidatorMerkleTree([
			validator1.address,
			validator2.address,
			validator3.address,
		]);
		validatorRoot = tree.root;
		validatorProofs = tree.proofs;

		initialSnapshotId = await hre.network.provider.send('evm_snapshot');
	});

	beforeEach(async function () {
		snapshotId = await hre.network.provider.send('evm_snapshot');
	});

	afterEach(async function () {
		await hre.network.provider.send('evm_revert', [snapshotId]);
	});

	after(async function () {
		await hre.network.provider.send('evm_revert', [initialSnapshotId]);
	});

	/**
	 * Builds a certificate for the given parameters:
	 *  1. Computes the BridgeInMessage using the LIVE chain id and diamond address.
	 *  2. Signs with each wallet.
	 *  3. Sorts the sigs strictly ascending by recovered address (aggregateCertificate).
	 *  4. Returns sorted sigs + parallel merkle proofs (one per sorted sig) + structHash.
	 *
	 * Overriding `destChainID` or `diamondAddress` produces a digest the diamond
	 * will reject — used by the wrong-chain and cross-diamond revert tests.
	 */
	async function buildCertificate(
		transferId: string,
		srcChainID: bigint,
		recipient: string,
		amount: bigint,
		signers: HDNodeWallet[],
		overrides?: Partial<Pick<BridgeInMessage, 'destChainID' | 'diamondAddress'>>,
	): Promise<{ sortedSigs: string[]; merkleProofs: string[][]; structHash: string }> {
		const message: BridgeInMessage = {
			transferId,
			srcChainID,
			destChainID: overrides?.destChainID ?? localChainId,
			diamondAddress: overrides?.diamondAddress ?? diamondAddress,
			recipient,
			tokenId: 0n,
			amount,
		};
		const structHash = computeBridgeInStructHash(message);
		const sigs = await Promise.all(signers.map((w) => signBridgeInCertificate(w, message)));
		const sortedSigs = await aggregateCertificate(sigs, structHash);

		// Recover each sorted sig's signer and pull its merkle proof — the proofs
		// array MUST be parallel to sortedSigs for _verifyThresholdCertificate.
		const digest = ethers.hashMessage(ethers.getBytes(structHash));
		const merkleProofs = sortedSigs.map((sig) => {
			const addr = ethers.recoverAddress(digest, sig).toLowerCase();
			const proof = validatorProofs.get(addr);
			if (proof === undefined) {
				throw new Error(`No proof for signer ${addr} — not in validator set`);
			}
			return proof;
		});

		return { sortedSigs, merkleProofs, structHash };
	}

	/** Convenience: configure the validator set from owner with the default threshold. */
	async function configureValidatorSet(): Promise<void> {
		await geniusDiamond.setValidatorSet(validatorRoot, VALIDATOR_THRESHOLD);
	}

	describe('setValidatorSet', function () {
		it('reverts "Only SuperAdmin allowed" when called by non-owner', async function () {
			await expect(
				geniusDiamond.connect(user1).setValidatorSet(validatorRoot, VALIDATOR_THRESHOLD),
			).to.be.revertedWith('Only SuperAdmin allowed');
		});

		it('succeeds from owner and emits ValidatorSetUpdated with old/new root + thresholds', async function () {
			const newRoot = ethers.keccak256(ethers.toUtf8Bytes('new-root'));
			await expect(geniusDiamond.setValidatorSet(newRoot, 3n))
				.to.emit(geniusDiamond, 'ValidatorSetUpdated')
				.withArgs(ethers.ZeroHash, newRoot, 0n, 3n);
		});

		it('emits the OLD root + OLD threshold on rotation (D-18 multisig audit trail)', async function () {
			await configureValidatorSet();
			const newRoot = ethers.keccak256(ethers.toUtf8Bytes('rotated-root'));
			await expect(geniusDiamond.setValidatorSet(newRoot, 2n))
				.to.emit(geniusDiamond, 'ValidatorSetUpdated')
				.withArgs(validatorRoot, newRoot, VALIDATOR_THRESHOLD, 2n);
		});

		it('reverts on zero root', async function () {
			await expect(geniusDiamond.setValidatorSet(ethers.ZeroHash, 2n)).to.be.revertedWith(
				'Invalid root',
			);
		});

		it('reverts on zero threshold', async function () {
			await expect(geniusDiamond.setValidatorSet(validatorRoot, 0n)).to.be.revertedWith(
				'Invalid threshold',
			);
		});
	});

	describe('bridgeIn — configuration guards', function () {
		it('reverts "Validator set not configured" when validatorThreshold == 0', async function () {
			// No setValidatorSet call — threshold defaults to 0.
			const transferId = ethers.keccak256(ethers.toUtf8Bytes('unconfigured'));
			const srcChainID = 137n;
			const amount = toWei(10);

			const { sortedSigs, merkleProofs } = await buildCertificate(
				transferId,
				srcChainID,
				user1.address,
				amount,
				[validator1, validator2],
			);

			await expect(
				geniusDiamond.bridgeIn(
					transferId,
					srcChainID,
					user1.address,
					amount,
					sortedSigs,
					merkleProofs,
				),
			).to.be.revertedWith('Validator set not configured');
		});

		it('reverts "Below threshold" when fewer than validatorThreshold signatures', async function () {
			await configureValidatorSet();
			const transferId = ethers.keccak256(ethers.toUtf8Bytes('below-threshold'));
			const srcChainID = 137n;
			const amount = toWei(10);

			// Only ONE signer, threshold is 2.
			const { sortedSigs, merkleProofs } = await buildCertificate(
				transferId,
				srcChainID,
				user1.address,
				amount,
				[validator1],
			);

			await expect(
				geniusDiamond.bridgeIn(
					transferId,
					srcChainID,
					user1.address,
					amount,
					sortedSigs,
					merkleProofs,
				),
			).to.be.revertedWith('Below threshold');
		});
	});

	describe('bridgeIn — happy path', function () {
		it('mints on valid certificate, emits BridgeReleased, sets processedMessages', async function () {
			await configureValidatorSet();
			const transferId = ethers.keccak256(ethers.toUtf8Bytes('happy-path'));
			const srcChainID = 137n;
			const amount = toWei(100);

			const { sortedSigs, merkleProofs } = await buildCertificate(
				transferId,
				srcChainID,
				user1.address,
				amount,
				[validator1, validator2, validator3],
			);

			const tx = await geniusDiamond.bridgeIn(
				transferId,
				srcChainID,
				user1.address,
				amount,
				sortedSigs,
				merkleProofs,
			);

			// BridgeReleased carries PRE-FEE amount (matches BridgeOutInitiated semantics).
			await expect(tx)
				.to.emit(geniusDiamond, 'BridgeReleased')
				.withArgs(transferId, user1.address, amount, srcChainID, localChainId);

			// Default bridge fee is 0 — recipient receives the full amount.
			const balance = await geniusDiamond['balanceOf(address)'](user1.address);
			expect(balance).to.equal(amount);
		});

		it('applies bridge fee: recipient receives post-fee amount, event emits pre-fee amount', async function () {
			await configureValidatorSet();
			// 10% bridge fee (100 out of FEE_DENOMINATOR=1000).
			await geniusDiamond.updateBridgeFee(100);

			const transferId = ethers.keccak256(ethers.toUtf8Bytes('bridge-fee'));
			const srcChainID = 137n;
			const amount = toWei(100);

			const { sortedSigs, merkleProofs } = await buildCertificate(
				transferId,
				srcChainID,
				user1.address,
				amount,
				[validator1, validator2, validator3],
			);

			const tx = await geniusDiamond.bridgeIn(
				transferId,
				srcChainID,
				user1.address,
				amount,
				sortedSigs,
				merkleProofs,
			);

			// Event carries PRE-FEE amount per BridgeOutInitiated parity.
			await expect(tx)
				.to.emit(geniusDiamond, 'BridgeReleased')
				.withArgs(transferId, user1.address, amount, srcChainID, localChainId);

			// Recipient receives amount * (1000 - 100) / 1000 = 90.
			const balance = await geniusDiamond['balanceOf(address)'](user1.address);
			expect(balance).to.equal(toWei(90));
		});

		it('increments chainSupply[block.chainid] and globalSupply by the post-fee amount', async function () {
			await configureValidatorSet();
			const transferId = ethers.keccak256(ethers.toUtf8Bytes('chain-supply'));
			const srcChainID = 137n;
			const amount = toWei(50);

			const { sortedSigs, merkleProofs } = await buildCertificate(
				transferId,
				srcChainID,
				user1.address,
				amount,
				[validator1, validator2, validator3],
			);

			// `chainSupply` is not exposed via a public reader on the diamond ABI
			// (GNUSTreasury only exposes `totalSupplyOfAll`); the two writes happen
			// in the same `_mintWithBridgeFee` block (GNUSBridge.sol:130-132), so
			// observing the global delta is sufficient evidence the per-chain delta
			// was applied. Foundry invariant coverage (Plan 10-04) asserts the
			// per-chain partition directly via storage reads.
			const globalSupplyBefore = await geniusDiamond.totalSupplyOfAll();

			await geniusDiamond.bridgeIn(
				transferId,
				srcChainID,
				user1.address,
				amount,
				sortedSigs,
				merkleProofs,
			);

			const globalSupplyAfter = await geniusDiamond.totalSupplyOfAll();

			// No bridge fee set — post-fee == pre-fee.
			expect(globalSupplyAfter - globalSupplyBefore).to.equal(amount);
		});
	});

	describe('bridgeIn — replay + authorization', function () {
		it('reverts "Message already processed" on replay with same transferId', async function () {
			await configureValidatorSet();
			const transferId = ethers.keccak256(ethers.toUtf8Bytes('replay'));
			const srcChainID = 137n;
			const amount = toWei(10);

			const { sortedSigs, merkleProofs } = await buildCertificate(
				transferId,
				srcChainID,
				user1.address,
				amount,
				[validator1, validator2],
			);

			// First call succeeds.
			await geniusDiamond.bridgeIn(
				transferId,
				srcChainID,
				user1.address,
				amount,
				sortedSigs,
				merkleProofs,
			);

			// Second call with same transferId reverts.
			await expect(
				geniusDiamond.bridgeIn(
					transferId,
					srcChainID,
					user1.address,
					amount,
					sortedSigs,
					merkleProofs,
				),
			).to.be.revertedWith('Message already processed');
		});

		it('reverts on wrong destination chain (certificate signed for different destChainID)', async function () {
			await configureValidatorSet();
			const transferId = ethers.keccak256(ethers.toUtf8Bytes('wrong-chain'));
			const srcChainID = 137n;
			const amount = toWei(10);

			// Sign with a destChainID that doesn't match the live chain — the diamond
			// computes the digest with block.chainid, so the recovered signers will
			// NOT match the merkle root.
			const wrongDestChainId = 999n;
			const { sortedSigs, merkleProofs } = await buildCertificate(
				transferId,
				srcChainID,
				user1.address,
				amount,
				[validator1, validator2],
				{ destChainID: wrongDestChainId },
			);

			// Reverts during verification — could be "Bad signature" (tryRecover fails)
			// or "Not a registered validator" (recovered address not in merkle root).
			// Don't pin the exact string — the digest mismatch is the behavior under test.
			await expect(
				geniusDiamond.bridgeIn(
					transferId,
					srcChainID,
					user1.address,
					amount,
					sortedSigs,
					merkleProofs,
				),
			).to.be.reverted;
		});

		it('reverts on cross-diamond replay (certificate signed for a different diamond)', async function () {
			await configureValidatorSet();
			const transferId = ethers.keccak256(ethers.toUtf8Bytes('cross-diamond'));
			const srcChainID = 137n;
			const amount = toWei(10);

			// Sign as if targeting a different diamond address — digest mismatch.
			const otherDiamond = Wallet.createRandom().address;
			const { sortedSigs, merkleProofs } = await buildCertificate(
				transferId,
				srcChainID,
				user1.address,
				amount,
				[validator1, validator2],
				{ diamondAddress: otherDiamond },
			);

			await expect(
				geniusDiamond.bridgeIn(
					transferId,
					srcChainID,
					user1.address,
					amount,
					sortedSigs,
					merkleProofs,
				),
			).to.be.reverted;
		});

		it('reverts "Signers not strictly ascending" when signatures are out of order', async function () {
			await configureValidatorSet();
			const transferId = ethers.keccak256(ethers.toUtf8Bytes('unsorted'));
			const srcChainID = 137n;
			const amount = toWei(10);

			const { sortedSigs, merkleProofs } = await buildCertificate(
				transferId,
				srcChainID,
				user1.address,
				amount,
				[validator1, validator2],
			);

			// Reverse the sorted array to break strict-ascending — reverse proofs too
			// so the revert comes from the ordering check, not from merkle verification.
			const reversedSigs = [...sortedSigs].reverse();
			const reversedProofs = [...merkleProofs].reverse();

			await expect(
				geniusDiamond.bridgeIn(
					transferId,
					srcChainID,
					user1.address,
					amount,
					reversedSigs,
					reversedProofs,
				),
			).to.be.revertedWith('Signers not strictly ascending');
		});

		it('reverts "Signers not strictly ascending" on duplicate signer', async function () {
			await configureValidatorSet();
			const transferId = ethers.keccak256(ethers.toUtf8Bytes('duplicate-signer'));
			const srcChainID = 137n;
			const amount = toWei(10);

			// Sign with validator1 TWICE — bypass aggregateCertificate (which would
			// throw on duplicates) by calling signBridgeInCertificate directly.
			const message: BridgeInMessage = {
				transferId,
				srcChainID,
				destChainID: localChainId,
				diamondAddress,
				recipient: user1.address,
				tokenId: 0n,
				amount,
			};
			const sig1 = await signBridgeInCertificate(validator1, message);
			const proof1 = validatorProofs.get(validator1.address.toLowerCase());
			if (proof1 === undefined) {
				throw new Error('validator1 proof missing');
			}

			// Submit the same signature twice — strictly-ascending check rejects.
			await expect(
				geniusDiamond.bridgeIn(
					transferId,
					srcChainID,
					user1.address,
					amount,
					[sig1, sig1],
					[proof1, proof1],
				),
			).to.be.revertedWith('Signers not strictly ascending');
		});

		it('reverts "Not a registered validator" when a signer is not in the merkle root', async function () {
			await configureValidatorSet();
			const transferId = ethers.keccak256(ethers.toUtf8Bytes('non-validator'));
			const srcChainID = 137n;
			const amount = toWei(10);

			// Build a certificate with one real validator + one NON-validator.
			// The non-validator has no proof — we give it validator1's proof, which
			// will fail merkle verification for the recovered (non-validator) address.
			const message: BridgeInMessage = {
				transferId,
				srcChainID,
				destChainID: localChainId,
				diamondAddress,
				recipient: user1.address,
				tokenId: 0n,
				amount,
			};
			const structHash = computeBridgeInStructHash(message);
			const sigs = await Promise.all([
				signBridgeInCertificate(validator1, message),
				signBridgeInCertificate(nonValidator, message),
			]);
			// Sort the sigs — but bypass aggregateCertificate's duplicate check
			// (signers are distinct, so it won't throw) and then attach validator1's
			// proof to BOTH (the non-validator's proof doesn't exist).
			const sortedSigs = await aggregateCertificate(sigs, structHash);
			const digest = ethers.hashMessage(ethers.getBytes(structHash));
			const proof1 = validatorProofs.get(validator1.address.toLowerCase());
			if (proof1 === undefined) {
				throw new Error('validator1 proof missing');
			}
			const sortedProofs = sortedSigs.map((sig) => {
				const addr = ethers.recoverAddress(digest, sig).toLowerCase();
				if (addr === validator1.address.toLowerCase()) {
					return proof1;
				}
				// Non-validator — give it proof1 (which won't verify against the
				// non-validator's address leaf). This is what we want to assert on.
				return proof1;
			});

			await expect(
				geniusDiamond.bridgeIn(
					transferId,
					srcChainID,
					user1.address,
					amount,
					sortedSigs,
					sortedProofs,
				),
			).to.be.revertedWith('Not a registered validator');
		});
	});

	describe('bridgeIn — pause + cap', function () {
		it('reverts "GNUSControl: contract paused" when the diamond is paused', async function () {
			await configureValidatorSet();
			const transferId = ethers.keccak256(ethers.toUtf8Bytes('paused'));
			const srcChainID = 137n;
			const amount = toWei(10);

			const { sortedSigs, merkleProofs } = await buildCertificate(
				transferId,
				srcChainID,
				user1.address,
				amount,
				[validator1, validator2],
			);

			// Pause the diamond (snapshot isolation will revert this).
			await geniusDiamond.emergencyPause();

			await expect(
				geniusDiamond.bridgeIn(
					transferId,
					srcChainID,
					user1.address,
					amount,
					sortedSigs,
					merkleProofs,
				),
			).to.be.revertedWith('GNUSControl: contract paused');
		});

		it('reverts "Global max supply exceeded" when the mint would push globalSupply above the cap', async function () {
			await configureValidatorSet();
			// GNUS_MAX_SUPPLY is 50_000_000 * 10^18. Use an amount that puts
			// globalSupply + amount > GNUS_MAX_SUPPLY without needing to seed
			// globalSupply near the cap (the fee-adjusted amount still trips the check).
			const transferId = ethers.keccak256(ethers.toUtf8Bytes('global-cap'));
			const srcChainID = 137n;
			// 50 million + 1 wei exceeds the cap on its own.
			const amount = toWei(50000000) + 1n;

			const { sortedSigs, merkleProofs } = await buildCertificate(
				transferId,
				srcChainID,
				user1.address,
				amount,
				[validator1, validator2],
			);

			await expect(
				geniusDiamond.bridgeIn(
					transferId,
					srcChainID,
					user1.address,
					amount,
					sortedSigs,
					merkleProofs,
				),
			).to.be.revertedWith('Global max supply exceeded');
		});
	});

	describe('D-18 manual Super Admin bridge-in regression', function () {
		it('existing 2-arg mint(address,uint256) continues to work alongside the certificate path', async function () {
			// The manual Super Admin bridge-in path (D-18) uses the 2-arg mint. This
			// test is a regression check — Phase 10 must NOT have broken it.
			const amount = toWei(25);
			await geniusDiamond['mint(address,uint256)'](user1.address, amount);
			const balance = await geniusDiamond['balanceOf(address)'](user1.address);
			expect(balance).to.equal(amount);
		});
	});

	describe('cross-repo test vector (Pitfall 1 / Pitfall 3)', function () {
		it('emits a canonical test vector for SG-side SignEVM cross-check', async function () {
			// Fixed test vector — SG-side C++ `SignEVM` (see 10-RESEARCH.md §Code
			// Examples) MUST produce byte-identical output for the same inputs.
			const canonicalWallet = new Wallet(CANONICAL_TEST_PRIVATE_KEY);
			const message: BridgeInMessage = {
				// Hardcoded transferId — arbitrary but fixed.
				transferId: ethers.zeroPadValue('0x1234', 32),
				srcChainID: 1n,
				destChainID: 31337n, // Hardhat chain id
				diamondAddress: '0x1111111111111111111111111111111111111111',
				recipient: '0x2222222222222222222222222222222222222222',
				tokenId: 0n,
				amount: 1000n,
			};

			const structHash = computeBridgeInStructHash(message);
			const signature = await signBridgeInCertificate(canonicalWallet, message);
			const digest = ethers.hashMessage(ethers.getBytes(structHash));
			const recoveredSigner = ethers.recoverAddress(digest, signature);
			const expectedSigner = canonicalWallet.address;
			const leaf = ethers.keccak256(
				ethers.solidityPacked(['address'], [canonicalWallet.address]),
			);

			// Log the vector for SG-side cross-check.
			// eslint-disable-next-line no-console
			console.log('=== Canonical bridge-in test vector (SG SignEVM cross-check) ===');
			// eslint-disable-next-line no-console
			console.log(`  transferId:      ${message.transferId}`);
			// eslint-disable-next-line no-console
			console.log(`  srcChainID:      ${message.srcChainID}`);
			// eslint-disable-next-line no-console
			console.log(`  destChainID:     ${message.destChainID}`);
			// eslint-disable-next-line no-console
			console.log(`  diamondAddress:  ${message.diamondAddress}`);
			// eslint-disable-next-line no-console
			console.log(`  recipient:       ${message.recipient}`);
			// eslint-disable-next-line no-console
			console.log(`  tokenId:         ${message.tokenId}`);
			// eslint-disable-next-line no-console
			console.log(`  amount:          ${message.amount}`);
			// eslint-disable-next-line no-console
			console.log(`  structHash:      ${structHash}`);
			// eslint-disable-next-line no-console
			console.log(`  digest(EIP-191): ${digest}`);
			// eslint-disable-next-line no-console
			console.log(`  signature:       ${signature}`);
			// eslint-disable-next-line no-console
			console.log(`  signer:          ${recoveredSigner}`);
			// eslint-disable-next-line no-console
			console.log(`  merkle leaf:     ${leaf}`);

			expect(recoveredSigner.toLowerCase()).to.equal(expectedSigner.toLowerCase());
		});
	});
});
