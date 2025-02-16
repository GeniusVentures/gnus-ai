import { ethers, network } from 'hardhat';
import { BigNumber, utils } from 'ethers';
import {dc,debuglog,GNUS_TOKEN_ID,expect,toBN,toWei,} from '../../../../scripts/common';
import { assert } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { GeniusDiamond } from '../../../../typechain-types/GeniusDiamond';
import MultiChainTestDeployer from '../setup/multichainTestDeployer';
import { multichain } from 'hardhat-multichain';
import { deployments } from '../../../../scripts/deployments';
import { debug } from 'debug';
import { JsonRpcProvider } from '@ethersproject/providers';

describe('ERC20 Batch Transfer Tests', async function () {
  this.timeout(0); // Extend timeout for deployments and testing
  const log: debug.Debugger = debug('GNUSDeploy:log');
  
  let chains = multichain.getProviders() ?? new Map<string, JsonRpcProvider>();
  // Check the process.argv for the Hardhat network name
  if (process.argv.includes('test-multichain')) {
    const chainNames = process.argv[process.argv.indexOf('--chains') + 1].split(',');
    if (chainNames.includes('hardhat')) {
      chains = chains.set('hardhat', ethers.provider);
      
    }
  } else if (process.argv.includes('test')) {
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
         
      });
    
      beforeEach(async function () {
        snapshotId = await provider.send('evm_snapshot', []);
      });
      
      afterEach(async () => {
        await provider.send('evm_revert', [snapshotId]);
      });
        
      it('Batch Transferring to two addresses', async () => {
        
        const preTransferBalance0 = await gnusDiamond['balanceOf(address,uint256)'](
          signer2,
          GNUS_TOKEN_ID,
        );
        const preTransferBalance1 = await gnusDiamond['balanceOf(address,uint256)'](
          signer1,
          GNUS_TOKEN_ID,
        );
        // Test case to verify batch transfers of ERC20 tokens.
        let balance = await (await gnusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID)).toBigInt();
        debuglog(`Owner balance before transfer1: ${balance.toString()}`);
        // Mint 150 GNUS tokens to the owner’s address and verify the updated balance.
        await ownerDiamond['mint(address,uint256)'](owner, toWei(150));
        balance = await (await gnusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID)).toBigInt();
        debuglog(`Owner balance after transfer2: ${balance.toString()}`);
        // Execute a batch transfer to `signer2` and `signer1` with specified token amounts.
        await ownerDiamond.transferBatch(
          [signer2, signer1],
          [toWei(2), toWei(1)],
        );
        
        balance = await (await gnusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID)).toBigInt();
        debuglog(`Owner balance3: ${balance.toString()}`);
        // Retrieve updated balances for `signer2` and `signer1`.
        const updatedAmount1 = await gnusDiamond['balanceOf(address,uint256)'](
          signer2,
          GNUS_TOKEN_ID,
        );
        const updatedAmount2 = await gnusDiamond['balanceOf(address,uint256)'](
          signer1,
          GNUS_TOKEN_ID,
        );
        
        balance = await (await gnusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID)).toBigInt();
        debuglog(`Owner balance4: ${balance.toString()}`);
        // Assert that the updated balances match the expected values after the transfer.
        assert(
          updatedAmount1.eq(toWei(2).add(preTransferBalance1)),
          `Address 1 should equal ${utils.formatEther(
            toWei(2).add(preTransferBalance1),
          )}, but equals ${utils.formatEther(updatedAmount1)}`,
        );
        
        balance = await (await gnusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID)).toBigInt();
        debuglog(`Owner balance5: ${balance.toString()}`);
        assert(
          updatedAmount2.eq(toWei(1).add(preTransferBalance1)),
          `Address 2 should equal ${utils.formatEther(
            toWei(1).add(preTransferBalance1),
          )}, but equals ${utils.formatEther(updatedAmount2)}`,
        );
        
        balance = await (await gnusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID)).toBigInt();
        debuglog(`Owner balance6: ${balance.toString()}`);
      });
        
      // Test case to verify the blocking and unblocking of transfers.
      it('Block Transfer Series', async () => {
        // Fetch the owner's balance and mint additional tokens to the owner's account.
        let balance = await(await gnusDiamond['balanceOf(address)'](owner)).toBigInt();
        debuglog(`Owner balance before transfer: ${balance.toString()}`);
        
        await ownerDiamond['mint(address,uint256)'](owner, toWei(100));
        balance = await (await gnusDiamond['balanceOf(address)'](owner)).toBigInt();
        let expectedBalance = toWei(100).toBigInt();
        debuglog(`Owner balance after transfer of ${expectedBalance}: ${balance.toString()}`);
        debuglog(`Expected balance: ${expectedBalance.toString()}`);
        
        // Assert that the owner's balance exceeds 100 after minting.
        expect(balance).to.be.eq(expectedBalance);
        
        // Transfer tokens to `signer2` and verify their balance.
        let receiverBalance = await (await gnusDiamond['balanceOf(address)'](signer2)).toBigInt();
        await ownerDiamond.transfer(signer2, toWei(10));
        receiverBalance = await (await gnusDiamond['balanceOf(address)'](signer2)).toBigInt() ;
        expectedBalance = toWei(10).toBigInt();
        // Expect the receiver's balance to match the transferred amount.
        expect(receiverBalance).to.be.eq(expectedBalance);
        
        // Block the owner from transferring tokens and verify the restriction.
        await ownerDiamond.banTransferorForAll(signer2);
        await expect(signer2Diamond.transfer(signer1, toWei(1))).to.be.rejectedWith(
            Error,
            'Blocked transferor',
        );

        // Unblock the owner and retry the transfer.
        await ownerDiamond.allowTransferorForAll(signer2);
        await expect(signer2Diamond.transfer(signer1, toWei(1))).to.be.fulfilled;

        // Block the owner using a batch transfer restriction and verify.
        await ownerDiamond.banTransferorBatch([0], [signer2]);
        await expect(signer2Diamond.transfer(signer1, toWei(1))).to.be.rejectedWith(
          Error,
          'Blocked transferor',
        );
        
        // Remove the batch restriction and verify successful transfer.
        await ownerDiamond.allowTransferorBatch([0], [signer2]);
        await expect(signer2Diamond.transfer(signer1, toWei(1))).to.be.fulfilled;
        
      });
    });     
  }
  
  // Hook to execute additional test suites after this one completes.
  after(() => {
    // Uncomment if additional tests are to be executed sequentially.
    // NFTMintTests.suite();
  });
});
