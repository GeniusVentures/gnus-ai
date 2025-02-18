import { debug } from 'debug';
import { ethers } from 'hardhat';
import { expect, assert } from 'chai';
import { utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { JsonRpcProvider } from '@ethersproject/providers';
import { multichain } from 'hardhat-multichain';
import { debuglog, GNUS_TOKEN_ID, toWei, } from '../../scripts/common';
import MultiChainTestDeployer from '../setup/multichainTestDeployer';
import { deployments } from '../../scripts/deployments';
import { GeniusDiamond } from '../../typechain-types/GeniusDiamond';
import { ERC1155ProxyOperator } from '../../typechain-types';

describe('ERC1155 Proxy Operator Tests', async function () {
  this.timeout(0); // Extend timeout for deployments and testing
  const log: debug.Debugger = debug('GNUSDeploy:log');
  let chains = multichain.getProviders() ?? new Map<string, JsonRpcProvider>();

  // Check the process.argv for the Hardhat network name

  if (process.argv.includes('test-multichain')) {
    const chainNames = process.argv[process.argv.indexOf('--chains') + 1].split(',');
    if (chainNames.includes('hardhat')) {
      chains = chains.set('hardhat', ethers.provider);
    }
  } else if (process.argv.includes('test') || process.argv.includes('coverage')) {
    chains = chains.set('hardhat', ethers.provider);
  }

  for (const [chainName, provider] of chains.entries()) {
    
    describe(`${chainName} ERC20 Batch Transfers`, async function () {
      let deployer: MultiChainTestDeployer;
      let deployment: boolean | void;
      let upgrade: boolean | void;
      let signers: SignerWithAddress[];
      let signer0: string;
      let signer1: string;
      let signer2: string;
      let signer0Diamond: GeniusDiamond;
      let signer1Diamond: GeniusDiamond;
      let signer2Diamond: GeniusDiamond;
      // get the signer for the owner
      let owner: string;
      let ownerSigner: SignerWithAddress;
      let ownerDiamond: GeniusDiamond;
      let gnusDiamond: GeniusDiamond;

      let ethersMultichain: typeof ethers;
      let snapshotId: string;

      let erc1155ProxyOperator: GeniusDiamond;

      before(async function () {
        const deployConfig = {
          chainName: chainName,
          provider: provider,
        };
        deployer = await MultiChainTestDeployer.getInstance(deployConfig);
        deployment = await deployer.deploy();
        expect(deployment).to.be.true;
        upgrade = await deployer.upgrade();
        expect(upgrade).to.be.true;
        // Retrieve the deployed GNUS Diamond contract
        gnusDiamond = await deployer.getDiamond();
        if (!gnusDiamond) {
          throw new Error(`gnusDiamond is null for chain ${chainName}`);
        }

        ethersMultichain = ethers;
        ethersMultichain.provider = provider;

        // Retrieve the signers for the chain
        signers = await ethersMultichain.getSigners();
        signer0 = signers[0].address;
        signer1 = signers[1].address;
        signer2 = signers[2].address;
        signer0Diamond = gnusDiamond.connect(signers[0]);
        signer1Diamond = gnusDiamond.connect(signers[1]);
        signer2Diamond = gnusDiamond.connect(signers[2]);

        // get the signer for the owner
        owner = deployments[chainName]?.DeployerAddress || signer0;
        ownerSigner = await ethersMultichain.getSigner(owner);
        ownerDiamond = gnusDiamond.connect(ownerSigner);
      
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
  