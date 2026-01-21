import { Diamond } from '@diamondslab/diamonds';
import {
    loadDiamondContract,
    LocalDiamondDeployer,
} from '@diamondslab/hardhat-diamonds/dist/utils';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { GeniusDiamond } from '../../diamond-typechain-types';
import { toWei } from '../../scripts/utils/helpers';

describe('GNUSNFTFactory Enhanced Tests', function () {
	const diamondName = 'GeniusDiamond';
	let diamond: Diamond;
	let diamondAddress: string;
	let geniusDiamond: GeniusDiamond;
	let owner: SignerWithAddress;
	let creator: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let initialSnapshotId: string;
	let testSnapshotId: string;

	before(async function () {
		const config = {
			diamondName: 'GeniusDiamond',
			network: 'hardhat',
		};

		const deployer = await LocalDiamondDeployer.getInstance(hre, config);
		diamond = await deployer.getDiamondDeployed();
		const deployedData = diamond.getDeployedDiamondData();
		diamondAddress = deployedData.DiamondAddress || '';

		geniusDiamond = await loadDiamondContract<GeniusDiamond>(
			diamond,
			diamondAddress,
			hre.ethers,
		);

		[owner, creator, user1, user2] = await ethers.getSigners();

		// Take initial snapshot
		initialSnapshotId = await hre.network.provider.send('evm_snapshot');
        
		// Grant CREATOR_ROLE to creator
		const CREATOR_ROLE = await geniusDiamond.CREATOR_ROLE();
		await geniusDiamond.grantRole(CREATOR_ROLE, creator.address);
	});

	beforeEach(async function () {
		testSnapshotId = await hre.network.provider.send('evm_snapshot');
	});

	afterEach(async function () {
		await hre.network.provider.send('evm_revert', [testSnapshotId]);
	});

	after(async function () {
		await hre.network.provider.send('evm_revert', [initialSnapshotId]);
	});

	describe('NFT Creation Edge Cases', function () {
		it('should revert when creating NFT with zero exchange rate', async function () {
			await expect(
				geniusDiamond.connect(creator).createNFT(
					0, // parent = GNUS
					'Zero Rate NFT',
					'ZERO',
					0, // exchangeRate = 0 (invalid)
					10000,
					'ipfs://zero-rate',
				),
			).to.be.revertedWith(
				'Exchange Rate has to be > 0 for creating a new Child NFT of GNUS',
			);
		});

		it('should allow creating NFT with zero max supply', async function () {
			await geniusDiamond.connect(creator).createNFT(
				0,
				'Zero Supply NFT',
				'ZSUP',
				2,
				0, // maxSupply = 0 (edge case, should be allowed)
				'ipfs://zero-supply',
			);

			const nftInfo = await geniusDiamond.getNFTInfo(1);
			expect(nftInfo.maxSupply).to.equal(0);
		});

		it('should revert when non-creator tries to create child of GNUS', async function () {
			await expect(
				geniusDiamond
					.connect(user1)
					.createNFT(0, 'Unauthorized NFT', 'UNAUTH', 2, 10000, 'ipfs://unauth'),
			).to.be.revertedWith('Only Creators or Admins can create NFT child of GNUS');
		});

		it('should allow admin to create child of GNUS without CREATOR_ROLE', async function () {
			await geniusDiamond
				.connect(owner)
				.createNFT(0, 'Admin NFT', 'ADMIN', 2, 10000, 'ipfs://admin');

			const nftInfo = await geniusDiamond.getNFTInfo(1);
			expect(nftInfo.name).to.equal('Admin NFT');
		});

		it('should revert when creating child of non-existent parent', async function () {
			await expect(
				geniusDiamond.connect(creator).createNFT(
					999, // non-existent parent
					'Orphan NFT',
					'ORPHAN',
					2,
					10000,
					'ipfs://orphan',
				),
			).to.be.revertedWith('Parent NFT Should have been created already');
		});
	});

	describe('Hierarchical NFT Structures', function () {
		it('should create child of child (multi-level hierarchy)', async function () {
			// Create parent NFT (child of GNUS)
			await geniusDiamond
				.connect(creator)
				.createNFT(0, 'Parent NFT', 'PARENT', 2, 10000, 'ipfs://parent');

			// TokenId 1 is the parent NFT
			const parentId = 1;

			// Create child of the parent NFT
			await geniusDiamond
				.connect(creator)
				.createNFT(parentId, 'Child NFT', 'CHILD', 3, 5000, 'ipfs://child');

			// Child tokenId should be (1 << 128) | 0
			const expectedChildId = (BigInt(1) << BigInt(128)) | BigInt(0);
			const childInfo = await geniusDiamond.getNFTInfo(expectedChildId);
			expect(childInfo.name).to.equal('Child NFT');
			expect(childInfo.exchangeRate).to.equal(3);
		});

		it('should only allow parent creator to create children of their NFT', async function () {
			// Creator creates parent
			await geniusDiamond
				.connect(creator)
				.createNFT(0, 'Creator Parent', 'CPARENT', 2, 10000, 'ipfs://cparent');

			const parentId = 1;

			// User1 tries to create child of creator's NFT
			await expect(
				geniusDiamond
					.connect(user1)
					.createNFT(parentId, 'Unauthorized Child', 'UCHILD', 3, 5000, 'ipfs://uchild'),
			).to.be.revertedWith('Only parent creator can create child NFTs');
		});

		it('should track childCurIndex correctly across multiple children', async function () {
			await geniusDiamond
				.connect(creator)
				.createNFT(0, 'Parent', 'PAR', 2, 10000, 'ipfs://par');

			const parentId = 1;
			let parentInfo = await geniusDiamond.getNFTInfo(parentId);
			expect(parentInfo.childCurIndex).to.equal(0);

			// Create first child
			await geniusDiamond
				.connect(creator)
				.createNFT(parentId, 'Child1', 'CH1', 3, 1000, 'ipfs://ch1');

			parentInfo = await geniusDiamond.getNFTInfo(parentId);
			expect(parentInfo.childCurIndex).to.equal(1);

			// Create second child
			await geniusDiamond
				.connect(creator)
				.createNFT(parentId, 'Child2', 'CH2', 4, 2000, 'ipfs://ch2');

			parentInfo = await geniusDiamond.getNFTInfo(parentId);
			expect(parentInfo.childCurIndex).to.equal(2);
		});
	});

	describe('Batch NFT Creation', function () {
		it('should create multiple NFTs in one transaction', async function () {
			await geniusDiamond
				.connect(creator)
				.createNFTs(
					0,
					['NFT1', 'NFT2', 'NFT3'],
					['N1', 'N2', 'N3'],
					[2, 3, 4],
					[1000, 2000, 3000],
					['ipfs://1', 'ipfs://2', 'ipfs://3'],
				);

			const nft1 = await geniusDiamond.getNFTInfo(1);
			const nft2 = await geniusDiamond.getNFTInfo(2);
			const nft3 = await geniusDiamond.getNFTInfo(3);

			expect(nft1.name).to.equal('NFT1');
			expect(nft2.name).to.equal('NFT2');
			expect(nft3.name).to.equal('NFT3');
		});

		it("should revert when array lengths don't match", async function () {
			await expect(
				geniusDiamond.connect(creator).createNFTs(
					0,
					['NFT1', 'NFT2'],
					['N1'], // Mismatched length
					[2, 3],
					[1000, 2000],
					['ipfs://1', 'ipfs://2'],
				),
			).to.be.revertedWith('NFT creation array lengths, should be the same');
		});

		it('should revert if any exchange rate is zero for GNUS children', async function () {
			await expect(
				geniusDiamond.connect(creator).createNFTs(
					0,
					['NFT1', 'NFT2'],
					['N1', 'N2'],
					[2, 0], // Second has zero exchange rate
					[1000, 2000],
					['ipfs://1', 'ipfs://2'],
				),
			).to.be.revertedWith(
				'Exchange Rate has to be > 0 for creating a new Child NFT of GNUS',
			);
		});
	});

	describe('URI Management', function () {
		it('should allow creator to set URI for their NFT', async function () {
			await geniusDiamond
				.connect(creator)
				.createNFT(0, 'Test NFT', 'TEST', 2, 10000, 'ipfs://original');

			const tokenId = 1;
			const newUri = 'ipfs://updated';

			await geniusDiamond.connect(creator)['setURI(uint256,string)'](tokenId, newUri);

			const uri = await geniusDiamond.uri(tokenId);
			expect(uri).to.equal(newUri);
		});

		it('should allow admin to set URI for any NFT', async function () {
			await geniusDiamond
				.connect(creator)
				.createNFT(0, 'Test NFT', 'TEST', 2, 10000, 'ipfs://original');

			const tokenId = 1;
			const newUri = 'ipfs://admin-updated';

			await geniusDiamond.connect(owner)['setURI(uint256,string)'](tokenId, newUri);

			const uri = await geniusDiamond.uri(tokenId);
			expect(uri).to.equal(newUri);
		});

		it('should revert when non-creator/non-admin tries to set URI', async function () {
			await geniusDiamond
				.connect(creator)
				.createNFT(0, 'Test NFT', 'TEST', 2, 10000, 'ipfs://original');

			const tokenId = 1;

			await expect(
				geniusDiamond.connect(user1)['setURI(uint256,string)'](tokenId, 'ipfs://hacked'),
			).to.be.revertedWith('Only Admin or Creator can set URI of NFT');
		});

		it('should revert when getting URI for non-existent NFT', async function () {
			await expect(geniusDiamond.uri(999)).to.be.revertedWith(
				'NFT must already be created to get the URI for it',
			);
		});

		it('should handle empty URIs correctly', async function () {
			await geniusDiamond.connect(creator).createNFT(
				0,
				'Empty URI NFT',
				'EMPTY',
				2,
				10000,
				'', // Empty URI
			);

			const uri = await geniusDiamond.uri(1);
			expect(uri).to.equal('');
		});
	});

	describe('Pause/Unpause Functionality', function () {
		it('should allow admin to pause contract', async function () {
			await geniusDiamond.connect(owner).pause();
			expect(await geniusDiamond.paused()).to.be.true;
		});

		it('should allow admin to unpause contract', async function () {
			await geniusDiamond.connect(owner).pause();
			await geniusDiamond.connect(owner).unpause();
			expect(await geniusDiamond.paused()).to.be.false;
		});

		it('should revert when non-admin tries to pause', async function () {
			await expect(geniusDiamond.connect(user1).pause()).to.be.reverted; // Will revert with access control error
		});

		it('should revert when non-admin tries to unpause', async function () {
			await geniusDiamond.connect(owner).pause();
			await expect(geniusDiamond.connect(user1).unpause()).to.be.reverted;
		});

		it('should prevent minting when paused', async function () {
			// Create NFT first
			await geniusDiamond
				.connect(creator)
				.createNFT(0, 'Test NFT', 'TEST', 2, 10000, 'ipfs://test');

			// Mint GNUS for burning
			await geniusDiamond['mint(address,uint256)'](creator.address, toWei(100));

			// Pause
			await geniusDiamond.connect(owner).pause();

			// Try to mint - should fail
			await expect(
				geniusDiamond
					.connect(creator)
					['mint(address,uint256,uint256,bytes)'](user1.address, 1, 10, '0x'),
			).to.be.revertedWith('Pausable: paused');
		});
	});

	describe('Minting with Exchange Rates', function () {
		it('should burn correct amount of GNUS when minting child NFT', async function () {
			// Create NFT with exchange rate of 2
			await geniusDiamond
				.connect(creator)
				.createNFT(0, 'Rate 2 NFT', 'R2', 2, 10000, 'ipfs://r2');

			// Mint GNUS to creator
			await geniusDiamond['mint(address,uint256)'](creator.address, toWei(200));

			const initialBalance = await geniusDiamond['balanceOf(address)'](creator.address);

			// Mint 10 NFTs (should burn 20 GNUS)
			await geniusDiamond
				.connect(creator)
				['mint(address,uint256,uint256,bytes)'](user1.address, 1, 10, '0x');

			const finalBalance = await geniusDiamond['balanceOf(address)'](creator.address);
			expect(initialBalance - finalBalance).to.equal(20); // 10 * 2
		});

		it('should revert when creator has insufficient GNUS to burn', async function () {
			await geniusDiamond
				.connect(creator)
				.createNFT(0, 'Expensive NFT', 'EXP', 100, 10000, 'ipfs://exp');

			// Mint only 50 GNUS (need 1000 for 10 NFTs at rate 100)
			await geniusDiamond['mint(address,uint256)'](creator.address, 50);

			await expect(
				geniusDiamond
					.connect(creator)
					['mint(address,uint256,uint256,bytes)'](user1.address, 1, 10, '0x'),
			).to.be.revertedWith('Not enough GNUS_TOKEN to burn');
		});

		it('should only allow creator or admin to mint NFT', async function () {
			await geniusDiamond
				.connect(creator)
				.createNFT(0, 'Restricted NFT', 'REST', 2, 10000, 'ipfs://rest');

			await geniusDiamond['mint(address,uint256)'](user1.address, toWei(100));

			await expect(
				geniusDiamond
					.connect(user1)
					['mint(address,uint256,uint256,bytes)'](user2.address, 1, 10, '0x'),
			).to.be.revertedWith('Creator or Admin can only mint NFT');
		});
	});

	describe('Max Supply Enforcement', function () {
		it('should enforce max supply when minting', async function () {
			await geniusDiamond.connect(creator).createNFT(
				0,
				'Limited NFT',
				'LTD',
				2,
				100, // maxSupply = 100
				'ipfs://ltd',
			);

			await geniusDiamond['mint(address,uint256)'](creator.address, toWei(1000));

			// Mint 100 NFTs (at max)
			await geniusDiamond
				.connect(creator)
				['mint(address,uint256,uint256,bytes)'](user1.address, 1, 100, '0x');

			// Try to mint 1 more - should fail
			await expect(
				geniusDiamond
					.connect(creator)
					['mint(address,uint256,uint256,bytes)'](user1.address, 1, 1, '0x'),
			).to.be.revertedWith('Max Supply for NFT would be exceeded');
		});

		it('should track total supply correctly across multiple mints', async function () {
			await geniusDiamond
				.connect(creator)
				.createNFT(0, 'Track Supply NFT', 'TRACK', 2, 1000, 'ipfs://track');

			await geniusDiamond['mint(address,uint256)'](creator.address, toWei(2000));

			// Mint in batches
			await geniusDiamond
				.connect(creator)
				['mint(address,uint256,uint256,bytes)'](user1.address, 1, 300, '0x');

			await geniusDiamond
				.connect(creator)
				['mint(address,uint256,uint256,bytes)'](user2.address, 1, 500, '0x');

			const totalSupply = await geniusDiamond['totalSupply(uint256)'](1);
			expect(totalSupply).to.equal(800);
		});
	});

	describe('NFT Info Retrieval', function () {
		it('should return correct NFT info', async function () {
			const name = 'Info Test NFT';
			const symbol = 'INFO';
			const exchangeRate = 5;
			const maxSupply = 5000;
			const uri = 'ipfs://info-test';

			await geniusDiamond
				.connect(creator)
				.createNFT(0, name, symbol, exchangeRate, maxSupply, uri);

			const nftInfo = await geniusDiamond.getNFTInfo(1);
			expect(nftInfo.name).to.equal(name);
			expect(nftInfo.symbol).to.equal(symbol);
			expect(nftInfo.exchangeRate).to.equal(exchangeRate);
			expect(nftInfo.maxSupply).to.equal(maxSupply);
			expect(nftInfo.uri).to.equal(uri);
			expect(nftInfo.creator).to.equal(creator.address);
			expect(nftInfo.nftCreated).to.be.true;
		});

		it('should revert when getting info for non-existent NFT', async function () {
			await expect(geniusDiamond.getNFTInfo(999)).to.be.revertedWith(
				'No Token created for this ID',
			);
		});
	});

	describe('GNUS Token Minting Restriction', function () {
		it('should prevent direct minting of GNUS token (tokenId 0)', async function () {
			await expect(
				geniusDiamond.connect(owner)['mint(address,uint256,uint256,bytes)'](
					user1.address,
					0, // GNUS tokenId
					toWei(100),
					'0x',
				),
			).to.be.revertedWith("Shouldn't mint GNUS tokens tokens, only deposit and withdraw");
		});
	});
});
