#!/usr/bin/env node

/**
 * Performance Monitoring for Security Hooks
 * Tracks execution times and provides optimization insights
 */

import * as fs from 'fs';
import * as path from 'path';

interface PerformanceLogEntry {
	timestamp: string;
	hook: string;
	duration: number;
	status: 'SUCCESS' | 'FAILED';
	user: string;
}

interface HookStats {
	runs: number;
	totalDuration: number;
	averageDuration: number;
	minDuration: number;
	maxDuration: number;
	successRate: number;
	successes: number;
	failures: number;
}

interface PerformanceStats {
	totalRuns: number;
	hooks: Record<string, HookStats>;
	averageDuration: number;
	slowestHook: string | null;
	fastestHook: string | null;
	message?: string;
}

interface TimingState {
	startTime: number;
	hookName: string;
}

class PerformanceMonitor {
	private logDir: string;
	private perfLogFile: string;
	private timingStateFile: string;

	constructor() {
		this.logDir = path.join(process.cwd(), 'logs');
		this.perfLogFile = path.join(this.logDir, 'hook-performance.log');
		this.timingStateFile = path.join(this.logDir, 'timing-state.json');
		this.ensureLogDir();
	}

	private ensureLogDir(): void {
		if (!fs.existsSync(this.logDir)) {
			fs.mkdirSync(this.logDir, { recursive: true });
		}
	}

	public startTiming(hookName: string): void {
		const timingState: TimingState = {
			startTime: Date.now(),
			hookName: hookName,
		};

		fs.writeFileSync(this.timingStateFile, JSON.stringify(timingState));
		console.log(`⏱️  Starting ${hookName} performance monitoring...`);
	}

	public endTiming(success: boolean = true): void {
		if (!fs.existsSync(this.timingStateFile)) {
			console.warn('⚠️  No active timing session found. Did you run "start" first?');
			return;
		}

		try {
			const timingStateData = fs.readFileSync(this.timingStateFile, 'utf8');
			const timingState: TimingState = JSON.parse(timingStateData);

			const duration = Date.now() - timingState.startTime;
			const status: 'SUCCESS' | 'FAILED' = success ? 'SUCCESS' : 'FAILED';

			const logEntry: PerformanceLogEntry = {
				timestamp: new Date().toISOString(),
				hook: timingState.hookName,
				duration: duration,
				status: status,
				user: process.env.USER || process.env.USERNAME || 'unknown',
			};

			fs.appendFileSync(this.perfLogFile, JSON.stringify(logEntry) + '\n');

			console.log(`⏱️  ${timingState.hookName} completed in ${duration}ms (${status})`);

			// Performance warnings
			if (duration > 900000) {
				// 90 seconds
				console.warn(
					`⚠️  WARNING: ${timingState.hookName} took longer than 90 seconds (${duration}ms)`,
				);
				console.warn('   Consider optimizing the hook or using emergency bypass if needed');
			}

			// Clean up timing state file
			fs.unlinkSync(this.timingStateFile);
		} catch (error) {
			console.error('❌ Error reading timing state:', error);
		}
	}

	public getPerformanceStats(): PerformanceStats {
		if (!fs.existsSync(this.perfLogFile)) {
			return { message: 'No performance data available' } as PerformanceStats;
		}

		const logs: PerformanceLogEntry[] = fs
			.readFileSync(this.perfLogFile, 'utf8')
			.split('\n')
			.filter((line: string) => line.trim())
			.map((line: string) => {
				try {
					return JSON.parse(line) as PerformanceLogEntry;
				} catch (e) {
					return null;
				}
			})
			.filter((entry): entry is PerformanceLogEntry => entry !== null);

		const stats: PerformanceStats = {
			totalRuns: logs.length,
			hooks: {},
			averageDuration: 0,
			slowestHook: null,
			fastestHook: null,
		};

		let totalDuration = 0;

		logs.forEach((entry: PerformanceLogEntry) => {
			if (!stats.hooks[entry.hook]) {
				stats.hooks[entry.hook] = {
					runs: 0,
					totalDuration: 0,
					averageDuration: 0,
					minDuration: Infinity,
					maxDuration: 0,
					successRate: 0,
					successes: 0,
					failures: 0,
				};
			}

			const hookStats = stats.hooks[entry.hook];
			hookStats.runs++;
			hookStats.totalDuration += entry.duration;
			hookStats.minDuration = Math.min(hookStats.minDuration, entry.duration);
			hookStats.maxDuration = Math.max(hookStats.maxDuration, entry.duration);

			if (entry.status === 'SUCCESS') {
				hookStats.successes++;
			} else {
				hookStats.failures++;
			}

			hookStats.successRate = (hookStats.successes / hookStats.runs) * 100;
			hookStats.averageDuration = hookStats.totalDuration / hookStats.runs;

			totalDuration += entry.duration;
		});

		stats.averageDuration = totalDuration / logs.length;

		// Find slowest and fastest hooks
		Object.entries(stats.hooks).forEach(([hookName, hookStats]) => {
			if (
				!stats.slowestHook ||
				hookStats.maxDuration > stats.hooks[stats.slowestHook!].maxDuration
			) {
				stats.slowestHook = hookName;
			}
			if (
				!stats.fastestHook ||
				hookStats.minDuration < stats.hooks[stats.fastestHook!].minDuration
			) {
				stats.fastestHook = hookName;
			}
		});

		return stats;
	}

	public displayStats(): void {
		const stats = this.getPerformanceStats();

		if (stats.message) {
			console.log(stats.message);
			return;
		}

		console.log('📊 Security Hook Performance Statistics');
		console.log('=====================================');
		console.log(`Total Hook Runs: ${stats.totalRuns}`);
		console.log(`Average Duration: ${Math.round(stats.averageDuration)}ms`);
		console.log('');

		Object.entries(stats.hooks).forEach(([hookName, hookStats]) => {
			console.log(`🔗 ${hookName}:`);
			console.log(`   Runs: ${hookStats.runs}`);
			console.log(`   Average: ${Math.round(hookStats.averageDuration)}ms`);
			console.log(`   Range: ${hookStats.minDuration}ms - ${hookStats.maxDuration}ms`);
			console.log(`   Success Rate: ${hookStats.successRate.toFixed(1)}%`);
			console.log('');
		});

		if (stats.slowestHook) {
			console.log(
				`🐌 Slowest Hook: ${stats.slowestHook} (${Math.round(stats.hooks[stats.slowestHook].maxDuration)}ms)`,
			);
		}

		if (stats.fastestHook) {
			console.log(
				`🚀 Fastest Hook: ${stats.fastestHook} (${Math.round(stats.hooks[stats.fastestHook].minDuration)}ms)`,
			);
		}
	}
}

// CLI interface
const args: string[] = process.argv.slice(2);
const command: string = args[0];

const monitor = new PerformanceMonitor();

switch (command) {
	case 'start':
		const hookName: string | undefined = args[1];
		if (!hookName) {
			console.error('❌ Hook name required: yarn perf-monitor start <hook-name>');
			process.exit(1);
		}
		monitor.startTiming(hookName);
		break;

	case 'end':
		const success: boolean = args[1] !== 'false';
		monitor.endTiming(success);
		break;

	case 'stats':
	default:
		monitor.displayStats();
		break;
}
