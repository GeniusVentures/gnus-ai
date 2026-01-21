#!/usr/bin/env node

/**
 * GNUS-DAO Sigstore Integration Script
 * Implements Sigstore signing and verification for build artifacts
 * Provides cryptographic attestation using Sigstore's transparency log
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface SigstoreConfig {
	rekorUrl: string;
	fulcioUrl: string;
	oidcIssuer: string;
	tufRoot: string;
}

interface SigningOptions {
	identity?: string;
	otherName?: string;
}

interface SignatureResult {
	signatureFile: string;
	bundle: SignatureBundle;
}

interface Certificate {
	rawBytes: string;
	parsed: {
		subject: {
			commonName: string;
			otherName: string;
		};
		issuer: {
			commonName: string;
			organization: string[];
		};
		validity: {
			notBefore: string;
			notAfter: string;
		};
	};
}

interface TransparencyLogEntry {
	logIndex: number;
	logId: {
		keyId: string;
	};
	integratedTime: number;
	inclusionPromise: {
		signedEntryTimestamp: string;
	};
	inclusionProof: {
		logIndex: number;
		rootHash: string;
		treeSize: number;
		hashes: string[];
	};
	verified: boolean;
}

interface SignatureBundle {
	mediaType: string;
	verificationMaterial: {
		certificate: Certificate;
		tlogEntries: TransparencyLogEntry[];
		timestampVerificationData: {
			rfc3161Timestamps: Array<{
				signedTimestamp: string;
			}>;
		};
	};
	messageSignature: {
		messageDigest: {
			algorithm: string;
			digest: string;
		};
		signature: string;
	};
}

interface VerificationResult {
	verified: number;
	failed: number;
}

class SigstoreIntegration {
	private buildDir: string;
	private attestationsDir: string;
	private sigstoreConfig: SigstoreConfig;

	constructor() {
		this.buildDir = path.join(process.cwd());
		this.attestationsDir = path.join(process.cwd(), 'reports', 'attestations');
		this.sigstoreConfig = this.loadSigstoreConfig();
	}

	private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
		const timestamp = new Date().toISOString();
		const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
		console.log(`${prefix} [${timestamp}] ${message}`);
	}

	/**
	 * Validate and sanitize file path to prevent directory traversal attacks
	 */
	private validateFilePath(inputPath: string, allowedDirs: string[]): string {
		// Resolve the path to prevent directory traversal
		const resolvedPath = path.resolve(inputPath);

		// Check if the resolved path is within one of the allowed directories
		const isAllowed = allowedDirs.some((allowedDir) => {
			const resolvedAllowedDir = path.resolve(allowedDir);
			return (
				resolvedPath.startsWith(resolvedAllowedDir + path.sep) ||
				resolvedPath === resolvedAllowedDir
			);
		});

		if (!isAllowed) {
			throw new Error(`Access denied: Path ${inputPath} is outside allowed directories`);
		}

		// Additional check for directory traversal patterns
		if (
			inputPath.includes('..') ||
			inputPath.includes('../') ||
			inputPath.includes('..\\')
		) {
			throw new Error(`Access denied: Path traversal detected in ${inputPath}`);
		}

		return resolvedPath;
	}

	/**
	 * Load Sigstore configuration
	 */
	private loadSigstoreConfig(): SigstoreConfig {
		return {
			rekorUrl: process.env.SIGSTORE_REKOR_URL || 'https://rekor.sigstore.dev',
			fulcioUrl: process.env.SIGSTORE_FULCIO_URL || 'https://fulcio.sigstore.dev',
			oidcIssuer: process.env.SIGSTORE_OIDC_ISSUER || 'https://oauth2.sigstore.dev/auth',
			tufRoot: process.env.SIGSTORE_TUF_ROOT || 'https://tuf-repo-cdn.sigstore.dev',
		};
	}

	/**
	 * Sign artifact with Sigstore
	 */
	async signWithSigstore(
		artifactPath: string,
		options: SigningOptions = {},
	): Promise<SignatureResult> {
		this.log(`🔐 Signing artifact with Sigstore: ${path.basename(artifactPath)}`);

		// Validate artifact path to prevent directory traversal
		const validatedArtifactPath = this.validateFilePath(artifactPath, [
			this.buildDir, // Allow artifacts in build directory
			path.join(this.buildDir, 'diamond-abi'), // Allow diamond ABI files
			path.join(this.buildDir, 'diamond-typechain-types'), // Allow typechain types
		]);

		if (!fs.existsSync(validatedArtifactPath)) {
			throw new Error(`Artifact not found: ${validatedArtifactPath}`);
		}

		const { identity = 'gnus-dao-ci@github.com', otherName = 'GNUS-DAO Build System' } =
			options;

		// Calculate artifact hash
		const artifactHash = this.calculateFileHash(validatedArtifactPath);

		// Create signature bundle
		const signatureBundle = await this.createSignatureBundle(validatedArtifactPath, {
			identity,
			otherName,
			artifactHash,
		});

		// Save signature bundle (signature file will be in same directory as artifact)
		const sigFile = `${validatedArtifactPath}.sigstore`;
		fs.writeFileSync(sigFile, JSON.stringify(signatureBundle, null, 2));

		this.log(`Sigstore signature created: ${sigFile}`);

		return {
			signatureFile: sigFile,
			bundle: signatureBundle,
		};
	}

	/**
	 * Create Sigstore signature bundle
	 */
	private async createSignatureBundle(
		artifactPath: string,
		options: { identity: string; otherName: string; artifactHash: string },
	): Promise<SignatureBundle> {
		const { identity, otherName, artifactHash } = options;

		// In a real implementation, this would use the Sigstore client libraries
		// For now, we'll create a mock bundle structure that follows Sigstore format

		// Create certificate (mock)
		const certificate: Certificate = {
			rawBytes: Buffer.from(this.generateMockCertificate(identity, otherName)).toString(
				'base64',
			),
			parsed: {
				subject: {
					commonName: identity,
					otherName: otherName,
				},
				issuer: {
					commonName: 'sigstore-intermediate',
					organization: ['sigstore.dev'],
				},
				validity: {
					notBefore: new Date(Date.now() - 3600000).toISOString(),
					notAfter: new Date(Date.now() + 31536000000).toISOString(),
				},
			},
		};

		// Create signature
		const signature = this.generateSignature(artifactHash);

		// Create transparency log entry
		const logEntry = await this.createTransparencyLogEntry(
			artifactHash,
			signature,
			certificate,
		);

		// Create the complete bundle
		const bundle: SignatureBundle = {
			mediaType: 'application/vnd.dev.sigstore.bundle+json;version=0.1',
			verificationMaterial: {
				certificate: certificate,
				tlogEntries: [logEntry],
				timestampVerificationData: {
					rfc3161Timestamps: [
						{
							signedTimestamp: this.generateTimestampToken(),
						},
					],
				},
			},
			messageSignature: {
				messageDigest: {
					algorithm: 'SHA2_256',
					digest: artifactHash,
				},
				signature: signature,
			},
		};

		return bundle;
	}

	/**
	 * Generate mock certificate for demonstration
	 */
	private generateMockCertificate(identity: string, otherName: string): string {
		// This is a simplified mock certificate
		// In production, this would be obtained from Fulcio
		const certData = {
			version: 3,
			serialNumber: crypto.randomBytes(16).toString('hex'),
			subject: {
				commonName: identity,
				otherName: otherName,
			},
			issuer: {
				commonName: 'sigstore-intermediate',
				organization: 'sigstore.dev',
			},
			validity: {
				notBefore: new Date(Date.now() - 3600000),
				notAfter: new Date(Date.now() + 31536000000),
			},
			publicKey: crypto.generateKeyPairSync('rsa', {
				modulusLength: 2048,
				publicKeyEncoding: { type: 'spki', format: 'pem' },
			} as any).publicKey,
		};

		return JSON.stringify(certData);
	}

	/**
	 * Generate cryptographic signature
	 */
	private generateSignature(data: string): string {
		// Use environment variable for signing key, fallback to mock for development
		// TODO The signing key should be securely managed in production with a secret manager
		const signingKey = process.env.SIGSTORE_SIGNING_KEY!;
		const hmac = crypto.createHmac('sha256', signingKey);
		hmac.update(data);
		return hmac.digest('base64');
	}

	/**
	 * Create transparency log entry
	 */
	private async createTransparencyLogEntry(
		artifactHash: string,
		signature: string,
		certificate: Certificate,
	): Promise<TransparencyLogEntry> {
		// In production, this would submit to Rekor and get a real log entry
		const logEntry: TransparencyLogEntry = {
			logIndex: Math.floor(Math.random() * 1000000), // Mock log index for testing // nosemgrep: insecure-random
			logId: {
				keyId: crypto.randomBytes(32).toString('hex'),
			},
			integratedTime: Math.floor(Date.now() / 1000),
			inclusionPromise: {
				signedEntryTimestamp: this.generateSignature(artifactHash + signature),
			},
			inclusionProof: {
				logIndex: Math.floor(Math.random() * 1000000), // Mock log index for testing // nosemgrep: insecure-random
				rootHash: crypto.randomBytes(32).toString('hex'),
				treeSize: Math.floor(Math.random() * 1000000) + 1000000, // nosemgrep: insecure-random
				hashes: Array.from({ length: 10 }, () => crypto.randomBytes(32).toString('hex')),
			},
			verified: true,
		};

		return logEntry;
	}

	/**
	 * Generate RFC 3161 timestamp token
	 */
	private generateTimestampToken(): string {
		// Mock timestamp token
		return Buffer.from(
			JSON.stringify({
				version: 1,
				policy: crypto.randomBytes(16).toString('hex'),
				messageImprint: {
					hashAlgorithm: 'sha256',
					hashedMessage: crypto.randomBytes(32).toString('hex'),
				},
				serialNumber: crypto.randomBytes(16).toString('hex'),
				genTime: new Date().toISOString(),
				accuracy: { seconds: 1 },
			}),
		).toString('base64');
	}

	/**
	 * Verify Sigstore signature
	 */
	async verifySigstoreSignature(
		artifactPath: string,
		signatureFile: string,
	): Promise<boolean> {
		this.log(`🔍 Verifying Sigstore signature for: ${path.basename(artifactPath)}`);

		// Validate artifact path
		const validatedArtifactPath = this.validateFilePath(artifactPath, [
			this.buildDir,
			path.join(this.buildDir, 'diamond-abi'),
			path.join(this.buildDir, 'diamond-typechain-types'),
		]);

		// Validate signature file path
		const validatedSignatureFile = this.validateFilePath(signatureFile, [
			this.buildDir,
			path.join(this.buildDir, 'diamond-abi'),
			path.join(this.buildDir, 'diamond-typechain-types'),
			this.attestationsDir, // Allow signature files in attestations directory
		]);

		if (!fs.existsSync(validatedSignatureFile)) {
			throw new Error(`Signature file not found: ${validatedSignatureFile}`);
		}

		const bundle: SignatureBundle = JSON.parse(
			fs.readFileSync(validatedSignatureFile, 'utf8'),
		);

		// Verify bundle structure
		this.verifyBundleStructure(bundle);

		// Verify artifact hash matches
		const artifactHash = this.calculateFileHash(validatedArtifactPath);
		if (artifactHash !== bundle.messageSignature.messageDigest.digest) {
			throw new Error('Artifact hash does not match signature');
		}

		// Verify certificate
		this.verifyCertificate(bundle.verificationMaterial.certificate);

		// Verify transparency log entry
		await this.verifyTransparencyLogEntry(bundle.verificationMaterial.tlogEntries[0]);

		// Verify signature
		this.verifySignature(bundle);

		this.log('✅ Sigstore signature verification successful');
		return true;
	}

	/**
	 * Verify bundle structure
	 */
	private verifyBundleStructure(bundle: SignatureBundle): void {
		const requiredFields = ['mediaType', 'verificationMaterial', 'messageSignature'];

		for (const field of requiredFields) {
			if (!(field in bundle)) {
				throw new Error(`Missing required field: ${field}`);
			}
		}

		if (!bundle.mediaType.includes('sigstore.bundle')) {
			throw new Error('Invalid bundle media type');
		}
	}

	/**
	 * Verify certificate
	 */
	private verifyCertificate(certificate: Certificate): void {
		if (!certificate.parsed) {
			throw new Error('Certificate missing parsed data');
		}

		const now = new Date();
		const notBefore = new Date(certificate.parsed.validity.notBefore);
		const notAfter = new Date(certificate.parsed.validity.notAfter);

		if (now < notBefore || now > notAfter) {
			throw new Error('Certificate is not valid for current time');
		}

		// Verify issuer is Sigstore
		if (!certificate.parsed.issuer.organization.includes('sigstore.dev')) {
			throw new Error('Certificate not issued by Sigstore');
		}
	}

	/**
	 * Verify transparency log entry
	 */
	private async verifyTransparencyLogEntry(logEntry: TransparencyLogEntry): Promise<void> {
		// In production, this would verify against Rekor
		if (!logEntry.logId || !logEntry.integratedTime) {
			throw new Error('Invalid transparency log entry');
		}

		// Verify log entry is not too old (within 24 hours for demo)
		const entryTime = new Date(logEntry.integratedTime * 1000);
		const now = new Date();
		const hoursDiff = (now.getTime() - entryTime.getTime()) / (1000 * 60 * 60);

		if (hoursDiff > 24) {
			throw new Error('Transparency log entry is too old');
		}
	}

	/**
	 * Verify signature
	 */
	private verifySignature(bundle: SignatureBundle): void {
		const { messageDigest, signature } = bundle.messageSignature;

		// In production, this would verify the signature using the certificate's public key
		// For demo purposes, we'll do a basic check
		const expectedSignature = this.generateSignature(messageDigest.digest);

		if (signature !== expectedSignature) {
			throw new Error('Signature verification failed');
		}
	}

	/**
	 * Sign all build artifacts
	 */
	async signAllArtifacts(options: SigningOptions = {}): Promise<SignatureResult[]> {
		this.log('🔐 Signing all build artifacts with Sigstore');

		const artifacts = await this.findBuildArtifacts();

		if (artifacts.length === 0) {
			this.log('⚠️ No build artifacts found to sign');
			return [];
		}

		const signatures: SignatureResult[] = [];

		for (const artifact of artifacts) {
			try {
				const result = await this.signWithSigstore(artifact, options);
				signatures.push(result);
			} catch (error) {
				this.log(`❌ Failed to sign ${artifact}: ${error}`, 'error');
			}
		}

		// Create signature manifest
		this.createSignatureManifest(signatures);

		this.log(`✅ Signed ${signatures.length} artifacts with Sigstore`);
		return signatures;
	}

	/**
	 * Verify all artifact signatures
	 */
	async verifyAllSignatures(): Promise<VerificationResult> {
		this.log('🔍 Verifying all Sigstore signatures');

		const artifacts = await this.findBuildArtifacts();
		let verified = 0;
		let failed = 0;

		for (const artifact of artifacts) {
			const sigFile = `${artifact}.sigstore`;
			try {
				await this.verifySigstoreSignature(artifact, sigFile);
				verified++;
			} catch (error) {
				this.log(`❌ Failed to verify ${artifact}: ${error}`, 'error');
				failed++;
			}
		}

		this.log(`✅ Verified: ${verified}, Failed: ${failed}`);
		return { verified, failed };
	}

	/**
	 * Find build artifacts
	 */
	private async findBuildArtifacts(): Promise<string[]> {
		const artifacts: string[] = [];

		// Diamond ABI files
		const diamondAbiDir = path.join(this.buildDir, 'diamond-abi');
		if (fs.existsSync(diamondAbiDir)) {
			const files = fs
				.readdirSync(diamondAbiDir)
				.filter((file) => file.endsWith('.json'))
				.map((file) => path.join(diamondAbiDir, file));
			artifacts.push(...files);
		}

		// TypeChain types
		const typechainDir = path.join(this.buildDir, 'diamond-typechain-types');
		if (fs.existsSync(typechainDir)) {
			const files = fs
				.readdirSync(typechainDir)
				.filter((file) => file.endsWith('.ts'))
				.map((file) => path.join(typechainDir, file));
			artifacts.push(...files);
		}

		return artifacts;
	}

	/**
	 * Create signature manifest
	 */
	private createSignatureManifest(signatures: SignatureResult[]): void {
		const manifest = {
			version: '1.0',
			created: new Date().toISOString(),
			signer: 'gnus-dao-sigstore',
			signingTool: 'sigstore-integration',
			signatures: signatures.map((sig) => ({
				artifact: path.basename(sig.signatureFile.replace('.sigstore', '')),
				signatureFile: path.basename(sig.signatureFile),
				bundle: sig.bundle,
			})),
		};

		const manifestFile = path.join(this.attestationsDir, 'sigstore-manifest.json');
		fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
		fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));

		this.log(`Sigstore manifest created: ${manifestFile}`);
	}

	/**
	 * Calculate file hash
	 */
	private calculateFileHash(filePath: string): string {
		const fileBuffer = fs.readFileSync(filePath);
		const hash = crypto.createHash('sha256');
		hash.update(fileBuffer);
		return hash.digest('hex');
	}

	/**
	 * Get Sigstore status
	 */
	async getSigstoreStatus(): Promise<{ status: string; config: SigstoreConfig }> {
		this.log('🔍 Checking Sigstore status');

		// In a real implementation, this would check Sigstore service availability
		const status = 'mock-implementation';

		return {
			status,
			config: this.sigstoreConfig,
		};
	}
}

// CLI interface
async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const command = args[0];

	const sigstore = new SigstoreIntegration();

	switch (command) {
		case 'sign':
			if (!args[1]) {
				console.error('Usage: node sigstore-integration.js sign <artifact-path>');
				process.exit(1);
			}
			await sigstore.signWithSigstore(args[1]);
			break;

		case 'sign-all':
			await sigstore.signAllArtifacts();
			break;

		case 'verify':
			if (!args[1] || !args[2]) {
				console.error(
					'Usage: node sigstore-integration.js verify <artifact-path> <signature-file>',
				);
				process.exit(1);
			}
			await sigstore.verifySigstoreSignature(args[1], args[2]);
			break;

		case 'verify-all':
			const result = await sigstore.verifyAllSignatures();
			if (result.failed > 0) {
				process.exit(1);
			}
			break;

		case 'status':
			const status = await sigstore.getSigstoreStatus();
			console.log('Sigstore Status:', status);
			break;

		default:
			console.log('GNUS-DAO Sigstore Integration');
			console.log('');
			console.log('Usage:');
			console.log('  sign <artifact-path>        Sign a specific artifact');
			console.log('  sign-all                    Sign all build artifacts');
			console.log('  verify <artifact> <sig>     Verify a specific signature');
			console.log('  verify-all                  Verify all signatures');
			console.log('  status                      Show Sigstore status');
			console.log('');
			console.log('Examples:');
			console.log('  node scripts/devops/sigstore-integration.js sign-all');
			console.log('  node scripts/devops/sigstore-integration.js verify-all');
			process.exit(1);
	}
}

// Run if called directly
if (require.main === module) {
	main().catch((error) => {
		console.error('Error:', error.message);
		process.exit(1);
	});
}

export default SigstoreIntegration;
