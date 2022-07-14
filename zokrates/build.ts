import { BigNumber, utils } from "ethers";
import { debug } from "debug";
import { XORWOW_STATE, xorwow } from "../test/xorwow";
import fs from "fs";
import util from "util";
import * as uint32 from "uint32";

debug.enable("*");
const log: debug.Debugger = debug("BuildZOK:log");
log.color = "142";

// number of 32 bit words in 256 bits
type field = BigNumber;

export const C32T256 = 8;
const NUM_NODES = 11;
const NUM_BLOCKS_PER_NODE = 10;

export class BLOCK_HEADER {
    prevHash: field;
    nonce: number;
    timestamp: number;
    uncleHash: field;
    dataHash: field;

    constructor(init: { prevHash?: field, nonce?: number, timestamp?: number, uncleHash?: field, dataHash?: field}) {
        this.prevHash = init.prevHash || BigNumber.from(0);
        this.nonce = init.nonce || uint32.toUint32(0);
        this.timestamp = init.timestamp || uint32.toUint32(0);
        this.uncleHash = init.uncleHash || BigNumber.from(0);
        this.dataHash = init.dataHash || BigNumber.from(0);
    }

    toJSON() : object {
        return {
            prevHash: this.prevHash.toString(),
            nonce: `0x${this.nonce.toString(16)}`,
            timestamp: `0x${this.timestamp.toString(16)}`,
            uncleHash: this.uncleHash.toString(),
            dataHash: this.dataHash.toString()
        };
    }
}

function BlockHeaderReviver(key: string, value: any): any {
    if (["prevHash", "uncleHash", "dataHash", "encKeySeed"].includes(key)) {
        return BigNumber.from(value);
    } else if (["nonce", "timestamp"].includes(key)) {
        let intValue: number;
        if (typeof value === 'number') {
            intValue = value;
        } else {
            intValue = parseInt(value.toString(), 16);
        }
        return uint32.toUint32(intValue);
    } else {
        return value;
    }
}

export function unpack256(toUnpack: BigNumber): Uint32Array {
    const encKeySeed32: Uint32Array = new Uint32Array(C32T256);
    encKeySeed32[7] = toUnpack.shr(0).and(0xffffffff).toNumber();
    encKeySeed32[6] = toUnpack.shr(32).and(0xffffffff).toNumber();
    encKeySeed32[5] = toUnpack.shr(64).and(0xffffffff).toNumber();
    encKeySeed32[4] = toUnpack.shr(96).and(0xffffffff).toNumber();
    encKeySeed32[3] = toUnpack.shr(128).and(0xffffffff).toNumber();
    encKeySeed32[2] = toUnpack.shr(160).and(0xffffffff).toNumber();
    encKeySeed32[1] = toUnpack.shr(192).and(0xffffffff).toNumber();
    encKeySeed32[0] = toUnpack.shr(224).and(0xffffffff).toNumber();
    return encKeySeed32;
}

export function buildInitialZokEncoder(encKeySeed256: BigNumber): BLOCK_HEADER[][] {
    const encKeySeed32: Uint32Array = unpack256(encKeySeed256);
    // set up the random generator seed for xorwow function
    const state: XORWOW_STATE = {
        x: new Uint32Array([
            encKeySeed32[0] ^ encKeySeed32[1], encKeySeed32[2] ^ encKeySeed32[3], encKeySeed32[4] ^ encKeySeed32[5], encKeySeed32[6] ^ encKeySeed32[7],
            0xdeadc0de]),
        counter: uint32.toUint32(0xdeadbeef)
    };

    log(`state[0]: ${util.inspect(state)}`);
    // get randomly selected verifier block
    const verifierNodeIndex: number = xorwow(state) % NUM_NODES;
    log(`state[1]: ${util.inspect(state)}`);
    // get the first node index % 11, could be verifier node too
    let curNodeIndex: number = xorwow(state) % NUM_NODES;
    log(`state[2]: ${util.inspect(state)}`);
    // get the random first block inside the nodes processed blocks
    let blockIndex: number = xorwow(state) % NUM_BLOCKS_PER_NODE;
    log(`state[3]: ${util.inspect(state)}`);
    // get a random stride to access the nodes processed blocks
    const verifierStride: number = xorwow(state) % NUM_BLOCKS_PER_NODE;
    log(`state[4]: ${util.inspect(state)}`);
    // current verified node count
    let verifiedNodeCount: number = 0;

    log(`state: ${util.inspect(state)}`);
    log(`Zok Encoder Parameters: 
    verifierNodeIndex: ${verifierNodeIndex}
    starting node index: ${curNodeIndex}
    starting block index: ${blockIndex}
    verifier_stride: ${verifierStride}`);

    // block headers that will be passed to ZKSnark code
    const blockHeaders: BLOCK_HEADER[][] = Array.from(Array(NUM_NODES), e => Array(NUM_BLOCKS_PER_NODE).fill(new BLOCK_HEADER({ dataHash: BigNumber.from(0xdeaffacade) })));

    for (let i = 0; i < NUM_NODES; i++) {
        // dummy up hashes for now just for generation
        const verifierHash: BigNumber = BigNumber.from(i + 0xdeadc0de);
        if (i !== verifierNodeIndex) {
            blockHeaders[verifierNodeIndex][verifiedNodeCount] = new BLOCK_HEADER({ dataHash: verifierHash, nonce: uint32.addMod32(i,   32768) });
            blockHeaders[curNodeIndex][blockIndex] = new BLOCK_HEADER({ dataHash: verifierHash });
            verifiedNodeCount++;
            // check next node, wrap (modulo) NUM_NODES
            curNodeIndex = (curNodeIndex + 1) % NUM_NODES;
            // bump block index by stride and wrap (modulo)
            blockIndex = (blockIndex + verifierStride) % NUM_BLOCKS_PER_NODE;
        }
    }

    return blockHeaders;
}

// const compileCode = "  ../../ZoKrates/target/release/zokrates compile -i SGVerifier.zok -o SGVerifier.zkbin --stdlib-path=../../ZoKrates/zokrates_stdlib/stdlib/";

async function main() {
    if (require.main === module) {
        let generatedRandom: BigNumber;
        let previousBlockHeader: BLOCK_HEADER;
        let blockHeaders: BLOCK_HEADER[][];
        if (fs.existsSync("SGVerifier.abi.json")) {
            const abiDataString = fs.readFileSync("SGVerifier.abi.json", "utf8");
            const abiData = JSON.parse(abiDataString, BlockHeaderReviver);
            generatedRandom = BigNumber.from(abiData[0]);
            log(`Random Number: ${generatedRandom._hex}`)
            buildInitialZokEncoder(generatedRandom);
            previousBlockHeader = abiData[1];
            blockHeaders = abiData[2];

            // log(`read abiData: ${util.inspect(abiData, {depth: null})}`);
        } else {
            log("Creating SGVerifier.abi.json");
            generatedRandom = BigNumber.from(utils.randomBytes(32));
            log(`Random Number generated: ${generatedRandom._hex}`);
            blockHeaders = buildInitialZokEncoder(generatedRandom);
            previousBlockHeader = new BLOCK_HEADER({ dataHash: BigNumber.from(0) });
            const abiOut = [generatedRandom.toString(), previousBlockHeader, blockHeaders];
            const abiString = JSON.stringify(abiOut, null, 2);
            // write the abi file
            fs.writeFileSync('SGVerifier.abi.json', abiString, "utf8");
            log(`wrote SGVerifier.abi.json`);
        }
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
