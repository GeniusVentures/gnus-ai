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
 * Phase 14 — Licensing unit suite (Plan 14-03, LIC-01/03/04/05/06).
 *
 * Coverage per the plan behavior block:
 *   LIC-03 — SKU CRUD: creator configures; non-privileged reverts "Only creator or admin";
 *            getSKU round-trips all seven D-04 fields; setSKUActive(false) → purchase reverts
 *            "SKU inactive".
 *   LIC-04 — purchaseCredits: GNUS totalSupply delta == priceInMinions EXACTLY (D-10 burn,
 *            never custody); deviceWallet receives creditAmount; insufficient-allowance purchase
 *            reverts with no mint and totalSupply unchanged.
 *   LIC-01 — Hierarchy (D-02): GNUS product root → License NFT (creator-only) → company credits
 *            as license children (grandchildren of the root); individual AI Credits stay direct
 *            product-root children (Phase 13 shape); grandchild creation auth is parent-creator
 *            only (GNUSLifecycle.sol:351-353).
 *   LIC-05 — LicenseActivated(companyAdmin, licenseId, privateNetworkId, expiresAt==validUntil)
 *            on createLicense; renewLicense stacks validUntil to max(current, now)+duration and
 *            re-emits LicenseActivated with the extended expiry (D-14).
 *   LIC-06 — Hybrid redeemability is CONFIG, not new code (D-05/D-28): an exchangeRate>0
 *            REDEEM_TO_PARENT token redeems via the existing Phase 13 settle path; the burn-only
 *            SOULBOUND credits (BURN disposition → nonConvertible) are NOT redeemable — convert
 *            reverts and expiry settle yields ZERO GNUS (Phase 13 SC7 invariant).
 *
 * Boot pattern: GNUSLifecycleAICredits.test.ts (Phase 13 D11). Time control:
 * hardhat-network-helpers only.
 */
describe('GNUS Licensing (Phase 14 LIC-01/03/04/05/06)', async function () {
    const diamondName = 'GeniusDiamond';
    const log: debug.Debugger = debug('GNUSLicensing:log:${diamondName}');
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

    // ---- Named constants — no magic numbers ----
    const GNUS_TOKEN_ID = 0n;
    const THIRTY_DAYS_SECONDS = 30n * 24n * 60n * 60n;
    const EXCHANGE_RATE_ONE = ethers.parseEther('1'); // minion scale per child unit
    const SKU_MAX_SUPPLY = toWei('1000000');
    const CREDIT_PRICE = toWei('5'); // $5 credit top-up SKU (D-26 GNUS-only rail)
    const CREDIT_AMOUNT = toWei('100');
    const LICENSE_PRICE = toWei('20'); // operator license SKU price (renewal same)
    const PRIVATE_NETWORK_ID = 42n;
    const NETWORK_SCOPE_PRIVATE_ONLY = 1; // NetworkScope.PrivateOnly
    const NETWORK_SCOPE_HYBRID = 2; // NetworkScope.Hybrid
    const EXPIRY_GRACE_SECONDS = 1n;
    const CREATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('CREATOR_ROLE'));

    // SKU ids (registry keys — arbitrary, stable within the suite).
    const SKU_ID_CREDIT = 1n;
    const SKU_ID_LICENSE = 2n;
    const SKU_ID_RENEWAL = 3n;
    const SKU_ID_HYBRID_CREDIT = 4n;
    const HYBRID_CREDIT_AMOUNT = toWei('50');

    // Phase 14 gap-closure (plan 14-05) — split-mint SKUs + network-key validation.
    const SKU_ID_SPLIT = 5n;
    const SKU_ID_PUBLIC_ONLY = 6n;
    const PRIVATE_LEG = toWei('2.5');
    const PUBLIC_LEG = toWei('2.5');
    const ROGUE_NETWORK_ID = 99n;
    const PUBLIC_CHILD_INDEX = 1n; // test-side mirror of _PUBLIC_CHILD_INDEX

    // keccak256("gnus.ai.nft.factory.storage") — NFT struct mapping base slot
    // (slot-math helper pattern from GNUSLifecycleUpgrade.test.ts).
    const FACTORY_STORAGE_SLOT = ethers.keccak256(ethers.toUtf8Bytes('gnus.ai.nft.factory.storage'));

    /** Storage slot of NFTs[tokenId] + offset (verified layout: +11 companyAdmin, +12 privateNetworkId). */
    function nftSlot(tokenId: bigint, offset: bigint): string {
        const mappingSlot = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'uint256'], [tokenId, FACTORY_STORAGE_SLOT]),
        );
        return ethers.toBeHex(BigInt(mappingSlot) + offset, 32);
    }

    for (const [networkName, provider] of networkProviders.entries()) {
        describe(`Chain: ${networkName}  Diamond: ${diamondName}`, function () {
            let diamond: Diamond;
            let signers: SignerWithAddress[];
            let creator: string;
            let buyer: string;
            let companyAdmin: string;
            let deviceWallet: string;
            let outsider: string;
            let owner: string;
            let geniusDiamond: GeniusDiamond;
            let ownerDiamond: GeniusDiamond;
            let creatorDiamond: GeniusDiamond;
            let buyerDiamond: GeniusDiamond;
            let outsiderDiamond: GeniusDiamond;
            let deviceWalletDiamond: GeniusDiamond;
            let diamondAddress: string;

            let ethersMultichain: typeof ethers;
            let snapshotId: string;

            before(async function () {
                // 13-04: deploy GNUSLifecyclePolicy library + install factory linker before deploy.
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
                creator = signers[1].address;
                buyer = signers[2].address;
                companyAdmin = signers[3].address;
                deviceWallet = signers[4].address;
                outsider = signers[5].address;

                owner = diamond.getDeployedDiamondData().DeployerAddress || '';
                if (!owner) {
                    diamond.setSigner(signers[0]);
                    owner = signers[0].address;
                }
                const ownerSigner = await ethersMultichain.getSigner(owner);
                ownerDiamond = geniusDiamond.connect(ownerSigner);
                creatorDiamond = geniusDiamond.connect(signers[1]);
                buyerDiamond = geniusDiamond.connect(signers[2]);
                outsiderDiamond = geniusDiamond.connect(signers[5]);
                deviceWalletDiamond = geniusDiamond.connect(signers[4]);

                // Seed the provenance counter (Phase 9 D8) — guarded, shared-fixture pattern
                // (GNUSLifecycleAICredits.test.ts / GNUSBridgeEnhanced.test.ts).
                const treasurySlot = ethers.keccak256(ethers.toUtf8Bytes('gnus.ai.treasury.storage'));
                const initialized = await provider.send('eth_getStorageAt', [
                    diamondAddress,
                    ethers.toBeHex(BigInt(treasurySlot) + 1n, 32),
                ]);
                if (BigInt(initialized) === 0n) {
                    await geniusDiamond.GNUSTreasury_SetSeedSupply(0n);
                }
            });

            beforeEach(async function () {
                snapshotId = await provider.send('evm_snapshot', []);
                // D-12: creator role for the operator actor — granted INSIDE the per-test
                // snapshot so the shared diamond fixture is not contaminated for other suites
                // (a persistent grant flips Phase 13's non-creator / D-24 non-privileged tests).
                await ownerDiamond.grantRole(CREATOR_ROLE, creator);
            });

            afterEach(async () => {
                if (snapshotId) {
                    await provider.send('evm_revert', [snapshotId]);
                }
            });

            function creditSku() {
                return {
                    priceInMinions: CREDIT_PRICE,
                    creditAmount: CREDIT_AMOUNT,
                    duration: THIRTY_DAYS_SECONDS,
                    createsLicense: false,
                    renewsLicense: false,
                    active: true,
                    publicCreditAmount: 0n,
                };
            }

            function licenseSku() {
                return {
                    priceInMinions: LICENSE_PRICE,
                    creditAmount: 0n,
                    duration: THIRTY_DAYS_SECONDS,
                    createsLicense: true,
                    renewsLicense: false,
                    active: true,
                    publicCreditAmount: 0n,
                };
            }

            function renewalSku() {
                return {
                    priceInMinions: LICENSE_PRICE,
                    creditAmount: 0n,
                    duration: THIRTY_DAYS_SECONDS,
                    createsLicense: false,
                    renewsLicense: true,
                    active: true,
                    publicCreditAmount: 0n,
                };
            }

            /** Company credit token config: PerHolder + SOULBOUND + BURN (D-11 AI Credits shape, D-17). */
            function companyCreditsConfig() {
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

            /** Hybrid-scope shape (D-05): exchangeRate > 0 + REDEEM_TO_PARENT — redeemable config. */
            function hybridRedeemConfig() {
                return {
                    validFrom: 0n,
                    validUntil: 0n,
                    defaultDuration: THIRTY_DAYS_SECONDS,
                    expirationMode: 2, // PerHolder
                    transferPolicy: 1, // SOULBOUND (D-17 non-transferable PerHolder)
                    expirationDisposition: 4, // REDEEM_TO_PARENT
                    expirationRecipient: ethers.ZeroAddress,
                    credentialVerifier: ethers.ZeroAddress,
                };
            }

            /**
             * Full fixture: fund the buyer, configure the four SKUs, create a license under the
             * creator role, and create the company credit token as the license's first child.
             * Returns [licenseId, creditTokenId].
             */
            async function deployLicenseFixture(): Promise<[bigint, bigint]> {
                await ownerDiamond['mint(address,uint256)'](buyer, toWei('1000'));
                await creatorDiamond.configureSKU(SKU_ID_CREDIT, creditSku());
                await creatorDiamond.configureSKU(SKU_ID_LICENSE, licenseSku());
                await creatorDiamond.configureSKU(SKU_ID_RENEWAL, renewalSku());
                await creatorDiamond.configureSKU(SKU_ID_HYBRID_CREDIT, {
                    ...creditSku(),
                    creditAmount: HYBRID_CREDIT_AMOUNT,
                });

                const rootInfo = await geniusDiamond.getNFTInfo(GNUS_TOKEN_ID);
                const licenseChildIndex: bigint = rootInfo.childCurIndex;
                await creatorDiamond.createLicense(SKU_ID_LICENSE, {
                    name: 'Acme Private Network License',
                    symbol: 'ACME-LIC',
                    newuri: 'ipfs://acme/license',
                    companyAdmin,
                    privateNetworkId: PRIVATE_NETWORK_ID,
                    networkScope: NETWORK_SCOPE_PRIVATE_ONLY,
                    publicSettlementEnabled: true,
                });
                const licenseId = (GNUS_TOKEN_ID << 128n) | licenseChildIndex;

                // Company credits: first child of the license (D-02 grandchild, parent-creator auth).
                const licInfo = await geniusDiamond.getNFTInfo(licenseId);
                expect(licInfo.childCurIndex).to.eq(0n);
                await creatorDiamond.createNFTWithLifecycle(
                    licenseId,
                    'Acme AI Credits',
                    'ACME-CRED',
                    EXCHANGE_RATE_ONE,
                    SKU_MAX_SUPPLY,
                    'ipfs://acme/credits',
                    companyCreditsConfig(),
                );
                const creditTokenId = (licenseId << 128n) | 0n;
                return [licenseId, creditTokenId];
            }

            // ---------------- LIC-03: SKU registry ----------------

            it('LIC-03: non-privileged configureSKU reverts "Only creator or admin"', async function () {
                await expect(buyerDiamond.configureSKU(SKU_ID_CREDIT, creditSku()))
                    .to.be.revertedWith('Only creator or admin');
            });

            it('LIC-03: getSKU round-trips all eight D-04 fields (incl. gap-closure publicCreditAmount)', async function () {
                await creatorDiamond.configureSKU(SKU_ID_CREDIT, creditSku());
                const sku = await geniusDiamond.getSKU(SKU_ID_CREDIT);
                expect(sku.priceInMinions).to.eq(CREDIT_PRICE);
                expect(sku.creditAmount).to.eq(CREDIT_AMOUNT);
                expect(sku.duration).to.eq(THIRTY_DAYS_SECONDS);
                expect(sku.createsLicense).to.eq(false);
                expect(sku.renewsLicense).to.eq(false);
                expect(sku.active).to.eq(true);
                expect(sku.publicCreditAmount).to.eq(0n); // append-only zero default
            });

            it('LIC-03: setSKUActive(false) then purchase reverts "SKU inactive"', async function () {
                const [, creditTokenId] = await deployLicenseFixture();
                await buyerDiamond.approve(diamondAddress, CREDIT_PRICE);
                await creatorDiamond.setSKUActive(SKU_ID_CREDIT, false);

                const supplyBefore = await geniusDiamond['totalSupply()']();
                await expect(
                    buyerDiamond.purchaseCredits(SKU_ID_CREDIT, creditTokenId >> 128n, deviceWallet),
                ).to.be.revertedWith('SKU inactive');
                expect(await geniusDiamond['totalSupply()']()).to.eq(supplyBefore);
            });

            // ---------------- LIC-04: purchase burn rail (D-10) ----------------

            it('LIC-04: purchase burns EXACTLY priceInMinions and mints credits into the device wallet', async function () {
                const [licenseId, creditTokenId] = await deployLicenseFixture();
                await buyerDiamond.approve(diamondAddress, CREDIT_PRICE);

                const supplyBefore = await geniusDiamond['totalSupply()']();
                const buyerGnusBefore = await geniusDiamond['balanceOf(address,uint256)'](buyer, GNUS_TOKEN_ID);

                await buyerDiamond.purchaseCredits(SKU_ID_CREDIT, licenseId, deviceWallet);

                // D-10: totalSupply decreases by EXACTLY priceInMinions (burn, never custody).
                expect(await geniusDiamond['totalSupply()']()).to.eq(supplyBefore - CREDIT_PRICE);
                // Buyer paid the burned GNUS 1:1; the diamond holds nothing.
                expect(await geniusDiamond['balanceOf(address,uint256)'](buyer, GNUS_TOKEN_ID)).to.eq(
                    buyerGnusBefore - CREDIT_PRICE,
                );
                expect(await geniusDiamond['balanceOf(address,uint256)'](diamondAddress, GNUS_TOKEN_ID)).to.eq(0n);
                // Device wallet (D-19) received the credits and a fresh PerHolder clock.
                expect(await geniusDiamond['balanceOf(address,uint256)'](deviceWallet, creditTokenId)).to.eq(
                    CREDIT_AMOUNT,
                );
                const now = BigInt(await time.latest());
                expect(await geniusDiamond.holderExpiresAt(creditTokenId, deviceWallet)).to.eq(
                    now + THIRTY_DAYS_SECONDS,
                );
            });

            it('LIC-04: insufficient-allowance purchase reverts with no mint and totalSupply unchanged', async function () {
                const [licenseId, creditTokenId] = await deployLicenseFixture();
                // No approval (allowance 0).
                const supplyBefore = await geniusDiamond['totalSupply()']();
                await expect(
                    buyerDiamond.purchaseCredits(SKU_ID_CREDIT, licenseId, deviceWallet),
                ).to.be.revertedWith('ERC20: insufficient allowance');
                expect(await geniusDiamond['totalSupply()']()).to.eq(supplyBefore);
                expect(await geniusDiamond['balanceOf(address,uint256)'](deviceWallet, creditTokenId)).to.eq(0n);
            });

            it('LIC-04: top-up stacks the per-holder clock (D3 — renewal free, Pitfall 6)', async function () {
                const [licenseId, creditTokenId] = await deployLicenseFixture();
                await buyerDiamond.approve(diamondAddress, CREDIT_PRICE * 2n);
                await buyerDiamond.purchaseCredits(SKU_ID_CREDIT, licenseId, deviceWallet);
                const firstExpiry = await geniusDiamond.holderExpiresAt(creditTokenId, deviceWallet);

                await time.increase(Number(THIRTY_DAYS_SECONDS / 2n)); // still active
                await buyerDiamond.purchaseCredits(SKU_ID_CREDIT, licenseId, deviceWallet);

                expect(await geniusDiamond['balanceOf(address,uint256)'](deviceWallet, creditTokenId)).to.eq(
                    CREDIT_AMOUNT * 2n,
                );
                expect(await geniusDiamond.holderExpiresAt(creditTokenId, deviceWallet)).to.eq(
                    firstExpiry + THIRTY_DAYS_SECONDS,
                );
            });

            it('LIC-04 (WR-01): purchase under an EXPIRED license reverts "License expired"', async function () {
                const [licenseId, creditTokenId] = await deployLicenseFixture();
                const licenseUntil = (await geniusDiamond.getNFTInfo(licenseId)).validUntil;
                await time.setNextBlockTimestamp(Number(licenseUntil + EXPIRY_GRACE_SECONDS));

                await buyerDiamond.approve(diamondAddress, CREDIT_PRICE);
                const supplyBefore = await geniusDiamond['totalSupply()']();
                await expect(
                    buyerDiamond.purchaseCredits(SKU_ID_CREDIT, licenseId, deviceWallet),
                ).to.be.revertedWith('License expired');
                expect(await geniusDiamond['totalSupply()']()).to.eq(supplyBefore);
                expect(await geniusDiamond['balanceOf(address,uint256)'](deviceWallet, creditTokenId)).to.eq(0n);
            });

            // ---------------- LIC-01: hierarchy (D-02) ----------------

            it('LIC-01: license is a direct child of the product root; non-creator createLicense reverts', async function () {
                await creatorDiamond.configureSKU(SKU_ID_LICENSE, licenseSku());
                const rootInfo = await geniusDiamond.getNFTInfo(GNUS_TOKEN_ID);
                const childIndex: bigint = rootInfo.childCurIndex;
                const tx = await creatorDiamond.createLicense(SKU_ID_LICENSE, {
                    name: 'Lic',
                    symbol: 'LIC',
                    newuri: 'ipfs://lic',
                    companyAdmin,
                    privateNetworkId: PRIVATE_NETWORK_ID,
                    networkScope: NETWORK_SCOPE_PRIVATE_ONLY,
                    publicSettlementEnabled: false,
                });
                const rc = await tx.wait();
                const licenseId = (GNUS_TOKEN_ID << 128n) | childIndex;

                const info = await geniusDiamond.getNFTInfo(licenseId);
                expect(info.parentId).to.eq(GNUS_TOKEN_ID); // direct child of the product root
                expect(info.nftCreated).to.eq(true);
                expect(info.companyAdmin).to.eq(companyAdmin); // D-25
                expect(info.privateNetworkId).to.eq(PRIVATE_NETWORK_ID);
                expect(info.networkScope).to.eq(BigInt(NETWORK_SCOPE_PRIVATE_ONLY));
                expect(info.publicSettlementEnabled).to.eq(false); // D-08 informational

                // D-12: non-privileged caller cannot create licenses.
                await expect(
                    buyerDiamond.createLicense(SKU_ID_LICENSE, {
                        name: 'Rogue',
                        symbol: 'ROGUE',
                        newuri: 'ipfs://rogue',
                        companyAdmin: buyer,
                        privateNetworkId: 1n,
                        networkScope: 0,
                        publicSettlementEnabled: false,
                    }),
                ).to.be.revertedWith('Only Creators or Admins can create NFT child of GNUS');
            });

            it('LIC-01: company credits are license children; grandchild creation is parent-creator only', async function () {
                const [licenseId, creditTokenId] = await deployLicenseFixture();

                const info = await geniusDiamond.getNFTInfo(creditTokenId);
                expect(info.parentId).to.eq(licenseId); // grandchild of the product root (D-02)
                expect((creditTokenId >> 128n)).to.eq(licenseId);

                // Grandchild auth (GNUSLifecycle.sol:351-353): only the parent (license) creator.
                await expect(
                    buyerDiamond.createNFTWithLifecycle(
                        licenseId,
                        'Rogue Credits',
                        'ROGUE',
                        EXCHANGE_RATE_ONE,
                        SKU_MAX_SUPPLY,
                        'ipfs://rogue',
                        companyCreditsConfig(),
                    ),
                ).to.be.revertedWith('Only parent creator can create child NFTs');
            });

            it('LIC-01: individual AI Credits remain DIRECT product-root children (Phase 13 D11 unamended)', async function () {
                const rootInfo = await geniusDiamond.getNFTInfo(GNUS_TOKEN_ID);
                const childIndex: bigint = rootInfo.childCurIndex;
                await creatorDiamond.createNFTWithLifecycle(
                    GNUS_TOKEN_ID,
                    'AI Credits (Individual)',
                    'AICREDIT-I',
                    EXCHANGE_RATE_ONE,
                    SKU_MAX_SUPPLY,
                    'ipfs://ai-credits/individual',
                    companyCreditsConfig(),
                );
                const individualId = (GNUS_TOKEN_ID << 128n) | childIndex;
                const info = await geniusDiamond.getNFTInfo(individualId);
                expect(info.parentId).to.eq(GNUS_TOKEN_ID);
                expect(individualId >> 128n).to.eq(GNUS_TOKEN_ID);
            });

            // ---------------- LIC-05: activation events + renewal ----------------

            it('LIC-05: createLicense emits LicenseActivated with (companyAdmin, licenseId, privateNetworkId, expiresAt==validUntil)', async function () {
                await creatorDiamond.configureSKU(SKU_ID_LICENSE, licenseSku());
                const rootInfo = await geniusDiamond.getNFTInfo(GNUS_TOKEN_ID);
                const childIndex: bigint = rootInfo.childCurIndex;
                const licenseId = (GNUS_TOKEN_ID << 128n) | childIndex;

                const tx = await creatorDiamond.createLicense(SKU_ID_LICENSE, {
                    name: 'Lic',
                    symbol: 'LIC',
                    newuri: 'ipfs://lic',
                    companyAdmin,
                    privateNetworkId: PRIVATE_NETWORK_ID,
                    networkScope: NETWORK_SCOPE_PRIVATE_ONLY,
                    publicSettlementEnabled: true,
                });
                await tx.wait();

                const info = await geniusDiamond.getNFTInfo(licenseId);
                await expect(tx)
                    .to.emit(geniusDiamond, 'LicenseActivated')
                    .withArgs(companyAdmin, licenseId, PRIVATE_NETWORK_ID, info.validUntil);
                // PerTokenId license clock (D-12): validUntil = now + duration.
                const now = BigInt(await time.latest());
                expect(info.validUntil).to.eq(now + THIRTY_DAYS_SECONDS);
                expect(info.expirationMode).to.eq(1n); // PerTokenId
            });

            it('LIC-05: renewLicense stacks validUntil to max(current, now)+duration and re-emits LicenseActivated', async function () {
                const [licenseId] = await deployLicenseFixture();
                const createdUntil = (await geniusDiamond.getNFTInfo(licenseId)).validUntil;

                // Unexpired renewal: stacks from the CURRENT expiry (T-14-03-02).
                await buyerDiamond.approve(diamondAddress, LICENSE_PRICE);
                const halfway = createdUntil - THIRTY_DAYS_SECONDS / 2n;
                await time.setNextBlockTimestamp(Number(halfway));
                const tx = await buyerDiamond.renewLicense(SKU_ID_RENEWAL, licenseId);

                expect((await geniusDiamond.getNFTInfo(licenseId)).validUntil).to.eq(
                    createdUntil + THIRTY_DAYS_SECONDS,
                );
                await expect(tx)
                    .to.emit(geniusDiamond, 'LicenseActivated')
                    .withArgs(companyAdmin, licenseId, PRIVATE_NETWORK_ID, createdUntil + THIRTY_DAYS_SECONDS);

                // Renewal payment is burned too (D-10).
                // (allowance was exactly one price — a second renewal needs a fresh approval)
                await buyerDiamond.approve(diamondAddress, LICENSE_PRICE);
                // Expired renewal: fresh clock from NOW (the pinned next-block timestamp),
                // never retroactive.
                const lateRenewalTs = createdUntil + THIRTY_DAYS_SECONDS + EXPIRY_GRACE_SECONDS;
                await time.setNextBlockTimestamp(Number(lateRenewalTs));
                await buyerDiamond.renewLicense(SKU_ID_RENEWAL, licenseId);
                expect((await geniusDiamond.getNFTInfo(licenseId)).validUntil).to.eq(
                    lateRenewalTs + THIRTY_DAYS_SECONDS,
                );
            });

            it('LIC-05: a credit SKU cannot renew (type gate); payment burn is the renew rail', async function () {
                const [licenseId] = await deployLicenseFixture();
                await buyerDiamond.approve(diamondAddress, LICENSE_PRICE);
                // SKU_ID_CREDIT is a credit SKU — cannot drive renewals.
                await expect(buyerDiamond.renewLicense(SKU_ID_CREDIT, licenseId)).to.be.revertedWith(
                    'SKU does not renew licenses',
                );
            });

            it('LIC-05 (CR-01): renewal of a NON-license token reverts "Not a license token"', async function () {
                const [, creditTokenId] = await deployLicenseFixture();
                await buyerDiamond.approve(diamondAddress, LICENSE_PRICE);
                // A created but non-license NFT (the company credit token) — forged
                // validUntil extension / LicenseActivated path must be closed.
                await expect(buyerDiamond.renewLicense(SKU_ID_RENEWAL, creditTokenId)).to.be.revertedWith(
                    'Not a license token',
                );
                // The product root itself is not a license either.
                await expect(buyerDiamond.renewLicense(SKU_ID_RENEWAL, GNUS_TOKEN_ID)).to.be.revertedWith(
                    'Not a license token',
                );
                // No burn happened.
                const supplyBefore = await geniusDiamond['totalSupply()']();
                expect(await geniusDiamond['totalSupply()']()).to.eq(supplyBefore);
            });

            it('LIC-05 (PR-78 P1): credits purchase under a NON-license token reverts "Not a license token"', async function () {
                const [, creditTokenId] = await deployLicenseFixture();
                await buyerDiamond.approve(diamondAddress, CREDIT_PRICE);
                // A created but non-license NFT (the company credit token) — must not be
                // usable as a mint target for a global credit SKU (topping up unrelated,
                // potentially redeemable, child tokens).
                await expect(buyerDiamond.purchaseCredits(SKU_ID_CREDIT, creditTokenId, deviceWallet)).to.be.revertedWith(
                    'Not a license token',
                );
                // The product root itself is not a license either.
                await expect(buyerDiamond.purchaseCredits(SKU_ID_CREDIT, GNUS_TOKEN_ID, deviceWallet)).to.be.revertedWith(
                    'Not a license token',
                );
                // No burn happened.
                const supplyBefore = await geniusDiamond['totalSupply()']();
                expect(await geniusDiamond['totalSupply()']()).to.eq(supplyBefore);
            });

            it('LIC-03 (sku0 sentinel): createLicense under SKU id 0 reverts "SKU id zero is reserved"', async function () {
                await creatorDiamond.configureSKU(0n, licenseSku());
                const rootInfoBefore = await geniusDiamond.getNFTInfo(GNUS_TOKEN_ID);
                // SKU id 0 writing into licenseSku would collide with the not-a-license
                // sentinel read by renewLicense/purchaseCredits (bricked license).
                await expect(
                    creatorDiamond.createLicense(0n, {
                        name: 'Sentinel Collision License',
                        symbol: 'SENT-LIC',
                        newuri: 'ipfs://sentinel/license',
                        companyAdmin,
                        privateNetworkId: PRIVATE_NETWORK_ID + 1n, // uniqueness registry
                        networkScope: NETWORK_SCOPE_PRIVATE_ONLY,
                        publicSettlementEnabled: false,
                    }),
                ).to.be.revertedWith('SKU id zero is reserved');
                // No NFT was created.
                const rootInfoAfter = await geniusDiamond.getNFTInfo(GNUS_TOKEN_ID);
                expect(rootInfoAfter.childCurIndex).to.eq(rootInfoBefore.childCurIndex);
            });

            // ---------------- LIC-06: hybrid redeemability (config only, D-05/D-28) ----------------

            it('LIC-06: exchangeRate>0 + REDEEM_TO_PARENT token redeems via the existing Phase 13 settle path', async function () {
                // Hybrid-shape company credit token (redeemable config, D-05): created as the
                // license's first child by the license creator.
                await ownerDiamond['mint(address,uint256)'](buyer, toWei('1000'));
                await creatorDiamond.configureSKU(SKU_ID_LICENSE, licenseSku());
                await creatorDiamond.configureSKU(SKU_ID_HYBRID_CREDIT, {
                    priceInMinions: CREDIT_PRICE,
                    creditAmount: HYBRID_CREDIT_AMOUNT,
                    duration: THIRTY_DAYS_SECONDS,
                    createsLicense: false,
                    renewsLicense: false,
                    active: true,
                    publicCreditAmount: 0n,
                });
                const rootInfo = await geniusDiamond.getNFTInfo(GNUS_TOKEN_ID);
                const licenseChildIndex: bigint = rootInfo.childCurIndex;
                await creatorDiamond.createLicense(SKU_ID_LICENSE, {
                    name: 'Hybrid Lic',
                    symbol: 'HYB-LIC',
                    newuri: 'ipfs://hyb',
                    companyAdmin,
                    privateNetworkId: PRIVATE_NETWORK_ID,
                    networkScope: NETWORK_SCOPE_HYBRID,
                    publicSettlementEnabled: true,
                });
                const licenseId = (GNUS_TOKEN_ID << 128n) | licenseChildIndex;
                await creatorDiamond.createNFTWithLifecycle(
                    licenseId,
                    'Hybrid Credits',
                    'HYB-CRED',
                    EXCHANGE_RATE_ONE,
                    SKU_MAX_SUPPLY,
                    'ipfs://hyb/credits',
                    hybridRedeemConfig(),
                );
                const hybridId = (licenseId << 128n) | 0n;

                // Permissionless purchase mints hybrid credits to the device wallet (D-27/D-19).
                await buyerDiamond.approve(diamondAddress, CREDIT_PRICE);
                await buyerDiamond.purchaseCredits(SKU_ID_HYBRID_CREDIT, licenseId, deviceWallet);
                expect(await geniusDiamond['balanceOf(address,uint256)'](deviceWallet, hybridId)).to.eq(HYBRID_CREDIT_AMOUNT);

                // Warp past the per-holder clock; permissionless settle redeems to the PARENT
                // (the license token) via the existing Phase 13 path — no new mechanism (D-28).
                const expiry = await geniusDiamond.holderExpiresAt(hybridId, deviceWallet);
                await time.setNextBlockTimestamp(Number(expiry + EXPIRY_GRACE_SECONDS));
                await expect(outsiderDiamond.settleExpired(deviceWallet, hybridId))
                    .to.emit(geniusDiamond, 'Settled')
                    .withArgs(deviceWallet, hybridId, HYBRID_CREDIT_AMOUNT, 4n, deviceWallet);
                expect(await geniusDiamond['balanceOf(address,uint256)'](deviceWallet, hybridId)).to.eq(0n);
                expect(await geniusDiamond['balanceOf(address,uint256)'](deviceWallet, licenseId)).to.eq(HYBRID_CREDIT_AMOUNT);
            });

            it('LIC-06: burn-only SOULBOUND credits are NOT redeemable — convert reverts, settle yields ZERO GNUS (SC7)', async function () {
                const [licenseId, creditTokenId] = await deployLicenseFixture();
                await buyerDiamond.approve(diamondAddress, CREDIT_PRICE);
                await buyerDiamond.purchaseCredits(SKU_ID_CREDIT, licenseId, deviceWallet);

                // Structural non-redeemability: BURN disposition → nonConvertible (D11).
                const info = await geniusDiamond.getNFTInfo(creditTokenId);
                expect(info.nonConvertible).to.eq(true);
                await expect(
                    deviceWalletDiamond.convert(creditTokenId, licenseIdOf(creditTokenId), 1n, deviceWallet),
                ).to.be.revertedWith('Token is non-convertible');

                // Expiry settle: zero GNUS anywhere (Phase 13 SC7 invariant).
                const gnusSupply = await geniusDiamond['totalSupply()']();
                const expiry = await geniusDiamond.holderExpiresAt(creditTokenId, deviceWallet);
                await time.setNextBlockTimestamp(Number(expiry + EXPIRY_GRACE_SECONDS));
                await outsiderDiamond.settleExpired(deviceWallet, creditTokenId);
                expect(await geniusDiamond['totalSupply()']()).to.eq(gnusSupply); // zero GNUS delta
                expect(await geniusDiamond['balanceOf(address,uint256)'](deviceWallet, creditTokenId)).to.eq(0n);
            });

            /** Derive the parent (license) id of a grandchild credit token id. */
            function licenseIdOf(creditTokenId: bigint): bigint {
                return creditTokenId >> 128n;
            }

            // ---------------- Phase 14 gap-closure: network-key mint validation ----------------

            /**
             * Slot-math sanity check: read the fixture license's companyAdmin (slot +11) via
             * eth_getStorageAt and assert it equals the padded address BEFORE trusting any
             * poison write through nftSlot() (GNUSLifecycleUpgrade.test.ts pattern).
             */
            async function assertSlotMath(licenseId: bigint) {
                const raw = await provider.send('eth_getStorageAt', [diamondAddress, nftSlot(licenseId, 11n)]);
                expect(ethers.getAddress('0x' + raw.slice(26))).to.eq(companyAdmin);
            }

            /** Poison a token's privateNetworkId (slot +12) with the given value. */
            async function poisonNetworkId(tokenId: bigint, value: bigint) {
                await provider.send('hardhat_setStorageAt', [
                    diamondAddress,
                    nftSlot(tokenId, 12n),
                    ethers.toBeHex(value, 32),
                ]);
                const readBack = await provider.send('eth_getStorageAt', [diamondAddress, nftSlot(tokenId, 12n)]);
                expect(BigInt(readBack)).to.eq(value); // confirm the write landed
            }

            /** Create the license's SECOND child (public credits token) and return its id. */
            async function createPublicCreditToken(licenseId: bigint): Promise<bigint> {
                await creatorDiamond.createNFTWithLifecycle(
                    licenseId,
                    'Acme Public Credits',
                    'ACME-PUB',
                    EXCHANGE_RATE_ONE,
                    SKU_MAX_SUPPLY,
                    'ipfs://acme/public-credits',
                    companyCreditsConfig(),
                );
                return (licenseId << 128n) | PUBLIC_CHILD_INDEX;
            }

            it('gap-closure: createLicense reverts on privateNetworkId == 0', async function () {
                await creatorDiamond.configureSKU(SKU_ID_LICENSE, licenseSku());
                await expect(
                    creatorDiamond.createLicense(SKU_ID_LICENSE, {
                        name: 'ZeroNet',
                        symbol: 'ZERO',
                        newuri: 'ipfs://zero',
                        companyAdmin,
                        privateNetworkId: 0n,
                        networkScope: NETWORK_SCOPE_PRIVATE_ONLY,
                        publicSettlementEnabled: false,
                    }),
                ).to.be.revertedWith('Private network id required');
            });

            it('gap-closure: a network id can be claimed by exactly ONE license', async function () {
                const [licenseId] = await deployLicenseFixture();
                expect(licenseId).to.not.eq(0n); // fixture sanity

                // Duplicate claim of PRIVATE_NETWORK_ID reverts.
                await expect(
                    creatorDiamond.createLicense(SKU_ID_LICENSE, {
                        name: 'Dup Lic',
                        symbol: 'DUP',
                        newuri: 'ipfs://dup',
                        companyAdmin,
                        privateNetworkId: PRIVATE_NETWORK_ID,
                        networkScope: NETWORK_SCOPE_PRIVATE_ONLY,
                        publicSettlementEnabled: false,
                    }),
                ).to.be.revertedWith('Network id already licensed');

                // A DIFFERENT network id succeeds.
                const rootInfo = await geniusDiamond.getNFTInfo(GNUS_TOKEN_ID);
                const childIndex: bigint = rootInfo.childCurIndex;
                await creatorDiamond.createLicense(SKU_ID_LICENSE, {
                    name: 'Other Lic',
                    symbol: 'OTHER',
                    newuri: 'ipfs://other',
                    companyAdmin,
                    privateNetworkId: PRIVATE_NETWORK_ID + 1n,
                    networkScope: NETWORK_SCOPE_PRIVATE_ONLY,
                    publicSettlementEnabled: false,
                });
                const otherId = (GNUS_TOKEN_ID << 128n) | childIndex;
                expect((await geniusDiamond.getNFTInfo(otherId)).privateNetworkId).to.eq(PRIVATE_NETWORK_ID + 1n);
            });

            it('gap-closure: purchase lazily propagates the license privateNetworkId onto the credit token', async function () {
                const [licenseId, creditTokenId] = await deployLicenseFixture();
                // Fixture credit token starts at the zero default.
                expect((await geniusDiamond.getNFTInfo(creditTokenId)).privateNetworkId).to.eq(0n);

                await buyerDiamond.approve(diamondAddress, CREDIT_PRICE);
                await buyerDiamond.purchaseCredits(SKU_ID_CREDIT, licenseId, deviceWallet);

                expect((await geniusDiamond.getNFTInfo(creditTokenId)).privateNetworkId).to.eq(PRIVATE_NETWORK_ID);
                // IN-02: the license's networkScope propagates alongside the network id.
                expect((await geniusDiamond.getNFTInfo(creditTokenId)).networkScope).to.eq(
                    BigInt(NETWORK_SCOPE_PRIVATE_ONLY),
                );
            });

            it('gap-closure: a credit token with a mismatched network id reverts the purchase', async function () {
                const [licenseId, creditTokenId] = await deployLicenseFixture();
                await assertSlotMath(licenseId); // trust gate for the poison write
                await poisonNetworkId(creditTokenId, ROGUE_NETWORK_ID);

                await buyerDiamond.approve(diamondAddress, CREDIT_PRICE);
                const supplyBefore = await geniusDiamond['totalSupply()']();
                await expect(
                    buyerDiamond.purchaseCredits(SKU_ID_CREDIT, licenseId, deviceWallet),
                ).to.be.revertedWith('Credit network mismatch');
                expect(await geniusDiamond['totalSupply()']()).to.eq(supplyBefore);
                expect(await geniusDiamond['balanceOf(address,uint256)'](deviceWallet, creditTokenId)).to.eq(0n);
            });

            it('gap-closure: split-mint SKU mints BOTH legs in one transaction with ONE price burn', async function () {
                const [licenseId, creditTokenId] = await deployLicenseFixture();
                const publicTokenId = await createPublicCreditToken(licenseId);
                await creatorDiamond.configureSKU(SKU_ID_SPLIT, {
                    priceInMinions: CREDIT_PRICE,
                    creditAmount: PRIVATE_LEG,
                    duration: THIRTY_DAYS_SECONDS,
                    createsLicense: false,
                    renewsLicense: false,
                    active: true,
                    publicCreditAmount: PUBLIC_LEG,
                });

                await buyerDiamond.approve(diamondAddress, CREDIT_PRICE);
                const supplyBefore = await geniusDiamond['totalSupply()']();
                await buyerDiamond.purchaseCredits(SKU_ID_SPLIT, licenseId, deviceWallet);

                expect(await geniusDiamond['balanceOf(address,uint256)'](deviceWallet, creditTokenId)).to.eq(PRIVATE_LEG);
                expect(await geniusDiamond['balanceOf(address,uint256)'](deviceWallet, publicTokenId)).to.eq(PUBLIC_LEG);
                // D-10 exact-delta: totalSupply delta == price regardless of the leg split.
                expect(await geniusDiamond['totalSupply()']()).to.eq(supplyBefore - CREDIT_PRICE);
                // The public leg NEVER carries a network key.
                expect((await geniusDiamond.getNFTInfo(publicTokenId)).privateNetworkId).to.eq(0n);
            });

            it('gap-closure: a poisoned public-leg token (nonzero network id) reverts the split purchase', async function () {
                const [licenseId] = await deployLicenseFixture();
                const publicTokenId = await createPublicCreditToken(licenseId);
                await assertSlotMath(licenseId); // trust gate for the poison write
                await poisonNetworkId(publicTokenId, ROGUE_NETWORK_ID);
                await creatorDiamond.configureSKU(SKU_ID_SPLIT, {
                    priceInMinions: CREDIT_PRICE,
                    creditAmount: PRIVATE_LEG,
                    duration: THIRTY_DAYS_SECONDS,
                    createsLicense: false,
                    renewsLicense: false,
                    active: true,
                    publicCreditAmount: PUBLIC_LEG,
                });

                await buyerDiamond.approve(diamondAddress, CREDIT_PRICE);
                const supplyBefore = await geniusDiamond['totalSupply()']();
                await expect(
                    buyerDiamond.purchaseCredits(SKU_ID_SPLIT, licenseId, deviceWallet),
                ).to.be.revertedWith('Public credit network mismatch');
                expect(await geniusDiamond['totalSupply()']()).to.eq(supplyBefore);
            });

            it('gap-closure: public-only SKU mints ONLY the public leg; private clock untouched', async function () {
                const [licenseId, creditTokenId] = await deployLicenseFixture();
                const publicTokenId = await createPublicCreditToken(licenseId);
                await creatorDiamond.configureSKU(SKU_ID_PUBLIC_ONLY, {
                    priceInMinions: CREDIT_PRICE,
                    creditAmount: 0n,
                    duration: THIRTY_DAYS_SECONDS,
                    createsLicense: false,
                    renewsLicense: false,
                    active: true,
                    publicCreditAmount: CREDIT_AMOUNT,
                });

                await buyerDiamond.approve(diamondAddress, CREDIT_PRICE);
                await buyerDiamond.purchaseCredits(SKU_ID_PUBLIC_ONLY, licenseId, deviceWallet);

                expect(await geniusDiamond['balanceOf(address,uint256)'](deviceWallet, creditTokenId)).to.eq(0n);
                expect(await geniusDiamond['balanceOf(address,uint256)'](deviceWallet, publicTokenId)).to.eq(CREDIT_AMOUNT);
                // Zero-amount private leg: no renewal clock started on the private token.
                expect(await geniusDiamond.holderExpiresAt(creditTokenId, deviceWallet)).to.eq(0n);
                // But the public token's own clock runs.
                const now = BigInt(await time.latest());
                expect(await geniusDiamond.holderExpiresAt(publicTokenId, deviceWallet)).to.eq(
                    now + THIRTY_DAYS_SECONDS,
                );
            });

            it('gap-closure (WR-03): public-only SKU purchases without the private child token existing', async function () {
                const [licenseId, creditTokenId] = await deployLicenseFixture();
                const publicTokenId = await createPublicCreditToken(licenseId);
                // Erase the private first-child record (slot +6 packs childCurIndex bytes 0-15
                // + nftCreated byte 16 — the token has no children, so the created flag is the
                // only set bit). Poisons exactly the WR-03 "private token missing" scenario.
                await assertSlotMath(licenseId); // trust gate for the storage write
                await provider.send('hardhat_setStorageAt', [diamondAddress, nftSlot(creditTokenId, 6n), ethers.ZeroHash]);
                // (getNFTInfo reverts on un-created ids — the successful public-only purchase
                // below is itself the proof the flag read back false.)

                await creatorDiamond.configureSKU(SKU_ID_PUBLIC_ONLY, {
                    priceInMinions: CREDIT_PRICE,
                    creditAmount: 0n,
                    duration: THIRTY_DAYS_SECONDS,
                    createsLicense: false,
                    renewsLicense: false,
                    active: true,
                    publicCreditAmount: CREDIT_AMOUNT,
                });

                await buyerDiamond.approve(diamondAddress, CREDIT_PRICE);
                await buyerDiamond.purchaseCredits(SKU_ID_PUBLIC_ONLY, licenseId, deviceWallet);
                expect(await geniusDiamond['balanceOf(address,uint256)'](deviceWallet, publicTokenId)).to.eq(
                    CREDIT_AMOUNT,
                );
            });

            it('gap-closure: a credit SKU mints no legs reverts at configureSKU time', async function () {
                await expect(
                    creatorDiamond.configureSKU(SKU_ID_SPLIT, {
                        priceInMinions: CREDIT_PRICE,
                        creditAmount: 0n,
                        duration: THIRTY_DAYS_SECONDS,
                        createsLicense: false,
                        renewsLicense: false,
                        active: true,
                        publicCreditAmount: 0n,
                    }),
                ).to.be.revertedWith('SKU mints no credits');
                // License/renewal SKUs are unaffected by the new gate (zero credit fields legal).
                await creatorDiamond.configureSKU(SKU_ID_LICENSE, licenseSku());
                await creatorDiamond.configureSKU(SKU_ID_RENEWAL, renewalSku());
            });
        });
    }
});
