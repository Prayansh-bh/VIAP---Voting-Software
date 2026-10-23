import { AuditAction, OrgHierarchyLevel, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { logAudit } from '../../middleware/audit.js';

export class HierarchyService {
  static async getStates(organisationId?: string | null, isSuperAdmin = false) {
    if (!isSuperAdmin && !organisationId) {
      return [];
    }

    const where: Prisma.StateWhereInput = !isSuperAdmin || organisationId ? { organisationId } : {};

    return prisma.state.findMany({
      where,
      include: { zones: true },
      orderBy: { name: 'asc' },
    });
  }

  static async createState(data: any, actorId: string, organisationId?: string | null, isSuperAdmin = false) {
    if (!isSuperAdmin && !organisationId) {
      throw Object.assign(new Error('Tenant context required'), { statusCode: 403, code: 'FORBIDDEN_TENANT' });
    }

    const orgToSet = isSuperAdmin ? (data.organisationId || organisationId || null) : organisationId;
    const state = await prisma.state.create({
      data: { ...data, organisationId: orgToSet },
    });

    await prisma.organizationUnit.create({
      data: {
        name: data.name,
        code: data.code,
        level: OrgHierarchyLevel.STATE,
      },
    });

    await logAudit({
      action: AuditAction.CREATE,
      entityType: 'State',
      entityId: state.id,
      userId: actorId,
      changes: data as unknown as Prisma.InputJsonValue,
    });
    return state;
  }

  static async getZones(stateId?: string, organisationId?: string | null, isSuperAdmin = false) {
    if (!isSuperAdmin && !organisationId) {
      return [];
    }

    const where: Prisma.ZoneWhereInput = {};
    if (stateId) where.stateId = stateId;
    if (!isSuperAdmin || organisationId) {
      where.state = { organisationId };
    }

    return prisma.zone.findMany({
      where,
      include: { state: true, parliaments: true },
      orderBy: { name: 'asc' },
    });
  }

  static async createZone(data: any, actorId: string, organisationId?: string | null, isSuperAdmin = false) {
    const parentState = await prisma.state.findUnique({ where: { id: data.stateId } });
    if (!parentState) {
      throw Object.assign(new Error('State not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }
    if (!isSuperAdmin && (!organisationId || parentState.organisationId !== organisationId)) {
      throw Object.assign(new Error('Parent State belongs to another organisation'), { statusCode: 403, code: 'FORBIDDEN_TENANT' });
    }

    const zone = await prisma.zone.create({ data });
    const parentUnit = await prisma.organizationUnit.findFirst({ where: { level: OrgHierarchyLevel.STATE } });
    await prisma.organizationUnit.create({
      data: {
        name: data.name,
        code: data.code,
        level: OrgHierarchyLevel.ZONE,
        parentId: parentUnit?.id,
      },
    });

    await logAudit({
      action: AuditAction.CREATE,
      entityType: 'Zone',
      entityId: zone.id,
      userId: actorId,
      changes: data as unknown as Prisma.InputJsonValue,
    });
    return zone;
  }

  static async getParliaments(zoneId?: string, organisationId?: string | null, isSuperAdmin = false) {
    if (!isSuperAdmin && !organisationId) {
      return [];
    }

    const where: Prisma.ParliamentWhereInput = {};
    if (zoneId) where.zoneId = zoneId;
    if (!isSuperAdmin || organisationId) {
      where.zone = { state: { organisationId } };
    }

    return prisma.parliament.findMany({
      where,
      include: { zone: true, constituencies: true },
      orderBy: { name: 'asc' },
    });
  }

  static async createParliament(data: any, actorId: string, organisationId?: string | null, isSuperAdmin = false) {
    const parentZone = await prisma.zone.findUnique({
      where: { id: data.zoneId },
      include: { state: true },
    });
    if (!parentZone) {
      throw Object.assign(new Error('Zone not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }
    if (!isSuperAdmin && (!organisationId || parentZone.state.organisationId !== organisationId)) {
      throw Object.assign(new Error('Parent Zone belongs to another organisation'), { statusCode: 403, code: 'FORBIDDEN_TENANT' });
    }

    const par = await prisma.parliament.create({ data });
    const parentUnit = await prisma.organizationUnit.findFirst({ where: { level: OrgHierarchyLevel.ZONE } });
    await prisma.organizationUnit.create({
      data: {
        name: data.name,
        code: data.code,
        level: OrgHierarchyLevel.PARLIAMENT,
        parentId: parentUnit?.id,
      },
    });

    await logAudit({
      action: AuditAction.CREATE,
      entityType: 'Parliament',
      entityId: par.id,
      userId: actorId,
      changes: data as unknown as Prisma.InputJsonValue,
    });
    return par;
  }

  static async getConstituencies(parliamentId?: string, organisationId?: string | null, isSuperAdmin = false) {
    if (!isSuperAdmin && !organisationId) {
      return [];
    }

    const where: Prisma.ConstituencyWhereInput = {};
    if (parliamentId) where.parliamentId = parliamentId;
    if (!isSuperAdmin || organisationId) {
      where.parliament = { zone: { state: { organisationId } } };
    }

    return prisma.constituency.findMany({
      where,
      include: { parliament: true, mandals: true },
      orderBy: { name: 'asc' },
    });
  }

  static async createConstituency(data: any, actorId: string, organisationId?: string | null, isSuperAdmin = false) {
    const parentParliament = await prisma.parliament.findUnique({
      where: { id: data.parliamentId },
      include: { zone: { include: { state: true } } },
    });
    if (!parentParliament) {
      throw Object.assign(new Error('Parliament not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }
    if (!isSuperAdmin && (!organisationId || parentParliament.zone.state.organisationId !== organisationId)) {
      throw Object.assign(new Error('Parent Parliament belongs to another organisation'), { statusCode: 403, code: 'FORBIDDEN_TENANT' });
    }

    const item = await prisma.constituency.create({ data });
    const parentUnit = await prisma.organizationUnit.findFirst({ where: { level: OrgHierarchyLevel.PARLIAMENT } });
    await prisma.organizationUnit.create({
      data: {
        name: data.name,
        code: data.code,
        level: OrgHierarchyLevel.CONSTITUENCY,
        parentId: parentUnit?.id,
      },
    });

    await logAudit({
      action: AuditAction.CREATE,
      entityType: 'Constituency',
      entityId: item.id,
      userId: actorId,
      changes: data as unknown as Prisma.InputJsonValue,
    });
    return item;
  }

  static async getMandals(constituencyId?: string, organisationId?: string | null, isSuperAdmin = false) {
    if (!isSuperAdmin && !organisationId) {
      return [];
    }

    const where: Prisma.MandalWhereInput = {};
    if (constituencyId) where.constituencyId = constituencyId;
    if (!isSuperAdmin || organisationId) {
      where.constituency = { parliament: { zone: { state: { organisationId } } } };
    }

    return prisma.mandal.findMany({
      where,
      include: { constituency: true, villages: true },
      orderBy: { name: 'asc' },
    });
  }

  static async createMandal(data: any, actorId: string, organisationId?: string | null, isSuperAdmin = false) {
    const parentConstituency = await prisma.constituency.findUnique({
      where: { id: data.constituencyId },
      include: { parliament: { include: { zone: { include: { state: true } } } } },
    });
    if (!parentConstituency) {
      throw Object.assign(new Error('Constituency not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }
    if (!isSuperAdmin && (!organisationId || parentConstituency.parliament.zone.state.organisationId !== organisationId)) {
      throw Object.assign(new Error('Parent Constituency belongs to another organisation'), { statusCode: 403, code: 'FORBIDDEN_TENANT' });
    }

    const item = await prisma.mandal.create({ data });
    const parentUnit = await prisma.organizationUnit.findFirst({ where: { level: OrgHierarchyLevel.CONSTITUENCY } });
    await prisma.organizationUnit.create({
      data: {
        name: data.name,
        code: data.code,
        level: OrgHierarchyLevel.MANDAL,
        parentId: parentUnit?.id,
      },
    });

    await logAudit({
      action: AuditAction.CREATE,
      entityType: 'Mandal',
      entityId: item.id,
      userId: actorId,
      changes: data as unknown as Prisma.InputJsonValue,
    });
    return item;
  }

  static async getVillages(mandalId?: string, organisationId?: string | null, isSuperAdmin = false) {
    if (!isSuperAdmin && !organisationId) {
      return [];
    }

    let resolvedMandalId = mandalId;
    if (mandalId) {
      const mandalExists = await prisma.mandal.findUnique({ where: { id: mandalId } });
      if (!mandalExists) {
        const orgUnit = await prisma.organizationUnit.findUnique({ where: { id: mandalId } });
        if (orgUnit?.code) {
          const m = await prisma.mandal.findFirst({ where: { code: orgUnit.code } });
          if (m) resolvedMandalId = m.id;
        }
      }
    }

    const where: Prisma.VillageWhereInput = {};
    if (resolvedMandalId) where.mandalId = resolvedMandalId;
    if (!isSuperAdmin || organisationId) {
      where.mandal = { constituency: { parliament: { zone: { state: { organisationId } } } } };
    }

    return prisma.village.findMany({
      where,
      include: {
        mandal: { include: { constituency: true } },
        booths: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  static async createVillage(data: any, actorId: string, organisationId?: string | null, isSuperAdmin = false) {
    const parentMandal = await prisma.mandal.findUnique({
      where: { id: data.mandalId },
      include: {
        constituency: {
          include: {
            parliament: {
              include: {
                zone: {
                  include: {
                    state: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!parentMandal) {
      throw Object.assign(new Error('Mandal not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }
    if (!isSuperAdmin && (!organisationId || parentMandal.constituency.parliament.zone.state.organisationId !== organisationId)) {
      throw Object.assign(new Error('Parent Mandal belongs to another organisation'), { statusCode: 403, code: 'FORBIDDEN_TENANT' });
    }

    const item = await prisma.village.create({ data });
    const parentUnit = await prisma.organizationUnit.findFirst({ where: { level: OrgHierarchyLevel.MANDAL } });
    await prisma.organizationUnit.create({
      data: {
        name: data.name,
        code: data.code,
        level: OrgHierarchyLevel.VILLAGE,
        parentId: parentUnit?.id,
      },
    });

    await logAudit({
      action: AuditAction.CREATE,
      entityType: 'Village',
      entityId: item.id,
      userId: actorId,
      changes: data as unknown as Prisma.InputJsonValue,
    });
    return item;
  }

  static async getBooths(villageId?: string, organisationId?: string | null, isSuperAdmin = false, mandalId?: string) {
    if (!isSuperAdmin && !organisationId) {
      return [];
    }

    let resolvedMandalId = mandalId;
    if (mandalId) {
      const mandalExists = await prisma.mandal.findUnique({ where: { id: mandalId } });
      if (!mandalExists) {
        const orgUnit = await prisma.organizationUnit.findUnique({ where: { id: mandalId } });
        if (orgUnit?.code) {
          const m = await prisma.mandal.findFirst({ where: { code: orgUnit.code } });
          if (m) resolvedMandalId = m.id;
        }
      }
    }

    const where: Prisma.BoothWhereInput = {};
    if (villageId) where.villageId = villageId;
    if (resolvedMandalId) {
      where.village = { mandalId: resolvedMandalId };
    }
    if (!isSuperAdmin || organisationId) {
      where.village = {
        ...(where.village as any),
        mandal: { constituency: { parliament: { zone: { state: { organisationId } } } } },
      };
    }

    return prisma.booth.findMany({
      where,
      include: {
        village: true,
        voterGroups: true,
        users: { include: { user: true } },
      },
      orderBy: { boothNumber: 'asc' },
    });
  }

  static async createBooth(data: any, actorId: string, organisationId?: string | null, isSuperAdmin = false) {
    const parentVillage = await prisma.village.findUnique({
      where: { id: data.villageId },
      include: {
        mandal: {
          include: {
            constituency: {
              include: {
                parliament: {
                  include: {
                    zone: {
                      include: {
                        state: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!parentVillage) {
      throw Object.assign(new Error('Village not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }
    if (!isSuperAdmin && (!organisationId || parentVillage.mandal.constituency.parliament.zone.state.organisationId !== organisationId)) {
      throw Object.assign(new Error('Parent Village belongs to another organisation'), { statusCode: 403, code: 'FORBIDDEN_TENANT' });
    }

    const item = await prisma.booth.create({ data });
    const parentUnit = await prisma.organizationUnit.findFirst({ where: { level: OrgHierarchyLevel.VILLAGE } });
    await prisma.organizationUnit.create({
      data: {
        name: data.name,
        code: data.code,
        level: OrgHierarchyLevel.BOOTH,
        parentId: parentUnit?.id,
      },
    });

    await logAudit({
      action: AuditAction.CREATE,
      entityType: 'Booth',
      entityId: item.id,
      userId: actorId,
      changes: data as unknown as Prisma.InputJsonValue,
    });
    return item;
  }

  static async getVoterIncharges(boothId?: string, organisationId?: string | null, isSuperAdmin = false) {
    if (!isSuperAdmin && !organisationId) {
      return [];
    }

    const where: Prisma.VoterGroupWhereInput = {};
    if (boothId) where.boothId = boothId;
    if (!isSuperAdmin || organisationId) {
      where.booth = {
        village: {
          mandal: {
            constituency: {
              parliament: {
                zone: {
                  state: {
                    organisationId,
                  },
                },
              },
            },
          },
        },
      };
    }

    return prisma.voterGroup.findMany({
      where,
      include: { booth: true, assignedIncharge: true },
      orderBy: { name: 'asc' },
    });
  }

  static async createVoterIncharge(data: any, actorId: string, organisationId?: string | null, isSuperAdmin = false) {
    const parentBooth = await prisma.booth.findUnique({
      where: { id: data.boothId },
      include: {
        village: {
          include: {
            mandal: {
              include: {
                constituency: {
                  include: {
                    parliament: {
                      include: {
                        zone: {
                          include: {
                            state: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!parentBooth) {
      throw Object.assign(new Error('Booth not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }
    if (!isSuperAdmin && (!organisationId || parentBooth.village.mandal.constituency.parliament.zone.state.organisationId !== organisationId)) {
      throw Object.assign(new Error('Parent Booth belongs to another organisation'), { statusCode: 403, code: 'FORBIDDEN_TENANT' });
    }

    const item = await prisma.voterGroup.create({ data });
    const parentUnit = await prisma.organizationUnit.findFirst({ where: { level: OrgHierarchyLevel.BOOTH } });
    await prisma.organizationUnit.create({
      data: {
        name: data.name,
        code: data.code,
        level: OrgHierarchyLevel.VOTER_GROUP,
        parentId: parentUnit?.id,
      },
    });

    await logAudit({
      action: AuditAction.CREATE,
      entityType: 'VoterGroup',
      entityId: item.id,
      userId: actorId,
      changes: data as unknown as Prisma.InputJsonValue,
    });
    return item;
  }
}
