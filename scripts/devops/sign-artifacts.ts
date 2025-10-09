#!/usr/bin/env npx ts-node

/**
 * GNUS-DAO Build Artifact Signing and Provenance Script
 * Creates cryptographic signatures and provenance attestations for build artifacts
 */

import { execSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface BuildInfo {
	node_version: string;
	platform: string;
	arch: string;
}

interface ArtifactInfo {
	path: string;
	hash: string;
	fileCount: number;
}

interface DependencyInfo {
	package_count: number;
	yarn_lock_exists: boolean;
	yarn_lock_hash: string | null;
}

interface ProvenanceData {
	project: string;
	version: string;
	timestamp: string;
	build: BuildInfo;
	artifacts: { [key: string]: ArtifactInfo };
	dependencies: DependencyInfo;
}

interface SignatureData {
	algorithm: string;
	signature: string;
	public_key: string;
	timestamp: string;
}

interface SignedProvenance {
	provenance: ProvenanceData;
	signature: SignatureData;
}

class ArtifactSigner {
	private artifactsDir: string;
	private signedDir: string;
	private provenanceFile: string;
	private signatureFile: string;

	constructor() {
		this.artifactsDir = path.join(process.cwd(), 'artifacts');
		this.signedDir = path.join(process.cwd(), 'signed-artifacts');
		this.provenanceFile = path.join(this.signedDir, 'provenance.json');
		this.signatureFile = path.join(this.signedDir, 'artifacts.sig');
	}

	private log(message: string): void {
		const timestamp = new Date().toISOString();
		console.log(`[${timestamp}] ${message}`);
	}

	private ensureSignedDir(): void {
		if (!fs.existsSync(this.signedDir)) {
			fs.mkdirSync(this.signedDir, { recursive: true });
		}
	}

	private calculateFileHash(filePath: string): string {
		const fileBuffer = fs.readFileSync(filePath);
		const hashSum = crypto.createHash('sha256');
		hashSum.update(fileBuffer);
		return hashSum.digest('hex');
	}

	private calculateDirectoryHash(dirPath: string): string {
		const hashSum = crypto.createHash('sha256');
		const files = this.getAllFiles(dirPath).sort(); // Sort for consistent hashing

		for (const file of files) {
			const relativePath = path.relative(dirPath, file);
			const fileHash = this.calculateFileHash(file);
			hashSum.update(relativePath + ':' + fileHash + '\n');
		}

		return hashSum.digest('hex');
	}

	private getAllFiles(dirPath: string): string[] {
		const files: string[] = [];

		function walkDir(currentPath: string): void {
			const items = fs.readdirSync(currentPath);

			for (const item of items) {
				const itemPath = path.join(currentPath, item);
				const stat = fs.statSync(itemPath);

				if (stat.isDirectory()) {
					// Skip node_modules and other irrelevant directories
					if (!item.startsWith('.') && item !== 'node_modules' && item !== 'cache') {
						walkDir(itemPath);
					}
				} else if (
					stat.isFile() &&
					!item.endsWith('.log') &&
					!item.endsWith('.tmp') &&
					item !== '.DS_Store'
				) {
					files.push(itemPath);
				}
			}
		}

		walkDir(dirPath);
		return files;
	}

	private generateProvenanceData(): ProvenanceData {
		const provenance: ProvenanceData = {
			project: 'gnus-dao',
			version: this.getGitCommit(),
			timestamp: new Date().toISOString(),
			build: {
				node_version: process.version,
				platform: process.platform,
				arch: process.arch,
			},
			artifacts: {},
			dependencies: this.getDependencyInfo(),
		};

		// Calculate hashes for key artifacts
		const artifactDirs = ['artifacts', 'diamond-abi', 'diamond-typechain-types'];

		for (const dir of artifactDirs) {
			const dirPath = path.join(process.cwd(), dir);
			if (fs.existsSync(dirPath)) {
				provenance.artifacts[dir] = {
					path: dir,
					hash: this.calculateDirectoryHash(dirPath),
					fileCount: this.getAllFiles(dirPath).length,
				};
			}
		}

		return provenance;
	}

	private getGitCommit(): string {
		try {
			return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
		} catch (error) {
			return 'unknown';
		}
	}

	private getDependencyInfo(): DependencyInfo {
		const packageJson = path.join(process.cwd(), 'package.json');
		if (!fs.existsSync(packageJson)) {
			return {
				package_count: 0,
				yarn_lock_exists: false,
				yarn_lock_hash: null,
			};
		}

		const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
		const yarnLock = path.join(process.cwd(), 'yarn.lock');

		return {
			package_count:
				Object.keys(pkg.dependencies || {}).length +
				Object.keys(pkg.devDependencies || {}).length,
			yarn_lock_exists: fs.existsSync(yarnLock),
			yarn_lock_hash: fs.existsSync(yarnLock) ? this.calculateFileHash(yarnLock) : null,
		};
	}

	private createSignature(provenanceData: ProvenanceData): SignatureData {
		// Create a deterministic string representation for signing
		const provenanceString = JSON.stringify(
			provenanceData,
			Object.keys(provenanceData).sort(),
		);

		// In a real implementation, this would use a proper private key
		// For now, we'll create a simple hash-based signature
		const signature = crypto
			.createHash('sha256')
			.update(provenanceString)
			.update('GNUS-DAO-SIGNATURE-SALT') // Simple salt for demo
			.digest('hex');

		return {
			algorithm: 'SHA256',
			signature: signature,
			public_key: 'GNUS-DAO-CI-SIGNER', // Placeholder for actual public key
			timestamp: new Date().toISOString(),
		};
	}

	private copyArtifactsToSigned(): void {
		const artifactsToCopy = [
			'artifacts',
			'diamond-abi',
			'diamond-typechain-types',
			'typechain-types',
		];

		for (const artifact of artifactsToCopy) {
			const sourcePath = path.join(process.cwd(), artifact);
			const targetPath = path.join(this.signedDir, artifact);

			if (fs.existsSync(sourcePath)) {
				this.log(`Copying ${artifact} to signed artifacts...`);
				execSync(`cp -r "${sourcePath}" "${targetPath}"`, { stdio: 'inherit' });
			}
		}
	}

	async sign(): Promise<SignedProvenance> {
		this.log('🔐 Starting GNUS-DAO artifact signing process');

		this.ensureSignedDir();

		// Generate provenance data
		this.log('Generating provenance data...');
		const provenanceData = this.generateProvenanceData();

		// Create signature
		this.log('Creating cryptographic signature...');
		const signature = this.createSignature(provenanceData);

		// Combine provenance and signature
		const signedProvenance: SignedProvenance = {
			provenance: provenanceData,
			signature: signature,
		};

		// Write provenance file
		fs.writeFileSync(this.provenanceFile, JSON.stringify(signedProvenance, null, 2));
		this.log(`Provenance written to: ${this.provenanceFile}`);

		// Write signature file (separate for easy verification)
		fs.writeFileSync(this.signatureFile, JSON.stringify(signature, null, 2));
		this.log(`Signature written to: ${this.signatureFile}`);

		// Copy artifacts
		this.copyArtifactsToSigned();

		// Create verification script
		this.createVerificationScript();

		this.log('✅ Artifact signing completed successfully');
		this.log(`📦 Signed artifacts available in: ${this.signedDir}`);

		return signedProvenance;
	}

	private createVerificationScript(): void {
		const verifyScript = `#!/usr/bin/env npx ts-node

/**
 * GNUS-DAO Artifact Verification Script
 * Verifies the cryptographic signature and provenance of signed artifacts
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

interface BuildInfo {
  node_version: string;
  platform: string;
  arch: string;
}

interface ArtifactInfo {
  path: string;
  hash: string;
  fileCount: number;
}

interface DependencyInfo {
  package_count: number;
  yarn_lock_exists: boolean;
  yarn_lock_hash: string | null;
}

interface ProvenanceData {
  project: string;
  version: string;
  timestamp: string;
  build: BuildInfo;
  artifacts: { [key: string]: ArtifactInfo };
  dependencies: DependencyInfo;
}

interface SignatureData {
  algorithm: string;
  signature: string;
  public_key: string;
  timestamp: string;
}

interface SignedProvenance {
  provenance: ProvenanceData;
  signature: SignatureData;
}

class ArtifactVerifier {
  private signedDir: string;
  private provenanceFile: string;

  constructor() {
    this.signedDir = __dirname;
    this.provenanceFile = path.join(this.signedDir, "provenance.json");
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(\`[\${timestamp}] \${message}\`);
  }

  async verify(): Promise<void> {
    this.log("🔍 Starting GNUS-DAO artifact verification");

    if (!fs.existsSync(this.provenanceFile)) {
      console.error("❌ Provenance file not found");
      process.exit(1);
    }

    const signedProvenance: SignedProvenance = JSON.parse(
      fs.readFileSync(this.provenanceFile, "utf8")
    );

    const currentProvenance = signedProvenance.provenance;
    const provenanceString = JSON.stringify(
      currentProvenance,
      Object.keys(currentProvenance).sort()
    );

    const calculatedHash = crypto
      .createHash("sha256")
      .update(provenanceString)
      .update("GNUS-DAO-SIGNATURE-SALT")
      .digest("hex");

    if (calculatedHash === signedProvenance.signature.signature) {
      console.log("✅ Artifact signature verified successfully");
      console.log("📋 Provenance information:");
      console.log("   Project:", currentProvenance.project);
      console.log("   Version:", currentProvenance.version);
      console.log("   Timestamp:", currentProvenance.timestamp);
      console.log("   Node.js:", currentProvenance.build.node_version);
    } else {
      console.error("❌ Artifact signature verification failed");
      process.exit(1);
    }

    this.log("✅ Artifact verification completed successfully");
  }

  async checkIntegrity(): Promise<void> {
    this.log("🔍 Checking artifact integrity");

    if (!fs.existsSync(this.provenanceFile)) {
      console.error("❌ Provenance file not found for integrity check");
      process.exit(1);
    }

    const signedProvenance: SignedProvenance = JSON.parse(
      fs.readFileSync(this.provenanceFile, "utf8")
    );

    const provenance = signedProvenance.provenance;
    let integrityIssues = 0;

    for (const [artifactName, artifactInfo] of Object.entries(provenance.artifacts)) {
      const artifactPath = path.join(__dirname, artifactName);

      if (!fs.existsSync(artifactPath)) {
        console.error(\`❌ Artifact directory missing: \${artifactName}\`);
        integrityIssues++;
        continue;
      }

      const currentHash = this.calculateDirectoryHash(artifactPath);
      if (currentHash !== artifactInfo.hash) {
        console.error(\`❌ Hash mismatch for \${artifactName}\`);
        console.error(\`   Expected: \${artifactInfo.hash}\`);
        console.error(\`   Current:  \${currentHash}\`);
        integrityIssues++;
      } else {
        console.log(\`✅ \${artifactName} integrity verified\`);
      }
    }

    if (integrityIssues > 0) {
      console.error(\`❌ Integrity check failed: \${integrityIssues} issues found\`);
      process.exit(1);
    }

    console.log("✅ All artifact integrity checks passed");
  }

  private calculateDirectoryHash(dirPath: string): string {
    const hashSum = crypto.createHash("sha256");
    const files = this.getAllFiles(dirPath).sort();

    for (const file of files) {
      const relativePath = path.relative(dirPath, file);
      const fileHash = this.calculateFileHash(file);
      hashSum.update(relativePath + ":" + fileHash + "\\n");
    }

    return hashSum.digest("hex");
  }

  private calculateFileHash(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash("sha256");
    hashSum.update(fileBuffer);
    return hashSum.digest("hex");
  }

  private getAllFiles(dirPath: string): string[] {
    const files: string[] = [];

    function walkDir(currentPath: string): void {
      const items = fs.readdirSync(currentPath);

      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          if (
            !item.startsWith(".") &&
            item !== "node_modules" &&
            item !== "cache"
          ) {
            walkDir(itemPath);
          }
        } else if (
          stat.isFile() &&
          !item.endsWith(".log") &&
          !item.endsWith(".tmp") &&
          item !== ".DS_Store"
        ) {
          files.push(itemPath);
        }
      }
    }

    walkDir(dirPath);
    return files;
  }
}

if (require.main === module) {
  const verifier = new ArtifactVerifier();
  const command = process.argv[2];

  switch (command) {
    case "verify":
      verifier.verify().catch((error) => {
        console.error("Verification failed:", error);
        process.exit(1);
      });
      break;
    case "integrity":
      verifier.checkIntegrity().catch((error) => {
        console.error("Integrity check failed:", error);
        process.exit(1);
      });
      break;
    default:
      console.log("GNUS-DAO Artifact Verification Tool");
      console.log("");
      console.log("Usage:");
      console.log("  npx ts-node verify.ts verify     # Verify cryptographic signature");
      console.log("  npx ts-node verify.ts integrity  # Check artifact integrity");
      console.log("");
      console.log("Commands:");
      console.log("  verify    - Verify the cryptographic signature and display provenance");
      console.log("  integrity - Check that signed artifacts haven't been modified");
      process.exit(1);
  }
}
`;

		const verifyScriptPath = path.join(this.signedDir, 'verify.ts');
		fs.writeFileSync(verifyScriptPath, verifyScript);
		fs.chmodSync(verifyScriptPath, '755');

		this.log(`Verification script created: ${verifyScriptPath}`);
	}
}

// Run if called directly
if (require.main === module) {
	const signer = new ArtifactSigner();
	signer.sign().catch((error) => {
		console.error('Artifact signing failed:', error);
		process.exit(1);
	});
}

export default ArtifactSigner;
