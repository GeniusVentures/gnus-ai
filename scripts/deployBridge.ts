import { defaultAbiCoder, keccak256 } from 'ethers/lib/utils';
import { ethers, network } from 'hardhat';
import { deployments } from './deployments';
import {
  AxelarQueryAPI,
  Environment,
  EvmChain,
  GasToken,
} from '@axelar-network/axelarjs-sdk';

const MINT_BURN = 4;
// interchain token service contract on axelar
const itsAddress = '0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C';
const api = new AxelarQueryAPI({ environment: Environment.TESTNET });
async function deployTokenManager(salt: string) {
  console.log(`Registering custom token at for ${network.name}`);
  const deployerAddress = (await ethers.getSigners())[0].address;
  const gnusTokenAddress = deployments[network.name].DiamondAddress;
  console.log('deployer:', deployerAddress);
  const params = defaultAbiCoder.encode(
    ['bytes', 'address'],
    [deployerAddress, gnusTokenAddress],
  );
  const its = await ethers.getContractAt('IInterchainTokenService', itsAddress);
  const gas = await api.estimateGasFee(
    EvmChain.SEPOLIA,
    EvmChain.ARBITRUM_SEPOLIA,
    700000,
    'auto',
    GasToken.SEPOLIA,
  );
  console.log('Gas:', gas.toString());
  const tx = await its.deployTokenManager(
    salt,
    'arbitrum-sepolia',
    MINT_BURN,
    params,
    gas,
    { value: gas },
  );
  await tx.wait();
  const tokenId = await its.interchainTokenId(deployerAddress, salt);
  const tokenManagerAddress = await its.tokenManagerAddress(tokenId);
  console.log('Deployed:', tokenManagerAddress);
  const tokenManager = await ethers.getContractAt('ITokenManager', tokenManagerAddress);
  return tokenManager;
}
const salt = keccak256(
  defaultAbiCoder.encode(['string', 'uint256'], ['gnus.ai.token.manager', 202403]),
);
deployTokenManager(salt).then((result) => {
  console.log('Deployed token manager');
});
