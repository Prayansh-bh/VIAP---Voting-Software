import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AuditAction, Prisma, RoleType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { successResponse } from '../../common/response.js';
import { validateBody } from '../../common/validation.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';

const createOrgSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  description: z.string().optional(),
  website: z.string().url().optional(),
});

export async function organisationsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (req: FastifyRequest<{ Querystring: { page?: string; limit?: string } }>, reply: FastifyReply) => {
    const isSuperAdmin = req.user?.role === RoleType.SUPER_ADMIN || req.user?.role === RoleType.HIGH_COMMAND;
    const where: Prisma.OrganisationWhereInput = {};

    // Strict multi-tenant isolation: non-superadmin accounts can only view their own organisation
    if (!isSuperAdmin) {
      if (req.user?.organisationId) {
        where.id = req.user.organisationId;
      } else {
        return reply.send(successResponse([]));
      }
    }

    const page = Math.max(1, Number(req.query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 50));
    const skip = (page - 1) * limit;

    const [orgs, total] = await Promise.all([
      prisma.organisation.findMany({
        where,
        include: { parties: true, states: true },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.organisation.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    return reply.send(successResponse(orgs, undefined, {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    }));
  });

  fastify.post(
    '/',
    {
      preHandler: [requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND)],
      preValidation: [validateBody(createOrgSchema)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as z.infer<typeof createOrgSchema>;
      const org = await prisma.organisation.create({
        data: body,
      });

      await logAudit({
        action: AuditAction.CREATE,
        entityType: 'Organisation',
        entityId: org.id,
        req,
        changes: body as unknown as Prisma.InputJsonValue,
      });

      return reply.status(201).send(successResponse(org, 'Organisation created'));
    },
  );
}
