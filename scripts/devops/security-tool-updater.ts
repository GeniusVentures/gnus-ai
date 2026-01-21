#!/usr/bin/env npx ts-node

/**
 * Automated Security Tool Update Manager
 * Ensures security tools are kept up-to-date with 95%+ success rate
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';

interface ToolConfig {
	current: string;
	latest: string | null;
	updateCommand: string;
	checkCommand: string;
	type: 'pip' | 'npm' | 'go' | 'binary';
}

interface UpdateLogEntry {
	tool: string;
	current: string;
	latest: string;
	status: 'pending' | 'success' | 'failed' | 'verify-failed' | 'error';
	error?: string;
}

interface UpdateReport {
	timestamp: string;
	successRate: number;
	updates: UpdateLogEntry[];
	summary: {
		total: number;
		successful: number;
		failed: number;
		errors: number;
		skipped: number;
	};
}

interface ToolVersions {
	[toolName: string]: ToolConfig;
}

class SecurityToolUpdater {
	private tools: ToolVersions;
	private updateLog: UpdateLogEntry[];
	private successRate: number;

	constructor() {
		this.tools = {
			slither: {
				current: '0.10.0',
				latest: null,
				updateCommand: 'pip install --upgrade slither-analyzer',
				checkCommand: 'slither --version',
				type: 'pip',
			},
			semgrep: {
				current: '1.57.0',
				latest: null,
				updateCommand: 'pip install --upgrade semgrep',
				checkCommand: 'semgrep --version',
				type: 'pip',
			},
			snyk: {
				current: '1.1248.0',
				latest: null,
				updateCommand: 'npm install -g snyk@latest',
				checkCommand: 'snyk --version',
				type: 'npm',
			},
			'osv-scanner': {
				current: '1.6.0',
				latest: null,
				updateCommand: 'echo "OSV scanner will be updated via binary download"',
				checkCommand: 'osv-scanner --version',
				type: 'binary',
			},
		};

		this.updateLog = [];
		this.successRate = 0;
	}

	async checkForUpdates(): Promise<void> {
		console.log('🔍 Checking for security tool updates...');

		for (const [toolName, tool] of Object.entries(this.tools)) {
			try {
				console.log(`Checking ${toolName}...`);

				// Get current version
				const currentVersion = this.getCurrentVersion(tool);
				tool.current = currentVersion;

				// Get latest version
				const latestVersion = await this.getLatestVersion(toolName, tool.type);
				tool.latest = latestVersion;

				if (this.needsUpdate(tool.current, latestVersion)) {
					console.log(`📦 ${toolName}: ${tool.current} → ${latestVersion}`);
					this.updateLog.push({
						tool: toolName,
						current: tool.current,
						latest: latestVersion || tool.current,
						status: 'pending',
					});
				} else {
					console.log(`✅ ${toolName}: ${tool.current} (up-to-date)`);
				}
			} catch (error) {
				console.error(`❌ Error checking ${toolName}:`, (error as Error).message);
				this.updateLog.push({
					tool: toolName,
					error: (error as Error).message,
					status: 'error',
				} as UpdateLogEntry);
			}
		}
	}

	private getCurrentVersion(tool: ToolConfig): string {
		try {
			const output = execSync(tool.checkCommand, { encoding: 'utf8' });
			// Extract version from output (tool-specific parsing)
			return this.parseVersion(output, tool.type);
		} catch (error) {
			console.warn(
				`Could not get current version for ${tool.checkCommand}:`,
				(error as Error).message,
			);
			return tool.current;
		}
	}

	private async getLatestVersion(toolName: string, type: string): Promise<string | null> {
		switch (type) {
			case 'pip':
				return await this.getPipLatestVersion(toolName);
			case 'npm':
				return await this.getNpmLatestVersion(toolName);
			case 'go':
				return await this.getGoLatestVersion(toolName);
			case 'binary':
				return await this.getBinaryLatestVersion(toolName);
			default:
				return null;
		}
	}

	private async getPipLatestVersion(packageName: string): Promise<string | null> {
		try {
			const output = execSync(`pip index versions ${packageName}`, {
				encoding: 'utf8',
			});
			const match = output.match(/Available versions: (.+)/);
			if (match) {
				const versions = match[1].split(',').map((v: string) => v.trim());
				return versions[0]; // Latest version
			}
		} catch (error) {
			// Fallback to PyPI API
			return new Promise((resolve, reject) => {
				https
					.get(`https://pypi.org/pypi/${packageName}/json`, (res) => {
						let data = '';
						res.on('data', (chunk: Buffer) => (data += chunk.toString()));
						res.on('end', () => {
							try {
								const info = JSON.parse(data);
								resolve(info.info.version);
							} catch (e) {
								reject(e);
							}
						});
					})
					.on('error', reject);
			});
		}
		return null;
	}

	private async getNpmLatestVersion(packageName: string): Promise<string | null> {
		try {
			const output = execSync(`npm view ${packageName} version`, {
				encoding: 'utf8',
			});
			return output.trim();
		} catch (error) {
			console.warn(`Could not get npm version for ${packageName}`);
			return null;
		}
	}

	private async getGoLatestVersion(packageName: string): Promise<string | null> {
		// For Go modules, check GitHub releases
		return new Promise((resolve, reject) => {
			const url = `https://api.github.com/repos/google/osv-scanner/releases/latest`;
			https
				.get(
					url,
					{
						headers: { 'User-Agent': 'GNUS-DAO-Security-Updater' },
					},
					(res) => {
						let data = '';
						res.on('data', (chunk: Buffer) => (data += chunk.toString()));
						res.on('end', () => {
							try {
								const release = JSON.parse(data);
								const version = release.tag_name.replace('v', '');
								resolve(version);
							} catch (e) {
								reject(e);
							}
						});
					},
				)
				.on('error', reject);
		});
	}

	private async getBinaryLatestVersion(toolName: string): Promise<string | null> {
		// For binary tools, check GitHub releases
		return new Promise((resolve, reject) => {
			let repo: string;
			switch (toolName) {
				case 'osv-scanner':
					repo = 'google/osv-scanner';
					break;
				default:
					resolve(null);
					return;
			}

			const url = `https://api.github.com/repos/${repo}/releases/latest`;
			https
				.get(
					url,
					{
						headers: { 'User-Agent': 'GNUS-DAO-Security-Updater' },
					},
					(res) => {
						let data = '';
						res.on('data', (chunk: Buffer) => (data += chunk.toString()));
						res.on('end', () => {
							try {
								const release = JSON.parse(data);
								const version = release.tag_name.replace('v', '');
								resolve(version);
							} catch (e) {
								reject(e);
							}
						});
					},
				)
				.on('error', reject);
		});
	}

	private parseVersion(output: string, type: string): string {
		switch (type) {
			case 'pip':
				const pipMatch = output.match(/(\d+\.\d+\.\d+)/);
				return pipMatch ? pipMatch[1] : 'unknown';
			case 'npm':
				return output.trim();
			case 'go':
				const goMatch = output.match(/v?(\d+\.\d+\.\d+)/);
				return goMatch ? goMatch[1] : 'unknown';
			case 'binary':
				const binaryMatch = output.match(/osv-scanner version:\s*(\d+\.\d+\.\d+)/);
				return binaryMatch ? binaryMatch[1] : 'unknown';
			default:
				return 'unknown';
		}
	}

	private needsUpdate(current: string, latest: string | null): boolean {
		if (!current || !latest) return false;

		const currentParts = current.split('.').map(Number);
		const latestParts = latest.split('.').map(Number);

		for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
			const currentPart = currentParts[i] || 0;
			const latestPart = latestParts[i] || 0;

			if (latestPart > currentPart) return true;
			if (latestPart < currentPart) return false;
		}

		return false;
	}

	private async updateOsvScannerBinary(latestVersion: string | null): Promise<void> {
		if (!latestVersion) {
			throw new Error('No latest version available for osv-scanner');
		}

		try {
			// Get the latest release info from GitHub API
			const response = await this.makeHttpsRequest(
				'https://api.github.com/repos/google/osv-scanner/releases/latest',
			);
			const releaseData = JSON.parse(response as string);
			const tagName = releaseData.tag_name;
			const version = tagName.startsWith('v') ? tagName.substring(1) : tagName;

			// Construct download URL for Linux x64 binary
			const downloadUrl = `https://github.com/google/osv-scanner/releases/download/${tagName}/osv-scanner_linux_amd64`;

			console.log(`Downloading osv-scanner ${version} from ${downloadUrl}`);

			// Download the binary
			const binaryData = await this.makeHttpsRequest(downloadUrl, true);

			// Write to temporary file
			const tempPath = '/tmp/osv-scanner';
			fs.writeFileSync(tempPath, binaryData);

			// Make executable
			fs.chmodSync(tempPath, '755');

			// Move to final location
			const finalPath = '/go/bin/osv-scanner';
			execSync(`mv ${tempPath} ${finalPath}`, { stdio: 'inherit' });

			console.log(`✅ osv-scanner updated to version ${version}`);
		} catch (error) {
			throw new Error(`Failed to update osv-scanner binary: ${(error as Error).message}`);
		}
	}

	private async makeHttpsRequest(
		url: string,
		isBinary: boolean = false,
	): Promise<string | Buffer> {
		return new Promise((resolve, reject) => {
			const makeRequest = (requestUrl: string) => {
				const request = https.get(
					requestUrl,
					{
						headers: {
							'User-Agent': 'GNUS-DAO-Security-Tool-Updater',
						},
					},
					(response) => {
						if (response.statusCode === 302 || response.statusCode === 301) {
							// Handle redirect
							const redirectUrl = response.headers.location;
							if (redirectUrl) {
								console.log(`Following redirect to: ${redirectUrl}`);
								makeRequest(redirectUrl);
								return;
							} else {
								reject(new Error('Redirect without location header'));
								return;
							}
						}

						if (response.statusCode !== 200) {
							reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
							return;
						}

						const chunks: Buffer[] = [];
						response.on('data', (chunk) => chunks.push(chunk));
						response.on('end', () => {
							const data = Buffer.concat(chunks);
							resolve(isBinary ? data : data.toString('utf-8'));
						});
					},
				);

				request.on('error', reject);
				request.setTimeout(30000, () => {
					request.destroy();
					reject(new Error('Request timeout'));
				});
			};

			makeRequest(url);
		});
	}

	async performUpdates(): Promise<void> {
		console.log('\n🔄 Performing security tool updates...');

		let successCount = 0;
		let totalCount = 0;

		for (const update of this.updateLog) {
			if (update.status === 'pending') {
				totalCount++;
				try {
					console.log(`Updating ${update.tool}...`);

					// Handle binary downloads specially
					if (this.tools[update.tool].type === 'binary') {
						await this.updateOsvScannerBinary(update.latest);
					} else {
						execSync(this.tools[update.tool].updateCommand, {
							stdio: 'inherit',
							timeout: 300000, // 5 minutes timeout
						});
					}

					// Verify update
					const newVersion = this.getCurrentVersion(this.tools[update.tool]);
					if (newVersion === update.latest) {
						update.status = 'success';
						successCount++;
						console.log(`✅ ${update.tool} updated successfully to ${newVersion}`);
					} else {
						update.status = 'verify-failed';
						console.log(
							`⚠️ ${update.tool} update reported success but version verification failed`,
						);
					}
				} catch (error) {
					update.status = 'failed';
					update.error = (error as Error).message;
					console.error(`❌ Failed to update ${update.tool}:`, (error as Error).message);
				}
			}
		}

		this.successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 100;
		console.log(`\n📊 Update Success Rate: ${this.successRate.toFixed(1)}%`);
	}

	private updateToolVersionsFile(): void {
		console.log('\n📝 Updating .tool-versions file...');

		const toolVersionsPath = path.join(process.cwd(), '.tool-versions');
		let content = '';

		for (const [toolName, tool] of Object.entries(this.tools)) {
			if (tool.latest) {
				content += `${toolName} ${tool.latest}\n`;
			} else {
				content += `${toolName} ${tool.current}\n`;
			}
		}

		fs.writeFileSync(toolVersionsPath, content);
		console.log('✅ .tool-versions file updated');
	}

	private generateReport(): UpdateReport {
		const report: UpdateReport = {
			timestamp: new Date().toISOString(),
			successRate: this.successRate,
			updates: this.updateLog,
			summary: {
				total: this.updateLog.length,
				successful: this.updateLog.filter((u) => u.status === 'success').length,
				failed: this.updateLog.filter((u) => u.status === 'failed').length,
				errors: this.updateLog.filter((u) => u.status === 'error').length,
				skipped: this.updateLog.filter((u) => u.status === 'pending' && !u.error).length,
			},
		};

		const reportPath = path.join(process.cwd(), 'security-tool-update-report.json');
		fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
		console.log(`📄 Report saved to ${reportPath}`);

		return report;
	}

	async run(): Promise<UpdateReport> {
		try {
			console.log('🚀 Starting Automated Security Tool Update Process\n');

			await this.checkForUpdates();
			await this.performUpdates();
			this.updateToolVersionsFile();
			const report = this.generateReport();

			// Exit with error if success rate is below 95%
			if (this.successRate < 95) {
				console.error(
					`❌ Update success rate (${this.successRate.toFixed(1)}%) is below 95% threshold`,
				);
				process.exit(1);
			}

			console.log(
				`\n🎉 Security tool updates completed successfully with ${this.successRate.toFixed(1)}% success rate`,
			);
			return report;
		} catch (error) {
			console.error(
				'💥 Critical error during security tool updates:',
				(error as Error).message,
			);
			process.exit(1);
		}
	}
}

// CLI interface
if (require.main === module) {
	const updater = new SecurityToolUpdater();
	updater.run().catch(console.error);
}

export default SecurityToolUpdater;
