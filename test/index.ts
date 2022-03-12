import { Contract, BigNumber, EventFilter, ContractTransaction } from "ethers";
import { ethers } from "hardhat";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@nomiclabs/hardhat-ethers";
import "../scripts/FacetSelectors";
import { deployGNUSDiamond, deployGNUSDiamondFacets } from "../scripts/deploy";
import { getSelectors, Selectors, getInterfaceID } from "../scripts/FacetSelectors";
import { GeniusDiamond, NFTStructOutput } from "../typechain-types/GeniusDiamond";
import { GNUSNFTFactory } from "../typechain-types/GNUSNFTFactory";
import { iObjToString } from "./iObjToString";
import { di, debuglog, GNUS_TOKEN_ID, assert, expect, toBN, toWei } from "../scripts/common";
import { IERC1155Upgradeable__factory } from "../typechain-types/factories/IERC1155Upgradeable__factory";
import { IERC165Upgradeable__factory } from "../typechain-types/factories/IERC165Upgradeable__factory";
const {
  FacetCutAction,
} = require("contracts-starter/scripts/libraries/diamond.js");

const debugging = (process.env.JB_IDE_HOST !== undefined);

// other files suites to execute
import * as NFTCreateTests from "../test/NFTCreateTests"


export async function logEvents(tx: ContractTransaction) {
  const receipt = await tx.wait();

  if (receipt.events) {
    for (const event of receipt.events) {
      debuglog(`Event ${event.event} with args ${event.args}`);
    }
  }
}

describe.only("Genius Diamond DApp Testing", async function () {

  if (debugging) {
    debuglog.enabled = true;
    debuglog.log = console.log.bind(console);
    debuglog("Disabling timeout, enabling debuglog, because code was run in Jet Brains (probably debugging)");
    this.timeout(0);
  }

  before(async function () {
    await deployGNUSDiamond();
    debuglog('Diamond Deployed')

    const IERC165UpgradeableInterface = IERC165Upgradeable__factory.createInterface();
    const IERC1155UpgradeableInterface = IERC1155Upgradeable__factory.createInterface();
    const IERC165InterfaceID = getInterfaceID(IERC165UpgradeableInterface)
    // interface ID does not include base contract(s) functions.
    const IERC11InterfaceID = getInterfaceID(IERC1155UpgradeableInterface).xor(IERC165InterfaceID);
    assert(await di.gnusDiamond.supportsInterface(IERC11InterfaceID._hex), "Doesn't support IERC1155Upgradeable");

    await deployGNUSDiamondFacets();
    debuglog('Facets Deployed')

  });

  describe("Facet Cut Testing", async function () {

    let tx;
    let receipt;
    let result;
    const addresses: any[] = [];

    it("should have Seven facets -- call to facetAddresses function", async () => {
      for (const address of await di.diamondLoupeFacet.facetAddresses()) {
        addresses.push(address);
      }
      assert.equal(addresses.length, 7);
    });

    it("facets should have the right function selectors -- call to facetFunctionSelectors function", async () => {
      let selectors = getSelectors(di.diamondCutFacet);
      result = await di.diamondLoupeFacet.facetFunctionSelectors(addresses[0]);
      assert.sameMembers(result, selectors.values);
      selectors = getSelectors(di.diamondLoupeFacet);
      result = await di.diamondLoupeFacet.facetFunctionSelectors(addresses[1]);
      assert.sameMembers(result, selectors.values);
      selectors = getSelectors(di.ownershipFacet);
      result = await di.diamondLoupeFacet.facetFunctionSelectors(addresses[2]);
      assert.sameMembers(result, selectors.values);
    });

  });


  describe("Polygon to GNUS Deposits", async function () {

    it("Testing if GNUS token has been created", async () => {
      const gnusInfo: NFTStructOutput = await di.gnusDiamond.getNFTInfo(GNUS_TOKEN_ID);
      debuglog(iObjToString(gnusInfo));
    });

    it("Testing if GNUS token has any supply yet", async () => {
      const [owner, addr1, addr2] = await ethers.getSigners();

      const gnusSupply = await di.gnusDiamond.totalSupply(GNUS_TOKEN_ID);
      assert(gnusSupply.eq(0), `GNUS Supply should equal zero but equals${gnusSupply}`);

      let tx = await di.gnusDiamond["deposit(address,uint256)"](owner.address, toWei(2000));
      logEvents(tx);

      const addr1_gnusDiamond = di.gnusDiamond.connect(addr1);
      await expect(addr1_gnusDiamond["deposit(address,uint256)"](addr1.address, toBN(20))).to.eventually.be.rejectedWith(Error,
          /reverted with reason string 'AccessControl: account/);

      await di.gnusDiamond.grantRole(await di.gnusDiamond.PROXY_ROLE(), addr1.address);

      tx = await addr1_gnusDiamond["deposit(address,uint256)"](addr1.address, toWei(2000));
      logEvents(tx);

    });

    it("Testing if GNUS token received deposit", async () => {
      const gnusSupply = await di.gnusDiamond.totalSupply(GNUS_TOKEN_ID);
      assert(gnusSupply.eq(toWei(4000)), `GNUS Supply should be 4000, but is ${ethers.utils.formatEther(gnusSupply)}`);
    });

    after(() => {
      NFTCreateTests.suite();
    });

  });


});







