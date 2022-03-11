import { ethers } from "hardhat";
import { logEvents } from ".";
import { di, debuglog, GNUS_TOKEN_ID, assert, expect, toBN, toWei } from "../scripts/common";
import { iObjToString } from "./iObjToString";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export function suite() {
    describe("GNUS NFT Factory Testing", async function () {
        let signers: SignerWithAddress[];
        let owner: string;
        const twoThoWei = ethers.utils.parseEther("2000");

        before(async () => {
            signers = await ethers.getSigners();
            owner = signers[0].address;
            const amount = await di.gnusDiamond.totalSupply(GNUS_TOKEN_ID);
        })

        it("Testing NFT Factory that GNUS Tokens are there for address 1", async () => {
            const tx = await di.gnusDiamond.burn(owner, GNUS_TOKEN_ID, toWei(2000));
            logEvents(tx);
            const amount = await di.gnusDiamond.balanceOf(signers[1].address, GNUS_TOKEN_ID);
            assert(amount.eq(toWei(2000)), `Address one should equal 2000, but equals ${ethers.utils.formatEther(amount)}`);
        });

        it("Testing NFT Factory to mint GNUS Token", async () => {
            try {
                await expect(di.gnusDiamond.mint(owner, GNUS_TOKEN_ID, toWei(2000), [])).to.eventually.be.rejectedWith(Error,
                    /Shouldn\'t mint GNUS tokens tokens, only deposit and withdraw/);
            } catch (e) {
                console.log(e);
            }

        });

        // this is a permanent burn, because supply is 0
        //it("Testing NFT Factory update totalSupply for GNUS_Token for non-ownwer", async () => {
        //    const amount = await di.gnusDiamond.(owner, GNUS_TOKEN_ID);
        //    assert(amount.eq(toBN(0)), `Address owner should equal 0, but equals ${amount.toNumber}`);
        //});


    });
}
