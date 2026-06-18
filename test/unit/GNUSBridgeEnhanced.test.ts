import {
	LocalDiamondDeployer,
	loadDiamondContract,
} from '@diamondslab/hardhat-diamonds/dist/utils';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { GeniusDiamond } from '../../diamond-typechain-types';
import { toWei } from '../../scripts/utils/helpers';

describe('GNUSBridge Enhanced Tests', function () {
	let geniusDiamond: GeniusDiamond;
	let owner: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let user3: SignerWithAddress;
	let initialSnapshotId: string;
	let snapshotId: string;

	// 32-byte X component of the SuperGenius destination public key (not an Ethereum address)
	const SGNS_DESTINATION = ethers.zeroPadValue('0x1234', 32);
	// Y-component parity for SGNS_DESTINATION (false = even)
	const SGNS_DESTINATION_Y_ODD = false;

	before(async function () {
		const config = {
			diamondName: 'GeniusDiamond',
			network: 'hardhat',
		};

		const deployer = await LocalDiamondDeployer.getInstance(hre, config);
		const diamond = await deployer.getDiamondDeployed();
		const deployedData = diamond.getDeployedDiamondData();
		const diamondAddress = deployedData.DiamondAddress || '';

		geniusDiamond = await loadDiamondContract<GeniusDiamond>(
			diamond,
			diamondAddress,
			hre.ethers,
		);

		[owner, user1, user2, user3] = await ethers.getSigners();

		// Take initial snapshot
		initialSnapshotId = await hre.network.provider.send('evm_snapshot');
	});

	beforeEach(async function () {
		snapshotId = await hre.network.provider.send('evm_snapshot');
	});

	afterEach(async function () {
		await hre.network.provider.send('evm_revert', [snapshotId]);
	});

	after(async function () {
		await hre.network.provider.send('evm_revert', [initialSnapshotId]);
	});

	describe('Bridge Fee Management', function () {
		it('should apply 0% bridge fee correctly (no fee)', async function () {
			// Default bridge fee should be 0
			const [bridgeFee] = await geniusDiamond.protocolInfo();
			expect(bridgeFee).to.equal(0);

			// Mint with 0% fee - should receive full amount
			await geniusDiamond['mint(address,uint256)'](user1.address, toWei(100));
			const balance = await geniusDiamond['balanceOf(address)'](user1.address);
			expect(balance).to.equal(toWei(100));
		});

		it('should apply 5% bridge fee correctly', async function () {
			// Set bridge fee to 5% (50 out of 1000)
			await geniusDiamond.updateBridgeFee(50);
			const [bridgeFee] = await geniusDiamond.protocolInfo();
			expect(bridgeFee).to.equal(50);

			// Mint 100 tokens with 5% fee - should receive 95 tokens
			await geniusDiamond['mint(address,uint256)'](user1.address, toWei(100));
			const balance = await geniusDiamond['balanceOf(address)'](user1.address);
			expect(balance).to.equal(toWei(95)); // 100 - 5% = 95
		});

		it('should apply 20% bridge fee correctly (max fee)', async function () {
			// Set bridge fee to 20% (200 out of 1000 = max)
			await geniusDiamond.updateBridgeFee(200);
			const [bridgeFee] = await geniusDiamond.protocolInfo();
			expect(bridgeFee).to.equal(200);

			// Mint 100 tokens with 20% fee - should receive 80 tokens
			await geniusDiamond['mint(address,uint256)'](user1.address, toWei(100));
			const balance = await geniusDiamond['balanceOf(address)'](user1.address);
			expect(balance).to.equal(toWei(80)); // 100 - 20% = 80
		});

		it('should apply bridge fee to ERC1155 token mints', async function () {
			// Set bridge fee to 10% (100 out of 1000)
			await geniusDiamond.updateBridgeFee(100);

			// Create an NFT first (tokenId 1)
			// createNFT(parentId, name, symbol, exchangeRate, maxSupply, uri)
			await geniusDiamond.createNFT(
				0, // parent = GNUS (tokenId 0)
				'Test NFT', // name
				'TNFT', // symbol
				2, // exchangeRate (2 GNUS per NFT) - NOT toWei(2)
				10000, // maxSupply (large enough for all tests)
				'ipfs://test-nft', // uri
			);

			// Mint NFT tokens with 10% fee - should receive 90 tokens
			await geniusDiamond['mint(address,uint256,uint256)'](
				user1.address,
				1, // tokenId
				100,
			);
			const balance = await geniusDiamond['balanceOf(address,uint256)'](user1.address, 1);
			expect(balance).to.equal(90); // 100 - 10% = 90
		});

		it('should handle varying bridge fees across multiple mints', async function () {
			// Mint with 0% fee
			await geniusDiamond['mint(address,uint256)'](user1.address, toWei(100));
			let balance1 = await geniusDiamond['balanceOf(address)'](user1.address);
			expect(balance1).to.equal(toWei(100));

			// Update to 10% fee
			await geniusDiamond.updateBridgeFee(100);

			// Mint with 10% fee
			await geniusDiamond['mint(address,uint256)'](user1.address, toWei(100));
			balance1 = await geniusDiamond['balanceOf(address)'](user1.address);
			expect(balance1).to.equal(toWei(190)); // 100 + (100 - 10%) = 190

			// Update to 20% fee
			await geniusDiamond.updateBridgeFee(200);

			// Mint with 20% fee
			await geniusDiamond['mint(address,uint256)'](user1.address, toWei(100));
			balance1 = await geniusDiamond['balanceOf(address)'](user1.address);
			expect(balance1).to.equal(toWei(270)); // 190 + (100 - 20%) = 270
		});
	});

	describe('ERC20 Compatibility Functions', function () {
		beforeEach(async function () {
			// Mint some tokens to user1
			await geniusDiamond['mint(address,uint256)'](user1.address, toWei(1000));
		});

		it('should return correct name and symbol', async function () {
			expect(await geniusDiamond.name()).to.equal('Genius NFT Collection');
			expect(await geniusDiamond.symbol()).to.equal('GNUS');
		});

		it('should return correct decimals', async function () {
			expect(await geniusDiamond.decimals()).to.equal(18);
		});

		it('should handle approve and allowance correctly', async function () {
			// Check initial allowance
			let allowance = await geniusDiamond.allowance(user1.address, user2.address);
			expect(allowance).to.equal(0);

			// Approve user2 to spend 500 tokens
			await geniusDiamond.connect(user1).approve(user2.address, toWei(500));
			allowance = await geniusDiamond.allowance(user1.address, user2.address);
			expect(allowance).to.equal(toWei(500));

			// Update approval to 1000
			await geniusDiamond.connect(user1).approve(user2.address, toWei(1000));
			allowance = await geniusDiamond.allowance(user1.address, user2.address);
			expect(allowance).to.equal(toWei(1000));
		});

		it('should handle transferFrom correctly', async function () {
			// Approve user2 to spend 500 tokens
			await geniusDiamond.connect(user1).approve(user2.address, toWei(500));

			// TransferFrom user1 to user3
			await geniusDiamond
				.connect(user2)
				.transferFrom(user1.address, user3.address, toWei(200));

			// Check balances
			const balance1 = await geniusDiamond['balanceOf(address)'](user1.address);
			const balance3 = await geniusDiamond['balanceOf(address)'](user3.address);
			expect(balance1).to.equal(toWei(800)); // 1000 - 200
			expect(balance3).to.equal(toWei(200));

			// Check remaining allowance
			const allowance = await geniusDiamond.allowance(user1.address, user2.address);
			expect(allowance).to.equal(toWei(300)); // 500 - 200
		});

		it('should revert transferFrom with insufficient allowance', async function () {
			// Approve user2 to spend 100 tokens
			await geniusDiamond.connect(user1).approve(user2.address, toWei(100));

			// Try to transfer 200 tokens (should fail)
			await expect(
				geniusDiamond.connect(user2).transferFrom(user1.address, user3.address, toWei(200)),
			).to.be.revertedWith('ERC20: insufficient allowance');
		});

		it('should handle increaseAllowance correctly', async function () {
			// Initial approval
			await geniusDiamond.connect(user1).approve(user2.address, toWei(100));
			let allowance = await geniusDiamond.allowance(user1.address, user2.address);
			expect(allowance).to.equal(toWei(100));

			// Increase allowance by 50
			await geniusDiamond.connect(user1).increaseAllowance(user2.address, toWei(50));
			allowance = await geniusDiamond.allowance(user1.address, user2.address);
			expect(allowance).to.equal(toWei(150)); // 100 + 50
		});

		it('should handle multiple allowances to different spenders', async function () {
			// Approve user2
			await geniusDiamond.connect(user1).approve(user2.address, toWei(200));
			// Approve user3
			await geniusDiamond.connect(user1).approve(user3.address, toWei(300));

			const allowance2 = await geniusDiamond.allowance(user1.address, user2.address);
			const allowance3 = await geniusDiamond.allowance(user1.address, user3.address);

			expect(allowance2).to.equal(toWei(200));
			expect(allowance3).to.equal(toWei(300));
		});
	});

	describe('Transfer with Transfer Restrictions', function () {
		beforeEach(async function () {
			// Mint tokens to user1
			await geniusDiamond['mint(address,uint256)'](user1.address, toWei(1000));
		});

		it('should allow transfer when address is not banned', async function () {
			await expect(geniusDiamond.connect(user1).transfer(user2.address, toWei(100))).to.not
				.be.reverted;

			const balance2 = await geniusDiamond['balanceOf(address)'](user2.address);
			expect(balance2).to.equal(toWei(100));
		});

		it('should block transfer when sender is globally banned', async function () {
			// Ban user1 globally
			await geniusDiamond.banTransferorForAll(user1.address);

			// Try to transfer (should fail)
			await expect(
				geniusDiamond.connect(user1).transfer(user2.address, toWei(100)),
			).to.be.revertedWith('Blocked transferor');
		});

		it('should block transfer when sender is banned for specific token', async function () {
			// Ban user1 for GNUS token (ID 0)
			await geniusDiamond.banTransferorBatch([toWei(0)], [user1.address]);

			// Try to transfer GNUS tokens (should fail)
			await expect(
				geniusDiamond.connect(user1).transfer(user2.address, toWei(100)),
			).to.be.revertedWith('Blocked transferor');
		});

		it('should allow transfer after being unbanned globally', async function () {
			// Ban user1 globally
			await geniusDiamond.banTransferorForAll(user1.address);

			// Verify transfer is blocked
			await expect(
				geniusDiamond.connect(user1).transfer(user2.address, toWei(100)),
			).to.be.revertedWith('Blocked transferor');

			// Unban user1
			await geniusDiamond.allowTransferorForAll(user1.address);

			// Transfer should now work
			await expect(geniusDiamond.connect(user1).transfer(user2.address, toWei(100))).to.not
				.be.reverted;
		});

		it('should allow transfer after being unbanned for specific token', async function () {
			// Ban user1 for GNUS token
			await geniusDiamond.banTransferorBatch([toWei(0)], [user1.address]);

			// Verify transfer is blocked
			await expect(
				geniusDiamond.connect(user1).transfer(user2.address, toWei(100)),
			).to.be.revertedWith('Blocked transferor');

			// Unban user1 for GNUS token
			await geniusDiamond.allowTransferorBatch([toWei(0)], [user1.address]);

			// Transfer should now work
			await expect(geniusDiamond.connect(user1).transfer(user2.address, toWei(100))).to.not
				.be.reverted;
		});
	});

	describe('Withdraw Functionality', function () {
		it('should withdraw child token to GNUS correctly', async function () {
			// Create NFT (tokenId 1)
			await geniusDiamond.createNFT(
				0, // parent = GNUS (tokenId 0)
				'Test NFT', // name
				'TNFT', // symbol
				2, // exchangeRate = 2 GNUS per NFT
				10000, // maxSupply (large enough)
				'ipfs://test-nft', // uri
			);

			// Mint NFT tokens to user1
			await geniusDiamond['mint(address,uint256,uint256)'](user1.address, 1, 100);

			// Check initial balances
			let nftBalance = await geniusDiamond['balanceOf(address,uint256)'](user1.address, 1);
			let gnusBalance = await geniusDiamond['balanceOf(address)'](user1.address);
			expect(nftBalance).to.equal(100);
			expect(gnusBalance).to.equal(0);

			// Withdraw 50 NFT tokens (should get 50/2 = 25 GNUS)
			await geniusDiamond.connect(user1).withdraw(50, 1);

			// Check final balances
			nftBalance = await geniusDiamond['balanceOf(address,uint256)'](user1.address, 1);
			gnusBalance = await geniusDiamond['balanceOf(address)'](user1.address);
			expect(nftBalance).to.equal(50); // 100 - 50
			expect(gnusBalance).to.equal(25); // Withdraw gives plain number (50 / exchangeRate 2 = 25)
		});

		it('should revert withdraw if token not created', async function () {
			await expect(
				geniusDiamond.connect(user1).withdraw(100, toWei(999)),
			).to.be.revertedWith('Token not created.');
		});

		it('should revert withdraw for GNUS token itself', async function () {
			await expect(geniusDiamond.connect(user1).withdraw(100, toWei(0))).to.be.revertedWith(
				'Cannot withdraw GNUS tokens.',
			);
		});

		it('should revert withdraw with insufficient balance', async function () {
			// Create NFT (will get tokenId 1 as first child of GNUS)
			await geniusDiamond.createNFT(
				0, // parent = GNUS (tokenId 0)
				'Test NFT',
				'TNFT',
				2,
				10000,
				'ipfs://test-nft',
			);

			// Try to withdraw without having any tokens
			await expect(geniusDiamond.connect(user1).withdraw(100, 1)).to.be.revertedWith(
				'Insufficient tokens.',
			);
		});

		it('should handle withdraw with bridge fee applied', async function () {
			// Set bridge fee to 10%
			await geniusDiamond.updateBridgeFee(100);

			// Create NFT (will get tokenId 1 as first child of GNUS)
			await geniusDiamond.createNFT(
				0, // parent = GNUS (tokenId 0)
				'Test NFT',
				'TNFT',
				2, // exchangeRate = 2 (plain number)
				10000,
				'ipfs://test-nft',
			);

			// Mint NFT tokens to user1 (with bridge fee applied on mint)
			await geniusDiamond['mint(address,uint256,uint256)'](
				user1.address,
				1, // tokenId 1
				100,
			);

			// Check balance after mint (should have 90 due to 10% bridge fee)
			let nftBalance = await geniusDiamond['balanceOf(address,uint256)'](user1.address, 1);
			expect(nftBalance).to.equal(90);

			// Withdraw 90 NFT tokens (should get (90/2) * 0.9 = 40.5, rounded down to 40)
			await geniusDiamond.connect(user1).withdraw(90, 1);

			const gnusBalance = await geniusDiamond['balanceOf(address)'](user1.address);
			expect(gnusBalance).to.equal(40); // (90 / 2) * (1 - 0.1) = 40.5, rounded down
		});
	});

	describe('Bridge Out Functionality', function () {
		it('should emit BridgeOutInitiated event correctly', async function () {
			// Create NFT
			await geniusDiamond.createNFT(
				0, // parent = GNUS (tokenId 0)
				'Test NFT',
				'TNFT',
				toWei(2),
				10000,
				'ipfs://test-nft',
			);

			// Mint NFT tokens to user1
			await geniusDiamond['mint(address,uint256,uint256)'](user1.address, 1, 100);

			// Set chainID
			await geniusDiamond.setChainID(1); // Ethereum mainnet

			// Bridge out to chain 137 (Polygon)
			const tx = await geniusDiamond.connect(user1).bridgeOut(50, 1, 137, SGNS_DESTINATION, SGNS_DESTINATION_Y_ODD);

			// Check event
			await expect(tx)
				.to.emit(geniusDiamond, 'BridgeOutInitiated')
				.withArgs(user1.address, 1, 50, 1, 137, SGNS_DESTINATION, SGNS_DESTINATION_Y_ODD);

			// Check balance decreased
			const balance = await geniusDiamond['balanceOf(address,uint256)'](user1.address, 1);
			expect(balance).to.equal(50); // 100 - 50
		});

		it('should revert bridgeOut if token not created', async function () {
			await expect(
				geniusDiamond.connect(user1).bridgeOut(100, toWei(999), 137, SGNS_DESTINATION, SGNS_DESTINATION_Y_ODD),
			).to.be.revertedWith('Token not created.');
		});

		it('should revert bridgeOut with insufficient balance', async function () {
			// Create NFT
			await geniusDiamond.createNFT(
				0, // parent = GNUS (tokenId 0)
				'Test NFT',
				'TNFT',
				toWei(2),
				10000,
				'ipfs://test-nft',
			);

			// Try to bridge without having any tokens
			await expect(
				geniusDiamond.connect(user1).bridgeOut(100, 1, 137, SGNS_DESTINATION, SGNS_DESTINATION_Y_ODD),
			).to.be.revertedWith(
				'Insufficient tokens.',
			);
		});

		it('should handle bridgeOut for GNUS tokens', async function () {
			// Mint GNUS tokens to user1
			await geniusDiamond['mint(address,uint256)'](user1.address, toWei(1000));

			// Set chainID
			await geniusDiamond.setChainID(1);

			// Bridge out GNUS tokens
			const tx = await geniusDiamond
				.connect(user1)
				.bridgeOut(toWei(500), toWei(0), 137, SGNS_DESTINATION, SGNS_DESTINATION_Y_ODD);

			// Check event
			await expect(tx).to.emit(geniusDiamond, 'BridgeOutInitiated');

			// Check balance decreased
			const balance = await geniusDiamond['balanceOf(address)'](user1.address);
			expect(balance).to.equal(toWei(500)); // 1000 - 500
		});
	});

	describe('Edge Cases', function () {
		it('should handle mint with zero address correctly', async function () {
			await expect(
				geniusDiamond['mint(address,uint256)'](ethers.ZeroAddress, toWei(100)),
			).to.be.revertedWith('ERC1155: mint to the zero address');
		});

		it('should handle burn more than balance', async function () {
			// Mint 100 tokens
			await geniusDiamond['mint(address,uint256)'](user1.address, toWei(100));

			// Try to burn 200 tokens (error is checked in _beforeTokenTransfer)
			await expect(
				geniusDiamond['burn(address,uint256)'](user1.address, toWei(200)),
			).to.be.revertedWith('ERC1155: burn amount exceeds totalSupply');
		});

		it('should handle transfer to zero address', async function () {
			// Mint tokens
			await geniusDiamond['mint(address,uint256)'](user1.address, toWei(100));

			// Try to transfer to zero address
			await expect(
				geniusDiamond.connect(user1).transfer(ethers.ZeroAddress, toWei(50)),
			).to.be.revertedWith('ERC1155: transfer to the zero address');
		});

		it('should handle transfer with zero amount', async function () {
			// Mint tokens
			await geniusDiamond['mint(address,uint256)'](user1.address, toWei(100));

			// Transfer 0 tokens (should succeed but not change balances)
			await expect(geniusDiamond.connect(user1).transfer(user2.address, 0)).to.not.be
				.reverted;

			const balance1 = await geniusDiamond['balanceOf(address)'](user1.address);
			const balance2 = await geniusDiamond['balanceOf(address)'](user2.address);
			expect(balance1).to.equal(toWei(100));
			expect(balance2).to.equal(0);
		});

		it('should handle large amounts correctly', async function () {
			await geniusDiamond.setLimiterEnabled(false);
			const largeAmount = toWei(1000000); // 1 million tokens

			// Mint large amount
			await geniusDiamond['mint(address,uint256)'](user1.address, largeAmount);

			const balance = await geniusDiamond['balanceOf(address)'](user1.address);
			expect(balance).to.equal(largeAmount);

			// Transfer large amount
			await expect(geniusDiamond.connect(user1).transfer(user2.address, largeAmount)).to.not
				.be.reverted;

			const balance2 = await geniusDiamond['balanceOf(address)'](user2.address);
			expect(balance2).to.equal(largeAmount);
		});
	});
});
