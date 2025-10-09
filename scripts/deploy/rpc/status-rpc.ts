#!/usr/bin/env npx ts-node

/**
 * Status script for RPC-based Diamond deployments
 * Shows deployment status and configuration information
 */

import chalk from 'chalk';
import { ethers } from 'ethers';
import { Diamond } from 'diamonds';
import { RPCDiamondDeployer } from '../../setup/RPCDiamondDeployer';
import {
	StatusOptions,
	setupProgram,
	addStatusOptions,
	createRPCConfig,
	showPreOperationInfo,
	showOperationSummary,
	createMainCommand,
	createLegacyCommand,
	createQuickCommand,
} from './common';

/**
 * Interface for RPC deployment configuration
 */
interface DeploymentConfig {
	diamondName?: string;
	networkName?: string;
	rpcUrl?: string;
	gasLimitMultiplier?: number;
	maxRetries?: number;
	retryDelayMs?: number;
	configFilePath?: string;
	deploymentsPath?: string;
	protocolVersion?: number;
	facets?: Record<string, unknown>;
}

/**
 * Interface for deployed diamond data
 */
interface DeployedDiamondData {
	DiamondAddress?: string;
	DeployedFacets?: Record<string, FacetData>;
	protocolVersion?: number;
}

/**
 * Interface for facet data
 */
interface FacetData {
	address?: string;
	tx_hash?: string;
	version?: number;
	funcSelectors?: string[];
	verified?: boolean;
}

/**
 * Shows deployment configuration details
 */
async function showConfigDetails(config: DeploymentConfig): Promise<void> {
	console.log(chalk.blue('\n📋 Configuration Details'));
	console.log(chalk.blue('========================'));

	console.log(`💎 Diamond Name: ${chalk.white(config.diamondName)}`);
	console.log(`🌐 Network: ${chalk.white(config.networkName)}`);
	console.log(`🔗 RPC URL: ${chalk.white(config.rpcUrl)}`);
	console.log(`⛽ Gas Multiplier: ${chalk.white(config.gasLimitMultiplier || '1.2')}`);
	console.log(`🔄 Max Retries: ${chalk.white(config.maxRetries || '3')}`);
	console.log(`⏱️  Retry Delay: ${chalk.white(config.retryDelayMs || '2000')}ms`);

	if (config.configFilePath) {
		console.log(`📄 Config File: ${chalk.white(config.configFilePath)}`);
	}

	if (config.deploymentsPath) {
		console.log(`📁 Deployments Path: ${chalk.white(config.deploymentsPath)}`);
	}
}

/**
 * Shows detailed facet information
 */
async function showFacetDetails(diamond: Diamond): Promise<void> {
	console.log(chalk.blue('\n🔧 Deployed Facets'));
	console.log(chalk.blue('=================='));

	const deployedData = diamond.getDeployedDiamondData();
	const facets = deployedData.DeployedFacets || {};
	const facetCount = Object.keys(facets).length;

	if (facetCount === 0) {
		console.log(chalk.yellow('⚠️  No facets found in deployment data'));
		return;
	}

	console.log(`📦 Total Facets: ${chalk.white(facetCount)}\n`);

	let facetIndex = 1;
	for (const [facetName, facetData] of Object.entries(facets) as [string, FacetData][]) {
		console.log(`${facetIndex}. ${chalk.green(facetName)}`);
		console.log(`   📍 Address: ${chalk.white(facetData.address)}`);
		console.log(`   🔗 TX Hash: ${chalk.white(facetData.tx_hash || 'N/A')}`);
		console.log(`   📋 Version: ${chalk.white(facetData.version || 'N/A')}`);

		if (facetData.funcSelectors && facetData.funcSelectors.length > 0) {
			console.log(`   🎯 Selectors: ${chalk.white(facetData.funcSelectors.length)}`);
		}

		console.log(''); // Empty line
		facetIndex++;
	}
}

/**
 * Shows function selector details
 */
async function showSelectorDetails(diamond: Diamond): Promise<void> {
	console.log(chalk.blue('\n🎯 Function Selectors'));
	console.log(chalk.blue('====================='));

	const deployedData = diamond.getDeployedDiamondData();
	const facets = deployedData.DeployedFacets || {};
	let totalSelectors = 0;

	for (const [facetName, facetData] of Object.entries(facets) as [string, FacetData][]) {
		const selectors = facetData.funcSelectors || [];
		totalSelectors += selectors.length;

		if (selectors.length > 0) {
			console.log(`\n${chalk.green(facetName)} (${selectors.length} selectors):`);
			selectors.forEach((selector: string, index: number) => {
				console.log(`   ${index + 1}. ${chalk.white(selector)}`);
			});
		}
	}

	console.log(chalk.blue(`\n📊 Total Selectors: ${totalSelectors}`));
}

/**
 * Performs on-chain validation of deployment status
 */
async function performOnChainValidation(
	diamond: Diamond,
	provider: ethers.JsonRpcProvider,
): Promise<void> {
	console.log(chalk.blue('\n🔗 On-Chain Validation'));
	console.log(chalk.blue('======================'));

	const deployedData = diamond.getDeployedDiamondData();
	const diamondAddress = deployedData.DiamondAddress;

	if (!diamondAddress) {
		console.log(chalk.red('❌ No diamond address found in deployment data'));
		return;
	}

	try {
		const network = await provider.getNetwork();
		const balance = await provider.getBalance(diamondAddress);
		const code = await provider.getCode(diamondAddress);

		console.log(`💎 Diamond Address: ${chalk.white(diamondAddress)}`);
		console.log(`🌐 Network: ${chalk.white(network.name)} (${network.chainId})`);
		console.log(`💰 Balance: ${chalk.white(ethers.formatEther(balance))} ETH`);
		console.log(
			`📝 Contract Code: ${chalk.white(code.length > 2 ? 'Deployed' : 'Not found')}`,
		);

		if (code.length > 2) {
			// Try to get protocol version
			try {
				const geniusABI = ['function protocolVersion() external view returns (uint256)'];
				const geniusDiamond = new ethers.Contract(diamondAddress, geniusABI, provider);
				const protocolVersion = await geniusDiamond.protocolVersion();
				console.log(`📋 Protocol Version: ${chalk.white(protocolVersion)}`);
			} catch (error) {
				console.log(chalk.yellow('⚠️  Protocol version not available'));
			}

			// Try to get facet count
			try {
				const diamondLoupeABI = [
					'function facetAddresses() external view returns (address[])',
				];
				const diamondLoupe = new ethers.Contract(diamondAddress, diamondLoupeABI, provider);
				const facetAddresses = await diamondLoupe.facetAddresses();
				console.log(`🔧 On-Chain Facets: ${chalk.white(facetAddresses.length)}`);
			} catch (error) {
				console.log(chalk.yellow('⚠️  Could not retrieve on-chain facet count'));
			}
		}
	} catch (error) {
		console.error(chalk.red(`❌ On-chain validation failed: ${(error as Error).message}`));
	}
}

/**
 * Main status function
 */
async function checkStatus(options: StatusOptions): Promise<void> {
	const config = createRPCConfig(options);
	const startTime = Date.now();

	await showPreOperationInfo(config, 'Diamond Status Check', {
		'📋 Show Config': options.showConfig ? 'Yes' : 'No',
		'🔧 Show Facets': options.showFacets ? 'Yes' : 'No',
		'🎯 Show Selectors': options.showSelectors ? 'Yes' : 'No',
		'🔗 On-chain Validation': options.onChainValidation ? 'Yes' : 'No',
		'💎 Diamond Address': options.diamondAddress || 'From deployment data',
	});

	const deployer = await RPCDiamondDeployer.getInstance(config);
	const diamond = await deployer.getDiamond();

	console.log(chalk.blue(`📊 Checking status of diamond "${config.diamondName}"...`));

	// Show deployment status
	const deploymentStatus = deployer.getDeploymentStatus();
	const deployedData = diamond.getDeployedDiamondData();
	const diamondAddress = deployedData.DiamondAddress;

	console.log(chalk.blue('\n📈 Deployment Status'));
	console.log(chalk.blue('===================='));
	console.log(`💎 Diamond Address: ${chalk.white(diamondAddress || 'Not deployed')}`);
	console.log(`📈 Status: ${chalk.white(deploymentStatus)}`);

	// Show optional details
	if (options.showConfig) {
		await showConfigDetails(config);
	}

	if (options.showFacets) {
		await showFacetDetails(diamond);
	}

	if (options.showSelectors) {
		await showSelectorDetails(diamond);
	}

	if (options.onChainValidation) {
		const provider = new ethers.JsonRpcProvider(config.rpcUrl);
		await performOnChainValidation(diamond, provider);
	}

	const duration = (Date.now() - startTime) / 1000;
	const facetCount = Object.keys(deployedData.DeployedFacets || {}).length;

	showOperationSummary('Diamond Status Check', duration, {
		'💎 Diamond Address': diamondAddress || 'Not deployed',
		'📈 Status': deploymentStatus,
		'📦 Total Facets': facetCount,
		'🎯 Network': config.networkName,
	});
}

// Set up CLI program
const program = setupProgram(
	'status-rpc',
	'Check diamond deployment status and configuration',
);

// Main command: status <diamond-name> <network-name>
createMainCommand(
	program,
	'status',
	'Check status of a diamond contract with specified name and network',
	'<diamond-name> <network-name>',
	checkStatus,
	addStatusOptions,
);

// Legacy command: status-legacy
createLegacyCommand(
	program,
	'status',
	'Check status of a diamond contract',
	checkStatus,
	addStatusOptions,
);

// Quick command: quick
createQuickCommand(
	program,
	'quick',
	'Quick status check using environment variables',
	async (config, options: StatusOptions) => {
		const startTime = Date.now();

		await showPreOperationInfo(config, 'Quick Diamond Status Check');

		const deployer = await RPCDiamondDeployer.getInstance(config);
		const diamond = await deployer.getDiamond();
		const provider = new ethers.JsonRpcProvider(config.rpcUrl);

		// Show all details in quick mode
		await showConfigDetails(config);
		await showFacetDetails(diamond);
		await performOnChainValidation(diamond, provider);

		const duration = (Date.now() - startTime) / 1000;
		const deployedData = diamond.getDeployedDiamondData();

		showOperationSummary('Quick Diamond Status Check', duration, {
			'💎 Diamond Address': deployedData.DiamondAddress || 'Not deployed',
			'📈 Status': deployer.getDeploymentStatus(),
			'📦 Total Facets': Object.keys(deployedData.DeployedFacets || {}).length,
		});
	},
	addStatusOptions,
);

// Parse and execute
program.parse(process.argv);
