import { AuditAction, OrgHierarchyLevel, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { logAudit } from '../../middleware/audit.js';

export class HierarchyService {
  static async getStates() {
    return prisma.state.findMany({
      include: { zones: true },
      orderBy: { name: 'asc' },
    });
  }

  static async createState(data: any, actorId: string) {
    const state = await prisma.state.create({ data });
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

  static async getZones(stateId?: string) {
    return prisma.zone.findMany({
      where: stateId ? { stateId } : undefined,
      include: { state: true, parliaments: true },
      orderBy: { name: 'asc' },
    });
  }

  static async createZone(data: any, actorId: string) {
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

  static async getParliaments(zoneId?: string) {
    return prisma.parliament.findMany({
      where: zoneId ? { zoneId } : undefined,
      include: { zone: true, constituencies: true },
      orderBy: { name: 'asc' },
    });
  }

  static async createParliament(data: any, actorId: string) {
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

  static async getConstituencies(parliamentId?: string) {
    return prisma.constituency.findMany({
      where: parliamentId ? { parliamentId } : undefined,
      include: { parliament: true, mandals: true },
      orderBy: { name: 'asc' },
    });
  }

  static async createConstituency(data: any, actorId: string) {
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

  static async getMandals(constituencyId?: string) {
    return prisma.mandal.findMany({
      where: constituencyId ? { constituencyId } : undefined,
      include: { constituency: true, villages: true },
      orderBy: { name: 'asc' },
    });
  }

  static async createMandal(data: any, actorId: string) {
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

  static async getVillages(mandalId?: string) {
    return prisma.village.findMany({
      where: mandalId ? { mandalId } : undefined,
      include: { mandal: true, booths: true },
      orderBy: { name: 'asc' },
    });
  }

  static async createVillage(data: any, actorId: string) {
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

  static async getBooths(villageId?: string) {
    return prisma.booth.findMany({
      where: villageId ? { villageId } : undefined,
      include: { village: true, voterGroups: true, cadreAssignments: true },
      orderBy: { boothNumber: 'asc' },
    });
  }

  static async createBooth(data: any, actorId: string) {
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

  static async getVoterIncharges(boothId?: string) {
    return prisma.voterGroup.findMany({
      where: boothId ? { boothId } : undefined,
      include: { booth: true, assignedIncharge: true },
      orderBy: { name: 'asc' },
    });
  }

  static async createVoterIncharge(data: any, actorId: string) {
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
