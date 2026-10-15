import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { errorResponse, successResponse } from '../../common/response.js';
import { validateBody } from '../../common/validation.js';
import { authenticate } from '../../middleware/auth.js';
import { assertUnitAccess, populateHierarchyScope } from '../../middleware/rbac.js';
import { AIService } from './ai.service.js';

const aiQuerySchema = z.object({
  unitId: z.string().uuid(),
  prompt: z.string().min(3),
  language: z.enum(['en', 'te']).default('en'),
});

const aiReportSchema = z.object({
  unitId: z.string().uuid(),
  language: z.enum(['en', 'te']).default('en'),
});

export async function aiRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', populateHierarchyScope);

  // List AI strategic insights
  fastify.get('/insights', async (req: FastifyRequest<{ Querystring: { constituencyId?: string } }>, reply: FastifyReply) => {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const orgId = req.user?.organisationId;

    if (!isSuperAdmin && !orgId) {
      return reply.send(successResponse([]));
    }

    const where: any = {};
    if (!isSuperAdmin && orgId) {
      where.constituency = { parliament: { zone: { state: { organisationId: orgId } } } };
    }
    if (req.query.constituencyId) {
      where.constituencyId = req.query.constituencyId;
    }

    const items = await prisma.aIInsight.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return reply.send(successResponse(items));
  });

  // News monitoring feed
  fastify.get('/news', async (req: FastifyRequest<{ Querystring: { constituencyId?: string } }>, reply: FastifyReply) => {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const orgId = req.user?.organisationId;

    if (!isSuperAdmin && !orgId) {
      return reply.send(successResponse([]));
    }

    const where: any = {};
    if (!isSuperAdmin && orgId) {
      where.constituency = { parliament: { zone: { state: { organisationId: orgId } } } };
    }
    if (req.query.constituencyId) {
      where.constituencyId = req.query.constituencyId;
    }

    const items = await prisma.newsArticle.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: 20,
    });
    return reply.send(successResponse(items));
  });

  // Social media trends
  fastify.get('/social-trends', async (req: FastifyRequest<{ Querystring: { constituencyId?: string } }>, reply: FastifyReply) => {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const orgId = req.user?.organisationId;

    if (!isSuperAdmin && !orgId) {
      return reply.send(successResponse([]));
    }

    const where: any = {};
    if (!isSuperAdmin && orgId) {
      where.constituency = { parliament: { zone: { state: { organisationId: orgId } } } };
    }
    if (req.query.constituencyId) {
      where.constituencyId = req.query.constituencyId;
    }

    const items = await prisma.socialTrend.findMany({
      where,
      orderBy: { trendingRank: 'asc' },
      take: 20,
    });
    return reply.send(successResponse(items));
  });

  // Election scenario projections
  fastify.get('/projections', async (req: FastifyRequest<{ Querystring: { constituencyId?: string } }>, reply: FastifyReply) => {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const orgId = req.user?.organisationId;

    if (!isSuperAdmin && !orgId) {
      return reply.send(successResponse([]));
    }

    const where: any = {};
    if (!isSuperAdmin && orgId) {
      where.constituency = { parliament: { zone: { state: { organisationId: orgId } } } };
    }
    if (req.query.constituencyId) {
      where.constituencyId = req.query.constituencyId;
    }

    const projections = await prisma.electionProjection.findMany({
      where,
      orderBy: { computedAt: 'desc' },
      take: 5,
    });
    return reply.send(successResponse(projections));
  });

  // Ask AI Strategic Query
  fastify.post(
    '/query',
    { preValidation: [validateBody(aiQuerySchema)] },
    async (req: FastifyRequest<{ Body: z.infer<typeof aiQuerySchema> }>, reply: FastifyReply) => {
      const isEnabled = await AIService.isAiEnabled();
      if (!isEnabled) {
        return reply.status(403).send(errorResponse('AI Strategic Intelligence Center is currently disabled in CMS feature toggles.', 'FEATURE_DISABLED'));
      }

      const { unitId, prompt, language } = req.body;
      if (!assertUnitAccess(req, reply, unitId)) {
        return;
      }

      const result = await AIService.queryStrategy(unitId, prompt, language, req.user?.userId);
      return reply.send(successResponse(result));
    },
  );

  // Generate Strategic Report
  fastify.post(
    '/report',
    { preValidation: [validateBody(aiReportSchema)] },
    async (req: FastifyRequest<{ Body: z.infer<typeof aiReportSchema> }>, reply: FastifyReply) => {
      const isEnabled = await AIService.isAiEnabled();
      if (!isEnabled) {
        return reply.status(403).send(errorResponse('AI Strategic Intelligence Center is currently disabled in CMS feature toggles.', 'FEATURE_DISABLED'));
      }

      const { unitId, language } = req.body;
      if (!assertUnitAccess(req, reply, unitId)) {
        return;
      }

      const report = await AIService.generateReport(unitId, language, req.user?.userId);
      return reply.send(successResponse(report));
    },
  );
}
