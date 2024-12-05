import { Contract, BigNumber, EventFilter, ContractTransaction } from 'ethers';
import hre, { ethers } from 'hardhat';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import '@nomiclabs/hardhat-ethers';
import { getSelectors, Selectors, getInterfaceID } from '../scripts/FacetSelectors';
import {
  afterDeployCallbacks,
  deployAndInitDiamondFacets,
  deployDiamondFacets,
  deployExternalLibraries,
  deployFuncSelectors,
  deployGNUSDiamond,
} from '../scripts/deploy';
import { GeniusDiamond, NFTStructOutput } from '../typechain-types/GeniusDiamond';
import { GNUSNFTFactory } from '../typechain-types/GNUSNFTFactory';
import { iObjToString } from './iObjToString';
import {
  dc,
  debuglog,
  GNUS_TOKEN_ID,
  expect,
  toBN,
  toWei,
  INetworkDeployInfo,
  FacetToDeployInfo, PreviousVersionRecord
} from "../scripts/common";
import { assert } from 'chai';
import { IERC1155Upgradeable__factory } from '../typechain-types/factories/IERC1155Upgradeable__factory';
import { IERC165Upgradeable__factory } from '../typechain-types/factories/IERC165Upgradeable__factory';
import { Facets, LoadFacetDeployments } from '../scripts/facets';
import { deployments } from '../scripts/deployments';
import util from 'util';
import { debug } from 'debug';

// other files suites to execute
import * as NFTCreateTests from '../test/NFTCreateTests';
import * as GNUSERC20Tests from '../test/GNUSERC20Tests';
import * as ERC20BatchTests from '../test/Erc20BatchTests';
import * as GNUSBridgeTests from '../test/GNUSBridgeTests';

import { updateOwnerForTest } from './utils/signer';

const { FacetCutAction } = require('contracts-starter/scripts/libraries/diamond.js');

const debugging = process.env.JB_IDE_HOST !== undefined;

export async function logEvents(tx: ContractTransaction) {
  const receipt = await tx.wait();

  if (receipt.events) {
    for (const event of receipt.events) {
      debuglog(`Event ${event.event} with args ${event.args}`);
    }
  }
}

// Main test suite for the Genius Diamond DApp, which includes initialization, deployment, 
// and verification of the GNUS Diamond contract and its facets.
describe.only('Genius Diamond DApp Testing', async function () {
  // Declare a variable to store the deployed GeniusDiamond contract instance.
  let gnusDiamond: GeniusDiamond;
  
  // Store network-specific deployment information, which includes addresses and other details.
  let networkDeployedInfo: INetworkDeployInfo;
  
  // Keep track of previously deployed versions for comparison during upgrades.
  let previousDeployedVersions: PreviousVersionRecord = {};

  // Check if debugging mode is enabled (set if running in JetBrains IDE) and configure logging.
  if (debugging) {
    // Enable debug logging for logs tagged with 'GNUS.*:log' to view detailed output.
    debug.enable('GNUS.*:log');
    
    // Enable the debug logging utility defined earlier (debuglog).
    debuglog.enabled = true;
    
    // Bind console.log to debuglog.log, so debug logs are sent to the console.
    debuglog.log = console.log.bind(console);
    
    // Log a message indicating that debugging options are set up.
    debuglog(
      'Disabling timeout, enabling debuglog, because code was run in Jet Brains (probably debugging)',
    );

    // Disable test timeout to avoid interference during debugging.
    this.timeout(0);
  }

  before(async function () {
    // Load previously deployed facet information to ensure that facets are correctly deployed and initialized.
    await LoadFacetDeployments();
  
    // Get the deployer address, the first signer in the list of available signers in Hardhat.
    const deployer = (await ethers.getSigners())[0].address;
  
    // Retrieve the current network's name (e.g., hardhat, mainnet).
    const networkName = hre.network.name;
  
    // Initialize deployment information for the network if it doesn't already exist.
    if (!deployments[networkName]) {
      deployments[networkName] = {
        DiamondAddress: '',             // Address for the deployed diamond contract.
        DeployerAddress: deployer,      // Address of the deployer.
        FacetDeployedInfo: {},          // Object to store information about each deployed facet.
      };
    }
  
    // Store the current network's deployment info in `networkDeployedInfo`.
    networkDeployedInfo = deployments[networkName];
  
    // If the diamond contract has already been deployed, update the owner for testing.
    if (networkDeployedInfo.DiamondAddress) {
      await updateOwnerForTest(networkDeployedInfo.DiamondAddress);
    }
  
    // Deploy the GNUS Diamond contract and store deployment details in `networkDeployedInfo`.
    await deployGNUSDiamond(networkDeployedInfo);
  
    // Initialize `gnusDiamond` as the deployed GeniusDiamond contract instance.
    gnusDiamond = dc.GeniusDiamond as GeniusDiamond;
  
    // Log the successful deployment of the Diamond contract.
    debuglog('Diamond Deployed');
  
    // Create interfaces for the `IERC165Upgradeable` and `IERC1155Upgradeable` standards.
    const IERC165UpgradeableInterface = IERC165Upgradeable__factory.createInterface();
    const IERC1155UpgradeableInterface = IERC1155Upgradeable__factory.createInterface();
  
    // Calculate the interface ID for IERC165.
    const IERC165InterfaceID = getInterfaceID(IERC165UpgradeableInterface);
  
    // Calculate the interface ID for IERC1155 by XORing it with IERC165InterfaceID to exclude base contract functions.
    const IERC11InterfaceID = getInterfaceID(IERC1155UpgradeableInterface).xor(
      IERC165InterfaceID,
    );
  
    // Assert that `gnusDiamond` supports the IERC1155Upgradeable interface, indicating compatibility.
    assert(
      await gnusDiamond.supportsInterface(IERC11InterfaceID._hex),
      "Doesn't support IERC1155Upgradeable"
    );
  
    // Make a deep copy of `networkDeployedInfo` before upgrading to retain pre-upgrade information.
    const deployInfoBeforeUpgraded: INetworkDeployInfo = JSON.parse(
      JSON.stringify(networkDeployedInfo),
    );
  
    // Define facets to be deployed, sourced from the `Facets` object.
    let facetsToDeploy: FacetToDeployInfo = Facets;
  
    // Deploy facets in multiple steps for modular deployment, updating deployment info each time.
    await deployDiamondFacets(networkDeployedInfo, facetsToDeploy);
    debuglog(`${util.inspect(networkDeployedInfo, { depth: null })}`);
  
    // Copy deployment information into a new variable for comparison post-upgrade.
    const deployInfoWithOldFacet: INetworkDeployInfo = Object.assign(
      JSON.parse(JSON.stringify(networkDeployedInfo)),
    );
  
    // TODO: Answer:  isn't this bad?  Changing the keys of what we are iterating through?
    // Iterate through each facet's deployment information and update it with previous version data if available.
    for (const key in deployInfoWithOldFacet.FacetDeployedInfo) {
      if (deployInfoBeforeUpgraded.FacetDeployedInfo[key]) {
        deployInfoWithOldFacet.FacetDeployedInfo[key] =
          deployInfoBeforeUpgraded.FacetDeployedInfo[key];
      }
  
      // Build `previousDeployedVersions` to store versioning information for facets.
      const facetInfo = deployInfoWithOldFacet.FacetDeployedInfo[key];
      if (facetInfo && facetInfo.version !== undefined) {
        previousDeployedVersions[key] = facetInfo.version;
      } else {
        debuglog(`Facet ${key} does not have a version`);
      }
    }
  
    // Deploy function selectors for facets, updating `networkDeployedInfo` and `deployInfoWithOldFacet`.
    await deployFuncSelectors(networkDeployedInfo, deployInfoWithOldFacet, facetsToDeploy);
    debuglog(`${util.inspect(networkDeployedInfo, { depth: null })}`);
  
    // Redundant deployment of function selectors (likely to confirm they were successfully added).
    await deployFuncSelectors(networkDeployedInfo, deployInfoWithOldFacet, facetsToDeploy);
  
    // Execute any callbacks required after deployment, typically for post-deployment setups or checks.
    await afterDeployCallbacks(networkDeployedInfo, undefined, previousDeployedVersions);
    debuglog(`${util.inspect(networkDeployedInfo, { depth: null })}`);
  
    // Log that all facets have been successfully deployed.
    debuglog('Facets Deployed');
  });

  // Test suite to verify facet cut functionality in the diamond contract, which includes checking
  // facets and function selectors for correctness and consistency after upgrades.
  describe('Facet Cut Testing', async function () {
    // Variables to store transaction, receipt, and results for test assertions.
    let tx;
    let receipt;
    let result: any;

    // Array to store addresses of deployed facets.
    const addresses: any[] = [];

    // Test to ensure the count of facets in the diamond matches the expected count.
    it('should have same count of facets -- call to facetAddresses function', async () => {
      // Retrieve the addresses of all facets in the diamond contract.
      const facetAddresses = await gnusDiamond.facetAddresses();
      
      // Store each facet address in the `addresses` array.
      for (const facetAddress of facetAddresses) {
        addresses.push(facetAddress);
      }
      
      // Assert that the number of facets in `gnusDiamond` matches the count in `networkDeployedInfo`.
      // The diamond contract should have one additional facet to account for the main diamond facet.
      assert.equal(
        addresses.length,
        Object.keys(networkDeployedInfo.FacetDeployedInfo).length,
      );
    });

    // Test to confirm that each facet has the correct function selectors registered.
    it('facets should have the right function selectors -- call to facetFunctionSelectors function', async () => {
      // Retrieve selectors for the `DiamondCutFacet` and compare with those in the diamond contract.
      let selectors = getSelectors(dc.DiamondCutFacet);
      result = await gnusDiamond.facetFunctionSelectors(addresses[0]);
      assert.sameMembers(result, selectors.values);

      // Retrieve selectors for the `DiamondLoupeFacet` and compare with those in the diamond contract.
      selectors = getSelectors(dc.DiamondLoupeFacet);
      result = await gnusDiamond.facetFunctionSelectors(addresses[1]);
      assert.sameMembers(result, selectors.values);

      // Retrieve selectors for the `GeniusOwnershipFacet`, ensuring non-overlap with the previous facet selectors.
      selectors = getSelectors(dc.GeniusOwnershipFacet);
      const result2 = await gnusDiamond.facetFunctionSelectors(addresses[2]);
      assert.sameMembers(
        result2,
        selectors.values.filter((e) => !result.includes(e)),
      );
    });

    // Test to validate that the protocol version remains the same after an upgrade.
    it('protocol version should be same after upgrading', async () => {
      // Retrieve protocol information, specifically `bridgeFee` and `protocolVersion`.
      const { bridgeFee, protocolVersion } = await gnusDiamond.protocolInfo();

      // Check that `bridgeFee` is zero as expected.
      expect(bridgeFee).to.be.eq(0);

      // Verify that the `protocolVersion` matches the expected version (230).
      expect(protocolVersion).to.be.eq(BigInt(230));
    });
  }); 

  // Test suite to verify GNUS token creation and initial supply on the Polygon network.
  describe('Polygon to GNUS Deposits', async function () {

    // Test to check if the GNUS token has been created successfully in the contract.
    it('Testing if GNUS token has been created', async () => {
      // Retrieve information about the GNUS token using its token ID (`GNUS_TOKEN_ID`).
      const gnusInfo: NFTStructOutput = await gnusDiamond.getNFTInfo(GNUS_TOKEN_ID);

      // Log GNUS token information for debugging purposes.
      debuglog(iObjToString(gnusInfo));
    });

    // Test to verify the initial supply of the GNUS token.
    it('Testing if GNUS token has any supply yet', async () => {
      // Retrieve a list of signers and destructure it to get `owner`, `addr1`, and `addr2`.
      const [owner, addr1, addr2] = await ethers.getSigners();

      // Get the total supply of the GNUS token using the token ID.
      const gnusSupply = await gnusDiamond['totalSupply(uint256)'](GNUS_TOKEN_ID);

      // Assert that the GNUS token supply is zero, as expected upon initial creation.
      assert(
        gnusSupply.eq(toWei(0)),
        `GNUS Supply should equal zero but equals ${gnusSupply}`,
      );
    });
  });
  
  // After all tests in this suite, run additional test suites for GNUS functionality.
  after(() => {
    GNUSERC20Tests.suite();       // Run tests for ERC20 functionality of GNUS.
    NFTCreateTests.suite();        // Run tests for NFT creation within the GNUS ecosystem.
    ERC20BatchTests.suite();       // Run batch transfer tests for GNUS ERC20 tokens.
    GNUSBridgeTests.suite();       // Run bridge tests for GNUS token transfers across chains.
  });
});
