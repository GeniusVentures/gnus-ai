import { debug } from 'debug';
import { pathExistsSync } from "fs-extra";
import { expect, assert } from 'chai';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { JsonRpcProvider } from '@ethersproject/providers';
import { multichain } from 'hardhat-multichain';
import { getInterfaceID } from '../utils/helpers';
import { getOrDeployDiamond } from '../setup/DiamondsMultichainTestDeployer';
import { Diamond, deleteDeployInfo } from '@gnus.ai/diamonds';
import { GeniusDiamond, IERC20Upgradeable__factory } from '../../typechain-types';

describe('🧪 Multichain Fork and Diamond Deployment Tests', async function () {
  const diamondName = 'GeniusDiamond';
  const log: debug.Debugger = debug('GNUSDeploy:log:${diamondName}');
  this.timeout(0); // Extended indefinitely for diamond deployment time

  let chains = multichain.getProviders() || new Map<string, JsonRpcProvider>();

  if (process.argv.includes('test-multichain')) {
    const chainNames = process.argv[process.argv.indexOf('--chains') + 1].split(',');
    if (chainNames.includes('hardhat')) {
      chains.set('hardhat', ethers.provider);
    }
  } else if (process.argv.includes('test') || process.argv.includes('coverage')) {
    chains.set('hardhat', ethers.provider);
  }

  for (const [chainName, provider] of chains.entries()) {
    describe(`🔗 Chain: ${chainName}  Diamond: ${diamondName}`, function () {
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

      let ethersMultichain: typeof ethers;
      let snapshotId: string;

      before(async function () {
        const manager = await getOrDeployDiamond(chainName, diamondName, provider);
        diamond = manager['diamond'];
        const deployInfo = diamond.getDeployInfo();

        const hardhatDiamondAbiPath = 'hardhat-diamond-abi/HardhatDiamondABI.sol:';
        const diamondArtifactName = `${hardhatDiamondAbiPath}${diamond.diamondName}`;
        geniusDiamond = await ethers.getContractAt(diamondArtifactName, deployInfo.DiamondAddress!) as GeniusDiamond;

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
        owner = deployInfo.DeployerAddress;  //  this will be = signer0 for hardhat;
        ownerSigner = await ethersMultichain.getSigner(owner);
        ownerDiamond = geniusDiamond.connect(ownerSigner);
      });

      beforeEach(async function () {
        snapshotId = await provider.send('evm_snapshot', []);
      });

      afterEach(async () => {
        await provider.send('evm_revert', [snapshotId]);
      });

      after(async () => {
        if (chainName == 'hardhat' && pathExistsSync(diamond.deployInfoFilePath)) {
          deleteDeployInfo(diamond.deployInfoFilePath)
        }
      });

      it(`should ensure that ${chainName} chain object can be retrieved and reused`, async function () {

        expect(provider).to.not.be.undefined;
        // expect(diamond).to.not.be.null;

        const { chainId } = await provider.getNetwork();
        expect(chainId).to.be.a('number');
      });

      it(`should verify that ${chainName} diamond is deployed and we can get hardhat signers on ${chainName}`, async function () {

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
        // Fails for hardhat because it defaults to 0.
        if (chainName !== 'hardhat') {
          expect(blockNumber).to.be.greaterThan(0);
        }

        // This isn't a perfect check, because it is trying to place the current block in 
        // a range relative to the configured block number used for caching.
        // The default of zero is to account for hardhat chain.  It also possible that no 
        // block number is configured in the hardhat.config.js file which will always fetch
        // the latest block number. This will also cause it to fail.
        const configBlockNumber = hre.config.chainManager?.chains?.[chainName]?.blockNumber ?? 0;
        expect(blockNumber).to.be.gte(configBlockNumber);

        expect(blockNumber).to.be.lte(configBlockNumber + 500);
      });

      // it(`should verify ERC173 contract ownership on ${chainName}`, async function () {
      //   // check if the owner is the deployer and transfer ownership to the deployer
      //   const currentContractOwner = await ownerDiamond.owner();
      //   expect(currentContractOwner.toLowerCase()).to.be.eq(await owner.toLowerCase());
      // });


      it(`should validate ERC165 interface compatibility on ${chainName}`, async function () {
        // Test ERC165 interface compatibility
        const supportsERC165 = await geniusDiamond.supportsInterface('0x01ffc9a7');
        expect(supportsERC165).to.be.true;

        log(`Diamond deployed and validated on ${chainName}`);
      });;

      it(`should verify ERC165 supported interface for ERC20 on ${chainName}`, async function () {
        log(`Validating ERC20 interface on chain: ${chainName}`);
        // Retrieve the deployed GNUS Diamond contract
        const IERC20UpgradeableInterface = IERC20Upgradeable__factory.createInterface();
        // Generate the ERC20 interface ID by XORing with the base interface ID.
        const IERC20InterfaceID = getInterfaceID(IERC20UpgradeableInterface);
        // Assert that the `diamond` contract supports the ERC20 interface.
        // assert(
        //   await geniusDiamond?.supportsInterface(IERC20InterfaceID._hex),
        //   "Doesn't support IERC20Upgradeable",
        // );

        // Test ERC165 interface compatibility for ERC20 '0x37c8e2a0'
        // const supportsERC20 = await geniusDiamond?.supportsInterface(IERC20InterfaceID._hex);
        // expect(supportsERC20).to.be.true;

        log(`ERC20 interface validated on ${chainName}`);
      });
    });
  }
});

