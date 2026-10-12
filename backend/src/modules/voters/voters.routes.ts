import { FastifyInstance } from 'fastify';
import { RoleType } from '@prisma/client';
import { validateBody, validateQuery } from '../../common/validation.js';
import { authenticate } from '../../middleware/auth.js';
import { populateHierarchyScope, requireRoles } from '../../middleware/rbac.js';
import {
  createVoterSchema,
  flagFakeVoterSchema,
  updateMigrationSchema,
  updateVoterSchema,
  updateVoterStatusSchema,
  voterQuerySchema,
} from './voters.schema.js';
import { VotersController } from './voters.controller.js';

export async function votersRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', populateHierarchyScope);

  // List voters with pagination, filtering, sorting
  fastify.get('/', { preValidation: [validateQuery(voterQuerySchema)] }, VotersController.listVoters);

  // Create new voter
  fastify.post(
    '/',
    {
      preHandler: [requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE, RoleType.MANDAL_INCHARGE, RoleType.VILLAGE_INCHARGE, RoleType.BOOTH_PRESIDENT, RoleType.VOTER_100_INCHARGE)],
      preValidation: [validateBody(createVoterSchema)],
    },
    VotersController.createVoter,
  );

  // Bulk import & assign voters to constituency
  fastify.post(
    '/bulk-import',
    {
      preHandler: [requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE)],
    },
    VotersController.bulkImport,
  );

  // Template download
  fastify.get('/template', VotersController.downloadTemplate);

  // Single voter details & history
  fastify.get('/:id', VotersController.getVoter);
  fastify.get('/:id/history', VotersController.getVoterHistory);

  // Update voter
  fastify.patch('/:id', { preValidation: [validateBody(updateVoterSchema)] }, VotersController.updateVoter);

  // Update voter status
  fastify.patch('/:id/status', { preValidation: [validateBody(updateVoterStatusSchema)] }, VotersController.updateVoterStatus);

  // Flag fake voter
  fastify.post('/:id/flag-fake', { preValidation: [validateBody(flagFakeVoterSchema)] }, VotersController.flagFakeVoter);

  // Mark vote done
  fastify.post('/:id/mark-vote-done', VotersController.markVoteDone);

  // Mark not voted (reset)
  fastify.post('/:id/mark-not-voted', VotersController.markNotVoted);

  // Update migration info
  fastify.patch('/:id/migration', { preValidation: [validateBody(updateMigrationSchema)] }, VotersController.updateMigration);

  // Delete voter
  fastify.delete(
    '/:id',
    {
      preHandler: [requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE)],
    },
    VotersController.deleteVoter,
  );
}
