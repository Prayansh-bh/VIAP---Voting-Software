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
   * Helper to resolve or initialize CMSConfiguration flexibly by:
   * 1. CMSConfiguration.id
   * 2. CMSConfiguration.organisationId
   * 3. CMSConfiguration.configKey
   * 4. Organisation.id or Organisation.code
   * 5. Platform default configuration
   */
  public static async resolveCmsConfig(targetId?: string | null) {
    let cms: any = null;

    if (targetId && typeof targetId === 'string' && targetId.trim().length > 0) {
      const cleanTarget = targetId.trim();

      // 1. Try finding by CMSConfiguration.id
      cms = await prisma.cMSConfiguration.findUnique({
        where: { id: cleanTarget },
      });

      // 2. Try finding by CMSConfiguration.organisationId
      if (!cms) {
        cms = await prisma.cMSConfiguration.findFirst({
          where: { organisationId: cleanTarget },
        });
      }

      // 3. Try finding by CMSConfiguration.configKey
      if (!cms) {
        cms = await prisma.cMSConfiguration.findFirst({
          where: { configKey: { equals: cleanTarget, mode: 'insensitive' } },
        });
      }

      // 4. Try finding by Organisation id or code
      if (!cms) {
        const org = await prisma.organisation.findFirst({
          where: {
            OR: [
              { id: cleanTarget },
              { code: { equals: cleanTarget, mode: 'insensitive' } },
            ],
          },
        });

        if (org) {
          cms = await prisma.cMSConfiguration.findFirst({
            where: { organisationId: org.id },
          });

          if (!cms) {
            cms = await prisma.cMSConfiguration.create({
              data: {
                organisationId: org.id,
                configKey: org.code.toLowerCase(),
                organisationName: org.name,
                stateName: 'Andhra Pradesh',
                hierarchyLabels: {},
                featureToggles: {},
                dashboardConfig: { credentials: {} },
              },
            });
          }
        }
      }
    }

    // 5. Fallback to default/first CMSConfiguration
    if (!cms) {
      cms = await prisma.cMSConfiguration.findFirst({
        where: { configKey: 'default' },
      });
      if (!cms) {
        cms = await prisma.cMSConfiguration.findFirst({
          orderBy: { createdAt: 'asc' },
        });
      }
      if (!cms) {
        const firstOrg = await prisma.organisation.findFirst({
          orderBy: { createdAt: 'asc' },
        });
        if (firstOrg) {
          cms = await prisma.cMSConfiguration.create({
            data: {
              organisationId: firstOrg.id,
              configKey: firstOrg.code.toLowerCase(),
              organisationName: firstOrg.name,
              stateName: 'Andhra Pradesh',
              hierarchyLabels: {},
              featureToggles: {},
              dashboardConfig: { credentials: {} },
            },
          });
        }
      }
    }

    return cms;
  }

  /**
   * List all credentials for an organisation or platform scope (masked only, never reveals secret)
   */
  static async listCredentials(organisationId?: string | null): Promise<CredentialSummary[]> {
    const cms = await this.resolveCmsConfig(organisationId);

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
    organisationId: string | null | undefined,
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

    const cms = await this.resolveCmsConfig(organisationId);
    if (!cms) {
      const err: any = new Error('Unable to resolve or initialize configuration for tenant credentials');
      err.statusCode = 404;
      err.code = 'TENANT_NOT_FOUND';
      throw err;
    }

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
    organisationId: string | null | undefined,
    keyName: string,
    newSecretValue: string,
    actorId: string,
  ): Promise<CredentialSummary> {
    const cms = await this.resolveCmsConfig(organisationId);
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
    organisationId: string | null | undefined,
    keyName: string,
    actorId: string,
  ): Promise<{ keyName: string; secretValue: string; maskedValue: string; version: number }> {
    const cms = await this.resolveCmsConfig(organisationId);
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
    organisationId: string | null | undefined,
    keyName: string,
    actorId: string,
  ): Promise<{ keyName: string; deleted: boolean }> {
    const cms = await this.resolveCmsConfig(organisationId);

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

  /**
   * Decrypt and retrieve a stored secret for internal system services (e.g. AI Engine, SMS Gateway)
   * Resolves for a specific tenant, or falls back to platform CMS configs, or env variable fallback.
   */
  static async getDecryptedSecret(
    organisationId?: string | null,
    keyName: string = 'GEMINI_API_KEY',
  ): Promise<string | null> {
    try {
      let targetRecord: StoredCredentialRecord | undefined;

      // 1. Try resolving through resolveCmsConfig
      const cms = await this.resolveCmsConfig(organisationId);
      if (cms && cms.dashboardConfig && typeof cms.dashboardConfig === 'object') {
        const creds = (cms.dashboardConfig as any).credentials;
        if (creds && creds[keyName]) {
          targetRecord = creds[keyName] as StoredCredentialRecord;
        }
      }

      // 2. If not found, search across all CMS configurations for this keyName
      if (!targetRecord) {
        const configs = await prisma.cMSConfiguration.findMany({
          orderBy: { createdAt: 'asc' },
        });
        for (const config of configs) {
          const creds = (config.dashboardConfig as any)?.credentials as Record<string, StoredCredentialRecord> | undefined;
          if (creds && creds[keyName]) {
            targetRecord = creds[keyName];
            break;
          }
        }
      }

      // 3. If record found, decrypt it
      if (targetRecord && targetRecord.ciphertext && targetRecord.iv && targetRecord.authTag) {
        const decrypted = decryptSecret({
          ciphertext: targetRecord.ciphertext,
          iv: targetRecord.iv,
          authTag: targetRecord.authTag,
        });
        if (decrypted && decrypted.trim().length > 0) {
          return decrypted.trim();
        }
      }
    } catch (err) {
      console.warn(`[CredentialsService] Error fetching decrypted credential for ${keyName}:`, err);
    }

    // 4. Fallback to process.env if present
    const envVal = process.env[keyName];
    if (envVal && envVal.trim().length > 0) {
      return envVal.trim();
    }

    return null;
  }
}
