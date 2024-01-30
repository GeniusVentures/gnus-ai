import {BaseContract, BigNumber, Contract} from "ethers";
import {ethers} from "hardhat";
import {debug} from "debug";
import {IrrigatnionDiamond} from "../typechain-types/GeniusDiamond";
import {DiamondCutFacet} from "../typechain-types/DiamondCutFacet";
import {DiamondLoupeFacet} from "../typechain-types/DiamondLoupeFacet";
import {OwnershipFacet} from "../typechain-types/OwnershipFacet";
import * as chai from "chai";

export const assert = chai.assert;
export const expect = chai.expect;
import chaiAsPromised from "chai-as-promised"
import {Context} from "mocha";
import { Fragment } from "@ethersproject/abi";
import fs from "fs";
import util from "util";

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
    funcSelectors?: string[];
    verified?: boolean;
    version?: number;
}

export type FacetDeployedInfo = Record<string, IFacetDeployedInfo>;

// map Facet Selectors to contract address string
export interface IDeployedFacetSelectors {
    facets: Record<string, string>;
}

// map contract name to array of FacetSignature strings
export interface IDeployedContractFacetSelectors {
    contractFacets: Record<string, string[]>
}

export type FacetSelectorsDeployed = (IDeployedFacetSelectors & IDeployedContractFacetSelectors);

export interface INetworkDeployInfo {
    DiamondAddress: string;
    DeployerAddress: string;
    FacetDeployedInfo: FacetDeployedInfo;
    ExternalLibraries?: any;
}

export type AfterDeployInit = (networkDeployInfo: INetworkDeployInfo) => Promise<void|boolean>;

export interface IVersionInfo {
    fromVersion?: number;
    init?: string;
    upgradeInit?: string;
    deployInclude?: string[];
    callback?: AfterDeployInit;
}

export type VersionRecord = Record<number, IVersionInfo>;

export interface IFacetToDeployInfo {
    priority: number;
    versions?: VersionRecord;
    libraries?: string[];
}

export type FacetToDeployInfo = Record<string, IFacetToDeployInfo>;

export function toWei(value: number | string): BigNumber {
    return ethers.utils.parseEther(value.toString());
}

export function getSighash(funcSig: string) : string {
    return ethers.utils.Interface.getSighash(Fragment.fromString(funcSig));
}

export function writeDeployedInfo(deployments: { [key: string]: INetworkDeployInfo }) {
    fs.writeFileSync('scripts/deployments.ts', `\nimport { INetworkDeployInfo } from "../scripts/common";\n` +
        `export const deployments: { [key: string]: INetworkDeployInfo } = ${util.inspect(deployments, { depth: null })};\n`, "utf8");
}

export type DeployedContracts = Record<string, BaseContract >;

export const dc: DeployedContracts = {};
