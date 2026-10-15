import { FastifyReply, FastifyRequest } from 'fastify';
import { OrgHierarchyLevel } from '@prisma/client';
import { successResponse } from '../../common/response.js';
import { assertUnitAccess } from '../../middleware/rbac.js';
import { prisma } from '../../lib/prisma.js';
import { AnalyticsService } from './analytics.service.js';

export class AnalyticsController {
  static async getStateAnalytics(req: FastifyRequest, reply: FastifyReply) {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const orgId = req.user?.organisationId;

    if (!isSuperAdmin && !orgId) {
      return reply.status(404).send({ success: false, error: { message: 'State unit not found' } });
    }

    let stateUnit: any = null;
    if (orgId) {
      const state = await prisma.state.findFirst({ where: { organisationId: orgId } });
      if (state) {
        stateUnit = await prisma.organizationUnit.findFirst({
          where: { code: state.code, level: OrgHierarchyLevel.STATE },
        });
      }
    }
    if (!stateUnit && isSuperAdmin) {
      stateUnit = await prisma.organizationUnit.findFirst({ where: { level: OrgHierarchyLevel.STATE } });
    }

    if (!stateUnit) {
      return reply.status(404).send({ success: false, error: { message: 'State unit not found' } });
    }
    if (!assertUnitAccess(req, reply, stateUnit.id)) return;

    const data = await AnalyticsService.computeAnalyticsForUnit(stateUnit.id);
    return reply.send(successResponse(data));
  }

  static async getZoneAnalytics(req: FastifyRequest, reply: FastifyReply) {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const orgId = req.user?.organisationId;
    const params = req.params as { id: string };

    const zone = await prisma.zone.findUnique({
      where: { id: params.id },
      include: { state: true },
    });
    if (!zone) {
      return reply.status(404).send({ success: false, error: { message: 'Zone not found' } });
    }
    if (!isSuperAdmin && (!orgId || zone.state.organisationId !== orgId)) {
      return reply.status(404).send({ success: false, error: { message: 'Zone not found' } });
    }

    const unit = await prisma.organizationUnit.findFirst({ where: { code: zone.code, level: OrgHierarchyLevel.ZONE } });
    const targetUnitId = unit?.id ?? params.id;
    if (!assertUnitAccess(req, reply, targetUnitId)) return;

    const data = await AnalyticsService.computeAnalyticsForUnit(targetUnitId);
    return reply.send(successResponse(data));
  }

  static async getParliamentAnalytics(req: FastifyRequest, reply: FastifyReply) {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const orgId = req.user?.organisationId;
    const params = req.params as { id: string };

    const par = await prisma.parliament.findUnique({
      where: { id: params.id },
      include: { zone: { include: { state: true } } },
    });
    if (!par) {
      return reply.status(404).send({ success: false, error: { message: 'Parliament not found' } });
    }
    if (!isSuperAdmin && (!orgId || par.zone.state.organisationId !== orgId)) {
      return reply.status(404).send({ success: false, error: { message: 'Parliament not found' } });
    }

    const unit = await prisma.organizationUnit.findFirst({ where: { code: par.code, level: OrgHierarchyLevel.PARLIAMENT } });
    const targetUnitId = unit?.id ?? params.id;
    if (!assertUnitAccess(req, reply, targetUnitId)) return;

    const data = await AnalyticsService.computeAnalyticsForUnit(targetUnitId);
    return reply.send(successResponse(data));
  }

  static async getConstituencyAnalytics(req: FastifyRequest, reply: FastifyReply) {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const orgId = req.user?.organisationId;
    const params = req.params as { id: string };

    const ac = await prisma.constituency.findUnique({
      where: { id: params.id },
      include: { parliament: { include: { zone: { include: { state: true } } } } },
    });
    if (!ac) {
      return reply.status(404).send({ success: false, error: { message: 'Constituency not found' } });
    }
    if (!isSuperAdmin && (!orgId || ac.parliament.zone.state.organisationId !== orgId)) {
      return reply.status(404).send({ success: false, error: { message: 'Constituency not found' } });
    }

    const unit = await prisma.organizationUnit.findFirst({ where: { code: ac.code, level: OrgHierarchyLevel.CONSTITUENCY } });
    const targetUnitId = unit?.id ?? params.id;
    if (!assertUnitAccess(req, reply, targetUnitId)) return;

    const data = await AnalyticsService.computeAnalyticsForUnit(targetUnitId);
    return reply.send(successResponse(data));
  }

  static async getMandalAnalytics(req: FastifyRequest, reply: FastifyReply) {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const orgId = req.user?.organisationId;
    const params = req.params as { id: string };

    const m = await prisma.mandal.findUnique({
      where: { id: params.id },
      include: { constituency: { include: { parliament: { include: { zone: { include: { state: true } } } } } } },
    });
    if (!m) {
      return reply.status(404).send({ success: false, error: { message: 'Mandal not found' } });
    }
    if (!isSuperAdmin && (!orgId || m.constituency.parliament.zone.state.organisationId !== orgId)) {
      return reply.status(404).send({ success: false, error: { message: 'Mandal not found' } });
    }

    const unit = await prisma.organizationUnit.findFirst({ where: { code: m.code, level: OrgHierarchyLevel.MANDAL } });
    const targetUnitId = unit?.id ?? params.id;
    if (!assertUnitAccess(req, reply, targetUnitId)) return;

    const data = await AnalyticsService.computeAnalyticsForUnit(targetUnitId);
    return reply.send(successResponse(data));
  }

  static async getVillageAnalytics(req: FastifyRequest, reply: FastifyReply) {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const orgId = req.user?.organisationId;
    const params = req.params as { id: string };

    const v = await prisma.village.findUnique({
      where: { id: params.id },
      include: { mandal: { include: { constituency: { include: { parliament: { include: { zone: { include: { state: true } } } } } } } } },
    });
    if (!v) {
      return reply.status(404).send({ success: false, error: { message: 'Village not found' } });
    }
    if (!isSuperAdmin && (!orgId || v.mandal.constituency.parliament.zone.state.organisationId !== orgId)) {
      return reply.status(404).send({ success: false, error: { message: 'Village not found' } });
    }

    const unit = await prisma.organizationUnit.findFirst({ where: { code: v.code, level: OrgHierarchyLevel.VILLAGE } });
    const targetUnitId = unit?.id ?? params.id;
    if (!assertUnitAccess(req, reply, targetUnitId)) return;

    const data = await AnalyticsService.computeAnalyticsForUnit(targetUnitId);
    return reply.send(successResponse(data));
  }

  static async getBoothAnalytics(req: FastifyRequest, reply: FastifyReply) {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const orgId = req.user?.organisationId;
    const params = req.params as { id: string };

    const b = await prisma.booth.findUnique({
      where: { id: params.id },
      include: { village: { include: { mandal: { include: { constituency: { include: { parliament: { include: { zone: { include: { state: true } } } } } } } } } } },
    });
    if (!b) {
      return reply.status(404).send({ success: false, error: { message: 'Booth not found' } });
    }
    if (!isSuperAdmin && (!orgId || b.village.mandal.constituency.parliament.zone.state.organisationId !== orgId)) {
      return reply.status(404).send({ success: false, error: { message: 'Booth not found' } });
    }

    const unit = await prisma.organizationUnit.findFirst({ where: { code: b.code, level: OrgHierarchyLevel.BOOTH } });
    const targetUnitId = unit?.id ?? params.id;
    if (!assertUnitAccess(req, reply, targetUnitId)) return;

    const data = await AnalyticsService.computeAnalyticsForUnit(targetUnitId);
    return reply.send(successResponse(data));
  }

  static async getVoterInchargeAnalytics(req: FastifyRequest, reply: FastifyReply) {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const orgId = req.user?.organisationId;
    const params = req.params as { id: string };

    const vg = await prisma.voterGroup.findUnique({
      where: { id: params.id },
      include: { booth: { include: { village: { include: { mandal: { include: { constituency: { include: { parliament: { include: { zone: { include: { state: true } } } } } } } } } } } } },
    });
    if (!vg) {
      return reply.status(404).send({ success: false, error: { message: 'Voter Group not found' } });
    }
    if (!isSuperAdmin && (!orgId || vg.booth.village.mandal.constituency.parliament.zone.state.organisationId !== orgId)) {
      return reply.status(404).send({ success: false, error: { message: 'Voter Group not found' } });
    }

    const unit = await prisma.organizationUnit.findFirst({ where: { code: vg.code, level: OrgHierarchyLevel.VOTER_GROUP } });
    const targetUnitId = unit?.id ?? params.id;
    if (!assertUnitAccess(req, reply, targetUnitId)) return;

    const data = await AnalyticsService.computeAnalyticsForUnit(targetUnitId);
    return reply.send(successResponse(data));
  }
}
