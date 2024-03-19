import { defaultAbiCoder, keccak256 } from 'ethers/lib/utils';
import { ethers, network } from 'hardhat';
import { deployments } from './deployments';

const MINT_BURN = 0;
// interchain token service contract on axelar
const itsAddress = '0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C';

async function deployTokenManager(salt: string) {
  console.log(`Registering custom token at for ${network.name}`);
  const deployerAddress = (await ethers.getSigners())[0].address;
  const gnusTokenAddress = deployments[network.name].DiamondAddress;
  const params = defaultAbiCoder.encode(
    ['bytes', 'address'],
    [deployerAddress, gnusTokenAddress],
  );
  const its = await ethers.getContractAt('IInterchainTokenService', itsAddress);
  await (await its.deployTokenManager(salt, '', MINT_BURN, params, 0)).wait();
  const tokenId = await its.interchainTokenId(deployerAddress, salt);
  const tokenManagerAddress = await its.tokenManagerAddress(tokenId);
  const tokenManager = await ethers.getContractAt('ITokenManager', tokenManagerAddress);
  return tokenManager;
}
const salt = keccak256(
  defaultAbiCoder.encode(['string', 'uint256'], ['gnus.ai.token.manager', 202403]),
);
deployTokenManager(salt).then((result) => {
  console.log('Deployed token manager');
});
