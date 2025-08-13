/**
 * Function Selector Verification Module
 * 
 * Validates function selectors in the diamond against expected configuration.
 * This is a high-priority verification module that ensures the diamond's
 * function selector registry matches the deployment configuration.
 */

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

import { BaseVerificationModule } from '../core/BaseVerificationModule';
import {
  VerificationContext,
  VerificationResult,
  VerificationStatus,
  SeverityLevel,
  ConfigRequirement,
  VerificationIssue,
  DiamondInfo,
  NetworkInfo
} from '../core/types';

/**
 * Structure representing a function selector with metadata
 */
interface FunctionSelector {
  selector: string;
  signature: string;
  facetAddress: string;
  facetName?: string;
}

/**
 * Selector registry comparison result
 */
interface SelectorComparison {
  matching: FunctionSelector[];
  missing: FunctionSelector[];
  extra: FunctionSelector[];
  mismatched: Array<{
    selector: string;
    expected: FunctionSelector;
    actual: FunctionSelector;
  }>;
}

/**
 * Configuration for the function selector module
 */
interface FunctionSelectorModuleConfig {
  ignoreMissingSelectors?: boolean;
  ignoreExtraSelectors?: boolean;
  allowAddressChanges?: boolean;
  customAbiPath?: string;
  skipValidation?: string[];  // Array of selectors to skip
  strictMode?: boolean;       // Strict validation mode
}

/**
 * Function Selector Verification Module
 * 
 * Validates that the diamond's function selectors match the expected configuration
 * from the diamond configuration file and deployment artifacts.
 */
export class FunctionSelectorVerificationModule extends BaseVerificationModule {
  public readonly id = 'function-selectors';
  public readonly name = 'Function Selector Verification';
  public readonly description = 'Validates function selector registry against diamond configuration and deployment artifacts';
  public readonly version = '1.0.0';
  public readonly category = 'structural';

  // Diamond Loupe ABI for querying selectors
  private readonly diamondLoupeABI = [
    'function facets() external view returns (tuple(address facetAddress, bytes4[] functionSelectors)[])',
    'function facetFunctionSelectors(address facet) external view returns (bytes4[])',
    'function facetAddresses() external view returns (address[])',
    'function facetAddress(bytes4 selector) external view returns (address)'
  ];

  /**
   * Get configuration requirements for this module
   */
  public getRequiredConfig(): ConfigRequirement[] {
    return [
      {
        key: 'ignoreMissingSelectors',
        type: 'boolean',
        required: false,
        description: 'Whether to ignore missing selectors in the registry',
        defaultValue: false
      },
      {
        key: 'ignoreExtraSelectors',
        type: 'boolean',
        required: false,
        description: 'Whether to ignore extra selectors not in configuration',
        defaultValue: false
      },
      {
        key: 'allowAddressChanges',
        type: 'boolean',
        required: false,
        description: 'Whether to allow facet address changes for same selector',
        defaultValue: false
      },
      {
        key: 'customAbiPath',
        type: 'string',
        required: false,
        description: 'Path to custom ABI file for additional validation'
      },
      {
        key: 'skipValidation',
        type: 'array',
        required: false,
        description: 'Array of function selectors to skip during validation'
      },
      {
        key: 'strictMode',
        type: 'boolean',
        required: false,
        description: 'Enable strict validation mode',
        defaultValue: false
      }
    ];
  }

  /**
   * Check if this module can verify the given diamond
   */
  public async canVerify(diamond: DiamondInfo, network: NetworkInfo): Promise<boolean> {
    // Check if diamond config file exists
    if (!fs.existsSync(diamond.configPath)) {
      return false;
    }

    // Verify we can load diamond configuration
    try {
      const config = await this.loadDiamondConfig(diamond.configPath);
      return config && typeof config === 'object' && 'facets' in config;
    } catch {
      return false;
    }
  }

  /**
   * Execute function selector verification
   */
  public async verify(context: VerificationContext): Promise<VerificationResult> {
    const startTime = Date.now();
    const issues: VerificationIssue[] = [];
    const moduleConfig = this.getModuleConfig<FunctionSelectorModuleConfig>(context);

    this.log(context, 'info', '🔍 Starting function selector verification...');

    try {
      // 1. Load expected selectors from diamond configuration
      this.log(context, 'info', '📋 Loading expected selectors from diamond configuration...');
      const expectedSelectors = await this.loadExpectedSelectors(context);
      
      if (expectedSelectors.length === 0) {
        this.log(context, 'warn', 'No expected selectors found in diamond configuration');
        issues.push(this.createIssue(
          'no-expected-selectors',
          'No Expected Selectors',
          'No function selectors found in diamond configuration',
          SeverityLevel.WARNING,
          'configuration'
        ));
      } else {
        this.log(context, 'info', `Found ${expectedSelectors.length} expected selectors`);
      }

      // 2. Query on-chain selector registry via Diamond Loupe
      this.log(context, 'info', '🌐 Querying on-chain selector registry...');
      const onChainSelectors = await this.queryOnChainSelectors(context);
      
      if (onChainSelectors.length === 0) {
        this.log(context, 'error', 'No on-chain selectors found - this indicates a serious issue');
        issues.push(this.createIssue(
          'no-onchain-selectors',
          'No On-Chain Selectors',
          'No function selectors found in on-chain diamond registry',
          SeverityLevel.CRITICAL,
          'structural',
          'Check diamond deployment and DiamondLoupe facet installation'
        ));
      } else {
        this.log(context, 'info', `Found ${onChainSelectors.length} on-chain selectors`);
      }

      // 3. Compare selectors
      this.log(context, 'info', '⚖️  Comparing expected vs on-chain selectors...');
      const comparison = this.compareSelectors(expectedSelectors, onChainSelectors, moduleConfig);

      // 4. Generate verification issues based on comparison
      const comparisonIssues = this.generateComparisonIssues(comparison, moduleConfig);
      issues.push(...comparisonIssues);

      // 5. Additional validations if enabled
      if (moduleConfig.strictMode) {
        this.log(context, 'info', '🔒 Running strict mode validations...');
        const strictIssues = await this.performStrictValidations(context, onChainSelectors);
        issues.push(...strictIssues);
      }

      // 6. Custom ABI validation if provided
      if (moduleConfig.customAbiPath) {
        this.log(context, 'info', '📄 Validating against custom ABI...');
        const abiIssues = await this.validateAgainstCustomABI(
          context, 
          onChainSelectors, 
          moduleConfig.customAbiPath
        );
        issues.push(...abiIssues);
      }

      const executionTime = Date.now() - startTime;
      this.log(context, 'info', `✅ Function selector verification completed in ${executionTime}ms`);

      // Determine overall status
      const criticalIssues = issues.filter(i => i.severity === SeverityLevel.CRITICAL);
      const errorIssues = issues.filter(i => i.severity === SeverityLevel.ERROR);
      const warningIssues = issues.filter(i => i.severity === SeverityLevel.WARNING);

      let status = VerificationStatus.PASS;
      if (criticalIssues.length > 0) {
        status = VerificationStatus.FAIL;
      } else if (errorIssues.length > 0) {
        status = VerificationStatus.FAIL;
      } else if (warningIssues.length > 0) {
        status = VerificationStatus.WARNING;
      }

      // Create detailed metadata
      const metadata = {
        expectedSelectorCount: expectedSelectors.length,
        onChainSelectorCount: onChainSelectors.length,
        matchingSelectors: comparison.matching.length,
        missingSelectors: comparison.missing.length,
        extraSelectors: comparison.extra.length,
        mismatchedSelectors: comparison.mismatched.length,
        comparison
      };

      return this.createResult(status, issues, executionTime, metadata);

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.log(context, 'error', `❌ Function selector verification failed: ${(error as Error).message}`);

      issues.push(this.createIssue(
        'verification-error',
        'Verification Error',
        `Function selector verification failed: ${(error as Error).message}`,
        SeverityLevel.CRITICAL,
        'system'
      ));

      return this.createResult(VerificationStatus.FAIL, issues, executionTime, { error: (error as Error).message });
    }
  }

  /**
   * Load expected selectors from diamond configuration
   */
  private async loadExpectedSelectors(context: VerificationContext): Promise<FunctionSelector[]> {
    const { diamond } = context;
    const selectors: FunctionSelector[] = [];

    // Load diamond configuration
    const diamondConfig = await this.loadDiamondConfig(diamond.configPath);
    
    if (!diamondConfig?.facets) {
      throw new Error('Invalid diamond configuration: facets not found');
    }

    // Load diamond ABI to get function signatures
    const diamondABI = await this.loadDiamondABI(diamond.name);

    // Process each facet in the configuration
    for (const [facetName, facetConfig] of Object.entries(diamondConfig.facets)) {
      try {
        // Load facet artifact to get ABI
        const facetABI = await this.loadFacetABI(facetName);
        
        if (facetABI && facetABI.length > 0) {
          // Generate selectors from ABI
          const facetSelectors = this.generateSelectorsFromABI(facetABI, facetName);
          selectors.push(...facetSelectors);
        }
      } catch (error) {
        this.log(context, 'warn', `Warning: Could not load ABI for facet '${facetName}': ${(error as Error).message}`);
      }
    }

    // If we have a diamond ABI, use it as additional source
    if (diamondABI && diamondABI.length > 0) {
      const diamondSelectors = this.generateSelectorsFromABI(diamondABI, 'Diamond');
      
      // Merge with existing selectors, avoiding duplicates
      const existingSelectors = new Set(selectors.map(s => s.selector));
      for (const selector of diamondSelectors) {
        if (!existingSelectors.has(selector.selector)) {
          selectors.push(selector);
        }
      }
    }

    return selectors;
  }

  /**
   * Query on-chain selector registry via Diamond Loupe
   */
  private async queryOnChainSelectors(context: VerificationContext): Promise<FunctionSelector[]> {
    const { diamond, provider } = context;
    
    // Create Diamond Loupe contract instance
    const diamondContract = new ethers.Contract(diamond.address, this.diamondLoupeABI, provider);
    
    try {
      // Query all facets and their selectors
      const facets = await diamondContract.facets();
      const selectors: FunctionSelector[] = [];
      
      for (const facet of facets) {
        const facetAddress = facet.facetAddress;
        const functionSelectors = facet.functionSelectors;
        
        // Try to identify facet name by address
        const facetName = await this.identifyFacetName(facetAddress, context);
        
        for (const selector of functionSelectors) {
          // Try to resolve function signature
          const signature = await this.resolveFunctionSignature(selector, context);
          
          selectors.push({
            selector: selector.toLowerCase(),
            signature: signature || 'unknown',
            facetAddress: facetAddress.toLowerCase(),
            facetName
          });
        }
      }
      
      return selectors;
      
    } catch (error) {
      throw new Error(`Failed to query on-chain selectors: ${(error as Error).message}`);
    }
  }

  /**
   * Compare expected vs actual selectors
   */
  private compareSelectors(
    expected: FunctionSelector[],
    actual: FunctionSelector[],
    config: FunctionSelectorModuleConfig
  ): SelectorComparison {
    const actualMap = new Map(actual.map(s => [s.selector, s]));
    const expectedMap = new Map(expected.map(s => [s.selector, s]));
    
    const matching: FunctionSelector[] = [];
    const missing: FunctionSelector[] = [];
    const mismatched: Array<{ selector: string; expected: FunctionSelector; actual: FunctionSelector }> = [];
    
    // Check expected selectors
    for (const expectedSelector of expected) {
      // Skip if in skip list
      if (config.skipValidation?.includes(expectedSelector.selector)) {
        continue;
      }
      
      const actualSelector = actualMap.get(expectedSelector.selector);
      
      if (!actualSelector) {
        missing.push(expectedSelector);
      } else if (expectedSelector.facetAddress !== actualSelector.facetAddress && !config.allowAddressChanges) {
        mismatched.push({
          selector: expectedSelector.selector,
          expected: expectedSelector,
          actual: actualSelector
        });
      } else {
        matching.push(expectedSelector);
      }
    }
    
    // Find extra selectors
    const extra: FunctionSelector[] = [];
    for (const actualSelector of actual) {
      if (!expectedMap.has(actualSelector.selector)) {
        extra.push(actualSelector);
      }
    }
    
    return { matching, missing, extra, mismatched };
  }

  /**
   * Generate verification issues based on selector comparison
   */
  private generateComparisonIssues(
    comparison: SelectorComparison,
    config: FunctionSelectorModuleConfig
  ): VerificationIssue[] {
    const issues: VerificationIssue[] = [];

    // Missing selectors
    if (comparison.missing.length > 0 && !config.ignoreMissingSelectors) {
      const severity = config.strictMode ? SeverityLevel.ERROR : SeverityLevel.WARNING;
      
      for (const selector of comparison.missing) {
        issues.push(this.createIssue(
          `missing-selector-${selector.selector}`,
          'Missing Function Selector',
          `Expected function selector '${selector.selector}' (${selector.signature}) not found in on-chain registry`,
          severity,
          'selector',
          'Verify diamond cut operations and ensure all expected facets are properly deployed',
          {
            selector: selector.selector,
            signature: selector.signature,
            expectedFacet: selector.facetName,
            expectedAddress: selector.facetAddress
          }
        ));
      }
    }

    // Extra selectors
    if (comparison.extra.length > 0 && !config.ignoreExtraSelectors) {
      const severity = config.strictMode ? SeverityLevel.WARNING : SeverityLevel.INFO;
      
      for (const selector of comparison.extra) {
        issues.push(this.createIssue(
          `extra-selector-${selector.selector}`,
          'Extra Function Selector',
          `Unexpected function selector '${selector.selector}' (${selector.signature}) found in on-chain registry`,
          severity,
          'selector',
          'Review diamond cuts to ensure no unintended selectors were added',
          {
            selector: selector.selector,
            signature: selector.signature,
            actualFacet: selector.facetName,
            actualAddress: selector.facetAddress
          }
        ));
      }
    }

    // Mismatched selectors (different facet addresses)
    if (comparison.mismatched.length > 0) {
      const severity = config.allowAddressChanges ? SeverityLevel.INFO : SeverityLevel.ERROR;
      
      for (const mismatch of comparison.mismatched) {
        issues.push(this.createIssue(
          `mismatched-selector-${mismatch.selector}`,
          'Function Selector Address Mismatch',
          `Selector '${mismatch.selector}' points to different facet address than expected`,
          severity,
          'selector',
          'Verify diamond upgrade operations and ensure correct facet addresses',
          {
            selector: mismatch.selector,
            expectedAddress: mismatch.expected.facetAddress,
            actualAddress: mismatch.actual.facetAddress,
            expectedFacet: mismatch.expected.facetName,
            actualFacet: mismatch.actual.facetName
          }
        ));
      }
    }

    return issues;
  }

  /**
   * Perform strict mode validations
   */
  private async performStrictValidations(
    context: VerificationContext,
    onChainSelectors: FunctionSelector[]
  ): Promise<VerificationIssue[]> {
    const issues: VerificationIssue[] = [];

    // Check for selector collisions
    const selectorMap = new Map<string, FunctionSelector[]>();
    for (const selector of onChainSelectors) {
      if (!selectorMap.has(selector.selector)) {
        selectorMap.set(selector.selector, []);
      }
      selectorMap.get(selector.selector)!.push(selector);
    }

    for (const [selector, instances] of selectorMap) {
      if (instances.length > 1) {
        issues.push(this.createIssue(
          `selector-collision-${selector}`,
          'Function Selector Collision',
          `Selector '${selector}' is registered multiple times`,
          SeverityLevel.CRITICAL,
          'collision',
          'This indicates a serious diamond implementation error that must be fixed immediately',
          { selector, instances: instances.length }
        ));
      }
    }

    // Check for zero address facets
    const zeroAddressSelectors = onChainSelectors.filter(s => 
      s.facetAddress === '0x0000000000000000000000000000000000000000'
    );
    
    if (zeroAddressSelectors.length > 0) {
      issues.push(this.createIssue(
        'zero-address-facets',
        'Zero Address Facets Detected',
        `Found ${zeroAddressSelectors.length} selectors pointing to zero address`,
        SeverityLevel.ERROR,
        'structural',
        'Remove or replace selectors pointing to zero address',
        { count: zeroAddressSelectors.length, selectors: zeroAddressSelectors.map(s => s.selector) }
      ));
    }

    return issues;
  }

  /**
   * Validate against custom ABI file
   */
  private async validateAgainstCustomABI(
    context: VerificationContext,
    onChainSelectors: FunctionSelector[],
    customAbiPath: string
  ): Promise<VerificationIssue[]> {
    const issues: VerificationIssue[] = [];

    try {
      if (!fs.existsSync(customAbiPath)) {
        issues.push(this.createIssue(
          'custom-abi-not-found',
          'Custom ABI File Not Found',
          `Custom ABI file not found at path: ${customAbiPath}`,
          SeverityLevel.WARNING,
          'configuration'
        ));
        return issues;
      }

      const customABI = JSON.parse(fs.readFileSync(customAbiPath, 'utf8'));
      const customSelectors = this.generateSelectorsFromABI(customABI, 'Custom');
      
      // Compare with on-chain selectors
      const onChainSelectorMap = new Map(onChainSelectors.map(s => [s.selector, s]));
      
      for (const customSelector of customSelectors) {
        const onChainMatch = onChainSelectorMap.get(customSelector.selector);
        
        if (!onChainMatch) {
          issues.push(this.createIssue(
            `custom-abi-missing-${customSelector.selector}`,
            'Custom ABI Selector Missing',
            `Selector '${customSelector.selector}' from custom ABI not found on-chain`,
            SeverityLevel.INFO,
            'abi-validation',
            undefined,
            { selector: customSelector.selector, signature: customSelector.signature }
          ));
        }
      }
      
    } catch (error) {
      issues.push(this.createIssue(
        'custom-abi-validation-error',
        'Custom ABI Validation Error',
        `Failed to validate against custom ABI: ${(error as Error).message}`,
        SeverityLevel.WARNING,
        'configuration'
      ));
    }

    return issues;
  }

  // Helper methods

  private async loadDiamondConfig(configPath: string): Promise<any> {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Diamond configuration file not found: ${configPath}`);
    }
    
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  private async loadDiamondABI(diamondName: string): Promise<any[] | null> {
    const possiblePaths = [
      path.join(process.cwd(), 'diamond-abi', `${diamondName}.json`),
      path.join(process.cwd(), 'diamond-abi', `${diamondName}ABI.json`),
      path.join(process.cwd(), 'artifacts', 'diamond-abi', `${diamondName}.sol`, `${diamondName}.json`)
    ];

    for (const abiPath of possiblePaths) {
      if (fs.existsSync(abiPath)) {
        try {
          const artifact = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
          return artifact.abi || artifact;
        } catch (error) {
          continue;
        }
      }
    }

    return null;
  }

  private async loadFacetABI(facetName: string): Promise<any[] | null> {
    const possiblePaths = [
      path.join(process.cwd(), 'artifacts', 'contracts', '**', `${facetName}.sol`, `${facetName}.json`),
      path.join(process.cwd(), 'artifacts', 'contracts', 'gnus-ai', '**', `${facetName}.sol`, `${facetName}.json`),
      path.join(process.cwd(), 'artifacts', '@gnus.ai', '**', `${facetName}.sol`, `${facetName}.json`)
    ];

    // Simple file search (in production, you might want to use glob)
    for (const basePath of possiblePaths) {
      try {
        // This is a simplified search - you might want to implement recursive directory search
        const artifactPath = basePath.replace('**', '');
        if (fs.existsSync(artifactPath)) {
          const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
          return artifact.abi;
        }
      } catch (error) {
        continue;
      }
    }

    return null;
  }

  private generateSelectorsFromABI(abi: any[], facetName: string): FunctionSelector[] {
    if (!Array.isArray(abi)) {
      return [];
    }

    const selectors: FunctionSelector[] = [];
    
    for (const item of abi) {
      if (item.type === 'function') {
        try {
          const signature = this.buildFunctionSignature(item);
          const selector = ethers.id(signature).slice(0, 10).toLowerCase();
          
          selectors.push({
            selector,
            signature,
            facetAddress: '0x0000000000000000000000000000000000000000', // Will be filled later
            facetName
          });
        } catch (error) {
          // Skip malformed function definitions
          continue;
        }
      }
    }
    
    return selectors;
  }

  private buildFunctionSignature(functionDef: any): string {
    const inputs = functionDef.inputs || [];
    const inputTypes = inputs.map((input: any) => input.type);
    return `${functionDef.name}(${inputTypes.join(',')})`;
  }

  private async identifyFacetName(facetAddress: string, context: VerificationContext): Promise<string | undefined> {
    // This is a simplified implementation
    // In practice, you might maintain a mapping of addresses to facet names
    // or query deployment artifacts
    return undefined;
  }

  private async resolveFunctionSignature(selector: string, context: VerificationContext): Promise<string | undefined> {
    // This could query a signature database like 4byte.directory
    // For now, return undefined (signature will show as 'unknown')
    return undefined;
  }
}
