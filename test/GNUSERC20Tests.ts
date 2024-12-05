import { ethers, network } from 'hardhat';
import { dc, expect, toWei, GNUS_TOKEN_ID, debuglog } from '../scripts/common';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { GeniusDiamond } from '../typechain-types/GeniusDiamond';
import { getInterfaceID } from '../scripts/FacetSelectors';
import { IERC20Upgradeable__factory } from '../typechain-types/factories/IERC20Upgradeable__factory';
import { deployments } from '../scripts/deployments';
import { assert } from 'chai';

// Define the test suite for GNUS ERC20 functionality within the hybrid Genius Diamond contract.
export function suite() {
  describe('GNUS ERC20 Hybrid Testing', async function () {
    // Variables to store the list of signers, the owner's address, and a connected GeniusDiamond instance.
    let signers: SignerWithAddress[];
    let owner: string;
    let gdAddr1: GeniusDiamond;

    // Reference to the main GeniusDiamond instance, cast to the GeniusDiamond type.
    const gnusDiamond = dc.GeniusDiamond as GeniusDiamond;

    // Before hook to set up signers and connect `gnusDiamond` to the first signer.
    before(async () => {
      // Retrieve available signers and assign the first one as the `owner`.
      signers = await ethers.getSigners();
      owner = signers[0].address;

      // Connect the `gnusDiamond` contract instance to the second signer for testing purposes.
      gdAddr1 = await gnusDiamond.connect(signers[1]);
    });
    
    // Test to check if the GeniusDiamond contract supports the ERC20 interface.
    it('Testing GNUS ERC20 interface is supported', async () => {
      // Create the ERC20 interface using the IERC20Upgradeable factory.
      const IERC20UpgradeableInterface = IERC20Upgradeable__factory.createInterface();

      // Generate the ERC20 interface ID by XORing with the base interface ID.
      const IERC20InterfaceID = getInterfaceID(IERC20UpgradeableInterface);

      // Assert that the `gnusDiamond` contract supports the ERC20 interface.
      assert(
        await gnusDiamond.supportsInterface(IERC20InterfaceID._hex),
        "Doesn't support IERC20Upgradeable",
      );
    });

    // Test to verify GNUS ERC20 token transfer functionality and supply checks.
    it('Testing GNUS ERC20 transfer', async () => {
      // Get the total supply of GNUS tokens and check if it matches the expected amount (900,000).
      const gnusSupply = await gnusDiamond['totalSupply()']();
      let actualSupply = ethers.utils.formatEther(gnusSupply);
      assert(
        gnusSupply.eq(toWei(900_000)),
        `GNUS Supply should be 900,000, but is ${actualSupply}`,
      );

      // Retrieve the owner's balance, which should be zero initially.
      let ownerSupply = await gnusDiamond['balanceOf(address)'](owner);
      assert(
        ownerSupply.eq(toWei(0)),
        `Owner balanceOf should be 0, but is ${ethers.utils.formatEther(ownerSupply)}`,
      );

      // Check if the owner has the `MINTER_ROLE`, allowing them to mint tokens.
      const minterRole = await gnusDiamond['MINTER_ROLE']();
      const ownershipFacet = await ethers.getContractAt(
        'GeniusOwnershipFacet',
        gnusDiamond.address,
      );
      expect(await ownershipFacet.hasRole(minterRole, owner)).to.be.eq(true);

      // Mint 150 GNUS tokens to the owner’s address and verify the updated balance.
      await gnusDiamond['mint(address,uint256)'](owner, toWei(150));
      ownerSupply = await gnusDiamond['balanceOf(address)'](owner);
      assert(
        ownerSupply.eq(toWei(150)),
        `Owner balanceOf should be > 150, but is ${ethers.utils.formatEther(ownerSupply)}`,
      );

      // Transfer 150 GNUS tokens from the owner to the fourth signer.
      await gnusDiamond.transfer(signers[3].address, toWei(150));
    });

    // Test to validate `transferFrom` and `approve` functionalities for the GNUS ERC20 token.
    it('Testing GNUS transferFrom & approval', async () => {
      // Connect `gnusDiamond` to the third and fourth signers to create instances for their addresses.
      const gdAddr3 = await gnusDiamond.connect(signers[3]);
      const gdAddr4 = await gnusDiamond.connect(signers[4]);
      const addr3 = signers[3].address;
      const addr4 = signers[4].address;

      // Approve the owner to spend 50 GNUS tokens on behalf of the third signer.
      await gdAddr3.approve(owner, toWei(50));

      // Attempt a transferFrom by the fourth signer on behalf of the third signer, expecting rejection due to insufficient allowance.
      await expect(
        gdAddr4.transferFrom(addr3, owner, toWei(50)),
      ).to.eventually.be.rejectedWith(Error, /ERC20: insufficient allowance/);

      // Transfer 25 GNUS tokens from `addr3` to `addr4` and then another 25 GNUS tokens from `addr3` to `owner`.
      await gnusDiamond.transferFrom(addr3, addr4, toWei(25));
      await gnusDiamond.transferFrom(addr3, owner, toWei(25));

      // Attempt another transferFrom of 1 GNUS token from `addr3` to `owner`, expecting rejection due to depleted allowance.
      await expect(
        gnusDiamond.transferFrom(addr3, owner, toWei(1)),
      ).to.eventually.be.rejectedWith(Error, /ERC20: insufficient allowance/);

      // Approve the owner as an operator for all of `addr3`'s ERC20 tokens, allowing unrestricted transfers.
      await gdAddr3.setApprovalForAll(owner, true);

      // Set up the address for the `EscrowAIJob` contract to test ERC1155 `safeTransferFrom`.
      const escrowAIContractAddress = dc.EscrowAIJob.address;

      // Attempt to safely transfer 1 GNUS ERC1155 token to `EscrowAIJob`, expecting failure as the target does not implement the ERC1155 receiver.
      await expect(
        gnusDiamond.safeTransferFrom(
          addr3,
          escrowAIContractAddress,
          GNUS_TOKEN_ID,
          toWei(1),
          [],
        ),
      ).to.eventually.be.rejectedWith(
        Error,
        /ERC1155: transfer to non ERC1155Receiver implementer/,
      );

      // Revoke `setApprovalForAll` for the owner, restricting further unrestricted transfers of ERC1155 tokens.
      await gdAddr3.setApprovalForAll(owner, false);

      // Re-approve the owner to spend an additional 50 GNUS ERC20 tokens on behalf of `addr3`.
      await gdAddr3.approve(owner, toWei(50));

      // Perform a `transferFrom` operation from `addr3` to `escrowAIContractAddress` for 1 GNUS token, succeeding due to ERC20 not enforcing ERC1155 checks.
      await gnusDiamond.transferFrom(addr3, escrowAIContractAddress, toWei(1));
    });
  });
}
