import { GeniusDiamond } from '../../../../diamond-typechain-types';
import { debuglog, CallbackArgs } from 'diamonds';
import util from 'util';
import { loadDiamondContract } from '../../../../scripts/utils/loadDiamondArtifact';

/**
 *
 * @param CallbackArgs
 */
export async function registerProtocolVersionChainId(callbackArgs: CallbackArgs) {
	console.log('Starting ERC1155ProxyOperator callback registerProtocolVersionChainId');

	const { diamond } = callbackArgs;

	const chainID = diamond.chainId;
	const diamondName = diamond.diamondName;
	const networkName = diamond.networkName;
	const deployInfo = diamond.getDeployedDiamondData();
	const deployer = diamond.signer!;

	debuglog(
		'UnitTest:log',
		`In GNUSControl callback function for networkName: ${networkName}  chainID: ${chainID}`,
	);

	const deployedDiamondData = diamond.getDeployedDiamondData();

	// Try to get the diamond artifact - if it doesn't exist, use ethers.getContractAt
	let geniusDiamond: GeniusDiamond;
	// Load the Diamond contract using the utility function
	geniusDiamond = await loadDiamondContract(diamond, deployedDiamondData.DiamondAddress!);
	const deployerDiamondContract = geniusDiamond.connect(deployer);

	try {
		await deployerDiamondContract.setChainID(chainID);
		const protocolVersion = deployInfo.protocolVersion || 0.0;
		await deployerDiamondContract.setProtocolVersion(Math.round(protocolVersion * 100));

		const info = await geniusDiamond.protocolInfo();
		debuglog(`protocol info: \n${util.inspect(info)}`);
	} catch (error) {
		console.warn(`Warning: Could not set protocol info for ${diamondName}:`, error);
	}
}
