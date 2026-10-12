import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AuditAction, Prisma, RoleType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { successResponse } from '../../common/response.js';
import { validateBody } from '../../common/validation.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';

const partySchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  shortName: z.string().min(1),
  symbolName: z.string().optional(),
  primaryColor: z.string().default('#eab308'),
  secondaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  sortOrder: z.number().default(0),
  lifecycleStatus: z.enum(['DRAFT', 'PUBLISHED', 'LOCKED']).optional(),
  isLocked: z.boolean().optional(),
});

export async function partiesRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (_req: FastifyRequest, reply: FastifyReply) => {
    const parties = await prisma.politicalParty.findMany({
      where: { isActive: true },
      include: { brandings: true },
      orderBy: { sortOrder: 'asc' },
    });
    return reply.send(successResponse(parties));
  });

  fastify.post(
    '/',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN)],
      preValidation: [validateBody(partySchema)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as z.infer<typeof partySchema>;
      const isDraft = body.lifecycleStatus === 'DRAFT';

      const party = await prisma.politicalParty.create({
        data: {
          ...body,
          lifecycleStatus: isDraft ? 'DRAFT' : 'LOCKED',
          isLocked: !isDraft,
          publishedAt: isDraft ? null : new Date(),
        },
      });

      await logAudit({
        action: AuditAction.CREATE,
        entityType: 'PoliticalParty',
        entityId: party.id,
        req,
        changes: {
          ...body,
          lifecycleStatus: party.lifecycleStatus,
          isLocked: party.isLocked,
        } as unknown as Prisma.InputJsonValue,
      });

      return reply.status(201).send(successResponse(party, isDraft ? 'Political party created in DRAFT state' : 'Political party created and locked (immutable)'));
    },
  );

  fastify.post(
    '/:id/publish',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const params = req.params as { id: string };
      const party = await prisma.politicalParty.findUnique({
        where: { id: params.id },
      });

      if (!party) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Party not found' } });
      }

      if (party.isLocked || party.lifecycleStatus === 'LOCKED') {
        return reply.status(200).send(successResponse(party, 'Party is already published and locked (immutable)'));
      }

      const locked = await prisma.politicalParty.update({
        where: { id: params.id },
        data: {
          lifecycleStatus: 'LOCKED',
          isLocked: true,
          publishedAt: new Date(),
        },
      });

      await logAudit({
        action: AuditAction.UPDATE,
        entityType: 'PoliticalParty',
        entityId: locked.id,
        req,
        changes: { lifecycleStatus: 'LOCKED', isLocked: true, publishedAt: locked.publishedAt } as unknown as Prisma.InputJsonValue,
      });

      return reply.send(successResponse(locked, 'Party published and locked successfully'));
    },
  );

  fastify.patch(
    '/:id',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN)],
      preValidation: [validateBody(partySchema.partial())],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const params = req.params as { id: string };
      const body = req.body as Partial<z.infer<typeof partySchema>>;

      const existingParty = await prisma.politicalParty.findUnique({
        where: { id: params.id },
      });

      if (!existingParty) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Party not found' } });
      }

      if (existingParty.isLocked || existingParty.lifecycleStatus === 'LOCKED') {
        await logAudit({
          action: AuditAction.UPDATE,
          entityType: 'PoliticalParty',
          entityId: existingParty.id,
          req,
          changes: { attemptedChanges: body, status: 'BLOCKED', reason: 'Party is locked and immutable' } as unknown as Prisma.InputJsonValue,
        });

        return reply.status(403).send({
          success: false,
          error: {
            code: 'PARTY_CONFIGURATION_LOCKED',
            message: 'Party configuration is published, locked and immutable. No modifications are permitted.',
          },
        });
      }

      const party = await prisma.politicalParty.update({
        where: { id: params.id },
        data: body,
      });

      return reply.send(successResponse(party, 'Draft party updated'));
    },
  );

  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate, requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN)],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const params = req.params as { id: string };
      const existingParty = await prisma.politicalParty.findUnique({
        where: { id: params.id },
      });

      if (!existingParty) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Party not found' } });
      }

      await prisma.$transaction(async (tx) => {
        // 1. Detach voters preferring this party
        await tx.voter.updateMany({
          where: { politicalPartyId: existingParty.id },
          data: { politicalPartyId: null },
        });

        // 2. Delete branding and performance metrics
        await tx.partyBranding.deleteMany({
          where: { partyId: existingParty.id },
        });

        await tx.partyPerformance.deleteMany({
          where: { partyId: existingParty.id },
        });

        // 3. Delete the political party record
        await tx.politicalParty.delete({
          where: { id: existingParty.id },
        });
      });

      await logAudit({
        action: AuditAction.DELETE,
        entityType: 'PoliticalParty',
        entityId: existingParty.id,
        req,
        changes: { name: existingParty.name, code: existingParty.code } as unknown as Prisma.InputJsonValue,
      });

      return reply.send(successResponse({ id: params.id }, `Political party '${existingParty.name}' permanently deleted`));
    },
  );
}
