#!/usr/bin/env node

/**
 * GNUS-DAO Dependency Provenance Validation Script
 * Validates provenance and integrity of critical dependencies
 * Implements supply chain security checks for key packages
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
	type: string;
	package: string;
	issue?: string;
	severity?: 'critical' | 'high' | 'medium' | 'low';
	recommendation?: string;
	status?: string;
	version?: string;
	hash?: string;
}

interface Recommendation {
	priority: 'high' | 'medium' | 'low';
	action: string;
	details: string;
}

interface ValidationResults {
	validated: ValidationResult[];
	failed: ValidationResult[];
	warnings: ValidationResult[];
	summary: Record<string, any>;
}

interface ProvenanceReport {
	timestamp: string;
	project: string;
	validationResults: ValidationResults;
	summary: {
		totalValidated: number;
		totalFailed: number;
		totalWarnings: number;
		criticalIssues: number;
		highIssues: number;
	};
	recommendations: Recommendation[];
}

interface PackageData {
	name?: string;
	version?: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	scripts?: Record<string, string>;
	binary?: string | Record<string, string>;
	bin?: string | Record<string, string>;
	license?: string;
	repository?: string | { url?: string };
	[key: string]: unknown;
}

class ProvenanceValidator {
	private packageJson: string;
	private yarnLock: string;
	private criticalPackages: string[];
	private results: ValidationResults;

	constructor() {
		this.packageJson = path.join(process.cwd(), 'package.json');
		this.yarnLock = path.join(process.cwd(), 'yarn.lock');
		this.criticalPackages = [
			'hardhat',
			'@nomicfoundation/hardhat-toolbox',
			'@nomicfoundation/hardhat-ethers',
			'ethers',
			'typescript',
			'@types/node',
			'@diamondslab/diamonds',
			'@diamondslab/hardhat-diamonds',
			'@openzeppelin/contracts',
			'@openzeppelin/contracts-upgradeable',
		];
		this.results = {
			validated: [],
			failed: [],
			warnings: [],
			summary: {},
		};
	}

	private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
		const timestamp = new Date().toISOString();
		const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
		console.log(`${prefix} [${timestamp}] ${message}`);
	}

	/**
	 * Main validation entry point
	 */
	public async validateAll(): Promise<ValidationResults> {
		this.log('🚀 Starting GNUS-DAO dependency provenance validation');

		try {
			await this.validatePackageIntegrity();
			await this.validateYarnLockIntegrity();
			await this.validateCriticalDependencies();
			await this.checkForMaliciousPackages();
			await this.validatePeerDependencies();
			await this.generateProvenanceReport();

			this.printSummary();
			return this.results;
		} catch (error) {
			this.log(`Provenance validation failed: ${(error as Error).message}`, 'error');
			throw error;
		}
	}

	/**
	 * Validate package.json integrity
	 */
	private async validatePackageIntegrity(): Promise<void> {
		this.log('Validating package.json integrity...');

		if (!fs.existsSync(this.packageJson)) {
			throw new Error('package.json not found');
		}

		try {
			const packageData: PackageData = JSON.parse(
				fs.readFileSync(this.packageJson, 'utf8'),
			);
			const requiredFields = ['name', 'version', 'dependencies', 'devDependencies'];

			for (const field of requiredFields) {
				if (!packageData[field]) {
					this.results.failed.push({
						type: 'package-integrity',
						package: 'package.json',
						issue: `Missing required field: ${field}`,
						severity: 'high',
					});
				}
			}

			// Validate dependency versions are pinned or use caret for security
			this.validateDependencyVersions(packageData);

			this.results.validated.push({
				type: 'package-integrity',
				package: 'package.json',
				status: 'valid',
			});
		} catch (error) {
			this.results.failed.push({
				type: 'package-integrity',
				package: 'package.json',
				issue: `Invalid JSON: ${(error as Error).message}`,
				severity: 'critical',
			});
		}
	}

	/**
	 * Validate dependency version specifications
	 */
	private validateDependencyVersions(packageData: PackageData): void {
		const allDeps: Record<string, string> = {
			...packageData.dependencies,
			...packageData.devDependencies,
		};

		for (const [name, version] of Object.entries(allDeps)) {
			// Check for insecure version ranges
			if (version.includes('*') || version.includes('latest')) {
				this.results.warnings.push({
					type: 'dependency-version',
					package: name,
					issue: `Insecure version specification: ${version}`,
					recommendation: 'Use specific versions or caret ranges (^x.y.z)',
					severity: 'medium',
				});
			}

			// Check for git dependencies (higher risk)
			if (version.startsWith('git+') || version.includes('github.com')) {
				this.results.warnings.push({
					type: 'dependency-source',
					package: name,
					issue: `Git dependency detected: ${version}`,
					recommendation: 'Prefer npm-published packages for better security',
					severity: 'low',
				});
			}
		}
	}

	/**
	 * Validate yarn.lock integrity
	 */
	private async validateYarnLockIntegrity(): Promise<void> {
		this.log('Validating yarn.lock integrity...');

		if (!fs.existsSync(this.yarnLock)) {
			this.results.failed.push({
				type: 'lockfile-integrity',
				package: 'yarn.lock',
				issue: 'yarn.lock file not found',
				severity: 'high',
			});
			return;
		}

		try {
			const lockfileContent = fs.readFileSync(this.yarnLock, 'utf8');
			const lockfileHash = crypto
				.createHash('sha256')
				.update(lockfileContent)
				.digest('hex');

			// Check for lockfile tampering indicators
			if (lockfileContent.includes('integrity: ') === false) {
				this.results.warnings.push({
					type: 'lockfile-integrity',
					package: 'yarn.lock',
					issue: 'Lockfile may not contain integrity hashes',
					severity: 'medium',
				});
			}

			this.results.validated.push({
				type: 'lockfile-integrity',
				package: 'yarn.lock',
				hash: lockfileHash,
				status: 'valid',
			});
		} catch (error) {
			this.results.failed.push({
				type: 'lockfile-integrity',
				package: 'yarn.lock',
				issue: `Lockfile validation failed: ${(error as Error).message}`,
				severity: 'high',
			});
		}
	}

	/**
	 * Validate critical dependencies
	 */
	private async validateCriticalDependencies(): Promise<void> {
		this.log('Validating critical dependencies...');

		const packageData: PackageData = JSON.parse(fs.readFileSync(this.packageJson, 'utf8'));
		const allDeps: Record<string, string> = {
			...packageData.dependencies,
			...packageData.devDependencies,
		};

		for (const criticalPkg of this.criticalPackages) {
			if (allDeps[criticalPkg]) {
				try {
					await this.validatePackageProvenance(criticalPkg, allDeps[criticalPkg]);
				} catch (error) {
					this.results.failed.push({
						type: 'critical-dependency',
						package: criticalPkg,
						issue: `Provenance validation failed: ${(error as Error).message}`,
						severity: 'high',
					});
				}
			} else {
				this.results.warnings.push({
					type: 'missing-dependency',
					package: criticalPkg,
					issue: 'Critical dependency not found in package.json',
					severity: 'medium',
				});
			}
		}
	}

	/**
	 * Validate individual package provenance
	 */
	private async validatePackageProvenance(
		packageName: string,
		version: string,
	): Promise<void> {
		// Check if package is installed
		try {
			const packagePath = path.join(process.cwd(), 'node_modules', packageName);
			if (!fs.existsSync(packagePath)) {
				throw new Error('Package not installed');
			}

			// Check package.json in node_modules
			const pkgJsonPath = path.join(packagePath, 'package.json');
			if (fs.existsSync(pkgJsonPath)) {
				const pkgData: PackageData = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

				// Validate package metadata
				this.validatePackageMetadata(packageName, pkgData);

				// Check for security indicators
				this.checkPackageSecurity(packageName, pkgData);

				this.results.validated.push({
					type: 'package-provenance',
					package: packageName,
					version: pkgData.version,
					status: 'valid',
				});
			} else {
				throw new Error('Package metadata not found');
			}
		} catch (error) {
			throw new Error(`Package validation failed: ${(error as Error).message}`);
		}
	}

	/**
	 * Validate package metadata
	 */
	private validatePackageMetadata(packageName: string, pkgData: PackageData): void {
		// Check for required fields
		const requiredFields = ['name', 'version', 'main', 'license'];
		for (const field of requiredFields) {
			if (!pkgData[field]) {
				this.results.warnings.push({
					type: 'package-metadata',
					package: packageName,
					issue: `Missing required field: ${field}`,
					severity: 'low',
				});
			}
		}

		// Check license
		if (pkgData.license && pkgData.license === 'UNLICENSED') {
			this.results.warnings.push({
				type: 'package-license',
				package: packageName,
				issue: 'Package uses UNLICENSED license',
				severity: 'medium',
			});
		}

		// Check repository URL
		if (!pkgData.repository) {
			this.results.warnings.push({
				type: 'package-repository',
				package: packageName,
				issue: 'No repository URL specified',
				severity: 'low',
			});
		}
	}

	/**
	 * Check package security indicators
	 */
	private checkPackageSecurity(packageName: string, pkgData: PackageData): void {
		// Check for scripts that could be malicious
		if (pkgData.scripts) {
			const suspiciousScripts = [
				'preinstall',
				'postinstall',
				'preuninstall',
				'postuninstall',
			];
			for (const script of suspiciousScripts) {
				if (pkgData.scripts[script]) {
					this.results.warnings.push({
						type: 'package-scripts',
						package: packageName,
						issue: `Suspicious script found: ${script}`,
						severity: 'medium',
					});
				}
			}
		}

		// Check for binary dependencies
		if (pkgData.binary || pkgData.bin) {
			this.results.warnings.push({
				type: 'package-binaries',
				package: packageName,
				issue: 'Package contains binary executables',
				severity: 'low',
			});
		}
	}

	/**
	 * Check for malicious packages
	 */
	private async checkForMaliciousPackages(): Promise<void> {
		this.log('Checking for potentially malicious packages...');

		try {
			// Check for packages with known security issues
			const maliciousPatterns = [/fake-/i, /malicious/i, /trojan/i, /backdoor/i];

			const packageData: PackageData = JSON.parse(
				fs.readFileSync(this.packageJson, 'utf8'),
			);
			const allDeps: Record<string, string> = {
				...packageData.dependencies,
				...packageData.devDependencies,
			};

			for (const [name] of Object.entries(allDeps)) {
				for (const pattern of maliciousPatterns) {
					if (pattern.test(name)) {
						this.results.failed.push({
							type: 'malicious-package',
							package: name,
							issue: 'Package name matches malicious pattern',
							severity: 'critical',
						});
					}
				}
			}
		} catch (error) {
			this.log(`Malicious package check failed: ${(error as Error).message}`, 'warn');
		}
	}

	/**
	 * Validate peer dependencies
	 */
	private async validatePeerDependencies(): Promise<void> {
		this.log('Validating peer dependency compatibility...');

		try {
			const packageData: PackageData = JSON.parse(
				fs.readFileSync(this.packageJson, 'utf8'),
			);

			// Check for missing peer dependencies
			const deps: Record<string, string> = {
				...packageData.dependencies,
				...packageData.devDependencies,
			};

			// Hardhat ecosystem compatibility
			if (deps.hardhat && !deps['@nomicfoundation/hardhat-toolbox']) {
				this.results.warnings.push({
					type: 'peer-dependency',
					package: 'hardhat',
					issue: 'Missing recommended peer dependency: @nomicfoundation/hardhat-toolbox',
					severity: 'low',
				});
			}

			// TypeScript ecosystem
			if (deps.typescript && !deps['@types/node']) {
				this.results.warnings.push({
					type: 'peer-dependency',
					package: 'typescript',
					issue: 'Missing recommended peer dependency: @types/node',
					severity: 'low',
				});
			}
		} catch (error) {
			this.log(`Peer dependency validation failed: ${(error as Error).message}`, 'warn');
		}
	}

	/**
	 * Generate provenance report
	 */
	private async generateProvenanceReport(): Promise<void> {
		const report: ProvenanceReport = {
			timestamp: new Date().toISOString(),
			project: 'GNUS-DAO',
			validationResults: this.results,
			summary: {
				totalValidated: this.results.validated.length,
				totalFailed: this.results.failed.length,
				totalWarnings: this.results.warnings.length,
				criticalIssues: this.results.failed.filter((f) => f.severity === 'critical').length,
				highIssues: this.results.failed.filter((f) => f.severity === 'high').length,
			},
			recommendations: this.generateRecommendations(),
		};

		const reportPath = path.join(process.cwd(), 'reports', 'provenance-report.json');
		fs.mkdirSync(path.dirname(reportPath), { recursive: true });
		fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

		this.log(`Provenance report generated: ${reportPath}`);
	}

	/**
	 * Generate recommendations based on findings
	 */
	private generateRecommendations(): Recommendation[] {
		const recommendations: Recommendation[] = [];

		if (this.results.failed.length > 0) {
			recommendations.push({
				priority: 'high',
				action: 'Fix critical and high-severity issues immediately',
				details: `${this.results.failed.length} validation failures require attention`,
			});
		}

		if (this.results.warnings.length > 0) {
			recommendations.push({
				priority: 'medium',
				action: 'Review and address security warnings',
				details: `${this.results.warnings.length} warnings should be evaluated`,
			});
		}

		// Specific recommendations
		const hasVersionIssues = this.results.warnings.some(
			(w) => w.type === 'dependency-version',
		);
		if (hasVersionIssues) {
			recommendations.push({
				priority: 'medium',
				action: 'Pin dependency versions for reproducible builds',
				details: 'Use specific versions instead of ranges for better security',
			});
		}

		const hasGitDeps = this.results.warnings.some((w) => w.type === 'dependency-source');
		if (hasGitDeps) {
			recommendations.push({
				priority: 'low',
				action: 'Replace git dependencies with npm packages where possible',
				details: 'Git dependencies increase supply chain risk',
			});
		}

		return recommendations;
	}

	/**
	 * Print validation summary
	 */
	private printSummary(): void {
		console.log('\n📊 Provenance Validation Summary');
		console.log('================================');

		console.log(`✅ Validated: ${this.results.validated.length}`);
		console.log(`❌ Failed: ${this.results.failed.length}`);
		console.log(`⚠️  Warnings: ${this.results.warnings.length}`);

		if (this.results.failed.length > 0) {
			console.log('\n🚨 Critical Issues:');
			this.results.failed.forEach((failure) => {
				console.log(`  - ${failure.package}: ${failure.issue}`);
			});
		}

		if (this.results.warnings.length > 0) {
			console.log('\n⚠️  Security Warnings:');
			this.results.warnings.slice(0, 5).forEach((warning) => {
				console.log(`  - ${warning.package}: ${warning.issue}`);
			});
			if (this.results.warnings.length > 5) {
				console.log(`  ... and ${this.results.warnings.length - 5} more`);
			}
		}
	}
}

// CLI interface
async function main(): Promise<void> {
	const validator = new ProvenanceValidator();

	try {
		const results = await validator.validateAll();

		// Exit with error code if there are critical failures
		const hasCriticalFailures = results.failed.some((f) => f.severity === 'critical');
		const hasHighFailures = results.failed.some((f) => f.severity === 'high');

		if (hasCriticalFailures) {
			console.log('\n💥 Critical security issues found. Build should not proceed.');
			process.exit(1);
		} else if (hasHighFailures) {
			console.log(
				'\n⚠️  High-severity issues found. Review recommended before proceeding.',
			);
			process.exit(1);
		} else {
			console.log('\n✅ Provenance validation completed successfully.');
		}
	} catch (error) {
		console.error('Provenance validation failed:', (error as Error).message);
		process.exit(1);
	}
}

// Run if called directly
if (require.main === module) {
	main().catch((error) => {
		console.error('Fatal error:', error);
		process.exit(1);
	});
}

export default ProvenanceValidator;
