import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { Interface, Fragment, FunctionFragment } from 'ethers';
import hre from 'hardhat';
import chalk from 'chalk';

/**
 * Options for diamond ABI generation
 */
export interface DiamondAbiGenerationOptions {
  /** Diamond name to generate ABI for */
  diamondName: string;
  /** Network to use */
  networkName?: string;
  /** Chain ID */
  chainId?: number;
  /** Output directory for generated ABI files */
  outputDir?: string;
  /** Whether to include source information in ABI */
  includeSourceInfo?: boolean;
  /** Whether to validate function selector uniqueness */
  validateSelectors?: boolean;
  /** Whether to log verbose output */
  verbose?: boolean;
  /** Path to diamond configurations */
  diamondsPath?: string;
}

/**
 * Result of ABI generation
 */
export interface DiamondAbiGenerationResult {
  /** Generated combined ABI */
  abi: any[];
  /** Function selector to facet mapping */
  selectorMap: Record<string, string>;
  /** Facet addresses included in the ABI */
  facetAddresses: string[];
  /** Output file path */
  outputPath?: string;
  /** Statistics about the generation */
  stats: {
    totalFunctions: number;
    totalEvents: number;
    totalErrors: number;
    facetCount: number;
    duplicateSelectorsSkipped: number;
  };
}

/**
 * Information about a facet
 */
interface FacetInfo {
  address: string;
  selectors: string[];
  source: 'deployment' | 'config' | 'fallback';
}

/**
 * Project-specific Diamond ABI Generator
 */
export class ProjectDiamondAbiGenerator {
  private options: Required<DiamondAbiGenerationOptions>;
  private combinedAbi: any[] = [];
  private seenSelectors = new Set<string>();
  private selectorToFacet: Record<string, string> = {};
  private stats = {
    totalFunctions: 0,
    totalEvents: 0,
    totalErrors: 0,
    facetCount: 0,
    duplicateSelectorsSkipped: 0
  };

  constructor(options: DiamondAbiGenerationOptions) {
    this.options = {
      networkName: 'hardhat',
      chainId: 31337,
      outputDir: './artifacts/diamond-abi',
      includeSourceInfo: true,
      validateSelectors: true,
      verbose: false,
      diamondsPath: './diamonds',
      ...options
    };
  }

  /**
   * Generate the diamond ABI
   */
  async generateAbi(): Promise<DiamondAbiGenerationResult> {
    if (this.options.verbose) {
      console.log(chalk.blue('🔧 Generating Diamond ABI...'));
    }

    // Reset state
    this.resetState();

    // Get facets to include in ABI
    const facetsToInclude = await this.getFacetsToIncludeFromConfig();
    
    // Process each facet
    for (const [facetName, facetInfo] of Object.entries(facetsToInclude)) {
      await this.processFacet(facetName, facetInfo);
    }

    // Add DiamondLoupe functions if not already included
    await this.ensureDiamondLoupeFunctions();

    // Sort ABI for consistency
    this.sortAbi();

    // Generate output
    const result = await this.generateOutput();

    if (this.options.verbose) {
      this.logStats();
    }

    return result;
  }

  /**
   * Reset internal state
   */
  private resetState(): void {
    this.seenSelectors.clear();
    this.selectorToFacet = {};
    this.combinedAbi = [];
    this.stats = {
      totalFunctions: 0,
      totalEvents: 0,
      totalErrors: 0,
      facetCount: 0,
      duplicateSelectorsSkipped: 0
    };
  }

  /**
   * Read diamond configuration directly from file
   */
  private readDiamondConfig(): any {
    const configPath = join(this.options.diamondsPath!, this.options.diamondName, `${this.options.diamondName.toLowerCase()}.config.json`);
    
    if (!existsSync(configPath)) {
      throw new Error(`Diamond configuration not found at ${configPath}`);
    }

    try {
      const configContent = readFileSync(configPath, 'utf-8');
      return JSON.parse(configContent);
    } catch (error) {
      throw new Error(`Failed to read diamond configuration: ${error}`);
    }
  }

  /**
   * Get deployment info directly from file
   */
  private readDeploymentInfo(): any {
    const deploymentPath = join(this.options.diamondsPath!, this.options.diamondName, 'deployments', this.options.networkName!, `${this.options.chainId}.json`);
    
    if (!existsSync(deploymentPath)) {
      if (this.options.verbose) {
        console.log(chalk.yellow(`⚠️  No deployment found at ${deploymentPath}, using config only`));
      }
      return null;
    }

    try {
      const deploymentContent = readFileSync(deploymentPath, 'utf-8');
      return JSON.parse(deploymentContent);
    } catch (error) {
      if (this.options.verbose) {
        console.log(chalk.yellow(`⚠️  Failed to read deployment info: ${error}`));
      }
      return null;
    }
  }

  /**
   * Get all facets that should be included in the ABI from configuration
   */
  private async getFacetsToIncludeFromConfig(): Promise<Record<string, FacetInfo>> {
    const facetsToInclude: Record<string, FacetInfo> = {};
    
    try {
      // Read diamond configuration
      const config = this.readDiamondConfig();
      const deployment = this.readDeploymentInfo();
      
      if (this.options.verbose) {
        console.log(chalk.blue(`📋 Processing diamond configuration...`));
      }

      // Get facets from deployment if available
      if (deployment && deployment.facets) {
        for (const [facetName, facetData] of Object.entries(deployment.facets)) {
          if (typeof facetData === 'object' && facetData !== null) {
            const data = facetData as any;
            facetsToInclude[facetName] = {
              address: data.address || '0x0000000000000000000000000000000000000000',
              selectors: data.selectors || [],
              source: 'deployment'
            };
          }
        }
      }

      // Get facets from config
      if (config && config.facets) {
        for (const facetName of Object.keys(config.facets)) {
          if (!facetsToInclude[facetName]) {
            try {
              // Try to get the artifact to determine available functions
              const artifact = await hre.artifacts.readArtifact(facetName);
              if (artifact.abi) {
                const iface = new Interface(artifact.abi);
                const selectors = Object.values(iface.fragments)
                  .filter((fragment): fragment is FunctionFragment => fragment.type === 'function')
                  .map(func => func.selector);
                
                facetsToInclude[facetName] = {
                  address: '0x0000000000000000000000000000000000000000', // Placeholder
                  selectors,
                  source: 'config'
                };
              }
            } catch (error) {
              if (this.options.verbose) {
                console.log(chalk.yellow(`⚠️  Could not load artifact for ${facetName}: ${error}`));
              }
            }
          }
        }
      }

      if (this.options.verbose) {
        console.log(chalk.green(`✅ Found ${Object.keys(facetsToInclude).length} facets to include`));
      }

    } catch (error) {
      if (this.options.verbose) {
        console.log(chalk.yellow(`⚠️  Error reading diamond configuration: ${error}`));
      }
      
      // Fallback: scan for common facet contracts
      const commonFacets = [
        'DiamondCutFacet',
        'DiamondLoupeFacet', 
        'OwnershipFacet',
        'GeniusOwnershipFacet',
        'GeniusAI',
        'GNUSControl',
        'GNUSNFTFactory',
        'GNUSERC1155MaxSupply',
        'GNUSBridge'
      ];

      for (const facetName of commonFacets) {
        try {
          const artifact = await hre.artifacts.readArtifact(facetName);
          if (artifact.abi) {
            const iface = new Interface(artifact.abi);
            const selectors = Object.values(iface.fragments)
              .filter((fragment): fragment is FunctionFragment => fragment.type === 'function')
              .map(func => func.selector);
            
            facetsToInclude[facetName] = {
              address: '0x0000000000000000000000000000000000000000',
              selectors,
              source: 'fallback'
            };
          }
        } catch (error) {
          // Facet not found, skip
        }
      }
    }

    return facetsToInclude;
  }

  /**
   * Process a single facet and add its ABI to the combined ABI
   */
  private async processFacet(facetName: string, facetInfo: FacetInfo): Promise<void> {
    try {
      if (this.options.verbose) {
        console.log(chalk.blue(`📝 Processing facet: ${facetName} (${facetInfo.source})`));
      }

      // Try to get the artifact
      const artifact = await hre.artifacts.readArtifact(facetName);
      if (!artifact.abi) {
        if (this.options.verbose) {
          console.log(chalk.yellow(`⚠️  No ABI found for ${facetName}`));
        }
        return;
      }

      // Process each ABI item
      for (const abiItem of artifact.abi) {
        if (abiItem.type === 'function') {
          const iface = new Interface([abiItem]);
          const func = iface.getFunction(abiItem.name);
          
          if (func) {
            if (this.seenSelectors.has(func.selector)) {
              this.stats.duplicateSelectorsSkipped++;
              if (this.options.verbose) {
                console.log(chalk.yellow(`⚠️  Duplicate selector ${func.selector} for ${abiItem.name} (skipping)`));
              }
              continue;
            }

            this.seenSelectors.add(func.selector);
            this.selectorToFacet[func.selector] = facetName;
            this.combinedAbi.push(abiItem);
            this.stats.totalFunctions++;
          }
        } else if (abiItem.type === 'event') {
          // Add events without selector validation
          this.combinedAbi.push(abiItem);
          this.stats.totalEvents++;
        } else if (abiItem.type === 'error') {
          // Add errors
          this.combinedAbi.push(abiItem);
          this.stats.totalErrors++;
        }
      }

      this.stats.facetCount++;

    } catch (error) {
      if (this.options.verbose) {
        console.log(chalk.yellow(`⚠️  Could not process facet ${facetName}: ${error}`));
      }
    }
  }

  /**
   * Ensure DiamondLoupe functions are included
   */
  private async ensureDiamondLoupeFunctions(): Promise<void> {
    const loupeFunctions = [
      'facets',
      'facetFunctionSelectors',
      'facetAddresses',
      'facetAddress',
      'supportsInterface'
    ];

    try {
      const loupeArtifact = await hre.artifacts.readArtifact('DiamondLoupeFacet');
      const iface = new Interface(loupeArtifact.abi);

      for (const funcName of loupeFunctions) {
        try {
          const func = iface.getFunction(funcName);
          if (func && !this.seenSelectors.has(func.selector)) {
            const abiItem = loupeArtifact.abi.find(
              (item: any) => item.type === 'function' && item.name === funcName
            );
            if (abiItem) {
              this.seenSelectors.add(func.selector);
              this.selectorToFacet[func.selector] = 'DiamondLoupeFacet';
              this.combinedAbi.push(abiItem);
              this.stats.totalFunctions++;
            }
          }
        } catch (error) {
          // Function might not exist in this version of DiamondLoupe
        }
      }
    } catch (error) {
      if (this.options.verbose) {
        console.log(chalk.yellow(`⚠️  Could not load DiamondLoupeFacet artifact: ${error}`));
      }
    }
  }

  /**
   * Sort ABI items for consistency
   */
  private sortAbi(): void {
    this.combinedAbi.sort((a, b) => {
      // Sort by type first (functions, events, errors)
      const typeOrder = { function: 0, event: 1, error: 2, constructor: 3 };
      const aOrder = typeOrder[a.type as keyof typeof typeOrder] ?? 999;
      const bOrder = typeOrder[b.type as keyof typeof typeOrder] ?? 999;
      
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      // Then sort by name
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  /**
   * Generate output files and return result
   */
  private async generateOutput(): Promise<DiamondAbiGenerationResult> {
    // Ensure output directory exists
    if (!existsSync(this.options.outputDir)) {
      mkdirSync(this.options.outputDir, { recursive: true });
    }

    // Generate output file path
    const outputFileName = `${this.options.diamondName}.json`;
    const outputPath = join(this.options.outputDir, outputFileName);

    // Create the full artifact structure
    const artifact = {
      contractName: this.options.diamondName,
      abi: this.combinedAbi,
      metadata: {
        compiler: 'diamond-abi-generator',
        generatedAt: new Date().toISOString(),
        networkName: this.options.networkName,
        chainId: this.options.chainId,
        selectorMap: this.selectorToFacet,
        stats: this.stats
      }
    };

    // Write the combined ABI
    writeFileSync(outputPath, JSON.stringify(artifact, null, 2));

    if (this.options.verbose) {
      console.log(chalk.green(`✅ Diamond ABI written to: ${outputPath}`));
    }

    return {
      abi: this.combinedAbi,
      selectorMap: this.selectorToFacet,
      facetAddresses: Object.values(this.selectorToFacet),
      outputPath,
      stats: this.stats
    };
  }

  /**
   * Log generation statistics
   */
  private logStats(): void {
    console.log(chalk.cyan('\n📊 Generation Statistics:'));
    console.log(chalk.cyan(`   • Facets processed: ${this.stats.facetCount}`));
    console.log(chalk.cyan(`   • Functions: ${this.stats.totalFunctions}`));
    console.log(chalk.cyan(`   • Events: ${this.stats.totalEvents}`));
    console.log(chalk.cyan(`   • Errors: ${this.stats.totalErrors}`));
    console.log(chalk.cyan(`   • Duplicate selectors skipped: ${this.stats.duplicateSelectorsSkipped}`));
    console.log(chalk.cyan(`   • Total ABI items: ${this.combinedAbi.length}\n`));
  }
}
