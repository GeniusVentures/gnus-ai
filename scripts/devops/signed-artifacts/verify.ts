#!/usr/bin/env npx ts-node

/**
 * GNUS-DAO Artifact Verification Script
 * Verifies the cryptographic signature and provenance of signed artifacts
 */

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

class ArtifactVerifier {
	private signedDir: string;
	private provenanceFile: string;

	constructor() {
		this.signedDir = __dirname;
		this.provenanceFile = path.join(this.signedDir, 'provenance.json');
	}

	private log(message: string): void {
		const timestamp = new Date().toISOString();
		console.log(`[${timestamp}] ${message}`);
	}

	async verify(): Promise<void> {
		this.log('🔍 Starting GNUS-DAO artifact verification');

		if (!fs.existsSync(this.provenanceFile)) {
			console.error('❌ Provenance file not found');
			process.exit(1);
		}

		const signedProvenance: SignedProvenance = JSON.parse(
			fs.readFileSync(this.provenanceFile, 'utf8'),
		);

		const currentProvenance = signedProvenance.provenance;
		const provenanceString = JSON.stringify(
			currentProvenance,
			Object.keys(currentProvenance).sort(),
		);

		const calculatedHash = crypto
			.createHash('sha256')
			.update(provenanceString)
			.update('GNUS-DAO-SIGNATURE-SALT')
			.digest('hex');

		if (calculatedHash === signedProvenance.signature.signature) {
			console.log('✅ Artifact signature verified successfully');
			console.log('📋 Provenance information:');
			console.log('   Project:', currentProvenance.project);
			console.log('   Version:', currentProvenance.version);
			console.log('   Timestamp:', currentProvenance.timestamp);
			console.log('   Node.js:', currentProvenance.build.node_version);
		} else {
			console.error('❌ Artifact signature verification failed');
			process.exit(1);
		}

		this.log('✅ Artifact verification completed successfully');
	}

	async checkIntegrity(): Promise<void> {
		this.log('🔍 Checking artifact integrity');

		if (!fs.existsSync(this.provenanceFile)) {
			console.error('❌ Provenance file not found for integrity check');
			process.exit(1);
		}

		const signedProvenance: SignedProvenance = JSON.parse(
			fs.readFileSync(this.provenanceFile, 'utf8'),
		);

		const provenance = signedProvenance.provenance;
		let integrityIssues = 0;

		for (const [artifactName, artifactInfo] of Object.entries(provenance.artifacts)) {
			const artifactPath = path.join(process.cwd(), 'signed-artifacts', artifactName);

			if (!fs.existsSync(artifactPath)) {
				console.error(`❌ Artifact directory missing: ${artifactName}`);
				integrityIssues++;
				continue;
			}

			const currentHash = this.calculateDirectoryHash(artifactPath);
			if (currentHash !== artifactInfo.hash) {
				console.error(`❌ Hash mismatch for ${artifactName}`);
				console.error(`   Expected: ${artifactInfo.hash}`);
				console.error(`   Current:  ${currentHash}`);
				integrityIssues++;
			} else {
				console.log(`✅ ${artifactName} integrity verified`);
			}
		}

		if (integrityIssues > 0) {
			console.error(`❌ Integrity check failed: ${integrityIssues} issues found`);
			process.exit(1);
		}

		console.log('✅ All artifact integrity checks passed');
	}

	private calculateDirectoryHash(dirPath: string): string {
		const hashSum = crypto.createHash('sha256');
		const files = this.getAllFiles(dirPath).sort();

		for (const file of files) {
			const relativePath = path.relative(dirPath, file);
			const fileHash = this.calculateFileHash(file);
			hashSum.update(relativePath + ':' + fileHash + '\n');
		}

		return hashSum.digest('hex');
	}

	private calculateFileHash(filePath: string): string {
		const fileBuffer = fs.readFileSync(filePath);
		const hashSum = crypto.createHash('sha256');
		hashSum.update(fileBuffer);
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
}

if (require.main === module) {
	const verifier = new ArtifactVerifier();
	const command = process.argv[2];

	switch (command) {
		case 'verify':
			verifier.verify().catch((error) => {
				console.error('Verification failed:', error);
				process.exit(1);
			});
			break;
		case 'integrity':
			verifier.checkIntegrity().catch((error) => {
				console.error('Integrity check failed:', error);
				process.exit(1);
			});
			break;
		default:
			console.log('GNUS-DAO Artifact Verification Tool');
			console.log('');
			console.log('Usage:');
			console.log('  npx ts-node verify.ts verify     # Verify cryptographic signature');
			console.log('  npx ts-node verify.ts integrity  # Check artifact integrity');
			console.log('');
			console.log('Commands:');
			console.log(
				'  verify    - Verify the cryptographic signature and display provenance',
			);
			console.log("  integrity - Check that signed artifacts haven't been modified");
			process.exit(1);
	}
}
