import {BigNumber, Contract} from "ethers";
import {ethers} from "hardhat";
import {debug} from "debug";
import {GeniusDiamond} from "../typechain-types/GeniusDiamond";
import {DiamondCutFacet} from "../typechain-types/DiamondCutFacet";
import {DiamondLoupeFacet} from "../typechain-types/DiamondLoupeFacet";
import {OwnershipFacet} from "../typechain-types/OwnershipFacet";
import * as chai from "chai";

export const assert = chai.assert;
export const expect = chai.expect;
import chaiAsPromised from "chai-as-promised"
import {Context} from "mocha";
import { Fragment } from "@ethersproject/abi";

chai.use(chaiAsPromised);

declare global {
    export var debuglog: debug.Debugger;
}

global.debuglog = debug("GNUSUnitTest:log")
global.debuglog.color = "158";

export const debuglog = global.debuglog;

export const toBN = BigNumber.from;
export const GNUS_TOKEN_ID = toBN(0);

export interface IFacetDeployedInfo {
    address?: string;
    tx_hash?: string;
    verified?: boolean;
}

export type FacetDeployedInfo = Record<string, IFacetDeployedInfo>;

export interface INetworkDeployInfo {
    DiamondAddress: string;
    DeployerAddress: string;
    FacetDeployedInfo: FacetDeployedInfo;
}

export type AfterDeployInit = (networkDeployInfo: INetworkDeployInfo) => Promise<void|boolean>;

export interface IFacetToDeployInfo {
    priority: number;
    init?: string;
    skipExisting?: boolean;
    deployInclude?: string[];
    callback?: AfterDeployInit;
}

export type FacetToDeployInfo = Record<string, IFacetToDeployInfo>;

export function toWei(value: number | string): BigNumber {
    return ethers.utils.parseEther(value.toString());
}

export function getSighash(funcSig: string) : string {
    return ethers.utils.Interface.getSighash(Fragment.fromString(funcSig));
}

