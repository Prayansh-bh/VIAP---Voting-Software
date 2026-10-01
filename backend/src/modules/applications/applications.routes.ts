import { FastifyInstance } from 'fastify';
import { RoleType } from '@prisma/client';
import { validateBody } from '../../common/validation.js';
import { authenticate } from '../../middleware/auth.js';
import { populateHierarchyScope, requireRoles } from '../../middleware/rbac.js';
import { ApplicationsController } from './applications.controller.js';
import {
  assignInchargeSchema,
  importDataSchema,
  mappingSchema,
  validateDataSchema,
} from './applications.schema.js';

const ADMIN_DATA_ROLES = [
  RoleType.SUPER_ADMIN,
  RoleType.HIGH_COMMAND,
  RoleType.STATE_ADMIN,
  RoleType.CONSTITUENCY_INCHARGE,
];

export async function applicationsRoutes(fastify: FastifyInstance) {
  // 1. Applications List & Configuration
  fastify.get('/', { preHandler: [authenticate] }, ApplicationsController.getApplications);
  fastify.post('/', { preHandler: [authenticate] }, async (req, reply) => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/cms/build-application',
      headers: {
        authorization: req.headers.authorization || '',
        'content-type': 'application/json',
      },
      payload: req.body as any,
    });
    return reply.status(res.statusCode).send(JSON.parse(res.payload));
  });
  fastify.get('/:applicationId/configuration', { preHandler: [authenticate] }, ApplicationsController.getConfiguration);

  // 2. Hierarchy & Structure Endpoints
  fastify.get('/:applicationId/hierarchy', { preHandler: [authenticate] }, ApplicationsController.getHierarchy);
  fastify.get('/:applicationId/hierarchy/:level', { preHandler: [authenticate] }, ApplicationsController.getHierarchyNodes);
  fastify.get('/:applicationId/constituencies', { preHandler: [authenticate] }, ApplicationsController.getConstituencies);
  fastify.get('/:applicationId/constituencies/:id', { preHandler: [authenticate] }, ApplicationsController.getConstituencyDetail);

  // 3. Data Ingestion: Mapping, Validation & Import
  fastify.post(
    '/:applicationId/data/mapping',
    {
      preHandler: [authenticate, requireRoles(...ADMIN_DATA_ROLES), validateBody(mappingSchema)],
    },
    ApplicationsController.suggestColumnMapping,
  );

  fastify.post(
    '/:applicationId/data/validate',
    {
      preHandler: [authenticate, populateHierarchyScope, requireRoles(...ADMIN_DATA_ROLES), validateBody(validateDataSchema)],
    },
    ApplicationsController.validateData,
  );

  fastify.post(
    '/:applicationId/data/import',
    {
      preHandler: [authenticate, populateHierarchyScope, requireRoles(...ADMIN_DATA_ROLES), validateBody(importDataSchema)],
    },
    ApplicationsController.importData,
  );

  // 4. Data Import History & Error Reports
  fastify.get(
    '/:applicationId/data/imports',
    { preHandler: [authenticate, requireRoles(...ADMIN_DATA_ROLES), populateHierarchyScope] },
    ApplicationsController.getDataImports,
  );

  fastify.get(
    '/:applicationId/data/imports/:importId',
    { preHandler: [authenticate, requireRoles(...ADMIN_DATA_ROLES), populateHierarchyScope] },
    ApplicationsController.getDataImportById,
  );

  fastify.get(
    '/:applicationId/data/imports/:importId/errors',
    { preHandler: [authenticate, requireRoles(...ADMIN_DATA_ROLES), populateHierarchyScope] },
    ApplicationsController.getDataImportErrors,
  );

  fastify.get(
    '/:applicationId/data/imports/:importId/error-report',
    { preHandler: [authenticate, requireRoles(...ADMIN_DATA_ROLES), populateHierarchyScope] },
    ApplicationsController.downloadErrorReport,
  );

  // Backward-compatible history & error routes
  fastify.get(
    '/:applicationId/data/history',
    { preHandler: [authenticate, requireRoles(...ADMIN_DATA_ROLES), populateHierarchyScope] },
    ApplicationsController.getDataImports,
  );

  fastify.get(
    '/data/errors/:jobId',
    { preHandler: [authenticate, requireRoles(...ADMIN_DATA_ROLES), populateHierarchyScope] },
    ApplicationsController.getDataImportErrors,
  );

  fastify.get(
    '/data/error-report/:jobId',
    { preHandler: [authenticate, requireRoles(...ADMIN_DATA_ROLES), populateHierarchyScope] },
    ApplicationsController.downloadErrorReport,
  );

  // 5. Incharges Endpoints
  fastify.get(
    '/:applicationId/incharges',
    { preHandler: [authenticate, requireRoles(...ADMIN_DATA_ROLES), populateHierarchyScope] },
    ApplicationsController.getIncharges,
  );

  fastify.post(
    '/:applicationId/incharges',
    {
      preHandler: [authenticate, requireRoles(...ADMIN_DATA_ROLES), populateHierarchyScope, validateBody(assignInchargeSchema)],
    },
    ApplicationsController.assignIncharge,
  );

  fastify.delete(
    '/:applicationId/incharges/:id',
    { preHandler: [authenticate, requireRoles(...ADMIN_DATA_ROLES), populateHierarchyScope] },
    ApplicationsController.deleteIncharge,
  );

  fastify.post(
    '/:applicationId/incharges/:id/transfer',
    { preHandler: [authenticate, requireRoles(...ADMIN_DATA_ROLES), populateHierarchyScope] },
    ApplicationsController.transferIncharge,
  );

  fastify.post(
    '/:applicationId/incharges/:id/replace',
    { preHandler: [authenticate, requireRoles(...ADMIN_DATA_ROLES), populateHierarchyScope] },
    ApplicationsController.replaceIncharge,
  );

  fastify.patch(
    '/:applicationId/incharges/:id/status',
    { preHandler: [authenticate, requireRoles(...ADMIN_DATA_ROLES), populateHierarchyScope] },
    ApplicationsController.updateInchargeStatus,
  );

  fastify.post(
    '/:applicationId/incharges/:id/reset-credentials',
    { preHandler: [authenticate, requireRoles(...ADMIN_DATA_ROLES), populateHierarchyScope] },
    ApplicationsController.resetCredentials,
  );

  fastify.get(
    '/:applicationId/incharges/performance',
    { preHandler: [authenticate, requireRoles(...ADMIN_DATA_ROLES), populateHierarchyScope] },
    ApplicationsController.getInchargePerformance,
  );

  // 6. Voters, Booths & Groups (Field APIs & Scoped access)
  fastify.get(
    '/:applicationId/voters',
    { preHandler: [authenticate, populateHierarchyScope] },
    ApplicationsController.getVoters,
  );

  fastify.get(
    '/:applicationId/booths',
    { preHandler: [authenticate, populateHierarchyScope] },
    ApplicationsController.getBooths,
  );

  fastify.get(
    '/:applicationId/100-voter-groups',
    { preHandler: [authenticate, populateHierarchyScope] },
    ApplicationsController.getVoterGroups,
  );

  // 7. Reports & Summary KPIs
  fastify.get(
    '/:applicationId/reports/summary',
    { preHandler: [authenticate, populateHierarchyScope] },
    ApplicationsController.getSummary,
  );
  fastify.get(
    '/:applicationId/summary',
    { preHandler: [authenticate, populateHierarchyScope] },
    ApplicationsController.getSummary,
  );
}
