import { FastifyReply, FastifyRequest } from 'fastify';
import { errorResponse, successResponse } from '../../common/response.js';
import { assertOrganisationAccess, assertUserScope } from '../../middleware/rbac.js';
import { prisma } from '../../lib/prisma.js';
import { CadreService } from './cadre.service.js';
import { InchargeProvisioningService } from './incharge-provisioning.service.js';

export class CadreController {
  static async listCadre(req: FastifyRequest<{ Querystring: { page?: string; limit?: string } }>, reply: FastifyReply) {
    const page = Math.max(1, Number(req.query?.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query?.limit) || 100));
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const items = await CadreService.listCadres(
      req.hierarchyScope?.accessibleUnitIds,
      page,
      limit,
      req.user?.organisationId,
      isSuperAdmin,
    );
    return reply.send(successResponse(items));
  }

  static async createCadre(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as any;
    if (body?.userId && !(await assertUserScope(req, reply, body.userId))) return;
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const item = await CadreService.createCadre(
      body,
      req.user!.userId,
      req.user?.organisationId,
      isSuperAdmin,
    );
    return reply.status(201).send(successResponse(item, 'Cadre created'));
  }

  static async updateCadre(req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) {
    const existing = await prisma.cadre.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });
    if (!existing) {
      return reply.status(404).send(errorResponse('Cadre not found', 'NOT_FOUND'));
    }

    if (!assertOrganisationAccess(req, reply, existing.user?.organisationId)) return;
    if (!(await assertUserScope(req, reply, existing.userId))) return;

    const ALLOWED_CADRE_UPDATE_FIELDS = [
      'skills',
      'badges',
      'performanceScore',
      'totalAssignedVoters',
      'votedCoveredCount',
      'tasksCompletedCount',
      'trainingCompletedCount',
    ];

    const sanitizedData: Record<string, any> = {};
    for (const field of ALLOWED_CADRE_UPDATE_FIELDS) {
      if (req.body && (req.body as any)[field] !== undefined) {
        sanitizedData[field] = (req.body as any)[field];
      }
    }

    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const item = await CadreService.updateCadre(
      req.params.id,
      sanitizedData,
      req.user!.userId,
      req.user?.organisationId,
      isSuperAdmin,
    );
    return reply.send(successResponse(item, 'Cadre updated'));
  }

  static async deleteCadre(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const result = await CadreService.deleteCadre(
      req.params.id,
      req.user!.userId,
      req.user?.organisationId,
      isSuperAdmin,
    );
    return reply.send(successResponse(result, 'Cadre profile deleted successfully'));
  }

  static async getCadreNetwork(req: FastifyRequest, reply: FastifyReply) {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const network = await CadreService.getCadreNetwork(
      req.hierarchyScope?.accessibleUnitIds,
      req.user?.organisationId,
      isSuperAdmin,
    );
    return reply.send(successResponse(network));
  }

  static async getCadrePerformance(req: FastifyRequest, reply: FastifyReply) {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const perf = await CadreService.getCadrePerformance(
      req.hierarchyScope?.accessibleUnitIds,
      req.user?.organisationId,
      isSuperAdmin,
    );
    return reply.send(successResponse(perf));
  }

  static async getRosterPreview(req: FastifyRequest<{ Params: { constituencyId: string } }>, reply: FastifyReply) {
    const { constituencyId } = req.params;
    if (!constituencyId) {
      return reply.status(400).send(errorResponse('constituencyId is required', 'VALIDATION_ERROR'));
    }

    // Role-wise scope verification: fail-closed if out of scope
    if (req.hierarchyScope && !req.hierarchyScope.isGlobalScope) {
      if (!req.hierarchyScope.accessibleConstituencyIds.has(constituencyId)) {
        return reply.status(403).send(errorResponse('Access denied to this constituency roster', 'FORBIDDEN_SCOPE'));
      }
    }

    const preview = await InchargeProvisioningService.generateRosterPreview(constituencyId);
    return reply.send(successResponse(preview));
  }

  static async provisionRoster(
    req: FastifyRequest<{ Params: { constituencyId: string }; Body?: { partyCode?: string; defaultPasscode?: string } }>,
    reply: FastifyReply
  ) {
    const { constituencyId } = req.params;
    if (!constituencyId) {
      return reply.status(400).send(errorResponse('constituencyId is required', 'VALIDATION_ERROR'));
    }

    if (req.hierarchyScope && !req.hierarchyScope.isGlobalScope) {
      if (!req.hierarchyScope.accessibleConstituencyIds.has(constituencyId)) {
        return reply.status(403).send(errorResponse('Access denied to this constituency roster', 'FORBIDDEN_SCOPE'));
      }
    }

    const body = req.body || {};
    const result = await InchargeProvisioningService.provisionIncharges({
      constituencyId,
      organisationId: req.user?.organisationId ?? undefined,
      partyCode: body.partyCode,
      defaultPasscode: body.defaultPasscode || '123456',
      actorId: req.user?.userId,
    });

    return reply.status(201).send(successResponse(result, 'Cadre incharge accounts provisioned successfully'));
  }

  static async exportRoster(req: FastifyRequest<{ Params: { constituencyId: string } }>, reply: FastifyReply) {
    const { constituencyId } = req.params;
    if (!constituencyId) {
      return reply.status(400).send(errorResponse('constituencyId is required', 'VALIDATION_ERROR'));
    }

    if (req.hierarchyScope && !req.hierarchyScope.isGlobalScope) {
      if (!req.hierarchyScope.accessibleConstituencyIds.has(constituencyId)) {
        return reply.status(403).send(errorResponse('Access denied to this constituency roster', 'FORBIDDEN_SCOPE'));
      }
    }

    const csv = await InchargeProvisioningService.exportRosterCsv(constituencyId);
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="incharge_roster_${constituencyId}.csv"`);
    return reply.send(csv);
  }
}
