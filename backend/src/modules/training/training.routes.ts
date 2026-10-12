import { FastifyInstance } from 'fastify';
import { RoleType } from '@prisma/client';
import { validateBody } from '../../common/validation.js';
import { authenticate } from '../../middleware/auth.js';
import { populateHierarchyScope, requireRoles } from '../../middleware/rbac.js';
import {
  assignTrainingSchema,
  createTrainingVideoSchema,
  updateTrainingProgressSchema,
  updateTrainingVideoSchema,
} from './training.schema.js';
import { TrainingController } from './training.controller.js';

export async function trainingRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', populateHierarchyScope);

  fastify.get('/videos', TrainingController.listVideos);
  fastify.post(
    '/videos',
    {
      preHandler: [requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE)],
      preValidation: [validateBody(createTrainingVideoSchema)],
    },
    TrainingController.createVideo,
  );
  fastify.patch(
    '/videos/:id',
    {
      preHandler: [requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE)],
      preValidation: [validateBody(updateTrainingVideoSchema)],
    },
    TrainingController.updateVideo,
  );
  fastify.delete(
    '/videos/:id',
    {
      preHandler: [requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN)],
    },
    TrainingController.deleteVideo,
  );

  fastify.post(
    '/:id/assign',
    {
      preHandler: [requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE, RoleType.MANDAL_INCHARGE)],
      preValidation: [validateBody(assignTrainingSchema)],
    },
    TrainingController.assignVideo,
  );

  fastify.patch(
    '/:id/progress',
    {
      preValidation: [validateBody(updateTrainingProgressSchema)],
    },
    TrainingController.updateProgress,
  );

  fastify.get('/analytics', TrainingController.getAnalytics);
}
