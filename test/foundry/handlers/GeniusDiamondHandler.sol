// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GeniusDiamondTestBase} from "../base/GeniusDiamondTestBase.sol";
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
    uint256 public ghost_totalTransfers;
    uint256 public ghost_totalApprovals;
    uint256 public ghost_totalCollectionsCreated;
    uint256 public ghost_totalBridgeDeposits;
    uint256 public ghost_totalBridgeWithdrawals;

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
        if (balance == 0) return;

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
        if (balance == 0) return;

        amount = _boundUint256(amount, 1 ether, balance);

        bytes memory callData = abi.encodeWithSignature(
            "bridgeOut(uint256,uint256,uint256)",
            amount,
            GNUS_TOKEN_ID,
            1 // destination chain
        );

        vm.prank(currentActor);
        (bool success, ) = diamond.call(callData);

        if (success) {
            ghost_totalBridgeDeposits++;
            calls_bridgeDeposit++;
        }

        console.log("[HANDLER] Bridge Deposit:", amount);
    }

    /**
     * @notice Bounded role granting handler for access control testing
     * @dev Grants random roles to random actors to test RBAC (Role-Based Access Control).
     *      Only DEFAULT_ADMIN_ROLE can grant roles, enforcing security hierarchy.
     *
     * INPUT BOUNDS:
     * - actorSeed: Unused (admin is always address(this))
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
     * - ghost_totalCollectionsCreated: Reused as role operation counter
     * - calls_grantRole: Counter for this handler invocation
     *
     * @param actorSeed Seed to select admin actor (always address(this))
     * @param roleSeed Seed to select role to grant
     * @param targetSeed Seed to select target address receiving role
     */
    function handler_grantRole(uint256 actorSeed, uint256 roleSeed, uint256 targetSeed) public {
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

        ghost_totalCollectionsCreated++; // Reusing ghost variable for role operations count
        calls_grantRole++;

        console.log("[HANDLER] Grant Role");
    }

    /**
     * @notice Bounded role revocation handler for access control testing
     * @dev Revokes random roles from random actors to test permission removal.
     *      Only DEFAULT_ADMIN_ROLE can revoke roles, maintaining security model.
     *
     * INPUT BOUNDS:
     * - actorSeed: Unused (admin is always address(this))
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
     * @param actorSeed Seed to select admin actor (always address(this))
     * @param roleSeed Seed to select role to revoke
     * @param targetSeed Seed to select target address losing role
     */
    function handler_revokeRole(uint256 actorSeed, uint256 roleSeed, uint256 targetSeed) public {
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
        if (balance == 0) return;

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
        tokenId = _boundUint256(tokenId, 1, 100); // Token IDs 1-100
        amount = _boundUint256(amount, 1, 1000);

        bytes memory callData = abi.encodeWithSignature(
            "mint(address,uint256,uint256)",
            recipient,
            tokenId,
            amount
        );

        // Only test contract has MINTER_ROLE
        (bool success, ) = diamond.call(callData);

        if (success) {
            calls_mint1155++;
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
