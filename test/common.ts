import {BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { debug } from "debug";
import { GeniusDiamond } from "../typechain-types/GeniusDiamond";
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

export interface diamondInfo {
    diamondAddress: string;
    gnusDiamond: GeniusDiamond;
    diamondCutFacet: Contract;
    diamondLoupeFacet: Contract;
    ownershipFacet: Contract;
};

export const di = new Object() as diamondInfo;

export const GNUS_TOKEN_ID  = 0;

export const toBN = BigNumber.from;
export function toWei(value: number | string): BigNumber {
    return ethers.utils.parseEther(value.toString());
}
