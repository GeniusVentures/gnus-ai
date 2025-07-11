import debug from 'debug';
import hre from 'hardhat';
import { INetworkDeployInfo, writeDeployedInfo } from './common';
import { deployments } from '../notes/archive/deployments';
import { BaseContract } from 'ethers';
// import { LoadFacetDeployments } from '../scripts/facets';

/**
 * Logger for debugging contract verification process
 */
const log: debug.Debugger = debug('GNUSVerify:log');
const ethers = hre.ethers;

/**
 * Verifies the deployed smart contracts on the current Ethereum network.
 *
 * This function iterates over the deployed contract facets, verifying them if they haven't been verified already.
 *
 * @param {INetworkDeployInfo} networkDeployInfo - Object containing network-specific deployment details, including contract addresses and verification status.
 */
export async function VerifyContracts(networkDeployInfo: INetworkDeployInfo) {
  // Ensure the GNUS Diamond contract is verified before verifying individual facets.
  if (!networkDeployInfo.FacetDeployedInfo['DiamondCutFacet']?.verified) {
    log(`Verifying GNUS Diamond at address ${networkDeployInfo.DiamondAddress}`);
    await hre.run('verify:verify', {
      address: networkDeployInfo.DiamondAddress,
      constructorArguments: [
        networkDeployInfo.DeployerAddress,
        networkDeployInfo.FacetDeployedInfo['DiamondCutFacet'].address,
      ],
    });
  }

  // Iterate through all deployed facets and verify them if they haven't been verified already.
  for (const facetName in networkDeployInfo.FacetDeployedInfo) {
    const facetContractInfo = networkDeployInfo.FacetDeployedInfo[facetName];
    if (!facetContractInfo.verified) {
      const facetAddress = facetContractInfo.address;
      log(`Verifying GNUS Facet ${facetName} at address ${facetAddress}`);

      const facetContract: BaseContract = await ethers.getContractAt(
        facetName,
        networkDeployInfo.DiamondAddress,
      );

      await hre.run('verify:verify', {
        address: facetAddress,
      });

      facetContractInfo.verified = true;
    }
  }
}

/**
 * Main function to trigger contract verification based on network conditions.
 *
 * This function ensures that contracts are compiled before verification and handles deployment verification
 * only on non-local networks.
 */
async function main() {
  if (require.main === module) {
    debug.enable('GNUS.*:log');
    const networkName = hre.network.name;
    log.enabled = true;

    if (networkName in deployments) {
      const networkDeployInfo: INetworkDeployInfo = deployments[networkName];

      if (!['hardhat', 'localhost'].includes(networkName)) {
        // await LoadFacetDeployments();
        await VerifyContracts(networkDeployInfo);
        log(`Finished verifying GNUS Diamond at ${networkDeployInfo.DiamondAddress}`);
      }

      if (networkName !== 'hardhat') {
        writeDeployedInfo(deployments);
        log(
          `Finished verifying GNUS Contracts/Facets at ${networkDeployInfo.DiamondAddress}`,
        );
      }
    }
  }
}

/**
 * Recommended pattern to handle async/await properly and ensure error handling.
 */
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
