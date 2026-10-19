import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { errorResponse, successResponse } from '../../common/response.js';
import { CredentialsService } from './credentials.service.js';

export class CredentialsController {
  private static async getTargetOrgId(req: FastifyRequest): Promise<string | null> {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    if (isSuperAdmin) {
      const queryOrgId = (req.query as any)?.organisationId || (req.body as any)?.organisationId;
      if (queryOrgId) return queryOrgId;
      if (req.user?.organisationId) return req.user.organisationId;
      const defaultOrg = await prisma.organisation.findFirst({ orderBy: { createdAt: 'asc' } });
      return defaultOrg?.id || null;
    }
    return req.user?.organisationId || null;
  }

  static async listCredentials(req: FastifyRequest, reply: FastifyReply) {
    const orgId = await CredentialsController.getTargetOrgId(req);

    try {
      const items = await CredentialsService.listCredentials(orgId);
      return reply.send(successResponse(items));
    } catch (err: any) {
      const status = err.statusCode || 500;
      return reply.status(status).send(errorResponse(err.message, err.code || 'CREDENTIAL_ERROR'));
    }
  }

  static async setCredential(req: FastifyRequest, reply: FastifyReply) {
    const orgId = await CredentialsController.getTargetOrgId(req);
    if (!orgId) {
      return reply.status(403).send(errorResponse('Tenant organization context required', 'FORBIDDEN_TENANT'));
    }

    const body = req.body as { keyName: string; secretValue: string; provider?: string };
    if (!body || !body.keyName || !body.secretValue) {
      return reply.status(400).send(errorResponse('keyName and secretValue are required', 'INVALID_PAYLOAD'));
    }

    try {
      const result = await CredentialsService.setCredential(
        orgId,
        body.keyName,
        body.secretValue,
        req.user!.userId,
        body.provider,
      );

      return reply.status(201).send(successResponse(result, 'Credential encrypted and saved successfully'));
    } catch (err: any) {
      const status = err.statusCode || 500;
      return reply.status(status).send(errorResponse(err.message, err.code || 'CREDENTIAL_ERROR'));
    }
  }

  static async rotateCredential(req: FastifyRequest<{ Params: { keyName: string }; Body: { newSecretValue: string } }>, reply: FastifyReply) {
    const orgId = await CredentialsController.getTargetOrgId(req);
    if (!orgId) {
      return reply.status(403).send(errorResponse('Tenant organization context required', 'FORBIDDEN_TENANT'));
    }

    const body = req.body as { newSecretValue: string };
    if (!body || !body.newSecretValue) {
      return reply.status(400).send(errorResponse('newSecretValue is required to rotate credential', 'INVALID_PAYLOAD'));
    }

    try {
      const result = await CredentialsService.rotateCredential(
        orgId,
        req.params.keyName,
        body.newSecretValue,
        req.user!.userId,
      );

      return reply.send(successResponse(result, 'Credential rotated and re-encrypted successfully'));
    } catch (err: any) {
      const status = err.statusCode || 500;
      return reply.status(status).send(errorResponse(err.message, err.code || 'CREDENTIAL_ERROR'));
    }
  }

  static async revealCredential(req: FastifyRequest<{ Params: { keyName: string } }>, reply: FastifyReply) {
    const orgId = await CredentialsController.getTargetOrgId(req);
    if (!orgId) {
      return reply.status(403).send(errorResponse('Tenant organization context required', 'FORBIDDEN_TENANT'));
    }

    try {
      const result = await CredentialsService.revealCredential(
        orgId,
        req.params.keyName,
        req.user!.userId,
      );

      return reply.send(successResponse(result, 'Credential decrypted for authorized admin'));
    } catch (err: any) {
      const status = err.statusCode || 500;
      return reply.status(status).send(errorResponse(err.message, err.code || 'CREDENTIAL_ERROR'));
    }
  }

  static async deleteCredential(req: FastifyRequest<{ Params: { keyName: string } }>, reply: FastifyReply) {
    const orgId = await CredentialsController.getTargetOrgId(req);
    if (!orgId) {
      return reply.status(403).send(errorResponse('Tenant organization context required', 'FORBIDDEN_TENANT'));
    }

    try {
      const result = await CredentialsService.deleteCredential(
        orgId,
        req.params.keyName,
        req.user!.userId,
      );

      return reply.send(successResponse(result, 'Credential deleted successfully'));
    } catch (err: any) {
      const status = err.statusCode || 500;
      return reply.status(status).send(errorResponse(err.message, err.code || 'CREDENTIAL_ERROR'));
    }
  }
}
