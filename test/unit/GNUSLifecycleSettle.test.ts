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
import { multichain } from '@diamondslab/hardhat-multichain';
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

                it('WR-03: ISSUER_ONLY + RETURN_TO_ADDRESS — a THIRD-PARTY settle succeeds (settlement carve-out mirrors SOULBOUND)', async function () {
                    const id = await createFundedNFT('IssuerReturn', 'IRTR');
                    const validUntil = BigInt((await time.latest()) + 1000);
                    await ownerDiamond.configureLifecycle(
                        id,
                        defaultConfig({
                            expirationMode: MODE_PER_TOKEN_ID,
                            validUntil,
                            transferPolicy: POLICY_ISSUER_ONLY,
                            expirationDisposition: DISP_RETURN_TO_ADDRESS,
                            expirationRecipient: signer2,
                        }),
                    );
                    const amount = toWei('5');
                    await mintToSigner1(id, amount);

                    // Ordinary ISSUER_ONLY holder-to-holder transfers are STILL blocked for the
                    // holder as operator (the carve-out is scoped to the fixed recipient).
                    await expect(
                        signer1Diamond['safeTransferFrom(address,address,uint256,uint256,bytes)'](
                            signer1, signer3, id, toWei('1'), '0x',
                        ),
                    ).to.be.revertedWith('ISSUER_ONLY: only creator/admin can transfer');

                    await time.increaseTo(Number(validUntil));
                    // Before the WR-03 carve-out this reverted "ISSUER_ONLY: only creator/admin
                    // can transfer" because the settle's _safeTransferFrom fires the hook with
                    // operator == the (permissionless, D9) third-party caller. The fixed-recipient
                    // settlement carve-out must mirror the SOULBOUND one.
                    await expect(signer3Diamond.settleExpired(signer1, id))
                        .to.emit(geniusDiamond, 'Settled')
                        .withArgs(signer1, id, amount, DISP_RETURN_TO_ADDRESS, signer2);
                    expect(await balanceOf(signer1, id)).to.eq(0n);
                    expect(await balanceOf(signer2, id)).to.eq(amount);
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

                it('WR-04: REDEEM_TO_PARENT settlement is not blocked by the parent sale window / per-wallet cap (settlement mint carve-out)', async function () {
                    await seedProvenanceIfNeeded();
                    const validUntil = BigInt((await time.latest()) + 1000);
                    const id = await createNFTWithLifecycle(
                        'RedeemGated',
                        'RDTG',
                        defaultConfig({
                            expirationMode: MODE_PER_TOKEN_ID,
                            transferPolicy: POLICY_UNRESTRICTED,
                            validUntil,
                            expirationDisposition: DISP_REDEEM_TO_PARENT,
                        }),
                    );
                    const amount = toWei('5');
                    await mintToSigner1(id, amount);

                    // Hostile parent configuration: a future validFrom on the parent (GNUS) and
                    // a per-wallet cap of 1 wei (far below the redemption amount). Without the
                    // WR-04 carve-out the settlement's parent-mint leg would revert
                    // "Token not yet active" / "Per-wallet mint cap exceeded" and the expired
                    // pile would be stuck forever.
                    await ownerDiamond.setValidFrom(GNUS_TOKEN_ID, BigInt((await time.latest()) + 10000));
                    await ownerDiamond.setPerWalletMintCap(GNUS_TOKEN_ID, 1n);

                    await time.increaseTo(Number(validUntil));
                    const parentBefore = await balanceOf(signer1, GNUS_TOKEN_ID);
                    await expect(signer3Diamond.settleExpired(signer1, id))
                        .to.emit(geniusDiamond, 'Settled')
                        .withArgs(signer1, id, amount, DISP_REDEEM_TO_PARENT, signer1);
                    expect(await balanceOf(signer1, GNUS_TOKEN_ID)).to.eq(parentBefore + amount);

                    // The carve-out is transient: re-open the parent window, then a NORMAL mint
                    // of the parent still hits the per-wallet cap (the flag was cleared after
                    // the settlement mint).
                    await ownerDiamond.setValidFrom(GNUS_TOKEN_ID, 0n);
                    await expect(
                        ownerDiamond['mint(address,uint256,uint256)'](signer1, GNUS_TOKEN_ID, toWei('2')),
                    ).to.be.revertedWith('Per-wallet mint cap exceeded');
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

            // ================================================================
            // Task 2 (SC2/SC8/D4): renewal + mutability matrix
            // ================================================================
            describe('renewal + mutability matrix (SC2, SC8, D4)', function () {
                it('validFrom boundary: mint at validFrom - 1 reverts "Sale not started"; at exactly validFrom succeeds', async function () {
                    const id = await createFundedNFT('ValidFromBoundary', 'VFB');
                    const validFrom = BigInt((await time.latest()) + 1000);
                    await ownerDiamond.configureLifecycle(
                        id,
                        defaultConfig({ validFrom, expirationMode: MODE_PER_TOKEN_ID }),
                    );

                    // One second before the window opens: the facet-level _checkMintPolicy
                    // gate fires ("Sale not started").
                    await time.setNextBlockTimestamp(Number(validFrom) - 1);
                    await expect(
                        ownerDiamond.mintWithCredential(signer1, id, toWei('1'), '0x', '0x'),
                    ).to.be.revertedWith('Sale not started');

                    // At exactly validFrom the window is open (inclusive boundary).
                    await time.setNextBlockTimestamp(Number(validFrom));
                    await ownerDiamond.mintWithCredential(signer1, id, toWei('1'), '0x', '0x');
                    expect(await balanceOf(signer1, id)).to.eq(toWei('1'));
                });

                it('validUntil boundary (PerTokenId): isTokenActive true at validUntil - 1, false at exactly validUntil (exclusive)', async function () {
                    const id = await createFundedNFT('ValidUntilBoundary', 'VUB');
                    const validUntil = BigInt((await time.latest()) + 1000);
                    await ownerDiamond.configureLifecycle(
                        id,
                        defaultConfig({ expirationMode: MODE_PER_TOKEN_ID, validUntil }),
                    );

                    expect(await geniusDiamond.isTokenActive(id)).to.eq(true);
                    await time.increaseTo(Number(validUntil) - 1);
                    expect(await geniusDiamond.isTokenActive(id)).to.eq(true);
                    // Exclusive boundary: AT validUntil the token is no longer active.
                    await time.increaseTo(Number(validUntil));
                    expect(await geniusDiamond.isTokenActive(id)).to.eq(false);
                });

                it('renewal stacks (D3 first branch): active mint extends the EXISTING clock — clock_new == clock_old + D, not now + D', async function () {
                    const duration = 1000n;
                    const id = await createFundedNFT('RenewalStack', 'RNST');
                    await ownerDiamond.configureLifecycle(
                        id,
                        defaultConfig({
                            expirationMode: MODE_PER_HOLDER,
                            transferPolicy: POLICY_SOULBOUND,
                            expirationDisposition: DISP_BURN,
                            defaultDuration: duration,
                        }),
                    );

                    // First mint at t0: clock = t0 + D (fresh clock, old expiry 0).
                    const t0 = BigInt((await time.latest()) + 1);
                    await time.setNextBlockTimestamp(Number(t0));
                    await expect(ownerDiamond.mintWithCredential(signer1, id, toWei('5'), '0x', '0x'))
                        .to.emit(geniusDiamond, 'HolderExpiryUpdated')
                        .withArgs(id, signer1, 0n, t0 + duration);
                    expect(await geniusDiamond.holderExpiresAt(id, signer1)).to.eq(t0 + duration);

                    // Active renewal at t1 < t0 + D: the clock STACKS from the existing expiry
                    // (t0 + D + D). If the implementation reset from now it would be t1 + D,
                    // which is strictly less — this assertion distinguishes the two.
                    const t1 = t0 + 100n;
                    await time.setNextBlockTimestamp(Number(t1));
                    await expect(ownerDiamond.mintWithCredential(signer1, id, toWei('3'), '0x', '0x'))
                        .to.emit(geniusDiamond, 'HolderExpiryUpdated')
                        .withArgs(id, signer1, t0 + duration, t0 + duration + duration);
                    expect(await geniusDiamond.holderExpiresAt(id, signer1)).to.eq(
                        t0 + duration + duration,
                    );
                    expect(await balanceOf(signer1, id)).to.eq(toWei('8'));
                });

                it('settle-first renewal (D3 second branch): expired pile settled via mintWithCredential before the new clock starts', async function () {
                    const duration = 1000n;
                    const id = await createFundedNFT('SettleFirst', 'SFST');
                    await ownerDiamond.configureLifecycle(
                        id,
                        defaultConfig({
                            expirationMode: MODE_PER_HOLDER,
                            transferPolicy: POLICY_SOULBOUND,
                            expirationDisposition: DISP_BURN,
                            defaultDuration: duration,
                        }),
                    );

                    const t0 = BigInt((await time.latest()) + 1);
                    await time.setNextBlockTimestamp(Number(t0));
                    await ownerDiamond.mintWithCredential(signer1, id, toWei('5'), '0x', '0x');

                    // Warp past the clock; the renewal mint must settle the expired pile FIRST
                    // (BURN: 5 minions destroyed), then start a fresh clock at now + D.
                    const t2 = t0 + duration + 1n;
                    await time.setNextBlockTimestamp(Number(t2));
                    const tx = ownerDiamond.mintWithCredential(signer1, id, toWei('2'), '0x', '0x');
                    await expect(tx)
                        .to.emit(geniusDiamond, 'Settled')
                        .withArgs(signer1, id, toWei('5'), DISP_BURN, ethers.ZeroAddress);
                    await expect(tx)
                        .to.emit(geniusDiamond, 'HolderExpiryUpdated')
                        .withArgs(id, signer1, t0 + duration, t2 + duration);

                    // Balance reflects ONLY the new mint — the settled pile is gone.
                    expect(await balanceOf(signer1, id)).to.eq(toWei('2'));
                    expect(await geniusDiamond.holderExpiresAt(id, signer1)).to.eq(t2 + duration);
                });

                it('never resurrects (T-13-05-01): totalSupply after settle-first renewal reflects the burn — expired units are gone for good', async function () {
                    const duration = 1000n;
                    const id = await createFundedNFT('NoResurrect', 'NRES');
                    await ownerDiamond.configureLifecycle(
                        id,
                        defaultConfig({
                            expirationMode: MODE_PER_HOLDER,
                            transferPolicy: POLICY_SOULBOUND,
                            expirationDisposition: DISP_BURN,
                            defaultDuration: duration,
                        }),
                    );

                    const t0 = BigInt((await time.latest()) + 1);
                    await time.setNextBlockTimestamp(Number(t0));
                    await ownerDiamond.mintWithCredential(signer1, id, toWei('5'), '0x', '0x');
                    expect(await totalSupply(id)).to.eq(toWei('5'));

                    const t2 = t0 + duration + 1n;
                    await time.setNextBlockTimestamp(Number(t2));
                    await ownerDiamond.mintWithCredential(signer1, id, toWei('2'), '0x', '0x');

                    // Supply = only the post-settlement mint (2), NOT 5 + 2: the expired 5 were
                    // burned by the renewal's settle-first step and never resurrected.
                    expect(await totalSupply(id)).to.eq(toWei('2'));

                    // A later settleExpired must NOT find a resurrected pile: the clock is
                    // active again (t2 + D), so settling now reverts "Not expired".
                    await expect(geniusDiamond.settleExpired(signer1, id)).to.be.revertedWith(
                        'Not expired',
                    );
                });

                it('zero-balance fresh clock: fresh holder mint starts clock at now + D', async function () {
                    const duration = 1000n;
                    const id = await createFundedNFT('FreshClock', 'FCLK');
                    await ownerDiamond.configureLifecycle(
                        id,
                        defaultConfig({
                            expirationMode: MODE_PER_HOLDER,
                            transferPolicy: POLICY_SOULBOUND,
                            expirationDisposition: DISP_BURN,
                            defaultDuration: duration,
                        }),
                    );

                    // signer2 has never held the token (clock 0, balance 0).
                    const t0 = BigInt((await time.latest()) + 1);
                    await time.setNextBlockTimestamp(Number(t0));
                    await expect(ownerDiamond.mintWithCredential(signer2, id, toWei('4'), '0x', '0x'))
                        .to.emit(geniusDiamond, 'HolderExpiryUpdated')
                        .withArgs(id, signer2, 0n, t0 + duration);
                    expect(await geniusDiamond.holderExpiresAt(id, signer2)).to.eq(t0 + duration);
                    expect(await balanceOf(signer2, id)).to.eq(toWei('4'));
                });

                it('zero-balance with expired clock: full consumption burn then renewal starts fresh — no Settled, no resurrection', async function () {
                    const duration = 1000n;
                    const id = await createFundedNFT('ZeroBalRenew', 'ZBR');
                    await ownerDiamond.configureLifecycle(
                        id,
                        defaultConfig({
                            expirationMode: MODE_PER_HOLDER,
                            transferPolicy: POLICY_SOULBOUND,
                            expirationDisposition: DISP_BURN,
                            defaultDuration: duration,
                        }),
                    );

                    // Mint, then the holder spends the FULL balance (consumption burn is
                    // permitted under SOULBOUND) while the clock is still active.
                    const t0 = BigInt((await time.latest()) + 1);
                    await time.setNextBlockTimestamp(Number(t0));
                    await ownerDiamond.mintWithCredential(signer1, id, toWei('5'), '0x', '0x');
                    await signer1Diamond['burn(address,uint256,uint256)'](signer1, id, toWei('5'));
                    expect(await balanceOf(signer1, id)).to.eq(0n);

                    // Warp past the (now meaningless) clock; renew with zero balance: no pile
                    // to settle (no Settled event), fresh clock at now + D.
                    const t2 = t0 + duration + 1n;
                    await time.setNextBlockTimestamp(Number(t2));
                    const tx = ownerDiamond.mintWithCredential(signer1, id, toWei('2'), '0x', '0x');
                    await expect(tx).to.not.emit(geniusDiamond, 'Settled');
                    await expect(tx)
                        .to.emit(geniusDiamond, 'HolderExpiryUpdated')
                        .withArgs(id, signer1, t0 + duration, t2 + duration);
                    expect(await balanceOf(signer1, id)).to.eq(toWei('2'));
                    expect(await totalSupply(id)).to.eq(toWei('2'));
                });

                it('creator-only timestamps (D4): creator mutates post-mint with events; random signer reverts; DEFAULT_ADMIN_ROLE holder succeeds', async function () {
                    const id = await createFundedNFT('TimeMutable', 'TMUT');
                    const validUntil = BigInt((await time.latest()) + 10000);
                    await ownerDiamond.configureLifecycle(
                        id,
                        defaultConfig({
                            expirationMode: MODE_PER_TOKEN_ID,
                            validUntil,
                        }),
                    );
                    // Post-mint mutability: mint a unit first so the test proves D4 timestamps
                    // remain mutable AFTER first mint (policy fields would not be).
                    await mintToSigner1(id, toWei('1'));

                    // Creator (owner) mutates validFrom post-mint — event carries (id, old, new, operator).
                    const newValidFrom = BigInt(await time.latest()) + 100n;
                    await expect(ownerDiamond.setValidFrom(id, newValidFrom))
                        .to.emit(geniusDiamond, 'ValidFromUpdated')
                        .withArgs(id, 0n, newValidFrom, owner);

                    // Creator mutates validUntil post-mint.
                    const creatorNewValidUntil = validUntil + 500n;
                    await expect(ownerDiamond.setValidUntil(id, creatorNewValidUntil))
                        .to.emit(geniusDiamond, 'ValidUntilUpdated')
                        .withArgs(id, validUntil, creatorNewValidUntil, owner);

                    // Random signer (no role, not creator) reverts on both setters.
                    await expect(signer3Diamond.setValidFrom(id, 0n)).to.be.revertedWith(
                        'Only creator or admin',
                    );
                    await expect(signer3Diamond.setValidUntil(id, validUntil)).to.be.revertedWith(
                        'Only creator or admin',
                    );

                    // A non-creator DEFAULT_ADMIN_ROLE holder succeeds (D4: creator-or-admin).
                    const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
                    await ownerDiamond.grantRole(DEFAULT_ADMIN_ROLE, signer1);
                    const adminNewValidUntil = creatorNewValidUntil + 500n;
                    await expect(signer1Diamond.setValidUntil(id, adminNewValidUntil))
                        .to.emit(geniusDiamond, 'ValidUntilUpdated')
                        .withArgs(id, creatorNewValidUntil, adminNewValidUntil, signer1);
                });

                it('immutable after first mint (D4): configureLifecycle reverts "Policy immutable after first mint"', async function () {
                    const id = await createFundedNFT('ImmutablePolicy', 'IMP');
                    await ownerDiamond.configureLifecycle(
                        id,
                        defaultConfig({
                            expirationMode: MODE_PER_TOKEN_ID,
                            validUntil: BigInt((await time.latest()) + 1000),
                            expirationDisposition: DISP_BURN,
                        }),
                    );
                    await mintToSigner1(id, toWei('1'));

                    await expect(
                        ownerDiamond.configureLifecycle(
                            id,
                            defaultConfig({ expirationDisposition: DISP_KEEP_INERT }),
                        ),
                    ).to.be.revertedWith('Policy immutable after first mint');
                });

                it('Q2 matrix: PerHolder + transferable policies (UNRESTRICTED/ALLOWLISTED/CONTROLLED_RESALE/LOCKED_AFTER_START) revert', async function () {
                    const forbidden = [
                        { name: 'UNRESTRICTED', policy: POLICY_UNRESTRICTED },
                        { name: 'ALLOWLISTED', policy: POLICY_ALLOWLISTED },
                        { name: 'CONTROLLED_RESALE', policy: POLICY_CONTROLLED_RESALE },
                        { name: 'LOCKED_AFTER_START', policy: POLICY_LOCKED_AFTER_START },
                    ];
                    for (const { name, policy } of forbidden) {
                        const id = await createFundedNFT(`Q2Forbid${name}`, `Q2F${policy}`);
                        await expect(
                            ownerDiamond.configureLifecycle(
                                id,
                                defaultConfig({
                                    expirationMode: MODE_PER_HOLDER,
                                    transferPolicy: policy,
                                    expirationDisposition: DISP_BURN,
                                    defaultDuration: 1000n,
                                }),
                            ),
                            `PerHolder + ${name} must revert`,
                        ).to.be.revertedWith('PerHolder requires non-transferable policy');
                    }
                });

                it('Q2 matrix: PerHolder + SOULBOUND and PerHolder + ISSUER_ONLY are accepted (LifecycleConfigured emitted)', async function () {
                    const allowed = [
                        { name: 'SOULBOUND', policy: POLICY_SOULBOUND },
                        { name: 'ISSUER_ONLY', policy: POLICY_ISSUER_ONLY },
                    ];
                    for (const { name, policy } of allowed) {
                        const id = await createFundedNFT(`Q2Allow${name}`, `Q2A${policy}`);
                        const cfg = defaultConfig({
                            expirationMode: MODE_PER_HOLDER,
                            transferPolicy: policy,
                            expirationDisposition: DISP_BURN,
                            defaultDuration: 1000n,
                        });
                        await expect(
                            ownerDiamond.configureLifecycle(id, cfg),
                            `PerHolder + ${name} must be accepted`,
                        )
                            .to.emit(geniusDiamond, 'LifecycleConfigured')
                            .withArgs(
                                id,
                                [
                                    cfg.validFrom,
                                    cfg.validUntil,
                                    cfg.defaultDuration,
                                    cfg.expirationMode,
                                    cfg.transferPolicy,
                                    cfg.expirationDisposition,
                                    cfg.expirationRecipient,
                                    cfg.credentialVerifier,
                                ],
                                owner,
                            );
                    }
                });
            });
        });
    }
});
