import { Contract } from "ethers";
import { debug } from "debug";
import { GeniusDiamond } from "../typechain-types/GeniusDiamond";
import * as chai from "chai";
export const assert = chai.assert;
import chaiAsPromised from "chai-as-promised"
chai.use(chaiAsPromised);

export const debuglog: debug.Debugger = debug("GNUSUnitTest:log");
debuglog.color = "158";
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
