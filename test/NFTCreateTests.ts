import { ethers } from "hardhat";
import { utils } from "ethers";
import { logEvents } from ".";
import { dc, debuglog, GNUS_TOKEN_ID, assert, expect, toBN, toWei} from "../scripts/common";
import { iObjToString } from "./iObjToString";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { GeniusDiamond } from "../typechain-types/GeniusDiamond";
// other files suites to execute
import * as NFTMintTests from "../test/NFTMintTests"

export function suite() {
    describe("GNUS NFT Factory Testing", async function () {
        let signers: SignerWithAddress[];
        let owner: string;
        let gdAddr1: GeniusDiamond;
        const gnusDiamond = dc.GeniusDiamond as GeniusDiamond;

        before(async () => {
            signers = await ethers.getSigners();
            owner = signers[0].address;
            const amount = await gnusDiamond.totalSupply(GNUS_TOKEN_ID);

            gdAddr1 = await gnusDiamond.connect(signers[1]);
        })

        it("Testing NFT Factory that GNUS Tokens will burn for address 1", async () => {
            await gdAddr1.burn(signers[1].address, GNUS_TOKEN_ID, toWei(1000));
            const tx = await expect(gnusDiamond.burn(signers[1].address, GNUS_TOKEN_ID, toWei(1000)))
                .to.eventually.be.rejectedWith(Error, /ERC1155: caller is not owner nor approved/);
            logEvents(tx);
            const amount = await gnusDiamond.balanceOf(signers[1].address, GNUS_TOKEN_ID);
            assert(amount.eq(toWei(1000)), `Address one should equal 1000, but equals ${utils.formatEther(amount)}`);

        });

        it("Testing NFT Factory to mint GNUS Token", async () => {
            await expect(gnusDiamond.mint(owner, GNUS_TOKEN_ID, toWei(2000), [])).to.eventually.be.rejectedWith(Error,
                /Shouldn\'t mint GNUS tokens tokens, only deposit and withdraw/);

        });

        it("Testing NFT Factory to create new token for non-creator nor admin", async () => {
            await expect(gdAddr1.createNFT(GNUS_TOKEN_ID, "Addr1Token", "ADDR1", 200, toWei(50000000*200), ""))
                .to.eventually.be.rejectedWith(Error, /Only Creators or Admins can create NFT child of GNUS/);
        });

        it("Testing NFT Factory to create new NFT & child NFTs for creator", async () => {
            await gnusDiamond.grantRole(utils.id("CREATOR_ROLE"), signers[1].address);
            const GNUSNFTInfo = await gdAddr1.getNFTInfo(GNUS_TOKEN_ID);
            const newParentNFTID = GNUSNFTInfo.childCurIndex;
            // exchange rate = 2.0 Addr1Tokens for 1 GNUS token
            await gdAddr1.createNFT(GNUS_TOKEN_ID, "TEST GAME", "TESTGAME", toBN(2.0), toWei(50000000*2), "");
            let newNFTInfo = await gdAddr1.getNFTInfo(newParentNFTID);
            debuglog(`NfTInfo ${iObjToString(newNFTInfo)}`);

            await expect(gdAddr1.createNFTs(newParentNFTID, ["TESTGAME:NFT1", "TESTGAME:NFT2", "TESTGAME:NFT3"],
                [], [], [100], [])).to.eventually.be.rejectedWith(Error,
                    /NFT creation array lengths, should be the same/);

            await gdAddr1.createNFTs(newParentNFTID, ["TESTGAME:NFT1", "TESTGAME:NFT2", "TESTGAME:NFT3"],
                ["", "", ""], [1, 1, 1], [100, 1, 1], ["https://www.gnus.ai", "", ""]);

            newNFTInfo = await gdAddr1.getNFTInfo(newParentNFTID);
            assert(newNFTInfo.childCurIndex.eq(3), `Should have created 3 NFT's, but created ${newNFTInfo.childCurIndex.toString()}`);
            debuglog(`NfTInfo ${iObjToString(newNFTInfo)}`);


            for (let i = 0; i<3; i++) {
                const nftID = newParentNFTID.shl(128).or(i);
                const nftInfo = await gdAddr1.getNFTInfo(nftID);
                debuglog(`nftInfo${i.toString()} ${iObjToString(nftInfo)}}`);
            }

        });

        after(() => {
            NFTMintTests.suite();
        });
    });
}
