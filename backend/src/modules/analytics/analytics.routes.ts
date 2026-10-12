import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { populateHierarchyScope } from '../../middleware/rbac.js';
import { AnalyticsController } from './analytics.controller.js';

export async function analyticsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', populateHierarchyScope);

  fastify.get('/state', AnalyticsController.getStateAnalytics);
  fastify.get('/zone/:id', AnalyticsController.getZoneAnalytics);
  fastify.get('/parliament/:id', AnalyticsController.getParliamentAnalytics);
  fastify.get('/constituency/:id', AnalyticsController.getConstituencyAnalytics);
  fastify.get('/mandal/:id', AnalyticsController.getMandalAnalytics);
  fastify.get('/village/:id', AnalyticsController.getVillageAnalytics);
  fastify.get('/booth/:id', AnalyticsController.getBoothAnalytics);
  fastify.get('/voter-incharge/:id', AnalyticsController.getVoterInchargeAnalytics);
}
