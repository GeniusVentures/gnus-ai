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
import { IERC20Upgradeable__factory } from '../../typechain-types';
import { LocalDiamondDeployer } from '../setup/LocalDiamondDeployer';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);

describe('Multichain GNUS ERC20 Hybrid Tests', async function () {
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

      it('should verify GNUS ERC20 interface compatibility on all chains', async function () {
        console.log(`Validating ERC20 interface on chain: ${networkName}`);

        const IERC20UpgradeableInterface = IERC20Upgradeable__factory.createInterface();
        // Generate the ERC20 interface ID by XORing with the base interface ID.
        const IERC20InterfaceID = getInterfaceID(IERC20UpgradeableInterface);
        // Assert that the `geniusDiamond` contract supports the ERC20 interface.
        assert(
          await geniusDiamond?.supportsInterface(IERC20InterfaceID._hex),
          "Doesn't support IERC20Upgradeable",
        );

        // Test ERC165 interface compatibility for ERC20 '0x37c8e2a0'
        const supportsERC20 = await geniusDiamond?.supportsInterface(IERC20InterfaceID._hex);
        expect(supportsERC20).to.be.true;

        const OwnerBalance = await geniusDiamond['balanceOf(address)'](owner);
        console.log(`ERC20 interface validated on ${networkName}`);
      });

      it('should verify MINTER role is set for the owner on all chains', async function () {
        console.log(`Verifying MINTER role on chain: ${networkName}`);
        const ownershipFacet = await ethersMultichain.getContractAt('GeniusOwnershipFacet', geniusDiamond.address);
        const minterRole = await geniusDiamond['MINTER_ROLE']();
        const owner = await ownershipFacet.connect(ownerSigner).owner();
        const hasMinterRole = await ownershipFacet.hasRole(minterRole, owner);
        expect(hasMinterRole).to.be.true;
      });

      it(`should mint and transfer GNUS tokens correctly on ${networkName}`, async function () {
        console.log(`Testing mint and transfer on chain: ${networkName}`);
        // Fetch the owner's balance. 
        // This may be non-zero on forked chains so comparisons must take this into account.
        let initBalance = await (await geniusDiamond['balanceOf(address)'](owner)).toBigInt();
        // Mint GNUS tokens
        await ownerDiamond['mint(address,uint256)'](owner, toWei(150));
        const updatedOwnerBalance = await (await geniusDiamond['balanceOf(address)'](owner));
        const expectedBalance = initBalance + toWei(150).toBigInt();
        expect(updatedOwnerBalance.eq(expectedBalance));

        // Transfer GNUS tokens
        await ownerDiamond.transfer(signer2, toWei(150));
        const recipientBalance = await ownerDiamond['balanceOf(address)'](signer2);
        expect(recipientBalance.eq(toWei(150))).to.be.true;
      });

      it('should handle transferFrom and approval correctly on all chains', async function () {
        console.log(`Testing transferFrom and approval on chain: ${networkName}`);
        // transferFrom expect to fail because signer2 trying to transferFrom without approval
        await expect(signer2Diamond.transferFrom(signer1, signer0, toWei(150))).to.eventually.be.rejectedWith(Error, /ERC20: insufficient allowance/);

        // Mint GNUS tokens to signer2    
        await ownerDiamond['mint(address,uint256)'](signer2, toWei(100));
        // Signer2 Approves transferFrom by owner
        await signer2Diamond.approve(owner, toWei(10));
        // Owner transfers GNUS tokens from signer2 to signer0
        await expect(ownerDiamond.transferFrom(signer2, signer0, toWei(10))
        ).to.eventually.be.fulfilled;

        // Attempt transfer beyond allowance
        await expect(ownerDiamond.transferFrom(signer2, signer0, toWei(200))
        ).to.eventually.be.rejectedWith(Error, /ERC20: insufficient allowance/);

        // setApprovalForAll is for 1155 and 721 tokens so it should fail.  Probably unnecessary test
        await signer2Diamond.setApprovalForAll(owner, true);

        // Transfer all tokens
        await expect(ownerDiamond.transferFrom(signer2, signer0, toWei(90))
        ).to.eventually.be.rejectedWith(Error, /ERC20: insufficient allowance/);
      });
    });
  }
});
