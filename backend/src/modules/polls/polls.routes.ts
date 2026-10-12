import { FastifyInstance } from 'fastify';
import { PollsController } from './polls.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { populateHierarchyScope } from '../../middleware/rbac.js';

export async function pollsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', populateHierarchyScope);

  fastify.get('/', PollsController.listPolls);
  fastify.post('/', PollsController.createPoll);
  fastify.post('/:id/vote', PollsController.vote);
  fastify.patch('/:id/close', PollsController.closePoll);
}
