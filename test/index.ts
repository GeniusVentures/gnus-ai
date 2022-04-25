import { Contract, BigNumber, EventFilter, ContractTransaction } from "ethers";
import { ethers } from "hardhat";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@nomiclabs/hardhat-ethers";
import "../scripts/FacetSelectors";
import { afterDeployCallbacks, deployAndInitDiamondFacets, deployDiamondFacets, deployFuncSelectors, deployGNUSDiamond } from "../scripts/deploy";
import { getSelectors, Selectors, getInterfaceID } from "../scripts/FacetSelectors";
import { GeniusDiamond, NFTStructOutput } from "../typechain-types/GeniusDiamond";
import { GNUSNFTFactory } from "../typechain-types/GNUSNFTFactory";
import { iObjToString } from "./iObjToString";
import { dc, debuglog, GNUS_TOKEN_ID, assert, expect, toBN, toWei, INetworkDeployInfo } from "../scripts/common";
import { IERC1155Upgradeable__factory } from "../typechain-types/factories/IERC1155Upgradeable__factory";
import { IERC165Upgradeable__factory } from "../typechain-types/factories/IERC165Upgradeable__factory";
import { LoadFacetDeployments } from "../scripts/facets";
import { deployments } from "../scripts/deployments";
import hre from "hardhat";
import util from "util";
import { debug } from "debug";

const {
  FacetCutAction,
} = require("contracts-starter/scripts/libraries/diamond.js");

// other files suites to execute
import * as NFTCreateTests from "../test/NFTCreateTests";
import * as GNUSERC20Tests from "../test/GNUSERC20Tests";

const debugging = (process.env.JB_IDE_HOST !== undefined);

export async function logEvents(tx: ContractTransaction) {
  const receipt = await tx.wait();

  if (receipt.events) {
    for (const event of receipt.events) {
      debuglog(`Event ${event.event} with args ${event.args}`);
    }
  }
}

describe.only("Genius Diamond DApp Testing", async function () {

  let gnusDiamond: GeniusDiamond;
  let networkDeployedInfo: INetworkDeployInfo;

  if (debugging) {
    debug.enable("GNUS.*:log");
    debuglog.enabled = true;
    debuglog.log = console.log.bind(console);
    debuglog("Disabling timeout, enabling debuglog, because code was run in Jet Brains (probably debugging)");
    this.timeout(0);
  }

  before(async function () {
    await LoadFacetDeployments();

    const deployer = (await ethers.getSigners())[0].address;

    const networkName = hre.network.name;
    if (!deployments[networkName]) {
      deployments[networkName] = {
        DiamondAddress: "",
        DeployerAddress: deployer,
        FacetDeployedInfo: {}
      };
    }
    networkDeployedInfo = deployments[networkName];

    await deployGNUSDiamond(networkDeployedInfo);

    gnusDiamond = dc.GeniusDiamond as GeniusDiamond;

    debuglog('Diamond Deployed')

    const IERC165UpgradeableInterface = IERC165Upgradeable__factory.createInterface();
    const IERC1155UpgradeableInterface = IERC1155Upgradeable__factory.createInterface();
    const IERC165InterfaceID = getInterfaceID(IERC165UpgradeableInterface)
    // interface ID does not include base contract(s) functions.
    const IERC11InterfaceID = getInterfaceID(IERC1155UpgradeableInterface).xor(IERC165InterfaceID);
    assert(await gnusDiamond.supportsInterface(IERC11InterfaceID._hex), "Doesn't support IERC1155Upgradeable");

    // do deployment of facets in 3 steps
    await deployDiamondFacets(networkDeployedInfo);
    debuglog(`${util.inspect(networkDeployedInfo, { depth: null })}`);
    await deployFuncSelectors(networkDeployedInfo);
    debuglog(`${util.inspect(networkDeployedInfo, { depth: null })}`);

    // this should be a null operation.
    await deployFuncSelectors(networkDeployedInfo);

    await afterDeployCallbacks(networkDeployedInfo);
    debuglog(`${util.inspect(networkDeployedInfo, { depth: null })}`);

    debuglog('Facets Deployed')

  });

  describe("Facet Cut Testing", async function () {

    let tx;
    let receipt;
    let result;
    const addresses: any[] = [];

    it("should have same count of facets -- call to facetAddresses function", async () => {
      const facetAddresses = await await gnusDiamond.facetAddresses();
      for (const facetAddress of facetAddresses) {
        addresses.push(facetAddress);
      }
      // DiamondCutFacet is deployed but doesn't have any facets deployed
      assert.equal(addresses.length + 1, Object.keys(networkDeployedInfo.FacetDeployedInfo).length);
    });

    it("facets should have the right function selectors -- call to facetFunctionSelectors function", async () => {
      let selectors = getSelectors(dc.DiamondCutFacet);
      result = await gnusDiamond.facetFunctionSelectors(addresses[0]);
      assert.sameMembers(result, selectors.values);
      selectors = getSelectors(dc.DiamondLoupeFacet);
      result = await gnusDiamond.facetFunctionSelectors(addresses[1]);
      assert.sameMembers(result, selectors.values);
      selectors = getSelectors(dc.OwnershipFacet);
      result = await gnusDiamond.facetFunctionSelectors(addresses[2]);
      assert.sameMembers(result, selectors.values);
    });

  });


  describe("Polygon to GNUS Deposits", async function () {

    it("Testing if GNUS token has been created", async () => {
      const gnusInfo: NFTStructOutput = await gnusDiamond.getNFTInfo(GNUS_TOKEN_ID);
      debuglog(iObjToString(gnusInfo));
    });

    it("Testing if GNUS token has any supply yet", async () => {
      const [owner, addr1, addr2] = await ethers.getSigners();

      const gnusSupply = await gnusDiamond["totalSupply(uint256)"](GNUS_TOKEN_ID);
      assert(gnusSupply.eq(0), `GNUS Supply should equal zero but equals${gnusSupply}`);

      let tx = await gnusDiamond["deposit(address,uint256)"](owner.address, toWei(2000));
      logEvents(tx);

      const addr1_gnusDiamond = gnusDiamond.connect(addr1);
      await expect(addr1_gnusDiamond["deposit(address,uint256)"](addr1.address, toBN(20))).to.eventually.be.rejectedWith(Error,
          /reverted with reason string 'AccessControl: account/);

      await gnusDiamond.grantRole(await gnusDiamond.PROXY_ROLE(), addr1.address);

      tx = await addr1_gnusDiamond["deposit(address,uint256)"](addr1.address, toWei(2000));
      logEvents(tx);

    });

    it("Testing if GNUS token received deposit", async () => {
      const gnusSupply = await gnusDiamond["totalSupply(uint256)"](GNUS_TOKEN_ID);
      assert(gnusSupply.eq(toWei(4000)), `GNUS Supply should be 4000, but is ${ethers.utils.formatEther(gnusSupply)}`);
    });

    after(() => {
      GNUSERC20Tests.suite();
      NFTCreateTests.suite();
    });

  });


});







