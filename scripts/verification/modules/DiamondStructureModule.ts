/**
 * Diamond Structure Verification Module
 * 
 * Validates the overall structure and integrity of the diamond proxy.
 * This module checks fundamental diamond properties, facet relationships,
 * and structural consistency.
 */

import { ethers } from 'ethers';
import * as fs from 'fs';
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
 * Facet information from on-chain query
 */
interface FacetInfo {
  address: string;
  selectors: string[];
  name?: string;
  version?: string;
}

/**
 * Diamond structure analysis result
 */
interface DiamondStructureAnalysis {
  totalFacets: number;
  totalSelectors: number;
  diamondLoupePresent: boolean;
  diamondCutPresent: boolean;
  ownershipFacetPresent: boolean;
  duplicateSelectors: string[];
  orphanedSelectors: string[];
  zeroAddressFacets: string[];
  protocolVersion?: string;
}

/**
 * Configuration for diamond structure module
 */
interface DiamondStructureModuleConfig {
  requireDiamondLoupe?: boolean;
  requireDiamondCut?: boolean;
  requireOwnership?: boolean;
  allowZeroAddressFacets?: boolean;
  minFacetCount?: number;
  maxFacetCount?: number;
  protocolVersionCheck?: boolean;
  customChecks?: string[];
}

/**
 * Diamond Structure Verification Module
 * 
 * Performs comprehensive structural verification of diamond proxy contracts.
 */
export class DiamondStructureVerificationModule extends BaseVerificationModule {
  public readonly id = 'diamond-structure';
  public readonly name = 'Diamond Structure Verification';
  public readonly description = 'Validates diamond proxy structure, facet relationships, and core functionality';
  public readonly version = '1.0.0';
  public readonly category = 'structural';

  // Standard diamond interface selectors
  private readonly standardSelectors = {
    // DiamondLoupe
    diamondLoupe: {
      facets: '0x7a0ed627',
      facetFunctionSelectors: '0xadfca15e',
      facetAddresses: '0x52ef6b2c',
      facetAddress: '0xcdffacc6'
    },
    // DiamondCut
    diamondCut: {
      diamondCut: '0x1f931c1c'
    },
    // Ownership
    ownership: {
      owner: '0x8da5cb5b',
      transferOwnership: '0xf2fde38b'
    },
    // ERC165
    erc165: {
      supportsInterface: '0x01ffc9a7'
    }
  };

  // Standard diamond ABIs
  private readonly diamondABIs = {
    loupe: [
      'function facets() external view returns (tuple(address facetAddress, bytes4[] functionSelectors)[])',
      'function facetFunctionSelectors(address facet) external view returns (bytes4[])',
      'function facetAddresses() external view returns (address[])',
      'function facetAddress(bytes4 selector) external view returns (address)'
    ],
    cut: [
      'function diamondCut(tuple(address facetAddress, uint8 action, bytes4[] functionSelectors)[] _diamondCut, address _init, bytes _calldata) external'
    ],
    ownership: [
      'function owner() external view returns (address)',
      'function transferOwnership(address newOwner) external'
    ],
    erc165: [
      'function supportsInterface(bytes4 interfaceId) external view returns (bool)'
    ]
  };

  /**
   * Get configuration requirements for this module
   */
  public getRequiredConfig(): ConfigRequirement[] {
    return [
      {
        key: 'requireDiamondLoupe',
        type: 'boolean',
        required: false,
        description: 'Whether DiamondLoupe facet is required',
        defaultValue: true
      },
      {
        key: 'requireDiamondCut',
        type: 'boolean',
        required: false,
        description: 'Whether DiamondCut facet is required',
        defaultValue: true
      },
      {
        key: 'requireOwnership',
        type: 'boolean',
        required: false,
        description: 'Whether ownership facet is required',
        defaultValue: true
      },
      {
        key: 'allowZeroAddressFacets',
        type: 'boolean',
        required: false,
        description: 'Whether to allow facets with zero address',
        defaultValue: false
      },
      {
        key: 'minFacetCount',
        type: 'number',
        required: false,
        description: 'Minimum number of facets required',
        defaultValue: 1
      },
      {
        key: 'maxFacetCount',
        type: 'number',
        required: false,
        description: 'Maximum number of facets allowed',
        defaultValue: 50
      },
      {
        key: 'protocolVersionCheck',
        type: 'boolean',
        required: false,
        description: 'Whether to verify protocol version',
        defaultValue: true
      }
    ];
  }

  /**
   * Check if this module can verify the given diamond
   */
  public async canVerify(diamond: DiamondInfo, network: NetworkInfo): Promise<boolean> {
    return true; // This module can verify any diamond
  }

  /**
   * Execute diamond structure verification
   */
  public async verify(context: VerificationContext): Promise<VerificationResult> {
    const startTime = Date.now();
    const issues: VerificationIssue[] = [];
    const moduleConfig = this.getModuleConfig<DiamondStructureModuleConfig>(context);

    this.log(context, 'info', '🏗️  Starting diamond structure verification...');

    try {
      // 1. Analyze diamond structure
      this.log(context, 'info', '🔍 Analyzing diamond structure...');
      const analysis = await this.analyzeDiamondStructure(context);

      // 2. Verify basic diamond requirements
      this.log(context, 'info', '✅ Verifying basic diamond requirements...');
      const basicIssues = this.verifyBasicRequirements(analysis, moduleConfig);
      issues.push(...basicIssues);

      // 3. Verify standard facets
      this.log(context, 'info', '🧩 Verifying standard facets...');
      const facetIssues = this.verifyStandardFacets(analysis, moduleConfig);
      issues.push(...facetIssues);

      // 4. Check for structural issues
      this.log(context, 'info', '🔧 Checking for structural issues...');
      const structuralIssues = this.checkStructuralIntegrity(analysis, moduleConfig);
      issues.push(...structuralIssues);

      // 5. Verify protocol version if enabled
      if (moduleConfig.protocolVersionCheck && analysis.protocolVersion) {
        this.log(context, 'info', '📋 Verifying protocol version...');
        const versionIssues = await this.verifyProtocolVersion(context, analysis.protocolVersion);
        issues.push(...versionIssues);
      }

      // 6. Test core functionality
      this.log(context, 'info', '⚙️  Testing core functionality...');
      const functionalityIssues = await this.testCoreFunctionality(context, analysis);
      issues.push(...functionalityIssues);

      const executionTime = Date.now() - startTime;
      this.log(context, 'info', `✅ Diamond structure verification completed in ${executionTime}ms`);

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
        analysis,
        moduleConfig
      };

      return this.createResult(status, issues, executionTime, metadata);

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.log(context, 'error', `❌ Diamond structure verification failed: ${(error as Error).message}`);

      issues.push(this.createIssue(
        'verification-error',
        'Verification Error',
        `Diamond structure verification failed: ${(error as Error).message}`,
        SeverityLevel.CRITICAL,
        'system'
      ));

      return this.createResult(VerificationStatus.FAIL, issues, executionTime, { error: (error as Error).message });
    }
  }

  /**
   * Analyze the diamond structure
   */
  private async analyzeDiamondStructure(context: VerificationContext): Promise<DiamondStructureAnalysis> {
    const { diamond, provider } = context;
    
    // Query facets using DiamondLoupe
    let facets: FacetInfo[] = [];
    let diamondLoupePresent = false;
    
    try {
      const diamondContract = new ethers.Contract(diamond.address, this.diamondABIs.loupe, provider);
      const facetData = await diamondContract.facets();
      
      facets = facetData.map((f: any) => ({
        address: f.facetAddress.toLowerCase(),
        selectors: f.functionSelectors.map((s: string) => s.toLowerCase()),
        name: this.identifyFacetName(f.facetAddress, f.functionSelectors)
      }));
      
      diamondLoupePresent = true;
    } catch (error) {
      this.log(context, 'warn', `Could not query facets via DiamondLoupe: ${(error as Error).message}`);
    }

    // Calculate totals and analyze structure
    const totalFacets = facets.length;
    const totalSelectors = facets.reduce((sum, facet) => sum + facet.selectors.length, 0);

    // Check for duplicate selectors
    const allSelectors = facets.flatMap(f => f.selectors);
    const selectorCounts = new Map<string, number>();
    for (const selector of allSelectors) {
      selectorCounts.set(selector, (selectorCounts.get(selector) || 0) + 1);
    }
    const duplicateSelectors = Array.from(selectorCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([selector, _]) => selector);

    // Find zero address facets
    const zeroAddressFacets = facets
      .filter(f => f.address === '0x0000000000000000000000000000000000000000')
      .flatMap(f => f.selectors);

    // Check for standard facets
    const diamondCutPresent = this.hasFunctionSelector(facets, this.standardSelectors.diamondCut.diamondCut);
    const ownershipFacetPresent = this.hasFunctionSelector(facets, this.standardSelectors.ownership.owner);

    // Try to get protocol version
    const protocolVersion = await this.getProtocolVersion(context);

    return {
      totalFacets,
      totalSelectors,
      diamondLoupePresent,
      diamondCutPresent,
      ownershipFacetPresent,
      duplicateSelectors,
      orphanedSelectors: [], // Will be populated if needed
      zeroAddressFacets,
      protocolVersion
    };
  }

  /**
   * Verify basic diamond requirements
   */
  private verifyBasicRequirements(
    analysis: DiamondStructureAnalysis,
    config: DiamondStructureModuleConfig
  ): VerificationIssue[] {
    const issues: VerificationIssue[] = [];

    // Check minimum facet count
    if (config.minFacetCount && analysis.totalFacets < config.minFacetCount) {
      issues.push(this.createIssue(
        'min-facet-count',
        'Insufficient Facet Count',
        `Diamond has ${analysis.totalFacets} facets, but minimum required is ${config.minFacetCount}`,
        SeverityLevel.ERROR,
        'structure',
        'Add more facets to meet minimum requirements'
      ));
    }

    // Check maximum facet count
    if (config.maxFacetCount && analysis.totalFacets > config.maxFacetCount) {
      issues.push(this.createIssue(
        'max-facet-count',
        'Excessive Facet Count',
        `Diamond has ${analysis.totalFacets} facets, but maximum allowed is ${config.maxFacetCount}`,
        SeverityLevel.WARNING,
        'structure',
        'Consider consolidating facets to reduce complexity'
      ));
    }

    // Check if diamond has any selectors
    if (analysis.totalSelectors === 0) {
      issues.push(this.createIssue(
        'no-selectors',
        'No Function Selectors',
        'Diamond has no function selectors registered',
        SeverityLevel.CRITICAL,
        'structure',
        'This indicates a completely non-functional diamond'
      ));
    }

    return issues;
  }

  /**
   * Verify standard facets
   */
  private verifyStandardFacets(
    analysis: DiamondStructureAnalysis,
    config: DiamondStructureModuleConfig
  ): VerificationIssue[] {
    const issues: VerificationIssue[] = [];

    // DiamondLoupe requirement
    if (config.requireDiamondLoupe !== false && !analysis.diamondLoupePresent) {
      issues.push(this.createIssue(
        'missing-diamond-loupe',
        'Missing DiamondLoupe Facet',
        'DiamondLoupe facet is not present or functional',
        SeverityLevel.ERROR,
        'facet',
        'Add DiamondLoupe facet to enable diamond introspection'
      ));
    }

    // DiamondCut requirement
    if (config.requireDiamondCut !== false && !analysis.diamondCutPresent) {
      issues.push(this.createIssue(
        'missing-diamond-cut',
        'Missing DiamondCut Facet',
        'DiamondCut facet is not present',
        SeverityLevel.ERROR,
        'facet',
        'Add DiamondCut facet to enable diamond upgrades'
      ));
    }

    // Ownership requirement
    if (config.requireOwnership !== false && !analysis.ownershipFacetPresent) {
      issues.push(this.createIssue(
        'missing-ownership',
        'Missing Ownership Facet',
        'Ownership facet is not present',
        SeverityLevel.WARNING,
        'facet',
        'Add ownership facet for access control'
      ));
    }

    return issues;
  }

  /**
   * Check structural integrity
   */
  private checkStructuralIntegrity(
    analysis: DiamondStructureAnalysis,
    config: DiamondStructureModuleConfig
  ): VerificationIssue[] {
    const issues: VerificationIssue[] = [];

    // Check for duplicate selectors
    if (analysis.duplicateSelectors.length > 0) {
      issues.push(this.createIssue(
        'duplicate-selectors',
        'Duplicate Function Selectors',
        `Found ${analysis.duplicateSelectors.length} duplicate function selectors`,
        SeverityLevel.CRITICAL,
        'collision',
        'Remove duplicate selectors to prevent unpredictable behavior',
        { duplicateSelectors: analysis.duplicateSelectors }
      ));
    }

    // Check for zero address facets
    if (!config.allowZeroAddressFacets && analysis.zeroAddressFacets.length > 0) {
      issues.push(this.createIssue(
        'zero-address-facets',
        'Zero Address Facets',
        `Found ${analysis.zeroAddressFacets.length} selectors pointing to zero address`,
        SeverityLevel.ERROR,
        'structure',
        'Remove or replace selectors pointing to zero address',
        { zeroAddressSelectors: analysis.zeroAddressFacets }
      ));
    }

    return issues;
  }

  /**
   * Verify protocol version
   */
  private async verifyProtocolVersion(
    context: VerificationContext,
    actualVersion: string
  ): Promise<VerificationIssue[]> {
    const issues: VerificationIssue[] = [];

    try {
      // Load expected version from diamond config
      const diamondConfig = JSON.parse(fs.readFileSync(context.diamond.configPath, 'utf8'));
      const expectedVersion = diamondConfig.protocolVersion;

      if (expectedVersion && actualVersion !== expectedVersion.toString()) {
        issues.push(this.createIssue(
          'protocol-version-mismatch',
          'Protocol Version Mismatch',
          `Expected protocol version ${expectedVersion}, but found ${actualVersion}`,
          SeverityLevel.WARNING,
          'version',
          'Update diamond configuration or upgrade to correct protocol version',
          { expected: expectedVersion, actual: actualVersion }
        ));
      }
    } catch (error) {
      issues.push(this.createIssue(
        'protocol-version-check-failed',
        'Protocol Version Check Failed',
        `Could not verify protocol version: ${(error as Error).message}`,
        SeverityLevel.INFO,
        'version'
      ));
    }

    return issues;
  }

  /**
   * Test core functionality
   */
  private async testCoreFunctionality(
    context: VerificationContext,
    analysis: DiamondStructureAnalysis
  ): Promise<VerificationIssue[]> {
    const issues: VerificationIssue[] = [];
    const { diamond, provider } = context;

    // Test DiamondLoupe functions if present
    if (analysis.diamondLoupePresent) {
      try {
        const diamondContract = new ethers.Contract(diamond.address, this.diamondABIs.loupe, provider);
        
        // Test facetAddresses
        await diamondContract.facetAddresses();
        
        // Test supportsInterface for ERC165
        try {
          const erc165Contract = new ethers.Contract(diamond.address, this.diamondABIs.erc165, provider);
          const supportsERC165 = await erc165Contract.supportsInterface('0x01ffc9a7');
          
          if (!supportsERC165) {
            issues.push(this.createIssue(
              'erc165-not-supported',
              'ERC165 Not Supported',
              'Diamond does not report ERC165 support',
              SeverityLevel.WARNING,
              'interface',
              'Implement ERC165 support for better interface detection'
            ));
          }
        } catch (error) {
          issues.push(this.createIssue(
            'erc165-test-failed',
            'ERC165 Test Failed',
            'Could not test ERC165 support',
            SeverityLevel.INFO,
            'interface'
          ));
        }
        
      } catch (error) {
        issues.push(this.createIssue(
          'loupe-functionality-failed',
          'DiamondLoupe Functionality Test Failed',
          `DiamondLoupe functions are not working properly: ${(error as Error).message}`,
          SeverityLevel.ERROR,
          'functionality'
        ));
      }
    }

    // Test ownership functions if present
    if (analysis.ownershipFacetPresent) {
      try {
        const ownershipContract = new ethers.Contract(diamond.address, this.diamondABIs.ownership, provider);
        const owner = await ownershipContract.owner();
        
        if (!owner || owner === '0x0000000000000000000000000000000000000000') {
          issues.push(this.createIssue(
            'no-owner-set',
            'No Owner Set',
            'Diamond ownership facet exists but no owner is set',
            SeverityLevel.WARNING,
            'access-control',
            'Set a proper owner address for the diamond'
          ));
        }
      } catch (error) {
        issues.push(this.createIssue(
          'ownership-test-failed',
          'Ownership Test Failed',
          `Could not test ownership functionality: ${(error as Error).message}`,
          SeverityLevel.WARNING,
          'functionality'
        ));
      }
    }

    return issues;
  }

  // Helper methods

  private hasFunctionSelector(facets: FacetInfo[], selector: string): boolean {
    return facets.some(facet => facet.selectors.includes(selector.toLowerCase()));
  }

  private identifyFacetName(address: string, selectors: string[]): string | undefined {
    // Check if this looks like a standard facet based on selectors
    const selectorSet = new Set(selectors.map(s => s.toLowerCase()));
    
    if (selectorSet.has(this.standardSelectors.diamondLoupe.facets)) {
      return 'DiamondLoupeFacet';
    }
    if (selectorSet.has(this.standardSelectors.diamondCut.diamondCut)) {
      return 'DiamondCutFacet';
    }
    if (selectorSet.has(this.standardSelectors.ownership.owner)) {
      return 'OwnershipFacet';
    }
    
    return undefined;
  }

  private async getProtocolVersion(context: VerificationContext): Promise<string | undefined> {
    try {
      const { diamond, provider } = context;
      
      // Try common protocol version function signatures
      const versionSignatures = [
        'function protocolVersion() external view returns (uint256)',
        'function version() external view returns (string)',
        'function getVersion() external view returns (uint256)'
      ];
      
      for (const signature of versionSignatures) {
        try {
          const contract = new ethers.Contract(diamond.address, [signature], provider);
          const version = await contract[signature.split('(')[0].split(' ')[1]]();
          return version.toString();
        } catch {
          continue;
        }
      }
    } catch (error) {
      // Version not available
    }
    
    return undefined;
  }
}
