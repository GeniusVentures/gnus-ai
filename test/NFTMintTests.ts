import { ethers } from "hardhat";
import {BigNumber, utils } from "ethers";
import { logEvents } from ".";
import { dc, debuglog, GNUS_TOKEN_ID, assert, expect, toBN, toWei } from "../scripts/common";
import { iObjToString } from "./iObjToString";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { GeniusDiamond } from "../typechain-types/GeniusDiamond";
import * as NFTMintChildTests from "../test/NFTMintChildTests"

export function suite() {
    describe.only("GNUS NFT Factory Mint Testing", async function () {
        let signers: SignerWithAddress[];
        let owner: string;
        let gdAddr1: GeniusDiamond;
        let gdAddr2: GeniusDiamond;
        const addr1ParentNFT: BigNumber = toBN(1);
        const gnusDiamond = dc.GeniusDiamond as GeniusDiamond;

        before(async () => {
            signers = await ethers.getSigners();
            owner = signers[0].address;
            gdAddr1 = await gnusDiamond.connect(signers[1]);
            gdAddr2 = await gnusDiamond.connect(signers[2]);
        })

        it("Testing NFT Factory to mint child tokens of GNUS with address 2", async () => {
            await expect(gdAddr2.mint(signers[2].address, addr1ParentNFT, toWei(5), [])).to.be.eventually.rejectedWith(Error,
                /Creator or Admin can only mint NFT/);
        });

        it("Testing NFT Factory to mint child NFTS (tokens) of GNUS with address 1", async () => {
            const startingSupply = await gnusDiamond.totalSupply(GNUS_TOKEN_ID);
            debuglog(`Starting GNUS Supply: ${utils.formatEther(startingSupply)}`);
            const tx = await gdAddr1.mint(signers[2].address, addr1ParentNFT, toWei(5), []);
            logEvents(tx);
            const endingSupply = await gnusDiamond.totalSupply(GNUS_TOKEN_ID);
            const burntSupply = startingSupply.sub(endingSupply);
            assert(burntSupply.eq(toWei(5.0*2.0)),
                `Burnt Supply should equal minted * exchange rate (5.0*2.0), but equals ${burntSupply.toString()}`);
            debuglog(`Total GNUS burned: ${utils.formatEther(burntSupply)}`);
        });

        after(() => {
            NFTMintChildTests.suite();
        });
    });
}
