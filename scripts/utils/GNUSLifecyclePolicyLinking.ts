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
 * Mocha path (13-04): both steps run in the test `before` hook BEFORE
 * `LocalDiamondDeployer.getInstance(...)` via `setupLifecyclePolicyLinking()`.
 *
 * Forge path (13-05): `diamonds-forge:test` deploys the diamond IN-PROCESS via the framework's
 * DeploymentManager — no per-suite `before` hook ever runs in that process, so the eager
 * installer above is never called. `installLazyLifecyclePolicyLinker(hre)` closes that gap: it
 * installs the SAME monkey-patch in lazy mode (deploy-on-first-use, cached per process) and is
 * wired from hardhat.config.ts via `extendEnvironment`, so EVERY hardhat process (including the
 * forge task) carries the linker. The two installers share one module-level state block:
 * whichever runs first installs the patch; the per-suite eager deploy then reuses the cached
 * library address (no double-deploy, no double-patch).
 *
 * CONFIG-LOAD SAFETY: this module must NOT `import ... from 'hardhat'` at the top level —
 * hardhat.config.ts imports it during config loading, and the main 'hardhat' entry throws
 * LIB_IMPORTED_FROM_THE_CONFIG when the HRE is not yet constructed. All runtime access goes
 * through a lazily required HRE (or an explicit hre parameter).
 *
 * The monkey-patch is process-local and reversible (recompiling/regenerating typechain is
 * unaffected); it does NOT touch the compile pipeline, the diamonds config, or production
 * deployment scripts (which would call the same two helpers).
 */

const LIBRARY_NAME = 'GNUSLifecyclePolicy';
const LIBRARY_FQN = `contracts/gnus-ai/${LIBRARY_NAME}.sol:${LIBRARY_NAME}`;

let linkedLibraryAddress: string | undefined;
let linkerInstalled = false;

/**
 * Lazily resolve the constructed HRE at RUNTIME (never at module load).
 * @returns The initialized HardhatRuntimeEnvironment.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
function runtimeHre(): any {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('hardhat');
}

/**
 * Deploy GNUSLifecyclePolicy once per process (idempotent) and return its address.
 * @param hre Optional explicit HRE (config/extendEnvironment path); defaults to the runtime HRE.
 * @returns The deployed library address (checksummed-lower hex).
 */
export async function deployAndLinkLifecyclePolicy(hre?: any): Promise<string> {
    if (linkedLibraryAddress) {
        return linkedLibraryAddress;
    }
    const env = hre ?? runtimeHre();
    const [deployer] = await env.ethers.getSigners();
    const factory = await env.ethers.getContractFactory(LIBRARY_NAME, deployer);
    const library = await factory.deploy();
    await library.waitForDeployment();
    linkedLibraryAddress = (await library.getAddress()).toLowerCase();
    return linkedLibraryAddress;
}

/**
 * Shared patch installer. When `lazyDeploy` is true and a linking artifact is requested before
 * the library has been deployed, the library is deployed on the spot against `hre.network` and
 * cached for the rest of the process (the forge in-process deployment path). When false, the
 * caller must have run `deployAndLinkLifecyclePolicy()` first (the mocha path).
 * @param hre The HRE whose `ethers.getContractFactory` is patched.
 * @param lazyDeploy Deploy the library on first linking-factory request when true.
 */
function patchGetContractFactory(hre: any, lazyDeploy: boolean): void {
    if (linkerInstalled) {
        return;
    }
    linkerInstalled = true;

    const ethersRef: any = hre.ethers;
    const original = ethersRef.getContractFactory.bind(ethersRef);
    ethersRef.getContractFactory = async (nameOrAbi: any, opts?: any) => {
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
                    if (!linkedLibraryAddress) {
                        if (!lazyDeploy) {
                            throw new Error(
                                `${LIBRARY_NAME} linker installed without a deployed library address — ` +
                                    'call deployAndLinkLifecyclePolicy() first',
                            );
                        }
                        await deployAndLinkLifecyclePolicy(hre);
                    }
                    const isSigner = opts && typeof opts === 'object' && 'provider' in opts;
                    const signer = isSigner ? opts : opts?.signer;
                    const base = typeof opts === 'object' && !isSigner ? opts : {};
                    opts = {
                        ...base,
                        signer,
                        libraries: { ...(base.libraries ?? {}), [LIBRARY_FQN]: linkedLibraryAddress },
                    };
                }
            }
        }
        return original(nameOrAbi, opts);
    };
}

/**
 * Monkey-patch `ethers.getContractFactory` to inject the GNUSLifecyclePolicy library address
 * into any factory whose artifact links the library. Idempotent. Call AFTER
 * `deployAndLinkLifecyclePolicy()` and BEFORE `LocalDiamondDeployer.getInstance(...)`.
 * @param libraryAddress The deployed GNUSLifecyclePolicy address.
 * @param hre Optional explicit HRE; defaults to the runtime HRE.
 */
export function installLifecyclePolicyLinker(libraryAddress: string, hre?: any): void {
    linkedLibraryAddress = (linkedLibraryAddress ?? libraryAddress).toLowerCase();
    patchGetContractFactory(hre ?? runtimeHre(), false);
}

/**
 * Forge-path installer (13-05): install the SAME patch in lazy mode so the in-process
 * `diamonds-forge:test` DeploymentManager deployment links GNUSLifecyclePolicy without any
 * per-suite wiring. Wired from hardhat.config.ts via `extendEnvironment`. Idempotent and
 * compatible with the per-suite `setupLifecyclePolicyLinking()` — whichever runs first installs
 * the patch; both share the module-level `linkedLibraryAddress` cache.
 * @param hre The HRE provided by `extendEnvironment`.
 */
export function installLazyLifecyclePolicyLinker(hre: any): void {
    patchGetContractFactory(hre, true);
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
