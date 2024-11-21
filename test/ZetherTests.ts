import { ethers, web3 } from "hardhat";
import { dc, expect, toWei, GNUS_TOKEN_ID } from "../scripts/common";
import { assert } from 'chai';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Zether } from '../typechain-types/Zether';
import Client from '@gnus.ai/zk-utils/src/client';
import bn128 from '@gnus.ai/zk-utils/src/utils/bn128';

export function suite () {
    describe("GNUS Zether Testing", async function () {
        let signers: SignerWithAddress[];
        let owner: SignerWithAddress;
        const zEtherContract = dc.GeniusDiamond as Zether;
        let zEtherClient: Client;
        let token1: any;
        let secretKey: any;
        before(async () => {
            signers = await ethers.getSigners();
            owner = signers[0];
            const mockTokenContract = await ethers.getContractFactory('MockERC20Upgradeable');
            token1 = await mockTokenContract.deploy();
            await token1.Token_Initialize('Test', 'TEST', toWei(100_000_000));
            await zEtherContract.init(token1.address, 16);
            zEtherClient = new Client(web3, zEtherContract, owner, signers);
        })
        it('Testing Zsc setting max public keys', async () => {
            await expect(zEtherContract.setMaxKeys(3)).to.be.revertedWith(
                'Max Number of Public Keys need to be a power of 2'
            );
            secretKey = bn128.randomScalar();
            const pubKey = bn128.curve.g.mul(secretKey);
            await zEtherContract.setPublicKeys(1, 0, [bn128.serialize(pubKey)]);
        })
        it("Testing Zether register and deposit", async () => {
            await zEtherClient.register();
            await token1.approve(zEtherContract.address, toWei(1000));
            await zEtherClient.deposit(100);
        });
    });
}
