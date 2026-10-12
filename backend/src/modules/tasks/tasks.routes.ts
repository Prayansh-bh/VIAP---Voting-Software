import { FastifyInstance } from 'fastify';
import { validateBody } from '../../common/validation.js';
import { authenticate } from '../../middleware/auth.js';
import { populateHierarchyScope } from '../../middleware/rbac.js';
import { assignTaskSchema, createTaskSchema, updateTaskSchema, updateTaskStatusSchema } from './tasks.schema.js';
import { TasksController } from './tasks.controller.js';

export async function tasksRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', populateHierarchyScope);

  fastify.get('/', TasksController.listTasks);
  fastify.post('/', { preValidation: [validateBody(createTaskSchema)] }, TasksController.createTask);
  fastify.get('/:id', TasksController.getTask);
  fastify.patch('/:id', { preValidation: [validateBody(updateTaskSchema)] }, TasksController.updateTask);
  fastify.post('/:id/assign', { preValidation: [validateBody(assignTaskSchema)] }, TasksController.assignTask);
  fastify.patch('/:id/status', { preValidation: [validateBody(updateTaskStatusSchema)] }, TasksController.updateTaskStatus);
  fastify.post('/:id/complete', TasksController.completeTask);
}
