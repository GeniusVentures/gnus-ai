#!/usr/bin/env node

/**
 * GNUS-DAO Security Metrics Dashboard
 * Generates security metrics reports and visualizations
 * Tracks security posture over time and provides insights
 */

import * as fs from 'fs';
import * as path from 'path';

interface DashboardConfig {
	metrics: {
		retention: number;
		updateInterval: number;
		thresholds: {
			criticalEvents: number;
			highEvents: number;
			mediumEvents: number;
			incidents: number;
		};
	};
	reports: {
		daily: boolean;
		weekly: boolean;
		monthly: boolean;
		formats: string[];
	};
	dashboard: {
		enabled: boolean;
		refreshInterval: number;
		charts: string[];
	};
}

interface MetricsData {
	[date: string]: {
		events?: { [type: string]: number };
		alerts?: { [severity: string]: number };
		incidents?: number;
	};
}

interface Incident {
	id: string;
	title: string;
	description: string;
	severity: 'critical' | 'high' | 'medium' | 'low';
	status: 'active' | 'resolved' | 'closed';
	created: string;
	updated: string;
	assignedTo?: string;
}

interface Alert {
	id: string;
	type: string;
	severity: 'critical' | 'high' | 'medium' | 'low';
	message: string;
	timestamp: string;
	source: string;
}

interface PeriodSummary {
	days: number;
	start: string;
	end: string;
}

interface EventsSummary {
	total: number;
	byType: { [type: string]: number };
	bySeverity: { critical: number; high: number; medium: number; low: number };
}

interface AlertsSummary {
	total: number;
	bySeverity: { critical: number; high: number; medium: number; low: number };
}

interface IncidentsSummary {
	total: number;
	active: number;
	resolved: number;
	bySeverity: { critical: number; high: number; medium: number; low: number };
}

interface HealthSummary {
	score: number;
	status: string;
}

interface SummaryMetrics {
	period: PeriodSummary;
	events: EventsSummary;
	alerts: AlertsSummary;
	incidents: IncidentsSummary;
	health: HealthSummary;
}

interface DetailedMetrics {
	dailyBreakdown: Array<{
		date: string;
		events: number;
		alerts: number;
		incidents: number;
	}>;
	topEventTypes: Array<{
		type: string;
		count: number;
	}>;
	topAlertTypes: Array<{
		type: string;
		count: number;
	}>;
	responseTimes: { [key: string]: number };
	compliance: { [key: string]: boolean };
}

interface MetricsSummary {
	totalMetrics: number;
	totalIncidents: number;
	totalAlerts: number;
	lastUpdated: string;
}

interface ChartSeriesData {
	x: string | number;
	y: number;
}

interface ChartSeries {
	name: string;
	data?: ChartSeriesData[];
	value?: number;
	color?: string;
}

interface TrendData {
	change: number;
	direction: 'increasing' | 'decreasing' | 'stable';
}

interface Trends {
	events: TrendData;
	alerts: TrendData;
	incidents: TrendData;
}

interface Recommendation {
	priority: 'critical' | 'high' | 'medium' | 'low';
	category: string;
	recommendation: string;
	impact: string;
	effort: string;
}

interface ChartData {
	type: string;
	title: string;
	xAxis?: string;
	yAxis?: string;
	series?: ChartSeries[];
	data?: ChartSeriesData[];
}

interface SecurityReport {
	generated: string;
	period: string;
	title: string;
	summary: SummaryMetrics;
	metrics: DetailedMetrics;
	trends: Trends;
	recommendations: Recommendation[];
	charts?: { [key: string]: ChartData };
}

interface GenerateOptions {
	period?: string;
	format?: string;
	includeCharts?: boolean;
}

interface DashboardStatus {
	enabled: boolean;
	lastReport?: string;
	totalReports: number;
	nextUpdate?: string;
}

class SecurityMetricsDashboard {
	private metricsDir: string;
	private reportsDir: string;
	private dashboardDir: string;
	private config: DashboardConfig;

	constructor() {
		this.metricsDir = path.join(process.cwd(), 'reports', 'metrics');
		this.reportsDir = path.join(process.cwd(), 'reports', 'security');
		this.dashboardDir = path.join(process.cwd(), 'reports', 'dashboard');
		this.config = this.loadConfiguration();
	}

	private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
		const timestamp: string = new Date().toISOString();
		const prefix: string = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
		console.log(`${prefix} [${timestamp}] ${message}`);
	}

	/**
	 * Load dashboard configuration
	 */
	private loadConfiguration(): DashboardConfig {
		return {
			metrics: {
				retention: 90, // days
				updateInterval: 3600000, // 1 hour
				thresholds: {
					criticalEvents: 10,
					highEvents: 50,
					mediumEvents: 100,
					incidents: 5,
				},
			},
			reports: {
				daily: true,
				weekly: true,
				monthly: true,
				formats: ['json', 'html', 'markdown'],
			},
			dashboard: {
				enabled: true,
				refreshInterval: 300000, // 5 minutes
				charts: ['timeline', 'severity', 'trends', 'incidents'],
			},
		};
	}

	/**
	 * Generate comprehensive security metrics report
	 */
	async generateMetricsReport(options: GenerateOptions = {}): Promise<SecurityReport> {
		this.log('📊 Generating security metrics report');

		const { period = 'weekly', format = 'json', includeCharts = true } = options;

		const report: SecurityReport = {
			generated: new Date().toISOString(),
			period,
			title: `GNUS-DAO Security Metrics Report - ${period}`,
			summary: {} as SummaryMetrics,
			metrics: {
				dailyBreakdown: [],
				topEventTypes: [],
				topAlertTypes: [],
				responseTimes: {},
				compliance: {},
			},
			trends: {} as Trends,
			recommendations: [],
		};

		// Load metrics data
		const metrics: MetricsData = this.loadMetricsData();
		const incidents: Incident[] = this.loadIncidentsData();
		const alerts: Alert[] = this.loadAlertsData();

		// Calculate summary metrics
		report.summary = this.calculateSummaryMetrics(metrics, incidents, alerts, period);

		// Generate detailed metrics
		report.metrics = this.generateDetailedMetrics(metrics, period);

		// Calculate trends
		report.trends = this.calculateTrends(metrics, period);

		// Generate recommendations
		report.recommendations = this.generateRecommendations(report);

		// Generate charts if requested
		if (includeCharts) {
			report.charts = await this.generateCharts(metrics, period);
		}

		// Save report in requested format
		await this.saveReport(report, format);

		// Update dashboard
		if (this.config.dashboard.enabled) {
			await this.updateDashboard(report);
		}

		this.log(`✅ Security metrics report generated: ${period} period`);
		return report;
	}

	/**
	 * Load metrics data
	 */
	private loadMetricsData(): MetricsData {
		try {
			const metricsFile: string = path.join(this.metricsDir, 'security-metrics.json');
			if (fs.existsSync(metricsFile)) {
				return JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
			}
		} catch (error) {
			this.log(`Error loading metrics data: ${(error as Error).message}`, 'warn');
		}
		return {};
	}

	/**
	 * Load incidents data
	 */
	private loadIncidentsData(): Incident[] {
		try {
			const incidentsDir: string = path.join(process.cwd(), 'reports', 'incidents');
			if (fs.existsSync(incidentsDir)) {
				const files: string[] = fs.readdirSync(incidentsDir);
				return files
					.filter((f: string) => f.startsWith('incident-'))
					.map((f: string) =>
						JSON.parse(fs.readFileSync(path.join(incidentsDir, f), 'utf8')),
					);
			}
		} catch (error) {
			this.log(`Error loading incidents data: ${(error as Error).message}`, 'warn');
		}
		return [];
	}

	/**
	 * Load alerts data
	 */
	private loadAlertsData(): Alert[] {
		try {
			const alertsDir: string = path.join(process.cwd(), 'reports', 'alerts');
			if (fs.existsSync(alertsDir)) {
				const files: string[] = fs.readdirSync(alertsDir);
				return files
					.filter((f: string) => f.startsWith('alert-'))
					.map((f: string) => JSON.parse(fs.readFileSync(path.join(alertsDir, f), 'utf8')));
			}
		} catch (error) {
			this.log(`Error loading alerts data: ${(error as Error).message}`, 'warn');
		}
		return [];
	}

	/**
	 * Calculate summary metrics
	 */
	private calculateSummaryMetrics(
		metrics: MetricsData,
		incidents: Incident[],
		alerts: Alert[],
		period: string,
	): SummaryMetrics {
		const periodDays: number = this.getPeriodDays(period);
		const cutoffDate: Date = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

		const summary: SummaryMetrics = {
			period: {
				days: periodDays,
				start: cutoffDate.toISOString(),
				end: new Date().toISOString(),
			},
			events: {
				total: 0,
				byType: {},
				bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
			},
			alerts: {
				total: 0,
				bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
			},
			incidents: {
				total: 0,
				active: 0,
				resolved: 0,
				bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
			},
			health: {
				score: 0,
				status: 'unknown',
			},
		};

		// Process metrics
		Object.entries(metrics).forEach(([date, dayMetrics]) => {
			const metricDate: Date = new Date(date);
			if (metricDate >= cutoffDate) {
				// Events
				Object.entries(dayMetrics.events || {}).forEach(([type, count]) => {
					summary.events.total += count;
					summary.events.byType[type] = (summary.events.byType[type] || 0) + count;
				});

				// Alerts by severity
				Object.entries(dayMetrics.alerts || {}).forEach(([severity, count]) => {
					summary.alerts.total += count;
					summary.alerts.bySeverity[severity as keyof typeof summary.alerts.bySeverity] =
						(summary.alerts.bySeverity[
							severity as keyof typeof summary.alerts.bySeverity
						] || 0) + count;
				});
			}
		});

		// Process incidents
		incidents.forEach((incident: Incident) => {
			const incidentDate: Date = new Date(incident.created);
			if (incidentDate >= cutoffDate) {
				summary.incidents.total++;
				if (incident.status === 'active') {
					summary.incidents.active++;
				} else {
					summary.incidents.resolved++;
				}
				summary.incidents.bySeverity[incident.severity] =
					(summary.incidents.bySeverity[incident.severity] || 0) + 1;
			}
		});

		// Calculate health score (0-100, higher is better)
		summary.health.score = this.calculateHealthScore(summary);
		summary.health.status = this.getHealthStatus(summary.health.score);

		return summary;
	}

	/**
	 * Generate detailed metrics
	 */
	private generateDetailedMetrics(metrics: MetricsData, period: string): DetailedMetrics {
		const periodDays: number = this.getPeriodDays(period);
		const detailed: DetailedMetrics = {
			dailyBreakdown: [],
			topEventTypes: [],
			topAlertTypes: [],
			responseTimes: {},
			compliance: {},
		};

		// Daily breakdown
		const cutoffDate: Date = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
		Object.entries(metrics).forEach(([date, dayMetrics]) => {
			const metricDate: Date = new Date(date);
			if (metricDate >= cutoffDate) {
				detailed.dailyBreakdown.push({
					date,
					events: Object.values(dayMetrics.events || {}).reduce(
						(sum, count) => sum + count,
						0,
					),
					alerts: Object.values(dayMetrics.alerts || {}).reduce(
						(sum, count) => sum + count,
						0,
					),
					incidents: dayMetrics.incidents || 0,
				});
			}
		});

		// Top event types
		const eventCounts: { [type: string]: number } = {};
		Object.values(metrics).forEach((dayMetrics) => {
			Object.entries(dayMetrics.events || {}).forEach(([type, count]) => {
				eventCounts[type] = (eventCounts[type] || 0) + count;
			});
		});
		detailed.topEventTypes = Object.entries(eventCounts)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 10)
			.map(([type, count]) => ({ type, count }));

		return detailed;
	}

	/**
	 * Calculate trends
	 */
	private calculateTrends(metrics: MetricsData, period: string): Trends {
		const trends: Trends = {
			events: { change: 0, direction: 'stable' },
			alerts: { change: 0, direction: 'stable' },
			incidents: { change: 0, direction: 'stable' },
		};

		const dates: string[] = Object.keys(metrics).sort();
		if (dates.length < 2) return trends;

		const midPoint: number = Math.floor(dates.length / 2);
		const firstHalf: string[] = dates.slice(0, midPoint);
		const secondHalf: string[] = dates.slice(midPoint);

		// Calculate trends for each metric
		['events', 'alerts', 'incidents'].forEach((metric: string) => {
			const firstAvg: number = this.calculateAverage(metrics, firstHalf, metric);
			const secondAvg: number = this.calculateAverage(metrics, secondHalf, metric);

			if (firstAvg > 0) {
				const change: number = ((secondAvg - firstAvg) / firstAvg) * 100;
				trends[metric as keyof Trends] = {
					change,
					direction: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable',
				};
			}
		});

		return trends;
	}

	/**
	 * Calculate average for metric over date range
	 */
	private calculateAverage(metrics: MetricsData, dates: string[], metric: string): number {
		let total: number = 0;
		let count: number = 0;

		dates.forEach((date: string) => {
			const dayMetrics = metrics[date];
			if (dayMetrics) {
				if (metric === 'events' && dayMetrics.events) {
					total += Object.values(dayMetrics.events).reduce((sum, count) => sum + count, 0);
					count++;
				} else if (metric === 'alerts' && dayMetrics.alerts) {
					total += Object.values(dayMetrics.alerts).reduce((sum, count) => sum + count, 0);
					count++;
				} else if (metric === 'incidents') {
					total += dayMetrics.incidents || 0;
					count++;
				}
			}
		});

		return count > 0 ? total / count : 0;
	}

	/**
	 * Generate recommendations based on metrics
	 */
	private generateRecommendations(report: SecurityReport): Recommendation[] {
		const recommendations: Recommendation[] = [];

		const { summary, trends } = report;

		// Event volume recommendations
		if (summary.events.total > this.config.metrics.thresholds.mediumEvents) {
			recommendations.push({
				priority: 'high',
				category: 'Event Volume',
				recommendation:
					'High event volume detected. Review monitoring thresholds and consider implementing additional filtering.',
				impact: 'Reduce noise in security monitoring',
				effort: 'Medium',
			});
		}

		// Alert severity recommendations
		if (summary.alerts.bySeverity.critical > 0) {
			recommendations.push({
				priority: 'critical',
				category: 'Critical Alerts',
				recommendation:
					'Critical alerts detected. Immediate investigation required to prevent security incidents.',
				impact: 'Prevent potential security breaches',
				effort: 'High',
			});
		}

		// Incident trends
		if (trends.incidents.direction === 'increasing') {
			recommendations.push({
				priority: 'high',
				category: 'Incident Trends',
				recommendation:
					'Incident rate is increasing. Review recent changes and security controls.',
				impact: 'Improve incident prevention',
				effort: 'Medium',
			});
		}

		// Health score recommendations
		if (summary.health.score < 70) {
			recommendations.push({
				priority: 'medium',
				category: 'Health Score',
				recommendation:
					'Security health score is below optimal. Review and address outstanding security issues.',
				impact: 'Improve overall security posture',
				effort: 'High',
			});
		}

		return recommendations;
	}

	/**
	 * Generate charts data
	 */
	private async generateCharts(
		metrics: MetricsData,
		period: string,
	): Promise<{ [key: string]: ChartData }> {
		const charts: { [key: string]: ChartData } = {
			timeline: this.generateTimelineChart(metrics, period),
			severity: this.generateSeverityChart(metrics, period),
			trends: this.generateTrendsChart(metrics, period),
			incidents: this.generateIncidentsChart(metrics, period),
		};

		return charts;
	}

	/**
	 * Generate timeline chart data
	 */
	private generateTimelineChart(metrics: MetricsData, period: string): ChartData {
		const periodDays: number = this.getPeriodDays(period);
		const cutoffDate: Date = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

		const data: Array<{ date: string; events: number; alerts: number; incidents: number }> =
			[];
		Object.entries(metrics).forEach(([date, dayMetrics]) => {
			const metricDate: Date = new Date(date);
			if (metricDate >= cutoffDate) {
				data.push({
					date,
					events: Object.values(dayMetrics.events || {}).reduce(
						(sum, count) => sum + count,
						0,
					),
					alerts: Object.values(dayMetrics.alerts || {}).reduce(
						(sum, count) => sum + count,
						0,
					),
					incidents: dayMetrics.incidents || 0,
				});
			}
		});

		return {
			type: 'line',
			title: 'Security Events Timeline',
			xAxis: 'Date',
			yAxis: 'Count',
			series: [
				{ name: 'Events', data: data.map((d) => ({ x: d.date, y: d.events })) },
				{ name: 'Alerts', data: data.map((d) => ({ x: d.date, y: d.alerts })) },
				{ name: 'Incidents', data: data.map((d) => ({ x: d.date, y: d.incidents })) },
			],
		};
	}

	/**
	 * Generate severity chart data
	 */
	private generateSeverityChart(metrics: MetricsData, period: string): ChartData {
		const severityCounts: { critical: number; high: number; medium: number; low: number } =
			{
				critical: 0,
				high: 0,
				medium: 0,
				low: 0,
			};

		Object.values(metrics).forEach((dayMetrics) => {
			Object.entries(dayMetrics.alerts || {}).forEach(([severity, count]) => {
				if (severity in severityCounts) {
					severityCounts[severity as keyof typeof severityCounts] += count;
				}
			});
		});

		return {
			type: 'pie',
			title: 'Alert Severity Distribution',
			series: Object.entries(severityCounts).map(([severity, count]) => ({
				name: severity.charAt(0).toUpperCase() + severity.slice(1),
				value: count,
				color: this.getSeverityColor(severity),
			})),
		};
	}

	/**
	 * Generate trends chart data
	 */
	private generateTrendsChart(metrics: MetricsData, period: string): ChartData {
		// Implementation for trends visualization
		return {
			type: 'bar',
			title: 'Security Trends',
			data: [], // Placeholder for trends data
		};
	}

	/**
	 * Generate incidents chart data
	 */
	private generateIncidentsChart(metrics: MetricsData, period: string): ChartData {
		// Implementation for incidents visualization
		return {
			type: 'bar',
			title: 'Incident Analysis',
			data: [], // Placeholder for incidents data
		};
	}

	/**
	 * Calculate health score
	 */
	private calculateHealthScore(summary: SummaryMetrics): number {
		let score: number = 100;

		// Deduct points for incidents
		score -= summary.incidents.total * 5;
		score -= summary.incidents.active * 10;

		// Deduct points for critical alerts
		score -= summary.alerts.bySeverity.critical * 15;
		score -= summary.alerts.bySeverity.high * 5;

		// Deduct points for high event volume
		if (summary.events.total > this.config.metrics.thresholds.mediumEvents) {
			score -= 10;
		}

		return Math.max(0, Math.min(100, score));
	}

	/**
	 * Get health status from score
	 */
	private getHealthStatus(score: number): string {
		if (score >= 90) return 'excellent';
		if (score >= 80) return 'good';
		if (score >= 70) return 'fair';
		if (score >= 60) return 'poor';
		return 'critical';
	}

	/**
	 * Get severity color
	 */
	private getSeverityColor(severity: string): string {
		const colors: { [key: string]: string } = {
			critical: '#FF0000',
			high: '#FFA500',
			medium: '#FFFF00',
			low: '#00FF00',
		};
		return colors[severity] || '#808080';
	}

	/**
	 * Get period in days
	 */
	private getPeriodDays(period: string): number {
		const periods: { [key: string]: number } = {
			daily: 1,
			weekly: 7,
			monthly: 30,
			quarterly: 90,
		};
		return periods[period] || 7;
	}

	/**
	 * Save report in specified format
	 */
	private async saveReport(report: SecurityReport, format: string): Promise<void> {
		const timestamp: string = new Date().toISOString().replace(/[:.]/g, '-');
		const baseName: string = `security-metrics-${report.period}-${timestamp}`;

		switch (format) {
			case 'json':
				fs.mkdirSync(this.reportsDir, { recursive: true });
				fs.writeFileSync(
					path.join(this.reportsDir, `${baseName}.json`),
					JSON.stringify(report, null, 2),
				);
				break;

			case 'html':
				fs.mkdirSync(this.reportsDir, { recursive: true });
				fs.writeFileSync(
					path.join(this.reportsDir, `${baseName}.html`),
					this.generateHtmlReport(report),
				);
				break;

			case 'markdown':
				fs.mkdirSync(this.reportsDir, { recursive: true });
				fs.writeFileSync(
					path.join(this.reportsDir, `${baseName}.md`),
					this.generateMarkdownReport(report),
				);
				break;
		}
	}

	/**
	 * Generate HTML report
	 */
	private generateHtmlReport(report: SecurityReport): string {
		return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${report.title}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
                .metric { display: inline-block; margin: 10px; padding: 10px; border: 1px solid #ccc; border-radius: 5px; }
                .critical { background: #ffebee; }
                .high { background: #fff3e0; }
                .medium { background: #fffde7; }
                .low { background: #e8f5e8; }
                .recommendation { margin: 10px 0; padding: 10px; border-left: 5px solid #2196F3; background: #f9f9f9; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${report.title}</h1>
                <p>Generated: ${report.generated}</p>
                <p>Period: ${report.period}</p>
            </div>

            <h2>Summary</h2>
            <div class="metric ${report.summary.health.status}">
                <strong>Health Score:</strong> ${report.summary.health.score}/100 (${report.summary.health.status})
            </div>
            <div class="metric">
                <strong>Total Events:</strong> ${report.summary.events.total}
            </div>
            <div class="metric">
                <strong>Total Alerts:</strong> ${report.summary.alerts.total}
            </div>
            <div class="metric">
                <strong>Active Incidents:</strong> ${report.summary.incidents.active}
            </div>

            <h2>Recommendations</h2>
            ${report.recommendations
							.map(
								(rec) => `
                <div class="recommendation">
                    <strong>${rec.priority.toUpperCase()}: ${rec.category}</strong>
                    <p>${rec.recommendation}</p>
                    <small>Impact: ${rec.impact} | Effort: ${rec.effort}</small>
                </div>
            `,
							)
							.join('')}

            <h2>Raw Data</h2>
            <pre>${JSON.stringify(report, null, 2)}</pre>
        </body>
        </html>
        `;
	}

	/**
	 * Generate Markdown report
	 */
	private generateMarkdownReport(report: SecurityReport): string {
		return `
# ${report.title}

**Generated:** ${report.generated}
**Period:** ${report.period}

## Summary

- **Health Score:** ${report.summary.health.score}/100 (${report.summary.health.status})
- **Total Events:** ${report.summary.events.total}
- **Total Alerts:** ${report.summary.alerts.total}
- **Active Incidents:** ${report.summary.incidents.active}

## Events by Type

${Object.entries(report.summary.events.byType)
	.map(([type, count]) => `- ${type}: ${count}`)
	.join('\n')}

## Alerts by Severity

${Object.entries(report.summary.alerts.bySeverity)
	.map(([severity, count]) => `- ${severity}: ${count}`)
	.join('\n')}

## Recommendations

${report.recommendations
	.map(
		(rec) =>
			`### ${rec.priority.toUpperCase()}: ${rec.category}\n${rec.recommendation}\n*Impact: ${rec.impact} | Effort: ${rec.effort}*`,
	)
	.join('\n\n')}

## Trends

${Object.entries(report.trends)
	.map(
		([metric, trend]) =>
			`- ${metric}: ${trend.direction} (${trend.change.toFixed(1)}% change)`,
	)
	.join('\n')}
        `.trim();
	}

	/**
	 * Update dashboard
	 */
	private async updateDashboard(report: SecurityReport): Promise<void> {
		const dashboardFile: string = path.join(this.dashboardDir, 'index.html');
		fs.mkdirSync(path.dirname(dashboardFile), { recursive: true });

		const dashboardHtml: string = this.generateDashboardHtml(report);
		fs.writeFileSync(dashboardFile, dashboardHtml);

		this.log(`📊 Dashboard updated: ${dashboardFile}`);
	}

	/**
	 * Generate dashboard HTML
	 */
	private generateDashboardHtml(report: SecurityReport): string {
		return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>GNUS-DAO Security Dashboard</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
                .dashboard { max-width: 1200px; margin: 0 auto; }
                .header { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
                .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px; }
                .metric-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .metric-value { font-size: 2em; font-weight: bold; margin: 10px 0; }
                .health-excellent { color: #4CAF50; }
                .health-good { color: #8BC34A; }
                .health-fair { color: #FFC107; }
                .health-poor { color: #FF9800; }
                .health-critical { color: #F44336; }
                .recommendations { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .recommendation { margin: 10px 0; padding: 10px; border-left: 4px solid #2196F3; background: #f8f9fa; }
                .priority-critical { border-left-color: #F44336; }
                .priority-high { border-left-color: #FF9800; }
                .priority-medium { border-left-color: #FFC107; }
                .priority-low { border-left-color: #4CAF50; }
            </style>
        </head>
        <body>
            <div class="dashboard">
                <div class="header">
                    <h1>🔒 GNUS-DAO Security Dashboard</h1>
                    <p>Last updated: ${report.generated}</p>
                    <p>Report period: ${report.period}</p>
                </div>

                <div class="metrics-grid">
                    <div class="metric-card">
                        <h3>Security Health</h3>
                        <div class="metric-value health-${report.summary.health.status}">${report.summary.health.score}/100</div>
                        <p>${report.summary.health.status.charAt(0).toUpperCase() + report.summary.health.status.slice(1)}</p>
                    </div>

                    <div class="metric-card">
                        <h3>Total Events</h3>
                        <div class="metric-value">${report.summary.events.total}</div>
                        <p>Security events monitored</p>
                    </div>

                    <div class="metric-card">
                        <h3>Active Alerts</h3>
                        <div class="metric-value">${report.summary.alerts.total}</div>
                        <p>Current security alerts</p>
                    </div>

                    <div class="metric-card">
                        <h3>Active Incidents</h3>
                        <div class="metric-value">${report.summary.incidents.active}</div>
                        <p>Incidents requiring attention</p>
                    </div>
                </div>

                <div class="recommendations">
                    <h2>🔧 Security Recommendations</h2>
                    ${
											report.recommendations.length > 0
												? report.recommendations
														.map(
															(rec) => `
                        <div class="recommendation priority-${rec.priority}">
                            <strong>${rec.priority.toUpperCase()}: ${rec.category}</strong>
                            <p>${rec.recommendation}</p>
                            <small>Impact: ${rec.impact} | Effort: ${rec.effort}</small>
                        </div>
                    `,
														)
														.join('')
												: '<p>No recommendations at this time.</p>'
										}
                </div>
            </div>
        </body>
        </html>
        `;
	}

	/**
	 * Get dashboard status
	 */
	getStatus(): DashboardStatus {
		const status: DashboardStatus = {
			enabled: this.config.dashboard.enabled,
			totalReports: this.getReportsCount(),
		};

		const lastReport: string | undefined = this.getLastReportTime();
		if (lastReport) {
			status.lastReport = lastReport;
			status.nextUpdate = new Date(
				new Date(lastReport).getTime() + this.config.dashboard.refreshInterval,
			).toISOString();
		}

		return status;
	}

	/**
	 * Get last report time
	 */
	private getLastReportTime(): string | undefined {
		try {
			if (fs.existsSync(this.reportsDir)) {
				const files: string[] = fs.readdirSync(this.reportsDir);
				const reportFiles: string[] = files.filter((f) =>
					f.startsWith('security-metrics-'),
				);

				if (reportFiles.length > 0) {
					// Sort by timestamp in filename
					reportFiles.sort((a, b) => b.localeCompare(a));
					const latestFile: string = reportFiles[0];

					// Extract timestamp from filename
					const timestampMatch = latestFile.match(
						/security-metrics-\w+-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/,
					);
					if (timestampMatch) {
						// Convert filename timestamp back to ISO format
						const ts = timestampMatch[1];
						return `${ts.slice(0, 10)}T${ts.slice(11, 13)}:${ts.slice(14, 16)}:${ts.slice(17, 19)}.${ts.slice(20, 23)}Z`;
					}
				}
			}
		} catch (error) {
			this.log(`Error getting last report time: ${(error as Error).message}`, 'warn');
		}
		return undefined;
	}

	/**
	 * Get metrics summary
	 */
	getMetricsSummary(): MetricsSummary {
		const metrics: MetricsData = this.loadMetricsData();
		const incidents: Incident[] = this.loadIncidentsData();
		const alerts: Alert[] = this.loadAlertsData();

		return {
			totalMetrics: Object.keys(metrics).length,
			totalIncidents: incidents.length,
			totalAlerts: alerts.length,
			lastUpdated: this.getLastReportTime() || new Date().toISOString(),
		};
	}

	/**
	 * Get reports count
	 */
	private getReportsCount(): number {
		try {
			if (fs.existsSync(this.reportsDir)) {
				const files: string[] = fs.readdirSync(this.reportsDir);
				return files.filter((f) => f.startsWith('security-metrics-')).length;
			}
		} catch (error) {
			this.log(`Error getting reports count: ${(error as Error).message}`, 'warn');
		}
		return 0;
	}
}

// CLI interface
async function main(): Promise<void> {
	const args: string[] = process.argv.slice(2);
	const command: string = args[0];

	const dashboard: SecurityMetricsDashboard = new SecurityMetricsDashboard();

	switch (command) {
		case 'generate':
			const period: string = args[1] || 'weekly';
			const format: string = args[2] || 'json';
			await dashboard.generateMetricsReport({ period, format });
			break;

		case 'dashboard':
			await dashboard.generateMetricsReport({ includeCharts: true });
			break;

		case 'status':
			const status: DashboardStatus = dashboard.getStatus();
			console.log(JSON.stringify(status, null, 2));
			break;

		default:
			console.log('Usage:');
			console.log(
				'  npx ts-node security-metrics-dashboard.ts generate [period] [format]  # Generate metrics report',
			);
			console.log(
				'  npx ts-node security-metrics-dashboard.ts dashboard                # Update dashboard',
			);
			console.log(
				'  npx ts-node security-metrics-dashboard.ts status                   # Show dashboard status',
			);
			process.exit(1);
	}
}

// Export for use as module
export default SecurityMetricsDashboard;

// Run if called directly
if (require.main === module) {
	main().catch((error: Error) => {
		console.error('Security metrics dashboard failed:', error.message);
		process.exit(1);
	});
}
