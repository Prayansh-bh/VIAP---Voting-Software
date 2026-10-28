import { FastifyInstance } from 'fastify';
import { validateBody } from '../../common/validation.js';
import { authenticate } from '../../middleware/auth.js';
import { populateHierarchyScope } from '../../middleware/rbac.js';
import { createCadreSchema, updateCadreSchema, manualRosterSubmissionSchema } from './cadre.schema.js';
import { CadreController } from './cadre.controller.js';

export async function cadreRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', populateHierarchyScope);

  fastify.get('/', CadreController.listCadre);
  fastify.post('/', { preValidation: [validateBody(createCadreSchema)] }, CadreController.createCadre);
  fastify.patch('/:id', { preValidation: [validateBody(updateCadreSchema)] }, CadreController.updateCadre);
  fastify.delete('/:id', CadreController.deleteCadre);
  fastify.get('/network', CadreController.getCadreNetwork);
  fastify.get('/performance', CadreController.getCadrePerformance);
  fastify.get('/roster-preview/:constituencyId', CadreController.getRosterPreview);
  fastify.get('/roster-slots/:constituencyId', CadreController.getRosterSlots);
  fastify.get('/roster-template/:constituencyId', CadreController.downloadRosterTemplate);
  fastify.post('/roster-upload/:constituencyId', CadreController.uploadRosterSpreadsheet);
  fastify.post(
    '/roster-manual/:constituencyId',
    { preValidation: [validateBody(manualRosterSubmissionSchema)] },
    CadreController.submitManualRoster,
  );
  fastify.post('/provision-roster/:constituencyId', CadreController.provisionRoster);
  fastify.get('/roster-export/:constituencyId', CadreController.exportRoster);
}
