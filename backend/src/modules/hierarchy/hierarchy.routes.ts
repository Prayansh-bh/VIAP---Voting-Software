import { FastifyInstance } from 'fastify';
import { RoleType } from '@prisma/client';
import { validateBody } from '../../common/validation.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/rbac.js';
import {
  createBoothSchema,
  createConstituencySchema,
  createMandalSchema,
  createParliamentSchema,
  createStateSchema,
  createVillageSchema,
  createVoterInchargeSchema,
  createZoneSchema,
} from './hierarchy.schema.js';
import { HierarchyController } from './hierarchy.controller.js';

export async function hierarchyRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // States
  fastify.get('/states', HierarchyController.getStates);
  fastify.post('/states', { preHandler: [requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND)], preValidation: [validateBody(createStateSchema)] }, HierarchyController.createState);

  // Zones
  fastify.get('/zones', HierarchyController.getZones);
  fastify.post('/zones', { preHandler: [requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN)], preValidation: [validateBody(createZoneSchema)] }, HierarchyController.createZone);

  // Parliaments
  fastify.get('/parliaments', HierarchyController.getParliaments);
  fastify.post('/parliaments', { preHandler: [requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.ZONE_INCHARGE)], preValidation: [validateBody(createParliamentSchema)] }, HierarchyController.createParliament);

  // Constituencies
  fastify.get('/constituencies', HierarchyController.getConstituencies);
  fastify.post('/constituencies', { preHandler: [requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.PARLIAMENT_INCHARGE)], preValidation: [validateBody(createConstituencySchema)] }, HierarchyController.createConstituency);

  // Mandals
  fastify.get('/mandals', HierarchyController.getMandals);
  fastify.post('/mandals', { preHandler: [requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE)], preValidation: [validateBody(createMandalSchema)] }, HierarchyController.createMandal);

  // Villages
  fastify.get('/villages', HierarchyController.getVillages);
  fastify.post('/villages', { preHandler: [requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE, RoleType.MANDAL_INCHARGE)], preValidation: [validateBody(createVillageSchema)] }, HierarchyController.createVillage);

  // Booths
  fastify.get('/booths', HierarchyController.getBooths);
  fastify.post('/booths', { preHandler: [requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE, RoleType.MANDAL_INCHARGE, RoleType.VILLAGE_INCHARGE)], preValidation: [validateBody(createBoothSchema)] }, HierarchyController.createBooth);

  // Voter Incharges / 100-Voter Clusters
  fastify.get('/voter-incharges', HierarchyController.getVoterIncharges);
  fastify.post('/voter-incharges', { preHandler: [requireRoles(RoleType.SUPER_ADMIN, RoleType.HIGH_COMMAND, RoleType.STATE_ADMIN, RoleType.CONSTITUENCY_INCHARGE, RoleType.MANDAL_INCHARGE, RoleType.VILLAGE_INCHARGE, RoleType.BOOTH_PRESIDENT)], preValidation: [validateBody(createVoterInchargeSchema)] }, HierarchyController.createVoterIncharge);
}
