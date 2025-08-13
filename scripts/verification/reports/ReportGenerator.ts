/**
 * Report generation system for verification results
 * 
 * Handles the creation and formatting of verification reports.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  VerificationReport,
  ReportFormatter,
  ReportFormat,
  SeverityLevel,
  VerificationStatus
} from '../core/types';

// Import formatters
import { ConsoleFormatter } from './formatters/ConsoleFormatter';
import { JSONFormatter } from './formatters/JSONFormatter';
import { MarkdownFormatter } from './formatters/MarkdownFormatter';

/**
 * Main report generator that coordinates different formatters
 */
export class ReportGenerator {
  private formatters: Map<ReportFormat, ReportFormatter> = new Map();

  constructor() {
    // Register default formatters
    this.registerFormatter(ReportFormat.CONSOLE, new ConsoleFormatter());
    this.registerFormatter(ReportFormat.JSON, new JSONFormatter());
    this.registerFormatter(ReportFormat.MARKDOWN, new MarkdownFormatter());
  }

  /**
   * Register a custom formatter
   */
  public registerFormatter(format: ReportFormat, formatter: ReportFormatter): void {
    this.formatters.set(format, formatter);
  }

  /**
   * Generate report in specified format
   */
  public generateReport(report: VerificationReport, format: ReportFormat): string | Buffer {
    const formatter = this.formatters.get(format);
    if (!formatter) {
      throw new Error(`No formatter registered for format: ${format}`);
    }

    return formatter.format(report);
  }

  /**
   * Save report to file
   */
  public async saveReport(
    report: VerificationReport,
    format: ReportFormat,
    outputPath: string
  ): Promise<void> {
    const formattedReport = this.generateReport(report, format);
    
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    if (Buffer.isBuffer(formattedReport)) {
      fs.writeFileSync(outputPath, formattedReport);
    } else {
      fs.writeFileSync(outputPath, formattedReport, 'utf8');
    }
  }

  /**
   * Generate and save multiple report formats
   */
  public async generateMultipleReports(
    report: VerificationReport,
    outputs: Record<ReportFormat, string>
  ): Promise<void> {
    const promises = Object.entries(outputs).map(([formatStr, outputPath]) => {
      const format = formatStr as ReportFormat;
      return this.saveReport(report, format, outputPath);
    });

    await Promise.all(promises);
  }
}
