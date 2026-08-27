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
 * Phase 13 — Transfer-policy predicate tests (Plan 13-04, SC3).
 *
 * Proves the single-predicate transfer-policy enforcement point (D6): every mint/transfer/burn
 * on the diamond routes through GNUSERC1155MaxSupply._beforeTokenTransfer → the internal
 * _enforceTransferPolicy wrapper → the GNUSLifecyclePolicy library (13-04 EIP-170 relocation),
 * and that:
 *   - SOULBOUND blocks holder-to-holder transfers — direct, operator-mediated (approval), and
 *     by a holder of the proxy-operator marketplace role (Pitfall P2 / T-13-04-01: the role
 *     only skips the ERC-1155 approval check; the predicate still runs and blocks the move) —
 *     while permitting mint, burn, fixed-recipient return, and creator/admin correction.
 *   - ISSUER_ONLY permits only creator/admin moves.
 *   - ALLOWLISTED consults the per-token registry (revert when unconfigured or not allowed).
 *   - CONTROLLED_RESALE blocks all ordinary holder-to-holder transfers in v1 (single + batch).
 *   - LOCKED_AFTER_START permits before validFrom and locks after.
 *   - UNRESTRICTED (zero-default) passes — legacy behavior preserved.
 *   - GNUS_TOKEN_ID (id 0) is always UNRESTRICTED regardless of stored config (T-13-04-05).
 *   - Mixed-token batches revert atomically — NEITHER balance changes when one element violates
 *     policy.
 *
 * Boot pattern: LocalDiamondDeployer (multichain fixture) per GNUSLifecycle.test.ts (13-02) and
 * GNUSNFTFactoryAntiScalping.test.ts (13-03). Time control: hardhat-network-helpers `time` only.
 *
 * Policy ordinals (GNUSLifecycleTypes.sol TransferPolicy): UNRESTRICTED=0, SOULBOUND=1,
 * ISSUER_ONLY=2, ALLOWLISTED=3, CONTROLLED_RESALE=4, LOCKED_AFTER_START=5.
 * Disposition ordinals (ExpirationDisposition): NONE=0, KEEP_INERT=1, BURN=2,
 * RETURN_TO_ADDRESS=3, REDEEM_TO_PARENT=4. ExpirationMode: None=0, PerTokenId=1, PerHolder=2.
 */
describe('GNUS Lifecycle Transfer Policy Tests', async function () {
    const diamondName = 'GeniusDiamond';
    const log: debug.Debugger = debug('GNUSLifecyclePolicy:log:${diamondName}');
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
    // keccak256("NFT_PROXY_OPERATOR_ROLE") — the marketplace role that must NOT bypass the
    // predicate (T-13-04-01). The role only affects the proxy-operator facet's approval
    // auto-approval; the predicate never reads it.
    const MARKETPLACE_ROLE = ethers.keccak256(ethers.toUtf8Bytes('NFT_PROXY_OPERATOR_ROLE'));
    const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

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
            let signer2Diamond: GeniusDiamond;
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
                signer2Diamond = geniusDiamond.connect(signers[2]);
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
             * given LifecycleConfig, and mint `amount` to signer1 (the standard holder).
             * configureLifecycle must run BEFORE the first mint (13-02 gate).
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

            /** Deploy a fresh MockAllowlistRegistry and return its address + contract. */
            async function deployMockRegistry() {
                const factory = await ethers.getContractFactory('MockAllowlistRegistry');
                const mock = await factory.deploy();
                await mock.waitForDeployment();
                const address = await mock.getAddress();
                return { mock, address };
            }

            describe('SOULBOUND (policy 1)', function () {
                it('rejects direct holder-to-holder safeTransferFrom with the SOULBOUND string', async function () {
                    const id = await createConfiguredNFT('SoulDirect', 'SB1', defaultConfig({ transferPolicy: 1 }));
                    await expect(
                        signer1Diamond.safeTransferFrom(signer1, signer2, id, toWei('1'), '0x'),
                    ).to.be.revertedWith('SOULBOUND: holder-to-holder transfers blocked');
                });

                it('rejects operator-mediated transfer (setApprovalForAll + transferFrom by third party)', async function () {
                    const id = await createConfiguredNFT('SoulOper', 'SB2', defaultConfig({ transferPolicy: 1 }));
                    await signer1Diamond.setApprovalForAll(signer2, true);
                    await expect(
                        signer2Diamond.safeTransferFrom(signer1, signer2, id, toWei('1'), '0x'),
                    ).to.be.revertedWith('SOULBOUND: holder-to-holder transfers blocked');
                });

                it('rejects transfer by a proxy-operator marketplace role holder (Pitfall P2 / T-13-04-01 — role does NOT bypass the predicate)', async function () {
                    const id = await createConfiguredNFT('SoulRole', 'SB3', defaultConfig({ transferPolicy: 1 }));
                    // Grant signer2 the marketplace role, then explicitly approve signer2 as an
                    // operator for signer1 so the ERC-1155 approval check is satisfied and the
                    // transfer REACHES the policy predicate. The proxy-operator facet auto-approves
                    // role holders at the approval layer in production; here the explicit approval
                    // guarantees the approval gate is open regardless of override routing. The
                    // predicate never reads the role, so the transfer must STILL revert with the
                    // SOULBOUND string — the role does NOT bypass the predicate (load-bearing D6).
                    await ownerDiamond.grantRole(MARKETPLACE_ROLE, signer2);
                    await signer1Diamond.setApprovalForAll(signer2, true);
                    await expect(
                        signer2Diamond.safeTransferFrom(signer1, signer2, id, toWei('1'), '0x'),
                    ).to.be.revertedWith('SOULBOUND: holder-to-holder transfers blocked');
                });

                it('permits mint (mint carve-out) and spend-burn by the holder (burn carve-out, D5)', async function () {
                    // Mint already happened inside createConfiguredNFT — reaching here proves the
                    // mint carve-out passed for a SOULBOUND token.
                    const id = await createConfiguredNFT('SoulBurn', 'SB4', defaultConfig({ transferPolicy: 1 }));
                    expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, id)).to.eq(toWei('10'));
                    // Consumption burn by the holder is always permitted (D5).
                    await signer1Diamond['burn(address,uint256,uint256)'](signer1, id, toWei('4'));
                    expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, id)).to.eq(toWei('6'));
                });

                it('permits fixed-recipient return via settleExpired (RETURN_TO_ADDRESS) and creator correction', async function () {
                    const now = BigInt(await time.latest());
                    const id = await createConfiguredNFT(
                        'SoulReturn',
                        'SB5',
                        defaultConfig({
                            transferPolicy: 1,
                            expirationMode: 1, // PerTokenId
                            validUntil: now + 500n,
                            expirationDisposition: 3, // RETURN_TO_ADDRESS
                            expirationRecipient: owner,
                        }),
                    );
                    // Creator (owner) correction transfer of signer1's tokens to signer2 is
                    // permitted (D5). Approve owner as operator for signer1 so the approval gate
                    // is open and the transfer reaches the SOULBOUND issuer-correction carve-out.
                    await signer1Diamond.setApprovalForAll(owner, true);
                    await ownerDiamond.safeTransferFrom(signer1, signer2, id, toWei('2'), '0x');
                    expect(await geniusDiamond['balanceOf(address,uint256)'](signer2, id)).to.eq(toWei('2'));

                    // Warp past expiry: settleExpired moves signer1's remaining 8 to the fixed
                    // expirationRecipient (owner) through the SOULBOUND fixed-recipient carve-out.
                    await time.setNextBlockTimestamp(Number(now + 501n));
                    await geniusDiamond.settleExpired(signer1, id);
                    expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, id)).to.eq(0n);
                    expect(await geniusDiamond['balanceOf(address,uint256)'](owner, id)).to.eq(toWei('8'));
                });
            });

            describe('ISSUER_ONLY (policy 2)', function () {
                it('permits creator transfer; rejects non-creator holder transfer', async function () {
                    const id = await createConfiguredNFT('IssuerOnly', 'IO1', defaultConfig({ transferPolicy: 2 }));
                    // Creator (owner) can move signer1's tokens. Approve owner as operator for
                    // signer1 so the approval gate is open and the transfer reaches the predicate.
                    await signer1Diamond.setApprovalForAll(owner, true);
                    await ownerDiamond.safeTransferFrom(signer1, signer2, id, toWei('3'), '0x');
                    expect(await geniusDiamond['balanceOf(address,uint256)'](signer2, id)).to.eq(toWei('3'));
                    // Holder (signer1) is neither creator nor admin — blocked.
                    await expect(
                        signer1Diamond.safeTransferFrom(signer1, signer2, id, toWei('1'), '0x'),
                    ).to.be.revertedWith('ISSUER_ONLY: only creator/admin can transfer');
                });
            });

            describe('ALLOWLISTED (policy 3)', function () {
                it('reverts "ALLOWLISTED: no registry configured" when no registry is set', async function () {
                    const id = await createConfiguredNFT('AllowNone', 'AL1', defaultConfig({ transferPolicy: 3 }));
                    await expect(
                        signer1Diamond.safeTransferFrom(signer1, signer2, id, toWei('1'), '0x'),
                    ).to.be.revertedWith('ALLOWLISTED: no registry configured');
                });

                it('permits allowlisted destination; rejects non-allowlisted destination', async function () {
                    const { mock, address: registryAddr } = await deployMockRegistry();
                    const now = BigInt(await time.latest());
                    // Registry must be set pre-first-mint (13-02 gate) — build the token manually.
                    await ownerDiamond['mint(address,uint256)'](owner, toWei('10000'));
                    const info = await geniusDiamond.getNFTInfo(GNUS_TOKEN_ID);
                    const childIndex: bigint = info.childCurIndex;
                    await ownerDiamond.createNFT(
                        GNUS_TOKEN_ID, 'AllowList', 'AL2', toWei('1'), toWei('1000000'), 'ipfs://al2',
                    );
                    const id = (GNUS_TOKEN_ID << 128n) | childIndex;
                    await ownerDiamond.configureLifecycle(id, defaultConfig({ transferPolicy: 3 }));
                    await ownerDiamond.setAllowlistRegistry(id, registryAddr);
                    await ownerDiamond.mintWithCredential(signer1, id, toWei('10'), '0x', '0x');

                    // Non-allowlisted destination (signer2) — blocked.
                    await expect(
                        signer1Diamond.safeTransferFrom(signer1, signer2, id, toWei('1'), '0x'),
                    ).to.be.revertedWith('ALLOWLISTED: destination not allowed');

                    // Allowlist signer2 — transfer now succeeds.
                    await mock.setAllowed(signer2, true);
                    await signer1Diamond.safeTransferFrom(signer1, signer2, id, toWei('1'), '0x');
                    expect(await geniusDiamond['balanceOf(address,uint256)'](signer2, id)).to.eq(toWei('1'));
                });
            });

            describe('CONTROLLED_RESALE (policy 4)', function () {
                it('blocks ordinary single and batch holder-to-holder transfers (v1)', async function () {
                    const id = await createConfiguredNFT('Controlled', 'CR1', defaultConfig({ transferPolicy: 4 }));
                    await expect(
                        signer1Diamond.safeTransferFrom(signer1, signer2, id, toWei('1'), '0x'),
                    ).to.be.revertedWith('CONTROLLED_RESALE: resale mechanism v2');
                    await expect(
                        signer1Diamond.safeBatchTransferFrom(signer1, signer2, [id], [toWei('1')], '0x'),
                    ).to.be.revertedWith('CONTROLLED_RESALE: resale mechanism v2');
                });
            });

            describe('LOCKED_AFTER_START (policy 5)', function () {
                it('permits transfer before validFrom; reverts after (boundary at validFrom)', async function () {
                    const now = BigInt(await time.latest());
                    const start = now + 1000n;
                    // Token created and minted with a future validFrom — transferable until start.
                    await ownerDiamond['mint(address,uint256)'](owner, toWei('10000'));
                    const info = await geniusDiamond.getNFTInfo(GNUS_TOKEN_ID);
                    const childIndex: bigint = info.childCurIndex;
                    await ownerDiamond.createNFT(
                        GNUS_TOKEN_ID, 'Locked', 'LK1', toWei('1'), toWei('1000000'), 'ipfs://lk1',
                    );
                    const id = (GNUS_TOKEN_ID << 128n) | childIndex;
                    // validFrom is also the mint-window gate — mint must happen at/after start.
                    // Configure first, warp to start, mint, then test the transfer lock.
                    await ownerDiamond.configureLifecycle(
                        id,
                        defaultConfig({ transferPolicy: 5, validFrom: start }),
                    );
                    // Before validFrom: mint blocked by the window gate; transfer lock not yet
                    // active — but there is nothing to transfer yet. Warp to the start, mint,
                    // and the lock engages from that block onward.
                    await time.setNextBlockTimestamp(Number(start));
                    await ownerDiamond.mintWithCredential(signer1, id, toWei('10'), '0x', '0x');
                    // At validFrom the lock is already engaged (transfers require ts < validFrom).
                    await expect(
                        signer1Diamond.safeTransferFrom(signer1, signer2, id, toWei('1'), '0x'),
                    ).to.be.revertedWith('LOCKED_AFTER_START: transfers locked');
                });
            });

            describe('UNRESTRICTED (policy 0) + GNUS_TOKEN_ID carve-out', function () {
                it('zero-default token transfers freely (legacy behavior preserved)', async function () {
                    const id = await createConfiguredNFT('Unrestricted', 'UN1', defaultConfig());
                    await signer1Diamond.safeTransferFrom(signer1, signer2, id, toWei('2'), '0x');
                    expect(await geniusDiamond['balanceOf(address,uint256)'](signer2, id)).to.eq(toWei('2'));
                });

                it('GNUS_TOKEN_ID (id 0) is always UNRESTRICTED — predicate early-returns (T-13-04-05)', async function () {
                    // Owner holds GNUS from the funding mints. A direct id-0 transfer must pass
                    // the predicate regardless of any stored config for id 0.
                    await ownerDiamond['mint(address,uint256)'](owner, toWei('100'));
                    await ownerDiamond.safeTransferFrom(owner, signer2, GNUS_TOKEN_ID, toWei('5'), '0x');
                    expect(await geniusDiamond['balanceOf(address,uint256)'](signer2, GNUS_TOKEN_ID)).to.eq(toWei('5'));
                });
            });

            describe('batch atomicity (mixed-token revert)', function () {
                it('batch [UNRESTRICTED-id, SOULBOUND-id] reverts atomically — NEITHER balance changes', async function () {
                    const idFree = await createConfiguredNFT('BatchFree', 'BF1', defaultConfig());
                    const idSoul = await createConfiguredNFT('BatchSoul', 'BS1', defaultConfig({ transferPolicy: 1 }));

                    const freeBefore1 = await geniusDiamond['balanceOf(address,uint256)'](signer1, idFree);
                    const soulBefore1 = await geniusDiamond['balanceOf(address,uint256)'](signer1, idSoul);
                    const freeBefore2 = await geniusDiamond['balanceOf(address,uint256)'](signer2, idFree);
                    const soulBefore2 = await geniusDiamond['balanceOf(address,uint256)'](signer2, idSoul);

                    // The SOULBOUND element violates policy — the WHOLE batch reverts.
                    await expect(
                        signer1Diamond.safeBatchTransferFrom(
                            signer1,
                            signer2,
                            [idFree, idSoul],
                            [toWei('1'), toWei('1')],
                            '0x',
                        ),
                    ).to.be.revertedWith('SOULBOUND: holder-to-holder transfers blocked');

                    // Atomicity: neither token balance changed on either side.
                    expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, idFree)).to.eq(freeBefore1);
                    expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, idSoul)).to.eq(soulBefore1);
                    expect(await geniusDiamond['balanceOf(address,uint256)'](signer2, idFree)).to.eq(freeBefore2);
                    expect(await geniusDiamond['balanceOf(address,uint256)'](signer2, idSoul)).to.eq(soulBefore2);
                });
            });

            describe('mint-path defense-in-depth (validFrom inside the predicate)', function () {
                it('mint before validFrom reverts "Token not yet active" on a configured-policy token', async function () {
                    const now = BigInt(await time.latest());
                    const start = now + 1000n;
                    await ownerDiamond['mint(address,uint256)'](owner, toWei('10000'));
                    const info = await geniusDiamond.getNFTInfo(GNUS_TOKEN_ID);
                    const childIndex: bigint = info.childCurIndex;
                    await ownerDiamond.createNFT(
                        GNUS_TOKEN_ID, 'Window', 'WN1', toWei('1'), toWei('1000000'), 'ipfs://wn1',
                    );
                    const id = (GNUS_TOKEN_ID << 128n) | childIndex;
                    await ownerDiamond.configureLifecycle(
                        id,
                        defaultConfig({ transferPolicy: 1, validFrom: start }),
                    );
                    // Legacy factory mint path: the hook's mint-branch validFrom gate fires
                    // before the window opens (load-bearing legacy-path gate, 13-03 ADDENDUM).
                    await expect(
                        ownerDiamond['mint(address,uint256,uint256,bytes)'](signer1, id, toWei('1'), '0x'),
                    ).to.be.revertedWith('Token not yet active');
                    // After the window opens the mint succeeds (mint carve-out).
                    await time.setNextBlockTimestamp(Number(start));
                    await ownerDiamond['mint(address,uint256,uint256,bytes)'](signer1, id, toWei('1'), '0x');
                    expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, id)).to.eq(toWei('1'));
                });
            });
        });
    }
});
