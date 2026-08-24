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
 * unaffected); it does NOT touch the compile pipeline or the diamonds config.
 *
 * PRODUCTION COVERAGE (13-06): every hardhat process — including the production RPC deploy /
 * Safe-proposal entry points (scripts/deploy/rpc/*.ts import 'hardhat', which loads
 * hardhat.config.ts and installs the lazy linker via extendEnvironment) — gets the patch. The
 * production strategies create facet factories through `hardhat.ethers.getContractFactory(name,
 * { signer })` (@geniusventures/diamonds BaseDeploymentStrategy), which the patch intercepts;
 * when a signer rides along, the lazy library deploy uses IT (deployAndLinkLifecyclePolicyWithSigner)
 * so the library lands on the RPC target network, not the HRE default.
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
 * Deploy GNUSLifecyclePolicy once per process using an EXPLICIT signer (13-06 production path).
 * The production RPC deploy flow (RPCDiamondDeployer → @geniusventures/diamonds
 * BaseDeploymentStrategy) requests facet factories as `getContractFactory(name, { signer })`
 * with the raw RPC wallet — the lazy linker honors that signer here so the library deployment
 * is broadcast on the target network, not the HRE default network.
 * @param signer The signer intercepted from the factory request (RPC wallet / Safe proposer).
 * @returns The deployed library address (checksummed-lower hex).
 */
export async function deployAndLinkLifecyclePolicyWithSigner(signer: any): Promise<string> {
    if (linkedLibraryAddress) {
        return linkedLibraryAddress;
    }
    const env = runtimeHre();
    const factory = await env.ethers.getContractFactory(LIBRARY_NAME, signer);
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
                    const isSigner = opts && typeof opts === 'object' && 'provider' in opts;
                    const signer = isSigner ? opts : opts?.signer;
                    if (!linkedLibraryAddress) {
                        if (!lazyDeploy) {
                            throw new Error(
                                `${LIBRARY_NAME} linker installed without a deployed library address — ` +
                                    'call deployAndLinkLifecyclePolicy() first',
                            );
                        }
                        // 13-06: when the intercepted factory call carries an explicit signer
                        // (production path — RPCDiamondDeployer / SafeProposer strategy pass the
                        // RPC wallet as { signer }), deploy the library WITH THAT SIGNER so it
                        // lands on the target network. Falling back to hre.ethers.getSigners()
                        // would deploy against whatever network the HRE defaults to (the built-in
                        // hardhat network under the RPC ts-node entry points) and link production
                        // facet bytecode against a library address that does not exist on the
                        // target chain.
                        if (signer) {
                            await deployAndLinkLifecyclePolicyWithSigner(signer);
                        } else {
                            await deployAndLinkLifecyclePolicy(hre);
                        }
                    }
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
