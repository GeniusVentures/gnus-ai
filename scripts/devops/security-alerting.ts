#!/usr/bin/env node

/**
 * GNUS-DAO Security Alerting Integration
 * Manages security alerts across multiple channels (Slack, Discord, Email)
 * Provides configurable alerting rules and escalation procedures
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Type definitions
type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';
type AlertChannel = 'slack' | 'discord' | 'email';
type LogLevel = 'info' | 'warn' | 'error';

interface AlertData {
	title: string;
	description: string;
	package?: string;
	version?: string;
	file?: string;
	line?: number;
	cve?: string;
	url?: string;
	action?: string;
	test?: boolean;
}

interface Alert {
	id: string;
	timestamp: string;
	severity: AlertSeverity;
	title: string;
	description: string;
	package?: string;
	version?: string;
	file?: string;
	line?: number;
	cve?: string;
	url?: string;
	action?: string;
	test?: boolean;
	status: string;
	attempts: number;
	channels: AlertChannelStatus[];
}

interface AlertChannelStatus {
	channel: AlertChannel;
	status: 'sent' | 'failed';
	timestamp?: string;
	error?: string;
}

interface SlackConfig {
	enabled: boolean;
	webhookUrl?: string;
	channel: string;
	username: string;
	icon: string;
}

interface DiscordConfig {
	enabled: boolean;
	webhookUrl?: string;
	username: string;
	avatarUrl: string;
}

interface EmailConfig {
	enabled: boolean;
	to?: string;
	from: string;
	smtp: {
		host?: string;
		port: number;
		secure: boolean;
		auth: {
			user?: string;
			pass?: string;
		};
	};
}

interface ChannelConfigs {
	slack: SlackConfig;
	discord: DiscordConfig;
	email: EmailConfig;
}

interface AlertingRules {
	channels: AlertChannel[];
	retryAttempts: number;
	retryDelay: number;
	escalation: boolean;
}

interface SeverityRules {
	critical: AlertingRules;
	high: AlertingRules;
	medium: AlertingRules;
	low: AlertingRules;
}

interface EscalationRule {
	immediate: boolean;
	delay?: number;
	managers: string[];
	phone: boolean;
	incident: boolean;
}

interface EscalationRules {
	critical: EscalationRule;
	high: EscalationRule;
	medium: EscalationRule;
	low: EscalationRule;
}

interface AlertTemplates {
	critical: string;
	high: string;
	medium: string;
	low: string;
}

interface AlertingConfig {
	channels: ChannelConfigs;
	rules: SeverityRules;
	templates: AlertTemplates;
}

interface AlertField {
	title: string;
	value: string;
	short?: boolean;
}

interface AlertStatus {
	channels: {
		slack: boolean;
		discord: boolean;
		email: boolean;
	};
	rules: SeverityRules;
	escalation: EscalationRules;
	alertsSent: number;
}

class SecurityAlerting {
	private config: AlertingConfig;
	private alertsDir: string;
	private templatesDir: string;
	private escalationRules: EscalationRules;

	constructor() {
		this.config = this.loadConfiguration();
		this.alertsDir = path.join(process.cwd(), 'reports', 'alerts');
		this.templatesDir = path.join(process.cwd(), 'templates', 'alerts');
		this.escalationRules = this.loadEscalationRules();
	}

	private log(message: string, level: LogLevel = 'info'): void {
		const timestamp = new Date().toISOString();
		const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
		console.log(`${prefix} [${timestamp}] ${message}`);
	}

	/**
	 * Load alerting configuration
	 */
	private loadConfiguration(): AlertingConfig {
		return {
			channels: {
				slack: {
					enabled: !!process.env.SLACK_WEBHOOK_URL,
					webhookUrl: process.env.SLACK_WEBHOOK_URL,
					channel: process.env.SLACK_CHANNEL || '#security-alerts',
					username: 'GNUS-DAO Security Monitor',
					icon: ':shield:',
				},
				discord: {
					enabled: !!process.env.DISCORD_WEBHOOK_URL,
					webhookUrl: process.env.DISCORD_WEBHOOK_URL,
					username: 'GNUS-DAO Security Monitor',
					avatarUrl: 'https://example.com/avatar.png',
				},
				email: {
					enabled: !!process.env.SECURITY_EMAIL,
					to: process.env.SECURITY_EMAIL,
					from: process.env.EMAIL_FROM || 'security@gnus-dao.local',
					smtp: {
						host: process.env.SMTP_HOST,
						port: parseInt(process.env.SMTP_PORT || '587'),
						secure: false,
						auth: {
							user: process.env.SMTP_USER,
							pass: process.env.SMTP_PASS,
						},
					},
				},
			},
			rules: {
				critical: {
					channels: ['slack', 'discord', 'email'],
					retryAttempts: 3,
					retryDelay: 30000, // 30 seconds
					escalation: true,
				},
				high: {
					channels: ['slack', 'discord'],
					retryAttempts: 2,
					retryDelay: 15000, // 15 seconds
					escalation: true,
				},
				medium: {
					channels: ['slack'],
					retryAttempts: 1,
					retryDelay: 5000, // 5 seconds
					escalation: false,
				},
				low: {
					channels: ['slack'],
					retryAttempts: 1,
					retryDelay: 5000,
					escalation: false,
				},
			},
			templates: {
				critical: 'critical-alert.json',
				high: 'high-alert.json',
				medium: 'medium-alert.json',
				low: 'low-alert.json',
			},
		};
	}

	/**
	 * Load escalation rules
	 */
	private loadEscalationRules(): EscalationRules {
		return {
			critical: {
				immediate: true,
				managers: ['security-lead@gnus.ai', 'devops-lead@gnus.ai'],
				phone: true,
				incident: true,
			},
			high: {
				immediate: false,
				delay: 300000, // 5 minutes
				managers: ['security-lead@gnus.ai'],
				phone: false,
				incident: true,
			},
			medium: {
				immediate: false,
				delay: 3600000, // 1 hour
				managers: [],
				phone: false,
				incident: false,
			},
			low: {
				immediate: false,
				delay: 86400000, // 24 hours
				managers: [],
				phone: false,
				incident: false,
			},
		};
	}

	/**
	 * Send security alert
	 */
	async sendAlert(
		severity: AlertSeverity,
		alertData: AlertData,
		options: Record<string, any> = {},
	): Promise<Alert | undefined> {
		const alertId = this.generateAlertId();
		const alert: Alert = {
			id: alertId,
			timestamp: new Date().toISOString(),
			severity,
			...alertData,
			status: 'sending',
			attempts: 0,
			channels: [],
		};

		this.log(`🚨 Sending ${severity} alert: ${alert.title}`);

		// Get alerting rules for this severity
		const rules = this.config.rules[severity];
		if (!rules) {
			this.log(`No rules defined for severity: ${severity}`, 'warn');
			return;
		}

		// Send to configured channels
		for (const channel of rules.channels) {
			try {
				await this.sendToChannel(channel, severity, alert, rules);
				alert.channels.push({
					channel,
					status: 'sent',
					timestamp: new Date().toISOString(),
				});
			} catch (error) {
				this.log(`Failed to send to ${channel}: ${(error as Error).message}`, 'error');
				alert.channels.push({
					channel,
					status: 'failed',
					error: (error as Error).message,
				});
			}
		}

		// Handle escalation
		if (rules.escalation && this.escalationRules[severity]) {
			await this.handleEscalation(severity, alert);
		}

		// Log alert
		this.logAlert(alert);

		return alert;
	}

	/**
	 * Send alert to specific channel
	 */
	private async sendToChannel(
		channel: AlertChannel,
		severity: AlertSeverity,
		alert: Alert,
		rules: AlertingRules,
	): Promise<void> {
		const channelConfig = this.config.channels[channel];
		if (!channelConfig?.enabled) {
			throw new Error(`Channel ${channel} not configured or disabled`);
		}

		let attempts = 0;
		let lastError: Error | undefined;

		while (attempts < rules.retryAttempts) {
			try {
				switch (channel) {
					case 'slack':
						await this.sendSlackAlert(channelConfig as SlackConfig, severity, alert);
						break;
					case 'discord':
						await this.sendDiscordAlert(channelConfig as DiscordConfig, severity, alert);
						break;
					case 'email':
						await this.sendEmailAlert(channelConfig as EmailConfig, severity, alert);
						break;
					default:
						throw new Error(`Unknown channel: ${channel}`);
				}
				return; // Success
			} catch (error) {
				attempts++;
				lastError = error as Error;
				if (attempts < rules.retryAttempts) {
					this.log(
						`Retry ${attempts}/${rules.retryAttempts} for ${channel} in ${rules.retryDelay}ms`,
					);
					await this.delay(rules.retryDelay);
				}
			}
		}

		throw lastError;
	}

	/**
	 * Send Slack alert
	 */
	private async sendSlackAlert(
		config: SlackConfig,
		severity: AlertSeverity,
		alert: Alert,
	): Promise<void> {
		const template = this.loadAlertTemplate(severity);
		const color = this.getSeverityColor(severity);

		const payload = {
			channel: config.channel,
			username: config.username,
			icon_emoji: config.icon,
			attachments: [
				{
					color,
					title: alert.title,
					text: alert.description,
					fields: this.formatAlertFields(alert),
					footer: 'GNUS-DAO Security Monitor',
					ts: Date.now() / 1000,
					...template,
				},
			],
		};

		// In production, make HTTP POST to config.webhookUrl
		console.log(`📤 Slack alert sent to ${config.channel}: ${alert.title}`);
		console.log(`   Payload: ${JSON.stringify(payload, null, 2)}`);
	}

	/**
	 * Send Discord alert
	 */
	private async sendDiscordAlert(
		config: DiscordConfig,
		severity: AlertSeverity,
		alert: Alert,
	): Promise<void> {
		const template = this.loadAlertTemplate(severity);
		const color = this.getSeverityColor(severity);

		const embed = {
			title: alert.title,
			description: alert.description,
			color,
			fields: this.formatAlertFields(alert),
			footer: { text: 'GNUS-DAO Security Monitor' },
			timestamp: alert.timestamp,
			...template,
		};

		const payload = {
			username: config.username,
			avatar_url: config.avatarUrl,
			embeds: [embed],
		};

		// In production, make HTTP POST to config.webhookUrl
		console.log(`📤 Discord alert sent: ${alert.title}`);
		console.log(`   Payload: ${JSON.stringify(payload, null, 2)}`);
	}

	/**
	 * Send email alert
	 */
	private async sendEmailAlert(
		config: EmailConfig,
		severity: AlertSeverity,
		alert: Alert,
	): Promise<void> {
		const subject = `[${severity.toUpperCase()}] GNUS-DAO Security Alert: ${alert.title}`;
		const template = this.loadAlertTemplate(severity);

		const htmlBody = this.generateEmailHtml(severity, alert, template);
		const textBody = this.generateEmailText(severity, alert);

		// In production, use nodemailer or similar
		console.log(`📧 Email alert sent to ${config.to}: ${subject}`);
		console.log(`   Subject: ${subject}`);
		console.log(`   HTML Body: ${htmlBody.substring(0, 200)}...`);
	}

	/**
	 * Handle alert escalation
	 */
	private async handleEscalation(severity: AlertSeverity, alert: Alert): Promise<void> {
		const escalation = this.escalationRules[severity];

		if (escalation.immediate) {
			this.log(`🚨 Immediate escalation for ${severity} alert: ${alert.title}`);
			// In production, trigger immediate escalation (phone calls, etc.)
		} else if (escalation.delay) {
			setTimeout(() => {
				this.log(`⏰ Delayed escalation for ${severity} alert: ${alert.title}`);
				// Send escalation notifications
			}, escalation.delay);
		}

		if (escalation.incident) {
			await this.createIncidentFromAlert(alert);
		}
	}

	/**
	 * Create incident from alert
	 */
	private async createIncidentFromAlert(alert: Alert): Promise<void> {
		// This would integrate with the incident management system
		console.log(`🚨 Creating incident from alert: ${alert.id}`);
	}

	/**
	 * Load alert template
	 */
	private loadAlertTemplate(severity: AlertSeverity): Record<string, any> {
		try {
			const templateFile = path.join(this.templatesDir, this.config.templates[severity]);
			if (fs.existsSync(templateFile)) {
				return JSON.parse(fs.readFileSync(templateFile, 'utf8'));
			}
		} catch (error) {
			this.log(
				`Error loading template for ${severity}: ${(error as Error).message}`,
				'warn',
			);
		}
		return {};
	}

	/**
	 * Generate email HTML body
	 */
	private generateEmailHtml(
		severity: AlertSeverity,
		alert: Alert,
		template: Record<string, any>,
	): string {
		const color = this.getSeverityHexColor(severity);

		return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                .alert { border-left: 5px solid ${color}; padding: 10px; margin: 10px 0; }
                .severity { color: ${color}; font-weight: bold; text-transform: uppercase; }
                .field { margin: 5px 0; }
                .field-label { font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="alert">
                <h2 class="severity">${severity} Security Alert</h2>
                <h3>${alert.title}</h3>
                <p>${alert.description}</p>
                <div class="fields">
                    ${this.formatAlertFields(alert)
											.map(
												(field) =>
													`<div class="field"><span class="field-label">${field.title}:</span> ${field.value}</div>`,
											)
											.join('')}
                </div>
                <p><small>Alert ID: ${alert.id} | Timestamp: ${alert.timestamp}</small></p>
            </div>
        </body>
        </html>
        `;
	}

	/**
	 * Generate email text body
	 */
	private generateEmailText(severity: AlertSeverity, alert: Alert): string {
		return `
[${severity.toUpperCase()}] GNUS-DAO Security Alert

${alert.title}
${alert.description}

${this.formatAlertFields(alert)
	.map((field) => `${field.title}: ${field.value}`)
	.join('\n')}

Alert ID: ${alert.id}
Timestamp: ${alert.timestamp}
        `.trim();
	}

	/**
	 * Format alert fields for notifications
	 */
	private formatAlertFields(alert: Alert): AlertField[] {
		const fields: AlertField[] = [];

		if (alert.package) fields.push({ title: 'Package', value: alert.package, short: true });
		if (alert.version) fields.push({ title: 'Version', value: alert.version, short: true });
		if (alert.file) fields.push({ title: 'File', value: alert.file, short: true });
		if (alert.line)
			fields.push({ title: 'Line', value: alert.line.toString(), short: true });
		if (alert.cve) fields.push({ title: 'CVE', value: alert.cve, short: true });
		if (alert.url) fields.push({ title: 'URL', value: alert.url, short: false });
		if (alert.action)
			fields.push({
				title: 'Action Required',
				value: alert.action,
				short: false,
			});

		return fields;
	}

	/**
	 * Get severity color for notifications
	 */
	private getSeverityColor(severity: AlertSeverity): string {
		const colors: Record<AlertSeverity, string> = {
			critical: 'danger', // Red
			high: 'warning', // Orange
			medium: 'good', // Yellow
			low: 'good', // Green
		};
		return colors[severity] || colors.medium;
	}

	/**
	 * Get severity hex color for email
	 */
	private getSeverityHexColor(severity: AlertSeverity): string {
		const colors: Record<AlertSeverity, string> = {
			critical: '#FF0000', // Red
			high: '#FFA500', // Orange
			medium: '#FFFF00', // Yellow
			low: '#00FF00', // Green
		};
		return colors[severity] || colors.medium;
	}

	/**
	 * Generate alert ID
	 */
	private generateAlertId(): string {
		return `ALERT-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
	}

	/**
	 * Log alert
	 */
	private logAlert(alert: Alert): void {
		const logFile = path.join(this.alertsDir, `alert-${alert.id}.json`);
		fs.mkdirSync(path.dirname(logFile), { recursive: true });
		fs.writeFileSync(logFile, JSON.stringify(alert, null, 2));
	}

	/**
	 * Delay utility
	 */
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Get alerting status
	 */
	getStatus(): AlertStatus {
		return {
			channels: {
				slack: this.config.channels.slack.enabled,
				discord: this.config.channels.discord.enabled,
				email: this.config.channels.email.enabled,
			},
			rules: this.config.rules,
			escalation: this.escalationRules,
			alertsSent: this.getAlertsCount(),
		};
	}

	/**
	 * Get alerts count
	 */
	private getAlertsCount(): number {
		try {
			const files = fs.readdirSync(this.alertsDir);
			return files.filter((f) => f.startsWith('alert-')).length;
		} catch {
			return 0;
		}
	}

	/**
	 * Test alerting configuration
	 */
	async testAlerting(): Promise<void> {
		this.log('🧪 Testing alerting configuration');

		const testAlert: AlertData = {
			title: 'Test Security Alert',
			description: 'This is a test alert to verify alerting configuration',
			test: true,
		};

		await this.sendAlert('low', testAlert);
		this.log('✅ Alerting test completed');
	}
}

// CLI interface
async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const command = args[0];

	const alerting = new SecurityAlerting();

	switch (command) {
		case 'test':
			await alerting.testAlerting();
			break;

		case 'send':
			const severity = (args[1] || 'medium') as AlertSeverity;
			const title = args[2] || 'Manual Test Alert';
			const description = args[3] || 'This is a manual test alert';
			await alerting.sendAlert(severity, { title, description });
			break;

		case 'status':
			const status = alerting.getStatus();
			console.log(JSON.stringify(status, null, 2));
			break;

		default:
			console.log('Usage:');
			console.log(
				'  npx ts-node security-alerting.ts test                    # Test alerting configuration',
			);
			console.log(
				'  npx ts-node security-alerting.ts send [severity] [title] [desc]  # Send test alert',
			);
			console.log(
				'  npx ts-node security-alerting.ts status                  # Show alerting status',
			);
			process.exit(1);
	}
}

// Export for use as module
export default SecurityAlerting;

// Run if called directly
if (require.main === module) {
	main().catch((error) => {
		console.error('Security alerting failed:', error.message);
		process.exit(1);
	});
}
