#!/usr/bin/env npx ts-node

/**
 * GNUS-DAO Automated Incident Response System
 * Handles incident creation, escalation, and automated response workflows
 * Integrates with security monitoring and alerting systems
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Type definitions
interface TimelineEntry {
	timestamp: string;
	action: string;
	details: string;
	actor: string;
}

interface Incident {
	id: string;
	title: string;
	description: string;
	severity: 'low' | 'medium' | 'high' | 'critical';
	status: 'active' | 'investigating' | 'resolved' | 'closed';
	created: string;
	updated: string;
	source: string;
	category: string;
	affected: string[];
	evidence: string[];
	assigned: string | null;
	timeline: TimelineEntry[];
	tags: string[];
	priority: number;
	playbook: string | null;
}

interface IncidentData {
	title: string;
	description: string;
	severity?: 'low' | 'medium' | 'high' | 'critical';
	source?: string;
	category?: string;
	affected?: string[];
	evidence?: string[];
	tags?: string[];
}

interface EscalationConfig {
	immediate: boolean;
	managers: string[];
	channels: string[];
	timeout: number;
}

interface EscalationConfiguration {
	critical: EscalationConfig;
	high: EscalationConfig;
	medium: EscalationConfig;
	low: EscalationConfig;
}

interface AutoResponseRule {
	trigger: string;
	actions: string[];
}

interface AutoResponseConfig {
	enabled: boolean;
	rules: AutoResponseRule[];
}

interface PlaybookConfig {
	[key: string]: string;
}

interface IncidentResponseConfig {
	escalation: EscalationConfiguration;
	autoResponse: AutoResponseConfig;
	playbooks: PlaybookConfig;
}

interface SystemStatus {
	activeIncidents: number;
	totalIncidents: number;
	escalationConfig: EscalationConfiguration;
	autoResponseEnabled: boolean;
}

class IncidentResponseSystem {
	private incidentsDir: string;
	private playbooksDir: string;
	private config: IncidentResponseConfig;
	private incidentCounter: number;

	constructor() {
		this.incidentsDir = path.join(process.cwd(), 'reports', 'incidents');
		this.playbooksDir = path.join(process.cwd(), 'docs', 'incident-playbooks');
		this.config = this.loadConfiguration();
		this.incidentCounter = this.getNextIncidentId();
	}

	log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
		const timestamp = new Date().toISOString();
		const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
		console.log(`${prefix} [${timestamp}] ${message}`);
	}

	/**
	 * Load incident response configuration
	 */
	loadConfiguration(): IncidentResponseConfig {
		return {
			escalation: {
				critical: {
					immediate: true,
					managers: ['security-lead@gnus.ai', 'cto@gnus.ai'],
					channels: ['slack-security', 'email-managers'],
					timeout: 300000, // 5 minutes
				},
				high: {
					immediate: false,
					managers: ['security-lead@gnus.ai'],
					channels: ['slack-security'],
					timeout: 1800000, // 30 minutes
				},
				medium: {
					immediate: false,
					managers: [],
					channels: ['slack-security'],
					timeout: 3600000, // 1 hour
				},
				low: {
					immediate: false,
					managers: [],
					channels: [],
					timeout: 86400000, // 24 hours
				},
			},
			autoResponse: {
				enabled: true,
				rules: [
					{
						trigger: 'diamond-upgrade-failed',
						actions: ['pause-deployments', 'notify-team', 'rollback'],
					},
					{
						trigger: 'security-scan-failed',
						actions: ['block-merge', 'notify-security', 'create-ticket'],
					},
					{
						trigger: 'dependency-vulnerability',
						actions: ['update-dependency', 'security-review', 'notify-team'],
					},
				],
			},
			playbooks: {
				'diamond-security-breach': 'diamond-security-response.md',
				'contract-exploit': 'contract-exploit-response.md',
				'dependency-compromise': 'dependency-compromise-response.md',
				'access-breach': 'access-breach-response.md',
			},
		};
	}

	/**
	 * Create a new incident
	 */
	async createIncident(incidentData: IncidentData): Promise<Incident> {
		this.log('🚨 Creating new security incident');

		const incident: Incident = {
			id: this.generateIncidentId(),
			title: incidentData.title,
			description: incidentData.description,
			severity: incidentData.severity || 'medium',
			status: 'active',
			created: new Date().toISOString(),
			updated: new Date().toISOString(),
			source: incidentData.source || 'monitoring',
			category: incidentData.category || 'general',
			affected: incidentData.affected || [],
			evidence: incidentData.evidence || [],
			assigned: null,
			timeline: [
				{
					timestamp: new Date().toISOString(),
					action: 'incident-created',
					details: 'Security incident automatically created by monitoring system',
					actor: 'system',
				},
			],
			tags: incidentData.tags || [],
			priority: this.calculatePriority(incidentData),
			playbook: this.selectPlaybook(incidentData),
		};

		// Save incident
		await this.saveIncident(incident);

		// Execute automated responses
		await this.executeAutoResponse(incident);

		// Handle escalation
		await this.handleEscalation(incident);

		// Notify relevant parties
		await this.notifyIncidentCreated(incident);

		this.log(`✅ Incident created: ${incident.id} - ${incident.title}`);
		return incident;
	}

	/**
	 * Update incident status
	 */
	async updateIncident(incidentId: string, updates: Partial<Incident>): Promise<Incident> {
		// Validate incident ID before processing
		const sanitizedId = this.sanitizeIncidentId(incidentId);

		const incident = await this.loadIncident(sanitizedId);
		if (!incident) {
			throw new Error(`Incident ${sanitizedId} not found`);
		}

		// Update incident
		Object.assign(incident, updates, {
			updated: new Date().toISOString(),
		});

		// Add timeline entry
		incident.timeline.push({
			timestamp: new Date().toISOString(),
			action: 'status-updated',
			details: `Status changed to ${updates.status}`,
			actor: 'system',
		});

		// Save updated incident
		await this.saveIncident(incident);

		// Handle status-specific actions
		await this.handleStatusChange(incident, updates.status!);

		this.log(`📝 Incident updated: ${sanitizedId} - ${updates.status}`);
		return incident;
	}

	/**
	 * Execute automated response for incident
	 */
	async executeAutoResponse(incident: Incident): Promise<void> {
		if (!this.config.autoResponse.enabled) {
			return;
		}

		this.log(`🤖 Executing automated response for incident ${incident.id}`);

		const matchingRules = this.config.autoResponse.rules.filter((rule) =>
			this.matchesTrigger(incident, rule.trigger),
		);

		for (const rule of matchingRules) {
			await this.executeActions(incident, rule.actions);
		}
	}

	/**
	 * Check if incident matches trigger
	 */
	matchesTrigger(incident: Incident, trigger: string): boolean {
		const triggerMap: { [key: string]: () => boolean } = {
			'diamond-upgrade-failed': () =>
				incident.category === 'diamond' &&
				incident.title.includes('upgrade') &&
				incident.title.includes('failed'),
			'security-scan-failed': () =>
				incident.category === 'security' &&
				incident.title.includes('scan') &&
				incident.title.includes('failed'),
			'dependency-vulnerability': () =>
				incident.category === 'dependency' && incident.tags.includes('vulnerability'),
			'contract-exploit': () =>
				incident.category === 'contract' && incident.tags.includes('exploit'),
		};

		return triggerMap[trigger] ? triggerMap[trigger]() : false;
	}

	/**
	 * Execute automated actions
	 */
	async executeActions(incident: Incident, actions: string[]): Promise<void> {
		for (const action of actions) {
			await this.executeAction(incident, action);
		}
	}

	/**
	 * Execute single action
	 */
	async executeAction(incident: Incident, action: string): Promise<void> {
		this.log(`⚡ Executing action: ${action} for incident ${incident.id}`);

		const actionMap: { [key: string]: () => Promise<void> } = {
			'pause-deployments': async () => {
				// Implementation would pause CI/CD deployments
				this.log('⏸️ Deployments paused');
			},
			'block-merge': async () => {
				// Implementation would block PR merges
				this.log('🚫 PR merges blocked');
			},
			'notify-team': async () => {
				await this.notifyTeam(incident);
			},
			'notify-security': async () => {
				await this.notifySecurityTeam(incident);
			},
			'create-ticket': async () => {
				await this.createSupportTicket(incident);
			},
			rollback: async () => {
				await this.rollbackChanges(incident);
			},
			'update-dependency': async () => {
				await this.updateDependency(incident);
			},
			'security-review': async () => {
				await this.requestSecurityReview(incident);
			},
		};

		if (actionMap[action]) {
			try {
				await actionMap[action]();
				incident.timeline.push({
					timestamp: new Date().toISOString(),
					action: 'auto-action-executed',
					details: `Automated action executed: ${action}`,
					actor: 'system',
				});
			} catch (error) {
				this.log(`Error executing action ${action}: ${(error as Error).message}`, 'error');
			}
		}
	}

	/**
	 * Handle incident escalation
	 */
	async handleEscalation(incident: Incident): Promise<void> {
		const escalationConfig = this.config.escalation[incident.severity];
		if (!escalationConfig) {
			return;
		}

		this.log(
			`📈 Handling escalation for incident ${incident.id} (severity: ${incident.severity})`,
		);

		// Immediate escalation for critical incidents
		if (escalationConfig.immediate) {
			await this.escalateImmediately(incident, escalationConfig);
		}

		// Set escalation timeout
		setTimeout(async () => {
			const currentIncident = await this.loadIncident(incident.id);
			if (currentIncident && currentIncident.status === 'active') {
				await this.escalateTimeout(incident, escalationConfig);
			}
		}, escalationConfig.timeout);
	}

	/**
	 * Immediate escalation
	 */
	async escalateImmediately(incident: Incident, config: EscalationConfig): Promise<void> {
		this.log(`🚨 Immediate escalation for incident ${incident.id}`);

		// Notify managers
		for (const manager of config.managers) {
			await this.sendEscalationEmail(incident, manager);
		}

		// Notify channels
		for (const channel of config.channels) {
			await this.sendChannelNotification(incident, channel);
		}

		incident.timeline.push({
			timestamp: new Date().toISOString(),
			action: 'immediate-escalation',
			details: `Immediate escalation triggered for ${incident.severity} severity incident`,
			actor: 'system',
		});
	}

	/**
	 * Timeout escalation
	 */
	async escalateTimeout(incident: Incident, config: EscalationConfig): Promise<void> {
		this.log(`⏰ Timeout escalation for incident ${incident.id}`);

		// Escalate to next level
		const nextLevel = this.getNextEscalationLevel(incident.severity);

		incident.timeline.push({
			timestamp: new Date().toISOString(),
			action: 'timeout-escalation',
			details: `Timeout escalation triggered, escalating to ${nextLevel}`,
			actor: 'system',
		});

		// Update incident severity and re-escalate
		await this.updateIncident(incident.id, {
			severity: nextLevel,
		} as Partial<Incident>);
	}

	/**
	 * Get next escalation level
	 */
	getNextEscalationLevel(currentLevel: string): 'low' | 'medium' | 'high' | 'critical' {
		const levels: ('low' | 'medium' | 'high' | 'critical')[] = [
			'low',
			'medium',
			'high',
			'critical',
		];
		const currentIndex = levels.indexOf(
			currentLevel as 'low' | 'medium' | 'high' | 'critical',
		);
		return levels[Math.min(currentIndex + 1, levels.length - 1)];
	}

	/**
	 * Handle status change actions
	 */
	async handleStatusChange(
		incident: Incident,
		newStatus: Incident['status'],
	): Promise<void> {
		switch (newStatus) {
			case 'resolved':
				await this.handleResolution(incident);
				break;
			case 'closed':
				await this.handleClosure(incident);
				break;
			case 'investigating':
				await this.handleInvestigation(incident);
				break;
		}
	}

	/**
	 * Handle incident resolution
	 */
	async handleResolution(incident: Incident): Promise<void> {
		this.log(`✅ Incident resolved: ${incident.id}`);

		// Send resolution notifications
		await this.notifyResolution(incident);

		// Generate post-mortem if critical/high
		if (['critical', 'high'].includes(incident.severity)) {
			await this.generatePostMortem(incident);
		}

		// Update metrics
		await this.updateMetrics(incident);
	}

	/**
	 * Handle incident closure
	 */
	async handleClosure(incident: Incident): Promise<void> {
		this.log(`🔒 Incident closed: ${incident.id}`);

		// Archive incident data
		await this.archiveIncident(incident);

		// Clean up temporary measures
		await this.cleanupTemporaryMeasures(incident);
	}

	/**
	 * Handle investigation start
	 */
	async handleInvestigation(incident: Incident): Promise<void> {
		this.log(`🔍 Investigation started for incident: ${incident.id}`);

		// Assign investigator if not assigned
		if (!incident.assigned) {
			const investigator = await this.assignInvestigator(incident);
			if (investigator) {
				await this.updateIncident(incident.id, {
					assigned: investigator,
				});
			}
		}

		// Load and provide playbook
		if (incident.playbook) {
			await this.providePlaybook(incident);
		}
	}

	/**
	 * Generate incident ID
	 */
	generateIncidentId(): string {
		const timestamp = Date.now();
		const random = crypto.randomBytes(4).toString('hex').toUpperCase();
		return `INC-${timestamp}-${random}`;
	}

	/**
	 * Get next incident ID counter
	 */
	getNextIncidentId(): number {
		try {
			const counterFile = path.join(this.incidentsDir, 'counter.txt');
			if (fs.existsSync(counterFile)) {
				const counter = parseInt(fs.readFileSync(counterFile, 'utf8'));
				fs.writeFileSync(counterFile, (counter + 1).toString());
				return counter + 1;
			}
		} catch {
			// Create counter file
		}

		fs.mkdirSync(this.incidentsDir, { recursive: true });
		fs.writeFileSync(path.join(this.incidentsDir, 'counter.txt'), '1');
		return 1;
	}

	/**
	 * Calculate incident priority
	 */
	calculatePriority(incidentData: IncidentData): number {
		const severityWeights: { [key: string]: number } = {
			critical: 4,
			high: 3,
			medium: 2,
			low: 1,
		};
		const categoryWeights: { [key: string]: number } = {
			diamond: 3,
			contract: 3,
			security: 3,
			dependency: 2,
			access: 2,
			general: 1,
		};

		const severityWeight = severityWeights[incidentData.severity || 'medium'] || 2;
		const categoryWeight = categoryWeights[incidentData.category || 'general'] || 1;

		return severityWeight * categoryWeight;
	}

	/**
	 * Select appropriate playbook
	 */
	selectPlaybook(incidentData: IncidentData): string | null {
		const playbookMap: { [key: string]: () => boolean } = {
			'diamond-security-breach': () =>
				incidentData.category === 'diamond' &&
				(incidentData.tags?.includes('breach') ?? false),
			'contract-exploit': () =>
				incidentData.category === 'contract' &&
				(incidentData.tags?.includes('exploit') ?? false),
			'dependency-compromise': () =>
				incidentData.category === 'dependency' &&
				(incidentData.tags?.includes('compromise') ?? false),
			'access-breach': () =>
				incidentData.category === 'access' &&
				(incidentData.tags?.includes('breach') ?? false),
		};

		for (const [playbook, condition] of Object.entries(playbookMap)) {
			if (condition()) {
				return this.config.playbooks[playbook];
			}
		}

		return null;
	}

	/**
	 * Validate incident ID to prevent path traversal attacks
	 */
	validateIncidentId(incidentId: string): boolean {
		// Only allow alphanumeric characters, hyphens, and underscores
		// Must start with INC- followed by timestamp and random string
		// Explicitly prevent path traversal characters
		if (!incidentId || typeof incidentId !== 'string') {
			return false;
		}

		// Check for path traversal characters
		const forbiddenChars = ['/', '\\', '..', '.', '\0'];
		for (const char of forbiddenChars) {
			if (incidentId.includes(char)) {
				return false;
			}
		}

		const incidentIdRegex = /^INC-\d+-[A-F0-9]+$/;
		return incidentIdRegex.test(incidentId) && incidentId.length <= 50;
	}

	/**
	 * Sanitize incident ID input
	 */
	sanitizeIncidentId(incidentId: string): string {
		if (!this.validateIncidentId(incidentId)) {
			throw new Error(`Invalid incident ID format: ${incidentId}`);
		}
		return incidentId;
	}

	/**
	 * Save incident to file
	 */
	async saveIncident(incident: Incident): Promise<void> {
		// Validate incident ID before using it in file operations
		const sanitizedId = this.sanitizeIncidentId(incident.id);

		const fileName = `incident-${sanitizedId}.json`;
		// Use path.basename to ensure we only get the filename, preventing directory traversal
		const safeFileName = path.basename(fileName);
		const filePath = path.join(this.incidentsDir, safeFileName);

		// Ensure the file path is within the expected directory
		const resolvedPath = path.resolve(filePath);
		const resolvedDir = path.resolve(this.incidentsDir);
		if (!resolvedPath.startsWith(resolvedDir)) {
			throw new Error('Invalid file path: path traversal detected');
		}

		// Additional check: ensure the filename matches expected pattern
		if (!safeFileName.match(/^incident-INC-\d+-[A-F0-9]+\.json$/)) {
			throw new Error('Invalid filename pattern');
		}

		try {
			fs.mkdirSync(path.dirname(filePath), { recursive: true });
			fs.writeFileSync(filePath, JSON.stringify(incident, null, 2));
			this.log(`Incident ${sanitizedId} saved successfully`, 'info');
		} catch (error) {
			this.log(
				`Error saving incident ${sanitizedId}: ${(error as Error).message}`,
				'error',
			);
			throw error;
		}
	}

	/**
	 * Load incident from file
	 */
	async loadIncident(incidentId: string): Promise<Incident | null> {
		// Validate incident ID before using it in file operations
		const sanitizedId = this.sanitizeIncidentId(incidentId);

		const fileName = `incident-${sanitizedId}.json`;
		// Use path.basename to ensure we only get the filename, preventing directory traversal
		const safeFileName = path.basename(fileName);
		const filePath = path.join(this.incidentsDir, safeFileName);

		// Ensure the file path is within the expected directory
		const resolvedPath = path.resolve(filePath);
		const resolvedDir = path.resolve(this.incidentsDir);
		if (!resolvedPath.startsWith(resolvedDir)) {
			throw new Error('Invalid file path: path traversal detected');
		}

		// Additional check: ensure the filename matches expected pattern
		if (!safeFileName.match(/^incident-INC-\d+-[A-F0-9]+\.json$/)) {
			throw new Error('Invalid filename pattern');
		}

		try {
			if (fs.existsSync(filePath)) {
				return JSON.parse(fs.readFileSync(filePath, 'utf8'));
			}
		} catch (error) {
			this.log(
				`Error loading incident ${sanitizedId}: ${(error as Error).message}`,
				'error',
			);
		}

		return null;
	}

	/**
	 * Get all active incidents
	 */
	async getActiveIncidents(): Promise<Incident[]> {
		const incidents: Incident[] = [];
		try {
			const files = fs.readdirSync(this.incidentsDir);
			for (const file of files) {
				if (file.startsWith('incident-') && file.endsWith('.json')) {
					try {
						const incident: Incident = JSON.parse(
							fs.readFileSync(path.join(this.incidentsDir, file), 'utf8'),
						);
						// Validate incident ID format before using
						if (this.validateIncidentId(incident.id) && incident.status === 'active') {
							incidents.push(incident);
						}
					} catch (parseError) {
						this.log(
							`Error parsing incident file ${file}: ${(parseError as Error).message}`,
							'error',
						);
					}
				}
			}
		} catch (error) {
			this.log(`Error loading active incidents: ${(error as Error).message}`, 'error');
		}

		return incidents;
	}

	/**
	 * Notification methods (implementations would integrate with actual services)
	 */
	async notifyIncidentCreated(incident: Incident): Promise<void> {
		this.log(`📢 Notifying incident creation: ${incident.id}`);
		// Implementation would send notifications via Slack, email, etc.
	}

	async notifyTeam(incident: Incident): Promise<void> {
		this.log(`👥 Notifying team about incident: ${incident.id}`);
	}

	async notifySecurityTeam(incident: Incident): Promise<void> {
		this.log(`🛡️ Notifying security team about incident: ${incident.id}`);
	}

	async notifyResolution(incident: Incident): Promise<void> {
		this.log(`✅ Notifying resolution of incident: ${incident.id}`);
	}

	async sendEscalationEmail(incident: Incident, recipient: string): Promise<void> {
		this.log(`📧 Sending escalation email to ${recipient} for incident: ${incident.id}`);
	}

	async sendChannelNotification(incident: Incident, channel: string): Promise<void> {
		this.log(`💬 Sending notification to ${channel} for incident: ${incident.id}`);
	}

	async createSupportTicket(incident: Incident): Promise<void> {
		this.log(`🎫 Creating support ticket for incident: ${incident.id}`);
	}

	async rollbackChanges(incident: Incident): Promise<void> {
		this.log(`🔄 Rolling back changes for incident: ${incident.id}`);
	}

	async updateDependency(incident: Incident): Promise<void> {
		this.log(`📦 Updating dependency for incident: ${incident.id}`);
	}

	async requestSecurityReview(incident: Incident): Promise<void> {
		this.log(`🔍 Requesting security review for incident: ${incident.id}`);
	}

	async assignInvestigator(incident: Incident): Promise<string> {
		// Implementation would assign based on rotation, availability, etc.
		return 'security-investigator@gnus.ai';
	}

	async providePlaybook(incident: Incident): Promise<void> {
		this.log(`📋 Providing playbook ${incident.playbook} for incident: ${incident.id}`);
	}

	async generatePostMortem(incident: Incident): Promise<void> {
		this.log(`📝 Generating post-mortem for incident: ${incident.id}`);
	}

	async updateMetrics(incident: Incident): Promise<void> {
		this.log(`📊 Updating metrics for incident: ${incident.id}`);
	}

	async archiveIncident(incident: Incident): Promise<void> {
		this.log(`📦 Archiving incident: ${incident.id}`);
	}

	async cleanupTemporaryMeasures(incident: Incident): Promise<void> {
		this.log(`🧹 Cleaning up temporary measures for incident: ${incident.id}`);
	}

	/**
	 * Get system status
	 */
	async getStatus(): Promise<SystemStatus> {
		const activeIncidents = await this.getActiveIncidents();
		return {
			activeIncidents: activeIncidents.length,
			totalIncidents: this.getTotalIncidents(),
			escalationConfig: this.config.escalation,
			autoResponseEnabled: this.config.autoResponse.enabled,
		};
	}

	/**
	 * Get total incidents count
	 */
	getTotalIncidents(): number {
		try {
			const files = fs.readdirSync(this.incidentsDir);
			return files.filter((f) => f.startsWith('incident-')).length;
		} catch {
			return 0;
		}
	}
}

// CLI interface
async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const command = args[0];

	const incidentSystem = new IncidentResponseSystem();

	switch (command) {
		case 'create':
			const title = args[1] || 'Security Incident';
			const description = args[2] || 'Incident created via CLI';
			const severity = (args[3] as 'low' | 'medium' | 'high' | 'critical') || 'medium';
			const category = args[4] || 'general';

			// Validate inputs to prevent injection attacks
			if (typeof title !== 'string' || title.length > 200) {
				console.error('Error: Invalid title');
				process.exit(1);
			}
			if (typeof description !== 'string' || description.length > 1000) {
				console.error('Error: Invalid description');
				process.exit(1);
			}
			if (!['low', 'medium', 'high', 'critical'].includes(severity)) {
				console.error('Error: Invalid severity (must be: low, medium, high, critical)');
				process.exit(1);
			}
			if (typeof category !== 'string' || category.length > 50) {
				console.error('Error: Invalid category');
				process.exit(1);
			}

			const incidentData: IncidentData = {
				title,
				description,
				severity,
				category,
			};
			const incident = await incidentSystem.createIncident(incidentData);
			console.log(`Created incident: ${incident.id}`);
			process.exit(0);
			break;

		case 'update':
			const incidentId = args[1];
			if (!incidentId) {
				console.error('Error: incident-id is required for update command');
				process.exit(1);
			}
			// Validate incident ID format at CLI level
			if (!incidentSystem.validateIncidentId(incidentId)) {
				console.error('Error: Invalid incident ID format');
				process.exit(1);
			}
			const updateStatus = args[2] as Incident['status'];
			if (
				!updateStatus ||
				!['active', 'investigating', 'resolved', 'closed'].includes(updateStatus)
			) {
				console.error(
					'Error: Valid status is required (active, investigating, resolved, closed)',
				);
				process.exit(1);
			}
			await incidentSystem.updateIncident(incidentId, { status: updateStatus });
			console.log(`Updated incident: ${incidentId}`);
			process.exit(0);
			break;

		case 'list':
			const activeIncidents = await incidentSystem.getActiveIncidents();
			console.log('Active Incidents:');
			activeIncidents.forEach((inc) => {
				console.log(`- ${inc.id}: ${inc.title} (${inc.severity})`);
			});
			process.exit(0);
			break;

		case 'status':
			const systemStatus = await incidentSystem.getStatus();
			console.log(JSON.stringify(systemStatus, null, 2));
			process.exit(0);
			break;

		default:
			console.log('Usage:');
			console.log(
				'  npx ts-node scripts/devops/incident-response.ts create [title] [description] [severity] [category]',
			);
			console.log(
				'  npx ts-node scripts/devops/incident-response.ts update <incident-id> <status>',
			);
			console.log('  npx ts-node scripts/devops/incident-response.ts list');
			console.log('  npx ts-node scripts/devops/incident-response.ts status');
			process.exit(1);
	}
}

// Export for use as module
export default IncidentResponseSystem;

// Run if called directly
if (require.main === module) {
	main().catch((error) => {
		console.error('Incident response system failed:', error.message);
		process.exit(1);
	});
}
