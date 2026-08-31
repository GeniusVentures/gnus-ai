import { ethers } from 'hardhat';
import { GeniusDiamond } from '../../diamond-typechain-types';

// keccak256("gnus.ai.treasury.storage") — GNUSTreasuryStorage layout base slot.
const TREASURY_STORAGE_SLOT = ethers.keccak256(ethers.toUtf8Bytes('gnus.ai.treasury.storage'));

/**
 * Declares the cross-suite protocol baseline for a suite running against the
 * shared LocalDiamondDeployer diamond: provenance seeded, chainID 0, bridgeFee 0.
 *
 * The deployer caches one diamond per process, so every suite in a single
 * `npx hardhat test` run mutates the same storage — this helper declares the
 * state each suite starts from instead of letting inherited mutations leak in.
 *
 * MUST be called in a suite's `before()` BEFORE `initialSnapshotId` is taken,
 * so every snapshot revert restores the declared baseline. Bridge suites that
 * need chainID = 31337 must re-alias `setChainID(31337n)` AFTER this call,
 * inside their own snapshot window.
 *
 * The one-shot `GNUSTreasury_SetSeedSupply(0n)` seed is probe-guarded on the
 * provenanceInitialized storage slot (base + 1) because it reverts with
 * "Already initialized" when a prior suite already seeded the cached diamond.
 *
 * The caller must be the LibDiamond contractOwner with DEFAULT_ADMIN_ROLE —
 * signer0 (the default-connected diamond) satisfies both roles on the local
 * shared diamond.
 *
 * @param geniusDiamond - Diamond instance connected to a signer holding
 * contractOwner + DEFAULT_ADMIN (signer0 / ownerDiamond).
 * @param diamondAddress - Address of the (shared) deployed diamond.
 * @returns A promise that resolves once the baseline state is declared.
 */
async function ensureDiamondTestBaseline(
	geniusDiamond: GeniusDiamond,
	diamondAddress: string,
): Promise<void> {
	const initialized = await ethers.provider.send('eth_getStorageAt', [
		diamondAddress,
		ethers.toBeHex(BigInt(TREASURY_STORAGE_SLOT) + 1n, 32),
	]);
	if (BigInt(initialized) === 0n) {
		await geniusDiamond.GNUSTreasury_SetSeedSupply(0n);
	}
	await geniusDiamond.setChainID(0);
	await geniusDiamond.updateBridgeFee(0);
}

export { ensureDiamondTestBaseline, TREASURY_STORAGE_SLOT };
