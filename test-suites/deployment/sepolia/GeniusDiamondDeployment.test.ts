import { debug } from 'debug';
import { pathExistsSync } from "fs-extra";
import { expect, assert } from 'chai';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { JsonRpcProvider } from '@ethersproject/providers';
import { multichain } from 'hardhat-multichain';
import { getInterfaceID } from '../../../scripts/utils/helpers';
import { LocalDiamondDeployer, LocalDiamondDeployerConfig } from '../../../scripts/setup/LocalDiamondDeployer';
import { Diamond, deleteDeployInfo } from '@gnus.ai/diamonds';
import {
  GeniusDiamond,
  IERC20Upgradeable__factory,
  IDiamondCut__factory,
  IDiamondLoupe__factory
} from '../../../typechain-types';
import { config } from 'dotenv';

describe('🧪 Sepolia Upgrade v2.4 to v2.5 Tests', async function () {
  const diamondName = 'GeniusDiamond';
  const log: debug.Debugger = debug('GNUSDeploy:log:${diamondName}');
  this.timeout(0); // Extended indefinitely for diamond deployment time

  let networkProviders = multichain.getProviders() || new Map<string, JsonRpcProvider>();

  if (process.argv.includes('test-multichain')) {
    const networkNames = process.argv[process.argv.indexOf('--chains') + 1].split(',');
    if (networkNames.includes('hardhat')) {
      networkProviders.set('hardhat', ethers.provider);
    }
  } else if (process.argv.includes('test') || process.argv.includes('coverage')) {
    networkProviders.set('hardhat', ethers.provider);
  }

  for (const [networkName, provider] of networkProviders.entries()) {
    describe(`🔗 Chain: ${networkName}  Diamond: ${diamondName}`, function () {
      let diamond: Diamond;
      let diamond1: Diamond;
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

        // Step 1: Remove Missing Facet data
        const config1 = {
          diamondName: diamondName,
          networkName: networkName,
          provider: provider,
          chainId: (await provider.getNetwork()).chainId,
          writeDeployedDiamondData: true,
          configFilePath: `diamonds/GeniusDiamond/geniusdiamond-sepolia-v2.5-step1.config.json`,
          deployedDiamondDataFilePath: `diamonds/GeniusDiamond/deployments/geniusdiamond-v2.4-sepolia-31337.json`,
          localDiamondDeployerKey: 'geniusdiamond-sepolia-v2.5-step1',
        } as LocalDiamondDeployerConfig;
        const diamondDeployer1 = await LocalDiamondDeployer.getInstance(config1);
        await diamondDeployer1.setVerbose(true);
        diamond1 = await diamondDeployer1.getDiamondDeployed();
        // let deployedDiamondData1 = diamond1.getDeployedDiamondData();

        // Step 2: Run upgrade with corrected Diamond
        const config = {
          diamondName: diamondName,
          networkName: networkName,
          provider: provider,
          chainId: (await provider.getNetwork()).chainId,
          writeDeployedDiamondData: true,
          configFilePath: `diamonds/GeniusDiamond/geniusdiamond.config.json`,
          deployedDiamondDataFilePath: `diamonds/GeniusDiamond/deployments/geniusdiamond-sepolia-11155112.json`,
        } as LocalDiamondDeployerConfig;
        const diamondDeployer = await LocalDiamondDeployer.getInstance(config);
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
        owner = await diamond.getSigner()?.getAddress()!;
        ownerSigner = await ethersMultichain.getSigner(owner);

        ownerDiamond = geniusDiamond.connect(ownerSigner);
      });

      beforeEach(async function () {
        snapshotId = await provider.send('evm_snapshot', []);
      });

      afterEach(async () => {
        await provider.send('evm_revert', [snapshotId]);
      });

      it(`should ensure that ${networkName} chain object can be retrieved and reused`, async function () {

        expect(provider).to.not.be.undefined;
        // expect(diamond).to.not.be.null;

        const { chainId } = await provider.getNetwork();
        expect(chainId).to.be.a('number');
      });

      it(`should verify that ${networkName} diamond is deployed and we can get hardhat signers on ${networkName}`, async function () {

        expect(signers).to.be.an('array');
        expect(signers).to.have.lengthOf(20);
        expect(signers[0]).to.be.instanceOf(SignerWithAddress);

        expect(owner).to.not.be.undefined;
        expect(owner).to.be.a('string');
        // expect(owner).to.be.properAddress;
        expect(ownerSigner).to.be.instanceOf(SignerWithAddress);
      });

      it(`should verify that ${networkName} providers are defined and have valid block numbers`, async function () {
        log(`Checking chain provider for: ${networkName}`);
        expect(provider).to.not.be.undefined;

        const blockNumber = await ethersMultichain.provider.getBlockNumber();
        log(`Block number for ${networkName}: ${blockNumber}`);

        expect(blockNumber).to.be.a('number');
        // Fails for hardhat because it defaults to 0.
        if (networkName !== 'hardhat') {
          expect(blockNumber).to.be.greaterThan(0);
        }
        const configBlockNumber = hre.config.chainManager?.chains?.[networkName]?.blockNumber ?? 0;
        expect(blockNumber).to.be.gte(configBlockNumber);

        expect(blockNumber).to.be.lte(configBlockNumber + 500);
      });

      // it(`should verify ERC173 contract ownership on ${networkName}`, async function () {
      //   // check if the owner is the deployer and transfer ownership to the deployer
      //   const currentContractOwner = await ownerDiamond.owner();
      //   expect(currentContractOwner.toLowerCase()).to.be.eq(await owner.toLowerCase());
      // });

      it(`should verify that the owner has DEFAULT_ADMIN_ROLE on ${networkName}`, async function () {
        const DEFAULT_ADMIN_ROLE = await ownerDiamond.DEFAULT_ADMIN_ROLE();
        const hasAdminRole = await ownerDiamond.hasRole(DEFAULT_ADMIN_ROLE, owner);
        expect(hasAdminRole).to.be.true;
        log(`Owner has DEFAULT_ADMIN_ROLE on ${networkName}`);
      });

      it(`should verify that the owner has UPGRADER_ROLE on ${networkName}`, async function () {
        const UPGRADER_ROLE = await ownerDiamond.UPGRADER_ROLE();
        const hasUpgraderRole = await ownerDiamond.hasRole(UPGRADER_ROLE, owner);
        expect(hasUpgraderRole).to.be.true;
        log(`Owner has UPGRADER_ROLE on ${networkName}`);
      });

      it(`should verify that the owner has MINTER_ROLE on ${networkName}`, async function () {
        const MINTER_ROLE = await ownerDiamond.MINTER_ROLE();
        const hasMinterRole = await ownerDiamond.hasRole(MINTER_ROLE, owner);
        expect(hasMinterRole).to.be.true;
        log(`Owner has MINTER_ROLE on ${networkName}`);
      });

      it(`should validate ERC165 interface compatibility on ${networkName}`, async function () {
        // Test ERC165 interface compatibility
        const supportsERC165 = await ownerDiamond.supportsInterface('0x01ffc9a7');
        expect(supportsERC165).to.be.true;

        log(`Diamond deployed and validated on ${networkName}`);
      });

      it(`should validate IDiamondCut interface compatibility on ${networkName}`, async function () {
        // Test ERC165 interface compatibility
        const iDiamondCutInterface = IDiamondCut__factory.createInterface();
        // Generate the IDiamondCut interface ID by XORing with the base interface ID.
        const iDiamondCutInterfaceID = getInterfaceID(iDiamondCutInterface);
        // const supportsIDiamondCut = await proxyDiamond.supportsInterface('0x1f931c1c');
        const supportsERC165 = await ownerDiamond.supportsInterface(iDiamondCutInterfaceID._hex);
        expect(supportsERC165).to.be.true;

        log(`DiamondCut Facet interface support validated on ${networkName}`);
      });

      it(`should validate IDiamondLoupe interface compatibility on ${networkName}`, async function () {
        // Test ERC165 interface compatibility
        const iDiamondLoupeInterface = IDiamondLoupe__factory.createInterface();
        // Generate the IDiamondLoupe interface ID by XORing with the base interface ID.
        const iDiamondLoupeInterfaceID = getInterfaceID(iDiamondLoupeInterface);
        // const supportsIDiamondLoupe = await proxyDiamond.supportsInterface('0x48e3885f');
        const supportsERC165 = await ownerDiamond.supportsInterface(iDiamondLoupeInterfaceID._hex);
        expect(supportsERC165).to.be.true;
        log(`DiamondLoupe Facet interface support validated on ${networkName}`);
      });

      it(`should verify ERC165 supported interface for ERC20 on ${networkName}`, async function () {
        log(`Validating ERC20 interface on chain: ${networkName}`);
        const IERC20UpgradeableInterface = IERC20Upgradeable__factory.createInterface();
        // Generate the ERC20 interface ID by XORing with the base interface ID.
        const IERC20InterfaceID = getInterfaceID(IERC20UpgradeableInterface);
        // Assert that the `diamond` contract supports the ERC20 interface.
        // assert(
        //   await proxyDiamond?.supportsInterface(IERC20InterfaceID._hex),
        //   "Doesn't support IERC20Upgradeable",
        // );

        // Test ERC165 interface compatibility for ERC20 '0x37c8e2a0'
        // Test ERC165 interface compatibility for ERC20Upgradeable '0x36372b07'
        // const supportsERC20 = await proxyDiamond?.supportsInterface(IERC20InterfaceID._hex);

        const supportsERC20 = await ownerDiamond?.supportsInterface('0x36372b07');

        expect(supportsERC20).to.be.true;

        log(`ERC20 interface validated on ${networkName}`);
      });
    });
  }
});

