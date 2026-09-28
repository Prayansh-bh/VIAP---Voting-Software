import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AuditAction, GroundReportStatus, GroundReportType, Prisma, TaskPriority } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { successResponse } from '../../common/response.js';
import { validateBody } from '../../common/validation.js';
import { authenticate } from '../../middleware/auth.js';
import { assertUnitAccess, populateHierarchyScope } from '../../middleware/rbac.js';
import { logAudit } from '../../middleware/audit.js';
import { emitHierarchyEvent } from '../../lib/socket.js';

const groundReportSchema = z.object({
  reportType: z.nativeEnum(GroundReportType).default(GroundReportType.GENERAL_UPDATE),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  description: z.string().min(3),
  issueCategory: z.string().optional(),
  affectedVotersCount: z.number().optional(),
  constituencyId: z.string().uuid().optional(),
  mandalId: z.string().uuid().optional(),
  villageId: z.string().uuid().optional(),
  boothId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
});

const pollingReportSchema = z.object({
  mandalName: z.string().min(1),
  boothLabel: z.string().min(1),
  reporterName: z.string().optional(),
  tdpVotes: z.number().default(0),
  ysrcpVotes: z.number().default(0),
  jspVotes: z.number().default(0),
  bjpVotes: z.number().default(0),
  incVotes: z.number().default(0),
  othersVotes: z.number().default(0),
  boothId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
});

export async function reportsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', populateHierarchyScope);

  // List ground reports
  fastify.get('/ground', async (req: FastifyRequest<{ Querystring: { unitId?: string; status?: GroundReportStatus; page?: string; limit?: string } }>, reply: FastifyReply) => {
    const where: Prisma.GroundReportWhereInput = {};
    if (req.query.status) where.status = req.query.status;

    if (req.query.unitId) {
      if (!assertUnitAccess(req, reply, req.query.unitId)) return;
      where.unitId = req.query.unitId;
    } else if (req.hierarchyScope && !req.hierarchyScope.isGlobalScope) {
      if (req.hierarchyScope.accessibleUnitIds.size > 0) {
        where.unitId = { in: Array.from(req.hierarchyScope.accessibleUnitIds) };
      } else {
        where.unitId = '00000000-0000-0000-0000-000000000000';
      }
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.groundReport.findMany({
        where,
        include: { createdBy: true, unit: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.groundReport.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    return reply.send(successResponse(items, undefined, {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    }));
  });

  // Create ground report
  fastify.post('/ground', { preValidation: [validateBody(groundReportSchema)] }, async (req: FastifyRequest<{ Body: z.infer<typeof groundReportSchema> }>, reply: FastifyReply) => {
    if (req.body.unitId && !assertUnitAccess(req, reply, req.body.unitId)) {
      return;
    }

    const report = await prisma.groundReport.create({
      data: {
        ...req.body,
        createdById: req.user!.userId,
      },
    });

    await logAudit({
      action: AuditAction.CREATE,
      entityType: 'GroundReport',
      entityId: report.id,
      req,
      unitId: report.unitId ?? undefined,
      changes: req.body as unknown as Prisma.InputJsonValue,
    });

    if (report.unitId) {
      await emitHierarchyEvent(report.unitId, 'report:event', {
        type: 'created',
        reportId: report.id,
        description: report.description,
      });
    }

    return reply.status(201).send(successResponse(report, 'Ground report submitted'));
  });

  // List polling booth reports
  fastify.get('/polling', async (req: FastifyRequest<{ Querystring: { unitId?: string; page?: string; limit?: string } }>, reply: FastifyReply) => {
    const where: Prisma.PollingReportWhereInput = {};

    if (req.query.unitId) {
      if (!assertUnitAccess(req, reply, req.query.unitId)) return;
      where.unitId = req.query.unitId;
    } else if (req.hierarchyScope && !req.hierarchyScope.isGlobalScope) {
      if (req.hierarchyScope.accessibleUnitIds.size > 0) {
        where.unitId = { in: Array.from(req.hierarchyScope.accessibleUnitIds) };
      } else {
        where.unitId = '00000000-0000-0000-0000-000000000000';
      }
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.pollingReport.findMany({
        where,
        include: { createdBy: true, unit: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.pollingReport.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    return reply.send(successResponse(items, undefined, {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    }));
  });

  // Submit polling booth report
  fastify.post('/polling', { preValidation: [validateBody(pollingReportSchema)] }, async (req: FastifyRequest<{ Body: z.infer<typeof pollingReportSchema> }>, reply: FastifyReply) => {
    if (req.body.unitId && !assertUnitAccess(req, reply, req.body.unitId)) {
      return;
    }
    const { tdpVotes, ysrcpVotes, jspVotes, bjpVotes, incVotes, othersVotes } = req.body;
    const totalVotes = tdpVotes + ysrcpVotes + jspVotes + bjpVotes + incVotes + othersVotes;

    const report = await prisma.pollingReport.create({
      data: {
        ...req.body,
        reporterName: req.body.reporterName || req.user!.userCode,
        totalVotes,
        createdById: req.user!.userId,
      },
    });

    await logAudit({
      action: AuditAction.CREATE,
      entityType: 'PollingReport',
      entityId: report.id,
      req,
      unitId: report.unitId ?? undefined,
      changes: req.body as unknown as Prisma.InputJsonValue,
    });

    if (report.unitId) {
      await emitHierarchyEvent(report.unitId, 'polling-report:event', {
        reportId: report.id,
        mandal: report.mandalName,
        booth: report.boothLabel,
        totalVotes,
      });
    }

    return reply.status(201).send(successResponse(report, 'Polling report recorded'));
  });
}
