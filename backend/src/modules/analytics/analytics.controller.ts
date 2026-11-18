import { FastifyReply, FastifyRequest } from 'fastify';
import { OrgHierarchyLevel } from '@prisma/client';
import { successResponse } from '../../common/response.js';
import { assertUnitAccess } from '../../middleware/rbac.js';
import { prisma } from '../../lib/prisma.js';
import { AnalyticsService } from './analytics.service.js';

export class AnalyticsController {
  /**
   * Authoritative analytics for the authenticated caller's assigned hierarchy scope.
   * Works seamlessly for ALL tiers: State, Zone, Parliament, Constituency, Mandal, Polling Station, Village, Booth, 100-Voter Group.
   */
  static async getMyScopeAnalytics(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user || !req.hierarchyScope) {
      return reply.status(401).send({ success: false, error: { message: 'Authentication required' } });
    }

    const data = await AnalyticsService.computeAnalyticsForScope(req.hierarchyScope, req.user.userId);
    return reply.send(successResponse(data));
  }

  /**
   * Filterable server-side SQL demographics & caste analytics for the caller's authorized scope.
   */
  static async getDemographics(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user || !req.hierarchyScope) {
      return reply.status(401).send({ success: false, error: { message: 'Authentication required' } });
    }

    const q = (req.query || {}) as {
      villageId?: string;
      village?: string;
      boothId?: string;
      caste?: string;
      gender?: string;
      ageGroup?: string;
      profession?: string;
    };

    const data = await AnalyticsService.computeDemographicsForScope(req.hierarchyScope, req.user.userId, q);
    return reply.send(successResponse(data));
  }

  static async getStateAnalytics(req: FastifyRequest, reply: FastifyReply) {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const orgId = req.user?.organisationId;

    if (!isSuperAdmin && !orgId) {
      return reply.status(404).send({ success: false, error: { message: 'State unit not found' } });
    }

    let state: { id: string; code: string; organisationId: string | null } | null = null;
    let stateUnit: any = null;

    if (orgId) {
      state = await prisma.state.findFirst({
        where: { organisationId: orgId },
        select: { id: true, code: true, organisationId: true },
      });
      if (state) {
        stateUnit = await prisma.organizationUnit.findFirst({
          where: { code: state.code, level: OrgHierarchyLevel.STATE },
        });
      }
    }
    if (!state && isSuperAdmin) {
      state = await prisma.state.findFirst({ select: { id: true, code: true, organisationId: true } });
    }
    if (!stateUnit && isSuperAdmin) {
      stateUnit = await prisma.organizationUnit.findFirst({ where: { level: OrgHierarchyLevel.STATE } });
    }

    const targetId = stateUnit?.id ?? state?.id;
    if (!targetId) {
      return reply.status(404).send({ success: false, error: { message: 'State unit not found' } });
    }
    if (!assertUnitAccess(req, reply, state?.id ?? targetId)) return;

    const data = await AnalyticsService.computeAnalyticsForUnit(targetId, {
      organisationId: orgId || state?.organisationId || null,
      geoEntityId: state?.id || null,
      geoLevel: OrgHierarchyLevel.STATE,
    });
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
    if (!assertUnitAccess(req, reply, zone.id)) return;

    const data = await AnalyticsService.computeAnalyticsForUnit(targetUnitId, {
      organisationId: zone.state.organisationId,
      geoEntityId: zone.id,
      geoLevel: OrgHierarchyLevel.ZONE,
    });
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
    if (!assertUnitAccess(req, reply, par.id)) return;

    const data = await AnalyticsService.computeAnalyticsForUnit(targetUnitId, {
      organisationId: par.zone.state.organisationId,
      geoEntityId: par.id,
      geoLevel: OrgHierarchyLevel.PARLIAMENT,
    });
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
    if (!assertUnitAccess(req, reply, ac.id)) return;

    const data = await AnalyticsService.computeAnalyticsForUnit(targetUnitId, {
      organisationId: ac.parliament.zone.state.organisationId,
      geoEntityId: ac.id,
      geoLevel: OrgHierarchyLevel.CONSTITUENCY,
    });
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
    if (!assertUnitAccess(req, reply, m.id)) return;

    const data = await AnalyticsService.computeAnalyticsForUnit(targetUnitId, {
      organisationId: m.constituency.parliament.zone.state.organisationId,
      geoEntityId: m.id,
      geoLevel: OrgHierarchyLevel.MANDAL,
    });
    return reply.send(successResponse(data));
  }

  static async getPollingStationAnalytics(req: FastifyRequest, reply: FastifyReply) {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const orgId = req.user?.organisationId;
    const params = req.params as { id: string };

    const ps = await prisma.pollingStation.findUnique({
      where: { id: params.id },
      include: {
        booths: { select: { id: true } },
        constituency: { include: { parliament: { include: { zone: { include: { state: true } } } } } },
      },
    });
    if (!ps) {
      return reply.status(404).send({ success: false, error: { message: 'Polling Station not found' } });
    }
    if (!isSuperAdmin && (!orgId || ps.constituency.parliament.zone.state.organisationId !== orgId)) {
      return reply.status(404).send({ success: false, error: { message: 'Polling Station not found' } });
    }

    // Verify at least one booth in this polling station (or mandal/constituency) is in caller's scope
    const firstBoothId = ps.booths[0]?.id;
    if (firstBoothId && !assertUnitAccess(req, reply, firstBoothId)) return;

    const data = await AnalyticsService.computeAnalyticsForUnit(ps.id, {
      organisationId: ps.constituency.parliament.zone.state.organisationId,
      geoEntityId: ps.id,
      geoLevel: OrgHierarchyLevel.VILLAGE,
      pollingStationId: ps.id,
    });
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
      // Fallback: Village Incharge may be assigned to a PollingStation ID
      const ps = await prisma.pollingStation.findUnique({ where: { id: params.id }, select: { id: true } });
      if (ps) {
        return AnalyticsController.getPollingStationAnalytics(req, reply);
      }
      return reply.status(404).send({ success: false, error: { message: 'Village not found' } });
    }
    if (!isSuperAdmin && (!orgId || v.mandal.constituency.parliament.zone.state.organisationId !== orgId)) {
      return reply.status(404).send({ success: false, error: { message: 'Village not found' } });
    }

    const unit = await prisma.organizationUnit.findFirst({ where: { code: v.code, level: OrgHierarchyLevel.VILLAGE } });
    const targetUnitId = unit?.id ?? params.id;
    if (!assertUnitAccess(req, reply, v.id)) return;

    const data = await AnalyticsService.computeAnalyticsForUnit(targetUnitId, {
      organisationId: v.mandal.constituency.parliament.zone.state.organisationId,
      geoEntityId: v.id,
      geoLevel: OrgHierarchyLevel.VILLAGE,
    });
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
    if (!assertUnitAccess(req, reply, b.id)) return;

    const data = await AnalyticsService.computeAnalyticsForUnit(targetUnitId, {
      organisationId: b.village.mandal.constituency.parliament.zone.state.organisationId,
      geoEntityId: b.id,
      geoLevel: OrgHierarchyLevel.BOOTH,
    });
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
    if (!assertUnitAccess(req, reply, vg.id)) return;

    const data = await AnalyticsService.computeAnalyticsForUnit(targetUnitId, {
      organisationId: vg.booth.village.mandal.constituency.parliament.zone.state.organisationId,
      geoEntityId: vg.id,
      geoLevel: OrgHierarchyLevel.VOTER_GROUP,
    });
    return reply.send(successResponse(data));
  }

  static async getLiveVoteEvents(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as { unitId?: string; limit?: string };
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '25', 10)));
    const scope = req.hierarchyScope;
    const where: any = {};

    if (query.unitId) {
      where.OR = [
        { unitId: query.unitId },
        { voter: { mandalId: query.unitId } },
        { voter: { constituencyId: query.unitId } },
        { voter: { villageId: query.unitId } },
        { voter: { boothId: query.unitId } },
        { voter: { voterGroupId: query.unitId } },
      ];
    } else if (scope && !scope.isGlobalScope) {
      const voterScopeOr: any[] = [];
      if (scope.accessibleVoterGroupIds.size > 0) voterScopeOr.push({ voterGroupId: { in: Array.from(scope.accessibleVoterGroupIds) } });
      if (scope.accessibleBoothIds.size > 0) voterScopeOr.push({ boothId: { in: Array.from(scope.accessibleBoothIds) } });
      if (scope.accessibleVillageIds.size > 0) voterScopeOr.push({ villageId: { in: Array.from(scope.accessibleVillageIds) } });
      if (scope.accessibleMandalIds.size > 0) voterScopeOr.push({ mandalId: { in: Array.from(scope.accessibleMandalIds) } });
      if (scope.accessibleConstituencyIds.size > 0) voterScopeOr.push({ constituencyId: { in: Array.from(scope.accessibleConstituencyIds) } });
      if (scope.accessibleStateIds.size > 0) voterScopeOr.push({ stateId: { in: Array.from(scope.accessibleStateIds) } });
      if (voterScopeOr.length > 0) {
        where.voter = { OR: voterScopeOr };
      } else if (scope.organisationId) {
        where.incharge = { organisationId: scope.organisationId };
      }
    }

    const events = await prisma.liveVoteEvent.findMany({
      where,
      orderBy: { changedAt: 'desc' },
      take: limit,
      include: {
        voter: {
          select: {
            id: true,
            name: true,
            epicNumber: true,
            politicalPreference: true,
          },
        },
        incharge: {
          select: {
            id: true,
            name: true,
            userCode: true,
          },
        },
        unit: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
      },
    });

    const formatted = events.map((ev) => ({
      id: ev.id,
      previousStatus: ev.previousStatus,
      nextStatus: ev.nextStatus,
      changedAt: ev.changedAt.toISOString(),
      voter: {
        id: ev.voter.id,
        name: ev.voter.name,
        epicNumber: ev.voter.epicNumber,
        politicalPreference: ev.voter.politicalPreference,
      },
      unit: {
        id: ev.unit?.id || ev.unitId,
        name: ev.unit?.name || '',
        level: ev.unit?.level || 'VOTER_GROUP',
      },
      incharge: {
        id: ev.incharge.id,
        name: ev.incharge.name,
        userCode: ev.incharge.userCode,
      },
    }));

    return reply.send(successResponse(formatted));
  }
}
