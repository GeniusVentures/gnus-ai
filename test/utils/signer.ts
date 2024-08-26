import { BigNumber } from 'ethers';
import hre, { ethers } from 'hardhat';
import { toWei } from '../../scripts/common';

export async function impersonateSigner(signerAddress: string) {
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [signerAddress],
  });
  return await ethers.getSigner(signerAddress);
}

export async function setEtherBalance(address: string, amount: BigNumber) {
  await hre.network.provider.send('hardhat_setBalance', [
    address,
    amount.toHexString().replace('0x0', '0x'),
  ]);
}

export const updateOwnerForTest = async (rootAddress: string) => {
  const curOwner = (await ethers.getSigners())[0];
  const ownership = await ethers.getContractAt('GeniusOwnershipFacet', rootAddress);
  const oldOwnerAddress = await ownership.owner();
  const oldOwner = await impersonateSigner(oldOwnerAddress);
  if (oldOwnerAddress !== curOwner.address) {
    debuglog(`Transterring ownership from ${oldOwnerAddress}`);
    await setEtherBalance(oldOwnerAddress, toWei(10));
    await ownership.connect(oldOwner).transferOwnership(curOwner.address);
  }
  return oldOwnerAddress;
};

