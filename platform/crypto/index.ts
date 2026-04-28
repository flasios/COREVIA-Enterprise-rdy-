import crypto from 'node:crypto';
import type { IStorage } from '@interfaces/storage';
import { logger } from '@platform/logging/Logger';

type AuditAction = 'created' | 'viewed' | 'edited' | 'approved' | 'restored' | 'exported' | 'signed';

interface AuditEntryInput {
	versionId: string;
	action: AuditAction;
	userId: string;
	userName: string;
	userRole: string;
	metadata?: Record<string, unknown>;
	ipAddress?: string;
	userAgent?: string;
	beforeSnapshot?: unknown;
	afterSnapshot?: unknown;
}

/**
 * CryptoService - Cryptographic Operations for Version Signatures
 *
 * Provides secure cryptographic signatures for Business Case versions
 * to ensure data integrity and authenticity for government compliance.
 */
export class CryptoService {
	private readonly storage: IStorage;
	private readonly secretKey: string;

	constructor(storage: IStorage) {
		this.storage = storage;
		this.secretKey = process.env.SIGNATURE_SECRET_KEY || crypto.randomBytes(32).toString('hex');
	}

	generateContentHash(data: unknown): string {
		try {
			const content = JSON.stringify(data);
			const hash = crypto.createHash('sha256');
			hash.update(content);
			return hash.digest('hex');
		} catch (error) {
			logger.error('Error generating content hash:', error);
			throw new Error('Failed to generate content hash');
		}
	}

	async signVersion(
		versionId: string,
		userId: string,
		userName: string,
		userRole: string,
		content: unknown,
		ipAddress?: string,
		userAgent?: string,
	): Promise<{
		contentHash: string;
		signature: string;
		signedBy: string;
		signedByName: string;
		signedByRole: string;
		signedAt: Date;
		algorithm: string;
	}> {
		try {
			const contentHash = this.generateContentHash(content);
			const signedAt = new Date();
			const signaturePayload = {
				versionId,
				contentHash,
				userId,
				userName,
				userRole,
				signedAt: signedAt.toISOString(),
			};

			const hmac = crypto.createHmac('sha256', this.secretKey);
			hmac.update(JSON.stringify(signaturePayload));
			const signature = hmac.digest('hex');

			await this.createAuditEntry({
				versionId,
				action: 'signed',
				userId,
				userName,
				userRole,
				metadata: {
					contentHash,
					signature,
					algorithm: 'HMAC-SHA256',
					signatureVerified: true,
				},
				ipAddress,
				userAgent,
			});

			logger.info(`✓ Version ${versionId} signed by ${userName} (${userRole})`);

			return {
				contentHash,
				signature,
				signedBy: userId,
				signedByName: userName,
				signedByRole: userRole,
				signedAt,
				algorithm: 'HMAC-SHA256',
			};
		} catch (error) {
			logger.error('Error signing version:', error);
			throw new Error('Failed to sign version');
		}
	}

	verifySignature(
		versionId: string,
		currentContent: unknown,
		storedSignature: {
			contentHash: string;
			signature: string;
			signedBy: string;
			signedByName: string;
			signedByRole: string;
			signedAt: string | Date;
			algorithm: string;
		},
	): {
		isValid: boolean;
		contentHashMatch: boolean;
		signatureValid: boolean;
		currentHash: string;
		storedHash: string;
		details: string;
	} {
		try {
			const currentHash = this.generateContentHash(currentContent);
			const contentHashMatch = currentHash === storedSignature.contentHash;

			const signaturePayload = {
				versionId,
				contentHash: storedSignature.contentHash,
				userId: storedSignature.signedBy,
				userName: storedSignature.signedByName,
				userRole: storedSignature.signedByRole,
				signedAt: typeof storedSignature.signedAt === 'string'
					? storedSignature.signedAt
					: storedSignature.signedAt.toISOString(),
			};

			const hmac = crypto.createHmac('sha256', this.secretKey);
			hmac.update(JSON.stringify(signaturePayload));
			const expectedSignature = hmac.digest('hex');

			const signatureValid = expectedSignature === storedSignature.signature;
			const isValid = contentHashMatch && signatureValid;

			let details: string;
			if (isValid) {
				details = 'Signature is valid and content has not been tampered with';
			} else if (!contentHashMatch) {
				details = 'WARNING: Content has been modified since signature was created';
			} else if (signatureValid) {
				details = 'Verification failed';
			} else {
				details = 'WARNING: Signature is invalid - possible security breach';
			}

			logger.info(`Signature verification for ${versionId}: ${isValid ? 'VALID' : 'INVALID'}`);

			return {
				isValid,
				contentHashMatch,
				signatureValid,
				currentHash,
				storedHash: storedSignature.contentHash,
				details,
			};
		} catch (error) {
			logger.error('Error verifying signature:', error);
			return {
				isValid: false,
				contentHashMatch: false,
				signatureValid: false,
				currentHash: '',
				storedHash: storedSignature.contentHash,
				details: 'Verification error occurred',
			};
		}
	}

	async createAuditEntry(input: AuditEntryInput): Promise<void> {
		try {
			const {
				versionId,
				action,
				userId,
				userName,
				userRole,
				metadata,
				ipAddress,
				userAgent,
				beforeSnapshot,
				afterSnapshot,
			} = input;

			const version = await this.storage.getReportVersion(versionId);
			if (!version) {
				throw new Error('Version not found');
			}

			const actionDescriptions: Record<string, string> = {
				created: 'Version created',
				viewed: 'Version viewed',
				edited: 'Version edited',
				approved: 'Version approved',
				restored: 'Version restored',
				exported: 'Version exported to PDF',
				signed: 'Version digitally signed',
			};

			const actionDescription = actionDescriptions[action] || `Action: ${action}`;

			await this.storage.createVersionAuditLog({
				versionId,
				reportId: version.reportId,
				action,
				actionDescription,
				previousState: beforeSnapshot || null,
				newState: afterSnapshot || null,
				performedBy: userId,
				performedByName: userName,
				performedByRole: userRole,
				performedByDepartment: undefined,
				sessionId: undefined,
				ipAddress: ipAddress || undefined,
				userAgent: userAgent || undefined,
				complianceLevel: action === 'signed' ? 'critical' : 'standard',
				securityFlags: metadata || null,
			});

			logger.info(`📝 Audit entry created: ${action} by ${userName} for version ${versionId}`);
		} catch (error) {
			logger.error('Error creating audit entry:', error);
		}
	}

	async getAuditTrail(versionId: string) {
		try {
			const auditLogs = await this.storage.getVersionAuditLog(versionId);
			return auditLogs.sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
		} catch (error) {
			logger.error('Error fetching audit trail:', error);
			throw new Error('Failed to fetch audit trail');
		}
	}

	canSignVersions(userRole: string): boolean {
		const authorizedRoles = ['director', 'manager'];
		return authorizedRoles.includes(userRole.toLowerCase());
	}
}

export function createCryptoService(storage: IStorage): CryptoService {
	return new CryptoService(storage);
}