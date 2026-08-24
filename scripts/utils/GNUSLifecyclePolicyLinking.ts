import * as fs from 'fs';
import * as path from 'path';
import hre, { ethers } from 'hardhat';

/**
 * Phase 13 (13-04) — GNUSLifecyclePolicy library linking harness.
 *
 * GNUSLifecyclePolicy is a compile-time-linked Solidity `library` with `public` functions
 * (Option A, confirmed 2026-08-23): every facet that calls it (GNUSNFTFactory, and the
 * GNUSERC1155MaxSupply base surface inherited by GNUSLifecycleMint / GNUSLifecycle /
 * GNUSRedeemAdapter / GNUSBridge / GNUSTreasury / ERC20TransferBatch) carries a DELEGATECALL
 * stub to the library's fixed pure-code address. The library is NOT a diamond facet and is NOT
 * registered in geniusdiamond.config.json.
 *
 * The GeniusVentures diamonds deployment framework creates facet factories via
 * `ethers.getContractFactory(name, { signer })` with NO `libraries` wiring, and hardhat-ethers
 * `collectLibrariesAndLink` REQUIRES the `libraries` option whenever an artifact declares
 * `linkReferences` — it does NOT honor manually pre-linked artifact bytecode. So a facet that
 * links GNUSLifecyclePolicy cannot deploy through the unmodified framework.
 *
 * This helper resolves that OUTSIDE the framework, in the test/deployment harness:
 *
 *   1. `deployAndLinkLifecyclePolicy()` deploys the GNUSLifecyclePolicy pure-code contract once
 *      per process (idempotent) and returns its address.
 *   2. `installLifecyclePolicyLinker(libraryAddress)` monkey-patches
 *      `ethers.getContractFactory` so that any contract whose artifact declares a link reference
 *      to GNUSLifecyclePolicy is created with
 *      `libraries: { 'contracts/gnus-ai/GNUSLifecyclePolicy.sol:GNUSLifecyclePolicy': address }`
 *      injected — transparent to the diamonds framework, which keeps calling
 *      `getContractFactory(name, { signer })` exactly as before.
 *
 * Both steps run in the test `before` hook BEFORE `LocalDiamondDeployer.getInstance(...)`. The
 * monkey-patch is process-local and reversible (recompiling/regenerating typechain is
 * unaffected); it does NOT touch the compile pipeline, the diamonds config, or production
 * deployment scripts (which would call the same two helpers).
 */

const LIBRARY_NAME = 'GNUSLifecyclePolicy';
const LIBRARY_FQN = `contracts/gnus-ai/${LIBRARY_NAME}.sol:${LIBRARY_NAME}`;

let linkedLibraryAddress: string | undefined;
let linkerInstalled = false;

/**
 * Deploy GNUSLifecyclePolicy once per process (idempotent) and return its address.
 * @returns The deployed library address (checksummed-lower hex).
 */
export async function deployAndLinkLifecyclePolicy(): Promise<string> {
    if (linkedLibraryAddress) {
        return linkedLibraryAddress;
    }
    const [deployer] = await ethers.getSigners();
    const factory = await ethers.getContractFactory(LIBRARY_NAME, deployer);
    const library = await factory.deploy();
    await library.waitForDeployment();
    linkedLibraryAddress = (await library.getAddress()).toLowerCase();
    return linkedLibraryAddress;
}

/**
 * Monkey-patch `ethers.getContractFactory` to inject the GNUSLifecyclePolicy library address
 * into any factory whose artifact links the library. Idempotent. Call AFTER
 * `deployAndLinkLifecyclePolicy()` and BEFORE `LocalDiamondDeployer.getInstance(...)`.
 * @param libraryAddress The deployed GNUSLifecyclePolicy address.
 */
export function installLifecyclePolicyLinker(libraryAddress: string): void {
    if (linkerInstalled) {
        return;
    }
    linkerInstalled = true;

    const original = ethers.getContractFactory.bind(ethers);
    (ethers as any).getContractFactory = async (nameOrAbi: any, opts?: any) => {
        if (typeof nameOrAbi === 'string') {
            let artifact: any;
            try {
                artifact = await hre.artifacts.readArtifact(nameOrAbi);
            } catch {
                artifact = undefined;
            }
            if (artifact) {
                const needsLib = Object.values(artifact.linkReferences ?? {}).some(
                    (byFile: any) => Object.keys(byFile ?? {}).includes(LIBRARY_NAME),
                );
                if (needsLib) {
                    const isSigner = opts && typeof opts === 'object' && 'provider' in opts;
                    const signer = isSigner ? opts : opts?.signer;
                    const base = typeof opts === 'object' && !isSigner ? opts : {};
                    opts = {
                        ...base,
                        signer,
                        libraries: { ...(base.libraries ?? {}), [LIBRARY_FQN]: libraryAddress },
                    };
                }
            }
        }
        return original(nameOrAbi, opts);
    };
}

/**
 * Convenience: deploy the library AND install the linker in one call. Use in test `before`
 * hooks before deploying the diamond.
 * @returns The deployed library address.
 */
export async function setupLifecyclePolicyLinking(): Promise<string> {
    const address = await deployAndLinkLifecyclePolicy();
    installLifecyclePolicyLinker(address);
    return address;
}
