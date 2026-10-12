import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { successResponse } from '../../common/response.js';
import { authenticate } from '../../middleware/auth.js';

export async function notificationsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (req: FastifyRequest<{ Querystring: { unreadOnly?: string } }>, reply: FastifyReply) => {
    const unreadOnly = req.query.unreadOnly === 'true';
    const items = await prisma.notification.findMany({
      where: {
        userId: req.user!.userId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: req.user!.userId, readAt: null },
    });

    return reply.send(successResponse({ items, unreadCount }));
  });

  fastify.patch('/:id/read', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.userId },
      data: { readAt: new Date() },
    });
    return reply.send(successResponse({ read: true }));
  });

  fastify.patch('/read-all', async (req: FastifyRequest, reply: FastifyReply) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return reply.send(successResponse({ readAll: true }));
  });
}
