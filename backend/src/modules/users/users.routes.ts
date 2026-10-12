import { FastifyInstance } from 'fastify';
import { RoleType } from '@prisma/client';
import { validateBody, validateQuery } from '../../common/validation.js';
import { authenticate } from '../../middleware/auth.js';
import { populateHierarchyScope, requireRoles } from '../../middleware/rbac.js';
import { createUserSchema, updateUserSchema, updateUserStatusSchema, userQuerySchema } from './users.schema.js';
import { UsersController } from './users.controller.js';

export async function usersRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', populateHierarchyScope);

  fastify.get(
    '/',
    { preValidation: [validateQuery(userQuerySchema)] },
    UsersController.listUsers,
  );

  fastify.post(
    '/',
    {
      preHandler: [requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE)],
      preValidation: [validateBody(createUserSchema)],
    },
    UsersController.createUser,
  );

  fastify.get('/:id', UsersController.getUser);

  fastify.patch(
    '/:id',
    {
      preHandler: [requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE)],
      preValidation: [validateBody(updateUserSchema)],
    },
    UsersController.updateUser,
  );

  fastify.patch(
    '/:id/status',
    {
      preHandler: [requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE)],
      preValidation: [validateBody(updateUserStatusSchema)],
    },
    UsersController.updateUserStatus,
  );

  fastify.delete(
    '/:id',
    {
      preHandler: [requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN)],
    },
    UsersController.deleteUser,
  );
}
