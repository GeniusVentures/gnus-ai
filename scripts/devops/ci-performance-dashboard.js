#!/usr/bin/env node

/**
 * CI Performance Monitoring Dashboard
 * Generates actionable insights from CI/CD pipeline performance data
 */

const fs = require("fs");
const path = require("path");

class CIPerformanceDashboard {
  constructor() {
    this.metrics = {
      workflowRuns: [],
      cachePerformance: [],
      securityScanTimes: [],
      buildTimes: [],
      costData: [],
    };

    this.thresholds = {
      maxWorkflowTime: 30 * 60, // 30 minutes
      maxCacheMissRate: 0.3, // 30%
      maxSecurityScanTime: 10 * 60, // 10 minutes
      targetSuccessRate: 0.95, // 95%
    };

    this.dashboard = {
      summary: {},
      trends: {},
      alerts: [],
      recommendations: [],
      charts: {},
    };
  }

  async loadMetrics() {
    console.log("📊 Loading CI performance metrics...");

    // Load workflow run data
    await this.loadWorkflowRuns();

    // Load cache performance data
    await this.loadCacheMetrics();

    // Load security scan metrics
    await this.loadSecurityMetrics();

    // Load cost data
    await this.loadCostData();
  }

  async loadWorkflowRuns() {
    try {
      // In a real implementation, this would fetch from GitHub API
      // For now, we'll simulate with recent data
      const workflowData = [
        {
          id: 1,
          name: "CI",
          status: "completed",
          conclusion: "success",
          created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(
            Date.now() - 23.5 * 60 * 60 * 1000,
          ).toISOString(),
          duration: 1800, // 30 minutes
        },
        {
          id: 2,
          name: "Security",
          status: "completed",
          conclusion: "success",
          created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(
            Date.now() - 11.5 * 60 * 60 * 1000,
          ).toISOString(),
          duration: 900, // 15 minutes
        },
      ];

      this.metrics.workflowRuns = workflowData;
      console.log(`✅ Loaded ${workflowData.length} workflow runs`);
    } catch (error) {
      console.warn("⚠️ Could not load workflow runs:", error.message);
    }
  }

  async loadCacheMetrics() {
    try {
      const cacheFile = path.join(process.cwd(), "cache-performance.json");
      if (fs.existsSync(cacheFile)) {
        const cacheData = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
        this.metrics.cachePerformance = cacheData;
        console.log("✅ Loaded cache performance metrics");
      } else {
        // Generate mock cache data
        this.metrics.cachePerformance = [
          { timestamp: Date.now(), hitRate: 0.75, size: 2048 },
          { timestamp: Date.now() - 86400000, hitRate: 0.82, size: 1890 },
        ];
      }
    } catch (error) {
      console.warn("⚠️ Could not load cache metrics:", error.message);
    }
  }

  async loadSecurityMetrics() {
    try {
      const securityFile = path.join(
        process.cwd(),
        "security-scan-metrics.json",
      );
      if (fs.existsSync(securityFile)) {
        const securityData = JSON.parse(fs.readFileSync(securityFile, "utf8"));
        this.metrics.securityScanTimes = securityData;
      } else {
        // Generate mock security metrics
        this.metrics.securityScanTimes = [
          { tool: "slither", duration: 120, findings: 0 },
          { tool: "semgrep", duration: 45, findings: 2 },
          { tool: "snyk", duration: 180, findings: 1 },
        ];
      }
      console.log("✅ Loaded security scan metrics");
    } catch (error) {
      console.warn("⚠️ Could not load security metrics:", error.message);
    }
  }

  async loadCostData() {
    try {
      // Mock cost data - in real implementation, fetch from GitHub API
      this.metrics.costData = [
        { date: "2024-01-01", cost: 45.67, minutes: 1200 },
        { date: "2024-01-02", cost: 38.92, minutes: 980 },
        { date: "2024-01-03", cost: 52.14, minutes: 1450 },
      ];
      console.log("✅ Loaded cost data");
    } catch (error) {
      console.warn("⚠️ Could not load cost data:", error.message);
    }
  }

  analyzePerformance() {
    console.log("🔍 Analyzing performance data...");

    this.analyzeWorkflowPerformance();
    this.analyzeCachePerformance();
    this.analyzeSecurityPerformance();
    this.analyzeCostEfficiency();
    this.generateTrends();
    this.generateAlerts();
    this.generateRecommendations();
  }

  analyzeWorkflowPerformance() {
    const runs = this.metrics.workflowRuns;
    if (runs.length === 0) return;

    const totalRuns = runs.length;
    const successfulRuns = runs.filter(
      (r) => r.conclusion === "success",
    ).length;
    const successRate = successfulRuns / totalRuns;

    const avgDuration =
      runs.reduce((sum, r) => sum + r.duration, 0) / totalRuns;
    const maxDuration = Math.max(...runs.map((r) => r.duration));

    this.dashboard.summary.workflow = {
      totalRuns,
      successRate: (successRate * 100).toFixed(1),
      avgDuration: Math.round(avgDuration),
      maxDuration,
      efficiency:
        avgDuration <= this.thresholds.maxWorkflowTime ? "good" : "poor",
    };
  }

  analyzeCachePerformance() {
    const cacheData = this.metrics.cachePerformance;
    if (cacheData.length === 0) return;

    const latest = cacheData[cacheData.length - 1];
    const avgHitRate =
      cacheData.reduce((sum, c) => sum + c.hitRate, 0) / cacheData.length;

    this.dashboard.summary.cache = {
      currentHitRate: (latest.hitRate * 100).toFixed(1),
      avgHitRate: (avgHitRate * 100).toFixed(1),
      cacheSize: latest.size,
      efficiency:
        latest.hitRate >= 1 - this.thresholds.maxCacheMissRate
          ? "good"
          : "poor",
    };
  }

  analyzeSecurityPerformance() {
    const securityData = this.metrics.securityScanTimes;
    if (securityData.length === 0) return;

    const totalScanTime = securityData.reduce((sum, s) => sum + s.duration, 0);
    const totalFindings = securityData.reduce((sum, s) => sum + s.findings, 0);
    const avgScanTime = totalScanTime / securityData.length;

    this.dashboard.summary.security = {
      totalScanTime,
      avgScanTime: Math.round(avgScanTime),
      totalFindings,
      scansCompleted: securityData.length,
      efficiency:
        avgScanTime <= this.thresholds.maxSecurityScanTime ? "good" : "poor",
    };
  }

  analyzeCostEfficiency() {
    const costData = this.metrics.costData;
    if (costData.length === 0) return;

    const totalCost = costData.reduce((sum, c) => sum + c.cost, 0);
    const totalMinutes = costData.reduce((sum, c) => sum + c.minutes, 0);
    const avgCostPerMinute = totalCost / totalMinutes;

    // Calculate cost trend
    const recentCosts = costData.slice(-7);
    const costTrend =
      recentCosts.length > 1
        ? ((recentCosts[recentCosts.length - 1].cost - recentCosts[0].cost) /
            recentCosts[0].cost) *
          100
        : 0;

    this.dashboard.summary.cost = {
      totalCost: totalCost.toFixed(2),
      avgCostPerMinute: avgCostPerMinute.toFixed(4),
      totalMinutes,
      costTrend: costTrend.toFixed(1),
      efficiency:
        Math.abs(costTrend) <= 10
          ? "stable"
          : costTrend > 0
            ? "increasing"
            : "decreasing",
    };
  }

  generateTrends() {
    // Generate performance trends over time
    this.dashboard.trends = {
      workflowDuration: this.calculateTrend("workflowRuns", "duration"),
      cacheHitRate: this.calculateTrend("cachePerformance", "hitRate"),
      securityScanTime: this.calculateTrend("securityScanTimes", "duration"),
      costEfficiency: this.calculateTrend("costData", "cost"),
    };
  }

  calculateTrend(dataKey, field) {
    const data = this.metrics[dataKey];
    if (data.length < 2) return { trend: "insufficient-data", change: 0 };

    const values = data.map((item) => item[field]).filter((v) => v != null);
    if (values.length < 2) return { trend: "insufficient-data", change: 0 };

    const first = values[0];
    const last = values[values.length - 1];
    const change = ((last - first) / first) * 100;

    let trend = "stable";
    if (Math.abs(change) > 10) {
      trend = change > 0 ? "increasing" : "decreasing";
    }

    return {
      trend,
      change: change.toFixed(1),
      first,
      last,
      dataPoints: values.length,
    };
  }

  generateAlerts() {
    const alerts = [];

    // Workflow performance alerts
    if (this.dashboard.summary.workflow) {
      const workflow = this.dashboard.summary.workflow;
      if (
        parseFloat(workflow.successRate) <
        this.thresholds.targetSuccessRate * 100
      ) {
        alerts.push({
          level: "critical",
          category: "workflow",
          message: `Workflow success rate (${workflow.successRate}%) below ${this.thresholds.targetSuccessRate * 100}% threshold`,
          recommendation: "Review recent workflow failures and fix root causes",
        });
      }

      if (workflow.avgDuration > this.thresholds.maxWorkflowTime) {
        alerts.push({
          level: "warning",
          category: "performance",
          message: `Average workflow duration (${workflow.avgDuration}s) exceeds ${this.thresholds.maxWorkflowTime}s threshold`,
          recommendation:
            "Optimize build steps and consider parallel execution",
        });
      }
    }

    // Cache performance alerts
    if (this.dashboard.summary.cache) {
      const cache = this.dashboard.summary.cache;
      if (
        parseFloat(cache.currentHitRate) <
        (1 - this.thresholds.maxCacheMissRate) * 100
      ) {
        alerts.push({
          level: "warning",
          category: "cache",
          message: `Cache hit rate (${cache.currentHitRate}%) below ${(1 - this.thresholds.maxCacheMissRate) * 100}% threshold`,
          recommendation:
            "Review cache invalidation strategy and optimize cache keys",
        });
      }
    }

    // Security performance alerts
    if (this.dashboard.summary.security) {
      const security = this.dashboard.summary.security;
      if (security.avgScanTime > this.thresholds.maxSecurityScanTime) {
        alerts.push({
          level: "info",
          category: "security",
          message: `Security scan time (${security.avgScanTime}s) exceeds ${this.thresholds.maxSecurityScanTime}s target`,
          recommendation:
            "Consider incremental scanning or parallel security tool execution",
        });
      }
    }

    // Cost alerts
    if (this.dashboard.summary.cost) {
      const cost = this.dashboard.summary.cost;
      if (Math.abs(parseFloat(cost.costTrend)) > 20) {
        alerts.push({
          level: "warning",
          category: "cost",
          message: `Cost trend changed by ${cost.costTrend}% recently`,
          recommendation:
            "Review resource usage and consider optimization strategies",
        });
      }
    }

    this.dashboard.alerts = alerts;
  }

  generateRecommendations() {
    const recommendations = [];

    // Performance optimization recommendations
    if (this.dashboard.trends.workflowDuration?.trend === "increasing") {
      recommendations.push({
        priority: "high",
        category: "performance",
        title: "Optimize Workflow Duration",
        description: `Workflow duration has increased by ${this.dashboard.trends.workflowDuration.change}%. Consider parallel execution and caching improvements.`,
        actions: [
          "Implement parallel job execution",
          "Review and optimize slowest steps",
          "Increase cache hit rates",
        ],
      });
    }

    // Cache optimization recommendations
    if (this.dashboard.summary.cache?.efficiency === "poor") {
      recommendations.push({
        priority: "medium",
        category: "cache",
        title: "Improve Cache Performance",
        description: `Cache hit rate is ${this.dashboard.summary.cache.currentHitRate}%. Implement intelligent caching strategies.`,
        actions: [
          "Use fingerprint-based cache keys",
          "Implement selective cache invalidation",
          "Pre-warm caches for common scenarios",
        ],
      });
    }

    // Cost optimization recommendations
    if (this.dashboard.summary.cost?.efficiency === "increasing") {
      recommendations.push({
        priority: "medium",
        category: "cost",
        title: "Optimize CI Costs",
        description: `CI costs have increased by ${this.dashboard.summary.cost.costTrend}%. Implement cost reduction strategies.`,
        actions: [
          "Use spot instances for non-critical jobs",
          "Implement smart triggering to skip unnecessary runs",
          "Optimize resource allocation",
        ],
      });
    }

    // Security optimization recommendations
    if (this.dashboard.summary.security?.efficiency === "poor") {
      recommendations.push({
        priority: "low",
        category: "security",
        title: "Optimize Security Scanning",
        description: `Security scans are taking longer than expected. Consider incremental scanning approaches.`,
        actions: [
          "Implement incremental security scanning",
          "Parallelize security tool execution",
          "Cache security tool binaries",
        ],
      });
    }

    this.dashboard.recommendations = recommendations;
  }

  generateCharts() {
    // Generate chart data for dashboard visualization
    this.dashboard.charts = {
      workflowDuration: {
        type: "line",
        title: "Workflow Duration Trend",
        data: this.metrics.workflowRuns.map((run) => ({
          x: new Date(run.created_at).toLocaleDateString(),
          y: run.duration / 60, // Convert to minutes
        })),
      },
      cacheHitRate: {
        type: "line",
        title: "Cache Hit Rate Trend",
        data: this.metrics.cachePerformance.map((cache) => ({
          x: new Date(cache.timestamp).toLocaleDateString(),
          y: cache.hitRate * 100,
        })),
      },
      costTrend: {
        type: "bar",
        title: "Daily CI Costs",
        data: this.metrics.costData.map((cost) => ({
          x: cost.date,
          y: cost.cost,
        })),
      },
    };
  }

  generateReport() {
    const report = {
      generated: new Date().toISOString(),
      period: "Last 30 days",
      dashboard: this.dashboard,
    };

    const reportPath = path.join(
      process.cwd(),
      "ci-performance-dashboard.json",
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Dashboard report saved to ${reportPath}`);

    return report;
  }

  generateMarkdownReport() {
    let markdown = `# 🚀 CI Performance Dashboard

Generated: ${new Date().toISOString()}
Period: Last 30 days

## 📊 Summary

`;

    // Add summary sections
    if (this.dashboard.summary.workflow) {
      const w = this.dashboard.summary.workflow;
      markdown += `### Workflow Performance
- **Total Runs**: ${w.totalRuns}
- **Success Rate**: ${w.successRate}%
- **Avg Duration**: ${Math.round(w.avgDuration / 60)} minutes
- **Efficiency**: ${w.efficiency === "good" ? "✅ Good" : "⚠️ Needs improvement"}

`;
    }

    if (this.dashboard.summary.cache) {
      const c = this.dashboard.summary.cache;
      markdown += `### Cache Performance
- **Current Hit Rate**: ${c.currentHitRate}%
- **Cache Size**: ${c.cacheSize} MB
- **Efficiency**: ${c.efficiency === "good" ? "✅ Good" : "⚠️ Needs improvement"}

`;
    }

    if (this.dashboard.summary.security) {
      const s = this.dashboard.summary.security;
      markdown += `### Security Performance
- **Total Scan Time**: ${Math.round(s.totalScanTime / 60)} minutes
- **Findings**: ${s.totalFindings}
- **Efficiency**: ${s.efficiency === "good" ? "✅ Good" : "⚠️ Needs improvement"}

`;
    }

    if (this.dashboard.summary.cost) {
      const c = this.dashboard.summary.cost;
      markdown += `### Cost Efficiency
- **Total Cost**: $${c.totalCost}
- **Cost per Minute**: $${c.avgCostPerMinute}
- **Trend**: ${c.costTrend}% change
- **Efficiency**: ${c.efficiency === "stable" ? "✅ Stable" : c.efficiency === "increasing" ? "⚠️ Increasing" : "✅ Decreasing"}

`;
    }

    // Add alerts
    if (this.dashboard.alerts.length > 0) {
      markdown += `## 🚨 Alerts

`;
      this.dashboard.alerts.forEach((alert) => {
        const icon =
          alert.level === "critical"
            ? "🔴"
            : alert.level === "warning"
              ? "🟡"
              : "ℹ️";
        markdown += `${icon} **${alert.category.toUpperCase()}**: ${alert.message}
*Recommendation*: ${alert.recommendation}

`;
      });
    }

    // Add recommendations
    if (this.dashboard.recommendations.length > 0) {
      markdown += `## 💡 Recommendations

`;
      this.dashboard.recommendations.forEach((rec) => {
        const priorityIcon =
          rec.priority === "high"
            ? "🔴"
            : rec.priority === "medium"
              ? "🟡"
              : "🟢";
        markdown += `${priorityIcon} **${rec.title}** (${rec.category})
${rec.description}

**Actions:**
${rec.actions.map((action) => `- ${action}`).join("\n")}

`;
      });
    }

    // Add trends
    if (Object.keys(this.dashboard.trends).length > 0) {
      markdown += `## 📈 Trends

`;
      Object.entries(this.dashboard.trends).forEach(([key, trend]) => {
        if (trend.trend !== "insufficient-data") {
          const trendIcon =
            trend.trend === "increasing"
              ? "📈"
              : trend.trend === "decreasing"
                ? "📉"
                : "➡️";
          markdown += `- **${key}**: ${trendIcon} ${trend.change}% change\n`;
        }
      });
    }

    const markdownPath = path.join(
      process.cwd(),
      "ci-performance-dashboard.md",
    );
    fs.writeFileSync(markdownPath, markdown);
    console.log(`📄 Markdown dashboard saved to ${markdownPath}`);

    return markdown;
  }

  async run() {
    try {
      console.log("🚀 Generating CI Performance Dashboard\n");

      await this.loadMetrics();
      this.analyzePerformance();
      this.generateCharts();
      this.generateReport();
      this.generateMarkdownReport();

      console.log("\n🎉 CI Performance Dashboard generated successfully!");
      console.log("📊 Check ci-performance-dashboard.md for detailed insights");

      return this.dashboard;
    } catch (error) {
      console.error("💥 Error generating performance dashboard:", error);
      process.exit(1);
    }
  }
}

// CLI interface
if (require.main === module) {
  const dashboard = new CIPerformanceDashboard();
  dashboard.run().catch(console.error);
}

module.exports = CIPerformanceDashboard;
