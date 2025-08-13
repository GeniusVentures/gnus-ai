/**
 * Main Diamond Verification System
 * 
 * Orchestrates verification modules and manages the overall verification process.
 */

import { Provider } from 'ethers';
import chalk from 'chalk';
import {
  VerificationModule,
  VerificationConfig,
  VerificationReport,
  VerificationContext,
  VerificationStatus,
  ModuleResult,
  DiamondInfo,
  NetworkInfo,
  VerificationEvent,
  VerificationEventListener,
  SeverityLevel
} from './types';

/**
 * Main orchestration engine for diamond verification
 */
export class DiamondVerificationSystem {
  private modules: Map<string, VerificationModule> = new Map();
  private eventListeners: VerificationEventListener[] = [];
  private readonly version = '1.0.0';

  /**
   * Register a verification module
   */
  public registerModule(module: VerificationModule): void {
    if (this.modules.has(module.id)) {
      throw new Error(`Module with ID '${module.id}' is already registered`);
    }

    this.modules.set(module.id, module);
    console.log(chalk.green(`✓ Registered verification module: ${module.name} (${module.id})`));
  }

  /**
   * Unregister a verification module
   */
  public unregisterModule(moduleId: string): void {
    if (!this.modules.has(moduleId)) {
      throw new Error(`Module with ID '${moduleId}' is not registered`);
    }

    this.modules.delete(moduleId);
    console.log(chalk.yellow(`⚠ Unregistered verification module: ${moduleId}`));
  }

  /**
   * List all registered modules
   */
  public listModules(): VerificationModule[] {
    return Array.from(this.modules.values());
  }

  /**
   * Get a specific module by ID
   */
  public getModule(moduleId: string): VerificationModule | undefined {
    return this.modules.get(moduleId);
  }

  /**
   * Add event listener
   */
  public addEventListener(listener: VerificationEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  public removeEventListener(listener: VerificationEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Run verification with specified configuration
   */
  public async runVerification(
    diamond: DiamondInfo,
    provider: Provider,
    config: VerificationConfig,
    moduleIds?: string[]
  ): Promise<VerificationReport> {
    const startTime = new Date();
    
    console.log(chalk.blue('🔍 Starting Diamond Verification System'));
    console.log(chalk.blue(`📍 Diamond: ${diamond.name} (${diamond.address})`));
    console.log(chalk.blue(`🌐 Network: ${diamond.network.name} (Chain ID: ${diamond.network.chainId})`));
    
    // Determine which modules to run
    const modulesToRun = this.getModulesToRun(moduleIds, config);
    
    if (modulesToRun.length === 0) {
      console.log(chalk.yellow('⚠️  No verification modules to run'));
      return this.createEmptyReport(diamond, startTime);
    }

    console.log(chalk.blue(`🧪 Running ${modulesToRun.length} verification module(s):`));
    modulesToRun.forEach((module, index) => {
      console.log(chalk.blue(`   ${index + 1}. ${module.name} (${module.id})`));
    });

    // Create verification context
    const context: VerificationContext = {
      diamond,
      provider,
      config,
      moduleConfig: config.modules,
      startTime,
      verbose: process.env.VERBOSE === 'true' || false,
      dryRun: process.env.DRY_RUN === 'true' || false
    };

    // Validate module configurations
    await this.validateModuleConfigurations(modulesToRun, context);

    // Execute verification modules
    const moduleResults = await this.executeModules(modulesToRun, context);

    // Generate final report
    const endTime = new Date();
    const report = this.generateReport(diamond, moduleResults, startTime, endTime, config);

    this.emitEvent({
      type: 'verification_complete',
      timestamp: new Date(),
      data: { 
        diamond: diamond.name,
        status: report.summary.overallStatus,
        duration: report.metadata.duration
      }
    });

    // Print summary
    this.printSummary(report);

    return report;
  }

  /**
   * Validate configurations for all modules to be run
   */
  private async validateModuleConfigurations(
    modules: VerificationModule[],
    context: VerificationContext
  ): Promise<void> {
    console.log(chalk.blue('\n📋 Validating module configurations...'));

    for (const module of modules) {
      const moduleConfig = context.moduleConfig[module.id] || {};
      const validation = module.validateConfig(moduleConfig);

      if (!validation.isValid) {
        console.error(chalk.red(`❌ Configuration validation failed for module '${module.id}':`));
        validation.errors.forEach(error => {
          console.error(chalk.red(`   • ${error}`));
        });
        throw new Error(`Configuration validation failed for module '${module.id}'`);
      }

      if (validation.warnings.length > 0) {
        console.warn(chalk.yellow(`⚠️  Configuration warnings for module '${module.id}':`));
        validation.warnings.forEach(warning => {
          console.warn(chalk.yellow(`   • ${warning}`));
        });
      }

      // Check if module can verify this diamond
      if (!await module.canVerify(context.diamond, context.diamond.network)) {
        throw new Error(`Module '${module.id}' cannot verify diamond '${context.diamond.name}' on network '${context.diamond.network.name}'`);
      }
    }

    console.log(chalk.green('✅ All module configurations validated'));
  }

  /**
   * Execute verification modules
   */
  private async executeModules(
    modules: VerificationModule[],
    context: VerificationContext
  ): Promise<ModuleResult[]> {
    console.log(chalk.blue('\n🚀 Executing verification modules...\n'));

    const results: ModuleResult[] = [];
    
    if (context.config.execution.parallelExecution) {
      // Parallel execution
      const maxConcurrency = Math.min(
        modules.length, 
        context.config.execution.maxConcurrency
      );
      
      console.log(chalk.blue(`⚡ Running ${modules.length} modules in parallel (max concurrency: ${maxConcurrency})`));
      
      const chunks = this.chunkArray(modules, maxConcurrency);
      
      for (const chunk of chunks) {
        const promises = chunk.map(module => this.executeModule(module, context));
        const chunkResults = await Promise.allSettled(promises);
        
        for (let i = 0; i < chunkResults.length; i++) {
          const result = chunkResults[i];
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            // Handle failed module execution
            const module = chunk[i];
            results.push(this.createErrorResult(module, result.reason, context));
          }
        }

        // Fail fast if configured
        if (context.config.execution.failFast && results.some(r => r.status === VerificationStatus.FAIL)) {
          break;
        }
      }
    } else {
      // Sequential execution
      console.log(chalk.blue(`🔄 Running ${modules.length} modules sequentially`));
      
      for (const module of modules) {
        try {
          const result = await this.executeModule(module, context);
          results.push(result);

          // Fail fast if configured
          if (context.config.execution.failFast && result.status === VerificationStatus.FAIL) {
            console.log(chalk.red('🛑 Stopping execution due to fail-fast configuration'));
            break;
          }
        } catch (error) {
          const result = this.createErrorResult(module, error as Error, context);
          results.push(result);

          // Fail fast if configured
          if (context.config.execution.failFast) {
            console.log(chalk.red('🛑 Stopping execution due to fail-fast configuration'));
            break;
          }
        }
      }
    }

    return results;
  }

  /**
   * Execute a single verification module
   */
  private async executeModule(
    module: VerificationModule,
    context: VerificationContext
  ): Promise<ModuleResult> {
    const startTime = new Date();
    
    console.log(chalk.cyan(`⏳ Running module: ${module.name}...`));
    
    this.emitEvent({
      type: 'module_start',
      timestamp: startTime,
      moduleId: module.id,
      data: { moduleName: module.name }
    });

    try {
      // Execute with timeout
      const timeoutMs = context.config.execution.timeoutMs;
      const verificationResult = await this.withTimeout(
        module.verify(context),
        timeoutMs,
        `Module '${module.id}' timed out after ${timeoutMs}ms`
      );

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Determine overall status based on issues
      let status = VerificationStatus.PASS;
      const hasErrors = verificationResult.issues.some(
        issue => issue.severity === SeverityLevel.ERROR || issue.severity === SeverityLevel.CRITICAL
      );
      const hasWarnings = verificationResult.issues.some(
        issue => issue.severity === SeverityLevel.WARNING
      );

      if (hasErrors) {
        status = VerificationStatus.FAIL;
      } else if (hasWarnings) {
        status = VerificationStatus.WARNING;
      }

      const result: ModuleResult = {
        moduleId: module.id,
        moduleName: module.name,
        status,
        result: verificationResult,
        startTime,
        endTime,
        duration
      };

      // Log result
      const statusColor = status === VerificationStatus.PASS ? 'green' : 
                         status === VerificationStatus.WARNING ? 'yellow' : 'red';
      const statusSymbol = status === VerificationStatus.PASS ? '✅' : 
                          status === VerificationStatus.WARNING ? '⚠️' : '❌';
      
      console.log(chalk[statusColor](`${statusSymbol} Module '${module.name}' completed: ${status} (${duration}ms)`));
      
      if (verificationResult.issues.length > 0) {
        const errorCount = verificationResult.issues.filter(i => i.severity === SeverityLevel.ERROR || i.severity === SeverityLevel.CRITICAL).length;
        const warningCount = verificationResult.issues.filter(i => i.severity === SeverityLevel.WARNING).length;
        
        if (errorCount > 0) {
          console.log(chalk.red(`   • ${errorCount} error(s) found`));
        }
        if (warningCount > 0) {
          console.log(chalk.yellow(`   • ${warningCount} warning(s) found`));
        }
      }

      this.emitEvent({
        type: 'module_complete',
        timestamp: new Date(),
        moduleId: module.id,
        data: { 
          moduleName: module.name,
          status,
          duration,
          issueCount: verificationResult.issues.length
        }
      });

      // Cleanup if needed
      if (module.cleanup) {
        try {
          await module.cleanup(context);
        } catch (cleanupError) {
          console.warn(chalk.yellow(`⚠️  Cleanup failed for module '${module.id}': ${(cleanupError as Error).message}`));
        }
      }

      return result;

    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.error(chalk.red(`❌ Module '${module.name}' failed: ${(error as Error).message}`));

      this.emitEvent({
        type: 'module_error',
        timestamp: new Date(),
        moduleId: module.id,
        data: { 
          moduleName: module.name,
          error: (error as Error).message,
          duration
        }
      });

      return this.createErrorResult(module, error as Error, context);
    }
  }

  /**
   * Create an error result for a failed module
   */
  private createErrorResult(
    module: VerificationModule,
    error: Error,
    context: VerificationContext
  ): ModuleResult {
    const now = new Date();
    return {
      moduleId: module.id,
      moduleName: module.name,
      status: VerificationStatus.FAIL,
      result: {
        moduleId: module.id,
        status: VerificationStatus.FAIL,
        executionTime: 0,
        issues: [{
          id: `${module.id}:execution_error`,
          title: 'Module Execution Error',
          description: `Module failed to execute: ${error.message}`,
          severity: SeverityLevel.CRITICAL,
          category: 'system'
        }],
        metadata: { error: error.message },
        summary: {
          totalChecks: 0,
          passed: 0,
          failed: 1,
          warnings: 0,
          skipped: 0
        }
      },
      startTime: now,
      endTime: now,
      duration: 0,
      error
    };
  }

  /**
   * Generate the final verification report
   */
  private generateReport(
    diamond: DiamondInfo,
    moduleResults: ModuleResult[],
    startTime: Date,
    endTime: Date,
    config: VerificationConfig
  ): VerificationReport {
    const duration = endTime.getTime() - startTime.getTime();

    // Calculate summary statistics
    const summary = {
      totalChecks: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      critical: 0,
      skipped: 0,
      overallStatus: VerificationStatus.PASS as VerificationStatus
    };

    for (const moduleResult of moduleResults) {
      summary.totalChecks += moduleResult.result.summary.totalChecks;
      summary.passed += moduleResult.result.summary.passed;
      summary.failed += moduleResult.result.summary.failed;
      summary.warnings += moduleResult.result.summary.warnings;
      summary.skipped += moduleResult.result.summary.skipped;

      // Count critical issues
      const criticalCount = moduleResult.result.issues.filter(
        issue => issue.severity === SeverityLevel.CRITICAL
      ).length;
      summary.critical += criticalCount;
    }

    // Determine overall status
    if (summary.critical > 0 || summary.failed > 0) {
      summary.overallStatus = VerificationStatus.FAIL;
    } else if (summary.warnings > 0) {
      summary.overallStatus = VerificationStatus.WARNING;
    }

    return {
      metadata: {
        timestamp: startTime,
        duration,
        diamond,
        networks: [diamond.network],
        modules: moduleResults.map(r => r.moduleId),
        version: this.version
      },
      summary,
      moduleResults,
      recommendations: this.generateRecommendations(moduleResults),
      artifacts: {
        configSnapshot: config,
        networkStates: {},
        errorLogs: moduleResults
          .filter(r => r.error)
          .map(r => `[${r.moduleId}] ${r.error!.message}`)
      }
    };
  }

  /**
   * Generate recommendations based on verification results
   */
  private generateRecommendations(moduleResults: ModuleResult[]): any[] {
    // TODO: Implement intelligent recommendation generation
    return [];
  }

  /**
   * Print verification summary to console
   */
  private printSummary(report: VerificationReport): void {
    console.log(chalk.blue('\n📊 Verification Summary'));
    console.log(chalk.blue('═'.repeat(50)));
    
    const { summary } = report;
    const statusColor = summary.overallStatus === VerificationStatus.PASS ? 'green' : 
                       summary.overallStatus === VerificationStatus.WARNING ? 'yellow' : 'red';
    
    console.log(chalk[statusColor](`Overall Status: ${summary.overallStatus}`));
    console.log(`Duration: ${report.metadata.duration}ms`);
    console.log(`Modules Run: ${report.metadata.modules.length}`);
    console.log(`Total Checks: ${summary.totalChecks}`);
    console.log(chalk.green(`✅ Passed: ${summary.passed}`));
    console.log(chalk.yellow(`⚠️  Warnings: ${summary.warnings}`));
    console.log(chalk.red(`❌ Failed: ${summary.failed}`));
    console.log(chalk.red(`🚨 Critical: ${summary.critical}`));
    
    if (summary.skipped > 0) {
      console.log(chalk.gray(`⏭️  Skipped: ${summary.skipped}`));
    }
  }

  /**
   * Emit verification event to all listeners
   */
  private emitEvent(event: VerificationEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener.onEvent(event);
      } catch (error) {
        console.error(chalk.red(`Error in event listener: ${(error as Error).message}`));
      }
    }
  }

  /**
   * Determine which modules to run based on configuration
   */
  private getModulesToRun(moduleIds?: string[], config?: VerificationConfig): VerificationModule[] {
    let modulesToRun: VerificationModule[] = [];

    if (moduleIds && moduleIds.length > 0) {
      // Use explicitly specified modules
      for (const moduleId of moduleIds) {
        const module = this.modules.get(moduleId);
        if (!module) {
          throw new Error(`Module '${moduleId}' is not registered`);
        }
        modulesToRun.push(module);
      }
    } else if (config) {
      // Use modules from configuration
      for (const [moduleId, moduleConfig] of Object.entries(config.modules)) {
        if (moduleConfig.enabled) {
          const module = this.modules.get(moduleId);
          if (module) {
            modulesToRun.push(module);
          } else {
            console.warn(chalk.yellow(`⚠️  Module '${moduleId}' is enabled in configuration but not registered`));
          }
        }
      }
      
      // Sort by priority
      modulesToRun.sort((a, b) => {
        const priorityA = config.modules[a.id]?.priority || 0;
        const priorityB = config.modules[b.id]?.priority || 0;
        return priorityA - priorityB;
      });
    } else {
      // Run all registered modules
      modulesToRun = Array.from(this.modules.values());
    }

    return modulesToRun;
  }

  /**
   * Create empty report when no modules to run
   */
  private createEmptyReport(diamond: DiamondInfo, startTime: Date): VerificationReport {
    const endTime = new Date();
    return {
      metadata: {
        timestamp: startTime,
        duration: endTime.getTime() - startTime.getTime(),
        diamond,
        networks: [diamond.network],
        modules: [],
        version: this.version
      },
      summary: {
        totalChecks: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
        critical: 0,
        skipped: 0,
        overallStatus: VerificationStatus.PASS
      },
      moduleResults: [],
      recommendations: [],
      artifacts: {
        configSnapshot: {} as VerificationConfig,
        networkStates: {},
        errorLogs: []
      }
    };
  }

  /**
   * Helper method to create timeout promise
   */
  private withTimeout<T>(promise: Promise<T>, ms: number, message?: string): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(message || `Operation timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]);
  }

  /**
   * Helper method to chunk arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
