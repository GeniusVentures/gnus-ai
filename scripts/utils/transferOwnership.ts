import { ethers, network } from 'hardhat';
import { GeniusOwnershipFacet } from '../../typechain-types'; // Update the path to your typechain types
import { INetworkDeployInfo } from '../../notes/archive/common'; // Update the path to your common types

async function main(networkDeployInfo: INetworkDeployInfo) {
  const { DiamondAddress, DeployerAddress } = networkDeployInfo;

  if (!DiamondAddress || !DeployerAddress) {
    throw new Error('DiamondAddress or DeployerAddress is missing in networkDeployInfo');
  }

  console.log(`Network: ${network.name}`);
  console.log(`Diamond Address: ${DiamondAddress}`);
  console.log(`Deployer Address: ${DeployerAddress}`);

  // Impersonate the deployer account
  console.log(`Impersonating deployer account: ${DeployerAddress}`);
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [DeployerAddress],
  });

  // Get the deployer signer
  const deployerSigner = await ethers.getSigner(DeployerAddress);

  // Fund the impersonated deployer account
  const fundAmount = ethers.utils.parseEther('10'); // Adjust as needed
  const [funder] = await ethers.getSigners();
  console.log(`Funding deployer account with ${ethers.utils.formatEther(fundAmount)} ETH`);
  await funder.sendTransaction({
    to: DeployerAddress,
    value: fundAmount,
  });

  // Connect to the GeniusOwnershipFacet
  console.log(`Connecting to GeniusOwnershipFacet at: ${DiamondAddress}`);
  const ownershipFacet = (await ethers.getContractAt(
    'GeniusOwnershipFacet',
    DiamondAddress,
    deployerSigner,
  )) as GeniusOwnershipFacet;

  // Transfer ownership to the deployer address
  console.log(`Transferring contract ownership to: ${DeployerAddress}`);
  const tx = await ownershipFacet.transferOwnership(DeployerAddress);
  console.log('Transaction sent. Waiting for confirmation...');
  await tx.wait();

  // Verify the ownership transfer
  const currentOwner = await ownershipFacet.owner();
  if (currentOwner.toLowerCase() === DeployerAddress.toLowerCase()) {
    console.log(`Ownership successfully transferred to ${currentOwner}`);
  } else {
    throw new Error(`Ownership transfer failed. Current owner: ${currentOwner}`);
  }

  // Stop impersonating the deployer
  console.log(`Stopping impersonation of deployer account: ${DeployerAddress}`);
  await network.provider.request({
    method: 'hardhat_stopImpersonatingAccount',
    params: [DeployerAddress],
  });
}

// Replace `networkDeployInfo` with actual data when calling the script
const networkDeployInfo: INetworkDeployInfo = {
  DiamondAddress: '0xYourDiamondProxyAddress', // Replace with the actual diamond address
  DeployerAddress: '', // Replace with the actual deployer address
};

main(networkDeployInfo)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
