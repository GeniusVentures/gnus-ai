
import { iObjToString } from '../../scripts/utils/iObjToString';
import { BigNumber, utils } from 'ethers';
import { GNUS_TOKEN_ID, toBN } from '../../scripts/common';
import { debuglog } from 'util';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { logEvents } from '../../scripts/utils/logEvents';

import { debug } from 'debug';
import { pathExistsSync } from "fs-extra";
import { expect, assert } from 'chai';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { JsonRpcProvider } from '@ethersproject/providers';
import { multichain } from 'hardhat-multichain';
import { getInterfaceID, toWei } from '../../scripts/utils/helpers';
import { LocalDiamondDeployer, LocalDiamondDeployerConfig } from '../../scripts/setup/LocalDiamondDeployer';
import {
  DeployedDiamondData,
  Diamond,
  getDeployedFacetInterfaces,
  logTx
} from '@gnus.ai/diamonds';
import {
  GeniusDiamond,
  IERC20Upgradeable__factory,
  IDiamondCut__factory,
  IDiamondLoupe__factory
} from '../../typechain-types';
import { config } from 'dotenv';

chai.use(chaiAsPromised);

describe('ERC1155 Proxy Operator Tests', async function () {
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

      let erc1155ProxyOperator: GeniusDiamond;
      let deployedDiamondData: DeployedDiamondData;

      before(async function () {
        const config = {
          diamondName: diamondName,
          networkName: networkName,
          provider: provider,
          chainId: (await provider.getNetwork()).chainId,
          writeDeployedDiamondData: false,
          configFilePath: `diamonds/GeniusDiamond/geniusdiamond.config.json`,
        } as LocalDiamondDeployerConfig;
        const diamondDeployer = await LocalDiamondDeployer.getInstance(config);
        await diamondDeployer.setVerbose(true);
        diamond = await diamondDeployer.getDiamondDeployed();
        deployedDiamondData = diamond.getDeployedDiamondData();

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
        owner = deployedDiamondData.DeployerAddress;
        if (!owner) {
          diamond.setSigner(signers[0]);
          owner = signer0;
          ownerSigner
        }
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

      describe('ERC1155ProxyOperator isApprovedForAll tests', function () {

        it('should return false if operator does not have NFT_PROXY_OPERATOR_ROLE and is not approved', async function () {
          expect(await erc1155ProxyOperator.isApprovedForAll(signer2, signer1)).to.be.false;
        });

        // TODO: Implement NFT_PROXY_OPERATOR_ROLE test.
        it('should return true if assigned operator has NFT_PROXY_OPERATOR_ROLE', async function () {
          const NFT_PROXY_OPERATOR_ROLE = await erc1155ProxyOperator.NFT_PROXY_OPERATOR_ROLE();
          const txGrantRole = await erc1155ProxyOperator.grantRole(NFT_PROXY_OPERATOR_ROLE, signer1);
          // Get the interface for the ERC1155ProxyOperator
          const ifaceList = getDeployedFacetInterfaces(deployedDiamondData);
          logTx(txGrantRole, 'grantRole', ifaceList);
          const isApprovedForAll = await erc1155ProxyOperator.isApprovedForAll(signer2, signer1);
          // expect(isApprovedForAll).to.be.true;
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
