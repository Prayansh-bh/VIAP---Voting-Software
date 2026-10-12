import { FastifyInstance } from 'fastify';
import { validateBody } from '../../common/validation.js';
import { authenticate } from '../../middleware/auth.js';
import { populateHierarchyScope } from '../../middleware/rbac.js';
import { createCadreSchema, updateCadreSchema } from './cadre.schema.js';
import { CadreController } from './cadre.controller.js';

export async function cadreRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', populateHierarchyScope);

  fastify.get('/', CadreController.listCadre);
  fastify.post('/', { preValidation: [validateBody(createCadreSchema)] }, CadreController.createCadre);
  fastify.patch('/:id', { preValidation: [validateBody(updateCadreSchema)] }, CadreController.updateCadre);
  fastify.get('/network', CadreController.getCadreNetwork);
  fastify.get('/performance', CadreController.getCadrePerformance);
}
