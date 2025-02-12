import { ethers, network } from 'hardhat';
import { BigNumber, utils } from 'ethers';
import {
  dc,
  debuglog,
  GNUS_TOKEN_ID,
  expect,
  toBN,
  toWei,
} from '../../../../scripts/common';
import { assert } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { GeniusDiamond } from '../../../../typechain-types/GeniusDiamond';
import MultiChainTestDeployer from '../setup/multichainTestDeployer';
import { multichain } from 'hardhat-multichain';
import { deployments } from '../../../../scripts/deployments';
import { debug } from 'debug';

describe('Testing Batch transfer erc20', async function () {
  this.timeout(0); // Extend timeout for deployments and testing
  const log: debug.Debugger = debug('GNUSDeploy:log');

  // Get the existing providers for each chain created by the Hardhat-Multichain 
  const chains = multichain.getProviders();
  
  // Create maps to store the deployed diamond contracts, snapshots, signers, and owners
  // const diamonds: Map<string, GeniusDiamond> = new Map();
  const ethersMultichain = ethers;
  const snapshots: Map<string, string> = new Map();
  const signers: Map<string, SignerWithAddress[]> = new Map();
  const owners: Map<string, string> = new Map();
  const ownerSigners: Map<string, SignerWithAddress> = new Map();
  
  for (const [chainName, provider] of chains.entries()) {
    const { chainId } = await provider.getNetwork();
    const deployConfig = {
      chainName: chainName,
      provider: provider,
    };
    const deployer = MultiChainTestDeployer.getInstance(deployConfig);
    await deployer.deploy();
    await deployer.upgrade();
    // Retrieve the deployed GNUS Diamond contract
    const gnusDiamond = await deployer.getDiamond();    
    if (!gnusDiamond) {
      throw new Error(`gnusDiamond is null for chain ${chainName}`);
    }
    
    let ethersMultichain = ethers;
    ethersMultichain.provider = provider;
    
    // Retrieve the signers for the chain
    const signers = await ethersMultichain.getSigners();
    const signer0 = signers[0].address;
    const signer1 = signers[1].address;
    const signer0Diamond = gnusDiamond.connect(signers[0]);
    const signer1Diamond = gnusDiamond.connect(signers[1]);
    // get the signer for the owner
    const owner = deployments[chainName].DeployerAddress;
    const ownerSigner = await ethersMultichain.getSigner(owner);
    const ownerDiamond = gnusDiamond.connect(ownerSigner);
    
    describe(`Chain: ${chainName}`, async function () {
      // The snapshot ID to revert to the initial state after each test.
      let snapshotId: string;
      beforeEach(async function () {
        snapshotId = await provider.send('evm_snapshot', []);
      });
      
      afterEach(async () => {
        await provider.send('evm_revert', [snapshotId]);
      });
        
      it('Batch Transferring to two addresses', async () => {
        
        const preTransferBalance0 = await gnusDiamond['balanceOf(address,uint256)'](
          signer0,
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
        // Execute a batch transfer to `signer0` and `signer1` with specified token amounts.
        await ownerDiamond.transferBatch(
          [signer0, signer1],
          [toWei(2), toWei(1)],
        );
        
        balance = await (await gnusDiamond['balanceOf(address,uint256)'](owner, GNUS_TOKEN_ID)).toBigInt();
        debuglog(`Owner balance3: ${balance.toString()}`);
        // Retrieve updated balances for `signer0` and `signer1`.
        const updatedAmount1 = await gnusDiamond['balanceOf(address,uint256)'](
          signer0,
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
        
        // Transfer tokens to `signer0` and verify their balance.
        let receiverBalance = await (await gnusDiamond['balanceOf(address)'](signer0)).toBigInt();
        await ownerDiamond.transfer(signer0, toWei(10));
        receiverBalance = await (await gnusDiamond['balanceOf(address)'](signer0)).toBigInt() ;
        expectedBalance = toWei(10).toBigInt();
        // Expect the receiver's balance to match the transferred amount.
        expect(receiverBalance).to.be.eq(expectedBalance);
        
        // Block the owner from transferring tokens and verify the restriction.
        await ownerDiamond.banTransferorForAll(signer0);
        await expect(signer0Diamond.transfer(signer1, toWei(1))).to.be.rejectedWith(
            Error,
            'Blocked transferor',
        );

        // Unblock the owner and retry the transfer.
        await ownerDiamond.allowTransferorForAll(signer0);
        await expect(signer0Diamond.transfer(signer1, toWei(1))).to.be.fulfilled;

        // Block the owner using a batch transfer restriction and verify.
        await ownerDiamond.banTransferorBatch([0], [signer0]);
        await expect(signer0Diamond.transfer(signer1, toWei(1))).to.be.rejectedWith(
          Error,
          'Blocked transferor',
        );
        
        // Remove the batch restriction and verify successful transfer.
        await ownerDiamond.allowTransferorBatch([0], [signer0]);
        await expect(signer0Diamond.transfer(signer1, toWei(1))).to.be.fulfilled;
        
      });
    });     
  }
  
  // Hook to execute additional test suites after this one completes.
  after(() => {
    // Uncomment if additional tests are to be executed sequentially.
    // NFTMintTests.suite();
  });
});
