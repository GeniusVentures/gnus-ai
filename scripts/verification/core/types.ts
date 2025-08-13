/**
 * Core types and interfaces for the Diamond Verification System
 * 
 * This file defines the fundamental interfaces that all verification modules
 * and the core system must implement.
 */

import { Provider } from 'ethers';

/**
 * Severity levels for verification issues
 */
export enum SeverityLevel {
  INFO = 'info',
  WARNING = 'warning', 
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Overall verification status
 */
export enum VerificationStatus {
  PASS = 'PASS',
  FAIL = 'FAIL', 
  WARNING = 'WARNING',
  SKIPPED = 'SKIPPED'
}

/**
 * Report output formats
 */
export enum ReportFormat {
  CONSOLE = 'console',
  JSON = 'json',
  HTML = 'html',
  MARKDOWN = 'markdown'
}

/**
 * Network information for verification context
 */
export interface NetworkInfo {
  name: string;
  chainId: number;
  rpcUrl: string;
  blockExplorerUrl?: string;
  blockExplorerApiKey?: string;
}

/**
 * Diamond information for verification
 */
export interface DiamondInfo {
  name: string;
  address: string;
  configPath: string;
  deploymentBlock?: number;
  network: NetworkInfo;
}

/**
 * Configuration requirements for verification modules
 */
export interface ConfigRequirement {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  defaultValue?: any;
  validation?: (value: any) => boolean;
}

/**
 * Configuration validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Individual verification issue
 */
export interface VerificationIssue {
  id: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  category: string;
  recommendation?: string;
  metadata?: Record<string, any>;
  location?: {
    contract?: string;
    function?: string;
    line?: number;
  };
}

/**
 * Result from a single verification module
 */
export interface VerificationResult {
  moduleId: string;
  status: VerificationStatus;
  executionTime: number;
  issues: VerificationIssue[];
  metadata: Record<string, any>;
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
}

/**
 * Verification execution context
 */
export interface VerificationContext {
  diamond: DiamondInfo;
  provider: Provider;
  config: VerificationConfig;
  moduleConfig: Record<string, any>;
  startTime: Date;
  verbose: boolean;
  dryRun?: boolean;
}

/**
 * Verification module interface
 */
export interface VerificationModule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly category: string;

  /**
   * Check if this module can verify the given diamond
   */
  canVerify(diamond: DiamondInfo, network: NetworkInfo): Promise<boolean>;

  /**
   * Get configuration requirements for this module
   */
  getRequiredConfig(): ConfigRequirement[];

  /**
   * Validate module-specific configuration
   */
  validateConfig(config: any): ValidationResult;

  /**
   * Execute verification
   */
  verify(context: VerificationContext): Promise<VerificationResult>;

  /**
   * Optional cleanup after verification
   */
  cleanup?(context: VerificationContext): Promise<void>;
}

/**
 * Configuration for individual module
 */
export interface ModuleConfiguration {
  enabled: boolean;
  priority: number;
  config: Record<string, any>;
  skipOnError: boolean;
  timeout: number;
}

/**
 * Main verification system configuration
 */
export interface VerificationConfig {
  diamond: {
    name: string;
    address?: string;
    configPath: string;
  };

  networks: Record<string, NetworkInfo>;
  
  modules: Record<string, ModuleConfiguration>;
  
  reporting: {
    formats: ReportFormat[];
    outputPaths: Record<ReportFormat, string>;
    severityFilter: SeverityLevel;
    includePassedChecks: boolean;
    includeMetadata: boolean;
  };

  execution: {
    parallelExecution: boolean;
    maxConcurrency: number;
    timeoutMs: number;
    retryCount: number;
    retryDelayMs: number;
    failFast: boolean;
  };

  thresholds: {
    errorThreshold: number;
    warningThreshold: number;
    criticalThreshold: number;
  };
}

/**
 * Module execution result with timing information
 */
export interface ModuleResult {
  moduleId: string;
  moduleName: string;
  status: VerificationStatus;
  result: VerificationResult;
  startTime: Date;
  endTime: Date;
  duration: number;
  error?: Error;
}

/**
 * Recommendation for fixing verification issues
 */
export interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  actionItems: string[];
  relatedIssues: string[];
  estimatedEffort?: string;
}

/**
 * Complete verification report
 */
export interface VerificationReport {
  metadata: {
    timestamp: Date;
    duration: number;
    diamond: DiamondInfo;
    networks: NetworkInfo[];
    modules: string[];
    version: string;
  };

  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
    critical: number;
    skipped: number;
    overallStatus: VerificationStatus;
  };

  moduleResults: ModuleResult[];
  
  recommendations: Recommendation[];

  artifacts: {
    configSnapshot: VerificationConfig;
    networkStates: Record<string, any>;
    errorLogs: string[];
    debugLogs?: string[];
  };
}

/**
 * Report formatter interface
 */
export interface ReportFormatter {
  format(report: VerificationReport): string | Buffer;
  getFileExtension(): string;
  supportsInteractivity(): boolean;
}

/**
 * Configuration source types
 */
export enum ConfigurationSource {
  FILE = 'file',
  ENVIRONMENT = 'environment', 
  HARDHAT = 'hardhat',
  DIAMOND_CONFIG = 'diamond_config'
}

/**
 * Multi-network verification configuration
 */
export interface MultiNetworkConfig {
  networks: Record<string, NetworkInfo>;
  defaultNetwork: string;
  verificationRules: VerificationRuleSet;
  crossChainValidation: {
    enabled: boolean;
    baselineNetwork: string;
    tolerances: Record<string, number>;
  };
}

/**
 * Verification rule set for cross-chain validation
 */
export interface VerificationRuleSet {
  protocolVersionMatch: boolean;
  facetAddressConsistency: boolean;
  functionSelectorConsistency: boolean;
  configurationAlignment: boolean;
  customRules: VerificationRule[];
}

/**
 * Custom verification rule
 */
export interface VerificationRule {
  id: string;
  name: string;
  description: string;
  evaluate: (contexts: VerificationContext[]) => Promise<VerificationIssue[]>;
}

/**
 * Event emitted during verification process
 */
export interface VerificationEvent {
  type: 'module_start' | 'module_complete' | 'module_error' | 'verification_complete';
  timestamp: Date;
  moduleId?: string;
  data: Record<string, any>;
}

/**
 * Event listener interface
 */
export interface VerificationEventListener {
  onEvent(event: VerificationEvent): void | Promise<void>;
}
