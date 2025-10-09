#!/usr/bin/env node

/**
 * GNUS-DAO Periodic Security Health Checks
 * Runs automated security validations and monitoring checks
 * Integrates with CI/CD pipeline and monitoring systems
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Type definitions
type CheckStatus = 'passed' | 'failed' | 'warning' | 'error';
type LogLevel = 'info' | 'warn' | 'error';
type CheckName =
	| 'dependency-check'
	| 'security-scan'
	| 'contract-audit'
	// | 'access-review'
	| 'diamond-integrity'
	| 'network-security';

interface AuditError extends Error {
	stdout: Buffer;
	stderr: Buffer;
	status: number;
}

interface DiamondFacet {
	name: string;
	selectors?: string[];
	priority?: number;
	versions?: Record<string, unknown>;
}

interface Recommendation {
	priority: 'critical' | 'high' | 'medium' | 'low';
	action: string;
	details: string;
}

interface CheckResult {
	status: CheckStatus;
	details: Record<string, any>;
	recommendations: Recommendation[];
	timestamp: string;
	message?: string;
}

interface HealthCheckOptions {
	force?: boolean;
	verbose?: boolean;
	report?: boolean;
}

interface HealthCheckSummary {
	total: number;
	passed: number;
	failed: number;
	warnings: number;
}

interface HealthAssessment {
	status: 'healthy' | 'warning' | 'unhealthy';
	score: number;
	message: string;
}

interface HealthCheckResults {
	timestamp: string;
	checks: Record<CheckName, CheckResult>;
	summary: HealthCheckSummary;
	recommendations: Recommendation[];
	assessment: HealthAssessment;
}

interface CheckSchedule {
	interval: number;
	enabled: boolean;
}

interface Thresholds {
	criticalVulnerabilities: number;
	highVulnerabilities: number;
	outdatedDependencies: number;
	failedTests: number;
	coverageMinimum: number;
}

interface Notifications {
	onFailure: boolean;
	onWarning: boolean;
	channels: string[];
}

interface HealthCheckConfig {
	schedules: Record<CheckName, CheckSchedule>;
	thresholds: Thresholds;
	notifications: Notifications;
}

interface HealthCheckStatus {
	lastRun: string | null;
	nextRuns: Record<string, string>;
	enabledChecks: string[];
}

class SecurityHealthChecks {
	private checksDir: string;
	private reportsDir: string;
	private config: HealthCheckConfig;

	constructor() {
		this.checksDir = path.join(process.cwd(), 'reports', 'checks');
		this.reportsDir = path.join(process.cwd(), 'reports', 'health-reports');
		this.config = this.loadConfiguration();
	}

	private log(message: string, level: LogLevel = 'info'): void {
		const timestamp = new Date().toISOString();
		const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
		console.log(`${prefix} [${timestamp}] ${message}`);
	}

	/**
	 * Load health check configuration
	 */
	private loadConfiguration(): HealthCheckConfig {
		return {
			schedules: {
				'dependency-check': { interval: 3600000, enabled: true }, // 1 hour
				'security-scan': { interval: 86400000, enabled: true }, // 24 hours
				'contract-audit': { interval: 604800000, enabled: true }, // 7 days
				// 'access-review': { interval: 2592000000, enabled: true }, // 30 days
				'diamond-integrity': { interval: 3600000, enabled: true }, // 1 hour
				'network-security': { interval: 86400000, enabled: true }, // 24 hours
			},
			thresholds: {
				criticalVulnerabilities: 0,
				highVulnerabilities: 5,
				outdatedDependencies: 10,
				failedTests: 0,
				coverageMinimum: 90,
			},
			notifications: {
				onFailure: true,
				onWarning: true,
				channels: ['slack-security', 'email-team'],
			},
		};
	}

	/**
	 * Run all enabled health checks
	 */
	async runAllChecks(options: HealthCheckOptions = {}): Promise<HealthCheckResults> {
		this.log('🏥 Running security health checks');

		const { force = false, verbose = false, report = true } = options;

		const results: HealthCheckResults = {
			timestamp: new Date().toISOString(),
			checks: {} as Record<CheckName, CheckResult>,
			summary: {
				total: 0,
				passed: 0,
				failed: 0,
				warnings: 0,
			},
			recommendations: [],
			assessment: {
				status: 'healthy',
				score: 100,
				message: '',
			},
		};

		// Run each enabled check
		for (const [checkName, config] of Object.entries(this.config.schedules)) {
			if (config.enabled || force) {
				if (this.shouldRunCheck(checkName as CheckName, config) || force) {
					this.log(`🔍 Running check: ${checkName}`);
					try {
						const checkResult = await this.runCheck(checkName as CheckName, { verbose });
						results.checks[checkName as CheckName] = checkResult;

						// Update summary
						results.summary.total++;
						if (checkResult.status === 'passed') {
							results.summary.passed++;
						} else if (checkResult.status === 'failed') {
							results.summary.failed++;
						} else if (checkResult.status === 'warning') {
							results.summary.warnings++;
						}

						// Add recommendations
						if (checkResult.recommendations) {
							results.recommendations.push(...checkResult.recommendations);
						}
					} catch (error) {
						this.log(
							`Error running check ${checkName}: ${(error as Error).message}`,
							'error',
						);
						results.checks[checkName as CheckName] = {
							status: 'error',
							details: {},
							recommendations: [],
							timestamp: new Date().toISOString(),
							message: (error as Error).message,
						};
						results.summary.failed++;
					}
				}
			}
		}

		// Generate overall assessment
		results.assessment = this.generateAssessment(results);

		// Save report if requested
		if (report) {
			await this.saveHealthReport(results);
		}

		// Send notifications if needed
		await this.handleNotifications(results);

		this.log(
			`✅ Health checks completed: ${results.summary.passed}/${results.summary.total} passed`,
		);
		return results;
	}

	/**
	 * Check if a health check should run based on schedule
	 */
	private shouldRunCheck(checkName: CheckName, config: CheckSchedule): boolean {
		try {
			const lastRunFile = path.join(this.checksDir, `${checkName}-last-run.txt`);
			if (!fs.existsSync(lastRunFile)) {
				return true; // Never run before
			}

			const lastRun = parseInt(fs.readFileSync(lastRunFile, 'utf8'));
			const now = Date.now();
			const timeSinceLastRun = now - lastRun;

			return timeSinceLastRun >= config.interval;
		} catch {
			return true; // Error checking, run anyway
		}
	}

	/**
	 * Run a specific health check
	 */
	async runCheck(
		checkName: CheckName,
		options: HealthCheckOptions = {},
	): Promise<CheckResult> {
		const checkMethods: Record<
			CheckName,
			(options?: HealthCheckOptions) => Promise<CheckResult>
		> = {
			'dependency-check': this.checkDependencies.bind(this),
			'security-scan': this.checkSecurityScan.bind(this),
			'contract-audit': this.checkContractAudit.bind(this),
			// 'access-review': this.checkAccessReview.bind(this),
			'diamond-integrity': this.checkDiamondIntegrity.bind(this),
			'network-security': this.checkNetworkSecurity.bind(this),
		};

		if (!checkMethods[checkName]) {
			throw new Error(`Unknown check: ${checkName}`);
		}

		const result = await checkMethods[checkName](options);

		// Update last run timestamp
		this.updateLastRunTimestamp(checkName);

		return result;
	}

	/**
	 * Check dependencies for vulnerabilities and updates
	 */
	private async checkDependencies(options: HealthCheckOptions = {}): Promise<CheckResult> {
		this.log('📦 Checking dependencies');

		const result: CheckResult = {
			status: 'passed',
			details: {},
			recommendations: [],
			timestamp: new Date().toISOString(),
		};

		try {
			// Check for outdated packages
			const outdatedOutput = execSync('yarn outdated --json', {
				encoding: 'utf8',
			});
			const outdated = JSON.parse(outdatedOutput);

			result.details.outdated = outdated.length;
			if (outdated.length > this.config.thresholds.outdatedDependencies) {
				result.status = 'warning';
				result.recommendations.push({
					priority: 'medium',
					action: 'Update outdated dependencies',
					details: `${outdated.length} packages need updates`,
				});
			}

			// Check for vulnerabilities
			try {
				execSync('yarn audit --json', { stdio: 'pipe' });
				result.details.vulnerabilities = 0;
			} catch (auditError: any) {
				const auditOutput = auditError.stdout.toString();
				const vulnerabilities = (auditOutput.match(/severity: (critical|high)/g) || [])
					.length;

				result.details.vulnerabilities = vulnerabilities;

				if (vulnerabilities > this.config.thresholds.criticalVulnerabilities) {
					result.status = 'failed';
					result.recommendations.push({
						priority: 'critical',
						action: 'Fix security vulnerabilities',
						details: `${vulnerabilities} critical/high vulnerabilities found`,
					});
				} else if (vulnerabilities > 0) {
					result.status = 'warning';
					result.recommendations.push({
						priority: 'high',
						action: 'Review security vulnerabilities',
						details: `${vulnerabilities} vulnerabilities require attention`,
					});
				}
			}
		} catch (error) {
			result.status = 'error';
			result.message = (error as Error).message;
		}

		return result;
	}

	/**
	 * Check security scan results
	 */
	private async checkSecurityScan(options: HealthCheckOptions = {}): Promise<CheckResult> {
		this.log('🔒 Checking security scan results');

		const result: CheckResult = {
			status: 'passed',
			details: {},
			recommendations: [],
			timestamp: new Date().toISOString(),
		};

		try {
			// Run Slither security scan
			const slitherOutput = execSync('yarn security-check', {
				encoding: 'utf8',
				timeout: 300000, // 5 minutes
			});

			// Parse slither results
			const highIssues = (slitherOutput.match(/High/g) || []).length;
			const mediumIssues = (slitherOutput.match(/Medium/g) || []).length;

			result.details.highIssues = highIssues;
			result.details.mediumIssues = mediumIssues;

			if (highIssues > 0) {
				result.status = 'failed';
				result.recommendations.push({
					priority: 'critical',
					action: 'Fix high-severity security issues',
					details: `${highIssues} high-severity issues found by Slither`,
				});
			} else if (mediumIssues > 5) {
				result.status = 'warning';
				result.recommendations.push({
					priority: 'high',
					action: 'Review medium-severity security issues',
					details: `${mediumIssues} medium-severity issues require attention`,
				});
			}
		} catch (error) {
			result.status = 'error';
			result.message = (error as Error).message;
		}

		return result;
	}

	/**
	 * Check contract audit status
	 */
	private async checkContractAudit(options: HealthCheckOptions = {}): Promise<CheckResult> {
		this.log('📋 Checking contract audit status');

		const result: CheckResult = {
			status: 'passed',
			details: {},
			recommendations: [],
			timestamp: new Date().toISOString(),
		};

		try {
			// Check if audit report exists and is recent
			const auditReportPath = path.join(process.cwd(), 'docs', 'audit-report.pdf');
			const auditExists = fs.existsSync(auditReportPath);

			if (auditExists) {
				const stats = fs.statSync(auditReportPath);
				const daysSinceAudit = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

				result.details.daysSinceLastAudit = Math.floor(daysSinceAudit);

				if (daysSinceAudit > 180) {
					// 6 months
					result.status = 'warning';
					result.recommendations.push({
						priority: 'medium',
						action: 'Schedule contract re-audit',
						details: `Last audit was ${Math.floor(daysSinceAudit)} days ago`,
					});
				}
			} else {
				result.status = 'warning';
				result.recommendations.push({
					priority: 'high',
					action: 'Conduct initial contract audit',
					details: 'No audit report found',
				});
			}
		} catch (error) {
			result.status = 'error';
			result.message = (error as Error).message;
		}

		return result;
	}

	/**
	 * Check diamond contract integrity
	 */
	private async checkDiamondIntegrity(
		options: HealthCheckOptions = {},
	): Promise<CheckResult> {
		this.log('💎 Checking diamond integrity');

		const result: CheckResult = {
			status: 'passed',
			details: {},
			recommendations: [],
			timestamp: new Date().toISOString(),
		};

		try {
			// Check diamond configuration
			const diamondConfigPath = path.join(
				process.cwd(),
				'diamonds',
				'GNUSDAODiamond',
				'gnusdaodiamond.config.json',
			);
			if (!fs.existsSync(diamondConfigPath)) {
				result.status = 'failed';
				result.recommendations.push({
					priority: 'critical',
					action: 'Create diamond configuration',
					details: 'Diamond configuration file missing',
				});
				return result;
			}

			const config = JSON.parse(fs.readFileSync(diamondConfigPath, 'utf8'));

			// Check facets
			const facets = config.facets || [];
			result.details.facetCount = facets.length;

			if (facets.length === 0) {
				result.status = 'failed';
				result.recommendations.push({
					priority: 'critical',
					action: 'Configure diamond facets',
					details: 'No facets configured in diamond',
				});
			}

			// Check for orphaned selectors
			const allSelectors = new Set();
			const usedSelectors = new Set();

			facets.forEach((facet: DiamondFacet) => {
				if (facet.selectors) {
					facet.selectors.forEach((selector: string) => {
						allSelectors.add(selector);
					});
				}
			});

			// This is a simplified check - in practice, you'd verify against deployed contract
			result.details.totalSelectors = allSelectors.size;
		} catch (error) {
			result.status = 'error';
			result.message = (error as Error).message;
		}

		return result;
	}

	/**
	 * Check network and deployment security
	 */
	private async checkNetworkSecurity(
		options: HealthCheckOptions = {},
	): Promise<CheckResult> {
		this.log('🌐 Checking network security');

		const result: CheckResult = {
			status: 'passed',
			details: {},
			recommendations: [],
			timestamp: new Date().toISOString(),
		};

		try {
			// Check network configurations
			const networksPath = path.join(process.cwd(), 'config', 'networks');
			const networkFiles = fs.readdirSync(networksPath);

			let insecureConfigs = 0;
			for (const file of networkFiles) {
				if (file.endsWith('.json')) {
					const config = JSON.parse(fs.readFileSync(path.join(networksPath, file), 'utf8'));

					// Check for insecure RPC URLs
					if (config.rpcUrl?.startsWith('http://')) {
						insecureConfigs++;
					}

					// Check for missing private key encryption
					if (config.privateKey && !config.encrypted) {
						insecureConfigs++;
					}
				}
			}

			result.details.insecureConfigs = insecureConfigs;

			if (insecureConfigs > 0) {
				result.status = 'warning';
				result.recommendations.push({
					priority: 'high',
					action: 'Secure network configurations',
					details: `${insecureConfigs} network configurations have security issues`,
				});
			}
		} catch (error) {
			result.status = 'error';
			result.message = (error as Error).message;
		}

		return result;
	}

	/**
	 * Update last run timestamp for a check
	 */
	private updateLastRunTimestamp(checkName: CheckName): void {
		const timestampFile = path.join(this.checksDir, `${checkName}-last-run.txt`);
		fs.mkdirSync(path.dirname(timestampFile), { recursive: true });
		fs.writeFileSync(timestampFile, Date.now().toString());
	}

	/**
	 * Generate overall health assessment
	 */
	private generateAssessment(results: HealthCheckResults): HealthAssessment {
		const { summary } = results;

		let overallStatus: 'healthy' | 'warning' | 'unhealthy' = 'healthy';
		let score = 100;

		// Deduct points for failures
		score -= summary.failed * 20;
		score -= summary.warnings * 5;

		if (summary.failed > 0) {
			overallStatus = 'unhealthy';
		} else if (summary.warnings > 0) {
			overallStatus = 'warning';
		}

		return {
			status: overallStatus,
			score: Math.max(0, score),
			message: this.getAssessmentMessage(overallStatus, score),
		};
	}

	/**
	 * Get assessment message
	 */
	private getAssessmentMessage(
		status: 'healthy' | 'warning' | 'unhealthy',
		score: number,
	): string {
		if (status === 'healthy') {
			return `Security health is excellent (${score}/100)`;
		} else if (status === 'warning') {
			return `Security health needs attention (${score}/100)`;
		} else {
			return `Security health is critical (${score}/100)`;
		}
	}

	/**
	 * Save health report
	 */
	private async saveHealthReport(results: HealthCheckResults): Promise<void> {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const reportFile = path.join(this.reportsDir, `health-report-${timestamp}.json`);

		fs.mkdirSync(path.dirname(reportFile), { recursive: true });
		fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));

		this.log(`📄 Health report saved: ${reportFile}`);
	}

	/**
	 * Handle notifications based on results
	 */
	private async handleNotifications(results: HealthCheckResults): Promise<void> {
		const { assessment, summary } = results;

		if (assessment.status === 'unhealthy' && this.config.notifications.onFailure) {
			await this.sendHealthAlert(results, 'failure');
		} else if (assessment.status === 'warning' && this.config.notifications.onWarning) {
			await this.sendHealthAlert(results, 'warning');
		}
	}

	/**
	 * Send health alert
	 */
	private async sendHealthAlert(results: HealthCheckResults, type: string): Promise<void> {
		this.log(`🚨 Sending health alert: ${type}`);

		// Implementation would integrate with alerting system
		// For now, just log the alert
		console.log(`Health Alert (${type.toUpperCase()}):`);
		console.log(`Status: ${results.assessment.status}`);
		console.log(`Score: ${results.assessment.score}/100`);
		console.log(`Failed checks: ${results.summary.failed}`);
		console.log(`Warning checks: ${results.summary.warnings}`);
	}

	/**
	 * Get health check status
	 */
	getStatus(): HealthCheckStatus {
		const status: HealthCheckStatus = {
			lastRun: null,
			nextRuns: {},
			enabledChecks: [],
		};

		// Get last run time
		try {
			const reportFiles = fs
				.readdirSync(this.reportsDir)
				.filter((f) => f.startsWith('health-report-'))
				.sort()
				.reverse();

			if (reportFiles.length > 0) {
				const latestReport = JSON.parse(
					fs.readFileSync(path.join(this.reportsDir, reportFiles[0]), 'utf8'),
				);
				status.lastRun = latestReport.timestamp;
			}
		} catch {
			// No reports yet
		}

		// Calculate next runs
		for (const [checkName, config] of Object.entries(this.config.schedules)) {
			if (config.enabled) {
				status.enabledChecks.push(checkName);

				try {
					const lastRunFile = path.join(this.checksDir, `${checkName}-last-run.txt`);
					if (fs.existsSync(lastRunFile)) {
						const lastRun = parseInt(fs.readFileSync(lastRunFile, 'utf8'));
						status.nextRuns[checkName] = new Date(lastRun + config.interval).toISOString();
					} else {
						status.nextRuns[checkName] = new Date(
							Date.now() + config.interval,
						).toISOString();
					}
				} catch {
					status.nextRuns[checkName] = 'unknown';
				}
			}
		}

		return status;
	}
}

// CLI interface
async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const command = args[0];

	const healthChecks = new SecurityHealthChecks();

	switch (command) {
		case 'run':
			const options: HealthCheckOptions = {
				force: args.includes('--force'),
				verbose: args.includes('--verbose'),
				report: !args.includes('--no-report'),
			};
			await healthChecks.runAllChecks(options);
			break;

		case 'check':
			const checkName = args[1];
			if (!checkName) {
				console.log('Please specify a check name');
				process.exit(1);
			}
			const result = await healthChecks.runCheck(checkName as CheckName, { verbose: true });
			console.log(JSON.stringify(result, null, 2));
			break;

		case 'status':
			const status = healthChecks.getStatus();
			console.log(JSON.stringify(status, null, 2));
			break;

		default:
			console.log('Usage:');
			console.log(
				'  npx ts-node security-health-checks.ts run [--force] [--verbose] [--no-report]',
			);
			console.log('  npx ts-node security-health-checks.ts check <check-name>');
			console.log('  npx ts-node security-health-checks.ts status');
			process.exit(1);
	}
}

// Export for use as module
export default SecurityHealthChecks;

// Run if called directly
if (require.main === module) {
	main().catch((error) => {
		console.error('Security health checks failed:', error.message);
		process.exit(1);
	});
}
