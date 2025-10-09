#!/usr/bin/env node

/**
 * Smart Trigger Analyzer for GNUS-DAO CI/CD
 * Analyzes code changes to determine optimal CI trigger strategy
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// TypeScript interfaces for Smart Trigger structures
interface ContractAnalysis {
	file: string;
	functions: string[];
	stateVariables: string[];
	modifiers: string[];
	security: string[];
	complexity: ComplexityScore;
}

interface ComplexityScore {
	lines: number;
	functions: number;
	modifiers: number;
	stateVars: number;
	score: number;
}

interface Changes {
	contracts: ContractAnalysis[];
	functions: Set<string>;
	security: string[];
	dependencies: string[];
	config: string[];
}

interface Triggers {
	fullSecurityScan: boolean;
	deepContractAnalysis: boolean;
	performanceTests: boolean;
	integrationTests: boolean;
	deploymentTests: boolean;
	gasTests: boolean;
	auditTests: boolean;
}

interface SmartTriggerReport {
	timestamp: string;
	changes: {
		contracts: number;
		functions: string[];
		security: number;
		dependencies: number;
		config: number;
	};
	triggers: Triggers;
	riskScore: number;
	riskLevel: 'critical' | 'high' | 'medium' | 'low';
	summary: {
		totalFilesChanged: number;
		triggeredScans: number;
		triggerEfficiency: number;
	};
}

class SmartTrigger {
	private changes: Changes;
	private triggers: Triggers;
	private riskScore: number;

	constructor() {
		this.changes = {
			contracts: [],
			functions: new Set<string>(),
			security: [],
			dependencies: [],
			config: [],
		};

		this.triggers = {
			fullSecurityScan: false,
			deepContractAnalysis: false,
			performanceTests: false,
			integrationTests: false,
			deploymentTests: false,
			gasTests: false,
			auditTests: false,
		};

		this.riskScore = 0;
	}

	analyzeChanges(): Triggers {
		console.log('🔍 Analyzing code changes for smart triggering...');

		const changedFiles = this.getChangedFiles();

		if (changedFiles.length === 0) {
			console.log('No changes detected');
			return this.triggers;
		}

		console.log(`Found ${changedFiles.length} changed files`);

		changedFiles.forEach((file) => {
			if (file.endsWith('.sol')) {
				this.analyzeContract(file);
			} else if (this.isSecurityFile(file)) {
				this.analyzeSecurityFile(file);
			} else if (this.isDependencyFile(file)) {
				this.analyzeDependencyFile(file);
			} else if (this.isConfigFile(file)) {
				this.analyzeConfigFile(file);
			}
		});

		this.evaluateTriggerConditions();
		this.calculateRiskScore();

		return this.triggers;
	}

	private getChangedFiles(): string[] {
		try {
			// Get files changed in the current commit/PR
			let command: string;
			if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
				command = 'git diff --name-only origin/main';
			} else {
				command = 'git diff --name-only HEAD~1';
			}

			const output = execSync(command, { encoding: 'utf8' });
			return output.trim().split('\n').filter(Boolean);
		} catch (error) {
			console.warn('Could not get changed files:', (error as Error).message);
			return [];
		}
	}

	private analyzeContract(filePath: string): void {
		try {
			console.log(`Analyzing contract: ${filePath}`);

			const content = fs.readFileSync(filePath, 'utf8');
			const diff = this.getFileDiff(filePath);

			const contractAnalysis: ContractAnalysis = {
				file: filePath,
				functions: this.extractChangedFunctions(diff),
				stateVariables: this.extractChangedStateVars(diff),
				modifiers: this.extractChangedModifiers(diff),
				security: this.detectSecurityChanges(diff),
				complexity: this.assessComplexity(content),
			};

			this.changes.contracts.push(contractAnalysis);

			// Add functions to global set
			contractAnalysis.functions.forEach((func) => this.changes.functions.add(func));
		} catch (error) {
			console.warn(`Could not analyze contract ${filePath}:`, (error as Error).message);
		}
	}

	private getFileDiff(filePath: string): string {
		try {
			const command = `git diff HEAD~1 -- ${filePath}`;
			return execSync(command, { encoding: 'utf8' });
		} catch (error) {
			return '';
		}
	}

	private extractChangedFunctions(diff: string): string[] {
		const functionRegex = /(?:^|\n)[-+]\s*function\s+(\w+)\s*\(/gm;
		const matches: string[] = [];
		let match: RegExpExecArray | null;

		while ((match = functionRegex.exec(diff)) !== null) {
			matches.push(match[1]);
		}

		return [...new Set(matches)]; // Remove duplicates
	}

	private extractChangedStateVars(diff: string): string[] {
		const varRegex =
			/(?:^|\n)[-+]\s*(?:uint|int|address|bool|string|bytes\d*|mapping)\s+(\w+)\s*[;=]/gm;
		const matches: string[] = [];
		let match: RegExpExecArray | null;

		while ((match = varRegex.exec(diff)) !== null) {
			matches.push(match[1]);
		}

		return [...new Set(matches)];
	}

	private extractChangedModifiers(diff: string): string[] {
		const modifierRegex = /(?:^|\n)[-+]\s*modifier\s+(\w+)\s*\(/gm;
		const matches: string[] = [];
		let match: RegExpExecArray | null;

		while ((match = modifierRegex.exec(diff)) !== null) {
			matches.push(match[1]);
		}

		return [...new Set(matches)];
	}

	private detectSecurityChanges(diff: string): string[] {
		const securityKeywords = [
			'owner',
			'admin',
			'access',
			'permission',
			'auth',
			'authority',
			'transfer',
			'send',
			'call',
			'delegatecall',
			'selfdestruct',
			'reentrancy',
			'overflow',
			'underflow',
			'delegate',
			'proxy',
			'upgrade',
			'pause',
			'unpause',
			'emergency',
			'withdraw',
			'balance',
			'value',
			'msg.sender',
			'msg.value',
			'tx.origin',
		];

		const securityChanges: string[] = [];

		securityKeywords.forEach((keyword) => {
			if (diff.toLowerCase().includes(keyword)) {
				securityChanges.push(keyword);
			}
		});

		return securityChanges;
	}

	private assessComplexity(content: string): ComplexityScore {
		const lines = content.split('\n').length;
		const functions = (content.match(/function\s+\w+\s*\(/g) || []).length;
		const modifiers = (content.match(/modifier\s+\w+\s*\(/g) || []).length;
		const stateVars = (
			content.match(/(uint|int|address|bool|string|bytes|mapping)\s+\w+\s*[;=]/g) || []
		).length;

		return {
			lines,
			functions,
			modifiers,
			stateVars,
			score: functions * 2 + modifiers * 1.5 + stateVars * 0.5 + lines * 0.1,
		};
	}

	private isSecurityFile(filePath: string): boolean {
		return (
			filePath.includes('security') ||
			filePath.includes('audit') ||
			filePath.includes('slither') ||
			filePath.includes('semgrep') ||
			filePath.endsWith('.semgrep.yml')
		);
	}

	private analyzeSecurityFile(filePath: string): void {
		console.log(`Analyzing security file: ${filePath}`);
		this.changes.security.push(filePath);
	}

	private isDependencyFile(filePath: string): boolean {
		return (
			filePath === 'package.json' ||
			filePath === 'yarn.lock' ||
			filePath === 'hardhat.config.ts' ||
			filePath.includes('diamond')
		);
	}

	private analyzeDependencyFile(filePath: string): void {
		console.log(`Analyzing dependency file: ${filePath}`);
		this.changes.dependencies.push(filePath);
	}

	private isConfigFile(filePath: string): boolean {
		return (
			filePath.endsWith('.config.js') ||
			filePath.endsWith('.config.ts') ||
			filePath.endsWith('.json') ||
			filePath === 'tsconfig.json' ||
			filePath === 'eslint.config.mjs'
		);
	}

	private analyzeConfigFile(filePath: string): void {
		console.log(`Analyzing config file: ${filePath}`);
		this.changes.config.push(filePath);
	}

	private evaluateTriggerConditions(): void {
		// Full security scan triggers
		const hasSecurityChanges = this.changes.security.length > 0;
		const hasHighRiskContractChanges = this.changes.contracts.some(
			(contract) =>
				contract.security.length > 0 ||
				contract.functions.some((func) => this.isHighRiskFunction(func)),
		);
		const hasDependencyChanges = this.changes.dependencies.length > 0;

		if (hasSecurityChanges || hasHighRiskContractChanges || hasDependencyChanges) {
			this.triggers.fullSecurityScan = true;
		}

		// Deep contract analysis triggers
		const hasComplexContractChanges = this.changes.contracts.some(
			(contract) =>
				contract.complexity.score > 10 ||
				contract.functions.length > 3 ||
				contract.stateVariables.length > 2,
		);

		if (hasComplexContractChanges) {
			this.triggers.deepContractAnalysis = true;
		}

		// Performance test triggers
		const hasPerformanceImpactingChanges = this.changes.contracts.some(
			(contract) =>
				contract.functions.some((func) => this.impactsPerformance(func)) ||
				contract.complexity.score > 15,
		);

		if (hasPerformanceImpactingChanges) {
			this.triggers.performanceTests = true;
		}

		// Gas optimization test triggers
		const hasGasImpactingChanges = this.changes.contracts.some(
			(contract) =>
				contract.functions.some((func) => this.impactsGas(func)) ||
				contract.stateVariables.length > 0,
		);

		if (hasGasImpactingChanges) {
			this.triggers.gasTests = true;
		}

		// Integration test triggers
		if (this.changes.contracts.length > 0 || this.changes.config.length > 0) {
			this.triggers.integrationTests = true;
		}

		// Deployment test triggers
		const hasDeploymentChanges = this.changes.contracts.some((contract) =>
			contract.functions.some((func) => this.isDeploymentFunction(func)),
		);

		if (hasDeploymentChanges || this.changes.dependencies.length > 0) {
			this.triggers.deploymentTests = true;
		}

		// Audit test triggers (for main branch or security changes)
		if (hasSecurityChanges || process.env.GITHUB_REF === 'refs/heads/main') {
			this.triggers.auditTests = true;
		}
	}

	private isHighRiskFunction(functionName: string): boolean {
		const highRiskFunctions = [
			'transfer',
			'transferFrom',
			'transferOwnership',
			'approve',
			'mint',
			'burn',
			'upgrade',
			'upgradeTo',
			'upgradeAndCall',
			'pause',
			'unpause',
			'setOwner',
			'setAdmin',
			'setAuthority',
			'grantRole',
			'revokeRole',
			'withdraw',
			'withdrawAll',
			'emergencyWithdraw',
			'drain',
			'execute',
			'call',
			'delegateCall',
			'selfDestruct',
		];

		return highRiskFunctions.some((riskFunc) =>
			functionName.toLowerCase().includes(riskFunc.toLowerCase()),
		);
	}

	private impactsPerformance(functionName: string): boolean {
		const performanceFunctions = [
			'loop',
			'batch',
			'multi',
			'bulk',
			'mass',
			'process',
			'handle',
			'for',
			'while',
			'iterate',
			'map',
			'filter',
			'reduce',
		];

		return performanceFunctions.some((perfFunc) =>
			functionName.toLowerCase().includes(perfFunc.toLowerCase()),
		);
	}

	private impactsGas(functionName: string): boolean {
		const gasFunctions = [
			'store',
			'set',
			'update',
			'modify',
			'change',
			'write',
			'emit',
			'log',
			'event',
			'require',
			'assert',
			'revert',
		];

		return gasFunctions.some((gasFunc) =>
			functionName.toLowerCase().includes(gasFunc.toLowerCase()),
		);
	}

	private isDeploymentFunction(functionName: string): boolean {
		const deploymentFunctions = [
			'initialize',
			'init',
			'constructor',
			'setup',
			'configure',
			'deploy',
			'create',
			'clone',
			'factory',
		];

		return deploymentFunctions.some((deployFunc) =>
			functionName.toLowerCase().includes(deployFunc.toLowerCase()),
		);
	}

	private calculateRiskScore(): void {
		this.riskScore = 0;

		// Contract changes (high weight)
		this.riskScore += this.changes.contracts.length * 20;

		// Security changes (highest weight)
		this.riskScore += this.changes.security.length * 50;

		// Dependency changes (medium weight)
		this.riskScore += this.changes.dependencies.length * 15;

		// Config changes (low weight)
		this.riskScore += this.changes.config.length * 5;

		// Function complexity bonus
		this.changes.contracts.forEach((contract) => {
			this.riskScore += Math.min(contract.complexity.score, 10); // Cap at 10
		});

		// Security keywords bonus
		const totalSecurityKeywords = this.changes.contracts.reduce(
			(sum, contract) => sum + contract.security.length,
			0,
		);
		this.riskScore += totalSecurityKeywords * 5;

		// Cap risk score at 100
		this.riskScore = Math.min(this.riskScore, 100);
	}

	generateReport(): SmartTriggerReport {
		const report: SmartTriggerReport = {
			timestamp: new Date().toISOString(),
			changes: {
				contracts: this.changes.contracts.length,
				functions: Array.from(this.changes.functions),
				security: this.changes.security.length,
				dependencies: this.changes.dependencies.length,
				config: this.changes.config.length,
			},
			triggers: this.triggers,
			riskScore: this.riskScore,
			riskLevel: this.getRiskLevel(),
			summary: {
				totalFilesChanged: this.getChangedFiles().length,
				triggeredScans: Object.values(this.triggers).filter(Boolean).length,
				triggerEfficiency: this.calculateTriggerEfficiency(),
			},
		};

		return report;
	}

	private getRiskLevel(): 'critical' | 'high' | 'medium' | 'low' {
		if (this.riskScore >= 70) return 'critical';
		if (this.riskScore >= 40) return 'high';
		if (this.riskScore >= 20) return 'medium';
		return 'low';
	}

	private calculateTriggerEfficiency(): number {
		const totalPossibleTriggers = Object.keys(this.triggers).length;
		const triggeredCount = Object.values(this.triggers).filter(Boolean).length;
		return Math.round((triggeredCount / totalPossibleTriggers) * 100);
	}

	printSummary(): void {
		const report = this.generateReport();

		console.log('\n🎯 Smart Trigger Analysis Summary');
		console.log('================================');
		console.log(`Risk Score: ${report.riskScore}/100 (${report.riskLevel})`);
		console.log(`Files Changed: ${report.summary.totalFilesChanged}`);
		console.log(`Scans Triggered: ${report.summary.triggeredScans}`);
		console.log(`Trigger Efficiency: ${report.summary.triggerEfficiency}%`);

		console.log('\n📋 Changes Detected:');
		console.log(`- Contracts: ${report.changes.contracts}`);
		console.log(`- Security files: ${report.changes.security}`);
		console.log(`- Dependencies: ${report.changes.dependencies}`);
		console.log(`- Config files: ${report.changes.config}`);

		console.log('\n🚀 Triggers Activated:');
		Object.entries(report.triggers).forEach(([trigger, activated]) => {
			const status = activated ? '✅' : '❌';
			console.log(`${status} ${trigger.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
		});

		if (report.riskScore >= 40) {
			console.log('\n⚠️  High-risk changes detected - comprehensive testing recommended');
		}
	}

	// CI Integration methods
	setOutputs(): void {
		const report = this.generateReport();

		// Set GitHub Actions outputs
		Object.entries(report.triggers).forEach(([key, value]) => {
			console.log(`::set-output name=${key}::${value}`);
		});

		console.log(`::set-output name=risk_score::${report.riskScore}`);
		console.log(`::set-output name=risk_level::${report.riskLevel}`);
		console.log(
			`::set-output name=trigger_efficiency::${report.summary.triggerEfficiency}`,
		);
	}

	saveReport(): SmartTriggerReport {
		const report = this.generateReport();
		const reportPath = path.join(process.cwd(), 'reports', 'smart-trigger-report.json');

		fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
		console.log(`📄 Smart trigger report saved to ${reportPath}`);

		return report;
	}
}

// CLI interface
if (require.main === module) {
	const trigger = new SmartTrigger();

	// Analyze changes
	trigger.analyzeChanges();

	// Print summary
	trigger.printSummary();

	// Save report
	trigger.saveReport();

	// Set CI outputs if in CI environment
	if (process.env.CI) {
		trigger.setOutputs();
	}
}

export default SmartTrigger;
