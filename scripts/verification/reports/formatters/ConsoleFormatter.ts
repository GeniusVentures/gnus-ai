/**
 * Console formatter for verification reports
 * 
 * Formats verification reports for display in the terminal with colors and formatting.
 */

import chalk from 'chalk';
import {
  VerificationReport,
  ReportFormatter,
  SeverityLevel,
  VerificationStatus,
  VerificationIssue,
  ModuleResult
} from '../../core/types';

/**
 * Console formatter that creates colorized terminal output
 */
export class ConsoleFormatter implements ReportFormatter {
  
  public format(report: VerificationReport): string {
    const lines: string[] = [];
    
    // Header
    lines.push(this.formatHeader(report));
    lines.push('');
    
    // Summary
    lines.push(this.formatSummary(report));
    lines.push('');
    
    // Module results
    if (report.moduleResults.length > 0) {
      lines.push(this.formatModuleResults(report));
      lines.push('');
    }
    
    // Issues (if any)
    const allIssues = this.getAllIssues(report);
    if (allIssues.length > 0) {
      lines.push(this.formatIssues(allIssues));
      lines.push('');
    }
    
    // Recommendations (if any)
    if (report.recommendations.length > 0) {
      lines.push(this.formatRecommendations(report));
      lines.push('');
    }
    
    // Footer
    lines.push(this.formatFooter(report));
    
    return lines.join('\n');
  }

  public getFileExtension(): string {
    return '.txt';
  }

  public supportsInteractivity(): boolean {
    return true;
  }

  private formatHeader(report: VerificationReport): string {
    const lines: string[] = [];
    const status = report.summary.overallStatus;
    
    // Title with status color
    const statusColor = this.getStatusColor(status);
    const statusSymbol = this.getStatusSymbol(status);
    
    lines.push(chalk.blue('═'.repeat(80)));
    lines.push(chalk.blue.bold('🔍 DIAMOND VERIFICATION REPORT'));
    lines.push(chalk[statusColor].bold(`${statusSymbol} Overall Status: ${status}`));
    lines.push(chalk.blue('═'.repeat(80)));
    
    // Metadata
    lines.push(chalk.gray(`📅 Timestamp: ${report.metadata.timestamp.toISOString()}`));
    lines.push(chalk.gray(`⏱️  Duration: ${report.metadata.duration}ms`));
    lines.push(chalk.gray(`💎 Diamond: ${report.metadata.diamond.name} (${report.metadata.diamond.address})`));
    lines.push(chalk.gray(`🌐 Network: ${report.metadata.diamond.network.name} (Chain ID: ${report.metadata.diamond.network.chainId})`));
    lines.push(chalk.gray(`🧪 Modules: ${report.metadata.modules.length}`));
    lines.push(chalk.gray(`📊 Version: ${report.metadata.version}`));
    
    return lines.join('\n');
  }

  private formatSummary(report: VerificationReport): string {
    const lines: string[] = [];
    const { summary } = report;
    
    lines.push(chalk.blue.bold('📊 SUMMARY'));
    lines.push(chalk.blue('─'.repeat(40)));
    
    lines.push(`Total Checks: ${summary.totalChecks}`);
    lines.push(chalk.green(`✅ Passed: ${summary.passed}`));
    lines.push(chalk.yellow(`⚠️  Warnings: ${summary.warnings}`));
    lines.push(chalk.red(`❌ Failed: ${summary.failed}`));
    lines.push(chalk.red.bold(`🚨 Critical: ${summary.critical}`));
    
    if (summary.skipped > 0) {
      lines.push(chalk.gray(`⏭️  Skipped: ${summary.skipped}`));
    }
    
    // Success rate
    const totalNonSkipped = summary.totalChecks - summary.skipped;
    if (totalNonSkipped > 0) {
      const successRate = ((summary.passed) / totalNonSkipped * 100).toFixed(1);
      lines.push(`📈 Success Rate: ${successRate}%`);
    }
    
    return lines.join('\n');
  }

  private formatModuleResults(report: VerificationReport): string {
    const lines: string[] = [];
    
    lines.push(chalk.blue.bold('🧪 MODULE RESULTS'));
    lines.push(chalk.blue('─'.repeat(40)));
    
    for (const moduleResult of report.moduleResults) {
      lines.push(this.formatSingleModuleResult(moduleResult));
    }
    
    return lines.join('\n');
  }

  private formatSingleModuleResult(moduleResult: ModuleResult): string {
    const lines: string[] = [];
    const status = moduleResult.status;
    const statusColor = this.getStatusColor(status);
    const statusSymbol = this.getStatusSymbol(status);
    
    // Module header
    lines.push('');
    lines.push(chalk[statusColor](`${statusSymbol} ${moduleResult.moduleName} (${moduleResult.moduleId})`));
    lines.push(chalk.gray(`   Duration: ${moduleResult.duration}ms`));
    
    // Module summary
    const { summary } = moduleResult.result;
    const summaryParts: string[] = [];
    
    if (summary.passed > 0) summaryParts.push(chalk.green(`${summary.passed} passed`));
    if (summary.warnings > 0) summaryParts.push(chalk.yellow(`${summary.warnings} warnings`));
    if (summary.failed > 0) summaryParts.push(chalk.red(`${summary.failed} failed`));
    
    if (summaryParts.length > 0) {
      lines.push(chalk.gray(`   Results: ${summaryParts.join(', ')}`));
    }
    
    // Show critical/error issues inline
    const criticalIssues = moduleResult.result.issues.filter(
      i => i.severity === SeverityLevel.CRITICAL || i.severity === SeverityLevel.ERROR
    );
    
    if (criticalIssues.length > 0 && criticalIssues.length <= 3) {
      for (const issue of criticalIssues.slice(0, 3)) {
        const issueColor = issue.severity === SeverityLevel.CRITICAL ? 'red' : 'red';
        const issueSymbol = issue.severity === SeverityLevel.CRITICAL ? '🚨' : '❌';
        lines.push(chalk[issueColor](`   ${issueSymbol} ${issue.title}`));
      }
    } else if (criticalIssues.length > 3) {
      lines.push(chalk.red(`   🚨 ${criticalIssues.length} critical/error issues found`));
    }
    
    return lines.join('\n');
  }

  private formatIssues(issues: VerificationIssue[]): string {
    if (issues.length === 0) {
      return '';
    }
    
    const lines: string[] = [];
    
    lines.push(chalk.blue.bold('🚨 ISSUES FOUND'));
    lines.push(chalk.blue('─'.repeat(40)));
    
    // Group issues by severity
    const criticalIssues = issues.filter(i => i.severity === SeverityLevel.CRITICAL);
    const errorIssues = issues.filter(i => i.severity === SeverityLevel.ERROR);
    const warningIssues = issues.filter(i => i.severity === SeverityLevel.WARNING);
    const infoIssues = issues.filter(i => i.severity === SeverityLevel.INFO);
    
    // Format each severity group
    if (criticalIssues.length > 0) {
      lines.push('');
      lines.push(chalk.red.bold('🚨 CRITICAL ISSUES'));
      for (const issue of criticalIssues) {
        lines.push(this.formatSingleIssue(issue));
      }
    }
    
    if (errorIssues.length > 0) {
      lines.push('');
      lines.push(chalk.red.bold('❌ ERROR ISSUES'));
      for (const issue of errorIssues) {
        lines.push(this.formatSingleIssue(issue));
      }
    }
    
    if (warningIssues.length > 0) {
      lines.push('');
      lines.push(chalk.yellow.bold('⚠️  WARNING ISSUES'));
      for (const issue of warningIssues) {
        lines.push(this.formatSingleIssue(issue));
      }
    }
    
    if (infoIssues.length > 0) {
      lines.push('');
      lines.push(chalk.blue.bold('ℹ️  INFO ISSUES'));
      for (const issue of infoIssues) {
        lines.push(this.formatSingleIssue(issue));
      }
    }
    
    return lines.join('\n');
  }

  private formatSingleIssue(issue: VerificationIssue): string {
    const lines: string[] = [];
    const severityColor = this.getSeverityColor(issue.severity);
    const severitySymbol = this.getSeveritySymbol(issue.severity);
    
    // Issue title and description
    lines.push('');
    lines.push(chalk[severityColor](`${severitySymbol} ${issue.title}`));
    lines.push(chalk.gray(`   ${issue.description}`));
    
    // Category and ID
    lines.push(chalk.gray(`   Category: ${issue.category} | ID: ${issue.id}`));
    
    // Location if available
    if (issue.location) {
      const locationParts: string[] = [];
      if (issue.location.contract) locationParts.push(`Contract: ${issue.location.contract}`);
      if (issue.location.function) locationParts.push(`Function: ${issue.location.function}`);
      if (issue.location.line) locationParts.push(`Line: ${issue.location.line}`);
      
      if (locationParts.length > 0) {
        lines.push(chalk.gray(`   Location: ${locationParts.join(', ')}`));
      }
    }
    
    // Recommendation if available
    if (issue.recommendation) {
      lines.push(chalk.cyan(`   💡 Recommendation: ${issue.recommendation}`));
    }
    
    // Metadata if available (truncated for console)
    if (issue.metadata && Object.keys(issue.metadata).length > 0) {
      const metadataKeys = Object.keys(issue.metadata).slice(0, 3);
      const metadataSummary = metadataKeys.map(key => `${key}: ${issue.metadata![key]}`).join(', ');
      if (metadataSummary.length < 100) {
        lines.push(chalk.gray(`   Metadata: ${metadataSummary}`));
      } else {
        lines.push(chalk.gray(`   Metadata: ${metadataKeys.length} properties available`));
      }
    }
    
    return lines.join('\n');
  }

  private formatRecommendations(report: VerificationReport): string {
    const lines: string[] = [];
    
    lines.push(chalk.blue.bold('💡 RECOMMENDATIONS'));
    lines.push(chalk.blue('─'.repeat(40)));
    
    for (const recommendation of report.recommendations) {
      lines.push('');
      lines.push(chalk.cyan.bold(`💡 ${recommendation.title}`));
      lines.push(chalk.gray(`   ${recommendation.description}`));
      lines.push(chalk.gray(`   Priority: ${recommendation.priority} | Category: ${recommendation.category}`));
      
      if (recommendation.actionItems.length > 0) {
        lines.push(chalk.gray('   Action Items:'));
        for (const item of recommendation.actionItems) {
          lines.push(chalk.gray(`   • ${item}`));
        }
      }
    }
    
    return lines.join('\n');
  }

  private formatFooter(report: VerificationReport): string {
    const lines: string[] = [];
    const status = report.summary.overallStatus;
    const statusColor = this.getStatusColor(status);
    
    lines.push(chalk.blue('═'.repeat(80)));
    
    // Status-specific footer message
    if (status === VerificationStatus.PASS) {
      lines.push(chalk.green.bold('✅ VERIFICATION COMPLETED SUCCESSFULLY'));
      lines.push(chalk.green('All checks passed. Diamond is operating as expected.'));
    } else if (status === VerificationStatus.WARNING) {
      lines.push(chalk.yellow.bold('⚠️  VERIFICATION COMPLETED WITH WARNINGS'));
      lines.push(chalk.yellow('Some issues were found but diamond should still function.'));
      lines.push(chalk.yellow('Review warnings and consider addressing them.'));
    } else {
      lines.push(chalk.red.bold('❌ VERIFICATION FAILED'));
      lines.push(chalk.red('Critical issues were found that require immediate attention.'));
      lines.push(chalk.red('Diamond may not function correctly until issues are resolved.'));
    }
    
    lines.push(chalk.blue('═'.repeat(80)));
    
    return lines.join('\n');
  }

  private getAllIssues(report: VerificationReport): VerificationIssue[] {
    return report.moduleResults.flatMap(mr => mr.result.issues);
  }

  private getStatusColor(status: VerificationStatus): 'green' | 'yellow' | 'red' | 'gray' {
    switch (status) {
      case VerificationStatus.PASS:
        return 'green';
      case VerificationStatus.WARNING:
        return 'yellow';
      case VerificationStatus.FAIL:
        return 'red';
      case VerificationStatus.SKIPPED:
        return 'gray';
      default:
        return 'gray';
    }
  }

  private getStatusSymbol(status: VerificationStatus): string {
    switch (status) {
      case VerificationStatus.PASS:
        return '✅';
      case VerificationStatus.WARNING:
        return '⚠️';
      case VerificationStatus.FAIL:
        return '❌';
      case VerificationStatus.SKIPPED:
        return '⏭️';
      default:
        return '❓';
    }
  }

  private getSeverityColor(severity: SeverityLevel): 'red' | 'yellow' | 'blue' | 'gray' {
    switch (severity) {
      case SeverityLevel.CRITICAL:
        return 'red';
      case SeverityLevel.ERROR:
        return 'red';
      case SeverityLevel.WARNING:
        return 'yellow';
      case SeverityLevel.INFO:
        return 'blue';
      default:
        return 'gray';
    }
  }

  private getSeveritySymbol(severity: SeverityLevel): string {
    switch (severity) {
      case SeverityLevel.CRITICAL:
        return '🚨';
      case SeverityLevel.ERROR:
        return '❌';
      case SeverityLevel.WARNING:
        return '⚠️';
      case SeverityLevel.INFO:
        return 'ℹ️';
      default:
        return '❓';
    }
  }
}
