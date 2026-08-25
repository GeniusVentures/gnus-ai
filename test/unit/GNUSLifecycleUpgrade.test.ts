import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { Diamond } from '@geniusventures/diamonds';
import {
    loadDiamondContract,
    LocalDiamondDeployer,
    LocalDiamondDeployerConfig,
} from '@geniusventures/hardhat-diamonds/dist/utils';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
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
 * Phase 13 — GNUS Lifecycle upgrade test (Plan 13-01, SC1).
 *
 * Pins the SC1 acceptance gate:
 *   - Pre-existing NFT records decode with zero-value lifecycle defaults
 *     (validFrom=0, validUntil=0, defaultDuration=0, expirationMode=0/None,
 *     transferPolicy=0/UNRESTRICTED, expirationDisposition=0/NONE,
 *     expirationRecipient=0x0, credentialVerifier=0x0) and remain behaviorally
 *     unchanged (mintable, transferable).
 *   - The 8 Phase 13 fields pack exactly at slots +9 (uint64 x3), +10 (uint8 x3
 *     + address), +11 (address) relative to the NFT mapping entry base.
 *
 * This file does NOT register the GNUSLifecycle facet (diamond config lands in
 * plan 13-02); it only exercises the struct change through the existing
 * GNUSNFTFactory.getNFTInfo selector.
 */
describe('GNUS Lifecycle Upgrade Tests (Phase 13 SC1)', async function () {
    const diamondName = 'GeniusDiamond';
    const log: debug.Debugger = debug('GNUSLifecycleUpgrade:log:${diamondName}');
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
    // keccak256("gnus.ai.treasury.storage") — GNUSTreasury Layout base slot
    const TREASURY_STORAGE_SLOT = ethers.keccak256(ethers.toUtf8Bytes('gnus.ai.treasury.storage'));

    /**
     * Compute the storage slot for NFTs[tokenId] + offset.
     *
     * Actual layout after Phase 13 (verified by slot-probe against compiled bytecode):
     *   +0 name (string head) | +1 symbol | +2 uri | +3 exchangeRate | +4 maxSupply
     *   +5 creator (20B) | +6 childCurIndex(16B)+nftCreated(1B) | +7 parentId
     *   +8  nonConvertible(bool, byte 0)
     *       | validFrom(uint64, bytes 1-8)     [Phase 13]
     *       | validUntil(uint64, bytes 9-16)   [Phase 13]
     *       | defaultDuration(uint64, bytes 17-24) [Phase 13]
     *       | expirationMode(uint8, byte 25)   [Phase 13]
     *       | transferPolicy(uint8, byte 26)   [Phase 13]
     *       | expirationDisposition(uint8, byte 27) [Phase 13]
     *   +9  expirationRecipient(address, bytes 0-19) [Phase 13]
     *   +10 credentialVerifier(address, bytes 0-19)  [Phase 13]
     *   +11 companyAdmin(address, bytes 0-19)         [Phase 14, D-25]
     *   +12 privateNetworkId(uint256, full slot)      [Phase 14, D-03]
     *   +13 networkScope(uint8, byte 0) + publicSettlementEnabled(bool, byte 1) [Phase 14, D-03]
     *
     * Note: plan 13-01 spec assumed +9/+10/+11 (nonConvertible alone in slot +8), but
     * Solidity packs nonConvertible(bool=1B) together with the following 3×uint64 (24B)
     * and 3×uint8 (3B) = 28 bytes total in a single slot. The struct field ORDER is
     * load-bearing for D1; the slot arithmetic is corrected by this test.
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
            let signer2: string;
            let owner: string;
            let ownerSigner: SignerWithAddress;
            let geniusDiamond: GeniusDiamond;
            let signer1Diamond: GeniusDiamond;
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
                signer2 = signers[2].address;
                signer1Diamond = geniusDiamond.connect(signers[1]);

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
             * Seed the provenance counter with 0 if not already initialized. The
             * GeniusDiamond fixture is shared (cached) across suites in this process, so
             * a prior suite may already have seeded; the one-shot SetSeedSupply reverts
             * in that case. Guards on the provenanceInitialized storage slot (+1) so
             * individual suites can also be run standalone.
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

            /**
             * Owner funds themselves with `amount` of id-0 minions, then factory-mints
             * `amount` minions of `childId` to `recipient`. The burn comes out of the
             * owner's balance (caller = owner); the recipient gets the child.
             */
            async function ownerMintChild(recipient: string, childId: bigint, amount: bigint): Promise<void> {
                await ownerDiamond['mint(address,uint256)'](owner, amount);
                await ownerDiamond['mint(address,uint256,uint256,bytes)'](recipient, childId, amount, '0x');
            }

            describe('legacy decode (Phase 13 struct append)', function () {
                it('pre-Phase-13 NFT records decode with zero defaults for lifecycle fields and unchanged pre-existing fields', async function () {
                    await seedProvenanceIfNeeded();
                    await ownerDiamond['mint(address,uint256)'](signer1, toWei('1000'));

                    const expectedRate = toWei('3');
                    const expectedMax = toWei('12345');
                    const expectedName = 'LegacyToken';
                    const expectedSymbol = 'LGCY';
                    const expectedUri = 'ipfs://legacy-token';

                                        // WR-06 (13 review): derive the id from childCurIndex BEFORE createNFT —
                    // robust to a shared/cached diamond fixture (the first created token is
                    // not necessarily id 1).
                    const preInfo = await geniusDiamond.getNFTInfo(GNUS_TOKEN_ID);
                    const legacyId = (GNUS_TOKEN_ID << 128n) | preInfo.childCurIndex;
await ownerDiamond.createNFT(
                        GNUS_TOKEN_ID,
                        expectedName,
                        expectedSymbol,
                        expectedRate,
                        expectedMax,
                        expectedUri,
                    );

                    // Zero the slots that contain Phase 13 fields. nonConvertible (Phase 9, slot
                    // +8 byte 0) shares its slot with validFrom/validUntil/defaultDuration/
                    // expirationMode/transferPolicy/expirationDisposition (Phase 13, slot +8
                    // bytes 1-27). Zeroing the whole slot also resets nonConvertible to false,
                    // which is the pre-Phase-9 legacy default — matching "this record predates
                    // Phase 13" semantics for a fresh legacy token.
                    await provider.send('hardhat_setStorageAt', [
                        diamondAddress,
                        nftSlot(legacyId, 8n),
                        ethers.toBeHex(0n, 32),
                    ]);
                    await provider.send('hardhat_setStorageAt', [
                        diamondAddress,
                        nftSlot(legacyId, 9n),
                        ethers.toBeHex(0n, 32),
                    ]);
                    await provider.send('hardhat_setStorageAt', [
                        diamondAddress,
                        nftSlot(legacyId, 10n),
                        ethers.toBeHex(0n, 32),
                    ]);

                    // Read back via getNFTInfo — all 8 Phase 13 fields decode to zero defaults.
                    const info = await geniusDiamond.getNFTInfo(legacyId);
                    expect(info.validFrom).to.eq(0n); // active immediately
                    expect(info.validUntil).to.eq(0n); // no per-ID expiry
                    expect(info.defaultDuration).to.eq(0n); // PerHolder unset
                    expect(info.expirationMode).to.eq(0); // ExpirationMode.None
                    expect(info.transferPolicy).to.eq(0); // TransferPolicy.UNRESTRICTED
                    expect(info.expirationDisposition).to.eq(0); // ExpirationDisposition.NONE
                    expect(info.expirationRecipient).to.eq(ethers.ZeroAddress);
                    expect(info.credentialVerifier).to.eq(ethers.ZeroAddress);

                    // Pre-existing fields unchanged
                    expect(info.name).to.eq(expectedName);
                    expect(info.symbol).to.eq(expectedSymbol);
                    expect(info.uri).to.eq(expectedUri);
                    expect(info.exchangeRate).to.eq(expectedRate);
                    expect(info.maxSupply).to.eq(expectedMax);
                    expect(info.creator.toLowerCase()).to.eq(owner.toLowerCase());
                    expect(info.nftCreated).to.eq(true);
                    expect(info.parentId).to.eq(GNUS_TOKEN_ID); // direct child of GNUS
                    expect(info.nonConvertible).to.eq(false); // convertible (opt-out default)
                });

                it('storage layout: Phase 13 fields pack into slots +8 (with nonConvertible), +9, +10', async function () {
                    await seedProvenanceIfNeeded();

                                        // WR-06 (13 review): childCurIndex-derived id — see legacy test above.
                    const preInfo = await geniusDiamond.getNFTInfo(GNUS_TOKEN_ID);
                    const probeId = (GNUS_TOKEN_ID << 128n) | preInfo.childCurIndex;
await ownerDiamond.createNFT(
                        GNUS_TOKEN_ID,
                        'PackingProbe',
                        'PACK',
                        toWei('1'),
                        toWei('1000000'),
                        'ipfs://pack',
                    );

                    // Freshly created token: Phase 13 fields default to zero. Slot +8 still
                    // holds nonConvertible=false at byte 0 (written by createNFT), so the
                    // whole slot reads zero. Slots +9, +10 are also zero.
                    const slot8Fresh = await provider.send('eth_getStorageAt', [
                        diamondAddress,
                        nftSlot(probeId, 8n),
                    ]);
                    const slot9Fresh = await provider.send('eth_getStorageAt', [
                        diamondAddress,
                        nftSlot(probeId, 9n),
                    ]);
                    const slot10Fresh = await provider.send('eth_getStorageAt', [
                        diamondAddress,
                        nftSlot(probeId, 10n),
                    ]);
                    expect(BigInt(slot8Fresh)).to.eq(0n);
                    expect(BigInt(slot9Fresh)).to.eq(0n);
                    expect(BigInt(slot10Fresh)).to.eq(0n);

                    // Write a known pattern to slot +8 with all Phase 13 fields packed
                    // alongside nonConvertible (byte 0). Solidity packs right-to-left within
                    // a slot — the first struct field sits at the low-order bytes.
                    //   byte 0     : nonConvertible        = 0x01 (true)
                    //   bytes 1-8  : validFrom             = 0x0102030405060708
                    //   bytes 9-16 : validUntil            = 0x1112131415161718
                    //   bytes 17-24: defaultDuration       = 0x2122232425262728
                    //   byte 25    : expirationMode        = 0x01
                    //   byte 26    : transferPolicy        = 0x02
                    //   byte 27    : expirationDisposition = 0x03
                    const validFromVal = 0x0102030405060708n;
                    const validUntilVal = 0x1112131415161718n;
                    const defaultDurationVal = 0x2122232425262728n;
                    const packed8 =
                        0x01n | // nonConvertible at byte 0
                        (validFromVal << 8n) |
                        (validUntilVal << 72n) |
                        (defaultDurationVal << 136n) |
                        (0x01n << 200n) | // expirationMode
                        (0x02n << 208n) | // transferPolicy
                        (0x03n << 216n); // expirationDisposition
                    await provider.send('hardhat_setStorageAt', [
                        diamondAddress,
                        nftSlot(probeId, 8n),
                        ethers.toBeHex(packed8, 32),
                    ]);

                    // Write a known address to slot +9 (expirationRecipient at bytes 0-19).
                    const recipientVal = BigInt('0x00000000000000000000000000000000DeaDBeef');
                    await provider.send('hardhat_setStorageAt', [
                        diamondAddress,
                        nftSlot(probeId, 9n),
                        ethers.toBeHex(recipientVal, 32),
                    ]);

                    // Write a known address to slot +10 (credentialVerifier at bytes 0-19).
                    const verifierVal = BigInt('0x00000000000000000000000000000000C0deC0de');
                    await provider.send('hardhat_setStorageAt', [
                        diamondAddress,
                        nftSlot(probeId, 10n),
                        ethers.toBeHex(verifierVal, 32),
                    ]);

                    // Decode through getNFTInfo and assert each Phase 13 field matches the
                    // packed value written above. This proves field order and slot packing.
                    const info = await geniusDiamond.getNFTInfo(probeId);
                    expect(info.nonConvertible).to.eq(true);
                    expect(info.validFrom).to.eq(validFromVal);
                    expect(info.validUntil).to.eq(validUntilVal);
                    expect(info.defaultDuration).to.eq(defaultDurationVal);
                    expect(info.expirationMode).to.eq(1);
                    expect(info.transferPolicy).to.eq(2);
                    expect(info.expirationDisposition).to.eq(3);
                    expect(info.expirationRecipient.toLowerCase()).to.eq(
                        '0x00000000000000000000000000000000deadbeef',
                    );
                    expect(info.credentialVerifier.toLowerCase()).to.eq(
                        '0x00000000000000000000000000000000c0dec0de',
                    );
                });

                it('legacy token behaviorally unchanged after zeroing Phase 13 slots (mint + transfer)', async function () {
                    await seedProvenanceIfNeeded();
                    await ownerDiamond['mint(address,uint256)'](signer1, toWei('1000'));

                                        // WR-06 (13 review): derive the id from childCurIndex BEFORE createNFT —
                    // robust to a shared/cached diamond fixture (the first created token is
                    // not necessarily id 1).
                    const preInfo = await geniusDiamond.getNFTInfo(GNUS_TOKEN_ID);
                    const legacyId = (GNUS_TOKEN_ID << 128n) | preInfo.childCurIndex;
await ownerDiamond.createNFT(
                        GNUS_TOKEN_ID,
                        'LegacyBehavior',
                        'LBHV',
                        toWei('3'),
                        toWei('12345'),
                        'ipfs://legacy-behavior',
                    );

                    // Zero slots +8/+9/+10 to simulate a pre-Phase-13 record. Zeroing +8 also
                    // resets nonConvertible to false — the pre-Phase-9 default — which is
                    // consistent with the "pre-existing legacy token" simulation.
                    await provider.send('hardhat_setStorageAt', [
                        diamondAddress,
                        nftSlot(legacyId, 8n),
                        ethers.toBeHex(0n, 32),
                    ]);
                    await provider.send('hardhat_setStorageAt', [
                        diamondAddress,
                        nftSlot(legacyId, 9n),
                        ethers.toBeHex(0n, 32),
                    ]);
                    await provider.send('hardhat_setStorageAt', [
                        diamondAddress,
                        nftSlot(legacyId, 10n),
                        ethers.toBeHex(0n, 32),
                    ]);

                    // Mint still succeeds (zero-default transfer policy = UNRESTRICTED).
                    await ownerMintChild(signer1, legacyId, toWei('50'));
                    expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, legacyId)).to.eq(
                        toWei('50'),
                    );

                    // Holder-to-holder transfer still succeeds between two non-zero addresses.
                    await expect(
                        signer1Diamond.safeTransferFrom(signer1, signer2, legacyId, toWei('10'), '0x'),
                    ).to.not.be.reverted;
                    expect(await geniusDiamond['balanceOf(address,uint256)'](signer1, legacyId)).to.eq(
                        toWei('40'),
                    );
                    expect(await geniusDiamond['balanceOf(address,uint256)'](signer2, legacyId)).to.eq(
                        toWei('10'),
                    );
                });
            });

            describe('Phase 14 append (D-03/D-25)', function () {
                it('pre-Phase-14 NFT records decode with zero defaults for the D-03/D-25 fields', async function () {
                    await seedProvenanceIfNeeded();
                    await ownerDiamond['mint(address,uint256)'](signer1, toWei('1000'));

                    // WR-06: childCurIndex-derived id — robust to shared fixture.
                    const preInfo = await geniusDiamond.getNFTInfo(GNUS_TOKEN_ID);
                    const legacyId = (GNUS_TOKEN_ID << 128n) | preInfo.childCurIndex;
                    await ownerDiamond.createNFT(
                        GNUS_TOKEN_ID,
                        'LegacyPhase14',
                        'L14',
                        toWei('3'),
                        toWei('12345'),
                        'ipfs://legacy-phase14',
                    );

                    // Zero slots +11/+12/+13 to simulate a record that predates Phase 14.
                    for (const offset of [11n, 12n, 13n]) {
                        await provider.send('hardhat_setStorageAt', [
                            diamondAddress,
                            nftSlot(legacyId, offset),
                            ethers.toBeHex(0n, 32),
                        ]);
                    }

                    const info = await geniusDiamond.getNFTInfo(legacyId);
                    expect(info.companyAdmin).to.eq(ethers.ZeroAddress); // unset operator config field
                    expect(info.privateNetworkId).to.eq(0n); // no private network
                    expect(info.networkScope).to.eq(0); // NetworkScope.PublicOnly (zero default)
                    expect(info.publicSettlementEnabled).to.eq(false); // informational flag off
                });

                it('storage layout: D-03/D-25 fields occupy slots +11 (address), +12 (uint256), +13 (uint8 + bool)', async function () {
                    await seedProvenanceIfNeeded();

                    const preInfo = await geniusDiamond.getNFTInfo(GNUS_TOKEN_ID);
                    const probeId = (GNUS_TOKEN_ID << 128n) | preInfo.childCurIndex;
                    await ownerDiamond.createNFT(
                        GNUS_TOKEN_ID,
                        'Phase14Probe',
                        'P14',
                        toWei('1'),
                        toWei('1000000'),
                        'ipfs://phase14-probe',
                    );

                    // Slot +11: companyAdmin (address, full slot, D-25).
                    const companyAdminVal = BigInt('0x00000000000000000000000000000000ABcd0007');
                    await provider.send('hardhat_setStorageAt', [
                        diamondAddress,
                        nftSlot(probeId, 11n),
                        ethers.toBeHex(companyAdminVal, 32),
                    ]);

                    // Slot +12: privateNetworkId (uint256, full slot — uint256 cannot share).
                    const privateNetworkIdVal = 0x4e4554574f524b000000000000000002n; // arbitrary 32B pattern, non-zero
                    await provider.send('hardhat_setStorageAt', [
                        diamondAddress,
                        nftSlot(probeId, 12n),
                        ethers.toBeHex(privateNetworkIdVal, 32),
                    ]);

                    // Slot +13: networkScope (uint8, byte 0) + publicSettlementEnabled (bool, byte 1).
                    // Solidity packs the first declared field at the low-order byte.
                    const networkScopeVal = 2n; // NetworkScope.Hybrid
                    const packed13 = networkScopeVal | (0x01n << 8n); // publicSettlementEnabled = true
                    await provider.send('hardhat_setStorageAt', [
                        diamondAddress,
                        nftSlot(probeId, 13n),
                        ethers.toBeHex(packed13, 32),
                    ]);

                    const info = await geniusDiamond.getNFTInfo(probeId);
                    expect(info.companyAdmin.toLowerCase()).to.eq(
                        '0x00000000000000000000000000000000abcd0007',
                    );
                    expect(info.privateNetworkId).to.eq(privateNetworkIdVal);
                    expect(info.networkScope).to.eq(2); // Hybrid
                    expect(info.publicSettlementEnabled).to.eq(true);
                });
            });
        });
    }
});
