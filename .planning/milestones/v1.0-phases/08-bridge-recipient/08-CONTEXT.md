# Phase 8: Bridge Recipient Parameter

**Date:** 2026-06-15
**Status:** Decided
**Priority:** P0 (unblocks testing)
**Assignee:** @Am0rfu5
**Reviewer:** @Super-Genius

## Domain

Add a SuperGenius destination public key parameter to `bridgeOut()` so the bridge knows where to deliver tokens on the destination chain. Currently `bridgeOut()` emits the sender as the source but has no recipient — testing cross-chain flows is blocked.

## Canonical Refs

- [GNUSBridge.sol](../../contracts/gnus-ai/GNUSBridge.sol) — lines 177-191 (`bridgeOut`), lines 38-44 (`BridgeSourceBurned` event)
- [ROADMAP.md](../ROADMAP.md) — Phase 8
- [Update-Smart-Contracts-Architecture.md](https://github.com/GeniusVentures/TokenContracts/blob/develop/.planning/Update-Smart-Contracts-Architecture.md) — Bridge message structure section
- [gnus-ai#60](https://github.com/GeniusVentures/gnus-ai/issues/60) — Tracking issue

## Decisions

### 1. Destination parameter type: `bytes calldata`, 64 bytes

**Decision:** `bytes calldata sgnsDestination` — a 64-byte SuperGenius public key.

SuperGenius uses 64-byte public keys, not 20-byte Ethereum addresses. Using `bytes calldata` is gas-optimal for external functions (no memory copy). `calldata` is read-only which is correct — we only validate and emit.

**Rejected:** `address recipient` — Ethereum addresses don't map to SuperGenius keys. Would need a separate registry or resolver.

### 2. Validation: require exactly 64 bytes

**Decision:** `require(sgnsDestination.length == 64, "Invalid destination key length");`

Must guard against empty or malformed keys. 64 bytes is the SuperGenius public key size.

### 3. Parameter ordering: appended to end

**Decision:** New signature is:

```solidity
function bridgeOut(
    uint256 amount,
    uint256 id,
    uint256 destChainID,
    bytes calldata sgnsDestination
) external
```

Keeps existing parameters in order. `sgnsDestination` is appended — minimal diff, backward-incompatible but all callers must update regardless.

### 4. Event: add `sgnsDestination` field

**Decision:** Updated event:

```solidity
event BridgeSourceBurned(
    address indexed sender,
    uint256 id,
    uint256 amount,
    uint256 srcChainID,
    uint256 destChainID,
    bytes sgnsDestination
);
```

`bytes` in events is stored as-is (not indexed — Solidity cannot index `bytes`). This is acceptable since bridge observers scan all events anyway.

## Code Context

### Current code (GNUSBridge.sol:38-44, 177-191)

```solidity
event BridgeSourceBurned(
    address indexed sender,
    uint256 id,
    uint256 amount,
    uint256 srcChainID,
    uint256 destChainID
);

function bridgeOut(uint256 amount, uint256 id, uint256 destChainID) external {
    address sender = _msgSender();
    require(GNUSNFTFactoryStorage.layout().NFTs[id].nftCreated, "Token not created.");
    require(balanceOf(sender, id) >= amount, "Insufficient tokens.");
    require(destChainID != GNUSControlStorage.layout().chainID, "Cannot bridge to same chain");
    _burn(sender, id, amount);
    emit BridgeSourceBurned(
        sender,
        id,
        amount,
        GNUSControlStorage.layout().chainID,
        destChainID
    );
}
```

### Target code

```solidity
event BridgeSourceBurned(
    address indexed sender,
    uint256 id,
    uint256 amount,
    uint256 srcChainID,
    uint256 destChainID,
    bytes sgnsDestination
);

function bridgeOut(
    uint256 amount,
    uint256 id,
    uint256 destChainID,
    bytes calldata sgnsDestination
) external {
    address sender = _msgSender();
    require(GNUSNFTFactoryStorage.layout().NFTs[id].nftCreated, "Token not created.");
    require(balanceOf(sender, id) >= amount, "Insufficient tokens.");
    require(destChainID != GNUSControlStorage.layout().chainID, "Cannot bridge to same chain");
    require(sgnsDestination.length == 64, "Invalid destination key length");
    _burn(sender, id, amount);
    emit BridgeSourceBurned(
        sender,
        id,
        amount,
        GNUSControlStorage.layout().chainID,
        destChainID,
        sgnsDestination
    );
}
```

## What's NOT in this phase

- Lock/release vault model — that's Phase 10
- Bridge state machine — Phase 10
- Replay protection — Phase 10
- Cross-chain supply tracking — Phase 12
- Changing burn to lock — Phase 10

This phase ONLY adds the destination parameter. It keeps the existing burn model. The architectural change to lock/release happens in Phase 10.

## Success Criteria

1. `bridgeOut()` accepts `bytes calldata sgnsDestination` (64-byte SG public key)
2. `require(sgnsDestination.length == 64)` validation in place
3. `BridgeSourceBurned` event includes `sgnsDestination` field
4. All existing callers updated for new signature
5. Tests: bridge out with valid 64-byte key, revert on wrong-length key
