#!/usr/bin/env npx ts-node

/**
 * Upgrade script for RPC-based Diamond upgrades
 * Upgrades GNUS.AI Diamond contracts using RPCDiamondDeployer
 */

import chalk from 'chalk';
import { RPCDiamondDeployer } from '../../setup/RPCDiamondDeployer';
import {
	UpgradeOptions,
	setupProgram,
	addUpgradeOptions,
	createRPCConfig,
	showPreOperationInfo,
	showOperationSummary,
	createMainCommand,
	createLegacyCommand,
	createQuickCommand,
} from './common';

/**
 * Analyzes what will be upgraded
 */
async function analyzeUpgrade(diamond: any): Promise<void> {
	console.log(chalk.blue('\n📊 Analyzing upgrade requirements...'));

	try {
		const deployedData = diamond.getDeployedDiamondData();
		const currentVersion = deployedData.protocolVersion || 0;
		const config = diamond.getDeployConfig();
		const targetVersion = config.protocolVersion || 0;

		console.log(
			`💎 Diamond Address: ${chalk.white(deployedData.DiamondAddress || 'Not deployed')}`,
		);
		console.log(`📋 Current Protocol Version: ${chalk.white(currentVersion)}`);
		console.log(`🎯 Target Protocol Version: ${chalk.white(targetVersion)}`);

		if (currentVersion === targetVersion) {
			console.log(chalk.yellow('⚠️  No upgrade needed - versions are identical'));
			return;
		}

		const facetsConfig = config.facets || {};
		const deployedFacets = deployedData.DeployedFacets || {};

		let newFacets = 0;
		let updatedFacets = 0;
		let removedFacets = 0;

		// Count new and updated facets
		Object.keys(facetsConfig).forEach((facetName) => {
			if (!deployedFacets[facetName]) {
				newFacets++;
			} else {
				const deployedVersion = deployedFacets[facetName].version || 0;
				const availableVersions = Object.keys(facetsConfig[facetName].versions || {}).map(
					Number,
				);
				const targetFacetVersion = Math.max(...availableVersions, 0);

				if (targetFacetVersion > deployedVersion) {
					updatedFacets++;
				}
			}
		});

		// Count removed facets
		Object.keys(deployedFacets).forEach((facetName) => {
			if (!facetsConfig[facetName] && facetName !== 'DiamondCutFacet') {
				removedFacets++;
			}
		});

		console.log(chalk.blue('\n🔄 Upgrade Plan:'));
		console.log(`📦 New Facets: ${chalk.white(newFacets)}`);
		console.log(`🔄 Updated Facets: ${chalk.white(updatedFacets)}`);
		console.log(`🗑️  Removed Facets: ${chalk.white(removedFacets)}`);
	} catch (error) {
		console.log(
			chalk.yellow(`⚠️  Unable to perform detailed analysis: ${(error as Error).message}`),
		);
	}
}

/**
 * Main upgrade function
 */
async function upgradeDiamond(options: UpgradeOptions): Promise<void> {
	const config = createRPCConfig(options);
	const startTime = Date.now();

	await showPreOperationInfo(config, 'Diamond Upgrade', {
		'🧪 Dry Run': options.dryRun ? 'Yes' : 'No',
		'🔧 Force Upgrade': options.force ? 'Yes' : 'No',
		'🎯 Target Version': options.targetVersion || 'Latest',
		'📊 Skip Analysis': options.skipAnalysis ? 'Yes' : 'No',
	});

	const deployer = await RPCDiamondDeployer.getInstance(config);

	// Get diamond instance for analysis
	const diamond = await deployer.getDiamond();

	if (!options.skipAnalysis) {
		await analyzeUpgrade(diamond);
	}

	if (options.dryRun) {
		console.log(chalk.blue('\n🧪 Dry run completed - no actual changes made'));
		return;
	}

	console.log(chalk.blue(`\n🚀 Starting upgrade of diamond "${config.diamondName}"...`));

	// For upgrade, we just deploy again which will perform the upgrade
	const upgradedDiamond = await deployer.deployDiamond();

	const duration = (Date.now() - startTime) / 1000;
	const deployedData = upgradedDiamond.getDeployedDiamondData();

	showOperationSummary('Diamond Upgrade', duration, {
		'💎 Diamond Address': deployedData.DiamondAddress,
		'📋 Protocol Version': deployedData.protocolVersion || 'Unknown',
		'🎯 Network': config.networkName,
		'⛽ Chain ID': config.chainId,
	});
}

// Set up CLI program
const program = setupProgram(
	'upgrade-rpc',
	'Upgrade diamonds using direct RPC communication',
);

// Main command: upgrade <diamond-name> <network-name>
createMainCommand(
	program,
	'upgrade',
	'Upgrade a diamond contract with specified name and network',
	'<diamond-name> <network-name>',
	upgradeDiamond,
	addUpgradeOptions,
);

// Legacy command: upgrade-legacy
createLegacyCommand(
	program,
	'upgrade',
	'Upgrade a diamond contract',
	upgradeDiamond,
	addUpgradeOptions,
);

// Quick command: quick
createQuickCommand(
	program,
	'quick',
	'Quick upgrade using environment variables',
	async (config, options: UpgradeOptions) => {
		const startTime = Date.now();

		await showPreOperationInfo(config, 'Quick Diamond Upgrade');

		const deployer = await RPCDiamondDeployer.getInstance(config);
		const diamond = await deployer.getDiamond();

		if (!options.skipAnalysis) {
			await analyzeUpgrade(diamond);
		}

		if (!options.dryRun) {
			await deployer.deployDiamond();
		}

		const duration = (Date.now() - startTime) / 1000;
		const deployedData = diamond.getDeployedDiamondData();

		showOperationSummary('Quick Diamond Upgrade', duration, {
			'💎 Diamond Address': deployedData.DiamondAddress,
			'📋 Protocol Version': deployedData.protocolVersion || 'Unknown',
		});
	},
	addUpgradeOptions,
);

// Parse and execute
program.parse(process.argv);
