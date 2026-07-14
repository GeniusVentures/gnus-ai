import {
    LocalDiamondDeployer,
    loadDiamondContract,
} from '@diamondslab/hardhat-diamonds/dist/utils';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import hre from 'hardhat';
import { GeniusDiamond } from '../../diamond-typechain-types';

describe('Phase 5: Circuit Breaker & Performance', function () {
    let geniusDiamond: GeniusDiamond;
    let owner: SignerWithAddress;
    let user: SignerWithAddress;

    const GNUS_TOKEN_ID = 0;
    const kMintAmount = 1000;
    const kTransferAmount = 100;

    let snapshotId: string;

    before(async function () {
        const signers = await hre.ethers.getSigners();
        owner = signers[0];
        user = signers[1];

        const config = { diamondName: 'GeniusDiamond', network: 'hardhat' };
        const deployer = await LocalDiamondDeployer.getInstance(hre, config);
        const diamond = await deployer.getDiamondDeployed();
        const addr = diamond.getDeployedDiamondData().DiamondAddress || '';
        geniusDiamond = await loadDiamondContract<GeniusDiamond>(
            diamond,
            addr,
            hre.ethers,
        );
    });

    beforeEach(async function () {
        snapshotId = await hre.network.provider.send('evm_snapshot');
    });

    afterEach(async function () {
        await hre.network.provider.send('evm_revert', [snapshotId]);
    });

    // ── T1-T2: Diamond-Wide Emergency Pause ──────────────────────────

    describe('Emergency Pause', function () {
        it('should allow super admin to pause', async function () {
            await expect(geniusDiamond.connect(owner).emergencyPause()).to.not.be.reverted;
        });

        it('should return paused = true after pause', async function () {
            await geniusDiamond.connect(owner).emergencyPause();
            expect(await geniusDiamond.isEmergencyPaused()).to.be.true;
        });

        it('should allow super admin to unpause', async function () {
            await geniusDiamond.connect(owner).emergencyPause();
            await expect(geniusDiamond.connect(owner).emergencyUnpause()).to.not.be.reverted;
            expect(await geniusDiamond.isEmergencyPaused()).to.be.false;
        });

        it('should revert transfers when paused', async function () {
            await geniusDiamond.connect(owner).emergencyPause();
            await expect(
                geniusDiamond.connect(owner).transfer(user.address, kTransferAmount),
            ).to.be.revertedWith('GNUSControl: contract paused');
        });

        it('should allow transfers after unpause', async function () {
            await geniusDiamond.connect(owner).mint(owner.address, kMintAmount);
            await geniusDiamond.connect(owner).emergencyPause();
            await geniusDiamond.connect(owner).emergencyUnpause();
            await expect(
                geniusDiamond.connect(owner).transfer(user.address, kTransferAmount),
            ).to.not.be.reverted;
        });

        it('should revert when non-admin tries to pause', async function () {
            await expect(geniusDiamond.connect(user).emergencyPause()).to.be.reverted;
        });

        it('should revert when non-admin tries to unpause', async function () {
            await geniusDiamond.connect(owner).emergencyPause();
            await expect(geniusDiamond.connect(user).unpause()).to.be.reverted;
        });
    });

    // ── T4: Bin Count Cap ───────────────────────────────────────────

    describe('Bin Count Cap', function () {
        it('should accept binCount within cap', async function () {
            await expect(
                geniusDiamond.connect(owner).setDefaultBinCount(256),
            ).to.not.be.reverted;
        });

        it('should revert when binCount exceeds cap', async function () {
            await expect(
                geniusDiamond.connect(owner).setDefaultBinCount(257),
            ).to.be.revertedWith('Bin count exceeds maximum');
        });

        it('should revert when binCount is zero', async function () {
            await expect(
                geniusDiamond.connect(owner).setDefaultBinCount(0),
            ).to.be.revertedWith('Bin count must be greater than 0');
        });
    });
});
