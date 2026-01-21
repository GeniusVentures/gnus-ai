#!/usr/bin/env node

/**
 * Emergency Security Bypass Script
 * Allows bypassing security hooks in emergency situations with proper logging
 */

import { spawnSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

interface BypassRequest {
	timestamp: string;
	action: string;
	user: string;
	nodeVersion: string;
	cwd: string;
	reason?: string;
	contact?: string;
	severity: string;
	bypassId: string;
	[key: string]: unknown;
}

interface BypassLogEntry {
	timestamp: string;
	action: string;
	user: string;
	nodeVersion: string;
	cwd: string;
	reason?: string;
	contact?: string;
	severity: string;
	bypassId: string;
	[key: string]: unknown;
}

interface BypassOptions {
	reason?: string;
	contact?: string;
	severity?: string;
}

type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';
type BypassAction = 'commit' | 'push' | 'disable' | 'enable' | 'status';

const VALID_SEVERITIES: SeverityLevel[] = ['critical', 'high', 'medium', 'low'];
const VALID_ACTIONS: BypassAction[] = ['commit', 'push', 'disable', 'enable', 'status'];
const HOOKS = ['pre-commit', 'commit-msg', 'pre-push'];

class EmergencyBypassTool {
	private args: string[];
	private command: string;
	private logDir: string;
	private bypassLogFile: string;
	private options: BypassOptions;

	constructor() {
		this.args = process.argv.slice(2);
		this.command = this.args[0];
		this.logDir = path.join(process.cwd(), 'logs', 'emergency-bypass');
		this.bypassLogFile = path.join(this.logDir, 'emergency-bypass.log');
		this.options = this.parseOptions();
	}

	private parseOptions(): BypassOptions {
		const reasonIndex = this.args.indexOf('--reason');
		const contactIndex = this.args.indexOf('--contact');
		const severityIndex = this.args.indexOf('--severity');

		return {
			reason: reasonIndex !== -1 ? this.args[reasonIndex + 1] : undefined,
			contact: contactIndex !== -1 ? this.args[contactIndex + 1] : undefined,
			severity: severityIndex !== -1 ? this.args[severityIndex + 1] : 'medium',
		};
	}

	public run(): void {
		if (!this.command || this.command === '--help' || this.command === '-h') {
			this.showHelp();
			return;
		}

		if (!VALID_ACTIONS.includes(this.command as BypassAction)) {
			console.error(`❌ Unknown action: ${this.command}`);
			console.error(`   Valid actions: ${VALID_ACTIONS.join(', ')}`);
			process.exit(1);
		}

		// Ensure log directory exists
		if (!fs.existsSync(this.logDir)) {
			fs.mkdirSync(this.logDir, { recursive: true });
		}

		if (this.command === 'status') {
			this.showStatus();
		} else {
			this.validateBypassRequest();
		}
	}

	private showHelp(): void {
		console.log(`
🔒 GNUS-DAO Emergency Security Bypass Tool

Usage:
  yarn emergency-bypass <action> [options]

Actions:
  commit <message>    - Bypass pre-commit hooks and commit with message
  push                - Bypass pre-push hooks and push changes
  status              - Show current bypass status and recent logs
  disable             - Temporarily disable all security hooks
  enable              - Re-enable all security hooks

Options:
  --reason <text>     - Required reason for bypass (logged)
  --contact <email>   - Contact for follow-up (logged)
  --severity <level>  - Emergency severity: critical, high, medium, low

Examples:
  yarn emergency-bypass commit "fix critical production issue" --reason "Database connection failure" --contact "admin@gnus.ai" --severity critical
  yarn emergency-bypass push --reason "Hotfix deployment" --contact "devops@gnus.ai" --severity high
  yarn emergency-bypass status

⚠️  WARNING: This tool should only be used in genuine emergency situations.
   All bypass actions are logged and require justification.
`);
	}

	private logBypassAction(action: string, details: Record<string, any> = {}): void {
		const logEntry: BypassLogEntry = {
			timestamp: new Date().toISOString(),
			action,
			user: process.env.USER || process.env.USERNAME || 'unknown',
			nodeVersion: process.version,
			cwd: process.cwd(),
			reason: this.options.reason,
			contact: this.options.contact,
			severity: this.options.severity || 'medium',
			bypassId: crypto.randomUUID(),
			...details,
		};

		fs.appendFileSync(this.bypassLogFile, JSON.stringify(logEntry) + '\n');

		// Send notification (in real implementation, this would send email/Slack)
		console.log(`🚨 EMERGENCY BYPASS LOGGED: ${action}`);
		console.log(`   ID: ${logEntry.bypassId}`);
		console.log(`   Reason: ${this.options.reason || 'Not specified'}`);
		console.log(`   Contact: ${this.options.contact || 'Not specified'}`);
		console.log(`   Severity: ${this.options.severity}`);
		console.log(`   Timestamp: ${logEntry.timestamp}`);
		console.log(`   Log: ${this.bypassLogFile}`);
	}

	private validateBypassRequest(): void {
		if (!this.options.reason) {
			console.error('❌ --reason is required for emergency bypass');
			process.exit(1);
		}

		if (!this.options.contact) {
			console.error('❌ --contact is required for emergency bypass');
			process.exit(1);
		}

		if (!VALID_SEVERITIES.includes(this.options.severity as SeverityLevel)) {
			console.error(`❌ Invalid severity. Must be one of: ${VALID_SEVERITIES.join(', ')}`);
			process.exit(1);
		}

		console.log(`⚠️  EMERGENCY BYPASS REQUESTED`);
		console.log(`   Reason: ${this.options.reason}`);
		console.log(`   Contact: ${this.options.contact}`);
		console.log(`   Severity: ${this.options.severity}`);
		console.log('');

		// Require explicit confirmation for high/critical severity
		if (this.options.severity === 'critical' || this.options.severity === 'high') {
			const rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout,
			});

			rl.question(
				'🔴 HIGH/CRITICAL SEVERITY BYPASS - Type "CONFIRM" to proceed: ',
				(answer: string) => {
					rl.close();
					if (answer !== 'CONFIRM') {
						console.log('❌ Bypass cancelled');
						process.exit(1);
					}
					this.executeBypass();
				},
			);
		} else {
			this.executeBypass();
		}
	}

	private executeBypass(): void {
		try {
			switch (this.command as BypassAction) {
				case 'commit':
					this.executeCommit();
					break;
				case 'push':
					this.executePush();
					break;
				case 'disable':
					this.executeDisable();
					break;
				case 'enable':
					this.executeEnable();
					break;
			}
		} catch (error) {
			console.error(`❌ Emergency bypass failed: ${(error as Error).message}`);
			process.exit(1);
		}
	}

	private executeCommit(): void {
		const message = this.args[1];
		if (!message) {
			console.error('❌ Commit message required');
			process.exit(1);
		}

		this.logBypassAction('commit', { message });

		// Bypass hooks and commit using spawnSync to prevent command injection
		process.env.HUSKY_SKIP_HOOKS = '1';

		// First add files
		const addResult = spawnSync('git', ['add', '.'], {
			stdio: 'inherit',
			env: process.env,
		});

		if (addResult.status !== 0) {
			console.error('❌ Failed to add files to git');
			process.exit(1);
		}

		// Then commit with the message as a separate argument
		const commitResult = spawnSync('git', ['commit', '-m', message], {
			stdio: 'inherit',
			env: process.env,
		});

		if (commitResult.status !== 0) {
			console.error('❌ Failed to commit changes');
			process.exit(1);
		}

		console.log('✅ Emergency commit completed');
	}

	private executePush(): void {
		this.logBypassAction('push');

		// Bypass hooks and push using spawnSync for consistency
		process.env.HUSKY_SKIP_HOOKS = '1';
		const pushResult = spawnSync('git', ['push'], {
			stdio: 'inherit',
			env: process.env,
		});

		if (pushResult.status !== 0) {
			console.error('❌ Failed to push changes');
			process.exit(1);
		}

		console.log('✅ Emergency push completed');
	}

	private executeDisable(): void {
		this.logBypassAction('disable-hooks');

		// Rename hook files to disable them
		HOOKS.forEach((hook) => {
			const hookPath = path.join(process.cwd(), '.husky', hook);
			const disabledPath = `${hookPath}.disabled`;

			if (fs.existsSync(hookPath)) {
				fs.renameSync(hookPath, disabledPath);
				console.log(`🔇 Disabled ${hook} hook`);
			}
		});

		console.log('✅ All security hooks disabled temporarily');
		console.log('   Run "yarn emergency-bypass enable" to re-enable');
	}

	private executeEnable(): void {
		this.logBypassAction('enable-hooks');

		// Re-enable hook files
		HOOKS.forEach((hook) => {
			const hookPath = path.join(process.cwd(), '.husky', hook);
			const disabledPath = `${hookPath}.disabled`;

			if (fs.existsSync(disabledPath)) {
				fs.renameSync(disabledPath, hookPath);
				console.log(`🔊 Re-enabled ${hook} hook`);
			}
		});

		console.log('✅ All security hooks re-enabled');
	}

	private showStatus(): void {
		if (fs.existsSync(this.bypassLogFile)) {
			const logs = fs
				.readFileSync(this.bypassLogFile, 'utf8')
				.split('\n')
				.filter((line) => line.trim())
				.slice(-10); // Last 10 entries

			console.log('📋 Recent Emergency Bypass Actions:');
			logs.forEach((log, index) => {
				try {
					const entry: BypassLogEntry = JSON.parse(log);
					console.log(
						`${index + 1}. ${entry.timestamp} - ${entry.action} (${entry.severity})`,
					);
					console.log(`   Reason: ${entry.reason || 'Not specified'}`);
					console.log(`   User: ${entry.user}`);
					console.log('');
				} catch (e) {
					// Skip malformed lines
				}
			});
		} else {
			console.log('📋 No emergency bypass actions logged yet');
		}

		// Check hook status
		console.log('🔍 Hook Status:');
		HOOKS.forEach((hook) => {
			const hookPath = path.join(process.cwd(), '.husky', hook);
			const disabledPath = `${hookPath}.disabled`;

			if (fs.existsSync(disabledPath)) {
				console.log(`   ${hook}: DISABLED`);
			} else if (fs.existsSync(hookPath)) {
				console.log(`   ${hook}: ENABLED`);
			} else {
				console.log(`   ${hook}: MISSING`);
			}
		});
	}
}

// CLI interface
if (require.main === module) {
	const tool = new EmergencyBypassTool();
	tool.run();
}

export default EmergencyBypassTool;
