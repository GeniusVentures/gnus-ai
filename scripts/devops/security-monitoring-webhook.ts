#!/usr/bin/env node

/**
 * GNUS-DAO Security Monitoring Webhook Handler
 * Processes GitHub security events and triggers automated responses
 * Integrates with alerting systems and incident response workflows
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface WebhookConfig {
	github: {
		webhookSecret?: string;
		appId?: string;
		privateKey?: string;
	};
	alerting: {
		slackWebhook?: string;
		discordWebhook?: string;
		emailTo: string;
	};
	thresholds: {
		critical: number;
		high: number;
		medium: number;
		low: number;
	};
	monitoring: {
		enabled: boolean;
		logEvents: boolean;
		autoResponse: boolean;
	};
}

interface WebhookHeaders {
	'x-github-event': string;
	'x-github-delivery': string;
	'x-hub-signature-256'?: string;
	[key: string]: string | undefined;
}

interface WebhookPayload {
	[key: string]: unknown;
}

interface SecurityAdvisory {
	summary: string;
	description: string;
	severity: string;
	vulnerabilities?: Array<{
		package: {
			name: string;
		};
	}>;
	references?: Array<{
		url: string;
	}>;
}

interface DependabotAlert {
	security_vulnerability?: {
		summary: string;
		description?: string;
		severity: string;
		identifiers?: Array<{
			type: string;
			value: string;
		}>;
	};
	dependency?: {
		package?: {
			name: string;
		};
		manifest_path?: string;
	};
	html_url: string;
}

interface SecretScanningAlert {
	secret_type: string;
	path: string;
	html_url: string;
}

interface CodeScanningAlert {
	rule?: {
		description: string;
		security_severity_level?: string;
		id?: string;
	};
	most_recent_instance?: {
		message?: {
			text: string;
		};
		location?: {
			path: string;
			start_line?: number;
		};
	};
	html_url: string;
}

interface RepositoryVulnerabilityAlert {
	security_vulnerability?: {
		summary: string;
		description: string;
		severity: string;
	};
	dependency?: {
		package?: {
			name: string;
		};
	};
	html_url: string;
}

interface WorkflowRun {
	name: string;
	conclusion: string;
	run_number: number;
	id: number;
	html_url: string;
	head_branch: string;
}

interface PushPayload {
	commits?: Array<{
		id: string;
		added?: string[];
		modified?: string[];
		removed?: string[];
	}>;
	head_commit?: {
		author?: {
			name: string;
		};
	};
	ref: string;
}

interface IncidentData {
	type: string;
	severity: 'critical' | 'high' | 'medium' | 'low';
	title: string;
	description: string;
	affectedPackages?: string[];
	references?: string[];
	package?: string;
	version?: string;
	file?: string;
	secretType?: string;
	line?: number;
	rule?: string;
	eventId: string;
	url?: string;
	cve?: string;
	author?: string;
	branch?: string;
}

interface AlertData {
	title: string;
	description: string;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'error';
	affectedPackages?: string[];
	references?: string[];
	package?: string;
	version?: string;
	file?: string;
	line?: number;
	url?: string;
	cve?: string;
	secretType?: string;
	workflow?: string;
	runId?: number;
	author?: string;
	branch?: string;
	action?: string;
	files?: Array<{ file: string; commit: string }>;
	rule?: string;
}

interface ProcessedAlert extends AlertData {
	timestamp: string;
}

interface SlackField {
	title: string;
	value: string;
	short: boolean;
}

interface SlackAttachment {
	color: number;
	title: string;
	text: string;
	fields: SlackField[];
	footer: string;
	ts: number;
}

interface DiscordEmbed {
	title: string;
	description: string;
	color: number;
	fields: SlackField[];
	footer: { text: string };
	timestamp: string;
}

interface Incident {
	id: string;
	status: 'active' | 'resolved' | 'closed';
	created: string;
	type: string;
	severity: 'critical' | 'high' | 'medium' | 'low';
	title: string;
	description: string;
	eventId: string;
	[key: string]: unknown;
}

interface DailyMetrics {
	date: string;
	events: { [eventType: string]: number };
	alerts: { [severity: string]: number };
	incidents: { [eventType: string]: number };
}

interface MetricsData {
	[date: string]: DailyMetrics;
}

interface MonitoringStatus {
	monitoring: boolean;
	alerting: {
		slack: boolean;
		discord: boolean;
		email: boolean;
	};
	eventsProcessed: number;
	incidentsActive: number;
	metrics: {
		today: DailyMetrics;
		totalEvents: number;
		totalAlerts: number;
	};
}

interface SecurityEventLog {
	timestamp: string;
	eventType: string;
	eventId: string;
	payload: WebhookPayload;
	processed: boolean;
}

class SecurityMonitoringWebhook {
	private eventsDir: string;
	private incidentsDir: string;
	private metricsDir: string;
	private config: WebhookConfig;
	private alertManager: AlertManager;
	private incidentManager: IncidentManager;
	private metricsCollector: MetricsCollector;

	constructor() {
		this.eventsDir = path.join(process.cwd(), 'reports', 'security-events');
		this.incidentsDir = path.join(process.cwd(), 'reports', 'incidents');
		this.metricsDir = path.join(process.cwd(), 'reports', 'metrics');
		this.config = this.loadConfiguration();
		this.alertManager = new AlertManager(this.config);
		this.incidentManager = new IncidentManager(this.config);
		this.metricsCollector = new MetricsCollector(this.config);
	}

	private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
		const timestamp: string = new Date().toISOString();
		const prefix: string = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
		console.log(`${prefix} [${timestamp}] ${message}`);
	}

	/**
	 * Load monitoring configuration
	 */
	private loadConfiguration(): WebhookConfig {
		return {
			github: {
				webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
				appId: process.env.GITHUB_APP_ID,
				privateKey: process.env.GITHUB_PRIVATE_KEY,
			},
			alerting: {
				slackWebhook: process.env.SLACK_WEBHOOK_URL,
				discordWebhook: process.env.DISCORD_WEBHOOK_URL,
				emailTo: process.env.SECURITY_EMAIL || 'security@gnus.ai',
			},
			thresholds: {
				critical: 9.0,
				high: 7.0,
				medium: 4.0,
				low: 0.1,
			},
			monitoring: {
				enabled: true,
				logEvents: true,
				autoResponse: true,
			},
		};
	}

	/**
	 * Process GitHub webhook payload
	 */
	async processWebhook(
		headers: WebhookHeaders,
		body: WebhookPayload | string,
	): Promise<{ status: string; eventId: string }> {
		try {
			// Verify webhook signature
			if (!this.verifySignature(headers, body)) {
				throw new Error('Invalid webhook signature');
			}

			const eventType: string = headers['x-github-event'];
			const eventId: string = headers['x-github-delivery'];

			this.log(`Processing ${eventType} event: ${eventId}`);

			// Parse event payload
			const payload: WebhookPayload = typeof body === 'string' ? JSON.parse(body) : body;

			// Log event
			if (this.config.monitoring.logEvents) {
				this.logSecurityEvent(eventType, eventId, payload);
			}

			// Process event based on type
			await this.processEvent(eventType, payload, eventId);

			// Update metrics
			await this.metricsCollector.updateMetrics(eventType, payload);

			return { status: 'processed', eventId };
		} catch (error) {
			this.log(`Webhook processing failed: ${(error as Error).message}`, 'error');
			await this.alertManager.sendAlert('error', {
				title: 'Security Monitoring Error',
				description: `Failed to process webhook: ${(error as Error).message}`,
				severity: 'high',
			});
			throw error;
		}
	}

	/**
	 * Verify GitHub webhook signature
	 */
	private verifySignature(headers: WebhookHeaders, body: WebhookPayload | string): boolean {
		const signature: string | undefined = headers['x-hub-signature-256'];
		if (!signature) return false;

		const expectedSignature: string = crypto
			.createHmac('sha256', this.config.github.webhookSecret || '')
			.update(typeof body === 'string' ? body : JSON.stringify(body))
			.digest('hex');

		const actualSignature: string = signature.replace('sha256=', '');
		return crypto.timingSafeEqual(
			Buffer.from(expectedSignature, 'hex'),
			Buffer.from(actualSignature, 'hex'),
		);
	}

	/**
	 * Process different types of security events
	 */
	private async processEvent(
		eventType: string,
		payload: WebhookPayload,
		eventId: string,
	): Promise<void> {
		switch (eventType) {
			case 'security_advisory':
				await this.handleSecurityAdvisory(payload, eventId);
				break;

			case 'dependabot_alert':
				await this.handleDependabotAlert(payload, eventId);
				break;

			case 'secret_scanning_alert':
				await this.handleSecretScanningAlert(payload, eventId);
				break;

			case 'code_scanning_alert':
				await this.handleCodeScanningAlert(payload, eventId);
				break;

			case 'repository_vulnerability_alert':
				await this.handleRepositoryVulnerabilityAlert(payload, eventId);
				break;

			case 'workflow_run':
				await this.handleWorkflowRun(payload, eventId);
				break;

			case 'push':
				await this.handlePush(payload as unknown as PushPayload, eventId);
				break;

			default:
				this.log(`Unhandled event type: ${eventType}`);
		}
	}

	/**
	 * Handle security advisory events
	 */
	private async handleSecurityAdvisory(
		payload: WebhookPayload,
		eventId: string,
	): Promise<void> {
		const advisory: SecurityAdvisory =
			payload.security_advisory as unknown as SecurityAdvisory;
		const severity: string = this.mapSeverity(advisory.severity);

		this.log(`Security advisory: ${advisory.summary} (${severity})`);

		if (severity === 'critical') {
			await this.incidentManager.createIncident({
				type: 'security_advisory',
				severity: 'critical',
				title: `Critical Security Advisory: ${advisory.summary}`,
				description: advisory.description,
				affectedPackages: advisory.vulnerabilities?.map((v) => v.package.name) || [],
				references: advisory.references?.map((r) => r.url) || [],
				eventId,
			});
		}

		await this.alertManager.sendAlert(severity as 'critical' | 'high' | 'medium' | 'low', {
			title: `Security Advisory: ${advisory.summary}`,
			description: advisory.description,
			severity: severity as 'critical' | 'high' | 'medium' | 'low',
			affectedPackages: advisory.vulnerabilities?.map((v) => v.package.name) || [],
			references: advisory.references?.map((r) => r.url) || [],
		});
	}

	/**
	 * Handle Dependabot alerts
	 */
	private async handleDependabotAlert(
		payload: WebhookPayload,
		eventId: string,
	): Promise<void> {
		const alert: DependabotAlert = payload.alert as unknown as DependabotAlert;
		const severity: string = this.mapSeverity(
			alert.security_vulnerability?.severity || 'medium',
		);

		this.log(`Dependabot alert: ${alert.security_vulnerability?.summary} (${severity})`);

		if (severity === 'critical' || severity === 'high') {
			await this.incidentManager.createIncident({
				type: 'dependabot_alert',
				severity: severity as 'critical' | 'high' | 'medium' | 'low',
				title: `Dependency Vulnerability: ${alert.security_vulnerability?.summary}`,
				description: alert.security_vulnerability?.description || '',
				package: alert.dependency?.package?.name,
				version: alert.dependency?.manifest_path,
				references: [alert.html_url],
				eventId,
			});
		}

		await this.alertManager.sendAlert(severity as 'critical' | 'high' | 'medium' | 'low', {
			title: `Dependency Alert: ${alert.dependency?.package?.name}`,
			description: alert.security_vulnerability?.summary || '',
			severity: severity as 'critical' | 'high' | 'medium' | 'low',
			package: alert.dependency?.package?.name,
			version: alert.dependency?.manifest_path,
			cve: alert.security_vulnerability?.identifiers?.find((id) => id.type === 'CVE')
				?.value,
			url: alert.html_url,
		});
	}

	/**
	 * Handle secret scanning alerts
	 */
	private async handleSecretScanningAlert(
		payload: WebhookPayload,
		eventId: string,
	): Promise<void> {
		const alert: SecretScanningAlert = payload.alert as unknown as SecretScanningAlert;
		const severity: 'high' = 'high'; // Secret leaks are always high priority

		this.log(`Secret scanning alert: ${alert.secret_type} in ${alert.path}`);

		await this.incidentManager.createIncident({
			type: 'secret_leak',
			severity: 'critical',
			title: `Secret Leak Detected: ${alert.secret_type}`,
			description: `Potential secret leak detected in ${alert.path}`,
			file: alert.path,
			secretType: alert.secret_type,
			url: alert.html_url,
			eventId,
		});

		await this.alertManager.sendAlert('critical', {
			title: '🚨 SECRET LEAK DETECTED',
			description: `Secret of type ${alert.secret_type} detected in ${alert.path}`,
			severity: 'critical',
			file: alert.path,
			url: alert.html_url,
			action: 'IMMEDIATE ACTION REQUIRED',
		});
	}

	/**
	 * Handle code scanning alerts
	 */
	private async handleCodeScanningAlert(
		payload: WebhookPayload,
		eventId: string,
	): Promise<void> {
		const alert: CodeScanningAlert = payload.alert as unknown as CodeScanningAlert;
		const severity: string = this.mapSeverity(
			alert.rule?.security_severity_level || 'medium',
		);

		this.log(`Code scanning alert: ${alert.rule?.description} (${severity})`);

		if (severity === 'critical' || severity === 'high') {
			await this.incidentManager.createIncident({
				type: 'code_vulnerability',
				severity: severity as 'critical' | 'high' | 'medium' | 'low',
				title: `Code Vulnerability: ${alert.rule?.description}`,
				description:
					alert.most_recent_instance?.message?.text || alert.rule?.description || '',
				file: alert.most_recent_instance?.location?.path,
				line: alert.most_recent_instance?.location?.start_line,
				rule: alert.rule?.id,
				url: alert.html_url,
				eventId,
			});
		}

		await this.alertManager.sendAlert(severity as 'critical' | 'high' | 'medium' | 'low', {
			title: `Code Scan: ${alert.rule?.description}`,
			description:
				alert.most_recent_instance?.message?.text || alert.rule?.description || '',
			severity: severity as 'critical' | 'high' | 'medium' | 'low',
			file: alert.most_recent_instance?.location?.path,
			line: alert.most_recent_instance?.location?.start_line,
			rule: alert.rule?.id,
			url: alert.html_url,
		});
	}

	/**
	 * Handle repository vulnerability alerts
	 */
	private async handleRepositoryVulnerabilityAlert(
		payload: WebhookPayload,
		eventId: string,
	): Promise<void> {
		const alert: RepositoryVulnerabilityAlert =
			payload.alert as unknown as RepositoryVulnerabilityAlert;
		const severity: string = this.mapSeverity(
			alert.security_vulnerability?.severity || 'medium',
		);

		this.log(
			`Repository vulnerability: ${alert.security_vulnerability?.summary} (${severity})`,
		);

		await this.alertManager.sendAlert(severity as 'critical' | 'high' | 'medium' | 'low', {
			title: `Repository Vulnerability: ${alert.security_vulnerability?.summary}`,
			description: alert.security_vulnerability?.description || '',
			severity: severity as 'critical' | 'high' | 'medium' | 'low',
			package: alert.dependency?.package?.name,
			url: alert.html_url,
		});
	}

	/**
	 * Handle workflow run events (for CI/CD monitoring)
	 */
	private async handleWorkflowRun(payload: WebhookPayload, eventId: string): Promise<void> {
		const workflow: WorkflowRun = payload.workflow_run as unknown as WorkflowRun;

		if (workflow.conclusion === 'failure') {
			// Check if it's a security-related failure
			const isSecurityFailure: boolean =
				workflow.name.toLowerCase().includes('security') ||
				workflow.name.toLowerCase().includes('scan');

			if (isSecurityFailure) {
				this.log(`Security workflow failure: ${workflow.name}`);

				await this.alertManager.sendAlert('high', {
					title: `Security Workflow Failed: ${workflow.name}`,
					description: `Security workflow failed in run #${workflow.run_number}`,
					severity: 'high',
					workflow: workflow.name,
					runId: workflow.id,
					url: workflow.html_url,
					branch: workflow.head_branch,
				});
			}
		}
	}

	/**
	 * Handle push events (for monitoring sensitive file changes)
	 */
	private async handlePush(payload: PushPayload, eventId: string): Promise<void> {
		const commits = payload.commits || [];
		const sensitiveFiles: Array<{ file: string; commit: string }> = [];
		const diamondFiles: Array<{ file: string; commit: string }> = [];

		for (const commit of commits) {
			const files: string[] = [
				...(commit.added || []),
				...(commit.modified || []),
				...(commit.removed || []),
			];

			for (const file of files) {
				if (this.isSensitiveFile(file)) {
					sensitiveFiles.push({ file, commit: commit.id });
				}
				if (this.isDiamondFile(file)) {
					diamondFiles.push({ file, commit: commit.id });
				}
			}
		}

		if (sensitiveFiles.length > 0) {
			await this.alertManager.sendAlert('medium', {
				title: 'Sensitive Files Modified',
				description: `${sensitiveFiles.length} sensitive files were modified`,
				severity: 'medium',
				files: sensitiveFiles,
				author: payload.head_commit?.author?.name,
				branch: payload.ref.replace('refs/heads/', ''),
			});
		}

		if (diamondFiles.length > 0) {
			this.log(`Diamond proxy files modified: ${diamondFiles.length}`);
			// Could trigger additional Diamond-specific security checks
		}
	}

	/**
	 * Check if file is sensitive
	 */
	private isSensitiveFile(filePath: string): boolean {
		const sensitivePatterns: RegExp[] = [
			/\.env$/,
			/config.*\.json$/,
			/secrets?\//,
			/private/,
			/key/,
			/\.pem$/,
			/\.key$/,
		];

		return sensitivePatterns.some((pattern) => pattern.test(filePath));
	}

	/**
	 * Check if file is Diamond-related
	 */
	private isDiamondFile(filePath: string): boolean {
		const diamondPatterns: RegExp[] = [/diamond/i, /facet/i, /proxy/i, /upgrade/i];

		return (
			diamondPatterns.some((pattern) => pattern.test(filePath)) &&
			(filePath.endsWith('.sol') || filePath.includes('contracts'))
		);
	}

	/**
	 * Map severity levels
	 */
	private mapSeverity(severity: string): string {
		const severityMap: { [key: string]: string } = {
			critical: 'critical',
			high: 'high',
			medium: 'medium',
			moderate: 'medium',
			low: 'low',
			info: 'low',
		};

		return severityMap[severity?.toLowerCase()] || 'medium';
	}

	/**
	 * Log security event
	 */
	private logSecurityEvent(
		eventType: string,
		eventId: string,
		payload: WebhookPayload,
	): void {
		const eventLog: SecurityEventLog = {
			timestamp: new Date().toISOString(),
			eventType,
			eventId,
			payload,
			processed: true,
		};

		const logFile: string = path.join(this.eventsDir, `event-${eventId}.json`);
		fs.mkdirSync(path.dirname(logFile), { recursive: true });
		fs.writeFileSync(logFile, JSON.stringify(eventLog, null, 2));
	}

	/**
	 * Get monitoring status
	 */
	getStatus(): MonitoringStatus {
		return {
			monitoring: this.config.monitoring.enabled,
			alerting: {
				slack: !!this.config.alerting.slackWebhook,
				discord: !!this.config.alerting.discordWebhook,
				email: !!this.config.alerting.emailTo,
			},
			eventsProcessed: this.getEventsCount(),
			incidentsActive: this.incidentManager.getActiveIncidentsCount(),
			metrics: this.metricsCollector.getMetricsSummary(),
		};
	}

	/**
	 * Get events count
	 */
	private getEventsCount(): number {
		try {
			const files: string[] = fs.readdirSync(this.eventsDir);
			return files.filter((f) => f.startsWith('event-')).length;
		} catch {
			return 0;
		}
	}
}

// Alert Manager Class
class AlertManager {
	private config: WebhookConfig;

	constructor(config: WebhookConfig) {
		this.config = config;
	}

	async sendAlert(severity: string, alertData: AlertData): Promise<void> {
		const alert: ProcessedAlert = {
			timestamp: new Date().toISOString(),
			...alertData,
		};

		console.log(`🚨 Sending ${severity} alert: ${alert.title}`);

		// Send to Slack
		if (this.config.alerting.slackWebhook) {
			await this.sendSlackAlert(severity, alert);
		}

		// Send to Discord
		if (this.config.alerting.discordWebhook) {
			await this.sendDiscordAlert(severity, alert);
		}

		// Send email (would integrate with email service)
		if (this.config.alerting.emailTo) {
			await this.sendEmailAlert(severity, alert);
		}
	}

	private async sendSlackAlert(severity: string, alert: ProcessedAlert): Promise<void> {
		const color: number = this.getSeverityColor(severity);
		const payload: { attachments: SlackAttachment[] } = {
			attachments: [
				{
					color,
					title: alert.title,
					text: alert.description,
					fields: this.formatAlertFields(alert),
					footer: 'GNUS-DAO Security Monitor',
					ts: Date.now() / 1000,
				},
			],
		};

		// In production, make HTTP request to Slack webhook
		console.log(`📤 Slack alert sent: ${alert.title}`);
	}

	private async sendDiscordAlert(severity: string, alert: ProcessedAlert): Promise<void> {
		const color: number = this.getSeverityColor(severity);
		const embed: DiscordEmbed = {
			title: alert.title,
			description: alert.description,
			color,
			fields: this.formatAlertFields(alert),
			footer: { text: 'GNUS-DAO Security Monitor' },
			timestamp: new Date().toISOString(),
		};

		// In production, make HTTP request to Discord webhook
		console.log(`📤 Discord alert sent: ${alert.title}`);
	}

	private async sendEmailAlert(severity: string, alert: ProcessedAlert): Promise<void> {
		const subject: string = `[${severity.toUpperCase()}] GNUS-DAO Security Alert: ${alert.title}`;

		// In production, send email via service
		console.log(`📧 Email alert sent: ${subject}`);
	}

	private getSeverityColor(severity: string): number {
		const colors: { [key: string]: number } = {
			critical: 0xff0000, // Red
			high: 0xffa500, // Orange
			medium: 0xffff00, // Yellow
			low: 0x00ff00, // Green
			error: 0xff0000, // Red
		};
		return colors[severity] || colors.medium;
	}

	private formatAlertFields(alert: ProcessedAlert): SlackField[] {
		const fields: SlackField[] = [];

		if (alert.package) fields.push({ title: 'Package', value: alert.package, short: true });
		if (alert.file) fields.push({ title: 'File', value: alert.file, short: true });
		if (alert.line)
			fields.push({ title: 'Line', value: alert.line.toString(), short: true });
		if (alert.url) fields.push({ title: 'URL', value: alert.url, short: false });
		if (alert.cve) fields.push({ title: 'CVE', value: alert.cve, short: true });

		return fields;
	}
}

// Incident Manager Class
class IncidentManager {
	private config: WebhookConfig;
	private incidentsDir: string;

	constructor(config: WebhookConfig) {
		this.config = config;
		this.incidentsDir = path.join(process.cwd(), 'reports', 'incidents');
	}

	async createIncident(incidentData: IncidentData): Promise<Incident> {
		const incident: Incident = {
			id: this.generateIncidentId(),
			status: 'active',
			created: new Date().toISOString(),
			...incidentData,
		};

		const incidentFile: string = path.join(
			this.incidentsDir,
			`incident-${incident.id}.json`,
		);
		fs.mkdirSync(path.dirname(incidentFile), { recursive: true });
		fs.writeFileSync(incidentFile, JSON.stringify(incident, null, 2));

		console.log(`🚨 Incident created: ${incident.id} - ${incident.title}`);

		return incident;
	}

	private generateIncidentId(): string {
		return `INC-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
	}

	getActiveIncidentsCount(): number {
		try {
			const files: string[] = fs.readdirSync(this.incidentsDir);
			const incidents: Incident[] = files
				.filter((f) => f.startsWith('incident-'))
				.map((f) => JSON.parse(fs.readFileSync(path.join(this.incidentsDir, f), 'utf8')))
				.filter((inc) => inc.status === 'active');
			return incidents.length;
		} catch {
			return 0;
		}
	}
}

// Metrics Collector Class
class MetricsCollector {
	private config: WebhookConfig;
	private metricsDir: string;

	constructor(config: WebhookConfig) {
		this.config = config;
		this.metricsDir = path.join(process.cwd(), 'reports', 'metrics');
	}

	async updateMetrics(eventType: string, payload: WebhookPayload): Promise<void> {
		const metrics: MetricsData = this.loadMetrics();
		const today: string = new Date().toISOString().split('T')[0];

		if (!metrics[today]) {
			metrics[today] = {
				date: today,
				events: {},
				alerts: {},
				incidents: {},
			};
		}

		// Update event counts
		metrics[today].events[eventType] = (metrics[today].events[eventType] || 0) + 1;

		// Update alert counts based on event type
		if (
			['security_advisory', 'dependabot_alert', 'secret_scanning_alert'].includes(eventType)
		) {
			const severity: string = this.determineSeverity(eventType, payload);
			metrics[today].alerts[severity] = (metrics[today].alerts[severity] || 0) + 1;
		}

		this.saveMetrics(metrics);
	}

	private determineSeverity(eventType: string, payload: WebhookPayload): string {
		switch (eventType) {
			case 'secret_scanning_alert':
				return 'critical';
			case 'security_advisory':
				return (payload as any).security_advisory?.severity || 'medium';
			case 'dependabot_alert':
				return (payload as any).alert?.security_vulnerability?.severity || 'medium';
			default:
				return 'medium';
		}
	}

	private loadMetrics(): MetricsData {
		try {
			const metricsFile: string = path.join(this.metricsDir, 'security-metrics.json');
			if (fs.existsSync(metricsFile)) {
				return JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
			}
		} catch (error) {
			console.error('Error loading metrics:', (error as Error).message);
		}
		return {};
	}

	private saveMetrics(metrics: MetricsData): void {
		const metricsFile: string = path.join(this.metricsDir, 'security-metrics.json');
		fs.mkdirSync(path.dirname(metricsFile), { recursive: true });
		fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));
	}

	getMetricsSummary(): { today: DailyMetrics; totalEvents: number; totalAlerts: number } {
		const metrics: MetricsData = this.loadMetrics();
		const today: string = new Date().toISOString().split('T')[0];
		const todayMetrics: DailyMetrics = metrics[today] || {
			date: today,
			events: {},
			alerts: {},
			incidents: {},
		};

		return {
			today: todayMetrics,
			totalEvents: Object.values(todayMetrics.events).reduce(
				(sum, count) => sum + count,
				0,
			),
			totalAlerts: Object.values(todayMetrics.alerts).reduce(
				(sum, count) => sum + count,
				0,
			),
		};
	}
}

// CLI interface
async function main(): Promise<void> {
	const args: string[] = process.argv.slice(2);
	const command: string = args[0];

	const webhook: SecurityMonitoringWebhook = new SecurityMonitoringWebhook();

	switch (command) {
		case 'process':
			// Simulate processing a webhook (for testing)
			const mockHeaders: WebhookHeaders = {
				'x-github-event': 'dependabot_alert',
				'x-github-delivery': 'test-delivery-id',
				'x-hub-signature-256': 'sha256=test',
			};
			const mockBody: WebhookPayload = {
				alert: {
					security_vulnerability: {
						summary: 'Test vulnerability',
						severity: 'high',
					},
					dependency: {
						package: { name: 'test-package' },
						manifest_path: 'package.json',
					},
					html_url: 'https://github.com/test',
				},
			};
			await webhook.processWebhook(mockHeaders, mockBody);
			break;

		case 'status':
			const status: MonitoringStatus = webhook.getStatus();
			console.log(JSON.stringify(status, null, 2));
			break;

		default:
			console.log('Usage:');
			console.log(
				'  npx ts-node security-monitoring-webhook.ts process  # Process test webhook',
			);
			console.log(
				'  npx ts-node security-monitoring-webhook.ts status   # Show monitoring status',
			);
			process.exit(1);
	}
}

// Export for use as module
export default SecurityMonitoringWebhook;

// Run if called directly
if (require.main === module) {
	main().catch((error: Error) => {
		console.error('Security monitoring failed:', error.message);
		process.exit(1);
	});
}
