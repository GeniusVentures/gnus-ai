import {BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { debug } from "debug";
import { GeniusDiamond } from "../typechain-types/GeniusDiamond";
import { DiamondCutFacet } from "../typechain-types/DiamondCutFacet";
import { DiamondLoupeFacet } from "../typechain-types/DiamondLoupeFacet";
import { OwnershipFacet } from "../typechain-types/OwnershipFacet";
import * as chai from "chai";
export const assert = chai.assert;
export const expect = chai.expect;
import chaiAsPromised from "chai-as-promised"
import { Context } from "mocha";
chai.use(chaiAsPromised);

declare global {
    export var debuglog: debug.Debugger;
}

global.debuglog = debug("GNUSUnitTest:log")
global.debuglog.color = "158";

export const debuglog = global.debuglog;

// global describe it before ethers
interface DiamondInfo {
    gnusDiamond: GeniusDiamond;
    diamondCutFacet: DiamondCutFacet;
    diamondLoupeFacet: DiamondLoupeFacet;
    ownershipFacet: OwnershipFacet;
}

export const di: DiamondInfo = <DiamondInfo>{};

export const toBN = BigNumber.from;
export const GNUS_TOKEN_ID  = toBN(0);

export function toWei(value: number | string): BigNumber {
    return ethers.utils.parseEther(value.toString());
}



