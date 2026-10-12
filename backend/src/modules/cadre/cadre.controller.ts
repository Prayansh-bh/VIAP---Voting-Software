import { FastifyReply, FastifyRequest } from 'fastify';
import { errorResponse, successResponse } from '../../common/response.js';
import { assertUserScope } from '../../middleware/rbac.js';
import { prisma } from '../../lib/prisma.js';
import { CadreService } from './cadre.service.js';

export class CadreController {
  static async listCadre(req: FastifyRequest<{ Querystring: { page?: string; limit?: string } }>, reply: FastifyReply) {
    const page = Math.max(1, Number(req.query?.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query?.limit) || 100));
    const items = await CadreService.listCadres(req.hierarchyScope?.accessibleUnitIds, page, limit);
    return reply.send(successResponse(items));
  }

  static async createCadre(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as any;
    if (body?.userId && !(await assertUserScope(req, reply, body.userId))) return;
    const item = await CadreService.createCadre(body, req.user!.userId);
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

    if (!(await assertUserScope(req, reply, existing.userId))) return;

    const item = await CadreService.updateCadre(req.params.id, req.body, req.user!.userId);
    return reply.send(successResponse(item, 'Cadre updated'));
  }

  static async getCadreNetwork(req: FastifyRequest, reply: FastifyReply) {
    const network = await CadreService.getCadreNetwork(req.hierarchyScope?.accessibleUnitIds);
    return reply.send(successResponse(network));
  }

  static async getCadrePerformance(req: FastifyRequest, reply: FastifyReply) {
    const perf = await CadreService.getCadrePerformance(req.hierarchyScope?.accessibleUnitIds);
    return reply.send(successResponse(perf));
  }
}
