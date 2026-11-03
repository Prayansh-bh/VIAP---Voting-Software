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

  // Announcements CRUD for High Command / Party Admin
  fastify.get('/announcements', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = req.user?.organisationId;
    const items = await prisma.announcement.findMany({
      where: orgId ? { organisationId: orgId } : {},
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return reply.send(successResponse(items));
  });

  fastify.post('/announcements', async (req: FastifyRequest<{ Body: { title: string; content: string; priority?: string } }>, reply: FastifyReply) => {
    const { title, content, priority } = req.body || {};
    if (!title || !content) {
      return reply.status(400).send({ success: false, error: { message: 'Title and content are required' } });
    }
    const created = await prisma.announcement.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        priority: (priority as any) || 'HIGH',
        organisationId: req.user?.organisationId || null,
      },
    });

    // Fan-out notifications to all active cadre within the tenant organization
    if (req.user?.organisationId) {
      void (async () => {
        try {
          const cadreUsers = await prisma.user.findMany({
            where: {
              organisationId: req.user!.organisationId,
              accountStatus: 'ACTIVE',
            },
            select: { id: true },
            take: 500,
          });

          if (cadreUsers.length > 0) {
            await prisma.notification.createMany({
              data: cadreUsers.map((u) => ({
                userId: u.id,
                title: `High Command: ${title.trim()}`,
                message: content.trim().slice(0, 250),
                type: 'SYSTEM',
                priority: priority === 'URGENT' ? 'HIGH' : 'NORMAL',
              })),
            });
          }
        } catch (err: any) {
          req.log.warn({ err }, 'Announcement fan-out notification notice');
        }
      })();
    }

    return reply.status(201).send(successResponse(created, 'Announcement created'));
  });

  fastify.delete('/announcements/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await prisma.announcement.delete({
      where: { id: req.params.id },
    });
    return reply.send(successResponse({ deleted: true }));
  });
}
