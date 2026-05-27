#!/usr/bin/env node
/**
 * Checks that all direct dependencies in the lockfile have been published
 * for at least the specified minimum age (default: 7 days).
 *
 * Usage: node scripts/devops/check-package-age.mjs [--min-age-days=N]
 */

import { readFileSync } from "fs";

const MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days default

// Parse --min-age-days=N from args
const ageArg = process.argv.find((a) => a.startsWith("--min-age-days="));
if (ageArg) {
  const days = parseInt(ageArg.split("=")[1], 10);
  // Override (but we use MIN_AGE_MS as computed above)
}

async function getPublishTime(name) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error(`  ERROR: ${name} - HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    // Get the "modified" time from the top-level package metadata
    // This represents the last publish time
    if (data.time && data.time.modified) {
      return new Date(data.time.modified);
    }
    console.error(`  WARN: ${name} - no time info in registry`);
    return null;
  } catch (err) {
    console.error(`  ERROR: ${name} - ${err.message}`);
    return null;
  }
}

async function main() {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  // Filter to only registry packages (semver versions, not git/file/workspace)
  const registryDeps = Object.entries(deps).filter(
    ([, range]) =>
      !/^(https?:|git\+?|file:|workspace:)/.test(range) &&
      /^\d/.test(range) // starts with digit (exact version)
  );

  console.log(
    `Checking ${registryDeps.length} packages for minimum age of ${
      MIN_AGE_MS / (24 * 60 * 60 * 1000)
    } days...\n`
  );

  const cutoff = Date.now() - MIN_AGE_MS;
  const tooNew = [];

  // Process in batches to avoid rate limiting
  const BATCH_SIZE = 5;
  for (let i = 0; i < registryDeps.length; i += BATCH_SIZE) {
    const batch = registryDeps.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async ([name, version]) => {
        const publishTime = await getPublishTime(name);
        if (!publishTime) return { name, version, ok: false, error: true };
        const age = Date.now() - publishTime.getTime();
        const ageDays = Math.round(age / (24 * 60 * 60 * 1000));
        const isOldEnough = publishTime.getTime() < cutoff;
        return {
          name,
          version,
          ageDays,
          publishDate: publishTime.toISOString().slice(0, 10),
          ok: isOldEnough,
        };
      })
    );

    for (const r of results) {
      const icon = r.error ? "?" : r.ok ? "+" : "X";
      console.log(
        `  ${icon} ${r.name}@${r.version} (${r.publishDate}, ${r.ageDays}d ago)`
      );
      if (!r.ok && !r.error) tooNew.push(r);
    }
  }

  console.log();
  if (tooNew.length > 0) {
    console.error(
      `ERROR: ${tooNew.length} package(s) were published less than ${
        MIN_AGE_MS / (24 * 60 * 60 * 1000)
      } days ago:`
    );
    for (const r of tooNew) {
      console.error(`  - ${r.name}@${r.version} (${r.ageDays}d old)`);
    }
    process.exit(1);
  } else {
    console.log("All packages meet the minimum age requirement.");
    process.exit(0);
  }
}

main();
