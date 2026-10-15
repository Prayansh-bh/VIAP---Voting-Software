import { AuditAction, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { encryptSecret, decryptSecret, maskSecret, EncryptedPayload } from '../../lib/crypto.js';
import { logAudit } from '../../middleware/audit.js';

export interface StoredCredentialRecord extends EncryptedPayload {
  keyName: string;
  maskedValue: string;
  provider?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  rotatedAt?: string;
}

export interface CredentialSummary {
  keyName: string;
  maskedValue: string;
  provider?: string;
  version: number;
  updatedAt: string;
}

export class CredentialsService {
  /**
   * Helper to fetch or initialize CMSConfiguration for an organisation
   */
  private static async getOrCreateCmsConfig(organisationId: string) {
    let cms = await prisma.cMSConfiguration.findFirst({
      where: { organisationId },
    });

    if (!cms) {
      const org = await prisma.organisation.findUnique({ where: { id: organisationId } });
      cms = await prisma.cMSConfiguration.create({
        data: {
          organisationId,
          configKey: org ? org.code.toLowerCase() : `org_${organisationId.slice(0, 8)}`,
          organisationName: org?.name || 'Political Connect',
          stateName: 'Andhra Pradesh',
          hierarchyLabels: {},
          featureToggles: {},
          dashboardConfig: { credentials: {} },
        },
      });
    }

    return cms;
  }

  /**
   * List all credentials for an organisation (masked only, never reveals secret)
   */
  static async listCredentials(organisationId: string): Promise<CredentialSummary[]> {
    const cms = await prisma.cMSConfiguration.findFirst({
      where: { organisationId },
    });

    if (!cms || !cms.dashboardConfig || typeof cms.dashboardConfig !== 'object') {
      return [];
    }

    const config = cms.dashboardConfig as Record<string, any>;
    const credentials = (config.credentials || {}) as Record<string, StoredCredentialRecord>;

    return Object.values(credentials).map((cred) => ({
      keyName: cred.keyName,
      maskedValue: cred.maskedValue,
      provider: cred.provider,
      version: cred.version,
      updatedAt: cred.updatedAt,
    }));
  }

  /**
   * Encrypt and store a new or updated credential
   */
  static async setCredential(
    organisationId: string,
    keyName: string,
    secretValue: string,
    actorId: string,
    provider?: string,
  ): Promise<CredentialSummary> {
    if (!keyName || !/^[A-Za-z0-9_-]{3,64}$/.test(keyName)) {
      const err: any = new Error('Invalid keyName: must be alphanumeric (3-64 chars) with underscores/hyphens');
      err.statusCode = 400;
      err.code = 'INVALID_KEY_NAME';
      throw err;
    }

    if (!secretValue || typeof secretValue !== 'string' || secretValue.trim().length === 0) {
      const err: any = new Error('Secret value must be a non-empty string');
      err.statusCode = 400;
      err.code = 'INVALID_SECRET_VALUE';
      throw err;
    }

    const cms = await this.getOrCreateCmsConfig(organisationId);
    const dashboardConfig = (cms.dashboardConfig && typeof cms.dashboardConfig === 'object'
      ? { ...cms.dashboardConfig }
      : {}) as Record<string, any>;

    const existingCreds = ((dashboardConfig.credentials || {}) as Record<string, StoredCredentialRecord>);
    const existing = existingCreds[keyName];

    const encrypted = encryptSecret(secretValue.trim());
    const masked = maskSecret(secretValue.trim());
    const now = new Date().toISOString();
    const version = existing ? existing.version + 1 : 1;

    const record: StoredCredentialRecord = {
      keyName,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      maskedValue: masked,
      provider: provider || existing?.provider,
      version,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      updatedBy: actorId,
      ...(existing ? { rotatedAt: now } : {}),
    };

    dashboardConfig.credentials = {
      ...existingCreds,
      [keyName]: record,
    };

    await prisma.cMSConfiguration.update({
      where: { id: cms.id },
      data: {
        dashboardConfig: dashboardConfig as Prisma.InputJsonValue,
      },
    });

    // Audit log without ANY sensitive values
    await logAudit({
      action: existing ? AuditAction.STATUS_CHANGE : AuditAction.CREATE,
      entityType: 'Credential',
      entityId: keyName,
      userId: actorId,
      metadata: {
        keyName,
        maskedValue: masked,
        provider: record.provider,
        version,
        action: existing ? 'ROTATED' : 'CREATED',
      },
    });

    return {
      keyName: record.keyName,
      maskedValue: record.maskedValue,
      provider: record.provider,
      version: record.version,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Rotate an existing credential with a new secret value
   */
  static async rotateCredential(
    organisationId: string,
    keyName: string,
    newSecretValue: string,
    actorId: string,
  ): Promise<CredentialSummary> {
    const cms = await prisma.cMSConfiguration.findFirst({
      where: { organisationId },
    });

    const config = (cms?.dashboardConfig || {}) as Record<string, any>;
    const existingCreds = (config.credentials || {}) as Record<string, StoredCredentialRecord>;
    const existing = existingCreds[keyName];

    if (!existing) {
      const err: any = new Error(`Credential ${keyName} not found to rotate`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    return this.setCredential(organisationId, keyName, newSecretValue, actorId, existing.provider);
  }

  /**
   * Reveal (decrypt) a stored secret for authorized tenant administrator
   */
  static async revealCredential(
    organisationId: string,
    keyName: string,
    actorId: string,
  ): Promise<{ keyName: string; secretValue: string; maskedValue: string; version: number }> {
    const cms = await prisma.cMSConfiguration.findFirst({
      where: { organisationId },
    });

    const config = (cms?.dashboardConfig || {}) as Record<string, any>;
    const existingCreds = (config.credentials || {}) as Record<string, StoredCredentialRecord>;
    const record = existingCreds[keyName];

    if (!record) {
      const err: any = new Error(`Credential ${keyName} not found`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const decrypted = decryptSecret({
      ciphertext: record.ciphertext,
      iv: record.iv,
      authTag: record.authTag,
    });

    // Log revelation in audit trail
    await logAudit({
      action: AuditAction.STATUS_CHANGE,
      entityType: 'Credential',
      entityId: keyName,
      userId: actorId,
      metadata: {
        keyName,
        maskedValue: record.maskedValue,
        action: 'SECRET_REVEALED',
      },
    });

    return {
      keyName: record.keyName,
      secretValue: decrypted,
      maskedValue: record.maskedValue,
      version: record.version,
    };
  }

  /**
   * Delete a credential
   */
  static async deleteCredential(
    organisationId: string,
    keyName: string,
    actorId: string,
  ): Promise<{ keyName: string; deleted: boolean }> {
    const cms = await prisma.cMSConfiguration.findFirst({
      where: { organisationId },
    });

    if (!cms || !cms.dashboardConfig || typeof cms.dashboardConfig !== 'object') {
      const err: any = new Error(`Credential ${keyName} not found`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const dashboardConfig = { ...cms.dashboardConfig } as Record<string, any>;
    const existingCreds = { ...((dashboardConfig.credentials || {}) as Record<string, StoredCredentialRecord>) };

    if (!existingCreds[keyName]) {
      const err: any = new Error(`Credential ${keyName} not found`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const masked = existingCreds[keyName].maskedValue;
    delete existingCreds[keyName];
    dashboardConfig.credentials = existingCreds;

    await prisma.cMSConfiguration.update({
      where: { id: cms.id },
      data: {
        dashboardConfig: dashboardConfig as Prisma.InputJsonValue,
      },
    });

    await logAudit({
      action: AuditAction.DELETE,
      entityType: 'Credential',
      entityId: keyName,
      userId: actorId,
      metadata: { keyName, maskedValue: masked, deleted: true },
    });

    return { keyName, deleted: true };
  }
}
