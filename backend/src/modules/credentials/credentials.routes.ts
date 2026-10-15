import { FastifyInstance } from 'fastify';
import { RoleType } from '@prisma/client';
import { authenticate } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/rbac.js';
import { CredentialsController } from './credentials.controller.js';

export async function credentialsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook(
    'preHandler',
    requireRoles(
      RoleType.SUPER_ADMIN,
      RoleType.HIGH_COMMAND,
      RoleType.STATE_ADMIN,
      'PARTY_ADMIN',
    ),
  );

  fastify.get('/', CredentialsController.listCredentials);
  fastify.post('/', CredentialsController.setCredential);
  fastify.post('/:keyName/rotate', CredentialsController.rotateCredential);
  fastify.get('/:keyName/reveal', CredentialsController.revealCredential);
  fastify.delete('/:keyName', CredentialsController.deleteCredential);
}
