import { expect, assert } from 'chai';
import MultiChainTestDeployer from '../setup/multichainTestDeployer';
import { ethers } from 'hardhat';
import { debug } from 'debug';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployments } from '../../../../scripts/deployments';
import { IERC20Upgradeable__factory } from '../../../../typechain-types';
import { getInterfaceID } from '../../../../scripts/FacetSelectors';
import { multichain } from 'hardhat-multichain';
import { GeniusDiamond } from '../../../../typechain-types/GeniusDiamond';
import hre from 'hardhat';

describe('Multichain Fork and Diamond Deployment Tests', async function () {
  const log: debug.Debugger = debug('GNUSDeploy:log');
  this.timeout(0); // Extend timeout to accommodate deployments
  
  const chains = multichain.getProviders();
  
  for (const [chainName, provider] of chains.entries()) { 
  
    describe(`Testing ${chainName} chain and deployment`, async function () {
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
        owner = deployments[chainName].DeployerAddress;
        ownerSigner = await ethersMultichain.getSigner(owner);
        ownerDiamond = gnusDiamond.connect(ownerSigner);
        
      });
      
      
      beforeEach(async function () {
        snapshotId = await provider.send('evm_snapshot', []);
      });
        
      afterEach(async () => {
        await provider.send('evm_revert', [snapshotId]);
      });
          
          
      it(`should ensure that ${chainName} chain object can be retrieved and reused`, async function () {
            
        expect(provider).to.not.be.undefined;
        expect(deployer).to.not.be.undefined;
        expect(deployment).to.be.true;
        expect(upgrade).to.be.true;
        
        expect(gnusDiamond).to.not.be.null;
        
        const { chainId } = await provider.getNetwork();
        expect(chainId).to.be.a('number');

        expect(provider.connection.url).to.satisfy((url: string) => url.startsWith('http://') || url.startsWith('https://'));
      });
      
      it(`verify that diamond is deployed and we can get hardhat signers on ${chainName}`, async function () {
        
        expect(signers).to.be.an('array');
        expect(signers).to.have.lengthOf(20);
        expect(signers[0]).to.be.instanceOf(SignerWithAddress);

        expect(owner).to.not.be.undefined;
        expect(owner).to.be.a('string');
        // expect(owner).to.be.properAddress;
        expect(ownerSigner).to.be.instanceOf(SignerWithAddress);
      });
        
      it(`should verify that ${chainName} providers are defined and have valid block numbers`, async function () {
        log(`Checking chain provider for: ${chainName}`);
        expect(provider).to.not.be.undefined;

        const blockNumber = await ethersMultichain.provider.getBlockNumber();
        log(`Block number for ${chainName}: ${blockNumber}`);
        
        expect(blockNumber).to.be.a('number');
        expect(blockNumber).to.be.greaterThan(0);
        
        const configBlockNumber = hre.config.chainManager?.chains?.[chainName]?.blockNumber;
        expect(blockNumber).to.be.gte(configBlockNumber);
        
      });


      it(`should validate ERC165 interface compatibility on ${chainName}`, async function () {

        // Test ERC165 interface compatibility
        const supportsERC165 = await gnusDiamond?.supportsInterface('0x01ffc9a7');
        expect(supportsERC165).to.be.true;

        log(`Diamond deployed and validated on ${chainName}`);
      });
      
      it(`should verify ERC165 supported interface for ERC1155 on ${chainName}`, async function () {
  
        // Test ERC165 interface compatibility for ERC1155
        const supportsERC1155 = await gnusDiamond?.supportsInterface('0xd9b67a26');
        expect(supportsERC1155).to.be.true;
  
        log(`ERC1155 interface validated on ${chainName}`);
      });
      
      it(`should verify ERC165 supported interface for ERC20 on ${chainName}`, async function () {
        log(`Validating ERC20 interface on chain: ${chainName}`);
        // Retrieve the deployed GNUS Diamond contract
        const IERC20UpgradeableInterface = IERC20Upgradeable__factory.createInterface();
        // Generate the ERC20 interface ID by XORing with the base interface ID.
        const IERC20InterfaceID = getInterfaceID(IERC20UpgradeableInterface);
        // Assert that the `gnusDiamond` contract supports the ERC20 interface.
        assert(
          await gnusDiamond?.supportsInterface(IERC20InterfaceID._hex),
          "Doesn't support IERC20Upgradeable",
        );
        
        // Test ERC165 interface compatibility for ERC20 '0x37c8e2a0'
        const supportsERC20 = await gnusDiamond?.supportsInterface(IERC20InterfaceID._hex);
        expect(supportsERC20).to.be.true;

        log(`ERC20 interface validated on ${chainName}`);
      });
      
      it(`should verify that MINTER Role is set on ${chainName}`, async () => {
        console.log(`Validating ERC20 interface on chain: ${chainName}`);
        
        // Check if the owner has the `MINTER_ROLE`, allowing them to mint tokens.
        const minterRole = await gnusDiamond?.MINTER_ROLE();
        // get the signer for the owner
        const owner = deployments[chainName].DeployerAddress;
        expect(await gnusDiamond?.['hasRole(bytes32,address)'](minterRole!, owner!)).to.be.eq(true);
      });
    });  
  }
});
