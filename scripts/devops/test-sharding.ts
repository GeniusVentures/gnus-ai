#!/usr/bin/env node

/**
 * Test Sharding Distributor for GNUS-DAO
 * Intelligently distributes tests across multiple CI runners for optimal performance
 */

import * as fs from 'fs';
import * as path from 'path';

// TypeScript interfaces for Test Sharding
interface TestFile {
	file: string;
	size: number;
	testCount: number;
	category: TestCategory;
}

type TestCategory = 'unit' | 'integration' | 'e2e' | 'security' | 'deployment';

interface TestGroups {
	unit: TestFile[];
	integration: TestFile[];
	e2e: TestFile[];
	security: TestFile[];
	deployment: TestFile[];
}

interface DistributionMetadata {
	shard: number;
	totalShards: number;
	totalTests: number;
	testCount: number;
	categories: Record<TestCategory, number>;
	estimatedDuration?: number;
	loadBalance?: LoadBalance;
}

interface LoadBalance {
	score: number;
	maxShard: number;
	minShard: number;
	variance: number;
}

interface TestDistribution {
	tests: string[];
	groups: Record<TestCategory, TestFile[]>;
	metadata: DistributionMetadata;
}

interface ExecutionPlan {
	order: string[];
	parallelGroups: {
		fast: string[];
		medium: string[];
		slow: string[];
	};
	estimatedTime: number;
}

interface TestExecutionPlan extends TestDistribution {
	execution: ExecutionPlan;
}

class TestShardDistributor {
	private totalShards: number;
	private shardIndex: number;
	private testFiles: string[];
	private testGroups: TestGroups;

	constructor(totalShards: string, shardIndex: string) {
		this.totalShards = parseInt(totalShards);
		this.shardIndex = parseInt(shardIndex);
		this.testFiles = [];
		this.testGroups = {
			unit: [],
			integration: [],
			e2e: [],
			security: [],
			deployment: [],
		};
	}

	findTestFiles(): void {
		const testDir = path.join(process.cwd(), 'test');

		function findFiles(dir: string): string[] {
			const files: string[] = [];

			if (!fs.existsSync(dir)) {
				return files;
			}

			const items = fs.readdirSync(dir);

			items.forEach((item) => {
				const fullPath = path.join(dir, item);
				const stat = fs.statSync(fullPath);

				if (stat.isDirectory()) {
					files.push(...findFiles(fullPath));
				} else if (item.endsWith('.test.ts') || item.endsWith('.spec.ts')) {
					files.push(fullPath);
				}
			});

			return files;
		}

		this.testFiles = findFiles(testDir);
		console.log(`Found ${this.testFiles.length} test files`);
	}

	analyzeTestFiles(): void {
		this.testFiles.forEach((file) => {
			const content = fs.readFileSync(file, 'utf8');
			const relativePath = path.relative(process.cwd(), file);

			// Categorize tests based on file path and content
			let category: TestCategory = 'unit'; // default

			if (
				relativePath.includes('/integration/') ||
				content.includes('describe.*integration')
			) {
				category = 'integration';
			} else if (
				relativePath.includes('/e2e/') ||
				content.includes('end-to-end') ||
				content.includes('e2e')
			) {
				category = 'e2e';
			} else if (
				relativePath.includes('/security/') ||
				content.includes('security') ||
				content.includes('audit')
			) {
				category = 'security';
			} else if (relativePath.includes('/deployment/') || content.includes('deploy')) {
				category = 'deployment';
			}

			this.testGroups[category].push({
				file: relativePath,
				size: content.length,
				testCount: (content.match(/it\(|describe\(/g) || []).length,
				category,
			});
		});

		// Log distribution
		Object.entries(this.testGroups).forEach(([category, tests]) => {
			console.log(`${category}: ${tests.length} files`);
		});
	}

	distributeTests(): TestDistribution {
		const distribution: TestDistribution = {
			tests: [],
			groups: {
				unit: [],
				integration: [],
				e2e: [],
				security: [],
				deployment: [],
			},
			metadata: {
				shard: this.shardIndex,
				totalShards: this.totalShards,
				totalTests: this.testFiles.length,
				testCount: 0,
				categories: {} as Record<TestCategory, number>,
			},
		};

		// Distribute each test group across shards
		Object.entries(this.testGroups).forEach(([category, tests]) => {
			if (tests.length === 0) return;

			const shardSize = Math.ceil(tests.length / this.totalShards);
			const startIndex = this.shardIndex * shardSize;
			const endIndex = Math.min(startIndex + shardSize, tests.length);

			const shardTests = tests.slice(startIndex, endIndex);

			distribution.groups[category as TestCategory] = shardTests;
			distribution.tests.push(...shardTests.map((t: TestFile) => t.file));
		});

		// Sort tests for consistent execution order
		distribution.tests.sort();

		distribution.metadata.testCount = distribution.tests.length;
		distribution.metadata.categories = Object.fromEntries(
			Object.entries(distribution.groups).map(([cat, tests]) => [
				cat as TestCategory,
				tests.length,
			]),
		) as Record<TestCategory, number>;

		return distribution;
	}

	balanceLoad(distribution: TestDistribution): TestDistribution {
		// Analyze test execution times and rebalance if needed
		// This is a simplified version - in practice, you'd use historical data

		const avgTestTime = 2; // seconds per test (estimate)
		const estimatedTime = distribution.metadata.testCount * avgTestTime;

		distribution.metadata.estimatedDuration = estimatedTime;
		distribution.metadata.loadBalance = this.calculateLoadBalance(distribution);

		return distribution;
	}

	calculateLoadBalance(distribution: TestDistribution): LoadBalance {
		// Calculate how evenly distributed the tests are
		const shardSizes = new Array(this.totalShards).fill(0);
		shardSizes[this.shardIndex] = distribution.tests.length;

		// Estimate other shard sizes (simplified)
		const totalTests = this.testFiles.length;
		const avgShardSize = Math.floor(totalTests / this.totalShards);

		for (let i = 0; i < this.totalShards; i++) {
			if (i !== this.shardIndex) {
				shardSizes[i] = avgShardSize;
			}
		}

		const maxSize = Math.max(...shardSizes);
		const minSize = Math.min(...shardSizes);
		const balance = maxSize === 0 ? 1 : minSize / maxSize;

		return {
			score: balance,
			maxShard: maxSize,
			minShard: minSize,
			variance: this.calculateVariance(shardSizes),
		};
	}

	calculateVariance(sizes: number[]): number {
		const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
		const variance =
			sizes.reduce((acc, size) => acc + Math.pow(size - mean, 2), 0) / sizes.length;
		return Math.sqrt(variance);
	}

	generateExecutionPlan(distribution: TestDistribution): TestExecutionPlan {
		// Generate optimal execution order based on test dependencies and types
		const executionPlan: TestExecutionPlan = {
			...distribution,
			execution: {
				order: this.optimizeExecutionOrder(distribution),
				parallelGroups: this.identifyParallelGroups(distribution),
				estimatedTime: distribution.metadata.estimatedDuration || 0,
			},
		};

		return executionPlan;
	}

	optimizeExecutionOrder(distribution: TestDistribution): string[] {
		// Order tests for optimal execution (fast tests first, dependencies considered)
		const ordered: Array<TestFile & { priority: number }> = [];

		// Fast unit tests first
		ordered.push(...distribution.groups.unit.map((t) => ({ ...t, priority: 1 })));

		// Integration tests next
		ordered.push(...distribution.groups.integration.map((t) => ({ ...t, priority: 2 })));

		// Security tests (important but potentially slow)
		ordered.push(...distribution.groups.security.map((t) => ({ ...t, priority: 3 })));

		// E2E tests last (slowest)
		ordered.push(...distribution.groups.e2e.map((t) => ({ ...t, priority: 4 })));

		// Deployment tests
		ordered.push(...distribution.groups.deployment.map((t) => ({ ...t, priority: 5 })));

		// Sort by priority, then by estimated execution time
		ordered.sort((a, b) => {
			if (a.priority !== b.priority) return a.priority - b.priority;
			return (a.size || 0) - (b.size || 0); // Smaller files first
		});

		return ordered.map((item) => item.file);
	}

	identifyParallelGroups(distribution: TestDistribution): {
		fast: string[];
		medium: string[];
		slow: string[];
	} {
		// Group tests that can run in parallel
		const groups = {
			fast: [] as string[],
			medium: [] as string[],
			slow: [] as string[],
		};

		Object.values(distribution.groups)
			.flat()
			.forEach((test) => {
				const size = test.size || 0;
				if (size < 1000) {
					groups.fast.push(test.file);
				} else if (size < 5000) {
					groups.medium.push(test.file);
				} else {
					groups.slow.push(test.file);
				}
			});

		return groups;
	}

	saveDistribution(distribution: TestExecutionPlan): void {
		const outputDir = path.join(process.cwd(), 'test-assets', '.test-shards');
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		const filename = `shard-${this.shardIndex}-of-${this.totalShards}.json`;
		const filepath = path.join(outputDir, filename);

		fs.writeFileSync(filepath, JSON.stringify(distribution, null, 2));
		console.log(`Saved test distribution to ${filepath}`);
	}

	run(): TestExecutionPlan {
		console.log(
			`🧩 Distributing tests across ${this.totalShards} shards (shard ${this.shardIndex})`,
		);

		this.findTestFiles();
		this.analyzeTestFiles();

		let distribution = this.distributeTests();
		distribution = this.balanceLoad(distribution);
		const executionPlan = this.generateExecutionPlan(distribution);

		this.saveDistribution(executionPlan);

		// Output for CI consumption
		console.log('::set-output name=distribution::' + JSON.stringify(executionPlan));

		return executionPlan;
	}
}

// CLI interface
if (require.main === module) {
	const args = process.argv.slice(2);

	if (args.length !== 2) {
		console.error(
			'Usage: npx ts-node scripts/devops/test-sharding.ts <total-shards> <shard-index>',
		);
		console.error('Example: npx ts-node scripts/devops/test-sharding.ts 4 0');
		process.exit(1);
	}

	const [totalShards, shardIndex] = args;

	if (
		isNaN(Number(totalShards)) ||
		isNaN(Number(shardIndex)) ||
		Number(shardIndex) >= Number(totalShards)
	) {
		console.error(
			'Invalid arguments: total-shards must be a number, shard-index must be < total-shards',
		);
		process.exit(1);
	}

	const distributor = new TestShardDistributor(totalShards, shardIndex);
	distributor.run();
}

export default TestShardDistributor;
