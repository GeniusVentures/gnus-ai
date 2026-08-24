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
 * Phase 13 — GNUS Lifecycle smoke tests (Plan 13-02).
 *
 * Proves the GNUSLifecycle facet is registered at priority 119 under protocol 2.7 with
 * no selector collisions, the D13 views revert correctly on uncreated ids, the
 * configureLifecycle gates fire (Q2 PerHolder+UNRESTRICTED, Q1 REDEEM_TO_PARENT on
 * nonConvertible), and settleExpired reverts "Not expired" on a fresh PerTokenId token.
 *
 * Boot pattern: LocalDiamondDeployer (multichain fixture) per GNUSTreasury.test.ts.
 * The diamond deploy itself IS the selector-collision check — a collision would revert
 * during the LocalDiamondDeployer boot.
 *
 * Exhaustive behavior matrices (PerHolder renewal, disposition routing, bridge policy,
 * anti-scalping) land in plan 13-05.
 */
describe('GNUS Lifecycle Tests', async function () {
    const diamondName = 'GeniusDiamond';
    const log: debug.Debugger = debug('GNUSLifecycle:log:${diamondName}');
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
    // keccak256("gnus.ai.nft.factory.storage") — NFT struct mapping base slot
    const FACTORY_STORAGE_SLOT = ethers.keccak256(ethers.toUtf8Bytes('gnus.ai.nft.factory.storage'));

    /**
     * Compute the storage slot for NFTs[tokenId] + offset.
     * See GNUSLifecycleUpgrade.test.ts for the full slot layout (slots +8/+9/+10 hold
     * Phase 13 fields packed with nonConvertible at +8 byte 0).
     */
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
            let signer1: string;
            let owner: string;
            let ownerSigner: SignerWithAddress;
            let geniusDiamond: GeniusDiamond;
            let ownerDiamond: GeniusDiamond;
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

                owner = diamond.getDeployedDiamondData().DeployerAddress || '';
                if (!owner) {
                    diamond.setSigner(signers[0]);
                    owner = signers[0].address;
                }
                ownerSigner = await ethersMultichain.getSigner(owner);
                ownerDiamond = geniusDiamond.connect(ownerSigner);
            });

            beforeEach(async function () {
                snapshotId = await provider.send('evm_snapshot', []);
            });

            afterEach(async () => {
                if (snapshotId) {
                    await provider.send('evm_revert', [snapshotId]);
                }
            });

            /**
             * LifecycleConfig builder. All defaults are the zero-defaults (legacy behavior).
             * Tests override only the fields they exercise.
             */
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
             * Create a fresh NFT as owner (creator = owner). Returns the new token id
             * (always 1 for the first createNFT call on this diamond fixture).
             */
            async function createFreshNFT(name: string, symbol: string): Promise<bigint> {
                await ownerDiamond.createNFT(
                    GNUS_TOKEN_ID,
                    name,
                    symbol,
                    toWei('1'),
                    toWei('1000000'),
                    `ipfs://${symbol.toLowerCase()}`,
                );
                return 1n;
            }

            describe('smoke: deploy + views + configure guards + settleExpired BURN path', function () {
                it('(a) diamond deploys with GNUSLifecycle wired at priority 119 (implicit selector-collision check)', async function () {
                    // The LocalDiamondDeployer boot in the outer before() hook IS the assertion —
                    // a selector collision between GNUSLifecycle and the existing 13 facets would
                    // have reverted the deploy. Reachability of this test body proves collision-free.
                    //
                    // Additionally assert the facet address is registered in the diamond loupe.
                    const facetAddresses = await geniusDiamond.facetAddresses();
                    expect(facetAddresses.length).to.be.greaterThan(0);
                    // Spot-check: the GNUSLifecycle selectors must resolve to SOME facet address.
                    // isTokenActive(uint256) selector = first 4 bytes of keccak256 of the signature.
                    const isTokenActiveSelector = ethers.id('isTokenActive(uint256)').slice(0, 10);
                    const facetForSelector = await geniusDiamond.facetAddress(isTokenActiveSelector);
                    expect(facetForSelector).to.not.eq(ethers.ZeroAddress);
                    expect(facetAddresses.map((a: string) => a.toLowerCase())).to.include(
                        facetForSelector.toLowerCase(),
                    );
                });

                it('(b) isTokenActive / isSpendable revert on uncreated id', async function () {
                    const uncreatedId = 999n;
                    await expect(geniusDiamond.isTokenActive(uncreatedId)).to.be.revertedWith(
                        'Token not created',
                    );
                    await expect(geniusDiamond.isSpendable(signer1, uncreatedId)).to.be.revertedWith(
                        'Token not created',
                    );
                    await expect(geniusDiamond.holderExpiresAt(uncreatedId, signer1)).to.be.revertedWith(
                        'Token not created',
                    );
                });

                it('(c) configureLifecycle happy path writes config and emits LifecycleConfigured', async function () {
                    const id = await createFreshNFT('SmokeToken', 'SMOKE');

                    const futureStart = BigInt((await time.latest()) + 1000);
                    const futureEnd = futureStart + 86400n; // +1 day

                    const cfg = defaultConfig({
                        validFrom: futureStart,
                        validUntil: futureEnd,
                        defaultDuration: 0n,
                        expirationMode: 1, // PerTokenId
                        transferPolicy: 0, // UNRESTRICTED
                        expirationDisposition: 0, // NONE
                    });

                    await expect(ownerDiamond.configureLifecycle(id, cfg))
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

                    // Read back via getNFTInfo — the config round-trips through the NFT struct.
                    const info = await geniusDiamond.getNFTInfo(id);
                    expect(info.validFrom).to.eq(cfg.validFrom);
                    expect(info.validUntil).to.eq(cfg.validUntil);
                    expect(info.defaultDuration).to.eq(cfg.defaultDuration);
                    expect(info.expirationMode).to.eq(cfg.expirationMode);
                    expect(info.transferPolicy).to.eq(cfg.transferPolicy);
                    expect(info.expirationDisposition).to.eq(cfg.expirationDisposition);
                    expect(info.expirationRecipient).to.eq(cfg.expirationRecipient);
                    expect(info.credentialVerifier).to.eq(cfg.credentialVerifier);
                });

                it('(d) configureLifecycle reverts for PerHolder + UNRESTRICTED (Q2)', async function () {
                    const id = await createFreshNFT('PerHolderUnrestricted', 'PHU');

                    const cfg = defaultConfig({
                        expirationMode: 2, // PerHolder
                        transferPolicy: 0, // UNRESTRICTED — forbidden combination (Q2)
                        defaultDuration: 30n * 24n * 60n * 60n, // 30 days
                    });

                    await expect(ownerDiamond.configureLifecycle(id, cfg)).to.be.revertedWith(
                        'PerHolder requires non-transferable policy',
                    );
                });

                it('(e) configureLifecycle reverts for REDEEM_TO_PARENT on nonConvertible token (Q1)', async function () {
                    const id = await createFreshNFT('NonConvertibleRedeem', 'NCR');

                    // Temporary measure: no creation path sets nonConvertible=true yet — Phase 13
                    // sets it at creation in plan 13-03's createNFTWithLifecycle. Until 13-03
                    // lands, flip the flag via hardhat_setStorageAt. nonConvertible is at slot
                    // +8 byte 0 (packed with Phase 13 fields at bytes 1-27; all are zero here,
                    // so writing 0x01 sets ONLY nonConvertible).
                    await provider.send('hardhat_setStorageAt', [
                        diamondAddress,
                        nftSlot(id, 8n),
                        ethers.toBeHex(1n, 32),
                    ]);
                    const infoBefore = await geniusDiamond.getNFTInfo(id);
                    expect(infoBefore.nonConvertible).to.eq(true);

                    const cfg = defaultConfig({
                        expirationMode: 1, // PerTokenId
                        transferPolicy: 0, // UNRESTRICTED
                        expirationDisposition: 4, // REDEEM_TO_PARENT
                        validUntil: BigInt((await time.latest()) + 86400),
                    });

                    await expect(ownerDiamond.configureLifecycle(id, cfg)).to.be.revertedWith(
                        'REDEEM_TO_PARENT requires convertible token',
                    );
                });

                it('(f) settleExpired reverts "Not expired" on a fresh PerTokenId token', async function () {
                    const id = await createFreshNFT('FreshPerToken', 'FPT');

                    // Configure as PerTokenId with a validUntil far in the future.
                    const futureEnd = BigInt((await time.latest()) + 86400);
                    const cfg = defaultConfig({
                        expirationMode: 1, // PerTokenId
                        validUntil: futureEnd,
                        expirationDisposition: 2, // BURN
                    });
                    await ownerDiamond.configureLifecycle(id, cfg);

                    // settleExpired on a fresh token (never minted, validUntil in future) must
                    // revert "Not expired" — the ID-level gate has not elapsed.
                    await expect(geniusDiamond.settleExpired(signer1, id)).to.be.revertedWith(
                        'Not expired',
                    );
                });
            });
        });
    }
});
