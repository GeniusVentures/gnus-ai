/**
 * Diamond Verification System - Main Exports
 * 
 * This file provides the main exports for the Diamond Verification System,
 * making it easy to import and use the system components.
 */

// Types
export * from './core/types';

// Core system
export { DiamondVerificationSystem } from './core/DiamondVerificationSystem';
export { BaseVerificationModule } from './core/BaseVerificationModule';
export { 
  VerificationContextBuilder, 
  DiamondConfigLoader, 
  ProviderFactory 
} from './core/VerificationContext';

// Configuration
export { VerificationConfigManager, NetworkConfigLoader } from './config/VerificationConfig';

// Verification modules
export { FunctionSelectorVerificationModule } from './modules/FunctionSelectorModule';
export { DiamondStructureVerificationModule } from './modules/DiamondStructureModule';

// Report generation
export { ReportGenerator } from './reports/ReportGenerator';
export { ConsoleFormatter } from './reports/formatters/ConsoleFormatter';
export { JSONFormatter } from './reports/formatters/JSONFormatter';
export { MarkdownFormatter } from './reports/formatters/MarkdownFormatter';

// Local imports for factory functions
import { DiamondVerificationSystem } from './core/DiamondVerificationSystem';
import { FunctionSelectorVerificationModule } from './modules/FunctionSelectorModule';
import { DiamondStructureVerificationModule } from './modules/DiamondStructureModule';

/**
 * Factory function to create a pre-configured verification system
 */
export function createVerificationSystem(): DiamondVerificationSystem {
  const system = new DiamondVerificationSystem();
  
  // Register built-in modules
  system.registerModule(new FunctionSelectorVerificationModule());
  system.registerModule(new DiamondStructureVerificationModule());
  
  return system;
}

/**
 * Quick verification function for common use cases
 */
export async function quickVerify(
  diamondName: string,
  networkName: string,
  options?: {
    modules?: string[];
    rpcUrl?: string;
    configFile?: string;
    verbose?: boolean;
    dryRun?: boolean;
  }
) {
  const { VerificationConfigManager } = await import('./config/VerificationConfig');
  const { DiamondConfigLoader, ProviderFactory } = await import('./core/VerificationContext');
  
  // Create system
  const system = createVerificationSystem();
  
  // Create configuration
  const config = await VerificationConfigManager.createFromOptions({
    diamondName,
    networkName,
    rpcUrl: options?.rpcUrl,
    configFile: options?.configFile,
    modules: options?.modules,
    verbose: options?.verbose,
    dryRun: options?.dryRun
  });
  
  // Load diamond info
  const diamond = await DiamondConfigLoader.loadDiamondInfo(
    diamondName,
    networkName
  );
  
  // Create provider
  const provider = ProviderFactory.createProvider(diamond.network);
  
  // Run verification
  return await system.runVerification(diamond, provider, config, options?.modules);
}
