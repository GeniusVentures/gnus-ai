import hre, { ethers } from 'hardhat';
import { toWei } from '../common';
import { GeniusOwnershipFacet } from '../../typechain-types';
import { debuglog } from 'util';

/**
 * Impersonates a signer account. This is primarily used in Hardhat's testing environment
 * to simulate actions from accounts that are not part of the default test accounts.
 *
 * @param signerAddress - The address of the account to impersonate.
 * @returns The impersonated signer object.
 */
export async function impersonateSigner(signerAddress: string) {
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [signerAddress], // Address of the account to impersonate
  });
  return await ethers.getSigner(signerAddress); // Returns the impersonated signer
}

/**
 * Sets the Ether balance for a specified address in the Hardhat testing environment.
 * This is useful for ensuring test accounts have sufficient funds for transactions.
 *
 * @param address - The address to set the Ether balance for.
 * @param amount - The desired balance as a `BigNumber`.
 */
export async function setEtherBalance(address: string, amount: bigint) {
  await hre.network.provider.send('hardhat_setBalance', [
    address, // Address to modify the balance of
    '0x' + amount.toString(16), // Amount to set, formatted as a hex string
  ]);
}

/**
 * Updates the owner of the contract at the specified root address for testing purposes.
 * This involves transferring ownership from the current owner to the default signer in the Hardhat environment.
 *
 * @param rootAddress - The address of the root contract (e.g., GeniusOwnershipFacet).
 * @returns The address of the old owner.
 */
export const updateOwnerForTest = async (rootAddress: string) => {
  // Retrieve the current signer in the Hardhat environment
  const curOwner = (await ethers.getSigners())[0];

  // Get a reference to the GeniusOwnershipFacet contract at the specified root address
  const ownership = await ethers.getContractAt('GeniusOwnershipFacet', rootAddress) as GeniusOwnershipFacet;

  // Retrieve the current owner of the contract
  const oldOwnerAddress = await ownership.owner();

  // Impersonate the old owner
  const oldOwner = await impersonateSigner(oldOwnerAddress);

  // If the old owner is not the current signer, transfer ownership to the current signer
  if (oldOwnerAddress !== curOwner.address) {
    debuglog(`Transferring ownership from ${oldOwnerAddress}`);

    // Ensure the old owner has enough Ether to perform the ownership transfer
    await setEtherBalance(oldOwnerAddress, toWei(10));

    // Execute the ownership transfer from the old owner to the current signer
    await ownership.connect(oldOwner).transferOwnership(curOwner.address);
  }

  // Return the address of the old owner
  return oldOwnerAddress;
};
