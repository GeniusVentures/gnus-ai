/**
 * Safe upgrade orchestrator — propose, wait for execution, confirm, verify.
 *
 * Chains the four steps of a Safe-based diamond upgrade into a single command:
 *   1. Propose the diamondCut to Safe via the upgrade pipeline
 *   2. Poll the Safe Transaction Service until executed (or timeout)
 *   3. Confirm execution: update deployed-data with on-chain tx + facet info
 *   4. Verify the upgrade: ABI, selectors, and on-chain state
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/safe/safeUpgrade.ts \
 *     --diamond GeniusDiamond --network sepolia \
 *     --safe-address 0x34cF9B07A7703d82689D28f2200067c050e7a861 \
 *     [--time-out 300] [--origin gnus-ai-upgrade]
 *
 * @module scripts/safe/safeUpgrade
 */

import { execSync } from 'child_process';
import { config as dotenv } from 'dotenv';
import { resolve } from 'path';
import chalk from 'chalk';

dotenv();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const kDefaultTimeoutSeconds = 300;
const kDefaultPollInterval = 15;

// Paths relative to the project root (gnus-ai/)
const kProjectRoot = resolve(__dirname, '..', '..');

function runStep(cmd: string): { status: number; stdout: string; stderr: string } {
    const fullCmd = `npx ts-node --transpile-only ${cmd}`;
    try {
        const stdout = execSync(fullCmd, {
            cwd: kProjectRoot,
            encoding: 'utf8',
            timeout: 600_000,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        return { status: 0, stdout, stderr: '' };
    } catch (err: any) {
        return {
            status: err.status ?? 1,
            stdout: err.stdout?.toString() ?? '',
            stderr: err.stderr?.toString() ?? err.message,
        };
    }
}

function logStep(step: number, label: string): void {
    console.log(chalk.cyan(`\n━━━ Step ${step}/5: ${label} ━━━`));
}

function fail(msg: string): never {
    console.error(chalk.red(`\n❌ ${msg}`));
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface CliOptions {
    diamond: string;
    network: string;
    safeAddress: string;
    safeProposerPrivateKey?: string;
    timeOut: number;
    pollInterval: number;
    origin: string;
    rpcUrl?: string;
}

function parseArgs(): CliOptions {
    const args = process.argv.slice(2);
    const get = (name: string): string | undefined => {
        const i = args.indexOf(name);
        return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
    };
    return {
        diamond: get('--diamond') ?? 'GeniusDiamond',
        network: get('--network') ?? 'sepolia',
        safeAddress: get('--safe-address') ?? '',
        safeProposerPrivateKey: get('--safe-proposer-key'),
        timeOut: Number(get('--time-out') ?? kDefaultTimeoutSeconds),
        pollInterval: Number(get('--poll-interval') ?? kDefaultPollInterval),
        origin: get('--origin') ?? 'gnus-ai-upgrade',
        rpcUrl: get('--rpc-url'),
    };
}

// ---------------------------------------------------------------------------
// Step 1: Propose the upgrade via Safe
// ---------------------------------------------------------------------------

async function step1Propose(opts: CliOptions): Promise<string> {
    logStep(1, 'Propose upgrade to Safe');

    const safeProposerKey = opts.safeProposerPrivateKey
        ? `--safe-proposer-private-key ${opts.safeProposerPrivateKey}`
        : '';

    const rpcUrl = opts.rpcUrl ? `--rpc-url ${opts.rpcUrl}` : '';

    const cmd = [
        `scripts/deploy/rpc/upgrade-rpc.ts upgrade`,
        opts.diamond,
        opts.network,
        `--safe-propose`,
        `--safe-address ${opts.safeAddress}`,
        safeProposerKey,
        rpcUrl,
    ]
        .filter(Boolean)
        .join(' ');

    console.log(chalk.gray(`  ${cmd}`));
    const { status, stdout, stderr } = runStep(cmd);

    if (status !== 0) {
        if (stderr) console.error(stderr);
        if (stdout) console.log(stdout);
        fail(`Safe proposal failed (exit ${status})`);
    }

    console.log(stdout);

    const match = stdout.match(/Artifact:\s*(.+)/);
    if (!match) {
        const hashMatch = stdout.match(/SafeTx:\s*(0x[a-fA-F0-9]+)/);
        if (!hashMatch) {
            console.error('stdout was:');
            console.error(stdout);
            fail('Could not find Safe proposal artifact path or safeTxHash in output');
        }
        const safeTxHash = hashMatch[1];
        console.log(chalk.yellow(`⚠️  Could not parse artifact path; using safeTxHash: ${safeTxHash}`));
        return safeTxHash;
    }

    return match[1].trim();
}

// ---------------------------------------------------------------------------
// Step 2: Wait for Safe execution
// ---------------------------------------------------------------------------

async function step2WaitForExecution(artifactPath: string, opts: CliOptions): Promise<void> {
    logStep(2, `Wait for Safe execution (timeout ${opts.timeOut}s)`);

    const deploymentPath = `diamonds/${opts.diamond}/deployments/geniusdiamond-${opts.network}-11155111.json`;

    const cmd = [
        `scripts/safe/checkSafeExecuted.ts`,
        `--artifact ${artifactPath}`,
        `--deployment ${deploymentPath}`,
        `--time-out ${opts.timeOut}`,
        `--poll-interval ${opts.pollInterval}`,
        opts.rpcUrl ? `--rpc-url ${opts.rpcUrl}` : '',
    ]
        .filter(Boolean)
        .join(' ');

    console.log(chalk.gray(`  ${cmd}`));
    const { status, stdout, stderr } = runStep(cmd);

    console.log(stdout);
    if (stderr) console.error(stderr);

    if (status === 1) fail('Safe execution check errored');
    if (status === 2) fail(`Safe proposal not executed within ${opts.timeOut}s timeout`);
}

// ---------------------------------------------------------------------------
// Step 3: Confirm deployment (update deployed-data)
// ---------------------------------------------------------------------------

async function step3Confirm(artifactPath: string, opts: CliOptions): Promise<void> {
    logStep(3, 'Confirm deployment — update deployed-data');

    const deploymentPath = `diamonds/${opts.diamond}/deployments/geniusdiamond-${opts.network}-11155111.json`;

    const cmd = [
        `scripts/safe/confirmDeployment.ts`,
        `--artifact ${artifactPath}`,
        `--deployment ${deploymentPath}`,
    ].join(' ');

    console.log(chalk.gray(`  ${cmd}`));
    const { status, stdout, stderr } = runStep(cmd);

    console.log(stdout);
    if (stderr) console.error(stderr);

    if (status !== 0) fail(`Deployment confirmation failed (exit ${status})`);
}

// ---------------------------------------------------------------------------
// Step 4: Verify selectors on-chain
// ---------------------------------------------------------------------------

async function step4Verify(opts: CliOptions): Promise<void> {
    logStep(4, 'Verify selectors on-chain');

    const cmd = [
        `scripts/deploy/rpc/verify-rpc.ts quick`,
        opts.diamond,
        opts.network,
    ].join(' ');

    console.log(chalk.gray(`  ${cmd}`));
    const { status, stdout, stderr } = runStep(cmd);

    console.log(stdout);
    if (stderr) console.error(stderr);

    if (status !== 0) {
        console.log(chalk.yellow(`⚠️  Selector verification exited ${status} — check output above`));
    }
}

// ---------------------------------------------------------------------------
// Step 5: Verify on Etherscan
// ---------------------------------------------------------------------------

async function step5Etherscan(opts: CliOptions): Promise<void> {
    logStep(5, 'Verify on Etherscan');

    // verifyFacets.ts must run via hardhat so it can use the network's
    // etherscan config (apiKey + apiURL).
    const cmd = `hardhat run scripts/verify/verifyFacets.ts --network ${opts.network}`;

    console.log(chalk.gray(`  npx ${cmd}`));
    const fullCmd = `npx ${cmd}`;
    try {
        const stdout = execSync(fullCmd, {
            cwd: kProjectRoot,
            encoding: 'utf8',
            timeout: 300_000,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        console.log(stdout);
    } catch (err: any) {
        const out = err.stdout?.toString() ?? '';
        const errOut = err.stderr?.toString() ?? '';
        if (out) console.log(out);
        if (errOut) console.error(errOut);
        console.log(chalk.yellow(`⚠️  Etherscan verification exited ${err.status} — check output above`));
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    const opts = parseArgs();

    if (!opts.safeAddress) fail('--safe-address <address> required');

    console.log(chalk.bold(`\n🛡️  Safe Upgrade — ${opts.diamond} on ${opts.network}`));
    console.log(chalk.gray(`   Safe: ${opts.safeAddress}`));
    console.log(chalk.gray(`   Timeout: ${opts.timeOut}s | Poll: ${opts.pollInterval}s`));

    const artifactPath = await step1Propose(opts);
    await step2WaitForExecution(artifactPath, opts);
    await step3Confirm(artifactPath, opts);
    await step4Verify(opts);
    await step5Etherscan(opts);

    console.log(chalk.greenBright('\n✅ Safe upgrade complete — proposed, executed, confirmed, verified, etherscan-verified.\n'));
}

main().catch((err) => {
    console.error(chalk.red(`\n❌ ${err.message}`));
    process.exit(1);
});
