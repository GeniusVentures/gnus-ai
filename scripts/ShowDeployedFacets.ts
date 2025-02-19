import debug from 'debug';

const log: debug.Debugger = debug('GNUSShowFacets:log');
import { network } from 'hardhat';
import { INetworkDeployInfo, writeDeployedInfo } from '../scripts/common';
import { deployments } from '../scripts/deployments';
import util from 'util';
import { LoadFacetDeployments } from '../scripts/facets';
import { getDeployedFuncSelectors } from './FacetSelectors';

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  if (require.main === module) {
    debug.enable('GNUS.*:log');
    await LoadFacetDeployments();
    const networkName = network.name;
    log.enabled = true;
    if (networkName in deployments) {
      const networkDeployInfo: INetworkDeployInfo = deployments[networkName];
      const deployedFacetSelectorInfo = await getDeployedFuncSelectors(networkDeployInfo);
      log(`${networkName} ${util.inspect(deployedFacetSelectorInfo, { depth: null })}`);
      writeDeployedInfo(deployments);
    }
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
