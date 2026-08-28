import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { Diamond } from '@geniusventures/diamonds';
import {
    loadDiamondContract,
    LocalDiamondDeployer,
    LocalDiamondDeployerConfig,
} from '@geniusventures/hardhat-diamonds/dist/utils';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { debug } from 'debug';
import { JsonRpcProvider } from 'ethers';
import hre, { ethers } from 'hardhat';
import { multichain } from '@geniusventures/hardhat-multichain';
import { GeniusDiamond } from '../../diamond-typechain-types';
import { toWei } from '../../scripts/utils/helpers';
import { setupLifecyclePolicyLinking } from '../../scripts/utils/GNUSLifecyclePolicyLinking';
import {
    SGNS_DESTINATION,
    SGNS_DESTINATION_Y_ODD,
    DEST_CHAIN_ID,
} from '../utils/bridge-fixtures';

chai.use(chaiAsPromised);

/**
 * Phase 13 — Bridge transfer-policy tests (Plan 13-06, SC4 / D7).
 *
 * Proves that bridging IS a transfer: GNUSBridge.bridgeOut reverts for policy-bound
 * tokens BEFORE any state change — in particular BEFORE the withdrawal-limiter charge
 * (a reverted policy-bound bridge consumes NO limiter allowance) and before the _burn.
 *
 * Behaviors (per 13-06-PLAN Task 2):
 *   1. SOULBOUND bridgeOut reverts "Policy-bound token cannot bridge in v1".
 *   2. ISSUER_ONLY bridgeOut reverts (same string — creator-held tokens are blocked in v1 too).
 *   3. CONTROLLED_RESALE bridgeOut reverts.
 *   4. LOCKED_AFTER_START bridges pre-start, reverts post-start.
 *   5. UNRESTRICTED bridgeOut succeeds (BridgeOutInitiated emitted, balance burned).
 *   6. ALLOWLISTED: sender allowed → succeeds; sender removed → reverts
 *      "ALLOWLISTED: bridge initiator not allowed"; no registry → reverts
 *      "ALLOWLISTED: no registry configured" (Q4 v1 sender-side semantics).
 *   7. Limiter NOT charged on policy revert (ordering proof — fails if the policy check
 *      were placed after checkAndRecordWithdraw).
 *
 * Boot pattern: GNUSLifecyclePolicy.test.ts (13-04). Bridge fixtures from
 * test/utils/bridge-fixtures.ts (shared single source of truth).
 *
 * Policy ordinals (GNUSLifecycleTypes.sol TransferPolicy): UNRESTRICTED=0, SOULBOUND=1,
 * ISSUER_ONLY=2, ALLOWLISTED=3, CONTROLLED_RESALE=4, LOCKED_AFTER_START=5.
 */
describe('GNUS Bridge Policy Tests (Phase 13 D7/SC4)', async function () {
    const diamondName = 'GeniusDiamond';
    const log: debug.Debugger = debug('GNUSBridgePolicy:log:${diamondName}');
    this.timeout(0); // Extended indefinitely for diamond deployment time

    const networkProviders = multichain.getProviders() || new Map<string, JsonRpcProvider>();

    if (process.argv.includes('test-multichain')) {
        const networkNames = process.argv[process.argv.indexOf('--chains') + 1].split(',');
        if (networkNames.includes('hardhat')) {
            networkProviders.set('hardhat', ethers.provider as any);
        }
    } else if (process.argv.includes('test') || process.argv.includes('coverage')) {
        networkProviders.set('hardhat', ethers.provider as any);
    }

    const GNUS_TOKEN_ID = 0n;

    for (const [networkName, provider] of networkProviders.entries()) {
        describe(`Chain: ${networkName}  Diamond: ${diamondName}`, function () {
            let diamond: Diamond;
            let signers: SignerWithAddress[];
            let signer1: string;
            let signer2: string;
            let owner: string;
            let ownerSigner: SignerWithAddress;
            let geniusDiamond: GeniusDiamond;
            let ownerDiamond: GeniusDiamond;
            let signer1Diamond: GeniusDiamond;
            let diamondAddress: string;

            let ethersMultichain: typeof ethers;
            let snapshotId: string;

            before(async function () {
                // 13-04: deploy GNUSLifecyclePolicy library + install factory linker before diamond deploy.
                await setupLifecyclePolicyLinking();
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
                signer1 = signers[1].address;
                signer2 = signers[2].address;

                owner = diamond.getDeployedDiamondData().DeployerAddress || '';
                if (!owner) {
                    diamond.setSigner(signers[0]);
                    owner = signers[0].address;
                }
                ownerSigner = await ethersMultichain.getSigner(owner);
                ownerDiamond = geniusDiamond.connect(ownerSigner);
                signer1Diamond = geniusDiamond.connect(signers[1]);
            });

            beforeEach(async function () {
                snapshotId = await provider.send('evm_snapshot', []);
            });

            afterEach(async () => {
                if (snapshotId) {
                    await provider.send('evm_revert', [snapshotId]);
                }
            });

            /** LifecycleConfig builder. All defaults are the zero-defaults (legacy behavior). */
            function defaultConfig(overrides: Partial<{
                validFrom: bigint;
                validUntil: bigint;
                defaultDuration: bigint;
                expirationMode: number;
                transferPolicy: number;
                expirationDisposition: number;
                expirationRecipient: string;
                credentialVerifier: string;
            }> = {}) {
                return {
                    validFrom: overrides.validFrom ?? 0n,
                    validUntil: overrides.validUntil ?? 0n,
                    defaultDuration: overrides.defaultDuration ?? 0n,
                    expirationMode: overrides.expirationMode ?? 0,
                    transferPolicy: overrides.transferPolicy ?? 0,
                    expirationDisposition: overrides.expirationDisposition ?? 0,
                    expirationRecipient: overrides.expirationRecipient ?? ethers.ZeroAddress,
                    credentialVerifier: overrides.credentialVerifier ?? ethers.ZeroAddress,
                };
            }

            /**
             * Fund owner with GNUS, create a fresh direct-child NFT (creator = owner), apply the
             * given LifecycleConfig, and mint `amount` to signer1 (the standard holder / bridge
             * initiator). configureLifecycle must run BEFORE the first mint (13-02 gate).
             */
            async function createConfiguredNFT(
                name: string,
                symbol: string,
                config: ReturnType<typeof defaultConfig>,
                mintTo: string = signer1,
                amount: bigint = toWei('10'),
            ): Promise<bigint> {
                await ownerDiamond['mint(address,uint256)'](owner, toWei('10000'));
                const info = await geniusDiamond.getNFTInfo(GNUS_TOKEN_ID);
                const childIndex: bigint = info.childCurIndex;
                await ownerDiamond.createNFT(
                    GNUS_TOKEN_ID,
                    name,
                    symbol,
                    toWei('1'),
                    toWei('1000000'),
                    `ipfs://${symbol.toLowerCase()}`,
                );
                const id = (GNUS_TOKEN_ID << 128n) | childIndex;
                await ownerDiamond.configureLifecycle(id, config);
                await ownerDiamond.mintWithCredential(mintTo, id, amount, '0x', '0x');
                return id;
            }

            /** bridgeOut shorthand with the shared bridge fixtures (destChainID != 31337, non-zero sgnsDestination). */
            function bridgeOutFrom(diamond: GeniusDiamond, amount: bigint, id: bigint) {
                return diamond.bridgeOut(amount, id, DEST_CHAIN_ID, SGNS_DESTINATION, SGNS_DESTINATION_Y_ODD);
            }

            it('bridgeOut SOULBOUND reverts "Policy-bound token cannot bridge in v1"', async function () {
                const id = await createConfiguredNFT('BridgeSoul', 'BSB', defaultConfig({ transferPolicy: 1 }));
                await expect(bridgeOutFrom(signer1Diamond, toWei('1'), id)).to.be.revertedWith(
                    'Policy-bound token cannot bridge in v1',
                );
            });

            it('bridgeOut ISSUER_ONLY reverts (holder-held tokens blocked in v1, D7)', async function () {
                const id = await createConfiguredNFT('BridgeIssuer', 'BIO', defaultConfig({ transferPolicy: 2 }));
                await expect(bridgeOutFrom(signer1Diamond, toWei('1'), id)).to.be.revertedWith(
                    'Policy-bound token cannot bridge in v1',
                );
            });

            it('bridgeOut CONTROLLED_RESALE reverts', async function () {
                const id = await createConfiguredNFT('BridgeResale', 'BCR', defaultConfig({ transferPolicy: 4 }));
                await expect(bridgeOutFrom(signer1Diamond, toWei('1'), id)).to.be.revertedWith(
                    'Policy-bound token cannot bridge in v1',
                );
            });

            it('bridgeOut LOCKED_AFTER_START bridges pre-start and reverts post-start', async function () {
                // Mint first (validFrom = 0 so the mint window is open), then move validFrom to
                // the future via the D4 creator-only timestamp mutator — tokens now exist and the
                // lock engages at validFrom.
                const now = BigInt(await time.latest());
                const start = now + 1000n;
                const srcChainId = (await geniusDiamond.protocolInfo())[2];
                const id = await createConfiguredNFT('BridgeLocked', 'BLK', defaultConfig({ transferPolicy: 5 }));
                await ownerDiamond.setValidFrom(id, start);

                // Pre-start: bridge succeeds.
                await expect(bridgeOutFrom(signer1Diamond, toWei('2'), id))
                    .to.emit(geniusDiamond, 'BridgeOutInitiated')
                    .withArgs(signer1, id, toWei('2'), srcChainId, BigInt(DEST_CHAIN_ID), SGNS_DESTINATION, SGNS_DESTINATION_Y_ODD);
                expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, id)).to.eq(toWei('8'));

                // Post-start: bridge reverts.
                await time.setNextBlockTimestamp(Number(start));
                await expect(bridgeOutFrom(signer1Diamond, toWei('2'), id)).to.be.revertedWith(
                    'Policy-bound token cannot bridge in v1',
                );
            });

            it('bridgeOut UNRESTRICTED succeeds — BridgeOutInitiated emitted, balance burned', async function () {
                const id = await createConfiguredNFT('BridgeFree', 'BUN', defaultConfig());
                const srcChainId = (await geniusDiamond.protocolInfo())[2];
                await expect(bridgeOutFrom(signer1Diamond, toWei('3'), id))
                    .to.emit(geniusDiamond, 'BridgeOutInitiated')
                    .withArgs(signer1, id, toWei('3'), srcChainId, BigInt(DEST_CHAIN_ID), SGNS_DESTINATION, SGNS_DESTINATION_Y_ODD);
                expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, id)).to.eq(toWei('7'));
            });

            describe('ALLOWLISTED (Q4 v1 sender-side semantics)', function () {
                it('allowed sender bridges; removed sender reverts; missing registry reverts', async function () {
                    const { mock, address: registryAddr } = await deployMockRegistry();

                    // Token WITH a registry (must be set pre-first-mint, 13-02 gate).
                    await ownerDiamond['mint(address,uint256)'](owner, toWei('10000'));
                    const info = await geniusDiamond.getNFTInfo(GNUS_TOKEN_ID);
                    const childIndex: bigint = info.childCurIndex;
                    await ownerDiamond.createNFT(
                        GNUS_TOKEN_ID, 'BridgeAllow', 'BAL', toWei('1'), toWei('1000000'), 'ipfs://bal',
                    );
                    const id = (GNUS_TOKEN_ID << 128n) | childIndex;
                    await ownerDiamond.configureLifecycle(id, defaultConfig({ transferPolicy: 3 }));
                    await ownerDiamond.setAllowlistRegistry(id, registryAddr);
                    await ownerDiamond.mintWithCredential(signer1, id, toWei('10'), '0x', '0x');

                    // Sender not yet allowlisted → blocked.
                    await expect(bridgeOutFrom(signer1Diamond, toWei('1'), id)).to.be.revertedWith(
                        'ALLOWLISTED: bridge initiator not allowed',
                    );

                    // Allowlist the SENDER (Q4: initiator-side check) → bridge succeeds.
                    await mock.setAllowed(signer1, true);
                    await expect(bridgeOutFrom(signer1Diamond, toWei('1'), id)).to.emit(
                        geniusDiamond,
                        'BridgeOutInitiated',
                    );
                    expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, id)).to.eq(toWei('9'));

                    // Remove the sender → blocked again.
                    await mock.setAllowed(signer1, false);
                    await expect(bridgeOutFrom(signer1Diamond, toWei('1'), id)).to.be.revertedWith(
                        'ALLOWLISTED: bridge initiator not allowed',
                    );

                    // Token WITHOUT a registry → "no registry configured".
                    const idNoReg = await createConfiguredNFT('BridgeNoReg', 'BNR', defaultConfig({ transferPolicy: 3 }));
                    await expect(bridgeOutFrom(signer1Diamond, toWei('1'), idNoReg)).to.be.revertedWith(
                        'ALLOWLISTED: no registry configured',
                    );
                });
            });

            it('limiter NOT charged on a policy-bound revert (ordering proof)', async function () {
                const id = await createConfiguredNFT('BridgeLimiter', 'BLM', defaultConfig({ transferPolicy: 1 }));
                // Warm the limiter with a successful UNRESTRICTED child bridge so signer1 has a
                // non-zero, observable withdrawal usage — proving the reader works and that a
                // subsequent policy-bound revert leaves it untouched.
                const idFree = await createConfiguredNFT('BridgeLimiterFree', 'BLF', defaultConfig());
                await bridgeOutFrom(signer1Diamond, toWei('2'), idFree);

                const [usageAfterSuccess] = await geniusDiamond.getAccountWithdrawStatus(signer1);
                const usageBefore = usageAfterSuccess;
                expect(usageBefore).to.eq(toWei('2')); // reader sanity: the successful bridge charged the limiter

                // Policy-bound attempt reverts — must NOT consume limiter allowance.
                await expect(bridgeOutFrom(signer1Diamond, toWei('5'), id)).to.be.revertedWith(
                    'Policy-bound token cannot bridge in v1',
                );
                const [usageAfterRevert] = await geniusDiamond.getAccountWithdrawStatus(signer1);
                expect(usageAfterRevert).to.eq(usageBefore); // unchanged — policy check fires BEFORE checkAndRecordWithdraw
            });

            /**
             * Phase 14 — D-24 SOULBOUND operator-mediated bridge + D-23 expiry gate.
             *
             * SOULBOUND credits may bridge out ONLY when the caller holds CREATOR_ROLE or
             * DEFAULT_ADMIN_ROLE (D-24 mint→bridge transport) AND the entitlement is unexpired
             * (D-23: PerTokenId validUntil / PerHolder holderExpiresAt, mirroring the "Sale
             * ended" analogue). The gate runs inside _enforceBridgePolicy BEFORE the limiter
             * charge + burn, so an expired revert consumes no limiter allowance. The Phase 13
             * D5 expired-burn settlement carve-out is untouched (regression below).
             */
            describe('Phase 14 D-24/D-23 SOULBOUND bridge gate', function () {
                const CREATOR_ROLE = ethers.id('CREATOR_ROLE');

                /** Mint a SOULBOUND child to a specific recipient (creator = owner). */
                async function createSoulboundNFT(
                    name: string,
                    symbol: string,
                    overrides: Partial<Parameters<typeof defaultConfig>[0]> = {},
                    mintTo: string = signer1,
                ): Promise<bigint> {
                    return createConfiguredNFT(name, symbol, defaultConfig({
                        transferPolicy: 1,
                        ...overrides,
                    }), mintTo);
                }

                it('unexpired SOULBOUND bridges for a DEFAULT_ADMIN caller (D-24)', async function () {
                    const id = await createSoulboundNFT('P14SoulAdmin', 'PSA', {}, owner);
                    const srcChainId = (await geniusDiamond.protocolInfo())[2];
                    await expect(bridgeOutFrom(ownerDiamond, toWei('3'), id))
                        .to.emit(geniusDiamond, 'BridgeOutInitiated')
                        .withArgs(owner, id, toWei('3'), srcChainId, BigInt(DEST_CHAIN_ID), SGNS_DESTINATION, SGNS_DESTINATION_Y_ODD);
                    expect(await geniusDiamond['balanceOf(address,uint256)'](owner, id)).to.eq(toWei('7'));
                });

                it('unexpired SOULBOUND bridges for a CREATOR_ROLE caller (D-24)', async function () {
                    await ownerDiamond.grantRole(CREATOR_ROLE, signer1);
                    const id = await createSoulboundNFT('P14SoulCreator', 'PSC');
                    await expect(bridgeOutFrom(signer1Diamond, toWei('2'), id)).to.emit(
                        geniusDiamond,
                        'BridgeOutInitiated',
                    );
                    expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, id)).to.eq(toWei('8'));
                });

                it('expired PerTokenId SOULBOUND bridge reverts "License expired" even for admin (D-23)', async function () {
                    const until = BigInt(await time.latest()) + 5000n;
                    const id = await createSoulboundNFT('P14ExpPTI', 'PEP', { expirationMode: 1, validUntil: until }, owner);
                    await time.increaseTo(Number(until) + 1);
                    await expect(bridgeOutFrom(ownerDiamond, toWei('1'), id)).to.be.revertedWith('License expired');
                });

                it('expired PerHolder SOULBOUND bridge reverts "License expired" even for admin (D-23)', async function () {
                    const id = await createSoulboundNFT('P14ExpPH', 'PEH', { expirationMode: 2, defaultDuration: 1000n, expirationDisposition: 2 }, owner);
                    const expiry = await geniusDiamond.holderExpiresAt(id, owner);
                    expect(expiry).to.be.gt(0n);
                    await time.increaseTo(Number(expiry) + 1);
                    await expect(bridgeOutFrom(ownerDiamond, toWei('1'), id)).to.be.revertedWith('License expired');
                });

                it('limiter NOT charged on an expired-gate revert (D-23 ordering proof)', async function () {
                    await ownerDiamond.grantRole(CREATOR_ROLE, signer1);
                    const id = await createSoulboundNFT('P14ExpLim', 'PEL', { expirationMode: 2, defaultDuration: 1000n, expirationDisposition: 2 });
                    // Warm the limiter via a successful UNRESTRICTED child bridge.
                    const idFree = await createConfiguredNFT('P14ExpLimFree', 'PLF', defaultConfig());
                    await bridgeOutFrom(signer1Diamond, toWei('2'), idFree);
                    const [usageBefore] = await geniusDiamond.getAccountWithdrawStatus(signer1);
                    expect(usageBefore).to.eq(toWei('2'));

                    const expiry = await geniusDiamond.holderExpiresAt(id, signer1);
                    await time.increaseTo(Number(expiry) + 1);
                    await expect(bridgeOutFrom(signer1Diamond, toWei('1'), id)).to.be.revertedWith('License expired');
                    const [usageAfter] = await geniusDiamond.getAccountWithdrawStatus(signer1);
                    expect(usageAfter).to.eq(usageBefore); // expiry gate fires BEFORE checkAndRecordWithdraw
                });

                it('expired-burn settlement carve-out untouched — settleExpired still succeeds (Phase 13 D5)', async function () {
                    const id = await createSoulboundNFT('P14Settle', 'PST', {
                        expirationMode: 2,
                        defaultDuration: 1000n,
                        expirationDisposition: 2, // BURN
                    });
                    const expiry = await geniusDiamond.holderExpiresAt(id, signer1);
                    await time.increaseTo(Number(expiry) + 1);
                    // Bridge still blocked post-expiry (settlement is the only exit)...
                    await ownerDiamond.grantRole(CREATOR_ROLE, signer1);
                    await expect(bridgeOutFrom(signer1Diamond, toWei('1'), id)).to.be.revertedWith('License expired');
                    // ...while the permissionless expired-burn settlement still runs.
                    await geniusDiamond.connect(signers[2]).settleExpired(signer1, id);
                    expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, id)).to.eq(0n);
                });
            });

            /** Deploy a fresh MockAllowlistRegistry and return its address + contract. */
            async function deployMockRegistry() {
                const factory = await ethers.getContractFactory('MockAllowlistRegistry');
                const mock = await factory.deploy();
                await mock.waitForDeployment();
                const address = await mock.getAddress();
                return { mock, address };
            }
        });
    }
});
