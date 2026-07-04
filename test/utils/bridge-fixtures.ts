import { ethers } from 'hardhat';

/**
 * Shared bridge test fixtures (Hardhat).
 *
 * Single source of truth for the constants used by bridge-related Hardhat tests
 * (`bridgeOut` / `BridgeOutInitiated`). Import these instead of redefining literals
 * per file — a future `bridgeOut` signature or value change should be a one-file edit.
 *
 * NOTE: `SGNS_DESTINATION` (the 32-byte X component) MUST stay in lockstep with the
 * matching `bytes32 SGNS_DESTINATION` constant in
 * `test/foundry/base/GeniusDiamondTestBase.sol` (both encode `0x1234` padded to 32 bytes).
 */

/** 32-byte X component of the SuperGenius destination public key (not an Ethereum address). */
export const SGNS_DESTINATION = ethers.zeroPadValue('0x1234', 32);

/** Parity of the destination key's Y component (false = even, true = odd). */
export const SGNS_DESTINATION_Y_ODD = false;

/**
 * Canonical destination chain id for bridge tests (Polygon).
 * Guaranteed `!=` the local Hardhat/anvil chain id, so `bridgeOut`'s same-chain guard passes.
 */
export const DEST_CHAIN_ID = 137;

/** Re-exported so bridge specs get every constant from one import (value defined in scripts/common). */
export { GNUS_TOKEN_ID } from '../../scripts/common';
