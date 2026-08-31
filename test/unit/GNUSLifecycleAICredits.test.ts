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
import { SGNS_DESTINATION, SGNS_DESTINATION_Y_ODD, DEST_CHAIN_ID } from '../utils/bridge-fixtures';
import { ensureDiamondTestBaseline } from '../utils/diamond-baseline';

chai.use(chaiAsPromised);

/**
 * Phase 13 — AI Credits end-to-end (Plan 13-06, SC7 / D11) + selector-collision loupe assertion.
 *
 * AI Credits product shape (D11): a DIRECT child of GNUS at exchangeRate 1.0 (minion scale),
 * transferPolicy = SOULBOUND (1), expirationDisposition = BURN (2), expirationMode = PerHolder (2),
 * defaultDuration = 30 days per SKU, no expiration recipient, no credential verifier.
 * createNFTWithLifecycle (13-03) forces nonConvertible = true for BURN — the structural
 * zero-credit guarantee.
 *
 * Behaviors:
 *   1. Configuration end-to-end — getNFTInfo reflects every D11 field; nonConvertible == true.
 *   2. Purchase (D11 treasury-direct): creator/service mints credits to the user via
 *      mintWithCredential — the CALLER's GNUS decreases 1:1 (Phase 9 conversion-native mint:
 *      _burn(sender, GNUS_TOKEN_ID, amount)), the user's clock = now + 30 days.
 *   3. Spend-burn: holder burn decrements balance and totalSupply.
 *   4. Zero-credit economics (SC7 core): spend-burn AND expiry-settle produce ZERO delta to any
 *      GNUS balance or GNUS totalSupply; tree supply (GNUS + credits) decreases by exactly the
 *      burned amounts; the cross-chain provenance counter (totalSupplyOfAll) never moves; and
 *      convert() on the credits id reverts "Token is non-convertible".
 *   5. Expiry: permissionless settleExpired by a third party emits
 *      Settled(account, id, amount, BURN, 0x0); holder balance 0; clock cleared.
 *   6. SOULBOUND enforcement: user-to-user transfer reverts; bridgeOut reverts.
 *   7. Selector collision: each of the 11 Phase 13 selectors appears EXACTLY once across all
 *      facets in the diamond loupe.
 *
 * Boot pattern: GNUSLifecyclePolicy.test.ts (13-04). Time control: hardhat-network-helpers only.
 */
describe('GNUS AI Credits End-to-End Tests (Phase 13 SC7/D11)', async function () {
    const diamondName = 'GeniusDiamond';
    const log: debug.Debugger = debug('GNUSLifecycleAICredits:log:${diamondName}');
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

    // ---- Named constants — no magic numbers (plan 13-06 Task 3) ----
    const GNUS_TOKEN_ID = 0n;
    const THIRTY_DAYS_SECONDS = 30n * 24n * 60n * 60n;
    const EXCHANGE_RATE_ONE = ethers.parseEther('1'); // 1.0 display scale (minions per 1 child unit)
    // NOTE: the plan's "maxSupply = 0 (unlimited)" is NOT the shipped semantic — the hook's
    // max-supply check runs AFTER ERC1155SupplyUpgradeable's supply increment (super call),
    // so maxSupply == 0 permits no mints at all. Use a large explicit SKU cap.
    const AI_CREDITS_MAX_SUPPLY = toWei('1000000');
    const PURCHASE_AMOUNT = toWei('5'); // $5 SKU priced as 5 GNUS at rate 1.0 (D11 fixed-price v1)
    const SPEND_AMOUNT = toWei('2');
    const EXPIRY_GRACE_SECONDS = 1n;

    // Phase 13 selector surface (canonical signatures; ordinals per GNUSLifecycleTypes.sol).
    const PHASE_13_SELECTORS: Array<[string, string]> = [
        ['settleExpired', 'settleExpired(address,uint256)'],
        ['isTokenActive', 'isTokenActive(uint256)'],
        ['isSpendable', 'isSpendable(address,uint256)'],
        ['holderExpiresAt', 'holderExpiresAt(uint256,address)'],
        ['configureLifecycle', 'configureLifecycle(uint256,(uint64,uint64,uint64,uint8,uint8,uint8,address,address))'],
        ['setValidFrom', 'setValidFrom(uint256,uint64)'],
        ['setValidUntil', 'setValidUntil(uint256,uint64)'],
        ['setPerWalletMintCap', 'setPerWalletMintCap(uint256,uint256)'],
        ['setAllowlistRegistry', 'setAllowlistRegistry(uint256,address)'],
        ['mintWithCredential', 'mintWithCredential(address,uint256,uint256,bytes,bytes)'],
        ['createNFTWithLifecycle', 'createNFTWithLifecycle(uint256,string,string,uint256,uint256,string,(uint64,uint64,uint64,uint8,uint8,uint8,address,address))'],
    ];

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

                // Declare the protocol baseline BEFORE any snapshot so reverts restore it (TEST-04)
                await ensureDiamondTestBaseline(geniusDiamond, diamondAddress);
            });

            beforeEach(async function () {
                snapshotId = await provider.send('evm_snapshot', []);
            });

            afterEach(async () => {
                if (snapshotId) {
                    await provider.send('evm_revert', [snapshotId]);
                }
            });

            /** The D11 AI Credits LifecycleConfig (SOULBOUND / BURN / PerHolder / 30-day SKU). */
            function aiCreditsConfig() {
                return {
                    validFrom: 0n,
                    validUntil: 0n,
                    defaultDuration: THIRTY_DAYS_SECONDS,
                    expirationMode: 2, // PerHolder
                    transferPolicy: 1, // SOULBOUND
                    expirationDisposition: 2, // BURN
                    expirationRecipient: ethers.ZeroAddress,
                    credentialVerifier: ethers.ZeroAddress,
                };
            }

            /**
             * Create a fresh AI Credits SKU as a direct GNUS child via createNFTWithLifecycle
             * (no UNRESTRICTED-default window, Q5) and fund the owner (creator/service backend)
             * with GNUS. Returns the new token id.
             */
            async function createAiCreditsSku(): Promise<bigint> {
                await ownerDiamond['mint(address,uint256)'](owner, toWei('100000'));
                const info = await geniusDiamond.getNFTInfo(GNUS_TOKEN_ID);
                const childIndex: bigint = info.childCurIndex;
                await ownerDiamond.createNFTWithLifecycle(
                    GNUS_TOKEN_ID,
                    'AI Credits (Monthly)',
                    'AICREDIT-M',
                    EXCHANGE_RATE_ONE,
                    AI_CREDITS_MAX_SUPPLY,
                    'ipfs://ai-credits/monthly',
                    aiCreditsConfig(),
                );
                return (GNUS_TOKEN_ID << 128n) | childIndex;
            }

            /** Treasury-direct purchase (D11): creator/service mints credits to the user, paying GNUS 1:1. */
            async function purchaseCredits(id: bigint, to: string, amount: bigint): Promise<void> {
                await ownerDiamond.mintWithCredential(to, id, amount, '0x', '0x');
            }

            it('AI Credits configuration end-to-end — every D11 field lands, nonConvertible == true', async function () {
                const id = await createAiCreditsSku();
                const info = await geniusDiamond.getNFTInfo(id);
                expect(info.parentId).to.eq(GNUS_TOKEN_ID);
                expect(info.exchangeRate).to.eq(EXCHANGE_RATE_ONE);
                expect(info.validFrom).to.eq(0n);
                expect(info.validUntil).to.eq(0n);
                expect(info.defaultDuration).to.eq(THIRTY_DAYS_SECONDS);
                expect(info.expirationMode).to.eq(2n);
                expect(info.transferPolicy).to.eq(1n);
                expect(info.expirationDisposition).to.eq(2n);
                expect(info.expirationRecipient).to.eq(ethers.ZeroAddress);
                expect(info.credentialVerifier).to.eq(ethers.ZeroAddress);
                // 13-03 D11 wiring: BURN disposition forces nonConvertible at creation — the
                // structural non-redeemability guarantee (convert reverts).
                expect(info.nonConvertible).to.eq(true);
            });

            it('purchase via mintWithCredential sets the holder clock now+30d and decrements the caller GNUS 1:1', async function () {
                const id = await createAiCreditsSku();
                const ownerGnusBefore = await geniusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID);

                await purchaseCredits(id, signer1, PURCHASE_AMOUNT);

                const mintTime = BigInt(await time.latest());
                // User received the credits.
                expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, id)).to.eq(PURCHASE_AMOUNT);
                // PerHolder clock: now + 30 days (D3 zero-balance fresh clock).
                expect(await geniusDiamond.holderExpiresAt(id, signer1)).to.eq(mintTime + THIRTY_DAYS_SECONDS);
                // Phase 9 conversion-native mint: the CALLER (treasury-direct service backend)
                // pays GNUS 1:1 — amount IS minions at rate 1.0.
                expect(await geniusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID)).to.eq(
                    ownerGnusBefore - PURCHASE_AMOUNT,
                );
                expect(await geniusDiamond['totalSupply(uint256)'](id)).to.eq(PURCHASE_AMOUNT);
                // Spendable while the clock is live.
                expect(await geniusDiamond.isSpendable(signer1, id)).to.eq(true);
            });

            it('spend-burn decrements balance and totalSupply', async function () {
                const id = await createAiCreditsSku();
                await purchaseCredits(id, signer1, PURCHASE_AMOUNT);
                await signer1Diamond['burn(address,uint256,uint256)'](signer1, id, SPEND_AMOUNT);
                expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, id)).to.eq(PURCHASE_AMOUNT - SPEND_AMOUNT);
                expect(await geniusDiamond['totalSupply(uint256)'](id)).to.eq(PURCHASE_AMOUNT - SPEND_AMOUNT);
            });

            it('zero-credit economics — spend and expiry create ZERO GNUS/parent/treasury credit (SC7)', async function () {
                const id = await createAiCreditsSku();
                await purchaseCredits(id, signer1, PURCHASE_AMOUNT);

                // Snapshot before the spend-burn.
                // NOTE on readers: totalSupplyOfAll() is the CROSS-CHAIN PROVENANCE counter
                // (cumulative minted minions, never decremented by burns — GNUSTreasury B1),
                // NOT a live tree-supply total. Tree conservation is proven via
                // totalSupply(GNUS_TOKEN_ID) + totalSupply(creditsId); the provenance counter is
                // asserted UNCHANGED (a burn-only path must never mint anything back).
                const s1Gnus = await geniusDiamond['balanceOf(address,uint256)'](signer1, GNUS_TOKEN_ID);
                const ownerGnus = await geniusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID);
                const s2Gnus = await geniusDiamond['balanceOf(address,uint256)'](signer2, GNUS_TOKEN_ID);
                const gnusSupply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
                const creditsSupply = await geniusDiamond['totalSupply(uint256)'](id);
                const provenanceAll = await geniusDiamond['totalSupplyOfAll()']();
                const treeSupply = gnusSupply + creditsSupply;

                // SPEND: burn-only — child supply down, nothing credited anywhere.
                await signer1Diamond['burn(address,uint256,uint256)'](signer1, id, SPEND_AMOUNT);
                expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, GNUS_TOKEN_ID)).to.eq(s1Gnus);
                expect(await geniusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID)).to.eq(ownerGnus);
                expect(await geniusDiamond['balanceOf(address,uint256)'](signer2, GNUS_TOKEN_ID)).to.eq(s2Gnus);
                expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, id)).to.eq(PURCHASE_AMOUNT - SPEND_AMOUNT);
                expect(await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID)).to.eq(gnusSupply);
                expect(await geniusDiamond['totalSupply(uint256)'](id)).to.eq(creditsSupply - SPEND_AMOUNT);
                expect(await geniusDiamond['totalSupplyOfAll()']()).to.eq(provenanceAll); // no mint-back
                expect(
                    (await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID)) +
                        (await geniusDiamond['totalSupply(uint256)'](id)),
                ).to.eq(treeSupply - SPEND_AMOUNT); // pure supply decrease

                // EXPIRY: warp past the holder clock, permissionless settle by a third party.
                const expiry = await geniusDiamond.holderExpiresAt(id, signer1);
                await time.setNextBlockTimestamp(Number(expiry + EXPIRY_GRACE_SECONDS));
                await signer2Diamond.settleExpired(signer1, id);

                // Still zero credit anywhere: no GNUS balance, parent-supply, or tree-supply gain.
                expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, GNUS_TOKEN_ID)).to.eq(s1Gnus);
                expect(await geniusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID)).to.eq(ownerGnus);
                expect(await geniusDiamond['balanceOf(address,uint256)'](signer2, GNUS_TOKEN_ID)).to.eq(s2Gnus);
                expect(await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID)).to.eq(gnusSupply);
                expect(await geniusDiamond['totalSupply(uint256)'](id)).to.eq(0n);
                expect(await geniusDiamond['totalSupplyOfAll()']()).to.eq(provenanceAll);
                expect(
                    (await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID)) +
                        (await geniusDiamond['totalSupply(uint256)'](id)),
                ).to.eq(treeSupply - PURCHASE_AMOUNT); // spend + settle burns only

                // Structural non-redeemability: convert() on the AI Credits id reverts (D11/BURN →
                // nonConvertible=true at creation).
                await expect(
                    signer1Diamond.convert(id, GNUS_TOKEN_ID, 1n, signer1),
                ).to.be.revertedWith('Token is non-convertible');
            });

            it('expiry settle emits Settled(account, id, amount, BURN, 0x0); holder balance 0; clock cleared', async function () {
                const id = await createAiCreditsSku();
                await purchaseCredits(id, signer1, PURCHASE_AMOUNT);
                const expiry = await geniusDiamond.holderExpiresAt(id, signer1);
                await time.setNextBlockTimestamp(Number(expiry + EXPIRY_GRACE_SECONDS));

                await expect(signer2Diamond.settleExpired(signer1, id)) // permissionless third party
                    .to.emit(geniusDiamond, 'Settled')
                    .withArgs(signer1, id, PURCHASE_AMOUNT, 2n, ethers.ZeroAddress);

                expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, id)).to.eq(0n);
                expect(await geniusDiamond.holderExpiresAt(id, signer1)).to.eq(0n);
                expect(await geniusDiamond.isSpendable(signer1, id)).to.eq(false);
            });

            it('soulbound + non-bridgeable: user-to-user transfer reverts; bridgeOut reverts', async function () {
                const id = await createAiCreditsSku();
                await purchaseCredits(id, signer1, PURCHASE_AMOUNT);
                await expect(
                    signer1Diamond.safeTransferFrom(signer1, signer2, id, SPEND_AMOUNT, '0x'),
                ).to.be.revertedWith('SOULBOUND: holder-to-holder transfers blocked');
                await expect(
                    signer1Diamond.bridgeOut(SPEND_AMOUNT, id, DEST_CHAIN_ID, SGNS_DESTINATION, SGNS_DESTINATION_Y_ODD),
                ).to.be.revertedWith('Policy-bound token cannot bridge in v1');
            });

            it('selector collision — each Phase 13 selector appears exactly once across all facets', async function () {
                // Collect every selector from every facet via the loupe.
                const facetAddrs: string[] = await geniusDiamond.facetAddresses();
                const allSelectors: string[] = [];
                for (const facet of facetAddrs) {
                    const selectors: string[] = await geniusDiamond.facetFunctionSelectors(facet);
                    allSelectors.push(...selectors.map((s) => s.toLowerCase()));
                }

                for (const [name, signature] of PHASE_13_SELECTORS) {
                    const selector = ethers.id(signature).slice(0, 10).toLowerCase();
                    const count = allSelectors.filter((s) => s === selector).length;
                    // Exactly-once: registered (never dropped by a diamondCut collision) and not
                    // duplicated across facets (duplicate replace would silently shadow).
                    expect(count, `${name} (${selector}) must appear exactly once across facets`).to.eq(1);
                }
            });
        });
    }
});
