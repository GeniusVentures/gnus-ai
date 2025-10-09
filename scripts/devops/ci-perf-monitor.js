#!/usr/bin/env node

/**
 * GNUS-DAO CI Pipeline Performance Monitoring Script
 * Measures build and test performance metrics for CI optimization
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

class CIPerformanceMonitor {
  constructor() {
    this.startTime = Date.now();
    this.metrics = {
      build: {},
      test: {},
      coverage: {},
      security: {},
      system: {},
      artifacts: {},
    };
  }

  log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
  }

  measureTime(label) {
    return {
      start: () => {
        this.log(`Starting ${label}...`);
        return Date.now();
      },
      end: (startTime) => {
        const duration = Date.now() - startTime;
        this.log(`${label} completed in ${duration}ms`);
        return duration;
      },
    };
  }

  async runBuildMetrics() {
    const timer = this.measureTime("Build Metrics Collection");
    const startTime = timer.start();

    try {
      // Check contract sizes
      const artifactsDir = path.join(process.cwd(), "artifacts", "contracts");
      if (fs.existsSync(artifactsDir)) {
        const contractFiles = fs
          .readdirSync(artifactsDir, { recursive: true })
          .filter((file) => file.endsWith(".json"))
          .map((file) => path.join(artifactsDir, file));

        let totalSize = 0;
        let contractCount = 0;
        let largestContract = { name: "", size: 0 };

        for (const file of contractFiles) {
          try {
            const content = JSON.parse(fs.readFileSync(file, "utf8"));
            if (content.bytecode && content.bytecode !== "0x") {
              const bytecodeSize = (content.bytecode.length - 2) / 2; // Remove 0x prefix
              totalSize += bytecodeSize;
              contractCount++;

              if (bytecodeSize > largestContract.size) {
                largestContract = {
                  name: path.basename(file, ".json"),
                  size: bytecodeSize,
                };
              }
            }
          } catch (error) {
            // Skip invalid JSON files
          }
        }

        this.metrics.build.contractSize = {
          totalBytes: totalSize,
          averageBytes:
            contractCount > 0 ? Math.round(totalSize / contractCount) : 0,
          contractCount,
          largestContract,
        };
      }

      // Check Diamond ABI generation
      // TODO this should be checking based on hardhat-diamonds configuration as well
      const diamondAbiDir = path.join(process.cwd(), "diamond-abi");
      if (fs.existsSync(diamondAbiDir)) {
        const abiFiles = fs
          .readdirSync(diamondAbiDir)
          .filter((file) => file.endsWith(".json"));

        this.metrics.build.diamondAbi = {
          fileCount: abiFiles.length,
          totalSize: abiFiles.reduce((size, file) => {
            const filePath = path.join(diamondAbiDir, file);
            return size + fs.statSync(filePath).size;
          }, 0),
        };
      }
    } catch (error) {
      this.log(`Error collecting build metrics: ${error.message}`);
    }

    timer.end(startTime);
  }

  async runTestMetrics() {
    const timer = this.measureTime("Test Metrics Collection");
    const startTime = timer.start();

    try {
      // Count test files
      const testDir = path.join(process.cwd(), "test");
      if (fs.existsSync(testDir)) {
        const walkDir = (dir) => {
          let results = [];
          const list = fs.readdirSync(dir);
          for (const file of list) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
              results = results.concat(walkDir(filePath));
            } else if (file.endsWith(".ts") || file.endsWith(".js")) {
              results.push(filePath);
            }
          }
          return results;
        };

        const testFiles = walkDir(testDir);
        this.metrics.test.testFileCount = testFiles.length;

        // Categorize tests
        const unitTests = testFiles.filter((file) =>
          file.includes("/unit/"),
        ).length;
        const integrationTests = testFiles.filter((file) =>
          file.includes("/integration/"),
        ).length;
        const deploymentTests = testFiles.filter((file) =>
          file.includes("/deployment/"),
        ).length;

        this.metrics.test.testCategories = {
          unit: unitTests,
          integration: integrationTests,
          deployment: deploymentTests,
        };
      }

      // Try to run a quick compilation check
      try {
        const compileStart = Date.now();
        execSync("npx hardhat compile --force", {
          cwd: path.join(process.cwd()),
          timeout: 60000,
          stdio: "pipe",
        });
        const compileDuration = Date.now() - compileStart;
        this.metrics.test.compileTime = compileDuration;
      } catch (error) {
        this.log(`Compilation check failed: ${error.message}`);
      }
    } catch (error) {
      this.log(`Error collecting test metrics: ${error.message}`);
    }

    timer.end(startTime);
  }

  async runArtifactMetrics() {
    const timer = this.measureTime("Artifact Metrics Collection");
    const startTime = timer.start();

    try {
      const artifacts = [
        "artifacts",
        "diamond-abi",
        "diamond-typechain-types",
        "typechain-types",
        "coverage",
      ];

      for (const artifact of artifacts) {
        const artifactPath = path.join(process.cwd(), artifact);
        if (fs.existsSync(artifactPath)) {
          const size = this.getDirectorySize(artifactPath);
          this.metrics.artifacts[artifact] = {
            size,
            exists: true,
          };
        } else {
          this.metrics.artifacts[artifact] = {
            size: 0,
            exists: false,
          };
        }
      }
    } catch (error) {
      this.log(`Error collecting artifact metrics: ${error.message}`);
    }

    timer.end(startTime);
  }

  async runSecurityMetrics() {
    const timer = this.measureTime("Security Metrics Collection");
    const startTime = timer.start();

    try {
      // Check for security scan results
      const securityResults = [
        "security-scan-results.json",
        "semgrep-results.json",
        "codeql-results.sarif",
        "osv-scanner-results.json",
        "snyk-results.json",
      ];

      for (const resultFile of securityResults) {
        const resultPath = path.join(process.cwd(), "reports", resultFile);
        if (fs.existsSync(resultPath)) {
          try {
            const content = fs.readFileSync(resultPath, "utf8");
            const results = JSON.parse(content);

            // Extract issue counts
            const issueCounts = this.extractSecurityIssues(results, resultFile);
            this.metrics.security[
              resultFile.replace(".json", "").replace(".sarif", "")
            ] = {
              ...issueCounts,
              fileSize: fs.statSync(resultPath).size,
              lastModified: fs.statSync(resultPath).mtime.toISOString(),
            };
          } catch (error) {
            this.log(`Error parsing ${resultFile}: ${error.message}`);
          }
        }
      }

      // Check for security configuration files
      const securityConfigs = [
        ".semgrep.yml",
        ".eslintrc.js",
        "hardhat.config.ts",
      ];

      this.metrics.security.configFiles = {};
      for (const configFile of securityConfigs) {
        const configPath = path.join(process.cwd(), configFile);
        if (fs.existsSync(configPath)) {
          this.metrics.security.configFiles[configFile] = {
            exists: true,
            size: fs.statSync(configPath).size,
            lastModified: fs.statSync(configPath).mtime.toISOString(),
          };
        } else {
          this.metrics.security.configFiles[configFile] = { exists: false };
        }
      }

      // Calculate security score based on findings
      this.metrics.security.overallScore = this.calculateSecurityScore();
    } catch (error) {
      this.log(`Error collecting security metrics: ${error.message}`);
    }

    timer.end(startTime);
  }

  extractSecurityIssues(results, fileType) {
    const issues = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

    try {
      if (fileType.includes("semgrep")) {
        // Semgrep results format
        if (results.results && Array.isArray(results.results)) {
          results.results.forEach((result) => {
            const severity = result.extra?.severity?.toLowerCase() || "info";
            if (issues.hasOwnProperty(severity)) {
              issues[severity]++;
            }
          });
        }
      } else if (fileType.includes("osv-scanner")) {
        // OSV scanner results format
        if (results.results && Array.isArray(results.results)) {
          results.results.forEach((result) => {
            // OSV uses CVSS scores, map to severity levels
            const cvss = result.vulnerability?.database_specific?.severity;
            if (cvss >= 9.0) issues.critical++;
            else if (cvss >= 7.0) issues.high++;
            else if (cvss >= 4.0) issues.medium++;
            else issues.low++;
          });
        }
      } else if (fileType.includes("snyk")) {
        // Snyk results format
        if (results.vulnerabilities && Array.isArray(results.vulnerabilities)) {
          results.vulnerabilities.forEach((vuln) => {
            const severity = vuln.severity?.toLowerCase() || "info";
            if (issues.hasOwnProperty(severity)) {
              issues[severity]++;
            }
          });
        }
      }
    } catch (error) {
      this.log(`Error extracting issues from ${fileType}: ${error.message}`);
    }

    return issues;
  }

  calculateSecurityScore() {
    let totalIssues = 0;
    let weightedScore = 0;

    Object.values(this.metrics.security).forEach((toolResults) => {
      if (
        toolResults &&
        typeof toolResults === "object" &&
        toolResults.critical !== undefined
      ) {
        const { critical, high, medium, low } = toolResults;
        totalIssues += critical + high + medium + low;
        weightedScore += critical * 10 + high * 7 + medium * 4 + low * 1;
      }
    });

    // Calculate score out of 100 (lower is better)
    const baseScore = Math.max(0, 100 - weightedScore);
    return Math.round(baseScore * 10) / 10;
  }

  getDirectorySize(dirPath) {
    let totalSize = 0;
    const walkDir = (dir) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          walkDir(filePath);
        } else {
          totalSize += stat.size;
        }
      }
    };
    walkDir(dirPath);
    return totalSize;
  }

  async runSystemMetrics() {
    const timer = this.measureTime("System Metrics Collection");
    const startTime = timer.start();

    try {
      // Get system information
      const nodeVersion = process.version;
      const platform = process.platform;
      const arch = process.arch;
      const totalMemory = Math.round(
        process.memoryUsage().heapTotal / 1024 / 1024,
      ); // MB
      const usedMemory = Math.round(
        process.memoryUsage().heapUsed / 1024 / 1024,
      ); // MB

      this.metrics.system = {
        nodeVersion,
        platform,
        arch,
        memoryUsage: {
          total: totalMemory,
          used: usedMemory,
          percentage: Math.round((usedMemory / totalMemory) * 100),
        },
        uptime: process.uptime(),
      };

      // Get dependency information
      const packageJson = path.join(process.cwd(), "package.json");
      if (fs.existsSync(packageJson)) {
        const pkg = JSON.parse(fs.readFileSync(packageJson, "utf8"));
        this.metrics.system.dependencies = {
          runtime: pkg.dependencies ? Object.keys(pkg.dependencies).length : 0,
          dev: pkg.devDependencies
            ? Object.keys(pkg.devDependencies).length
            : 0,
          total:
            (pkg.dependencies ? Object.keys(pkg.dependencies).length : 0) +
            (pkg.devDependencies ? Object.keys(pkg.devDependencies).length : 0),
        };
      }

      // Check yarn lockfile
      const yarnLock = path.join(process.cwd(), "yarn.lock");
      if (fs.existsSync(yarnLock)) {
        const lockfileSize = fs.statSync(yarnLock).size;
        this.metrics.system.lockfileSize = lockfileSize;
      }
    } catch (error) {
      this.log(`Error collecting system metrics: ${error.message}`);
    }

    timer.end(startTime);
  }

  generateReport() {
    const totalDuration = Date.now() - this.startTime;

    const report = {
      timestamp: new Date().toISOString(),
      duration: totalDuration,
      metrics: this.metrics,
      recommendations: this.generateRecommendations(),
    };

    // Write to file
    const reportPath = path.join(
      process.cwd(),
      "reports",
      "ci-perf-report.json",
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Console output
    console.log("\n📊 CI Performance Report Generated");
    console.log("===================================");
    console.log(`Total execution time: ${totalDuration}ms`);
    console.log("\n🔨 Build Metrics:");
    console.log(
      `  - Contracts: ${this.metrics.build.contractSize?.contractCount || 0} (${this.metrics.build.contractSize?.totalBytes || 0} bytes)`,
    );
    console.log(
      `  - Largest contract: ${this.metrics.build.contractSize?.largestContract?.name || "N/A"} (${this.metrics.build.contractSize?.largestContract?.size || 0} bytes)`,
    );

    console.log("\n🧪 Test Metrics:");
    console.log(`  - Test files: ${this.metrics.test.testFileCount || 0}`);
    console.log(
      `  - Compile time: ${this.metrics.test.compileTime || "N/A"}ms`,
    );

    console.log("\n�️  Security Metrics:");
    console.log(
      `  - Overall Security Score: ${this.metrics.security.overallScore || "N/A"}/100`,
    );
    Object.entries(this.metrics.security).forEach(([tool, data]) => {
      if (data && typeof data === "object" && data.critical !== undefined) {
        const { critical, high, medium, low } = data;
        console.log(
          `  - ${tool}: ${critical}C/${high}H/${medium}M/${low}L issues`,
        );
      }
    });
    console.log(
      `  - Security configs: ${Object.values(this.metrics.security.configFiles || {}).filter((f) => f.exists).length}/${Object.keys(this.metrics.security.configFiles || {}).length} present`,
    );

    console.log("\n�📦 Artifact Metrics:");
    Object.entries(this.metrics.artifacts).forEach(([name, data]) => {
      console.log(
        `  - ${name}: ${data.exists ? `${data.size} bytes` : "Not found"}`,
      );
    });

    console.log("\n💻 System Metrics:");
    console.log(`  - Node.js: ${this.metrics.system.nodeVersion}`);
    console.log(
      `  - Memory: ${this.metrics.system.memoryUsage?.used || 0}MB / ${this.metrics.system.memoryUsage?.total || 0}MB`,
    );
    console.log(
      `  - Dependencies: ${this.metrics.system.dependencies?.total || 0}`,
    );

    console.log(`\nReport saved to: ${reportPath}`);

    return report;
  }

  generateRecommendations() {
    const recommendations = [];

    // Build recommendations
    if (this.metrics.build.contractSize?.totalBytes > 1000000) {
      // 1MB
      recommendations.push(
        "Consider contract size optimization - total bytecode exceeds 1MB",
      );
    }

    if (this.metrics.build.contractSize?.largestContract?.size > 24576) {
      // 24KB
      recommendations.push(
        `Largest contract (${this.metrics.build.contractSize.largestContract.name}) exceeds 24KB Spurious Dragon limit`,
      );
    }

    // Test recommendations
    if (this.metrics.test.compileTime > 30000) {
      // 30 seconds
      recommendations.push(
        "Compilation time exceeds 30 seconds - consider optimization",
      );
    }

    // Memory recommendations
    if (this.metrics.system.memoryUsage?.percentage > 80) {
      recommendations.push(
        "High memory usage detected - consider increasing Node.js memory limit",
      );
    }

    // Dependency recommendations
    if (this.metrics.system.dependencies?.total > 200) {
      recommendations.push(
        "High dependency count - consider dependency optimization",
      );
    }

    // Security recommendations
    if (this.metrics.security.overallScore < 80) {
      recommendations.push(
        `Security score (${this.metrics.security.overallScore}/100) is below acceptable threshold - review and fix security issues`,
      );
    }

    // Check for critical/high severity issues
    let totalCriticalHigh = 0;
    Object.values(this.metrics.security).forEach((toolResults) => {
      if (
        toolResults &&
        typeof toolResults === "object" &&
        toolResults.critical !== undefined
      ) {
        totalCriticalHigh += toolResults.critical + toolResults.high;
      }
    });

    if (totalCriticalHigh > 0) {
      recommendations.push(
        `${totalCriticalHigh} critical/high severity security issues found - immediate attention required`,
      );
    }

    // Check security config completeness
    const securityConfigs = this.metrics.security.configFiles || {};
    const missingConfigs = Object.entries(securityConfigs)
      .filter(([_, config]) => !config.exists)
      .map(([name]) => name);

    if (missingConfigs.length > 0) {
      recommendations.push(
        `Missing security configuration files: ${missingConfigs.join(", ")}`,
      );
    }

    return recommendations;
  }

  async run() {
    this.log("🚀 Starting GNUS-DAO CI Performance Monitoring");

    await this.runSystemMetrics();
    await this.runBuildMetrics();
    await this.runTestMetrics();
    await this.runSecurityMetrics();
    await this.runArtifactMetrics();

    this.generateReport();
    this.log("✅ CI Performance monitoring completed");
  }
}

// Run if called directly
if (require.main === module) {
  const monitor = new CIPerformanceMonitor();
  monitor.run().catch((error) => {
    console.error("CI Performance monitoring failed:", error);
    process.exit(1);
  });
}

module.exports = CIPerformanceMonitor;
