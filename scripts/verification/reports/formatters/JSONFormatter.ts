/**
 * JSON formatter for verification reports
 * 
 * Formats verification reports as structured JSON for programmatic consumption.
 */

import {
  VerificationReport,
  ReportFormatter
} from '../../core/types';

/**
 * JSON formatter that creates structured JSON output
 */
export class JSONFormatter implements ReportFormatter {
  
  public format(report: VerificationReport): string {
    // Create a clean copy of the report for JSON serialization
    const jsonReport = this.sanitizeForJson(report);
    
    return JSON.stringify(jsonReport, null, 2);
  }

  public getFileExtension(): string {
    return '.json';
  }

  public supportsInteractivity(): boolean {
    return false;
  }

  /**
   * Sanitize the report object for JSON serialization
   * Converts dates, removes functions, etc.
   */
  private sanitizeForJson(report: VerificationReport): any {
    return {
      metadata: {
        timestamp: report.metadata.timestamp.toISOString(),
        duration: report.metadata.duration,
        diamond: {
          name: report.metadata.diamond.name,
          address: report.metadata.diamond.address,
          configPath: report.metadata.diamond.configPath,
          deploymentBlock: report.metadata.diamond.deploymentBlock,
          network: {
            name: report.metadata.diamond.network.name,
            chainId: report.metadata.diamond.network.chainId,
            rpcUrl: report.metadata.diamond.network.rpcUrl,
            blockExplorerUrl: report.metadata.diamond.network.blockExplorerUrl,
            blockExplorerApiKey: report.metadata.diamond.network.blockExplorerApiKey ? '***' : undefined
          }
        },
        networks: report.metadata.networks.map(network => ({
          name: network.name,
          chainId: network.chainId,
          rpcUrl: network.rpcUrl,
          blockExplorerUrl: network.blockExplorerUrl,
          blockExplorerApiKey: network.blockExplorerApiKey ? '***' : undefined
        })),
        modules: report.metadata.modules,
        version: report.metadata.version
      },
      summary: {
        totalChecks: report.summary.totalChecks,
        passed: report.summary.passed,
        failed: report.summary.failed,
        warnings: report.summary.warnings,
        critical: report.summary.critical,
        skipped: report.summary.skipped,
        overallStatus: report.summary.overallStatus
      },
      moduleResults: report.moduleResults.map(moduleResult => ({
        moduleId: moduleResult.moduleId,
        moduleName: moduleResult.moduleName,
        status: moduleResult.status,
        startTime: moduleResult.startTime.toISOString(),
        endTime: moduleResult.endTime.toISOString(),
        duration: moduleResult.duration,
        result: {
          moduleId: moduleResult.result.moduleId,
          status: moduleResult.result.status,
          executionTime: moduleResult.result.executionTime,
          issues: moduleResult.result.issues.map(issue => ({
            id: issue.id,
            title: issue.title,
            description: issue.description,
            severity: issue.severity,
            category: issue.category,
            recommendation: issue.recommendation,
            metadata: issue.metadata,
            location: issue.location
          })),
          metadata: this.sanitizeMetadata(moduleResult.result.metadata),
          summary: {
            totalChecks: moduleResult.result.summary.totalChecks,
            passed: moduleResult.result.summary.passed,
            failed: moduleResult.result.summary.failed,
            warnings: moduleResult.result.summary.warnings,
            skipped: moduleResult.result.summary.skipped
          }
        },
        error: moduleResult.error ? {
          message: moduleResult.error.message,
          stack: moduleResult.error.stack,
          name: moduleResult.error.name
        } : undefined
      })),
      recommendations: report.recommendations.map(recommendation => ({
        id: recommendation.id,
        title: recommendation.title,
        description: recommendation.description,
        priority: recommendation.priority,
        category: recommendation.category,
        actionItems: recommendation.actionItems,
        relatedIssues: recommendation.relatedIssues,
        estimatedEffort: recommendation.estimatedEffort
      })),
      artifacts: {
        configSnapshot: this.sanitizeConfig(report.artifacts.configSnapshot),
        networkStates: report.artifacts.networkStates,
        errorLogs: report.artifacts.errorLogs,
        debugLogs: report.artifacts.debugLogs
      }
    };
  }

  /**
   * Sanitize metadata objects for JSON serialization
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      if (value === null || value === undefined) {
        sanitized[key] = value;
      } else if (value instanceof Date) {
        sanitized[key] = value.toISOString();
      } else if (typeof value === 'function') {
        sanitized[key] = '[Function]';
      } else if (typeof value === 'object') {
        if (Array.isArray(value)) {
          sanitized[key] = value.map(item => 
            typeof item === 'object' ? this.sanitizeMetadata(item) : item
          );
        } else {
          sanitized[key] = this.sanitizeMetadata(value);
        }
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Sanitize configuration object for JSON serialization
   */
  private sanitizeConfig(config: any): any {
    if (!config) return config;
    
    const sanitized = { ...config };
    
    // Remove or mask sensitive information
    if (sanitized.networks) {
      for (const [networkName, networkConfig] of Object.entries(sanitized.networks)) {
        const network = networkConfig as any;
        if (network.blockExplorerApiKey) {
          network.blockExplorerApiKey = '***';
        }
        if (network.rpcUrl && network.rpcUrl.includes('infura') && network.rpcUrl.includes('/')) {
          const urlParts = network.rpcUrl.split('/');
          if (urlParts.length > 3) {
            urlParts[urlParts.length - 1] = '***';
            network.rpcUrl = urlParts.join('/');
          }
        }
      }
    }
    
    return sanitized;
  }
}
