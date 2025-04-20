import { debug } from 'debug';
import { pathExistsSync } from "fs-extra";
import { expect, assert } from 'chai';
import { ethers } from 'hardhat';
import { utils } from 'ethers';
import hre from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { JsonRpcProvider } from '@ethersproject/providers';
import { multichain } from 'hardhat-multichain';
import { getInterfaceID, toWei } from '../utils/helpers';
import { Diamond, deleteDeployInfo } from '@gnus.ai/diamonds';
import { GeniusDiamond } from '../../typechain-types';
import { GNUS_TOKEN_ID } from '../../scripts/common';
import { debuglog } from 'util';
import { ERC1155ProxyOperator } from '../../typechain-types';
import { LocalDiamondDeployer } from '../setup/LocalDiamondDeployer';

describe('ERC1155 Proxy Operator Tests', async function () {
  const diamondName = 'GeniusDiamond';
  const log: debug.Debugger = debug('GNUSDeploy:log:${diamondName}');
  this.timeout(0); // Extended indefinitely for diamond deployment time

  let chains = multichain.getProviders() || new Map<string, JsonRpcProvider>();

  if (process.argv.includes('test-multichain')) {
    const networkNames = process.argv[process.argv.indexOf('--chains') + 1].split(',');
    if (networkNames.includes('hardhat')) {
      chains.set('hardhat', ethers.provider);
    }
  } else if (process.argv.includes('test') || process.argv.includes('coverage')) {
    chains.set('hardhat', ethers.provider);
  }

  for (const [networkName, provider] of chains.entries()) {
    describe(`🔗 Chain: ${networkName}  Diamond: ${diamondName}`, function () {
      let diamond: Diamond;
      let signers: SignerWithAddress[];
      let signer0: string;
      let signer1: string;
      let signer2: string;
      let owner: string;
      let ownerSigner: SignerWithAddress;
      let geniusDiamond: GeniusDiamond;
      let signer0Diamond: GeniusDiamond;
      let signer1Diamond: GeniusDiamond;
      let signer2Diamond: GeniusDiamond;
      let ownerDiamond: GeniusDiamond;
      let erc1155ProxyOperator: GeniusDiamond;

      let ethersMultichain: typeof ethers;
      let snapshotId: string;

      before(async function () {
        const diamondDeployer = await LocalDiamondDeployer.getInstance(diamondName, networkName, provider);
        await diamondDeployer.setVerbose(true);
        diamond = await diamondDeployer.getDiamondDeployed();
        let deployedDiamondData = diamond.getDeployedDiamondData();

        const hardhatDiamondAbiPath = 'hardhat-diamond-abi/HardhatDiamondABI.sol:';
        const diamondArtifactName = `${hardhatDiamondAbiPath}${diamond.diamondName}`;
        geniusDiamond = await ethers.getContractAt(diamondArtifactName, deployedDiamondData.DiamondAddress!) as GeniusDiamond;

        ethersMultichain = ethers;
        ethersMultichain.provider = provider;

        // Retrieve the signers for the chain
        signers = await ethersMultichain.getSigners();
        signer0 = signers[0].address;
        signer1 = signers[1].address;
        signer2 = signers[2].address;
        signer0Diamond = geniusDiamond.connect(signers[0]);
        signer1Diamond = geniusDiamond.connect(signers[1]);
        signer2Diamond = geniusDiamond.connect(signers[2]);

        // get the signer for the owner
        owner = deployedDiamondData.DeployerAddress;  //  this will be = signer0 for hardhat;
        ownerSigner = await ethersMultichain.getSigner(owner);
        ownerDiamond = geniusDiamond.connect(ownerSigner);

        const ERC1155ProxyOperatorFactory = await ethers.getContractFactory('ERC1155ProxyOperator');
        // erc1155ProxyOperator = ERC1155ProxyOperatorFactory.attach(ownerDiamond.address);
        erc1155ProxyOperator = ownerDiamond;
      });

      beforeEach(async function () {
        snapshotId = await provider.send('evm_snapshot', []);
      });

      afterEach(async () => {
        await provider.send('evm_revert', [snapshotId]);
      });

      describe('isApprovedForAll', function () {
        // TODO: Implement NFT_PROXY_OPERATOR_ROLE test.
        // it('should return true if assigned operator has NFT_PROXY_OPERATOR_ROLE', async function () {
        //   await erc1155ProxyOperator.grantRole(await erc1155ProxyOperator.NFT_PROXY_OPERATOR_ROLE(), signer1);
        //   expect(await erc1155ProxyOperator.isApprovedForAll(signer2, signer1)).to.be.true;
        // });

        it('should return false if operator does not have NFT_PROXY_OPERATOR_ROLE and is not approved', async function () {
          expect(await erc1155ProxyOperator.isApprovedForAll(signer2, signer1)).to.be.false;
        });

        it('should return true if operator is approved', async function () {
          await erc1155ProxyOperator.setApprovalForAll(signer1, true);
          expect(await erc1155ProxyOperator.isApprovedForAll(owner, signer1)).to.be.true;
        });
      });

      describe('totalSupply', function () {
        // TODO: Implement ERC1155ProxyOperator totalSupply test.
        // it('should return the total supply of a given token ID', async function () {
        //   const tokenId = 1;
        //   const amount = 100;

        //   // Mint tokens to set the total supply
        //   await erc1155ProxyOperator['mint(address,uint256,uint256,bytes)'](owner, tokenId, amount, '0x');
        //   expect(await erc1155ProxyOperator['totalSupply(uint256)'](tokenId)).to.equal(amount);
        // });

        it('should return zero if no tokens have been minted for the given token ID', async function () {
          const tokenId = 1;
          expect(await erc1155ProxyOperator['totalSupply(uint256)'](tokenId)).to.equal(0);
        });
      });

      describe('creators', function () {


        // TODO: Implement ERC1155ProxyOperator creators test.
        // it('should return the creator of a given token ID', async function () {
        // // Assign the creator role to the signer 
        //   const tokenId = 1;
        //   const creator = signer1;

        //   // Set the creator for the token ID
        //   expect(await erc1155ProxyOperator.creators(tokenId)).to.equal(creator);
        // });

        it('should return the zero address if no creator has been set for the given token ID', async function () {
          const tokenId = 1;
          expect(await erc1155ProxyOperator.creators(tokenId)).to.equal(ethers.constants.AddressZero);
        });
      });
    });
  };
});
