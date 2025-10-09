#!/usr/bin/env node

/**
 * Comprehensive Health Check Script
 * Performs automated health checks on CI/CD, security, dependencies, and performance
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface HealthCheckResult {
	status: 'healthy' | 'warning' | 'error' | 'unknown';
	details: string;
}

interface HealthReport {
	ci: HealthCheckResult;
	security: HealthCheckResult;
	dependencies: HealthCheckResult;
	performance: HealthCheckResult;
}

interface AuditMetadata {
	vulnerabilities?: Record<string, number>;
}

interface AuditResult {
	metadata: AuditMetadata;
}

interface OutdatedPackage {
	name: string;
	current: string;
	latest: string;
	type: string;
}

interface PerformanceAlert {
	id: string;
	message: string;
	severity: string;
	timestamp: string;
}

interface OutdatedData {
	data?: {
		body: OutdatedPackage[];
	};
}

interface PerformanceData {
	dashboard: {
		alerts?: PerformanceAlert[];
	};
}

interface HealthReportOutput {
	timestamp: string;
	results: HealthReport;
	overall: {
		status: string;
		summary: string;
	};
}

class HealthChecker {
	private results: HealthReport;

	constructor() {
		this.results = {
			ci: { status: 'unknown', details: '' },
			security: { status: 'unknown', details: '' },
			dependencies: { status: 'unknown', details: '' },
			performance: { status: 'unknown', details: '' },
		};
	}

	async runChecks(): Promise<HealthReport> {
		console.log('🏥 Running comprehensive health checks...');

		await this.checkCI();
		await this.checkSecurity();
		await this.checkDependencies();
		await this.checkPerformance();

		this.saveReport();
		return this.results;
	}

	private async checkCI(): Promise<void> {
		try {
			// Check if CI workflows exist and are valid
			const workflowsDir = '.github/workflows';
			if (!fs.existsSync(workflowsDir)) {
				throw new Error('No workflows directory found');
			}

			const workflows = fs
				.readdirSync(workflowsDir)
				.filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

			if (workflows.length === 0) {
				throw new Error('No workflow files found');
			}

			// Validate workflow syntax (basic check)
			let validWorkflows = 0;
			workflows.forEach((workflow) => {
				try {
					const content = fs.readFileSync(path.join(workflowsDir, workflow), 'utf8');
					if (content.includes('name:') && content.includes('on:')) {
						validWorkflows++;
					}
				} catch (error) {
					console.warn(`Invalid workflow: ${workflow}`);
				}
			});

			this.results.ci = {
				status: validWorkflows === workflows.length ? 'healthy' : 'warning',
				details: `${validWorkflows}/${workflows.length} workflows valid`,
			};
		} catch (error) {
			this.results.ci = {
				status: 'error',
				details: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	private async checkSecurity(): Promise<void> {
		try {
			// Run basic security checks
			const auditResult = execSync('yarn audit --audit-level moderate --json', {
				encoding: 'utf8',
				timeout: 30000, // 30 second timeout
			});

			const auditData: AuditResult = JSON.parse(auditResult);
			const vulnerabilities = auditData.metadata.vulnerabilities || {};

			const totalVulns = Object.values(vulnerabilities).reduce(
				(sum, count) => sum + count,
				0,
			);

			this.results.security = {
				status: totalVulns === 0 ? 'healthy' : totalVulns < 5 ? 'warning' : 'error',
				details: `${totalVulns} vulnerabilities found`,
			};
		} catch (error) {
			this.results.security = {
				status: 'error',
				details: `Security check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			};
		}
	}

	private async checkDependencies(): Promise<void> {
		try {
			// Check for outdated dependencies
			const outdatedResult = execSync('yarn outdated --json', {
				encoding: 'utf8',
				timeout: 30000, // 30 second timeout
			});

			const outdatedData: OutdatedData = JSON.parse(outdatedResult);
			const outdatedCount = outdatedData.data ? outdatedData.data.body.length : 0;

			this.results.dependencies = {
				status: outdatedCount === 0 ? 'healthy' : outdatedCount < 10 ? 'warning' : 'error',
				details: `${outdatedCount} packages outdated`,
			};
		} catch (error) {
			this.results.dependencies = {
				status: 'warning',
				details: `Could not check dependencies: ${error instanceof Error ? error.message : 'Unknown error'}`,
			};
		}
	}

	private async checkPerformance(): Promise<void> {
		try {
			// Check recent CI performance
			const perfFile = 'ci-performance-dashboard.json';
			if (fs.existsSync(perfFile)) {
				const perfData: PerformanceData = JSON.parse(fs.readFileSync(perfFile, 'utf8'));
				const alerts = perfData.dashboard.alerts || [];

				this.results.performance = {
					status: alerts.length === 0 ? 'healthy' : alerts.length < 3 ? 'warning' : 'error',
					details: `${alerts.length} performance alerts`,
				};
			} else {
				this.results.performance = {
					status: 'warning',
					details: 'No performance data available',
				};
			}
		} catch (error) {
			this.results.performance = {
				status: 'error',
				details: `Performance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			};
		}
	}

	private saveReport(): void {
		const report: HealthReportOutput = {
			timestamp: new Date().toISOString(),
			results: this.results,
			overall: this.getOverallStatus(),
		};

		// Ensure reports directory exists
		const reportsDir = './reports';
		if (!fs.existsSync(reportsDir)) {
			fs.mkdirSync(reportsDir, { recursive: true });
		}

		const reportPath = path.join(reportsDir, 'health-report.json');
		fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
		console.log(`📄 Health report saved to ${reportPath}`);
	}

	private getOverallStatus(): { status: string; summary: string } {
		const statuses = Object.values(this.results).map((r) => r.status);
		const priorities: Record<string, number> = {
			error: 3,
			warning: 2,
			healthy: 1,
			unknown: 0,
		};

		const worstStatus = statuses.reduce((worst, current) => {
			return priorities[current] > priorities[worst] ? current : worst;
		}, 'healthy');

		return {
			status: worstStatus,
			summary: `${statuses.filter((s) => s === 'healthy').length}/${statuses.length} checks healthy`,
		};
	}
}

// CLI interface
if (require.main === module) {
	const checker = new HealthChecker();

	checker
		.runChecks()
		.then(() => {
			console.log('✅ Health checks completed successfully');
			process.exit(0);
		})
		.catch((error) => {
			console.error('❌ Health checks failed:', error);
			process.exit(1);
		});
}

export default HealthChecker;
