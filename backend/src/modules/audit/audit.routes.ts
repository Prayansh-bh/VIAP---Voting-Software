import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { RoleType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { paginatedResponse } from '../../common/response.js';
import { authenticate } from '../../middleware/auth.js';
import { populateHierarchyScope, requireRoles } from '../../middleware/rbac.js';

export async function auditRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', populateHierarchyScope);
  fastify.addHook('preHandler', requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE));

  fastify.get('/', async (req: FastifyRequest<{ Querystring: { page?: string; limit?: string; entityType?: string; userId?: string } }>, reply: FastifyReply) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (req.query.entityType) where.entityType = req.query.entityType;

    const isGlobal =
      req.user?.role === RoleType.SUPER_ADMIN ||
      req.user?.role === RoleType.HIGH_COMMAND ||
      req.hierarchyScope?.isGlobalScope;

    if (!isGlobal) {
      const accessibleUnitIds = req.hierarchyScope?.accessibleUnitIds ? Array.from(req.hierarchyScope.accessibleUnitIds) : [];
      if (req.query.userId) {
        if (req.query.userId === req.user?.userId) {
          where.userId = req.user.userId;
        } else if (accessibleUnitIds.length > 0) {
          where.userId = req.query.userId;
          where.unitId = { in: accessibleUnitIds };
        } else {
          where.userId = req.user!.userId;
        }
      } else {
        if (accessibleUnitIds.length > 0) {
          where.OR = [
            { userId: req.user!.userId },
            { unitId: { in: accessibleUnitIds } },
          ];
        } else {
          where.userId = req.user!.userId;
        }
      }
    } else if (req.query.userId) {
      where.userId = req.query.userId;
    }

    const [total, items] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              userCode: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return reply.send(paginatedResponse(items, total, page, limit));
  });
}
