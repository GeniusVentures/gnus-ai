#!/usr/bin/env npx ts-node

/**
 * Main CLI for Diamond Verification System
 * 
 * Simple command-line interface for running diamond verification
 * against the GeniusDiamond deployment on Sepolia network.
 */

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import verification system components
import { DiamondVerificationSystem } from '../core/DiamondVerificationSystem';
import { VerificationConfigManager } from '../config/VerificationConfig';
import { DiamondConfigLoader, ProviderFactory } from '../core/VerificationContext';
import { ReportGenerator } from '../reports/ReportGenerator';

// Import verification modules
import { FunctionSelectorVerificationModule } from '../modules/FunctionSelectorModule';
import { DiamondStructureVerificationModule } from '../modules/DiamondStructureModule';

/**
 * CLI options
 */
interface CliOptions {
  diamondName?: string;
  networkName?: string;
  modules?: string;
  outputFormat?: string;
  verbose?: boolean;
  help?: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg.startsWith('--modules=')) {
      options.modules = arg.split('=')[1];
    } else if (arg === '--modules' && i + 1 < args.length) {
      options.modules = args[++i];
    } else if (arg.startsWith('--output-format=')) {
      options.outputFormat = arg.split('=')[1];
    } else if (arg === '--output-format' && i + 1 < args.length) {
      options.outputFormat = args[++i];
    } else if (!arg.startsWith('--')) {
      // Skip commands like 'quick' and treat the next args as diamond/network
      if (arg === 'quick' || arg === 'run') {
        continue;
      }
      // Positional arguments
      if (!options.diamondName) {
        options.diamondName = arg;
      } else if (!options.networkName) {
        options.networkName = arg;
      }
    }
  }
  
  return options;
}

/**
 * Show help message
 */
function showHelp(): void {
  console.log(`
Diamond Verification System v1.0.0
Comprehensive verification for ERC-2535 Diamond contracts

Usage:
  npx ts-node scripts/verification/cli/verify-diamond.ts <diamond-name> <network> [options]
  npx ts-node scripts/verification/cli/verify-diamond.ts quick <diamond-name> <network> [options]

Examples:
  # Verify GeniusDiamond on sepolia network
  npx ts-node scripts/verification/cli/verify-diamond.ts GeniusDiamond sepolia

  # Verify with specific modules
  npx ts-node scripts/verification/cli/verify-diamond.ts GeniusDiamond sepolia --modules function-selectors,diamond-structure

  # Quick verification
  npx ts-node scripts/verification/cli/verify-diamond.ts quick GeniusDiamond sepolia --modules function-selectors,diamond-structure

Arguments:
  <diamond-name>    Name of the diamond to verify (e.g., GeniusDiamond)
  <network>         Network name (e.g., sepolia, polygon, mainnet)

Options:
  --modules <list>         Comma-separated list of modules (function-selectors,diamond-structure)
  --output-format <format> Report format: console, json, markdown (default: console)
  --verbose                Enable verbose logging
  --help, -h               Show this help message

Available Modules:
  - function-selectors      Verify function selectors match diamond configuration
  - diamond-structure       Verify diamond structure and ERC-2535 compliance
  `);
}

/**
 * Main verification function
 */
async function runVerification(
  diamondName: string,
  networkName: string,
  options: CliOptions
): Promise<void> {
  try {
    if (options.verbose) {
      console.log('🔍 Starting diamond verification...');
      console.log(`📋 Diamond: ${diamondName}`);
      console.log(`🌐 Network: ${networkName}`);
      if (options.modules) {
        console.log(`🧪 Modules: ${options.modules}`);
      }
    }

    // Create verification system and register modules
    const verificationSystem = new DiamondVerificationSystem();
    verificationSystem.registerModule(new FunctionSelectorVerificationModule());
    verificationSystem.registerModule(new DiamondStructureVerificationModule());

    // Create configuration
    const config = await VerificationConfigManager.createFromOptions({
      diamondName,
      networkName,
      modules: options.modules?.split(',').map(m => m.trim()),
      outputFormat: options.outputFormat as any,
      verbose: options.verbose
    });

    // Load diamond information
    const diamond = await DiamondConfigLoader.loadDiamondInfo(
      diamondName,
      networkName,
      undefined, // address - will be loaded from deployments
      config.diamond.configPath
    );

    // Create provider
    const provider = ProviderFactory.createProvider(diamond.network);

    // Test provider connectivity
    const isConnected = await ProviderFactory.testProvider(provider);
    if (!isConnected) {
      throw new Error(`Cannot connect to network '${networkName}'. Please check your RPC URL.`);
    }

    if (options.verbose) {
      console.log('✅ Connected to blockchain network');
    }

    // Determine modules to run
    let moduleIds: string[] | undefined;
    if (options.modules) {
      moduleIds = options.modules.split(',').map(m => m.trim());
      if (options.verbose) {
        console.log(`🧪 Running specific modules: ${moduleIds.join(', ')}`);
      }
    } else if (options.verbose) {
      console.log('🧪 Running all configured modules');
    }

    // Run verification
    const report = await verificationSystem.runVerification(diamond, provider, config, moduleIds);

    // Generate reports
    const reportGenerator = new ReportGenerator();

    // Always show console output (unless output format is specified and different)
    if (!options.outputFormat || options.outputFormat === 'console') {
      const consoleReport = reportGenerator.generateReport(report, 'console' as any);
      console.log('\n' + consoleReport);
    }

    // Generate additional output if requested
    if (options.outputFormat && options.outputFormat !== 'console') {
      const outputReport = reportGenerator.generateReport(report, options.outputFormat as any);
      console.log('\n' + outputReport);
    }

    // Exit with appropriate code
    const hasErrors = report.summary.failed > 0 || report.summary.critical > 0;
    if (hasErrors) {
      const totalIssues = report.summary.failed + report.summary.critical;
      console.log(`\n❌ Verification completed with ${totalIssues} issues found`);
      process.exit(1);
    } else {
      console.log('\n✅ Verification completed successfully - no issues found');
      process.exit(0);
    }
    
  } catch (error) {
    console.error(`❌ Verification failed: ${(error as Error).message}`);
    
    if (options.verbose && error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
    
    process.exit(1);
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  
  if (options.help || args.length === 0) {
    showHelp();
    return;
  }

  if (!options.diamondName) {
    console.error('❌ Error: Diamond name is required');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  if (!options.networkName) {
    console.error('❌ Error: Network name is required');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  await runVerification(options.diamondName, options.networkName, options);
}

// Run the main function
if (require.main === module) {
  main().catch((error) => {
    console.error(`❌ Unexpected error: ${error.message}`);
    process.exit(1);
  });
}
