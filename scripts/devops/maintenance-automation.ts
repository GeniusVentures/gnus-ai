#!/usr/bin/env npx ts-node

/**
 * GNUS-DAO Automated Maintenance System
 * Handles scheduled maintenance tasks for CI/CD pipeline health
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, ExecSyncOptions } from 'child_process';

interface MaintenanceTask {
	name: string;
	run: () => Promise<string>;
}

interface TaskResult {
	task: string;
	status: 'success' | 'error';
	result?: string;
	error?: string;
}

interface MaintenanceReport {
	timestamp: string;
	frequency: 'daily' | 'weekly' | 'monthly';
	results: TaskResult[];
	summary: {
		total: number;
		successful: number;
		failed: number;
	};
}

interface MaintenanceSchedule {
	daily: MaintenanceTask[];
	weekly: MaintenanceTask[];
	monthly: MaintenanceTask[];
}

class MaintenanceAutomation {
	private schedule: MaintenanceSchedule;

	constructor() {
		this.schedule = {
			daily: [],
			weekly: [],
			monthly: [],
		};
	}

	/**
	 * Add a maintenance task to the schedule
	 */
	addTask(frequency: keyof MaintenanceSchedule, task: MaintenanceTask): void {
		if (this.schedule[frequency]) {
			this.schedule[frequency].push(task);
		}
	}

	/**
	 * Run all scheduled tasks for a given frequency
	 */
	async runScheduledTasks(frequency: keyof MaintenanceSchedule): Promise<TaskResult[]> {
		console.log(`🔄 Running ${frequency} maintenance tasks...`);

		const tasks = this.schedule[frequency] || [];
		const results: TaskResult[] = [];

		for (const task of tasks) {
			try {
				console.log(`Running: ${task.name}`);
				const result = await task.run();
				results.push({ task: task.name, status: 'success', result });
				console.log(`✅ ${task.name} completed`);
			} catch (error) {
				results.push({
					task: task.name,
					status: 'error',
					error: error instanceof Error ? error.message : 'Unknown error',
				});
				console.error(
					`❌ ${task.name} failed:`,
					error instanceof Error ? error.message : 'Unknown error',
				);
			}
		}

		this.saveResults(frequency, results);
		return results;
	}

	/**
	 * Save maintenance results to a JSON report
	 */
	private saveResults(frequency: keyof MaintenanceSchedule, results: TaskResult[]): void {
		const timestamp = new Date().toISOString().split('T')[0];
		const filename = `maintenance-${frequency}-${timestamp}.json`;

		const report: MaintenanceReport = {
			timestamp: new Date().toISOString(),
			frequency,
			results,
			summary: {
				total: results.length,
				successful: results.filter((r) => r.status === 'success').length,
				failed: results.filter((r) => r.status === 'error').length,
			},
		};

		fs.writeFileSync(filename, JSON.stringify(report, null, 2));
		console.log(`📄 Maintenance report saved to ${filename}`);
	}

	/**
	 * Setup default maintenance tasks
	 */
	setupDefaultTasks(): void {
		// Daily tasks
		this.addTask('daily', {
			name: 'Cache Cleanup',
			run: async (): Promise<string> => {
				const execOptions: ExecSyncOptions = { stdio: 'inherit' };
				try {
					execSync('find ~/.cache -name "*.cache" -mtime +7 -delete', execOptions);
				} catch {
					// Cache directory might not exist, continue
				}
				execSync('rm -rf .tmp/ tmp/ .nyc_output/', execOptions);
				return 'Cache cleanup completed';
			},
		});

		this.addTask('daily', {
			name: 'Log Rotation',
			run: async (): Promise<string> => {
				const execOptions: ExecSyncOptions = { stdio: 'inherit' };
				try {
					execSync('find logs -name "*.log" -mtime +7 -exec gzip {} \\;', execOptions);
					execSync('find logs -name "*.log.gz" -mtime +30 -delete', execOptions);
				} catch {
					// Logs directory might not exist, continue
				}
				return 'Log rotation completed';
			},
		});

		// Weekly tasks
		this.addTask('weekly', {
			name: 'Dependency Audit',
			run: async (): Promise<string> => {
				const execOptions: ExecSyncOptions = { encoding: 'utf8' };
				try {
					const result = execSync('yarn audit --audit-level moderate', execOptions);
					return typeof result === 'string' ? result : result.toString();
				} catch (error) {
					// yarn audit exits with non-zero code when vulnerabilities are found
					const output =
						error instanceof Error && 'stdout' in error ? (error as any).stdout : '';
					return typeof output === 'string'
						? output
						: output?.toString() || 'Audit completed with findings';
				}
			},
		});

		this.addTask('weekly', {
			name: 'Repository Optimization',
			run: async (): Promise<string> => {
				const execOptions: ExecSyncOptions = { stdio: 'inherit' };
				execSync('git gc --aggressive --prune=now', execOptions);
				return 'Repository optimization completed';
			},
		});

		// Monthly tasks
		this.addTask('monthly', {
			name: 'Comprehensive Audit',
			run: async (): Promise<string> => {
				const execOptions: ExecSyncOptions = { stdio: 'inherit' };
				execSync('yarn health-check', execOptions);
				execSync('yarn cost-analyzer --timeframe=month', execOptions);
				return 'Comprehensive audit completed';
			},
		});

		this.addTask('monthly', {
			name: 'Backup Creation',
			run: async (): Promise<string> => {
				const execOptions: ExecSyncOptions = { stdio: 'inherit' };
				const backupDir = `backup-${new Date().toISOString().split('T')[0]}`;

				execSync(`mkdir -p ${backupDir}`, execOptions);
				execSync(`cp -r .github scripts docs ${backupDir}/`, execOptions);
				execSync(`tar -czf ${backupDir}.tar.gz ${backupDir}`, execOptions);
				execSync(`rm -rf ${backupDir}`, execOptions);

				return `Backup created: ${backupDir}.tar.gz`;
			},
		});
	}

	/**
	 * Get the current maintenance schedule
	 */
	getSchedule(): MaintenanceSchedule {
		return { ...this.schedule };
	}

	/**
	 * Clear all scheduled tasks
	 */
	clearSchedule(): void {
		this.schedule = {
			daily: [],
			weekly: [],
			monthly: [],
		};
	}
}

// CLI interface
async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const command = args[0];

	const maintenance = new MaintenanceAutomation();

	switch (command) {
		case 'setup':
			maintenance.setupDefaultTasks();
			console.log('✅ Default maintenance tasks configured');
			// Also show the configured tasks
			const configuredSchedule = maintenance.getSchedule();
			console.log('\n📋 Configured tasks:');
			Object.entries(configuredSchedule).forEach(
				([freq, tasks]: [string, MaintenanceTask[]]) => {
					if (tasks.length > 0) {
						console.log(`\n${freq.toUpperCase()}:`);
						tasks.forEach((task: MaintenanceTask, index: number) => {
							console.log(`  ${index + 1}. ${task.name}`);
						});
					}
				},
			);
			process.exit(0);
			break;

		case 'run':
			const frequency = args[1] as keyof MaintenanceSchedule;
			if (!frequency || !['daily', 'weekly', 'monthly'].includes(frequency)) {
				console.error('Error: Valid frequency required (daily, weekly, monthly)');
				console.error('Tip: Run "setup" first to configure default tasks');
				process.exit(1);
			}
			// Setup default tasks before running
			maintenance.setupDefaultTasks();
			await maintenance.runScheduledTasks(frequency);
			process.exit(0);
			break;

		case 'list':
			// Setup default tasks to show what would be configured
			maintenance.setupDefaultTasks();
			const listSchedule = maintenance.getSchedule();
			console.log('📋 Maintenance Schedule (default configuration):');
			Object.entries(listSchedule).forEach(([freq, tasks]: [string, MaintenanceTask[]]) => {
				console.log(`\n${freq.toUpperCase()}:`);
				if (tasks.length === 0) {
					console.log('  No tasks scheduled');
				} else {
					tasks.forEach((task: MaintenanceTask, index: number) => {
						console.log(`  ${index + 1}. ${task.name}`);
					});
				}
			});
			process.exit(0);
			break;

		default:
			console.log('Usage:');
			console.log('  npx ts-node scripts/devops/maintenance-automation.ts setup');
			console.log('  npx ts-node scripts/devops/maintenance-automation.ts run <frequency>');
			console.log('  npx ts-node scripts/devops/maintenance-automation.ts list');
			console.log('');
			console.log('Frequencies: daily, weekly, monthly');
			console.log('');
			console.log(
				'Note: The "run" command automatically sets up default tasks before execution.',
			);
			process.exit(1);
	}
}

// Export for use as module
export default MaintenanceAutomation;

// Run if called directly
if (require.main === module) {
	main().catch((error) => {
		console.error('Maintenance automation failed:', error.message);
		process.exit(1);
	});
}
