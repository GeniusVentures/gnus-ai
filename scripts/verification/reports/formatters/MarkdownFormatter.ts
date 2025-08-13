/**
 * Markdown formatter for verification reports
 * 
 * Formats verification reports as Markdown for documentation and web viewing.
 */

import {
  VerificationReport,
  ReportFormatter,
  SeverityLevel,
  VerificationStatus,
  VerificationIssue,
  ModuleResult
} from '../../core/types';

/**
 * Markdown formatter that creates structured Markdown output
 */
export class MarkdownFormatter implements ReportFormatter {
  
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
    
    // Metadata
    lines.push(this.formatMetadata(report));
    
    return lines.join('\n');
  }

  public getFileExtension(): string {
    return '.md';
  }

  public supportsInteractivity(): boolean {
    return false;
  }

  private formatHeader(report: VerificationReport): string {
    const lines: string[] = [];
    const status = report.summary.overallStatus;
    const statusEmoji = this.getStatusEmoji(status);
    
    lines.push('# 🔍 Diamond Verification Report');
    lines.push('');
    lines.push(`**Status:** ${statusEmoji} ${status}`);
    lines.push(`**Diamond:** ${report.metadata.diamond.name} (\`${report.metadata.diamond.address}\`)`);
    lines.push(`**Network:** ${report.metadata.diamond.network.name} (Chain ID: ${report.metadata.diamond.network.chainId})`);
    lines.push(`**Timestamp:** ${report.metadata.timestamp.toISOString()}`);
    lines.push(`**Duration:** ${report.metadata.duration}ms`);
    lines.push(`**Version:** ${report.metadata.version}`);
    
    return lines.join('\n');
  }

  private formatSummary(report: VerificationReport): string {
    const lines: string[] = [];
    const { summary } = report;
    
    lines.push('## 📊 Summary');
    lines.push('');
    
    // Summary table
    lines.push('| Metric | Count |');
    lines.push('|--------|-------|');
    lines.push(`| Total Checks | ${summary.totalChecks} |`);
    lines.push(`| ✅ Passed | ${summary.passed} |`);
    lines.push(`| ⚠️ Warnings | ${summary.warnings} |`);
    lines.push(`| ❌ Failed | ${summary.failed} |`);
    lines.push(`| 🚨 Critical | ${summary.critical} |`);
    
    if (summary.skipped > 0) {
      lines.push(`| ⏭️ Skipped | ${summary.skipped} |`);
    }
    
    // Success rate
    const totalNonSkipped = summary.totalChecks - summary.skipped;
    if (totalNonSkipped > 0) {
      const successRate = ((summary.passed) / totalNonSkipped * 100).toFixed(1);
      lines.push(`| 📈 Success Rate | ${successRate}% |`);
    }
    
    lines.push('');
    
    // Status badge
    const statusColor = this.getStatusBadgeColor(summary.overallStatus);
    lines.push(`![Status](https://img.shields.io/badge/Status-${summary.overallStatus}-${statusColor})`);
    
    return lines.join('\n');
  }

  private formatModuleResults(report: VerificationReport): string {
    const lines: string[] = [];
    
    lines.push('## 🧪 Module Results');
    lines.push('');
    
    // Module results table
    lines.push('| Module | Status | Duration | Issues |');
    lines.push('|--------|--------|----------|--------|');
    
    for (const moduleResult of report.moduleResults) {
      const statusEmoji = this.getStatusEmoji(moduleResult.status);
      const criticalCount = moduleResult.result.issues.filter(i => i.severity === SeverityLevel.CRITICAL).length;
      const errorCount = moduleResult.result.issues.filter(i => i.severity === SeverityLevel.ERROR).length;
      const warningCount = moduleResult.result.issues.filter(i => i.severity === SeverityLevel.WARNING).length;
      
      const issuesSummary = [];
      if (criticalCount > 0) issuesSummary.push(`🚨 ${criticalCount}`);
      if (errorCount > 0) issuesSummary.push(`❌ ${errorCount}`);
      if (warningCount > 0) issuesSummary.push(`⚠️ ${warningCount}`);
      
      lines.push(`| ${moduleResult.moduleName} | ${statusEmoji} ${moduleResult.status} | ${moduleResult.duration}ms | ${issuesSummary.join(', ') || 'None'} |`);
    }
    
    lines.push('');
    
    // Detailed module results
    for (const moduleResult of report.moduleResults) {
      lines.push(this.formatDetailedModuleResult(moduleResult));
      lines.push('');
    }
    
    return lines.join('\n');
  }

  private formatDetailedModuleResult(moduleResult: ModuleResult): string {
    const lines: string[] = [];
    const statusEmoji = this.getStatusEmoji(moduleResult.status);
    
    lines.push(`### ${statusEmoji} ${moduleResult.moduleName}`);
    lines.push('');
    lines.push(`**Module ID:** \`${moduleResult.moduleId}\``);
    lines.push(`**Status:** ${moduleResult.status}`);
    lines.push(`**Duration:** ${moduleResult.duration}ms`);
    lines.push(`**Execution Time:** ${moduleResult.result.executionTime}ms`);
    
    // Module summary
    const { summary } = moduleResult.result;
    if (summary.totalChecks > 0) {
      lines.push('');
      lines.push('**Results:**');
      lines.push(`- ✅ Passed: ${summary.passed}`);
      lines.push(`- ⚠️ Warnings: ${summary.warnings}`);
      lines.push(`- ❌ Failed: ${summary.failed}`);
      if (summary.skipped > 0) {
        lines.push(`- ⏭️ Skipped: ${summary.skipped}`);
      }
    }
    
    // Show module-specific issues
    if (moduleResult.result.issues.length > 0) {
      lines.push('');
      lines.push('**Issues:**');
      
      const criticalIssues = moduleResult.result.issues.filter(i => i.severity === SeverityLevel.CRITICAL);
      const errorIssues = moduleResult.result.issues.filter(i => i.severity === SeverityLevel.ERROR);
      const warningIssues = moduleResult.result.issues.filter(i => i.severity === SeverityLevel.WARNING);
      
      if (criticalIssues.length > 0) {
        lines.push(`- 🚨 **Critical:** ${criticalIssues.length} issues`);
        for (const issue of criticalIssues.slice(0, 3)) {
          lines.push(`  - ${issue.title}: ${issue.description}`);
        }
        if (criticalIssues.length > 3) {
          lines.push(`  - ... and ${criticalIssues.length - 3} more`);
        }
      }
      
      if (errorIssues.length > 0) {
        lines.push(`- ❌ **Errors:** ${errorIssues.length} issues`);
        for (const issue of errorIssues.slice(0, 2)) {
          lines.push(`  - ${issue.title}: ${issue.description}`);
        }
        if (errorIssues.length > 2) {
          lines.push(`  - ... and ${errorIssues.length - 2} more`);
        }
      }
      
      if (warningIssues.length > 0) {
        lines.push(`- ⚠️ **Warnings:** ${warningIssues.length} issues`);
      }
    }
    
    // Error information if module failed
    if (moduleResult.error) {
      lines.push('');
      lines.push('**Error:**');
      lines.push('```');
      lines.push(moduleResult.error.message);
      lines.push('```');
    }
    
    return lines.join('\n');
  }

  private formatIssues(issues: VerificationIssue[]): string {
    if (issues.length === 0) {
      return '';
    }
    
    const lines: string[] = [];
    
    lines.push('## 🚨 Issues');
    lines.push('');
    
    // Group issues by severity
    const criticalIssues = issues.filter(i => i.severity === SeverityLevel.CRITICAL);
    const errorIssues = issues.filter(i => i.severity === SeverityLevel.ERROR);
    const warningIssues = issues.filter(i => i.severity === SeverityLevel.WARNING);
    const infoIssues = issues.filter(i => i.severity === SeverityLevel.INFO);
    
    if (criticalIssues.length > 0) {
      lines.push('### 🚨 Critical Issues');
      lines.push('');
      for (const issue of criticalIssues) {
        lines.push(this.formatSingleIssue(issue));
        lines.push('');
      }
    }
    
    if (errorIssues.length > 0) {
      lines.push('### ❌ Error Issues');
      lines.push('');
      for (const issue of errorIssues) {
        lines.push(this.formatSingleIssue(issue));
        lines.push('');
      }
    }
    
    if (warningIssues.length > 0) {
      lines.push('### ⚠️ Warning Issues');
      lines.push('');
      for (const issue of warningIssues) {
        lines.push(this.formatSingleIssue(issue));
        lines.push('');
      }
    }
    
    if (infoIssues.length > 0) {
      lines.push('### ℹ️ Info Issues');
      lines.push('');
      for (const issue of infoIssues) {
        lines.push(this.formatSingleIssue(issue));
        lines.push('');
      }
    }
    
    return lines.join('\n');
  }

  private formatSingleIssue(issue: VerificationIssue): string {
    const lines: string[] = [];
    const severityEmoji = this.getSeverityEmoji(issue.severity);
    
    lines.push(`#### ${severityEmoji} ${issue.title}`);
    lines.push('');
    lines.push(`**Description:** ${issue.description}`);
    lines.push(`**Category:** ${issue.category}`);
    lines.push(`**ID:** \`${issue.id}\``);
    
    if (issue.location) {
      const locationParts: string[] = [];
      if (issue.location.contract) locationParts.push(`Contract: ${issue.location.contract}`);
      if (issue.location.function) locationParts.push(`Function: ${issue.location.function}`);
      if (issue.location.line) locationParts.push(`Line: ${issue.location.line}`);
      
      if (locationParts.length > 0) {
        lines.push(`**Location:** ${locationParts.join(', ')}`);
      }
    }
    
    if (issue.recommendation) {
      lines.push('');
      lines.push(`**💡 Recommendation:** ${issue.recommendation}`);
    }
    
    if (issue.metadata && Object.keys(issue.metadata).length > 0) {
      lines.push('');
      lines.push('**Metadata:**');
      lines.push('```json');
      lines.push(JSON.stringify(issue.metadata, null, 2));
      lines.push('```');
    }
    
    return lines.join('\n');
  }

  private formatRecommendations(report: VerificationReport): string {
    const lines: string[] = [];
    
    lines.push('## 💡 Recommendations');
    lines.push('');
    
    for (const recommendation of report.recommendations) {
      lines.push(`### ${recommendation.title}`);
      lines.push('');
      lines.push(`**Priority:** ${recommendation.priority.toUpperCase()}`);
      lines.push(`**Category:** ${recommendation.category}`);
      lines.push('');
      lines.push(recommendation.description);
      
      if (recommendation.actionItems.length > 0) {
        lines.push('');
        lines.push('**Action Items:**');
        for (const item of recommendation.actionItems) {
          lines.push(`- ${item}`);
        }
      }
      
      if (recommendation.relatedIssues.length > 0) {
        lines.push('');
        lines.push(`**Related Issues:** ${recommendation.relatedIssues.map(id => `\`${id}\``).join(', ')}`);
      }
      
      if (recommendation.estimatedEffort) {
        lines.push('');
        lines.push(`**Estimated Effort:** ${recommendation.estimatedEffort}`);
      }
      
      lines.push('');
    }
    
    return lines.join('\n');
  }

  private formatMetadata(report: VerificationReport): string {
    const lines: string[] = [];
    
    lines.push('## 📋 Metadata');
    lines.push('');
    
    lines.push('### Diamond Information');
    lines.push('');
    lines.push(`- **Name:** ${report.metadata.diamond.name}`);
    lines.push(`- **Address:** \`${report.metadata.diamond.address}\``);
    lines.push(`- **Config Path:** \`${report.metadata.diamond.configPath}\``);
    if (report.metadata.diamond.deploymentBlock) {
      lines.push(`- **Deployment Block:** ${report.metadata.diamond.deploymentBlock}`);
    }
    
    lines.push('');
    lines.push('### Network Information');
    lines.push('');
    lines.push(`- **Name:** ${report.metadata.diamond.network.name}`);
    lines.push(`- **Chain ID:** ${report.metadata.diamond.network.chainId}`);
    lines.push(`- **RPC URL:** \`${this.maskSensitiveInfo(report.metadata.diamond.network.rpcUrl)}\``);
    if (report.metadata.diamond.network.blockExplorerUrl) {
      lines.push(`- **Block Explorer:** ${report.metadata.diamond.network.blockExplorerUrl}`);
    }
    
    lines.push('');
    lines.push('### Verification Details');
    lines.push('');
    lines.push(`- **Modules Run:** ${report.metadata.modules.length}`);
    lines.push(`- **Module List:** ${report.metadata.modules.map(m => `\`${m}\``).join(', ')}`);
    lines.push(`- **Total Duration:** ${report.metadata.duration}ms`);
    lines.push(`- **System Version:** ${report.metadata.version}`);
    
    if (report.artifacts.errorLogs.length > 0) {
      lines.push('');
      lines.push('### Error Logs');
      lines.push('');
      lines.push('```');
      for (const errorLog of report.artifacts.errorLogs) {
        lines.push(errorLog);
      }
      lines.push('```');
    }
    
    return lines.join('\n');
  }

  private getAllIssues(report: VerificationReport): VerificationIssue[] {
    return report.moduleResults.flatMap(mr => mr.result.issues);
  }

  private getStatusEmoji(status: VerificationStatus): string {
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

  private getSeverityEmoji(severity: SeverityLevel): string {
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

  private getStatusBadgeColor(status: VerificationStatus): string {
    switch (status) {
      case VerificationStatus.PASS:
        return 'brightgreen';
      case VerificationStatus.WARNING:
        return 'yellow';
      case VerificationStatus.FAIL:
        return 'red';
      case VerificationStatus.SKIPPED:
        return 'lightgrey';
      default:
        return 'lightgrey';
    }
  }

  private maskSensitiveInfo(text: string): string {
    // Mask API keys and sensitive URLs
    if (text.includes('infura') || text.includes('alchemy')) {
      const parts = text.split('/');
      if (parts.length > 3) {
        parts[parts.length - 1] = '***';
        return parts.join('/');
      }
    }
    return text;
  }
}
