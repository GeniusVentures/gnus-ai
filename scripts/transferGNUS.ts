import { ethers, network } from 'hardhat';
import {
  AxelarQueryAPI,
  Environment,
  EvmChain,
  GasToken,
} from '@axelar-network/axelarjs-sdk';

const api = new AxelarQueryAPI({ environment: Environment.TESTNET });
// interchain token service contract on axelar
const itsAddress = '0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C';
const tokenId = '0xb01d90cccc07b6da85d31329bdb4943262f93e8ef4b1f51fb82bdf158bca70f9';
if (network.name !== 'base_sepolia') {
  console.log('Not supported for the network!');
  process.exit(0);
}
async function transferToken() {
  const signerAddress = (await ethers.getSigners())[0];
  const gas = await api.estimateGasFee(
    EvmChain.BASE_SEPOLIA,
    EvmChain.ARBITRUM_SEPOLIA,
    2000000,
    'auto',
    GasToken.BASE_SEPOLIA,
  );
  console.log('gas: ', gas);
  const its = await ethers.getContractAt('IInterchainTokenService', itsAddress);
  const tx = await its.interchainTransfer(
    tokenId,
    EvmChain.ARBITRUM_SEPOLIA,
    signerAddress.address,
    ethers.utils.parseEther('2'),
    '0x',
    gas,
    {
      value: gas,
    },
  );
  await tx.wait();
}

transferToken().then((result) => {
  console.log('Sent token.');
});
