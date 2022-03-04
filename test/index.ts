import { Contract } from "ethers";
import { ethers } from "hardhat";
import { debug } from "debug";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@nomiclabs/hardhat-ethers";
import "../scripts/FacetSelectors";
import { deployGNUSDiamond } from "../scripts/deploy";
import { getSelectors, Selectors } from "../scripts/FacetSelectors";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised"
import { expect } from "chai";
import { GeniusDiamond } from "../typechain-types/GeniusDiamond";
import { GNUSNFTFactory } from "../typechain-types/GNUSNFTFactory";
import { iObjToString } from "./iObjToString";
chai.use(chaiAsPromised)

const log: debug.Debugger = debug("GNUSUnitTest:log");
log.color = "158";
// global describe it before ethers

const {
  FacetCutAction,
} = require("contracts-starter/scripts/libraries/diamond.js");

const { assert } = require("chai");

let diamondAddress: string;
let gnusDiamond: GeniusDiamond;

const GNUS_TOKEN_ID  = 0;

before(async function () {
  diamondAddress = await deployGNUSDiamond();
  log('Diamond Deployed')
  gnusDiamond = await ethers.getContractAt("hardhat-diamond-abi/GeniusDiamond.sol:GeniusDiamond", diamondAddress) as GeniusDiamond;
});

describe("Facet Cut Testing", async function () {
  let diamondCutFacet: Contract;
  let diamondLoupeFacet: Contract;
  let ownershipFacet: Contract;
  let tx;
  let receipt;
  let result;
  const addresses: any[] = [];

  before(async function () {

    diamondCutFacet = await ethers.getContractAt(
      "DiamondCutFacet",
      diamondAddress
    );
    diamondLoupeFacet = await ethers.getContractAt(
      "DiamondLoupeFacet",
      diamondAddress
    );
    ownershipFacet = await ethers.getContractAt(
      "OwnershipFacet",
      diamondAddress
    );
  });

  it("should have Seven facets -- call to facetAddresses function", async () => {
    for (const address of await diamondLoupeFacet.facetAddresses()) {
      addresses.push(address);
    }
    assert.equal(addresses.length, 7);
  });

  it("facets should have the right function selectors -- call to facetFunctionSelectors function", async () => {
    let selectors = getSelectors(diamondCutFacet);
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[0]);
    assert.sameMembers(result, selectors.values);
    selectors = getSelectors(diamondLoupeFacet);
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[1]);
    assert.sameMembers(result, selectors.values);
    selectors = getSelectors(ownershipFacet);
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[2]);
    assert.sameMembers(result, selectors.values);
  });

});

describe("GNUS NFT Factory Testing", async function () {

  it("Testing if GNUS token has been created", async () => {
    const gnusInfo: GNUSNFTFactory.TokenStructOutput = await gnusDiamond.getTokenInfo(GNUS_TOKEN_ID);
    log(iObjToString(gnusInfo));
  });

  it("Testing if GNUS token has any supply yet", async () => {
    const gnusSupply = await gnusDiamond.totalSupply(GNUS_TOKEN_ID);
    assert.equal(gnusSupply, 0);
  });

});


describe("GNUS (ETH) -> Polygon bridge", async function () {
  const [owner, addr1, addr2] = await ethers.getSigners();

  it("Testing Deposit by non-proxy address", async () => {
    await expect(gnusDiamond["deposit(address,uint256)"](addr1.address, ethers.utils.parseEther("20"))).to.eventually.be.rejectedWith(Error,
        /reverted with reason string 'AccessControl: account/);
  });

});
