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
import { multichain } from 'hardhat-multichain';
import { GeniusDiamond } from '../../diamond-typechain-types';
import { toWei } from '../../scripts/utils/helpers';
import { setupLifecyclePolicyLinking } from '../../scripts/utils/GNUSLifecyclePolicyLinking';

chai.use(chaiAsPromised);

/**
 * Phase 13 — Settlement / renewal / mutability behavior matrix (Plan 13-05, SC2/SC5/SC8/D4/D9).
 *
 * This file is the acceptance gate for the mechanism shipped in 13-02/13-03/13-04:
 *   - Describe block 1 (Task 1, SC5/D9): the settleExpired disposition matrix — all five
 *     dispositions (NONE / KEEP_INERT / BURN / RETURN_TO_ADDRESS / REDEEM_TO_PARENT),
 *     revert-on-unexpired, idempotency, fixed-recipient non-redirect via a third-party caller,
 *     per-holder clock clearing, Settled events, the D9 circulating-supply convention row, and
 *     the D4 no-un-burn row. REDEEM_TO_PARENT supply-neutrality is asserted numerically
 *     (child totalSupply down by exactly the settled amount, parent (GNUS) balance up by the
 *     same amount, totalSupplyOfAll unchanged).
 *   - Describe block 2 (Task 2, SC2/SC8/D4): validFrom/validUntil boundaries, the D3 renewal
 *     matrix driven through mintWithCredential (active stacks: clock_new == clock_old + D,
 *     NOT now + D; expired settles-then-restarts; zero-balance starts fresh; expired balances
 *     never resurrected), D4 timestamp mutability with events, post-first-mint policy
 *     immutability, and the Q2 PerHolder + transferable-policy matrix.
 *
 * Facet map (post 13-03 REPLAN): settleExpired / mintWithCredential / Settled /
 * HolderExpiryUpdated live on GNUSLifecycleMint; configureLifecycle / setValidFrom /
 * setValidUntil / isTokenActive / isSpendable / holderExpiresAt / createNFTWithLifecycle live
 * on GNUSLifecycle. Both facets are reached through the diamond fallback — all calls below go
 * to the combined GeniusDiamond typechain interface.
 *
 * Revert-string provenance (read from shipped source, not guessed):
 *   - GNUSLifecycleMint._checkMintPolicy:  "Sale not started" / "Sale ended"
 *   - GNUSLifecyclePolicy.enforceMintGate: "Token not yet active" / "Per-wallet mint cap exceeded"
 *   - GNUSLifecycleMint.settleExpired:     "Token not created" / "Not expired"
 *   - GNUSLifecycle.configureLifecycle:    "Policy immutable after first mint" /
 *     "PerHolder requires non-transferable policy" / "REDEEM_TO_PARENT requires convertible
 *     token" / "RETURN_TO_ADDRESS needs recipient"
 *   - GNUSLifecycle setters:               "Only creator or admin"
 *
 * Boot pattern: LocalDiamondDeployer (multichain fixture) per GNUSLifecycle.test.ts (13-02) +
 * setupLifecyclePolicyLinking() in the before hook (13-04 library wiring). Owner-funded
 * factory-mint pattern per Phase 9 logged decisions. Time control via
 * @nomicfoundation/hardhat-network-helpers `time` only — never Date.now.
 */
describe('GNUS Lifecycle Settlement Tests (13-05)', async function () {
    const diamondName = 'GeniusDiamond';
    const log: debug.Debugger = debug('GNUSLifecycleSettle:log:${diamondName}');
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

    // GNUS_TOKEN_ID is 0 (GNUSConstants.sol)
    const GNUS_TOKEN_ID = 0n;
    // keccak256("gnus.ai.treasury.storage") — GNUSTreasury Layout base slot.
    // provenanceInitialized is the SECOND field (offset +1) — see GNUSTreasury.test.ts.
    const TREASURY_STORAGE_SLOT = ethers.keccak256(ethers.toUtf8Bytes('gnus.ai.treasury.storage'));

    // ExpirationMode ordinals (GNUSLifecycleTypes.sol — on-chain, append-only).
    const MODE_NONE = 0;
    const MODE_PER_TOKEN_ID = 1;
    const MODE_PER_HOLDER = 2;
    // TransferPolicy ordinals.
    const POLICY_UNRESTRICTED = 0;
    const POLICY_SOULBOUND = 1;
    const POLICY_ISSUER_ONLY = 2;
    const POLICY_ALLOWLISTED = 3;
    const POLICY_CONTROLLED_RESALE = 4;
    const POLICY_LOCKED_AFTER_START = 5;
    // ExpirationDisposition ordinals.
    const DISP_NONE = 0;
    const DISP_KEEP_INERT = 1;
    const DISP_BURN = 2;
    const DISP_RETURN_TO_ADDRESS = 3;
    const DISP_REDEEM_TO_PARENT = 4;

    for (const [networkName, provider] of networkProviders.entries()) {
        describe(`Chain: ${networkName}  Diamond: ${diamondName}`, function () {
            let diamond: Diamond;
            let signers: SignerWithAddress[];
            let signer1: string;
            let signer2: string;
            let signer3: string;
            let owner: string;
            let ownerSigner: SignerWithAddress;
            let geniusDiamond: GeniusDiamond;
            let ownerDiamond: GeniusDiamond;
            let signer1Diamond: GeniusDiamond;
            let signer3Diamond: GeniusDiamond;
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
                signer3 = signers[3].address;

                owner = diamond.getDeployedDiamondData().DeployerAddress || '';
                if (!owner) {
                    diamond.setSigner(signers[0]);
                    owner = signers[0].address;
                }
                ownerSigner = await ethersMultichain.getSigner(owner);
                ownerDiamond = geniusDiamond.connect(ownerSigner);
                signer1Diamond = geniusDiamond.connect(signers[1]);
                signer3Diamond = geniusDiamond.connect(signers[3]);
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
                    expirationMode: overrides.expirationMode ?? MODE_NONE,
                    transferPolicy: overrides.transferPolicy ?? POLICY_UNRESTRICTED,
                    expirationDisposition: overrides.expirationDisposition ?? DISP_NONE,
                    expirationRecipient: overrides.expirationRecipient ?? ethers.ZeroAddress,
                    credentialVerifier: overrides.credentialVerifier ?? ethers.ZeroAddress,
                };
            }

            /**
             * Fund owner with GNUS and create a fresh direct-child NFT (creator = owner).
             * Returns the new token id (read from childCurIndex BEFORE creation — robust to a
             * shared/cached diamond fixture).
             */
            async function createFundedNFT(name: string, symbol: string): Promise<bigint> {
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
                return (GNUS_TOKEN_ID << 128n) | childIndex;
            }

            /**
             * Create a fresh direct-child NFT AND configure its lifecycle atomically via
             * createNFTWithLifecycle (13-03). Returns the new token id.
             */
            async function createNFTWithLifecycle(
                name: string,
                symbol: string,
                cfg: ReturnType<typeof defaultConfig>,
            ): Promise<bigint> {
                await ownerDiamond['mint(address,uint256)'](owner, toWei('10000'));
                const info = await geniusDiamond.getNFTInfo(GNUS_TOKEN_ID);
                const childIndex: bigint = info.childCurIndex;
                await ownerDiamond.createNFTWithLifecycle(
                    GNUS_TOKEN_ID,
                    name,
                    symbol,
                    toWei('1'),
                    toWei('1000000'),
                    `ipfs://${symbol.toLowerCase()}`,
                    cfg,
                );
                return (GNUS_TOKEN_ID << 128n) | childIndex;
            }

            /**
             * Seed the provenance counter with 0 if not already initialized (idempotent).
             * The GeniusDiamond fixture may be shared (cached) across suites in this process,
             * so a prior suite may already have seeded; the one-shot SetSeedSupply reverts in
             * that case. Pattern from GNUSTreasury.test.ts.
             */
            async function seedProvenanceIfNeeded(): Promise<void> {
                const initialized = await provider.send('eth_getStorageAt', [
                    diamondAddress,
                    ethers.toBeHex(BigInt(TREASURY_STORAGE_SLOT) + 1n, 32),
                ]);
                if (BigInt(initialized) === 0n) {
                    await ownerDiamond.GNUSTreasury_SetSeedSupply(0n);
                }
            }

            /** Mint `amount` of `id` to signer1 via the credential-gated path (open mint: no verifier). */
            async function mintToSigner1(id: bigint, amount: bigint): Promise<void> {
                await ownerDiamond.mintWithCredential(signer1, id, amount, '0x', '0x');
            }

            async function balanceOf(account: string, id: bigint): Promise<bigint> {
                return geniusDiamond['balanceOf(address,uint256)'](account, id);
            }

            async function totalSupply(id: bigint): Promise<bigint> {
                return geniusDiamond['totalSupply(uint256)'](id);
            }

            // ================================================================
            // Task 1 (SC5/D9): settlement + disposition matrix
            // ================================================================
            describe('settlement + disposition matrix (SC5, D9)', function () {
                it('reverts "Not expired": PerTokenId before validUntil', async function () {
                    const id = await createFundedNFT('SettleEarlyId', 'SEID');
                    const validUntil = BigInt((await time.latest()) + 86400);
                    await ownerDiamond.configureLifecycle(
                        id,
                        defaultConfig({
                            expirationMode: MODE_PER_TOKEN_ID,
                            validUntil,
                            expirationDisposition: DISP_BURN,
                        }),
                    );
                    await mintToSigner1(id, toWei('5'));

                    await expect(geniusDiamond.settleExpired(signer1, id)).to.be.revertedWith(
                        'Not expired',
                    );
                });

                it('reverts "Not expired": PerHolder before clock expiry', async function () {
                    const duration = 86400n;
                    const id = await createFundedNFT('SettleEarlyHolder', 'SEH');
                    await ownerDiamond.configureLifecycle(
                        id,
                        defaultConfig({
                            expirationMode: MODE_PER_HOLDER,
                            transferPolicy: POLICY_SOULBOUND,
                            expirationDisposition: DISP_BURN,
                            defaultDuration: duration,
                        }),
                    );
                    await mintToSigner1(id, toWei('5'));
                    // Clock is active (now + duration); settling now must revert.
                    expect(await geniusDiamond.holderExpiresAt(id, signer1)).to.be.gt(0n);
                    await expect(geniusDiamond.settleExpired(signer1, id)).to.be.revertedWith(
                        'Not expired',
                    );
                });

                it('BURN settles: balance -> 0, totalSupply(id) decreases by the settled amount, Settled event', async function () {
                    const id = await createFundedNFT('BurnSettle', 'BURN');
                    const validUntil = BigInt((await time.latest()) + 1000);
                    await ownerDiamond.configureLifecycle(
                        id,
                        defaultConfig({
                            expirationMode: MODE_PER_TOKEN_ID,
                            validUntil,
                            expirationDisposition: DISP_BURN,
                        }),
                    );
                    const amount = toWei('5');
                    await mintToSigner1(id, amount);
                    const supplyBefore = await totalSupply(id);
                    expect(supplyBefore).to.eq(amount);

                    await time.increaseTo(Number(validUntil));
                    // Permissionless: a third party (signer3) triggers the settle.
                    await expect(signer3Diamond.settleExpired(signer1, id))
                        .to.emit(geniusDiamond, 'Settled')
                        .withArgs(signer1, id, amount, DISP_BURN, ethers.ZeroAddress);

                    expect(await balanceOf(signer1, id)).to.eq(0n);
                    expect(await totalSupply(id)).to.eq(supplyBefore - amount);
                });

                it('settle idempotent: second BURN settle reverts "Not expired" with zero state change', async function () {
                    const duration = 1000n;
                    const id = await createFundedNFT('BurnTwice', 'BTW');
                    await ownerDiamond.configureLifecycle(
                        id,
                        defaultConfig({
                            expirationMode: MODE_PER_HOLDER,
                            transferPolicy: POLICY_SOULBOUND,
                            expirationDisposition: DISP_BURN,
                            defaultDuration: duration,
                        }),
                    );
                    const amount = toWei('5');
                    await mintToSigner1(id, amount);

                    const t0 = BigInt(await time.latest());
                    await time.increaseTo(Number(t0 + duration + 1n));
                    await geniusDiamond.settleExpired(signer1, id);
                    expect(await balanceOf(signer1, id)).to.eq(0n);
                    expect(await geniusDiamond.holderExpiresAt(id, signer1)).to.eq(0n);

                    // Second call: the clock was cleared (idempotency shape = clean revert,
                    // no state change). Snapshot balances/supply between the two attempts.
                    const balanceBetween = await balanceOf(signer1, id);
                    const supplyBetween = await totalSupply(id);
                    await expect(geniusDiamond.settleExpired(signer1, id)).to.be.revertedWith(
                        'Not expired',
                    );
                    expect(await balanceOf(signer1, id)).to.eq(balanceBetween);
                    expect(await totalSupply(id)).to.eq(supplyBetween);
                });

                it('PerHolder BURN settle clears the per-holder clock (holderExpiresAt -> 0)', async function () {
                    const duration = 1000n;
                    const id = await createFundedNFT('ClockClear', 'CCLR');
                    await ownerDiamond.configureLifecycle(
                        id,
                        defaultConfig({
                            expirationMode: MODE_PER_HOLDER,
                            transferPolicy: POLICY_SOULBOUND,
                            expirationDisposition: DISP_BURN,
                            defaultDuration: duration,
                        }),
                    );
                    await mintToSigner1(id, toWei('5'));
                    const expiry = await geniusDiamond.holderExpiresAt(id, signer1);
                    expect(expiry).to.be.gt(0n);

                    await time.increaseTo(Number(expiry));
                    await geniusDiamond.settleExpired(signer1, id);
                    expect(await geniusDiamond.holderExpiresAt(id, signer1)).to.eq(0n);
                });

                it('KEEP_INERT: balance unchanged post-settle; isSpendable false; Settled with amount 0', async function () {
                    const id = await createFundedNFT('KeepInert', 'KIN');
                    const validUntil = BigInt((await time.latest()) + 1000);
                    await ownerDiamond.configureLifecycle(
                        id,
                        defaultConfig({
                            expirationMode: MODE_PER_TOKEN_ID,
                            validUntil,
                            expirationDisposition: DISP_KEEP_INERT,
                        }),
                    );
                    const amount = toWei('5');
                    await mintToSigner1(id, amount);

                    await time.increaseTo(Number(validUntil));
                    await expect(geniusDiamond.settleExpired(signer1, id))
                        .to.emit(geniusDiamond, 'Settled')
                        .withArgs(signer1, id, 0n, DISP_KEEP_INERT, ethers.ZeroAddress);

                    // Balance stays (collectible), entitlement off.
                    expect(await balanceOf(signer1, id)).to.eq(amount);
                    expect(await geniusDiamond.isSpendable(signer1, id)).to.eq(false);
                    expect(await totalSupply(id)).to.eq(amount);
                });

                it('NONE: balance unchanged; isTokenActive false post-expiry; Settled with amount 0', async function () {
                    const id = await createFundedNFT('NoneDisp', 'NDSP');
                    const validUntil = BigInt((await time.latest()) + 1000);
                    await ownerDiamond.configureLifecycle(
                        id,
                        defaultConfig({
                            expirationMode: MODE_PER_TOKEN_ID,
                            validUntil,
                            expirationDisposition: DISP_NONE,
                        }),
                    );
                    const amount = toWei('5');
                    await mintToSigner1(id, amount);

                    await time.increaseTo(Number(validUntil));
                    await expect(geniusDiamond.settleExpired(signer1, id))
                        .to.emit(geniusDiamond, 'Settled')
                        .withArgs(signer1, id, 0n, DISP_NONE, ethers.ZeroAddress);

                    expect(await balanceOf(signer1, id)).to.eq(amount);
                    expect(await geniusDiamond.isTokenActive(id)).to.eq(false);
                    expect(await totalSupply(id)).to.eq(amount);
                });

                it('RETURN_TO_ADDRESS: expired balance moves to the configured recipient; Settled destination == recipient', async function () {
                    const id = await createFundedNFT('ReturnAddr', 'RET');
                    const validUntil = BigInt((await time.latest()) + 1000);
                    await ownerDiamond.configureLifecycle(
                        id,
                        defaultConfig({
                            expirationMode: MODE_PER_TOKEN_ID,
                            validUntil,
                            expirationDisposition: DISP_RETURN_TO_ADDRESS,
                            expirationRecipient: signer2,
                        }),
                    );
                    const amount = toWei('5');
                    await mintToSigner1(id, amount);
                    const recipientBefore = await balanceOf(signer2, id);

                    await time.increaseTo(Number(validUntil));
                    await expect(geniusDiamond.settleExpired(signer1, id))
                        .to.emit(geniusDiamond, 'Settled')
                        .withArgs(signer1, id, amount, DISP_RETURN_TO_ADDRESS, signer2);

                    expect(await balanceOf(signer1, id)).to.eq(0n);
                    expect(await balanceOf(signer2, id)).to.eq(recipientBefore + amount);
                    // Balance-moving, not supply-destroying.
                    expect(await totalSupply(id)).to.eq(amount);
                });

                it('RETURN_TO_ADDRESS no redirect: third-party caller settles — recipient still receives everything, caller captures nothing', async function () {
                    const id = await createFundedNFT('NoRedirect', 'NRDR');
                    const validUntil = BigInt((await time.latest()) + 1000);
                    await ownerDiamond.configureLifecycle(
                        id,
                        defaultConfig({
                            expirationMode: MODE_PER_TOKEN_ID,
                            validUntil,
                            expirationDisposition: DISP_RETURN_TO_ADDRESS,
                            expirationRecipient: signer2,
                        }),
                    );
                    const amount = toWei('5');
                    await mintToSigner1(id, amount);

                    await time.increaseTo(Number(validUntil));
                    // Third-party (signer3) triggers the settle — permissionless, fixed outcome.
                    const callerBefore = await balanceOf(signer3, id);
                    await expect(signer3Diamond.settleExpired(signer1, id))
                        .to.emit(geniusDiamond, 'Settled')
                        .withArgs(signer1, id, amount, DISP_RETURN_TO_ADDRESS, signer2);

                    expect(await balanceOf(signer1, id)).to.eq(0n);
                    expect(await balanceOf(signer2, id)).to.eq(amount);
                    // The caller captured nothing.
                    expect(await balanceOf(signer3, id)).to.eq(callerBefore);
                });

                it('configureLifecycle with RETURN_TO_ADDRESS + zero recipient reverts (Q-gate)', async function () {
                    const id = await createFundedNFT('ReturnNoRecip', 'RNR');
                    await expect(
                        ownerDiamond.configureLifecycle(
                            id,
                            defaultConfig({
                                expirationMode: MODE_PER_TOKEN_ID,
                                validUntil: BigInt((await time.latest()) + 1000),
                                expirationDisposition: DISP_RETURN_TO_ADDRESS,
                                expirationRecipient: ethers.ZeroAddress,
                            }),
                        ),
                    ).to.be.revertedWith('RETURN_TO_ADDRESS needs recipient');
                });

                it('REDEEM_TO_PARENT: child supply down by amount, parent (GNUS) balance up by amount, totalSupplyOfAll unchanged', async function () {
                    await seedProvenanceIfNeeded();
                    const validUntil = BigInt((await time.latest()) + 1000);
                    // createNFTWithLifecycle keeps nonConvertible=false for non-BURN
                    // dispositions, so REDEEM_TO_PARENT passes the Q1 gate.
                    const id = await createNFTWithLifecycle(
                        'RedeemParent',
                        'RDP',
                        defaultConfig({
                            expirationMode: MODE_PER_TOKEN_ID,
                            transferPolicy: POLICY_UNRESTRICTED,
                            validUntil,
                            expirationDisposition: DISP_REDEEM_TO_PARENT,
                        }),
                    );
                    const info = await geniusDiamond.getNFTInfo(id);
                    expect(info.nonConvertible).to.eq(false);
                    expect(info.parentId).to.eq(GNUS_TOKEN_ID);

                    const amount = toWei('5');
                    await mintToSigner1(id, amount);
                    const childSupplyBefore = await totalSupply(id);
                    const parentBefore = await balanceOf(signer1, GNUS_TOKEN_ID);
                    const globalBefore = await geniusDiamond.totalSupplyOfAll();

                    await time.increaseTo(Number(validUntil));
                    await expect(signer3Diamond.settleExpired(signer1, id))
                        .to.emit(geniusDiamond, 'Settled')
                        .withArgs(signer1, id, amount, DISP_REDEEM_TO_PARENT, signer1);

                    // Conservation: child down by exactly the settled amount, parent up by the
                    // same amount, tree-wide provenance counter unchanged (supply-neutral).
                    expect(await totalSupply(id)).to.eq(childSupplyBefore - amount);
                    expect(await balanceOf(signer1, GNUS_TOKEN_ID)).to.eq(parentBefore + amount);
                    expect(await geniusDiamond.totalSupplyOfAll()).to.eq(globalBefore);
                });

                it('configureLifecycle REDEEM_TO_PARENT on a nonConvertible token reverts (Q1)', async function () {
                    // A BURN-created token from createNFTWithLifecycle sets nonConvertible=true
                    // at creation (D11). Reconfiguring it to REDEEM_TO_PARENT (pre-first-mint,
                    // so the immutability gate passes) must hit the Q1 revert.
                    const id = await createNFTWithLifecycle(
                        'BurnOnlyNoRedeem',
                        'BONR',
                        defaultConfig({
                            expirationMode: MODE_PER_TOKEN_ID,
                            validUntil: BigInt((await time.latest()) + 1000),
                            expirationDisposition: DISP_BURN,
                        }),
                    );
                    const info = await geniusDiamond.getNFTInfo(id);
                    expect(info.nonConvertible).to.eq(true);

                    await expect(
                        ownerDiamond.configureLifecycle(
                            id,
                            defaultConfig({
                                expirationMode: MODE_PER_TOKEN_ID,
                                validUntil: BigInt((await time.latest()) + 1000),
                                expirationDisposition: DISP_REDEEM_TO_PARENT,
                            }),
                        ),
                    ).to.be.revertedWith('REDEEM_TO_PARENT requires convertible token');
                });

                it('circulating (D9): expired-but-unsettled balance still counted — totalSupply unchanged between expiry and settle', async function () {
                    const id = await createFundedNFT('Circulating', 'CIRC');
                    const validUntil = BigInt((await time.latest()) + 1000);
                    await ownerDiamond.configureLifecycle(
                        id,
                        defaultConfig({
                            expirationMode: MODE_PER_TOKEN_ID,
                            validUntil,
                            expirationDisposition: DISP_BURN,
                        }),
                    );
                    const amount = toWei('5');
                    await mintToSigner1(id, amount);

                    // Warp past expiry WITHOUT settling: the expired balance remains in
                    // circulating supply (Phase 12 ledger convention, D9).
                    await time.increaseTo(Number(validUntil));
                    expect(await geniusDiamond.isTokenActive(id)).to.eq(false);
                    expect(await totalSupply(id)).to.eq(amount);
                    expect(await balanceOf(signer1, id)).to.eq(amount);

                    // Settlement is what removes it from circulation.
                    await geniusDiamond.settleExpired(signer1, id);
                    expect(await totalSupply(id)).to.eq(0n);
                });

                it('no un-burn (D4): BURN-settle then creator setValidUntil extension — burned supply stays burned', async function () {
                    const id = await createFundedNFT('NoUnburn', 'NUB');
                    const validUntil = BigInt((await time.latest()) + 1000);
                    await ownerDiamond.configureLifecycle(
                        id,
                        defaultConfig({
                            expirationMode: MODE_PER_TOKEN_ID,
                            validUntil,
                            expirationDisposition: DISP_BURN,
                        }),
                    );
                    const amount = toWei('5');
                    await mintToSigner1(id, amount);

                    await time.increaseTo(Number(validUntil));
                    await geniusDiamond.settleExpired(signer1, id);
                    expect(await balanceOf(signer1, id)).to.eq(0n);
                    expect(await totalSupply(id)).to.eq(0n);

                    // Creator extends the window post-settlement (D4: timestamps are
                    // creator-mutable). Settlement is a FINAL state transition — the setter
                    // must not resurrect the burned supply.
                    const newValidUntil = validUntil + 86400n;
                    const supplyBeforeSetter = await totalSupply(id);
                    await expect(ownerDiamond.setValidUntil(id, newValidUntil))
                        .to.emit(geniusDiamond, 'ValidUntilUpdated')
                        .withArgs(id, validUntil, newValidUntil, owner);

                    expect(await totalSupply(id)).to.eq(supplyBeforeSetter);
                    expect(await balanceOf(signer1, id)).to.eq(0n);
                    expect(await geniusDiamond.isTokenActive(id)).to.eq(true);
                });
            });
        });
    }
});
