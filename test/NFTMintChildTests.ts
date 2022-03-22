import { ethers } from "hardhat";
import {BigNumber, utils } from "ethers";
import { logEvents } from ".";
import { debuglog, GNUS_TOKEN_ID, assert, expect, toBN, toWei, dc } from "../scripts/common";
import { iObjToString } from "./iObjToString";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { GeniusDiamond } from "../typechain-types/GeniusDiamond";

export function suite() {
    describe.only("GNUS NFT Factory Mint Child NFTs Testing", async function () {
        let signers: SignerWithAddress[];
        let owner: string;
        let gdAddr1: GeniusDiamond;
        let gdAddr2: GeniusDiamond;
        const ParentNFTID: BigNumber = toBN(1);
        const gnusDiamond = dc.GeniusDiamond as GeniusDiamond;

        before(async () => {
            signers = await ethers.getSigners();
            owner = signers[0].address;
            gdAddr1 = await gnusDiamond.connect(signers[1]);
            gdAddr2 = await gnusDiamond.connect(signers[2]);
        })

        it("Testing NFT Factory to mint child NFT's of Addr1 Token", async () => {
            const addr1childNFT1 = ParentNFTID.shl(128).or(0);
            await expect(gdAddr2.mint(signers[2].address, addr1childNFT1, toWei(5), [])).to.be.eventually.rejectedWith(Error,
                /Creator or Admin can only mint NFT/);
        });

        it("Testing NFT Factory to mint child NFTs of Addr1 with address 1", async () => {
            const addr1childNFT1 = ParentNFTID.shl(128).or(0);
            const addr1childNFT2 = ParentNFTID.shl(128).or(1);
            const addr1childNFT3 = ParentNFTID.shl(128).or(2);
            const startingSupply = await gnusDiamond.totalSupply(GNUS_TOKEN_ID);
            debuglog(`Starting GNUS Supply: ${utils.formatEther(startingSupply)}`);
            // try to mint too many
            await expect(gdAddr1.mintBatch(signers[2].address, [addr1childNFT1, addr1childNFT2, addr1childNFT3],
                [ 5, 100, 10], [])).to.be.eventually.rejectedWith(Error, /Not enough supply to mint tokens/);
            // now do with under max Supply
            const tx = await gdAddr1.mintBatch(signers[2].address, [addr1childNFT1, addr1childNFT2, addr1childNFT3],
                [ 50, 1, 1], []);
            logEvents(tx);
            const endingSupply = await gnusDiamond.totalSupply(GNUS_TOKEN_ID);
            const burntSupply = startingSupply.sub(endingSupply);
            debuglog(`Total GNUS burned: ${utils.formatEther(burntSupply)}`);

            // get information about NFT
            for (let i = 0; i<3; i++) {
                const nftID = ParentNFTID.shl(128).or(i);
                const totalSupply = await gdAddr1.totalSupply(nftID);
                debuglog(`Total Supply for ParentNFT1:NFT${i+1} ${totalSupply}`);
            }

            const symbols: string[] = [];
            symbols.push((await gnusDiamond.getNFTInfo(GNUS_TOKEN_ID)).symbol);
            symbols.push((await gnusDiamond.getNFTInfo(ParentNFTID)).symbol);

            // get how many we own now
            const addrs: string[] = [];
            const tokenIDs: BigNumber[] = [];
            // fill addresses
            for (let i=0; i<3; i++) {
                addrs.push(signers[i].address);
                tokenIDs.push(GNUS_TOKEN_ID);
                addrs.push(signers[i].address);
                tokenIDs.push(ParentNFTID);
                for (let j=0; j< 3; j++) {
                    addrs.push(signers[i].address);
                    tokenIDs.push(ParentNFTID.shl(128).or(j));
                }
            }

            const ownedNFTs = await gnusDiamond.balanceOfBatch(addrs, tokenIDs);
            ownedNFTs.forEach((bn, index) => {
                const addr = Math.floor(index/5);
                const parentNFT = (index % 5) ? 1 : 0;
                const childNFT = parentNFT ? Math.floor(((index-1)%5)) : 0;
                debuglog(`Address ${addr} has ${ (parentNFT && childNFT) ? bn.toNumber() : utils.formatEther(bn)} ${symbols[parentNFT]}::ChildNFT${childNFT} NFTs`);
            });
        });

    });
}
