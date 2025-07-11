import debug from 'debug';
import hre from 'hardhat';
import { INetworkDeployInfo, writeDeployedInfo } from '../common';
import { deployments } from '../../notes/archive/deployments';
import util from 'util';
import { LoadFacetDeployments } from '../facets';
import {
  getDeployedFuncSelectors,
  getInterfaceID,
} from '../../notes/archive/FacetSelectors';

const log: debug.Debugger = debug('GNUSShowFacets:log');
const ethers = hre.ethers;

/**
 * Main function to show deployed facets.
 * This function loads the facet deployments, retrieves the deployed function selectors,
 * and logs the information for the current network.
 */
async function main() {
  // Enable debug logging if this script is the main module
  if (require.main === module) {
    debug.enable('GNUS.*:log');
    await LoadFacetDeployments(); // Load the facet deployments
    const networkName = hre.network.name; // Get the current network name
    log.enabled = true; // Enable logging

    // Check if the network is in the deployments
    if (networkName in deployments) {
      const networkDeployInfo: INetworkDeployInfo = deployments[networkName]; // Get the deployment info for the network
      const deployedFacetSelectorInfo = await getDeployedFuncSelectors(networkDeployInfo); // Get the deployed function selectors
      log(`${networkName} ${util.inspect(deployedFacetSelectorInfo, { depth: null })}`); // Log the deployed facet selector info
      writeDeployedInfo(deployments); // Write the deployed info to a file
    }
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
