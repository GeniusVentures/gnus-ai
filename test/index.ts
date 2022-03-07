import { Contract, BigNumber } from "ethers";
import { ethers } from "hardhat";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@nomiclabs/hardhat-ethers";
import "../scripts/FacetSelectors";
import { deployGNUSDiamond } from "../scripts/deploy";
import { getSelectors, Selectors } from "../scripts/FacetSelectors";
import { expect } from "chai";
import { GeniusDiamond } from "../typechain-types/GeniusDiamond";
import { GNUSNFTFactory } from "../typechain-types/GNUSNFTFactory";
import { iObjToString } from "./iObjToString";
import { di, debuglog, diamondInfo, GNUS_TOKEN_ID, assert } from "./common";
const toBN = BigNumber.from;
const {
  FacetCutAction,
} = require("contracts-starter/scripts/libraries/diamond.js");


describe("Genius Diamond DApp Testing", async function () {

  before(async function () {
    di.diamondAddress = await deployGNUSDiamond();
    debuglog('Diamond Deployed')
    di.gnusDiamond = await ethers.getContractAt("hardhat-diamond-abi/GeniusDiamond.sol:GeniusDiamond", di.diamondAddress) as GeniusDiamond;

    di.diamondCutFacet = await ethers.getContractAt(
        "DiamondCutFacet",
        di.diamondAddress
    );
    di.diamondLoupeFacet = await ethers.getContractAt(
        "DiamondLoupeFacet",
        di.diamondAddress
    );
    di.ownershipFacet = await ethers.getContractAt(
        "OwnershipFacet",
        di.diamondAddress
    );
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

  describe("GNUS NFT Factory Testing", async function () {

    it("Testing if GNUS token has been created", async () => {
      const gnusInfo: GNUSNFTFactory.TokenStructOutput = await di.gnusDiamond.getTokenInfo(GNUS_TOKEN_ID);
      debuglog(iObjToString(gnusInfo));
    });

    it("Testing if GNUS token has any supply yet", async () => {
      const [owner, addr1, addr2] = await ethers.getSigners();

      const gnusSupply = await di.gnusDiamond.totalSupply(GNUS_TOKEN_ID);
      assert(gnusSupply.eq(0), `GNUS Supply should equal zero but equals${gnusSupply}`);

      const addr1_gnusDiamond = di.gnusDiamond.connect(addr1);
      await expect(addr1_gnusDiamond["deposit(address,uint256)"](addr1.address, toBN(20))).to.eventually.be.rejectedWith(Error,
          /reverted with reason string 'AccessControl: account/);

      await di.gnusDiamond.grantRole(await di.gnusDiamond.PROXY_ROLE(), addr1.address);

      await addr1_gnusDiamond["deposit(address,uint256)"](addr1.address, toBN(2000));

    });

    it("Testing if GNUS token received deposit", async () => {
      const gnusSupply = await di.gnusDiamond.totalSupply(GNUS_TOKEN_ID);
      assert(gnusSupply.eq(toBN(2000)));
    });

  });

});






