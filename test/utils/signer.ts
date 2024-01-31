import { BigNumber } from 'ethers';
import hre, { ethers } from 'hardhat';

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
