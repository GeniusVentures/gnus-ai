#!/usr/bin/env node

/**
 * GitHub Actions Cost Analyzer
 * Analyzes CI/CD costs and provides optimization recommendations
 */

import * as fs from 'fs';
import * as path from 'path';

interface CostEntry {
	workflow: string;
	run_id: string;
	run_number: string;
	runtime_minutes: number;
	runner_type: string;
	estimated_cost: number;
	timestamp: string;
	branch: string;
	event: string;
	status?: string;
}

interface WorkflowCost {
	workflow: string;
	totalCost: number;
	runCount: number;
	avgCost: number;
	avgRuntime: number;
}

interface CostAnalysis {
	totalCost: number;
	avgCost: number;
	runCount: number;
	workflowCosts: WorkflowCost[];
	budgetStatus: 'good' | 'warning' | 'exceeded' | 'unknown';
	budgetUsed: number;
	budgetRemaining: number;
	timeframe: string;
	recommendations: CostRecommendation[];
}

interface CostRecommendation {
	priority: 'critical' | 'high' | 'medium' | 'low';
	type: 'cost-optimization' | 'performance' | 'reliability' | 'budget';
	title: string;
	message: string;
	savings?: number;
	suggestions: string[];
}

class CostAnalyzer {
	private costData: CostEntry[];
	private costFile: string;
	private budgetLimit: number;

	constructor() {
		this.costData = [];
		this.costFile = path.join(process.cwd(), '.github/costs/workflow-costs.jsonl');
		this.budgetLimit = parseFloat(process.env.COST_BUDGET_LIMIT || '50'); // $50 default
	}

	loadCostData(): void {
		if (!fs.existsSync(this.costFile)) {
			console.log('📄 No cost data file found. Creating initial cost tracking file...');
			this.initializeCostFile();
			return;
		}

		try {
			const content = fs.readFileSync(this.costFile, 'utf8').trim();
			if (content) {
				const lines = content.split('\n');
				this.costData = lines
					.map((line) => JSON.parse(line) as CostEntry)
					.filter((item) => item.estimated_cost > 0);
			}
			console.log(`✅ Loaded ${this.costData.length} cost records`);
		} catch (error) {
			console.error(
				'❌ Error loading cost data:',
				error instanceof Error ? error.message : error,
			);
		}
	}

	private initializeCostFile(): void {
		// Create directory if it doesn't exist
		const dir = path.dirname(this.costFile);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		// Create empty file
		fs.writeFileSync(this.costFile, '');
		console.log('📁 Initialized cost tracking file');
	}

	private calculateEstimatedCost(
		runtimeMinutes: number,
		runnerType: string = 'ubuntu-latest',
	): number {
		// GitHub Actions pricing (approximate as of 2025)
		const pricing: Record<string, number> = {
			'ubuntu-latest': 0.008, // $0.008 per minute
			'ubuntu-latest-4-cores': 0.016, // $0.016 per minute
			'ubuntu-latest-8-cores': 0.032, // $0.032 per minute
			'ubuntu-latest-16-cores': 0.064, // $0.064 per minute
			'windows-latest': 0.016, // $0.016 per minute
			'macos-latest': 0.08, // $0.08 per minute
		};

		const rate = pricing[runnerType] || pricing['ubuntu-latest'];
		return runtimeMinutes * rate;
	}

	trackCurrentWorkflow(): CostEntry {
		const runtimeMinutes =
			(Date.now() - new Date(process.env.GITHUB_RUN_STARTED_AT || Date.now()).getTime()) /
			1000 /
			60;
		const runnerType = process.env.RUNNER_NAME || 'ubuntu-latest';
		const estimatedCost = this.calculateEstimatedCost(runtimeMinutes, runnerType);

		const costEntry: CostEntry = {
			workflow: process.env.GITHUB_WORKFLOW || 'unknown',
			run_id: process.env.GITHUB_RUN_ID || 'unknown',
			run_number: process.env.GITHUB_RUN_NUMBER || 'unknown',
			runtime_minutes: Math.round(runtimeMinutes * 100) / 100,
			runner_type: runnerType,
			estimated_cost: Math.round(estimatedCost * 10000) / 10000,
			timestamp: new Date().toISOString(),
			branch: process.env.GITHUB_REF_NAME || 'unknown',
			event: process.env.GITHUB_EVENT_NAME || 'unknown',
		};

		// Append to cost file
		fs.appendFileSync(this.costFile, JSON.stringify(costEntry) + '\n');

		console.log(
			`💰 Workflow cost tracked: $${estimatedCost.toFixed(4)} (${runtimeMinutes.toFixed(1)} minutes on ${runnerType})`,
		);

		return costEntry;
	}

	analyzeCosts(timeframe: string = 'all'): CostAnalysis {
		if (this.costData.length === 0) {
			return {
				totalCost: 0,
				avgCost: 0,
				runCount: 0,
				workflowCosts: [],
				recommendations: [],
				budgetStatus: 'unknown',
				budgetUsed: 0,
				budgetRemaining: 0,
				timeframe,
			};
		}

		// Filter by timeframe
		let filteredData = this.costData;
		if (timeframe !== 'all') {
			const now = new Date();
			const cutoff = new Date();

			switch (timeframe) {
				case 'day':
					cutoff.setDate(now.getDate() - 1);
					break;
				case 'week':
					cutoff.setDate(now.getDate() - 7);
					break;
				case 'month':
					cutoff.setMonth(now.getMonth() - 1);
					break;
			}

			filteredData = this.costData.filter((item) => new Date(item.timestamp) >= cutoff);
		}

		const totalCost = filteredData.reduce((sum, item) => sum + item.estimated_cost, 0);
		const avgCost = totalCost / filteredData.length;
		const runCount = filteredData.length;

		// Group by workflow
		const byWorkflow = filteredData.reduce(
			(acc, item) => {
				acc[item.workflow] = acc[item.workflow] || [];
				acc[item.workflow].push(item);
				return acc;
			},
			{} as Record<string, CostEntry[]>,
		);

		const workflowCosts: WorkflowCost[] = Object.entries(byWorkflow)
			.map(([workflow, runs]) => ({
				workflow,
				totalCost: runs.reduce((sum, run) => sum + run.estimated_cost, 0),
				runCount: runs.length,
				avgCost: runs.reduce((sum, run) => sum + run.estimated_cost, 0) / runs.length,
				avgRuntime: runs.reduce((sum, run) => sum + run.runtime_minutes, 0) / runs.length,
			}))
			.sort((a, b) => b.totalCost - a.totalCost);

		// Calculate budget status
		const budgetUsed = totalCost;
		const budgetRemaining = Math.max(0, this.budgetLimit - budgetUsed);
		const budgetStatus: 'good' | 'warning' | 'exceeded' | 'unknown' =
			budgetUsed > this.budgetLimit
				? 'exceeded'
				: budgetUsed > this.budgetLimit * 0.8
					? 'warning'
					: 'good';

		const recommendations = this.generateRecommendations(workflowCosts, filteredData);

		return {
			totalCost: Math.round(totalCost * 100) / 100,
			avgCost: Math.round(avgCost * 10000) / 10000,
			runCount,
			workflowCosts,
			budgetStatus,
			budgetUsed: Math.round(budgetUsed * 100) / 100,
			budgetRemaining: Math.round(budgetRemaining * 100) / 100,
			timeframe,
			recommendations,
		};
	}

	private generateRecommendations(
		workflowCosts: WorkflowCost[],
		allRuns: CostEntry[],
	): CostRecommendation[] {
		const recommendations: CostRecommendation[] = [];

		// Find expensive workflows
		const expensiveWorkflows = workflowCosts.filter((w) => w.avgCost > 0.2);
		expensiveWorkflows.forEach((workflow) => {
			recommendations.push({
				priority: 'high',
				type: 'cost-optimization',
				title: `Optimize ${workflow.workflow}`,
				message: `High average cost: $${workflow.avgCost.toFixed(4)} per run (${workflow.runCount} runs)`,
				savings: workflow.totalCost * 0.3, // Potential 30% savings
				suggestions: [
					'Consider using smaller runner types for this workflow',
					'Implement better caching to reduce runtime',
					'Review if all steps are necessary',
					'Consider conditional execution for expensive steps',
				],
			});
		});

		// Find long-running workflows
		const longRunningWorkflows = workflowCosts.filter((w) => w.avgRuntime > 15);
		longRunningWorkflows.forEach((workflow) => {
			recommendations.push({
				priority: 'medium',
				type: 'performance',
				title: `Speed up ${workflow.workflow}`,
				message: `Long average runtime: ${workflow.avgRuntime.toFixed(1)} minutes`,
				savings: (workflow.avgRuntime - 10) * workflow.runCount * 0.008, // Savings from reducing to 10 min
				suggestions: [
					'Use larger runners to complete faster (may cost more but save time)',
					'Optimize build steps and caching',
					'Consider parallel execution',
					'Review and remove unnecessary steps',
				],
			});
		});

		// Find frequently failing workflows (if we had failure data)
		const failedRuns = allRuns.filter((run) => run.status === 'failed');
		if (failedRuns.length > allRuns.length * 0.1) {
			// More than 10% failure rate
			recommendations.push({
				priority: 'high',
				type: 'reliability',
				title: 'Reduce Workflow Failures',
				message: `${failedRuns.length} failed runs detected (${((failedRuns.length / allRuns.length) * 100).toFixed(1)}% failure rate)`,
				savings: failedRuns.length * 0.1, // Estimate savings from reduced failures
				suggestions: [
					'Fix root causes of frequent failures',
					'Add better error handling and retries',
					'Improve test stability',
					'Add pre-flight checks',
				],
			});
		}

		// Budget recommendations
		const analysis = this.analyzeCosts();
		if (analysis.budgetStatus === 'exceeded') {
			recommendations.push({
				priority: 'critical',
				type: 'budget',
				title: 'Budget Exceeded',
				message: `Monthly budget exceeded: $${analysis.budgetUsed} used of $${this.budgetLimit} limit`,
				savings: analysis.budgetUsed - this.budgetLimit,
				suggestions: [
					'Immediately disable non-essential workflows',
					'Switch to cheaper runner types',
					'Reduce workflow frequency',
					'Optimize expensive workflows',
				],
			});
		} else if (analysis.budgetStatus === 'warning') {
			recommendations.push({
				priority: 'high',
				type: 'budget',
				title: 'Budget Warning',
				message: `Monthly budget usage high: $${analysis.budgetUsed} used of $${this.budgetLimit} limit (${((analysis.budgetUsed / this.budgetLimit) * 100).toFixed(1)}%)`,
				savings: (analysis.budgetUsed - this.budgetLimit * 0.7) * 0.3,
				suggestions: [
					'Review and optimize expensive workflows',
					'Consider reducing workflow frequency',
					'Implement better caching strategies',
					'Monitor costs more closely',
				],
			});
		}

		return recommendations.sort((a, b) => {
			const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
			return priorityOrder[a.priority] - priorityOrder[b.priority];
		});
	}

	generateReport(timeframe: string = 'month'): { report: string; analysis: CostAnalysis } {
		console.log(`📊 Generating cost analysis report for timeframe: ${timeframe}`);

		const analysis = this.analyzeCosts(timeframe);

		const report = `# 💰 GitHub Actions Cost Analysis Report

**Generated**: ${new Date().toISOString()}
**Timeframe**: ${timeframe}
**Budget Limit**: $${this.budgetLimit}

## 📈 Summary

- **Total Cost**: $${analysis.totalCost}
- **Average Cost per Run**: $${analysis.avgCost}
- **Total Runs**: ${analysis.runCount}
- **Budget Status**: ${analysis.budgetStatus === 'good' ? '✅ Good' : analysis.budgetStatus === 'warning' ? '⚠️ Warning' : '🔴 Exceeded'}
- **Budget Used**: $${analysis.budgetUsed} / $${this.budgetLimit} (${((analysis.budgetUsed / this.budgetLimit) * 100).toFixed(1)}%)

## 💵 Workflow Costs

| Workflow | Runs | Total Cost | Avg Cost | Avg Runtime |
|----------|------|------------|----------|-------------|
${analysis.workflowCosts
	.map(
		(w) =>
			`| ${w.workflow} | ${w.runCount} | $${w.totalCost.toFixed(2)} | $${w.avgCost.toFixed(4)} | ${w.avgRuntime.toFixed(1)}m |`,
	)
	.join('\n')}

## 🎯 Recommendations

${
	analysis.recommendations.length === 0
		? '✅ No optimization recommendations at this time.'
		: analysis.recommendations
				.map((r) => {
					const icon =
						r.priority === 'critical'
							? '🔴'
							: r.priority === 'high'
								? '🟡'
								: r.priority === 'medium'
									? '🔵'
									: '🟢';
					return `${icon} **${r.title}** (${r.priority})
${r.message}
${r.savings ? `**Potential Savings**: $${r.savings.toFixed(2)}` : ''}

**Suggestions:**
${r.suggestions.map((s) => `- ${s}`).join('\n')}

`;
				})
				.join('')
}

## 📊 Cost Trends

\`\`\`text
Budget Usage: [${'█'.repeat(Math.min(20, Math.floor((analysis.budgetUsed / this.budgetLimit) * 20)))}${'░'.repeat(20 - Math.min(20, Math.floor((analysis.budgetUsed / this.budgetLimit) * 20)))}] ${((analysis.budgetUsed / this.budgetLimit) * 100).toFixed(1)}%
\`\`\`

---
*This report is automatically generated by the cost analyzer. Configure COST_BUDGET_LIMIT environment variable to set custom budget limits.*
`;

		const reportsDir = path.join(process.cwd(), 'reports', 'cost-analyzer');
		if (!fs.existsSync(reportsDir)) {
			fs.mkdirSync(reportsDir, { recursive: true });
		}

		const reportPath = path.join(reportsDir, `cost-analysis-report-${timeframe}.md`);
		fs.writeFileSync(reportPath, report);
		console.log(`📄 Cost analysis report saved to ${reportPath}`);

		// Also save JSON version for automation
		const jsonPath = path.join(reportsDir, `cost-analysis-${timeframe}.json`);
		fs.writeFileSync(jsonPath, JSON.stringify(analysis, null, 2));

		return { report, analysis };
	}

	async run(): Promise<{ report: string; analysis: CostAnalysis }[]> {
		try {
			console.log('🚀 Starting GitHub Actions Cost Analysis\n');

			// Load existing data
			this.loadCostData();

			// Track current workflow if running in CI
			if (process.env.CI) {
				this.trackCurrentWorkflow();
			}

			// Generate reports for different timeframes
			const reports = ['week', 'month'].map((timeframe) => this.generateReport(timeframe));

			console.log('\n🎉 Cost analysis completed successfully!');
			console.log('📊 Check cost-analysis-report-*.md files for detailed insights');

			return reports;
		} catch (error) {
			console.error('💥 Error during cost analysis:', error);
			throw error;
		}
	}
}

// CLI interface
if (require.main === module) {
	const analyzer = new CostAnalyzer();

	// Parse command line arguments
	const timeframe = process.argv[2] || 'month';

	// Validate timeframe to prevent path traversal attacks
	const validTimeframes = ['day', 'week', 'month', 'all'];
	if (!validTimeframes.includes(timeframe)) {
		console.error(
			`❌ Invalid timeframe: ${timeframe}. Valid options are: ${validTimeframes.join(', ')}`,
		);
		process.exit(1);
	}

	try {
		analyzer.generateReport(timeframe);
		console.log('✅ Cost analysis report generated successfully');
	} catch (error) {
		console.error('❌ Error generating cost analysis report:', error);
		process.exit(1);
	}
}

export default CostAnalyzer;
