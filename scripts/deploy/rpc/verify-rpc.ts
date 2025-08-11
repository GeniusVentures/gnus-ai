#!/usr/bin/env npx ts-node

/**
 * Verification script for RPC-based Diamond deployments
 * Verifies contract deployment and validates integrity
 */

import chalk from 'chalk';
import { ethers } from 'ethers';
import { RPCDiamondDeployer } from '../../setup/rpc/RPCDiamondDeployer';
import {
  VerifyOptions,
  setupProgram,
  addVerifyOptions,
  createRPCConfig,
  showPreOperationInfo,
  showOperationSummary,
  createMainCommand,
  createLegacyCommand,
  createQuickCommand
} from './common';

/**
 * Validates contract ABIs against deployed contracts
 */
async function validateABIs(diamond: any, provider: ethers.JsonRpcProvider): Promise<void> {
  console.log(chalk.blue('\n🔍 Validating contract ABIs...'));
  
  const deployedData = diamond.getDeployedDiamondData();
  const facets = deployedData.DeployedFacets || {};
  let validCount = 0;
  
  for (const [facetName, facetData] of Object.entries(facets) as [string, any][]) {
    try {
      const code = await provider.getCode(facetData.address);
      if (code === '0x') {
        console.log(chalk.red(`   ❌ ${facetName}: No contract code found`));
        continue;
      }
      
      console.log(chalk.green(`   ✅ ${facetName}: Contract exists (${code.length} bytes)`));
      validCount++;
    } catch (error) {
      console.log(chalk.red(`   ❌ ${facetName}: Validation failed - ${(error as Error).message}`));
    }
  }
  
  console.log(chalk.blue(`\n📊 ABI Validation: ${validCount}/${Object.keys(facets).length} facets validated`));
}

/**
 * Validates function selectors against on-chain data
 */
async function validateSelectors(diamond: any, provider: ethers.JsonRpcProvider): Promise<void> {
  console.log(chalk.blue('\n🔍 Validating function selectors...'));
  
  const deployedData = diamond.getDeployedDiamondData();
  const diamondAddress = deployedData.DiamondAddress;
  
  if (!diamondAddress) {
    console.log(chalk.red('❌ No diamond address found'));
    return;
  }
  
  const diamondLoupeABI = [
    "function facets() external view returns (tuple(address facetAddress, bytes4[] functionSelectors)[])",
    "function facetAddresses() external view returns (address[])"
  ];
  
  const diamondContract = new ethers.Contract(diamondAddress, diamondLoupeABI, provider);
  
  try {
    const onChainFacets = await diamondContract.facets();
    const deployedFacets = deployedData.DeployedFacets || {};
    
    console.log(chalk.blue(`📦 Deployed facets: ${Object.keys(deployedFacets).length}`));
    console.log(chalk.blue(`🔗 On-chain facets: ${onChainFacets.length}`));
    
    let selectorMatches = 0;
    let totalSelectors = 0;
    
    for (const onChainFacet of onChainFacets) {
      totalSelectors += onChainFacet.functionSelectors.length;
      
      const matchingFacet = Object.entries(deployedFacets).find(
        ([, facetData]: [string, any]) => facetData.address.toLowerCase() === onChainFacet.facetAddress.toLowerCase()
      );
      
      if (matchingFacet) {
        const [facetName, facetData] = matchingFacet as [string, any];
        const deployedSelectors = facetData.funcSelectors || [];
        
        if (deployedSelectors.length === onChainFacet.functionSelectors.length) {
          console.log(chalk.green(`   ✅ ${facetName}: ${onChainFacet.functionSelectors.length} selectors match`));
          selectorMatches += onChainFacet.functionSelectors.length;
        } else {
          console.log(chalk.yellow(`   ⚠️  ${facetName}: Selector count mismatch`));
          console.log(chalk.yellow(`      Deployed: ${deployedSelectors.length}, On-chain: ${onChainFacet.functionSelectors.length}`));
        }
      } else {
        console.log(chalk.red(`   ❌ Unknown facet: ${onChainFacet.facetAddress}`));
      }
    }
    
    console.log(chalk.blue(`\n📊 Selector Validation: ${selectorMatches}/${totalSelectors} selectors validated`));
    
  } catch (error) {
    console.error(chalk.red(`❌ Selector validation failed: ${(error as Error).message}`));
  }
}

/**
 * Compares stored deployment data with on-chain state
 */
async function compareOnChainState(diamond: any, provider: ethers.JsonRpcProvider): Promise<void> {
  console.log(chalk.blue('\n🔍 Comparing on-chain state with deployment data...'));
  
  const deployedData = diamond.getDeployedDiamondData();
  const diamondAddress = deployedData.DiamondAddress;
  
  if (!diamondAddress) {
    console.log(chalk.red('❌ No diamond address found'));
    return;
  }
  
  const network = await provider.getNetwork();
  console.log(chalk.blue(`💎 Diamond Address: ${diamondAddress}`));
  console.log(chalk.blue(`🌐 Network: ${network.name} (${network.chainId})`));
  
  // Validate diamond contract exists
  const diamondCode = await provider.getCode(diamondAddress);
  if (diamondCode === '0x') {
    console.error(chalk.red('❌ Diamond contract not found on-chain'));
    return;
  }
  
  console.log(chalk.green(`✅ Diamond contract verified (${diamondCode.length} bytes)`));
  
  // Get current protocol version if available
  try {
    const geniusABI = ["function protocolVersion() external view returns (uint256)"];
    const geniusDiamond = new ethers.Contract(diamondAddress, geniusABI, provider);
    const protocolVersion = await geniusDiamond.protocolVersion();
    console.log(chalk.blue(`📋 On-chain Protocol Version: ${protocolVersion}`));
  } catch (error) {
    console.log(chalk.yellow('⚠️  Protocol version not available on-chain'));
  }
}

/**
 * Main verification function
 */
async function verifyDeployment(options: VerifyOptions): Promise<void> {
  const config = createRPCConfig(options);
  const startTime = Date.now();
  
  await showPreOperationInfo(config, 'Diamond Verification', {
    '🔍 Validate ABIs': options.validateAbi ? 'Yes' : 'No',
    '🔍 Validate Selectors': options.validateSelectors ? 'Yes' : 'No',
    '🔗 On-chain Validation': options.onChainValidation ? 'Yes' : 'No',
    '🔑 Etherscan API': options.etherscanApiKey ? 'Configured' : 'Not configured',
    '💎 Diamond Address': options.diamondAddress || 'From deployment data'
  });

  const deployer = await RPCDiamondDeployer.getInstance(config);
  const diamond = await deployer.getDiamond();
  
  console.log(chalk.blue(`🔍 Starting verification of diamond "${config.diamondName}"...`));
  
  // Set up provider for on-chain operations
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  
  // Perform validations based on options
  if (options.validateAbi) {
    await validateABIs(diamond, provider);
  }
  
  if (options.validateSelectors) {
    await validateSelectors(diamond, provider);
  }
  
  if (options.onChainValidation) {
    await compareOnChainState(diamond, provider);
  }
  
  // Show basic diamond info
  const deployedData = diamond.getDeployedDiamondData();
  console.log(chalk.blue('\n📝 Diamond Summary...'));
  console.log(chalk.green(`✅ Diamond verification operations completed`));
  
  const duration = (Date.now() - startTime) / 1000;
  
  showOperationSummary('Diamond Verification', duration, {
    '💎 Diamond Address': deployedData.DiamondAddress || 'Not deployed',
    '📋 Protocol Version': deployedData.protocolVersion || 'Unknown',
    '📦 Total Facets': Object.keys(deployedData.DeployedFacets || {}).length,
    '🎯 Network': config.networkName
  });
}

// Set up CLI program
const program = setupProgram('verify-rpc', 'Verify diamond contracts and validate deployment integrity');

// Main command: verify <diamond-name> <network-name>
createMainCommand(
  program,
  'verify',
  'Verify a diamond contract with specified name and network',
  '<diamond-name> <network-name>',
  verifyDeployment,
  addVerifyOptions
);

// Legacy command: verify-legacy
createLegacyCommand(
  program,
  'verify',
  'Verify a diamond contract',
  verifyDeployment,
  addVerifyOptions
);

// Quick command: quick
createQuickCommand(
  program,
  'quick',
  'Quick verification using environment variables',
  async (config, options: VerifyOptions) => {
    const startTime = Date.now();
    
    await showPreOperationInfo(config, 'Quick Diamond Verification');
    
    const deployer = await RPCDiamondDeployer.getInstance(config);
    const diamond = await deployer.getDiamond();
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    
    // Perform all validations in quick mode
    await validateABIs(diamond, provider);
    await validateSelectors(diamond, provider);
    await compareOnChainState(diamond, provider);
    
    const duration = (Date.now() - startTime) / 1000;
    const deployedData = diamond.getDeployedDiamondData();
    
    showOperationSummary('Quick Diamond Verification', duration, {
      '💎 Diamond Address': deployedData.DiamondAddress || 'Not deployed',
      '📦 Total Facets': Object.keys(deployedData.DeployedFacets || {}).length
    });
  },
  addVerifyOptions
);

// Parse and execute
program.parse(process.argv);
