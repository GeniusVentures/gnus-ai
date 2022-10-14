import { ethers } from "hardhat";
import { utils } from "ethers";
import { logEvents } from ".";
import {
    dc,
    debuglog,
    GNUS_TOKEN_ID,
    assert,
    expect,
    toBN,
    toWei,
} from "../scripts/common";
import { iObjToString } from "./iObjToString";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { GeniusDiamond } from "../typechain-types/GeniusDiamond";

export function suite() {
    describe("Testing Batch transfer erc20", async function () {
        let gdAddr1: GeniusDiamond;
        const gnusDiamond = dc.GeniusDiamond as GeniusDiamond;
        let owner, minter, sender, receiver1, receiver2;
        let oldTokenAmount1, oldTokenAmount2;
        before(async () => {
            [owner, minter, sender, receiver1, receiver2] = await ethers.getSigners();
            const totalSupply = await gnusDiamond["totalSupply(uint256)"](
                GNUS_TOKEN_ID
            );
            gdAddr1 = await gnusDiamond.connect(owner);
            const ownerSupply = await gnusDiamond["balanceOf(address,uint256)"](
                owner.address,
                GNUS_TOKEN_ID
            );
            oldTokenAmount1 = await gnusDiamond["balanceOf(address,uint256)"](
                receiver1.address,
                GNUS_TOKEN_ID
            );
            oldTokenAmount2 = await gnusDiamond["balanceOf(address,uint256)"](
                receiver2.address,
                GNUS_TOKEN_ID
            );
            console.log(
                `totalSupply, owner, receivers balance:`,
                utils.formatEther(totalSupply).toString(),
                utils.formatEther(ownerSupply).toString(),
                utils.formatEther(oldTokenAmount1).toString(),
                utils.formatEther(oldTokenAmount2).toString()
            );
            // assert(ownerSupply.gt(toWei(100)), `Owner balanceOf should be > 100, but is ${ethers.utils.formatEther(ownerSupply)}`);
        });

        it("Batch Transferring to two addresses", async () => {
            await gdAddr1.transferBatch(
                [receiver1.address, receiver2.address],
                [toWei(2), toWei(1)]
            );
            const updatedAmount1 = await gnusDiamond["balanceOf(address,uint256)"](
                receiver1.address,
                GNUS_TOKEN_ID
            );
            const updatedAmount2 = await gnusDiamond["balanceOf(address,uint256)"](
                receiver2.address,
                GNUS_TOKEN_ID
            );
            assert(
                updatedAmount1.eq(toWei(2).add(oldTokenAmount1)),
                `Address 1 should equal ${utils.formatEther(toWei(2).add(oldTokenAmount1))}, but equals ${utils.formatEther(updatedAmount1)}`
            );
            assert(
                updatedAmount2.eq(toWei(1).add(oldTokenAmount2)),
                `Address 2 should equal ${utils.formatEther(toWei(1).add(oldTokenAmount2))}, but equals ${utils.formatEther(updatedAmount2)}`
            );
        });
        after(() => {
            // NFTMintTests.suite();
        });
    });
}
