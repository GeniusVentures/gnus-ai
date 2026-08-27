// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase, IGNUSBridgeOut} from "../base/GeniusDiamondTestBase.sol";
import {NFT} from "../../../contracts/gnus-ai/GNUSNFTFactoryStorage.sol";
import {BridgeMessage} from "../../../contracts/gnus-ai/GNUSBridgeAttestor.sol";
import {console} from "forge-std/console.sol";

/**
 * @title GeniusDiamondHandler
 * @notice Handler contract for stateful invariant testing
 * @dev Provides bounded action handlers with ghost variable tracking
 */
contract GeniusDiamondHandler is GeniusDiamondTestBase {
    // Ghost variables to track expected state
    uint256 public ghost_totalMinted;
    uint256 public ghost_totalBurned;
    // Phase 9 (09-05): SUM burned via the MINTER_ROLE GNUSBridge.burn path
    // (the ONLY burn that decrements the globalSupply provenance counter).
    // User-initiated ERC1155Burnable.burn does NOT touch globalSupply.
    uint256 public ghost_totalAdminBurned;
    uint256 public ghost_totalTransfers;
    uint256 public ghost_totalApprovals;
    uint256 public ghost_totalCollectionsCreated;
    uint256 public ghost_totalBridgeDeposits;
    // Phase 9 (09-05): SUM of amounts actually burned by bridgeOut (I1 conservation
    // needs the quantity, not just the call count). Distinct from ghost_totalBridgeDeposits
    // which is a successful-call counter used elsewhere for coverage metrics.
    uint256 public ghost_totalBridgedOutAmount;
    uint256 public ghost_totalBridgeWithdrawals;
    // Phase 9 (09-01): conversion-native model — count of successful convert() calls
    uint256 public ghost_convertCalls;
    // Phase 9 (09-05): ids of child tokens actually created by handler_createNFT —
    // convert/depth-gate bounding draws from this set only (T-09-28).
    uint256[] public ghost_createdIds;

    // Phase 10 (10-04): bridgeIn ghost state for the Foundry invariant suite.
    // ghost_bridgeInCalls counts every attempt (success + revert) so the afterInvariant
    // coverage guard can prove the fuzzer actually reached the path (T-10-F01).
    // ghost_bridgeInSuccesses / ghost_totalBridgedInAmount / ghost_releasedIds(List)
    // only update when the diamond call succeeded — the invariant_noValidCertFromFuzzedSigs
    // soundness property asserts ghost_bridgeInSuccesses stays at zero for the random-cert
    // campaign (BRIDGE-03). Phase 15 (15-04): the replay keys are now V2 messageIds.
    uint256 public ghost_bridgeInCalls;
    uint256 public ghost_bridgeInSuccesses;
    uint256 public ghost_totalBridgedInAmount;
    mapping(bytes32 => bool) public ghost_releasedIds;
    bytes32[] public ghost_releasedIdsList;

    // Phase 15 (15-04): V2 composite replay-key domain — must equal the private
    // constant in GNUSBridgeAttestor.sol so the handler-derived messageId matches
    // the on-chain _bridgeMessageId (keeps the invariant slot formula in lockstep).
    bytes32 private constant GNUS_BRIDGE_MESSAGE_ID_V2 = keccak256("GNUS_BRIDGE_MESSAGE_ID_V2");

    // Phase 10 (IN-03): dedicated role-op counter. Previously handler_grantRole
    // incremented ghost_totalCollectionsCreated, corrupting any invariant that
    // interprets that ghost as actual collection creations.
    uint256 public ghost_roleOps;

    // Action counters for call summary
    uint256 public calls_transfer;
    uint256 public calls_approve;
    uint256 public calls_mint;
    uint256 public calls_burn;
    uint256 public calls_createCollection;
    uint256 public calls_bridgeDeposit;
    uint256 public calls_grantRole;
    uint256 public calls_revokeRole;
    uint256 public calls_mint1155;
    uint256 public calls_burn1155;
    uint256 public calls_createNFT;
    uint256 public calls_factoryMint;

    // Track actors
    address[] public actors;
    address internal currentActor;

    /**
     * @notice Setup handler
     */
    function setUp() public override {
        super.setUp();

        // Initialize actor list
        actors.push(address(this));
        actors.push(user1);
        actors.push(user2);
        actors.push(user3);

        console.log("===== GeniusDiamond Stateful Handler =====");
        console.log("Diamond:", diamond);
        console.log("Actors:", actors.length);
        console.log("=========================================");
    }

    /**
     * @notice Deterministically perform one full create→mint→convert cycle.
     * @dev The fuzz campaign is shallow (runs/depth) and draws ids randomly, so a
     *      successful convert is not guaranteed by fuzzing alone — yet the coverage
     *      assertion in afterInvariant requires ghost_convertCalls >= 1 (Codex P2).
     *      This seeds exactly one convert so the guard holds regardless of fuzz luck.
     *      All steps are the proven-working sequence: create a direct-child NFT of
     *      GNUS, factory-mint it to the handler (burns handler GNUS 1:1), then convert
     *      a portion child→GNUS. Supply-neutral overall (mint burn/mint cancel; convert
     *      moves supply between ids), so I1/I2 accounting is unaffected. Records into
     *      ghost_createdIds and ghost_convertCalls exactly as the fuzz handlers do.
     */
    function seedConversion() public {
        // Create one direct-child NFT of GNUS (handler is admin; passes the gate).
        uint256 childId = _getChildCurIndex(GNUS_TOKEN_ID);
        if (childId == 0) {
            return; // parent info unreadable — leave ghosts untouched
        }
        (bool created, ) = diamond.call(
            abi.encodeWithSignature(
                "createNFT(uint256,string,string,uint256,uint256,string)",
                GNUS_TOKEN_ID,
                "Seed Child",
                "SCHILD",
                uint256(1),
                uint256(1e12),
                ""
            )
        );
        if (!created) {
            return;
        }
        ghost_createdIds.push(childId);

        // Factory-mint the child to the handler (burns the handler's GNUS 1:1).
        uint256 seedAmount = 100;
        if (_getGNUSBalance(address(this)) < seedAmount) {
            _mintGNUS(address(this), seedAmount);
        }
        (bool minted, ) = diamond.call(
            abi.encodeWithSignature(
                "mint(address,uint256,uint256,bytes)",
                address(this),
                childId,
                seedAmount,
                ""
            )
        );
        if (!minted) {
            return;
        }

        // Convert a portion child->GNUS as the handler (a real, successful convert).
        vm.prank(address(this));
        (bool converted, ) = diamond.call(
            abi.encodeWithSignature(
                "convert(uint256,uint256,uint256,address)",
                childId,
                GNUS_TOKEN_ID,
                seedAmount / 2,
                address(this)
            )
        );
        if (converted) {
            ghost_convertCalls++;
        }
    }

    /**
     * @notice Bounded transfer handler for ERC20 token transfers
     * @dev Executes random GNUS token transfers between actors with bounded amounts.
     *      This handler simulates realistic user transfer behavior while maintaining
     *      token conservation properties.
     *
     * INPUT BOUNDS:
     * - actorSeed: Unbounded, modulo actors.length to select sender
     * - recipientSeed: Unbounded, modulo actors.length to select recipient
     * - amount: Bounded to [1, sender's balance] to prevent underflow
     *
     * RATIONALE:
     * - Tests token conservation across transfers
     * - Validates balance updates are atomic
     * - Ensures transfer events are properly emitted
     * - Verifies no tokens are created or destroyed during transfer
     *
     * GHOST VARIABLE UPDATES:
     * - ghost_totalTransfers: Incremented on successful transfer
     * - calls_transfer: Counter for this handler invocation
     *
     * @param actorSeed Seed to select actor (sender)
     * @param recipientSeed Seed to select recipient
     * @param amount Amount to transfer (bounded to sender's balance)
     */
    function handler_transfer(uint256 actorSeed, uint256 recipientSeed, uint256 amount) public {
        // Select actor and recipient
        currentActor = actors[actorSeed % actors.length];
        address recipient = actors[recipientSeed % actors.length];

        // Bound amount to actor's balance
        uint256 balance = _getGNUSBalance(currentActor);
        if (balance == 0) {
            return;
        }

        amount = _boundUint256(amount, 1, balance);

        // Execute transfer
        vm.prank(currentActor);
        _transferGNUS(currentActor, recipient, amount);

        // Update ghosts
        ghost_totalTransfers++;
        calls_transfer++;

        console.log("[HANDLER] Transfer:", amount);
    }

    /**
     * @notice Bounded approve handler for ERC20 allowance management
     * @dev Executes random approval operations to test allowance tracking and edge cases.
     *      Approvals are critical for DEX integrations and delegated spending patterns.
     *
     * INPUT BOUNDS:
     * - actorSeed: Unbounded, modulo actors.length to select owner
     * - spenderSeed: Unbounded, modulo actors.length to select spender
     * - amount: Bounded to [0, type(uint128).max] for realistic approval amounts
     *
     * RATIONALE:
     * - Tests approval storage and retrieval consistency
     * - Validates approval events are emitted correctly
     * - Ensures allowances don't affect token balances
     * - Verifies zero approvals work (revoke pattern)
     *
     * GHOST VARIABLE UPDATES:
     * - ghost_totalApprovals: Incremented on successful approval
     * - calls_approve: Counter for this handler invocation
     *
     * @param actorSeed Seed to select actor (token owner)
     * @param spenderSeed Seed to select spender
     * @param amount Approval amount (bounded to uint128 max)
     */
    function handler_approve(uint256 actorSeed, uint256 spenderSeed, uint256 amount) public {
        currentActor = actors[actorSeed % actors.length];
        address spender = actors[spenderSeed % actors.length];

        amount = _boundUint256(amount, 0, type(uint128).max);

        bytes memory callData = abi.encodeWithSignature(
            "approve(address,uint256)",
            spender,
            amount
        );

        vm.prank(currentActor);
        (bool success, ) = diamond.call(callData);

        if (success) {
            ghost_totalApprovals++;
            calls_approve++;
        }

        console.log("[HANDLER] Approve:", amount);
    }

    /**
     * @notice Bounded mint handler for GNUS token creation
     * @dev Mints GNUS tokens to random recipients to test supply cap and balance tracking.
     *      Only the test contract has MINTER_ROLE, simulating privileged minting operations.
     *
     * INPUT BOUNDS:
     * - recipientSeed: Unbounded, modulo actors.length to select recipient
     * - amount: Bounded to [1 ether, 1000 ether] for realistic mint sizes
     *
     * RATIONALE:
     * - Tests total supply increases correctly
     * - Validates max supply cap enforcement (10 billion GNUS)
     * - Ensures mint events are emitted with correct data
     * - Verifies role-based access control for minting
     * - Checks balance updates are atomic with supply changes
     *
     * GHOST VARIABLE UPDATES:
     * - ghost_totalMinted: Incremented by minted amount
     * - calls_mint: Counter for this handler invocation
     *
     * @param recipientSeed Seed to select recipient
     * @param amount Amount to mint (bounded to 1-1000 ether)
     */
    function handler_mint(uint256 recipientSeed, uint256 amount) public {
        address recipient = actors[recipientSeed % actors.length];
        amount = _boundUint256(amount, 1 ether, 1000 ether);

        // Only test contract has MINTER_ROLE
        _mintGNUS(recipient, amount);

        ghost_totalMinted += amount;
        calls_mint++;

        console.log("[HANDLER] Mint:", amount);
    }

    /**
     * @notice Bounded NFT collection creation handler
     * @dev Creates NFT collections with random parameters, burning GNUS tokens as payment.
     *      Tests the NFT Factory economics and token burn mechanism.
     *
     * INPUT BOUNDS:
     * - maxSupply: Bounded to [1, 10000] for realistic collection sizes
     * - exchRate: Bounded to [1 ether, 100 ether] GNUS burned per collection
     *
     * RATIONALE:
     * - Tests GNUS burn mechanism on collection creation
     * - Validates collection ID uniqueness across all collections
     * - Ensures max supply is enforced per collection
     * - Verifies economic model: GNUS supply decreases when creating collections
     * - Checks collection metadata storage and retrieval
     *
     * GHOST VARIABLE UPDATES:
     * - ghost_totalCollectionsCreated: Incremented on successful creation
     * - ghost_totalBurned: Incremented by exchRate (GNUS burned)
     * - calls_createCollection: Counter for this handler invocation
     *
     * @param maxSupply Maximum supply for the new NFT collection
     * @param exchRate GNUS tokens to burn for collection creation
     */
    function handler_createCollection(uint256 maxSupply, uint256 exchRate) public {
        maxSupply = _boundUint256(maxSupply, 1, 10000);
        exchRate = _boundUint256(exchRate, 1 ether, 100 ether);

        // Ensure test contract has enough GNUS
        uint256 balance = _getGNUSBalance(address(this));
        if (balance < exchRate) {
            _mintGNUS(address(this), exchRate - balance + 100 ether);
        }

        bytes memory callData = abi.encodeWithSignature(
            "createNFTCollection(string,string,uint256,uint256)",
            "Test Collection",
            "TEST",
            maxSupply,
            exchRate
        );

        (bool success, ) = diamond.call(callData);

        if (success) {
            ghost_totalCollectionsCreated++;
            ghost_totalBurned += exchRate; // GNUS burned on creation
            calls_createCollection++;
        }

        console.log("[HANDLER] Create Collection");
    }

    /**
     * @notice Bounded cross-chain bridge deposit handler
     * @dev Simulates GNUS token deposits to bridge contract for cross-chain transfers.
     *      Tests bridge accounting and token locking mechanism.
     *
     * INPUT BOUNDS:
     * - actorSeed: Unbounded, modulo actors.length to select depositor
     * - amount: Bounded to [1 ether, depositor's balance] for valid deposits
     *
     * RATIONALE:
     * - Tests bridge deposit accounting and token locking
     * - Validates tokens are properly escrowed during bridge operations
     * - Ensures bridge events contain correct destination chain data
     * - Verifies depositor balance decreases correctly
     * - Checks total supply remains constant (tokens locked, not burned)
     *
     * GHOST VARIABLE UPDATES:
     * - ghost_totalBridgeDeposits: Incremented on successful deposit
     * - calls_bridgeDeposit: Counter for this handler invocation
     *
     * @param actorSeed Seed to select actor (depositor)
     * @param amount Amount to bridge (bounded to depositor's balance)
     */
    function handler_bridgeDeposit(uint256 actorSeed, uint256 amount) public {
        currentActor = actors[actorSeed % actors.length];

        uint256 balance = _getGNUSBalance(currentActor);
        if (balance == 0) {
            return;
        }

        amount = _boundUint256(amount, 1 ether, balance);

        // Typed bridgeOut; success-gated ghost-counter semantics preserved via try/catch.
        vm.prank(currentActor);
        try
            IGNUSBridgeOut(diamond).bridgeOut(
                amount,
                GNUS_TOKEN_ID,
                DEST_CHAIN_ID,
                SGNS_DESTINATION,
                SGNS_DESTINATION_Y_ODD
            )
        {
            ghost_totalBridgeDeposits++;
            ghost_totalBridgedOutAmount += amount;
            calls_bridgeDeposit++;
        } catch {}

        console.log("[HANDLER] Bridge Deposit:", amount);
    }

    /**
     * @notice Bounded bridgeIn handler — the fuzzer's entry point for the destination-side
     *         bridge release path (Phase 15 V2 certificate path, BRIDGE-02/BRIDGE-03/BRIDGE-04).
     * @dev Always submits a deterministic-but-invalid V2 certificate built from the fuzz `seed`:
     *      a single random 65-byte signature with an empty merkle proof. The soundness
     *      invariant (BridgeInvariant.invariant_noValidCertFromFuzzedSigs) asserts this
     *      handler NEVER succeeds — if `ghost_bridgeInSuccesses` ever becomes non-zero,
     *      the signature recovery or merkle verification in
     *      GNUSBridgeAttestor._verifyBridgeAttestorCertificate is broken. Handlers swallow
     *      reverts; failed calls are still tracked via `ghost_bridgeInCalls` for the
     *      coverage guard.
     *
     *      V2 shape (Plan 15-04, D-10): the message is the canonical BridgeMessage tuple
     *      and the replay key is the V2 messageId, derived off-chain here exactly as
     *      GNUSBridgeAttestor._bridgeMessageId does (keccak256 over
     *      (GNUS_BRIDGE_MESSAGE_ID_V2, srcChainID, sourceBridgeID, sourceTxHash,
     *      sourceEventIndex)) so the ghost ids stay in lockstep with the diamond's
     *      processedMessages keys. nextRoot = keccak256(abi.encode(seed)) is a
     *      seed-derived pseudo-root that is never bytes32(0) and never equal to the
     *      Genesis one-leaf root, so epoch-0 calls get past the genesis-advance gate
     *      and die in verification — the campaign's failure point stays inside the
     *      verifier, preserving the soundness invariant's meaning.
     *
     * INPUT BOUNDS:
     * - amount: Bounded to [1, 1_000_000 ether] via forge-std `bound`
     * - srcChainID: Bounded to [1, 1000]; must differ from block.chainid (same-chain guard)
     * - recipient: Must not be the zero address
     * - sourceTxHash / seed: Unbounded fuzz inputs (sourceTxHash is a message-identity field)
     *
     * GHOST VARIABLE UPDATES (on success only):
     * - ghost_bridgeInSuccesses: incremented
     * - ghost_totalBridgedInAmount: incremented by post-call `amount`
     * - ghost_releasedIds[messageId]: set to true (V2 composite replay key)
     * - ghost_releasedIdsList: messageId appended (for invariant-time iteration)
     *
     * ALWAYS INCREMENTED:
     * - ghost_bridgeInCalls: incremented unconditionally (attempt counter)
     *
     * @param sourceTxHash Source transaction hash (a BridgeMessage identity field)
     * @param srcChainID Source chain id (fuzzed, bounded to 1..1000, != block.chainid)
     * @param recipient Release recipient (fuzzed, assumed non-zero)
     * @param amount Release amount (fuzzed, bounded to [1, 1_000_000 ether])
     * @param seed Seed material for the pseudo next-root and the invalid certificate
     */
    function handler_bridgeIn(
        bytes32 sourceTxHash,
        uint256 srcChainID,
        address recipient,
        uint256 amount,
        uint256 seed
    ) external {
        amount = bound(amount, 1, 1_000_000 ether);
        srcChainID = bound(srcChainID, 1, 1000);
        vm.assume(srcChainID != block.chainid);
        vm.assume(recipient != address(0));

        BridgeMessage memory message = BridgeMessage({
            srcChainID: srcChainID,
            sourceBridgeID: bytes32(seed),
            sourceTxHash: sourceTxHash,
            sourceEventIndex: 0,
            recipient: recipient,
            amount: amount
        });
        bytes32 nextRoot = keccak256(abi.encode(seed));

        // Deterministic-but-invalid certificate: a single 65-byte signature built from
        // the fuzz seed (r, s, v=27) with an empty merkle proof. The attestor set
        // bootstrapped by the invariant setUp uses the fixed one-leaf Genesis root, so
        // this random signature should never pass ECDSA recovery + merkle membership.
        bytes[] memory sigs = new bytes[](1);
        sigs[0] = abi.encodePacked(bytes32(seed), bytes32(seed ^ 1), uint8(27));
        bytes32[][] memory proofs = new bytes32[][](1);
        proofs[0] = new bytes32[](0);

        // V2 composite replay key, derived identically to _bridgeMessageId on-chain.
        bytes32 messageId = keccak256(
            abi.encode(GNUS_BRIDGE_MESSAGE_ID_V2, srcChainID, bytes32(seed), sourceTxHash, uint256(0))
        );

        ghost_bridgeInCalls++;

        (bool ok, ) = diamond.call(
            abi.encodeWithSignature(
                "bridgeIn((uint256,bytes32,bytes32,uint256,address,uint256),bytes32,bytes[],bytes32[][])",
                message,
                nextRoot,
                sigs,
                proofs
            )
        );

        if (ok) {
            // Reaching this branch means the fuzzer stumbled on a valid certificate
            // against the bootstrapped attestor root — that is a finding (BRIDGE-03).
            ghost_bridgeInSuccesses++;
            ghost_totalBridgedInAmount += amount;
            ghost_releasedIds[messageId] = true;
            ghost_releasedIdsList.push(messageId);
        }
        // NOTE: invariant tests must add `handler_bridgeIn.selector` to their
        // targetSelector allowlist (see BridgeInvariant.setUp and
        // ConservationInvariant.setUp) so the fuzzer reaches this entry point.
    }

    /**
     * @notice Bounded role granting handler for access control testing
     * @dev Grants random roles to random actors to test RBAC (Role-Based Access Control).
     *      Only DEFAULT_ADMIN_ROLE can grant roles, enforcing security hierarchy.
     *
     * INPUT BOUNDS:
     * - roleSeed: Unbounded, modulo 4 to select from available roles
     * - targetSeed: Unbounded, modulo actors.length to select target
     *
     * AVAILABLE ROLES:
     * - DEFAULT_ADMIN_ROLE: Can grant/revoke all roles
     * - MINTER_ROLE: Can mint new GNUS tokens
     * - PAUSER_ROLE: Can pause/unpause contract
     * - UPGRADER_ROLE: Can upgrade diamond facets
     *
     * RATIONALE:
     * - Tests role grant mechanics and permission delegation
     * - Validates only admins can grant roles (security critical)
     * - Ensures role changes emit correct events
     * - Verifies role queries reflect granted permissions
     * - Checks multiple roles can coexist on same address
     *
     * GHOST VARIABLE UPDATES:
     * - ghost_roleOps: Incremented on successful role grant
     * - calls_grantRole: Counter for this handler invocation
     *
     * @param roleSeed Seed to select role to grant
     * @param targetSeed Seed to select target address receiving role
     */
    function handler_grantRole(uint256 roleSeed, uint256 targetSeed) public {
        // Only address(this) has DEFAULT_ADMIN_ROLE initially
        currentActor = address(this);

        // Select a role to grant (from available roles)
        bytes32[] memory roles = new bytes32[](4);
        roles[0] = DEFAULT_ADMIN_ROLE;
        roles[1] = MINTER_ROLE;
        roles[2] = PAUSER_ROLE;
        roles[3] = UPGRADER_ROLE;

        bytes32 role = roles[roleSeed % roles.length];
        address target = actors[targetSeed % actors.length];

        // Grant role
        vm.prank(currentActor);
        _grantRole(role, target);

        ghost_roleOps++;
        calls_grantRole++;

        console.log("[HANDLER] Grant Role");
    }

    /**
     * @notice Bounded role revocation handler for access control testing
     * @dev Revokes random roles from random actors to test permission removal.
     *      Only DEFAULT_ADMIN_ROLE can revoke roles, maintaining security model.
     *
     * INPUT BOUNDS:
     * - roleSeed: Unbounded, modulo 4 to select from available roles
     * - targetSeed: Unbounded, modulo actors.length to select target
     *
     * REVOCABLE ROLES:
     * - DEFAULT_ADMIN_ROLE: Removes admin privileges
     * - MINTER_ROLE: Removes minting privileges
     * - PAUSER_ROLE: Removes pause privileges
     * - UPGRADER_ROLE: Removes upgrade privileges
     *
     * RATIONALE:
     * - Tests role revocation mechanics and permission removal
     * - Validates only admins can revoke roles (security critical)
     * - Ensures revoke events are emitted correctly
     * - Verifies role queries reflect revoked state
     * - Checks revoking non-existent roles doesn't break state
     *
     * GHOST VARIABLE UPDATES:
     * - calls_revokeRole: Counter for this handler invocation
     *
     * @param roleSeed Seed to select role to revoke
     * @param targetSeed Seed to select target address losing role
     */
    function handler_revokeRole(uint256 roleSeed, uint256 targetSeed) public {
        // Only address(this) has DEFAULT_ADMIN_ROLE initially
        currentActor = address(this);

        // Select a role to revoke
        bytes32[] memory roles = new bytes32[](4);
        roles[0] = DEFAULT_ADMIN_ROLE;
        roles[1] = MINTER_ROLE;
        roles[2] = PAUSER_ROLE;
        roles[3] = UPGRADER_ROLE;

        bytes32 role = roles[roleSeed % roles.length];
        address target = actors[targetSeed % actors.length];

        // Revoke role
        vm.prank(currentActor);
        _revokeRole(role, target);

        calls_revokeRole++;

        console.log("[HANDLER] Revoke Role");
    }

    /**
     * @notice Bounded token burn handler for supply reduction
     * @dev Burns GNUS tokens from random actors to test deflationary mechanics.
     *      Burning permanently reduces total supply, testing economic model integrity.
     *
     * INPUT BOUNDS:
     * - actorSeed: Unbounded, modulo actors.length to select burner
     * - amount: Bounded to [1, burner's balance] to prevent underflow
     *
     * RATIONALE:
     * - Tests total supply decreases correctly on burn
     * - Validates burn events are emitted with correct data
     * - Ensures burned tokens are permanently removed (not recoverable)
     * - Verifies balance updates are atomic with supply changes
     * - Checks burn affects accounting in NFT factory (collection creation)
     *
     * GHOST VARIABLE UPDATES:
     * - ghost_totalBurned: Incremented by burned amount
     * - calls_burn: Counter for this handler invocation
     *
     * @param actorSeed Seed to select actor (burner)
     * @param amount Amount to burn (bounded to burner's balance)
     */
    function handler_burn(uint256 actorSeed, uint256 amount) public {
        currentActor = actors[actorSeed % actors.length];

        uint256 balance = _getGNUSBalance(currentActor);
        if (balance == 0) {
            return;
        }

        amount = _boundUint256(amount, 1, balance);

        bytes memory callData = abi.encodeWithSignature(
            "burn(address,uint256,uint256)",
            currentActor,
            GNUS_TOKEN_ID,
            amount
        );

        vm.prank(currentActor);
        (bool success, ) = diamond.call(callData);

        if (success) {
            ghost_totalBurned += amount;
            calls_burn++;
        }

        console.log("[HANDLER] Burn:", amount);
    }

    /**
     * @notice Bounded ERC1155 multi-token mint handler
     * @dev Mints ERC1155 tokens (NFTs) to test multi-token accounting.
     *      Tests separate token ID tracking within the same contract.
     *
     * INPUT BOUNDS:
     * - recipientSeed: Unbounded, modulo actors.length to select recipient
     * - tokenId: Bounded to [1, 100] to simulate realistic NFT collection IDs
     * - amount: Bounded to [1, 1000] for batch minting scenarios
     *
     * RATIONALE:
     * - Tests per-token-ID supply tracking and max supply enforcement
     * - Validates balance queries for specific token IDs
     * - Ensures ERC1155 events are emitted correctly
     * - Verifies token ID isolation (minting ID 1 doesn't affect ID 2)
     * - Checks batch operations maintain consistency
     *
     * GHOST VARIABLE UPDATES:
     * - calls_mint1155: Counter for this handler invocation
     *
     * @param recipientSeed Seed to select recipient
     * @param tokenId Token ID to mint (bounded to 1-100)
     * @param amount Amount to mint (bounded to 1-1000)
     */
    function handler_mint1155(uint256 recipientSeed, uint256 tokenId, uint256 amount) public {
        address recipient = actors[recipientSeed % actors.length];
        // Phase 9 (D10): the 3-arg MINTER mint is restricted to id 0 (root GNUS issuance).
        // id 0 keeps the original role-check coverage; any non-zero id must revert with
        // "MINTER_ROLE mints GNUS only" — a success here is a conservation hole (Pitfall 5).
        tokenId = _boundUint256(tokenId, 0, 100);
        amount = _boundUint256(amount, 1, 1000);

        bytes memory callData = abi.encodeWithSignature(
            "mint(address,uint256,uint256)",
            recipient,
            tokenId,
            amount
        );

        // Only test contract has MINTER_ROLE
        (bool success, ) = diamond.call(callData);

        if (tokenId != GNUS_TOKEN_ID) {
            // D10 guard: non-root ids must never be mintable out of thin air.
            require(!success, "D10 violated: MINTER_ROLE minted a non-root id");
            return;
        }

        if (success) {
            calls_mint1155++;
            // Root mint conserves into the tree supply — track for I1 (matches handler_mint).
            ghost_totalMinted += amount;
        }

        console.log("[HANDLER] Mint ERC1155:", tokenId);
    }

    /**
     * @notice Bounded ERC1155 multi-token burn handler
     * @dev Burns ERC1155 tokens to test supply reduction for specific token IDs.
     *      Tests that burning one token ID doesn't affect others.
     *
     * INPUT BOUNDS:
     * - actorSeed: Unbounded, modulo actors.length to select burner
     * - tokenId: Bounded to [1, 100] matching mint handler range
     * - amount: Bounded to [1, 100] for smaller burn operations
     *
     * RATIONALE:
     * - Tests per-token-ID supply decreases correctly
     * - Validates burn events contain correct token ID and amount
     * - Ensures burning doesn't underflow (fails if insufficient balance)
     * - Verifies token ID isolation (burning ID 1 doesn't affect ID 2)
     * - Checks zero address balance remains zero after burns
     *
     * GHOST VARIABLE UPDATES:
     * - calls_burn1155: Counter for this handler invocation
     *
     * @param actorSeed Seed to select actor (burner)
     * @param tokenId Token ID to burn (bounded to 1-100)
     * @param amount Amount to burn (bounded to 1-100)
     */
    function handler_burn1155(uint256 actorSeed, uint256 tokenId, uint256 amount) public {
        currentActor = actors[actorSeed % actors.length];
        tokenId = _boundUint256(tokenId, 1, 100);
        amount = _boundUint256(amount, 1, 100);

        bytes memory callData = abi.encodeWithSignature(
            "burn(address,uint256,uint256)",
            currentActor,
            tokenId,
            amount
        );

        vm.prank(currentActor);
        (bool success, ) = diamond.call(callData);

        if (success) {
            calls_burn1155++;
        }

        console.log("[HANDLER] Burn ERC1155:", tokenId);
    }

    /**
     * @notice Bounded convert handler (Phase 9 - conversion-native model)
     * @dev Calls the diamond's `convert(fromId, toId, minionAmount, to)` selector.
     *      The selector is added by Plan 09-02; until then every call reverts and
     *      the ghost counter stays at zero. Uses a low-level call so this file
     *      compiles before the facet lands.
     *
     * INPUT BOUNDS:
     * - actorSeed: Unbounded, modulo actors.length to select sender
     * - fromIdSeed: Bounded to [0, 100] to cover GNUS + plausible child ids
     * - toIdSeed: Bounded to [0, 100] to cover GNUS + plausible child ids
     * - amount: Bounded to [1, 1e30] (sane non-zero minion range)
     *
     * GHOST VARIABLE UPDATES:
     * - ghost_convertCalls: Incremented on successful convert
     * - calls_mint1155: NOT touched (convert is its own action; not a mint)
     *
     * @param actorSeed Seed to select actor (sender)
     * @param fromIdSeed Source token id seed
     * @param toIdSeed Destination token id seed
     * @param amount Minion amount to convert
     */
    function handler_convert(uint256 actorSeed, uint256 fromIdSeed, uint256 toIdSeed, uint256 amount) public {
        currentActor = actors[actorSeed % actors.length];

        // T-09-28: draw ids from the actually-created set only — random ids in [0,100]
        // almost never exist, so the convert path would never be exercised.
        uint256 idSpace = ghost_createdIds.length + 1; // +1 for GNUS (id 0)
        uint256 fromIdx = fromIdSeed % idSpace;
        uint256 toIdx = toIdSeed % idSpace;
        uint256 fromId = fromIdx == 0 ? GNUS_TOKEN_ID : ghost_createdIds[fromIdx - 1];
        uint256 toId = toIdx == 0 ? GNUS_TOKEN_ID : ghost_createdIds[toIdx - 1];
        if (fromId == toId) {
            // Same-id converts revert by design. Rather than waste the draw, nudge the
            // destination to the next id in the space so a funded call always converts.
            // Only possible once at least one child exists (idSpace >= 2); with GNUS
            // alone there is no distinct destination, so skip.
            if (idSpace < 2) {
                return;
            }
            toIdx = (toIdx + 1) % idSpace;
            toId = toIdx == 0 ? GNUS_TOKEN_ID : ghost_createdIds[toIdx - 1];
        }

        // Bound to the sender's actual balance so the burn leg can succeed.
        uint256 balance = _getBalance1155(currentActor, fromId);
        if (balance == 0) {
            // Fund the actor from the handler's own holdings via a plain ERC1155
            // transfer. Actors only ever receive GNUS directly; child tokens are
            // factory-minted to the handler (address(this)), so a drawn child fromId
            // would otherwise always early-return and the convert path would never be
            // exercised (Codex P2). A transfer is supply-neutral, so I1/I2 accounting
            // is unaffected. Skip when the handler itself holds none.
            uint256 handlerBalance = _getBalance1155(address(this), fromId);
            if (handlerBalance == 0) {
                return;
            }
            bytes memory fundData = abi.encodeWithSignature(
                "safeTransferFrom(address,address,uint256,uint256,bytes)",
                address(this),
                currentActor,
                fromId,
                handlerBalance,
                ""
            );
            vm.prank(address(this));
            (bool funded, ) = diamond.call(fundData);
            if (!funded) {
                return;
            }
            balance = handlerBalance;
        }
        amount = _boundUint256(amount, 1, balance);

        bytes memory callData = abi.encodeWithSignature(
            "convert(uint256,uint256,uint256,address)",
            fromId,
            toId,
            amount,
            currentActor
        );

        vm.prank(currentActor);
        (bool success, ) = diamond.call(callData);

        if (success) {
            // I2 neutrality: convert moves supply between ids; no supply ghost changes.
            ghost_convertCalls++;
        }

        console.log("[HANDLER] Convert:", fromId, toId, amount);
    }

    /**
     * @notice Create a direct-child NFT of GNUS and record its id
     * @dev Uses the factory's `createNFT(uint256,string,string,uint256,uint256,string)`
     *      with parentID == GNUS_TOKEN_ID. The created id equals the parent's childCurIndex
     *      at creation time (direct children of GNUS are sequentially numbered 1, 2, 3, ...).
     *      The test contract holds DEFAULT_ADMIN_ROLE, which satisfies the
     *      "Only Creators or Admins" gate on createNFT.
     *
     * GHOST VARIABLE UPDATES:
     * - ghost_createdIds: new child id pushed on success
     * - calls_createNFT: Counter for this handler invocation
     *
     * @param exchRateSeed Seed for the display-only exchange rate (bounded [1, 1e6])
     * @param maxSupplySeed Seed for the per-id minion cap (bounded [1, 1e12])
     */
    function handler_createNFT(uint256 exchRateSeed, uint256 maxSupplySeed) public {
        uint256 exchRate = _boundUint256(exchRateSeed, 1, 1e6);
        uint256 maxSupply = _boundUint256(maxSupplySeed, 1, 1e12);

        // The next direct-child id of GNUS is the current childCurIndex (read via getNFTInfo).
        uint256 nextId = _getChildCurIndex(GNUS_TOKEN_ID);
        if (nextId == 0) {
            // parent info unreadable — skip rather than corrupt ghosts
            return;
        }

        bytes memory callData = abi.encodeWithSignature(
            "createNFT(uint256,string,string,uint256,uint256,string)",
            GNUS_TOKEN_ID,
            "Fuzz Child",
            "FCHILD",
            exchRate,
            maxSupply,
            ""
        );

        (bool success, ) = diamond.call(callData);

        if (success) {
            ghost_createdIds.push(nextId);
            calls_createNFT++;
        }

        console.log("[HANDLER] Create NFT:", nextId);
    }

    /**
     * @notice Factory-mint a created direct-child id (1:1 GNUS burn, D1)
     * @dev Calls `mint(address,uint256,uint256,bytes)` as the test contract (admin passes
     *      the "Creator or Admin" gate). beforeMint burns `amount` of the CALLER's id-0
     *      balance 1:1 (minion semantics, no rate math). This is the tree's only valid
     *      child-issuance tap under the conversion-native model.
     *
     * GHOST VARIABLE UPDATES:
     * - ghost_totalMinted: unchanged — the burn leg and mint leg cancel (tree Σ constant).
     * - calls_factoryMint: Counter for this handler invocation
     *
     * @param idSeed Seed to select from ghost_createdIds
     * @param amount Minion amount to mint (bounded to the caller's GNUS balance)
     */
    function handler_factoryMint(uint256 idSeed, uint256 amount) public {
        if (ghost_createdIds.length == 0) {
            return;
        }
        uint256 id = ghost_createdIds[idSeed % ghost_createdIds.length];

        uint256 balance = _getGNUSBalance(address(this));
        if (balance == 0) {
            return;
        }
        amount = _boundUint256(amount, 1, balance);

        // Respect the per-id minion cap: totalSupply(id) + amount <= maxSupply(id).
        uint256 headroom = _getMaxSupplyHeadroom(id);
        if (headroom == 0) {
            return;
        }
        if (amount > headroom) amount = headroom;

        bytes memory callData = abi.encodeWithSignature(
            "mint(address,uint256,uint256,bytes)",
            address(this),
            id,
            amount,
            ""
        );

        (bool success, ) = diamond.call(callData);

        if (success) {
            calls_factoryMint++;
        }

        console.log("[HANDLER] Factory Mint:", id, amount);
    }

    /**
     * @notice Get the ERC1155 balance of an account for an arbitrary token id
     * @param account Address to check
     * @param id Token id
     * @return balance Token balance
     */
    function _getBalance1155(address account, uint256 id) internal view returns (uint256) {
        bytes memory callData = abi.encodeWithSignature("balanceOf(address,uint256)", account, id);
        (bool success, bytes memory returnData) = diamond.staticcall(callData);
        if (!success) {
            return 0;
        }
        return abi.decode(returnData, (uint256));
    }

    /**
     * @notice Read childCurIndex of a parent id from getNFTInfo
     * @dev Decodes the full NFT struct (typed) rather than a positional tuple — the
     *      struct's three leading dynamic strings followed by a uint128/bool tail
     *      misalign a hand-built offset table and panic (0x41) under forge's strict
     *      decoder; the typed struct decode uses the correct offset table.
     * @param parentId Parent token id
     * @return childCurIndex Current child index (next direct-child id)
     */
    function _getChildCurIndex(uint256 parentId) internal view returns (uint256) {
        bytes memory callData = abi.encodeWithSignature("getNFTInfo(uint256)", parentId);
        (bool success, bytes memory returnData) = diamond.staticcall(callData);
        if (!success) {
            return 0;
        }
        NFT memory nft = abi.decode(returnData, (NFT));
        return uint256(nft.childCurIndex);
    }

    /**
     * @notice Remaining mintable headroom for a token id (maxSupply - totalSupply)
     * @dev maxSupply == 0 means uncapped in the factory; treat as uint256 max headroom.
     * @param id Token id
     * @return headroom Mintable minions remaining before the per-id cap
     */
    function _getMaxSupplyHeadroom(uint256 id) internal view returns (uint256) {
        bytes memory callData = abi.encodeWithSignature("getNFTInfo(uint256)", id);
        (bool success, bytes memory returnData) = diamond.staticcall(callData);
        if (!success) {
            return 0;
        }
        NFT memory nft = abi.decode(returnData, (NFT));
        uint256 maxSupply = nft.maxSupply;
        if (maxSupply == 0) return type(uint256).max;

        bytes memory supplyCall = abi.encodeWithSignature("totalSupply(uint256)", id);
        (bool ok, bytes memory supplyData) = diamond.staticcall(supplyCall);
        if (!ok) {
            return 0;
        }
        uint256 supply = abi.decode(supplyData, (uint256));
        return supply >= maxSupply ? 0 : maxSupply - supply;
    }

    /**
     * @notice Number of child ids created by handler_createNFT (for invariant iteration)
     * @return length of ghost_createdIds
     */
    function ghost_createdIdsLength() external view returns (uint256) {
        return ghost_createdIds.length;
    }

    /**
     * @notice Number of successfully-released bridge messageIds (for invariant iteration)
     * @dev BridgeInvariant.invariant_processedMessagesIffReleased walks this list to
     *      verify the diamond's processedMessages mapping is set for every released
     *      V2 messageId (Plan 15-04).
     * @return length of ghost_releasedIdsList
     */
    function getReleasedIdsLength() external view returns (uint256) {
        return ghost_releasedIdsList.length;
    }

    // ========================================
    // Phase 13 (13-05): lifecycle settlement handlers
    // ========================================
    // Ghost state for the LifecycleInvariant suite. Handler style per Phase 10 (10-04)
    // logged decision: swallow reverts, track state only.

    /// @dev SUM of minions burned by BURN-disposition settles — BOTH the permissionless
    ///      settleExpired path AND the settle-first step of a PerHolder renewal mint.
    uint256 public ghost_totalSettleBurned;
    /// @dev Successful settleExpired calls (coverage guard, T-13-05-03).
    uint256 public ghost_settleCalls;
    /// @dev Successful PerHolder mints via mintWithCredential — every one runs the D3
    ///      renewal transition (stack or settle-first), so this counts renewal exercises.
    uint256 public ghost_renewalCalls;
    /// @dev Incremented when a renewal onto an expired clock leaves MORE than the incoming
    ///      mint in the holder's balance — i.e. the expired pile was resurrected (T-13-05-01).
    ///      L1 asserts this stays 0.
    uint256 public ghost_resurrections;

    /// @dev The PerHolder BURN SOULBOUND token id configured by the invariant setUp (0 = unset).
    uint256 public lifecyclePerHolderId;
    /// @dev The PerTokenId BURN token id configured by the invariant setUp (0 = unset).
    uint256 public lifecyclePerTokenId;

    /// @dev Mint amount bounds — small enough that the handler's 100k ether seed GNUS can
    ///      fund a whole campaign without a mid-run root mint (which would perturb L2).
    uint256 internal constant LIFECYCLE_MINT_MIN = 1 ether;
    uint256 internal constant LIFECYCLE_MINT_MAX = 10 ether;
    /// @dev vm.warp bound per handler_advanceTime call (+/- 2 days, plan 13-05).
    uint256 internal constant LIFECYCLE_MAX_WARP = 2 days;
    /// @dev Backward-warp floor — never warp the clock to (near) zero.
    uint256 internal constant LIFECYCLE_WARP_FLOOR = 1 days;
    /// @dev Deterministic seed amounts for seedLifecycleCycle.
    uint256 internal constant LIFECYCLE_SEED_AMOUNT = 100 ether;

    /**
     * @notice Configure the lifecycle token ids the handlers drive (called by the invariant
     *         setUp after creating the tokens on the diamond).
     * @param perHolderId PerHolder BURN SOULBOUND token id
     * @param perTokenId PerTokenId BURN token id
     */
    function setLifecycleTokens(uint256 perHolderId, uint256 perTokenId) public {
        lifecyclePerHolderId = perHolderId;
        lifecyclePerTokenId = perTokenId;
    }

    /**
     * @notice Bounded PerHolder mint handler — drives mintWithCredential (the ONLY path that
     *         runs D3 per-holder renewal) for a fuzz-picked actor.
     * @dev The handler contract holds DEFAULT_ADMIN_ROLE (granted in setUp), satisfying the
     *      mintWithCredential creator-or-admin gate; the mint burns the handler's GNUS 1:1
     *      (tree-neutral) and credits the actor. The token has no credentialVerifier, so the
     *      credential is ignored (open mint — window + cap still enforced; neither is set).
     *
     *      Resurrection detection (L1): when the actor's clock had ALREADY EXPIRED with a
     *      positive balance, the renewal must settle-first (BURN the pile). Expected
     *      post-mint balance == exactly the incoming amount; anything more is a resurrection.
     *
     * @param actorSeed Seed to select the mint recipient from the bounded actor set
     * @param amountSeed Seed for the mint amount (bounded [1, 10] ether)
     */
    function handler_mintPerHolder(uint256 actorSeed, uint256 amountSeed) public {
        if (lifecyclePerHolderId == 0) {
            return;
        }
        address holder = actors[actorSeed % actors.length];
        uint256 amount = _boundUint256(amountSeed, LIFECYCLE_MINT_MIN, LIFECYCLE_MINT_MAX);

        uint64 preClock = _getHolderExpiry(lifecyclePerHolderId, holder);
        uint256 preBal = _getBalance1155(holder, lifecyclePerHolderId);
        bool expiredWithPile = preClock != 0 && uint256(preClock) <= block.timestamp && preBal > 0;

        if (!_lifecycleMintTo(holder, lifecyclePerHolderId, amount)) {
            return;
        }

        ghost_renewalCalls++;
        if (expiredWithPile) {
            // D3 settle-first (BURN disposition): the renewal burned the expired pile before
            // crediting the new mint. Track the burn for L2 conservation; flag resurrection.
            ghost_totalSettleBurned += preBal;
            uint256 postBal = _getBalance1155(holder, lifecyclePerHolderId);
            if (postBal != amount) {
                ghost_resurrections++;
            }
        }

        console.log("[HANDLER] Mint PerHolder:", lifecyclePerHolderId, amount);
    }

    /**
     * @notice Bounded settle handler — permissionless settleExpired for a fuzz-picked actor.
     * @dev Even seeds settle the PerHolder token, odd seeds the PerTokenId token (the single
     *      seed drives both choices per plan 13-05's one-seed signature). Reverts (not
     *      expired) are swallowed per the Phase 10 handler style; the burn quantum is tracked
     *      via post-call balance diff for L2.
     * @param actorSeed Seed selecting both the token (parity) and the account (high bits)
     */
    function handler_settleExpired(uint256 actorSeed) public {
        if (lifecyclePerHolderId == 0) {
            return;
        }
        uint256 id = (actorSeed & 1) == 0 ? lifecyclePerHolderId : lifecyclePerTokenId;
        address account = actors[(actorSeed >> 1) % actors.length];

        uint256 preBal = _getBalance1155(account, id);
        (bool ok, ) = diamond.call(
            abi.encodeWithSignature("settleExpired(address,uint256)", account, id)
        );
        if (!ok) {
            return;
        }

        ghost_settleCalls++;
        uint256 postBal = _getBalance1155(account, id);
        if (postBal < preBal) {
            ghost_totalSettleBurned += preBal - postBal;
        }

        console.log("[HANDLER] Settle Expired:", id, account);
    }

    /**
     * @notice Bounded time-warp handler — vm.warp by up to +/- 2 days per call.
     * @dev Even seeds warp forward, odd seeds warp backward (floored so the clock never
     *      approaches zero). Backward warps re-activate unexpired windows but can NEVER
     *      restore settled (burned) balances or cleared clocks — settlement is final (D4).
     * @param warpSeed Seed for direction (parity) and magnitude ([0, 2 days])
     */
    function handler_advanceTime(uint256 warpSeed) public {
        uint256 delta = _boundUint256(warpSeed, 0, LIFECYCLE_MAX_WARP);
        if (warpSeed % 2 == 0) {
            vm.warp(block.timestamp + delta);
        } else {
            uint256 newTs = block.timestamp > delta + LIFECYCLE_WARP_FLOOR
                ? block.timestamp - delta
                : LIFECYCLE_WARP_FLOOR;
            vm.warp(newTs);
        }
    }

    /**
     * @notice Deterministically exercise one full PerHolder mint -> expire -> settle cycle.
     * @dev The fuzz campaign is shallow (foundry.toml invariant runs/depth) and settles only
     *      succeed on expired state, so the afterInvariant coverage guards
     *      (ghost_settleCalls > 0, ghost_renewalCalls > 0) are seeded here regardless of fuzz
     *      luck — ConservationInvariant.seedConversion precedent (Codex P2). Also funds every
     *      actor with the PerTokenId token so the settle handler has material once the shared
     *      validUntil window passes. All mints are tree-neutral (handler GNUS burned 1:1).
     */
    function seedLifecycleCycle() public {
        if (lifecyclePerHolderId == 0 || lifecyclePerTokenId == 0) {
            return;
        }

        // Fund every actor with the PerTokenId token (pre-window-end, tree-neutral).
        for (uint256 i = 0; i < actors.length; i++) {
            _lifecycleMintTo(actors[i], lifecyclePerTokenId, LIFECYCLE_SEED_AMOUNT);
        }

        // One PerHolder mint (renewal path) -> warp past the clock -> settle (burn).
        address holder = actors[1];
        uint64 duration = _getDefaultDuration(lifecyclePerHolderId);
        if (!_lifecycleMintTo(holder, lifecyclePerHolderId, LIFECYCLE_SEED_AMOUNT)) {
            return;
        }
        ghost_renewalCalls++;

        vm.warp(block.timestamp + uint256(duration) + 1);
        (bool ok, ) = diamond.call(
            abi.encodeWithSignature("settleExpired(address,uint256)", holder, lifecyclePerHolderId)
        );
        if (ok) {
            ghost_settleCalls++;
            ghost_totalSettleBurned += LIFECYCLE_SEED_AMOUNT;
        }
    }

    /**
     * @notice Mint a lifecycle token to a holder via mintWithCredential as the handler
     *         (DEFAULT_ADMIN_ROLE satisfies the creator-or-admin gate; no verifier configured).
     * @param holder Mint recipient
     * @param id Lifecycle token id
     * @param amount Minion amount (burns the handler's GNUS 1:1)
     * @return ok True when the diamond call succeeded
     */
    function _lifecycleMintTo(address holder, uint256 id, uint256 amount) internal returns (bool ok) {
        if (_getGNUSBalance(address(this)) < amount) {
            return false;
        }
        (ok, ) = diamond.call(
            abi.encodeWithSignature(
                "mintWithCredential(address,uint256,uint256,bytes,bytes)",
                holder,
                id,
                amount,
                "",
                ""
            )
        );
    }

    /**
     * @notice Read the per-holder expiry clock via the diamond's holderExpiresAt view.
     * @param id Token id
     * @param holder Holder address
     * @return expiry The holder's expiry timestamp (0 = no active clock)
     */
    function _getHolderExpiry(uint256 id, address holder) internal view returns (uint64 expiry) {
        (bool ok, bytes memory data) = diamond.staticcall(
            abi.encodeWithSignature("holderExpiresAt(uint256,address)", id, holder)
        );
        if (!ok) {
            return 0;
        }
        return abi.decode(data, (uint64));
    }

    /**
     * @notice Read a token's defaultDuration from getNFTInfo (typed NFT struct decode —
     *         same pattern as _getChildCurIndex).
     * @param id Token id
     * @return duration The configured PerHolder purchase duration in seconds
     */
    function _getDefaultDuration(uint256 id) internal view returns (uint64 duration) {
        (bool ok, bytes memory data) = diamond.staticcall(
            abi.encodeWithSignature("getNFTInfo(uint256)", id)
        );
        if (!ok) {
            return 0;
        }
        NFT memory nft = abi.decode(data, (NFT));
        return nft.defaultDuration;
    }

    /**
     * @notice Get call summary for debugging
     */
    function callSummary() external view {
        console.log("===== Handler Call Summary =====");
        console.log("Transfers:", calls_transfer);
        console.log("Approvals:", calls_approve);
        console.log("Mints:", calls_mint);
        console.log("Burns:", calls_burn);
        console.log("Collections:", calls_createCollection);
        console.log("Bridge Deposits:", calls_bridgeDeposit);
        console.log("Grant Roles:", calls_grantRole);
        console.log("Revoke Roles:", calls_revokeRole);
        console.log("Mint ERC1155:", calls_mint1155);
        console.log("Burn ERC1155:", calls_burn1155);
        console.log("================================");
        console.log("Ghost Total Minted:", ghost_totalMinted);
        console.log("Ghost Total Burned:", ghost_totalBurned);
        console.log("Ghost Total Transfers:", ghost_totalTransfers);
    }
}
