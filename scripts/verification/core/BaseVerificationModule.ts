/**
 * Base implementation for verification modules
 * 
 * Provides common functionality and utilities that all verification modules can use.
 */

import { 
  VerificationModule,
  VerificationContext,
  VerificationResult,
  VerificationStatus,
  VerificationIssue,
  SeverityLevel,
  ConfigRequirement,
  ValidationResult,
  DiamondInfo,
  NetworkInfo
} from './types';

/**
 * Abstract base class for verification modules
 * 
 * This class provides common functionality and utilities that verification modules
 * can extend to reduce boilerplate and ensure consistent behavior.
 */
export abstract class BaseVerificationModule implements VerificationModule {
  public abstract readonly id: string;
  public abstract readonly name: string;
  public abstract readonly description: string;
  public abstract readonly version: string;
  public abstract readonly category: string;

  /**
   * Default implementation - modules can verify any diamond
   * Override to add specific compatibility checks
   */
  public async canVerify(diamond: DiamondInfo, network: NetworkInfo): Promise<boolean> {
    return true;
  }

  /**
   * Default implementation - no config requirements
   * Override to specify module-specific configuration needs
   */
  public getRequiredConfig(): ConfigRequirement[] {
    return [];
  }

  /**
   * Default config validation - validates against requirements
   * Override for custom validation logic
   */
  public validateConfig(config: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const requirements = this.getRequiredConfig();
    
    for (const requirement of requirements) {
      const value = config[requirement.key];
      
      // Check required fields
      if (requirement.required && (value === undefined || value === null)) {
        result.errors.push(`Required configuration '${requirement.key}' is missing`);
        result.isValid = false;
        continue;
      }

      // Skip validation if field is not present and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      if (!this.validateType(value, requirement.type)) {
        result.errors.push(
          `Configuration '${requirement.key}' must be of type ${requirement.type}, got ${typeof value}`
        );
        result.isValid = false;
        continue;
      }

      // Custom validation
      if (requirement.validation && !requirement.validation(value)) {
        result.errors.push(
          `Configuration '${requirement.key}' failed validation: ${requirement.description}`
        );
        result.isValid = false;
      }
    }

    return result;
  }

  /**
   * Abstract method that must be implemented by subclasses
   */
  public abstract verify(context: VerificationContext): Promise<VerificationResult>;

  /**
   * Default cleanup - no action required
   * Override if module needs cleanup
   */
  public async cleanup(context: VerificationContext): Promise<void> {
    // Default: no cleanup needed
  }

  /**
   * Helper method to create verification results
   */
  protected createResult(
    status: VerificationStatus,
    issues: VerificationIssue[],
    executionTime: number,
    metadata: Record<string, any> = {}
  ): VerificationResult {
    const summary = {
      totalChecks: issues.length,
      passed: issues.filter(i => i.severity === SeverityLevel.INFO).length,
      failed: issues.filter(i => i.severity === SeverityLevel.ERROR || i.severity === SeverityLevel.CRITICAL).length,
      warnings: issues.filter(i => i.severity === SeverityLevel.WARNING).length,
      skipped: 0
    };

    return {
      moduleId: this.id,
      status,
      executionTime,
      issues,
      metadata,
      summary
    };
  }

  /**
   * Helper method to create verification issues
   */
  protected createIssue(
    id: string,
    title: string,
    description: string,
    severity: SeverityLevel,
    category: string,
    recommendation?: string,
    metadata?: Record<string, any>,
    location?: { contract?: string; function?: string; line?: number }
  ): VerificationIssue {
    return {
      id: `${this.id}:${id}`,
      title,
      description,
      severity,
      category,
      recommendation,
      metadata,
      location
    };
  }

  /**
   * Helper method for logging with module context
   */
  protected log(context: VerificationContext, level: 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    if (context.verbose || level !== 'info') {
      const prefix = `[${this.id}]`;
      switch (level) {
        case 'info':
          console.log(prefix, message, ...args);
          break;
        case 'warn':
          console.warn(prefix, message, ...args);
          break;
        case 'error':
          console.error(prefix, message, ...args);
          break;
      }
    }
  }

  /**
   * Helper method to measure execution time
   */
  protected async measureTime<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      return { result, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Helper method to validate configuration types
   */
  private validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return false;
    }
  }

  /**
   * Helper method to get module configuration from context
   */
  protected getModuleConfig<T = any>(context: VerificationContext): T {
    return context.moduleConfig[this.id] || {};
  }

  /**
   * Helper method to check if dry run mode is enabled
   */
  protected isDryRun(context: VerificationContext): boolean {
    return context.dryRun === true;
  }

  /**
   * Helper method to format addresses consistently
   */
  protected formatAddress(address: string): string {
    if (!address) return 'N/A';
    return address.toLowerCase().startsWith('0x') ? address : `0x${address}`;
  }

  /**
   * Helper method to format function selectors consistently
   */
  protected formatSelector(selector: string): string {
    if (!selector) return 'N/A';
    return selector.toLowerCase().startsWith('0x') ? selector : `0x${selector}`;
  }

  /**
   * Helper method to format numbers with appropriate precision
   */
  protected formatNumber(value: number | bigint, decimals: number = 2): string {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value.toFixed(decimals);
  }

  /**
   * Helper method to create a timeout promise
   */
  protected createTimeout(ms: number, message?: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(message || `Operation timed out after ${ms}ms`));
      }, ms);
    });
  }

  /**
   * Helper method to execute with timeout
   */
  protected async withTimeout<T>(
    operation: Promise<T>,
    timeoutMs: number,
    timeoutMessage?: string
  ): Promise<T> {
    return Promise.race([
      operation,
      this.createTimeout(timeoutMs, timeoutMessage)
    ]);
  }

  /**
   * Helper method to retry operations
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    delayMs: number = 1000,
    backoffMultiplier: number = 1.5
  ): Promise<T> {
    let attempt = 0;
    let currentDelay = delayMs;

    while (attempt <= maxRetries) {
      try {
        return await operation();
      } catch (error) {
        attempt++;
        
        if (attempt > maxRetries) {
          throw error;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        currentDelay *= backoffMultiplier;
      }
    }

    throw new Error('Unexpected error in retry logic');
  }

  /**
   * Helper method to chunk arrays for batch processing
   */
  protected chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Helper method to deep clone objects
   */
  protected deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}
