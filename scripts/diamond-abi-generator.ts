import { Diamond, FileDeploymentRepository, DiamondAbiGenerator, generateDiamondAbi as generateDiamondAbiCore, DiamondAbiGenerationOptions as CoreDiamondAbiGenerationOptions, DiamondAbiGenerationResult as CoreDiamondAbiGenerationResult } from 'diamonds';
import { join } from 'path';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
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
 * Project-specific Diamond ABI Generator
 * This class wraps the diamonds module's DiamondAbiGenerator for project-specific use
 */
export class ProjectDiamondAbiGenerator {
  private options: Required<DiamondAbiGenerationOptions>;
  private diamond: Diamond | null = null;
  private repository: FileDeploymentRepository | null = null;
  private initializationError: Error | null = null;

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

    try {
      // Create diamond configuration
      const diamondConfig = {
        diamondName: this.options.diamondName,
        networkName: this.options.networkName,
        chainId: this.options.chainId,
        deploymentsPath: this.options.diamondsPath,
        contractsPath: './contracts'
      };

      // Create repository
      this.repository = new FileDeploymentRepository(diamondConfig);

      // Create diamond instance
      this.diamond = new Diamond(diamondConfig, this.repository);
    } catch (error) {
      this.initializationError = error as Error;
      if (this.options.verbose) {
        console.log(chalk.yellow(`⚠️  Failed to initialize diamond: ${error}`));
      }
    }
  }

  /**
   * Generate the diamond ABI using the diamonds module DiamondAbiGenerator
   */
  async generateAbi(): Promise<DiamondAbiGenerationResult> {
    if (this.options.verbose) {
      console.log(chalk.blue('🔧 Generating Diamond ABI using diamonds module DiamondAbiGenerator...'));
    }

    try {
      // If initialization failed, return fallback result
      if (this.initializationError || !this.diamond) {
        if (this.options.verbose) {
          console.log(chalk.yellow(`⚠️  Using fallback ABI generation due to initialization error: ${this.initializationError?.message}`));
        }
        return this.generateFallbackAbi();
      }

      // Check if there's any deployment data or function selector registry data
      const deployedData = this.diamond.getDeployedDiamondData();
      const hasDeployedFacets = deployedData.DeployedFacets && Object.keys(deployedData.DeployedFacets).length > 0;
      const hasRegistryData = this.diamond.functionSelectorRegistry && this.diamond.functionSelectorRegistry.size > 0;

      if (!hasDeployedFacets && !hasRegistryData) {
        if (this.options.verbose) {
          console.log(chalk.yellow(`⚠️  No deployment data or registry data found, using configuration-based ABI generation`));
        }
        return this.generateConfigBasedAbi();
      }

      // Use the DiamondAbiGenerator class from diamonds module
      const generator = new DiamondAbiGenerator({
        diamond: this.diamond,
        outputDir: this.options.outputDir,
        includeSourceInfo: this.options.includeSourceInfo,
        validateSelectors: this.options.validateSelectors,
        verbose: this.options.verbose
      });

      // Generate ABI using the diamonds module generator
      const result = await generator.generateAbi();

      // Post-process the generated file to match expected format if needed
      if (result.outputPath) {
        const newOutputPath = await this.postProcessArtifact(result.outputPath);
        result.outputPath = newOutputPath;
      }

      if (this.options.verbose) {
        console.log(chalk.green(`✅ Diamond ABI generated successfully using DiamondAbiGenerator`));
        console.log(chalk.blue(`   Functions: ${result.stats.totalFunctions}`));
        console.log(chalk.blue(`   Events: ${result.stats.totalEvents}`));
        console.log(chalk.blue(`   Facets: ${result.stats.facetCount}`));
        console.log(chalk.blue(`   Output: ${result.outputPath}`));
      }

      return result;
    } catch (error) {
      if (this.options.verbose) {
        console.log(chalk.yellow(`⚠️  DiamondAbiGenerator failed, trying configuration-based approach: ${error}`));
      }
      return this.generateConfigBasedAbi();
    }
  }

  /**
   * Post-process the artifact to match expected format
   */
  private async postProcessArtifact(outputPath: string): Promise<string> {
    try {
      const content = readFileSync(outputPath, 'utf-8');
      const artifact = JSON.parse(content);

      // Convert _diamondMetadata to metadata for compatibility
      if (artifact._diamondMetadata && !artifact.metadata) {
        artifact.metadata = JSON.stringify({
          compiler: 'diamond-abi-generator',
          generatedAt: artifact._diamondMetadata.generatedAt,
          networkName: artifact._diamondMetadata.networkName,
          chainId: artifact._diamondMetadata.chainId,
          selectorMap: artifact._diamondMetadata.selectorMap,
          stats: artifact._diamondMetadata.stats
        });
      }

      // Use unique contract name to avoid conflicts
      const uniqueName = `${this.options.diamondName}ABI`;
      artifact.contractName = uniqueName;
      artifact.sourceName = `diamond-abi/${uniqueName}.sol`;

      // Write back the updated artifact with unique naming
      const uniqueOutputPath = join(this.options.outputDir, `${uniqueName}.json`);
      writeFileSync(uniqueOutputPath, JSON.stringify(artifact, null, 2));

      // Remove the original file if it has a different name
      if (uniqueOutputPath !== outputPath) {
        try {
          const fs = require('fs');
          fs.unlinkSync(outputPath);
        } catch (error) {
          // Ignore deletion errors
        }
      }

      return uniqueOutputPath;
    } catch (error) {
      if (this.options.verbose) {
        console.log(chalk.yellow(`⚠️  Failed to post-process artifact: ${error}`));
      }
      return outputPath;
    }
  }

  /**
   * Generate a fallback ABI when the diamonds module fails
   */
  private async generateFallbackAbi(): Promise<DiamondAbiGenerationResult> {
    // Ensure output directory exists
    if (!existsSync(this.options.outputDir)) {
      mkdirSync(this.options.outputDir, { recursive: true });
    }

    // Generate output file path with unique name to avoid conflicts
    const outputContractName = `${this.options.diamondName}ABI`;
    const outputFileName = `${outputContractName}.json`;
    const outputPath = join(this.options.outputDir, outputFileName);

    // Create minimal artifact structure for testing
    const artifact = {
      _format: "hh-sol-artifact-1",
      contractName: outputContractName,
      sourceName: `diamond-abi/${outputContractName}.sol`,
      abi: [],
      bytecode: "0x",
      deployedBytecode: "0x",
      linkReferences: {},
      deployedLinkReferences: {}
    };

    // Add metadata if requested
    if (this.options.includeSourceInfo) {
      (artifact as any).metadata = JSON.stringify({
        compiler: 'diamond-abi-generator-fallback',
        generatedAt: new Date().toISOString(),
        networkName: this.options.networkName,
        chainId: this.options.chainId,
        error: this.initializationError?.message || 'Unknown error'
      });
    }

    // Write the artifact
    writeFileSync(outputPath, JSON.stringify(artifact, null, 2));

    // Return empty ABI structure for graceful failure
    return {
      abi: [],
      selectorMap: {},
      facetAddresses: [],
      outputPath,
      stats: {
        totalFunctions: 0,
        totalEvents: 0,
        totalErrors: 0,
        facetCount: 0,
        duplicateSelectorsSkipped: 0
      }
    };
  }

  /**
   * Generate ABI based on diamond configuration when no deployment data is available
   */
  private async generateConfigBasedAbi(): Promise<DiamondAbiGenerationResult> {
    if (this.options.verbose) {
      console.log(chalk.blue('🔧 Generating Diamond ABI from configuration...'));
    }

    // Ensure output directory exists
    if (!existsSync(this.options.outputDir)) {
      mkdirSync(this.options.outputDir, { recursive: true });
    }

    try {
      // Read diamond configuration to find facets
      const configPath = join(this.options.diamondsPath, this.options.diamondName, `${this.options.diamondName.toLowerCase()}.config.json`);
      
      if (!existsSync(configPath)) {
        if (this.options.verbose) {
          console.log(chalk.yellow(`⚠️  Configuration file not found at ${configPath}`));
        }
        return this.generateFallbackAbi();
      }

      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      const combinedAbi: any[] = [];
      const selectorMap: Record<string, string> = {};
      let totalFunctions = 0;
      let totalEvents = 0;
      let totalErrors = 0;

      // Process each facet from configuration
      for (const [facetName, facetConfig] of Object.entries(config.facets || {})) {
        try {
          if (this.options.verbose) {
            console.log(chalk.cyan(`📄 Processing ${facetName} from configuration...`));
          }

          // Try to load the contract artifact
          const artifactPaths = [
            `./artifacts/contracts/${facetName}.sol/${facetName}.json`,
            `./artifacts/contracts/gnus-ai/${facetName}.sol/${facetName}.json`,
            `./artifacts/@gnus.ai/contracts-upgradeable-diamond/contracts/${facetName}.sol/${facetName}.json`
          ];

          let artifact = null;
          for (const artifactPath of artifactPaths) {
            if (existsSync(artifactPath)) {
              artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));
              break;
            }
          }

          if (!artifact) {
            if (this.options.verbose) {
              console.log(chalk.yellow(`⚠️  Artifact not found for ${facetName}`));
            }
            continue;
          }

          // Process ABI items
          for (const abiItem of artifact.abi || []) {
            if (abiItem.type === 'function') {
              const { Interface } = await import('ethers');
              const iface = new Interface([abiItem]);
              const func = iface.getFunction(abiItem.name);
              if (func) {
                const selector = func.selector;
                
                // Add source information if requested
                if (this.options.includeSourceInfo) {
                  abiItem._diamondFacet = facetName;
                  abiItem._diamondSelector = selector;
                }

                combinedAbi.push(abiItem);
                selectorMap[selector] = facetName;
                totalFunctions++;
              }
            } else if (abiItem.type === 'event') {
              combinedAbi.push(abiItem);
              totalEvents++;
            } else if (abiItem.type === 'error') {
              combinedAbi.push(abiItem);
              totalErrors++;
            }
          }
        } catch (error) {
          if (this.options.verbose) {
            console.log(chalk.yellow(`⚠️  Error processing ${facetName}: ${error}`));
          }
        }
      }

      // Sort ABI for consistency
      combinedAbi.sort((a, b) => {
        const typeOrder = { 'function': 0, 'event': 1, 'error': 2 };
        if (a.type !== b.type) {
          return (typeOrder[a.type as keyof typeof typeOrder] || 99) - (typeOrder[b.type as keyof typeof typeOrder] || 99);
        }
        return (a.name || '').localeCompare(b.name || '');
      });

      // Generate output file with unique name
      const outputContractName = `${this.options.diamondName}ABI`;
      const outputFileName = `${outputContractName}.json`;
      const outputPath = join(this.options.outputDir, outputFileName);

      const artifact = {
        "_format": "hh-sol-artifact-1",
        "contractName": outputContractName,
        "sourceName": `diamond-abi/${outputContractName}.sol`,
        "abi": combinedAbi,
        "bytecode": "",
        "deployedBytecode": "",
        "linkReferences": {},
        "deployedLinkReferences": {},
        "_diamondMetadata": {
          "generatedAt": new Date().toISOString(),
          "diamondName": this.options.diamondName,
          "networkName": this.options.networkName,
          "chainId": this.options.chainId,
          "selectorMap": selectorMap,
          "stats": {
            "totalFunctions": totalFunctions,
            "totalEvents": totalEvents,
            "totalErrors": totalErrors,
            "facetCount": Object.keys(config.facets || {}).length,
            "duplicateSelectorsSkipped": 0
          }
        }
      };

      // Add metadata if requested
      if (this.options.includeSourceInfo) {
        (artifact as any).metadata = JSON.stringify({
          compiler: 'diamond-abi-generator-config',
          generatedAt: new Date().toISOString(),
          networkName: this.options.networkName,
          chainId: this.options.chainId,
          selectorMap: selectorMap,
          stats: {
            totalFunctions,
            totalEvents,
            totalErrors,
            facetCount: Object.keys(config.facets || {}).length,
            duplicateSelectorsSkipped: 0
          }
        });
      }

      writeFileSync(outputPath, JSON.stringify(artifact, null, 2));

      const result: DiamondAbiGenerationResult = {
        abi: combinedAbi,
        selectorMap,
        facetAddresses: [],
        outputPath,
        stats: {
          totalFunctions,
          totalEvents,
          totalErrors,
          facetCount: Object.keys(config.facets || {}).length,
          duplicateSelectorsSkipped: 0
        }
      };

      if (this.options.verbose) {
        console.log(chalk.green(`✅ Configuration-based Diamond ABI generated`));
        console.log(chalk.blue(`   Functions: ${totalFunctions}`));
        console.log(chalk.blue(`   Events: ${totalEvents}`));
        console.log(chalk.blue(`   Errors: ${totalErrors}`));
        console.log(chalk.blue(`   Facets: ${Object.keys(config.facets || {}).length}`));
        console.log(chalk.blue(`   Output: ${outputPath}`));
      }

      return result;
    } catch (error) {
      if (this.options.verbose) {
        console.log(chalk.yellow(`⚠️  Configuration-based generation failed: ${error}`));
      }
      return this.generateFallbackAbi();
    }
  }
}

/**
 * Convenience function to generate diamond ABI using provided options
 * @param options - Generation options including diamondName
 * @returns Promise resolving to generation result
 */
export async function generateDiamondAbi(
  options: DiamondAbiGenerationOptions & { diamondName: string }
): Promise<DiamondAbiGenerationResult> {
  const generator = new ProjectDiamondAbiGenerator(options);
  return generator.generateAbi();
}

// CLI support
if (require.main === module) {
  const diamondName = process.argv[2] || 'GeniusDiamond';
  const verbose = process.argv.includes('--verbose');
  
  const options: DiamondAbiGenerationOptions = {
    diamondName,
    verbose,
    outputDir: './artifacts/diamond-abi',
    includeSourceInfo: true,
    validateSelectors: true
  };
  
  generateDiamondAbi(options)
    .then((result) => {
      console.log(chalk.green('🎉 Diamond ABI generation complete!'));
      console.log(chalk.blue(`   Functions: ${result.stats.totalFunctions}`));
      console.log(chalk.blue(`   Events: ${result.stats.totalEvents}`));
      console.log(chalk.blue(`   Facets: ${result.stats.facetCount}`));
      console.log(chalk.blue(`   Output: ${result.outputPath}`));
      process.exit(0);
    })
    .catch((error) => {
      console.error(chalk.red('❌ Diamond ABI generation failed:'), error);
      process.exit(1);
    });
}
