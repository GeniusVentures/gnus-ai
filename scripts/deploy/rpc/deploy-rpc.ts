#!/usr/bin/env npx ts-node

/**
 * Main deployment script for RPC-based Diamond deployment
 * Deploys GNUS.AI Diamond contracts using RPCDiamondDeployer
 */

import { RPCDiamondDeployer } from '../../setup/RPCDiamondDeployer';
import {
	DeploymentOptions,
	setupProgram,
	addDeploymentOptions,
	createRPCConfig,
	showPreOperationInfo,
	showOperationSummary,
	createMainCommand,
	createLegacyCommand,
	createQuickCommand,
} from './common';

/**
 * Main deployment function
 */
async function deployDiamond(options: DeploymentOptions): Promise<void> {
	const config = createRPCConfig(options);
	const startTime = Date.now();

	await showPreOperationInfo(config, 'Diamond Deployment', {
		'🔧 Force Deploy': options.force ? 'Yes' : 'No',
		'✅ Skip Verification': options.skipVerification ? 'Yes' : 'No',
	});

	const deployer = await RPCDiamondDeployer.getInstance(config);

	console.log(`🏁 Starting deployment of diamond "${config.diamondName}"...`);

	const diamond = await deployer.deployDiamond();

	const duration = (Date.now() - startTime) / 1000;
	const deployedData = diamond.getDeployedDiamondData();
	const deploymentStatus = deployer.getDeploymentStatus();

	showOperationSummary('Diamond Deployment', duration, {
		'💎 Diamond Address': deployedData.DiamondAddress,
		'📈 Status': deploymentStatus,
		'🎯 Network': config.networkName,
		'⛽ Chain ID': config.chainId,
	});
}

// Set up CLI program
const program = setupProgram(
	'deploy-rpc',
	'Deploy diamonds using direct RPC communication',
);

// Main command: deploy <diamond-name> <network-name>
createMainCommand(
	program,
	'deploy',
	'Deploy a diamond contract with specified name and network',
	'<diamond-name> <network-name>',
	deployDiamond,
	addDeploymentOptions,
);

// Legacy command: deploy-legacy
createLegacyCommand(
	program,
	'deploy',
	'Deploy a diamond contract',
	deployDiamond,
	addDeploymentOptions,
);

// Quick command: quick
createQuickCommand(
	program,
	'quick',
	'Quick deployment using environment variables',
	async (config, options: DeploymentOptions) => {
		const startTime = Date.now();

		await showPreOperationInfo(config, 'Quick Diamond Deployment');

		const deployer = await RPCDiamondDeployer.getInstance(config);
		const diamond = await deployer.deployDiamond();

		const duration = (Date.now() - startTime) / 1000;
		const deployedData = diamond.getDeployedDiamondData();

		showOperationSummary('Quick Diamond Deployment', duration, {
			'💎 Diamond Address': deployedData.DiamondAddress,
			'📈 Status': deployer.getDeploymentStatus(),
		});
	},
	addDeploymentOptions,
);

// Parse and execute
program.parse(process.argv);
