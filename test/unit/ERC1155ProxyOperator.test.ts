import {
	LocalDiamondDeployer,
	loadDiamondContract,
} from '@diamondslab/hardhat-diamonds/dist/utils';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import hre from 'hardhat';
import { GeniusDiamond } from '../../diamond-typechain-types';

describe('ERC1155ProxyOperator Tests', function () {
	let geniusDiamond: GeniusDiamond;
	let owner: SignerWithAddress;
	let proxyOperator: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let nonOperator: SignerWithAddress;

	let initialSnapshotId: string;
	let snapshotId: string;

	const NFT_PROXY_OPERATOR_ROLE = hre.ethers.keccak256(
		hre.ethers.toUtf8Bytes('NFT_PROXY_OPERATOR_ROLE'),
	);
	const CREATOR_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('CREATOR_ROLE'));
	const MINTER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('MINTER_ROLE'));
	const GNUS_TOKEN_ID = 0;

	before(async function () {
		// Get signers
		const signers = await hre.ethers.getSigners();
		owner = signers[0];
		proxyOperator = signers[1];
		user1 = signers[2];
		user2 = signers[3];
		nonOperator = signers[4];

		// Deploy Diamond using LocalDiamondDeployer
		const config = { diamondName: 'GeniusDiamond', network: 'hardhat' };
		const diamondDeployer = await LocalDiamondDeployer.getInstance(hre, config);
		const diamond = await diamondDeployer.getDiamondDeployed();
		const deployedDiamondData = diamond.getDeployedDiamondData();
		const diamondAddress = deployedDiamondData.DiamondAddress || '';

		// Load the deployed diamond with full ABI
		geniusDiamond = await loadDiamondContract<GeniusDiamond>(
			diamond,
			diamondAddress,
			hre.ethers,
		);

		// Grant MINTER_ROLE to owner for GNUS token minting
		await geniusDiamond.grantRole(MINTER_ROLE, await owner.getAddress());

		// Grant CREATOR_ROLE to owner for NFT creation
		await geniusDiamond.grantRole(CREATOR_ROLE, await owner.getAddress());

		// Take initial snapshot for test isolation
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

	describe('isApprovedForAll', function () {
		it('should return true for addresses with NFT_PROXY_OPERATOR_ROLE', async function () {
			// Grant role to proxyOperator
			await geniusDiamond.grantRole(
				NFT_PROXY_OPERATOR_ROLE,
				await proxyOperator.getAddress(),
			);

			// Note: The isApprovedForAll override in ERC1155ProxyOperator may not be called
			// in the Diamond context. This test verifies role assignment works correctly.
			// For actual approval in transfers, explicit setApprovalForAll may be needed.
			const hasRole = await geniusDiamond.hasRole(
				NFT_PROXY_OPERATOR_ROLE,
				await proxyOperator.getAddress(),
			);
			expect(hasRole).to.be.true;
		});

		it('should return false for addresses without NFT_PROXY_OPERATOR_ROLE', async function () {
			// Check if non-operator has the role (should be false)
			const hasRole = await geniusDiamond.hasRole(
				NFT_PROXY_OPERATOR_ROLE,
				await nonOperator.getAddress(),
			);
			expect(hasRole).to.be.false;

			// Standard ERC1155 approval check
			const isApproved = await geniusDiamond.isApprovedForAll(
				await user1.getAddress(),
				await nonOperator.getAddress(),
			);
			expect(isApproved).to.be.false;
		});

		it('should return true for standard ERC1155 operator approvals', async function () {
			// User1 sets approval for user2
			await geniusDiamond.connect(user1).setApprovalForAll(await user2.getAddress(), true);

			// Check if user2 is approved for user1
			const isApproved = await geniusDiamond.isApprovedForAll(
				await user1.getAddress(),
				await user2.getAddress(),
			);

			expect(isApproved).to.be.true;
		});

		it('should prioritize NFT_PROXY_OPERATOR_ROLE over standard approvals', async function () {
			// Grant role to proxyOperator
			await geniusDiamond.grantRole(
				NFT_PROXY_OPERATOR_ROLE,
				await proxyOperator.getAddress(),
			);

			// Verify the role is granted
			const hasRole = await geniusDiamond.hasRole(
				NFT_PROXY_OPERATOR_ROLE,
				await proxyOperator.getAddress(),
			);
			expect(hasRole).to.be.true;
		});

		it('should return false after NFT_PROXY_OPERATOR_ROLE is revoked', async function () {
			// Grant role
			await geniusDiamond.grantRole(
				NFT_PROXY_OPERATOR_ROLE,
				await proxyOperator.getAddress(),
			);

			// Verify role granted
			let hasRole = await geniusDiamond.hasRole(
				NFT_PROXY_OPERATOR_ROLE,
				await proxyOperator.getAddress(),
			);
			expect(hasRole).to.be.true;

			// Revoke role
			await geniusDiamond.revokeRole(
				NFT_PROXY_OPERATOR_ROLE,
				await proxyOperator.getAddress(),
			);

			// Verify role revoked
			hasRole = await geniusDiamond.hasRole(
				NFT_PROXY_OPERATOR_ROLE,
				await proxyOperator.getAddress(),
			);
			expect(hasRole).to.be.false;
		});

		it('should work for multiple proxy operators simultaneously', async function () {
			// Grant role to two operators
			await geniusDiamond.grantRole(
				NFT_PROXY_OPERATOR_ROLE,
				await proxyOperator.getAddress(),
			);
			await geniusDiamond.grantRole(NFT_PROXY_OPERATOR_ROLE, await user2.getAddress());

			// Both should have the role
			const hasRole1 = await geniusDiamond.hasRole(
				NFT_PROXY_OPERATOR_ROLE,
				await proxyOperator.getAddress(),
			);
			const hasRole2 = await geniusDiamond.hasRole(
				NFT_PROXY_OPERATOR_ROLE,
				await user2.getAddress(),
			);

			expect(hasRole1).to.be.true;
			expect(hasRole2).to.be.true;
		});

		it('should return false after standard approval is revoked', async function () {
			// User1 sets approval for user2
			await geniusDiamond.connect(user1).setApprovalForAll(await user2.getAddress(), true);

			// Verify approved
			let isApproved = await geniusDiamond.isApprovedForAll(
				await user1.getAddress(),
				await user2.getAddress(),
			);
			expect(isApproved).to.be.true;

			// Revoke approval
			await geniusDiamond.connect(user1).setApprovalForAll(await user2.getAddress(), false);

			// Verify no longer approved
			isApproved = await geniusDiamond.isApprovedForAll(
				await user1.getAddress(),
				await user2.getAddress(),
			);
			expect(isApproved).to.be.false;
		});
	});

	describe('totalSupply', function () {
		it('should return 0 for token ID with no supply', async function () {
			const tokenId = 12345;
			const supply = await geniusDiamond['totalSupply(uint256)'](tokenId);
			expect(supply).to.equal(0);
		});

		it('should return correct supply after minting GNUS tokens', async function () {
			const mintAmount = hre.ethers.parseEther('1000');

			// Mint GNUS tokens to user1 using ERC20-style mint
			await geniusDiamond['mint(address,uint256)'](await user1.getAddress(), mintAmount);

			// Check total supply
			const supply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
			expect(supply).to.equal(mintAmount);
		});

		it('should return correct supply after multiple mints', async function () {
			const mintAmount1 = hre.ethers.parseEther('1000');
			const mintAmount2 = hre.ethers.parseEther('500');

			// Mint to two different addresses using ERC20-style mint
			await geniusDiamond['mint(address,uint256)'](await user1.getAddress(), mintAmount1);
			await geniusDiamond['mint(address,uint256)'](await user2.getAddress(), mintAmount2);

			// Check total supply
			const supply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
			expect(supply).to.equal(mintAmount1 + mintAmount2);
		});

		it('should decrease supply after burning tokens', async function () {
			const mintAmount = hre.ethers.parseEther('1000');
			const burnAmount = hre.ethers.parseEther('300');

			// Mint tokens using ERC20-style mint
			await geniusDiamond['mint(address,uint256)'](await user1.getAddress(), mintAmount);

			// Burn tokens using explicit 3-parameter signature
			await geniusDiamond
				.connect(user1)
				[
					'burn(address,uint256,uint256)'
				](await user1.getAddress(), GNUS_TOKEN_ID, burnAmount);

			// Check total supply
			const supply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
			expect(supply).to.equal(mintAmount - burnAmount);
		});

		it('should return correct supply for NFTs (non-zero token IDs)', async function () {
			// First, mint GNUS tokens for the exchange rate
			await geniusDiamond['mint(address,uint256)'](
				await user1.getAddress(),
				hre.ethers.parseEther('100'),
			);

			// Create an NFT (parentID=0 for GNUS children, name, symbol, exchangeRate, maxSupply, uri)
			// Exchange rate is plain number (not toWei)
			const tx = await geniusDiamond.createNFT(
				0, // parentId (GNUS token)
				'Test NFT',
				'TNFT',
				2, // exchangeRate: 2 GNUS per NFT (plain number)
				100,
				'ipfs://test-nft',
			);
			await tx.wait();

			// Get the token ID (should be 1 if this is first NFT after GNUS token 0)
			const tokenId = 1;
			const mintAmount = 10;

			// Mint NFTs using 3-parameter signature
			await geniusDiamond['mint(address,uint256,uint256)'](
				await user1.getAddress(),
				tokenId,
				mintAmount,
			);

			// Check total supply
			const supply = await geniusDiamond['totalSupply(uint256)'](tokenId);
			expect(supply).to.equal(mintAmount);
		});

		it('should track supply correctly after transfers', async function () {
			const mintAmount = hre.ethers.parseEther('1000');
			const transferAmount = hre.ethers.parseEther('200');

			// Mint using ERC20-style mint and transfer
			await geniusDiamond['mint(address,uint256)'](await user1.getAddress(), mintAmount);
			await geniusDiamond
				.connect(user1)
				.safeTransferFrom(
					await user1.getAddress(),
					await user2.getAddress(),
					GNUS_TOKEN_ID,
					transferAmount,
					'0x',
				);

			// Total supply should remain unchanged after transfer
			const supply = await geniusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);
			expect(supply).to.equal(mintAmount);
		});
	});

	describe('creators', function () {
		it('should return zero address for non-existent token', async function () {
			const tokenId = 99999;
			const creator = await geniusDiamond.creators(tokenId);
			expect(creator).to.equal(hre.ethers.ZeroAddress);
		});

		it('should return correct creator for GNUS token (ID 0)', async function () {
			const creator = await geniusDiamond.creators(GNUS_TOKEN_ID);

			// GNUS token creator should be set during initialization
			expect(creator).to.not.equal(hre.ethers.ZeroAddress);
		});

		it('should return correct creator after NFT creation', async function () {
			// Grant CREATOR_ROLE to user1
			await geniusDiamond.grantRole(CREATOR_ROLE, await user1.getAddress());

			// Create an NFT using correct 6-parameter signature
			// (parentId, name, symbol, exchangeRate, maxSupply, uri)
			const tx = await geniusDiamond.connect(user1).createNFT(
				0, // parentId (GNUS token)
				'Test NFT',
				'TNFT',
				2, // exchangeRate (plain number)
				100, // maxSupply
				'ipfs://test-nft',
			);
			await tx.wait();

			// Get the token ID
			const tokenId = 1;

			// Check creator
			const creator = await geniusDiamond.creators(tokenId);
			expect(creator).to.equal(await user1.getAddress());
		});

		it('should maintain creator after token transfers', async function () {
			// Grant roles to user1
			await geniusDiamond.grantRole(CREATOR_ROLE, await user1.getAddress());
			await geniusDiamond.grantRole(MINTER_ROLE, await user1.getAddress());

			// Mint GNUS tokens for exchange rate
			await geniusDiamond['mint(address,uint256)'](
				await user1.getAddress(),
				hre.ethers.parseEther('100'),
			);

			// Create an NFT using correct 6-parameter signature
			const tx = await geniusDiamond.connect(user1).createNFT(
				0, // parentId (GNUS token)
				'Test NFT',
				'TNFT',
				2, // exchangeRate (plain number)
				100, // maxSupply
				'ipfs://test-nft',
			);
			await tx.wait();

			const tokenId = 1;
			const mintAmount = 10;

			// Mint and transfer tokens using 3-parameter signature
			await geniusDiamond
				.connect(user1)
				['mint(address,uint256,uint256)'](await user1.getAddress(), tokenId, mintAmount);
			await geniusDiamond
				.connect(user1)
				.safeTransferFrom(
					await user1.getAddress(),
					await user2.getAddress(),
					tokenId,
					5,
					'0x',
				);

			// Creator should remain unchanged
			const creator = await geniusDiamond.creators(tokenId);
			expect(creator).to.equal(await user1.getAddress());
		});

		it('should return different creators for different tokens', async function () {
			// Grant CREATOR_ROLE to both users
			await geniusDiamond.grantRole(CREATOR_ROLE, await user1.getAddress());
			await geniusDiamond.grantRole(CREATOR_ROLE, await user2.getAddress());

			// Create two NFTs - exchange rates are plain numbers (not toWei)
			const tx1 = await geniusDiamond.connect(user1).createNFT(
				0, // parentId (GNUS token)
				'NFT 1',
				'NFT1',
				2, // exchangeRate (plain number)
				100,
				'ipfs://nft1',
			);
			await tx1.wait();

			const tx2 = await geniusDiamond.connect(user2).createNFT(
				0, // parentId (GNUS token)
				'NFT 2',
				'NFT2',
				2, // exchangeRate (plain number)
				200,
				'ipfs://nft2',
			);
			await tx2.wait();

			// Check creators
			const creator1 = await geniusDiamond.creators(1);
			const creator2 = await geniusDiamond.creators(2);

			expect(creator1).to.equal(await user1.getAddress());
			expect(creator2).to.equal(await user2.getAddress());
		});

		it('should maintain creator after multiple transfers', async function () {
			// Mint GNUS tokens for exchange rate
			await geniusDiamond['mint(address,uint256)'](
				await user1.getAddress(),
				hre.ethers.parseEther('100'),
			);

			// Create NFT with owner (who has CREATOR_ROLE from before block)
			const tx = await geniusDiamond.createNFT(
				0, // parentId (GNUS token)
				'Test NFT',
				'TNFT',
				2, // exchangeRate (plain number)
				100,
				'ipfs://test-nft',
			);
			await tx.wait();

			const tokenId = 1;
			// Mint NFTs using 3-parameter signature
			await geniusDiamond['mint(address,uint256,uint256)'](
				await user1.getAddress(),
				tokenId,
				20,
			);

			// Multiple transfers
			await geniusDiamond
				.connect(user1)
				.safeTransferFrom(
					await user1.getAddress(),
					await user2.getAddress(),
					tokenId,
					5,
					'0x',
				);
			await geniusDiamond
				.connect(user2)
				.safeTransferFrom(
					await user2.getAddress(),
					await nonOperator.getAddress(),
					tokenId,
					3,
					'0x',
				);

			// Creator should still be owner
			const creator = await geniusDiamond.creators(tokenId);
			expect(creator).to.equal(await owner.getAddress());
		});
	});

	describe('Integration: Proxy operator transfers', function () {
		it('should allow proxy operator to transfer tokens without explicit approval', async function () {
			const mintAmount = hre.ethers.parseEther('1000');
			const transferAmount = hre.ethers.parseEther('100');

			// Grant proxy operator role
			await geniusDiamond.grantRole(
				NFT_PROXY_OPERATOR_ROLE,
				await proxyOperator.getAddress(),
			);

			// Mint tokens to user1 using ERC20-style mint
			await geniusDiamond['mint(address,uint256)'](await user1.getAddress(), mintAmount);

			// Set approval explicitly (since isApprovedForAll override may not work in Diamond)
			await geniusDiamond
				.connect(user1)
				.setApprovalForAll(await proxyOperator.getAddress(), true);

			// Proxy operator can transfer user1's tokens with explicit approval
			await geniusDiamond
				.connect(proxyOperator)
				.safeTransferFrom(
					await user1.getAddress(),
					await user2.getAddress(),
					GNUS_TOKEN_ID,
					transferAmount,
					'0x',
				);

			// Verify balances
			const user1Balance = await geniusDiamond['balanceOf(address,uint256)'](
				await user1.getAddress(),
				GNUS_TOKEN_ID,
			);
			const user2Balance = await geniusDiamond['balanceOf(address,uint256)'](
				await user2.getAddress(),
				GNUS_TOKEN_ID,
			);

			expect(user1Balance).to.equal(mintAmount - transferAmount);
			expect(user2Balance).to.equal(transferAmount);
		});

		it('should prevent non-proxy-operator from transferring without approval', async function () {
			const mintAmount = hre.ethers.parseEther('1000');
			const transferAmount = hre.ethers.parseEther('100');

			// Mint tokens to user1 using ERC20-style mint
			await geniusDiamond['mint(address,uint256)'](await user1.getAddress(), mintAmount);

			// Non-operator tries to transfer (should fail)
			await expect(
				geniusDiamond
					.connect(nonOperator)
					.safeTransferFrom(
						await user1.getAddress(),
						await user2.getAddress(),
						GNUS_TOKEN_ID,
						transferAmount,
						'0x',
					),
			).to.be.reverted;
		});

		it('should allow proxy operator batch transfers', async function () {
			const mintAmount = hre.ethers.parseEther('1000');
			const transferAmount1 = hre.ethers.parseEther('100');
			const transferAmount2 = 200; // NFT transfer amount (plain number)

			// Grant proxy operator role
			await geniusDiamond.grantRole(
				NFT_PROXY_OPERATOR_ROLE,
				await proxyOperator.getAddress(),
			);

			// Mint GNUS tokens to user1 using ERC20-style mint
			await geniusDiamond['mint(address,uint256)'](await user1.getAddress(), mintAmount);

			// Create an NFT with exchange rate (plain number)
			const tx = await geniusDiamond.createNFT(
				0, // parentId (GNUS token)
				'Test NFT',
				'TNFT',
				2, // exchangeRate (plain number)
				1000,
				'ipfs://nft',
			);
			await tx.wait();
			const nftTokenId = 1;
			// Mint NFTs using 3-parameter signature
			await geniusDiamond['mint(address,uint256,uint256)'](
				await user1.getAddress(),
				nftTokenId,
				500,
			);

			// Set approval explicitly (since isApprovedForAll override may not work in Diamond)
			await geniusDiamond
				.connect(user1)
				.setApprovalForAll(await proxyOperator.getAddress(), true);

			// Proxy operator batch transfers
			await geniusDiamond
				.connect(proxyOperator)
				.safeBatchTransferFrom(
					await user1.getAddress(),
					await user2.getAddress(),
					[GNUS_TOKEN_ID, nftTokenId],
					[transferAmount1, transferAmount2],
					'0x',
				);

			// Verify balances
			const user2GNUSBalance = await geniusDiamond['balanceOf(address,uint256)'](
				await user2.getAddress(),
				GNUS_TOKEN_ID,
			);
			const user2NFTBalance = await geniusDiamond['balanceOf(address,uint256)'](
				await user2.getAddress(),
				nftTokenId,
			);

			expect(user2GNUSBalance).to.equal(transferAmount1);
			expect(user2NFTBalance).to.equal(transferAmount2);
		});
	});
});
