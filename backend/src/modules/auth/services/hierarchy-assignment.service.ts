import { OrgHierarchyLevel, RoleType } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';

export class HierarchyAssignmentService {
  /**
   * Ensures the user has appropriate unitId and UserHierarchyAssignment record based on role.
   */
  static async resolveUnitAndAssignment(user: any, role: string): Promise<void> {
    const existingAssignment = await prisma.userHierarchyAssignment.findFirst({
      where: { userId: user.id, isActive: true },
    });

    if (existingAssignment && user.unitId) {
      return;
    }

    let resolvedUnitId: string | null = null;
    const assignmentData: any = {
      userId: user.id,
      roleType: role,
      isActive: true,
    };

    const constituency = await prisma.constituency.findFirst();
    const state = await prisma.state.findFirst();
    const zone = await prisma.zone.findFirst();
    const parliament = await prisma.parliament.findFirst();

    if (role === RoleType.SUPER_ADMIN || role === RoleType.STATE_ADMIN) {
      const stateUnit = await prisma.organizationUnit.findFirst({ where: { level: OrgHierarchyLevel.STATE } });
      resolvedUnitId = stateUnit?.id || null;
      if (state) assignmentData.stateId = state.id;
    } else if (role === RoleType.ZONE_INCHARGE) {
      const zoneUnit = await prisma.organizationUnit.findFirst({ where: { level: OrgHierarchyLevel.ZONE } });
      resolvedUnitId = zoneUnit?.id || null;
      if (state) assignmentData.stateId = state.id;
      if (zone) assignmentData.zoneId = zone.id;
    } else if (role === RoleType.PARLIAMENT_INCHARGE) {
      const parUnit = await prisma.organizationUnit.findFirst({ where: { level: OrgHierarchyLevel.PARLIAMENT } });
      resolvedUnitId = parUnit?.id || null;
      if (state) assignmentData.stateId = state.id;
      if (zone) assignmentData.zoneId = zone.id;
      if (parliament) assignmentData.parliamentId = parliament.id;
    } else if (role === RoleType.CONSTITUENCY_INCHARGE || role === RoleType.VIEWER) {
      const constUnit = await prisma.organizationUnit.findFirst({ where: { level: OrgHierarchyLevel.CONSTITUENCY } });
      resolvedUnitId = constUnit?.id || null;
      if (constituency) assignmentData.constituencyId = constituency.id;
    } else if (role === RoleType.MANDAL_INCHARGE) {
      const mandal = await prisma.mandal.findFirst({ where: { constituencyId: constituency?.id } });
      const mandalUnit = mandal
        ? await prisma.organizationUnit.findFirst({ where: { name: mandal.name, level: OrgHierarchyLevel.MANDAL } })
        : null;
      resolvedUnitId = mandalUnit?.id || null;
      if (constituency) assignmentData.constituencyId = constituency.id;
      if (mandal) assignmentData.mandalId = mandal.id;
    } else if (role === RoleType.VILLAGE_INCHARGE) {
      const village = await prisma.village.findFirst({ include: { mandal: true } });
      const villageUnit = village
        ? await prisma.organizationUnit.findFirst({ where: { name: village.name, level: OrgHierarchyLevel.VILLAGE } })
        : null;
      resolvedUnitId = villageUnit?.id || null;
      if (constituency) assignmentData.constituencyId = constituency.id;
      if (village?.mandalId) assignmentData.mandalId = village.mandalId;
      if (village) assignmentData.villageId = village.id;
    } else if (role === RoleType.BOOTH_PRESIDENT || role === RoleType.BOOTH_INCHARGE || role === RoleType.POLLING_AGENT) {
      const booth = await prisma.booth.findFirst({ include: { village: true } });
      const boothUnit = booth
        ? await prisma.organizationUnit.findFirst({ where: { name: booth.name, level: OrgHierarchyLevel.BOOTH } })
        : null;
      resolvedUnitId = boothUnit?.id || null;
      if (constituency) assignmentData.constituencyId = constituency.id;
      if (booth?.village?.mandalId) assignmentData.mandalId = booth.village.mandalId;
      if (booth?.villageId) assignmentData.villageId = booth.villageId;
      if (booth) assignmentData.boothId = booth.id;
    } else if (role === RoleType.VOTER_100_INCHARGE) {
      const voterGroup = await prisma.voterGroup.findFirst({ include: { booth: { include: { village: true } } } });
      const vgUnit = voterGroup
        ? await prisma.organizationUnit.findFirst({ where: { code: voterGroup.code, level: OrgHierarchyLevel.VOTER_GROUP } })
        : null;
      resolvedUnitId = vgUnit?.id || null;
      if (constituency) assignmentData.constituencyId = constituency.id;
      if (voterGroup?.booth?.village?.mandalId) assignmentData.mandalId = voterGroup.booth.village.mandalId;
      if (voterGroup?.booth?.villageId) assignmentData.villageId = voterGroup.booth.villageId;
      if (voterGroup?.boothId) assignmentData.boothId = voterGroup.boothId;
      if (voterGroup) assignmentData.voterGroupId = voterGroup.id;
    }

    if (resolvedUnitId && !user.unitId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { unitId: resolvedUnitId },
      });
      user.unitId = resolvedUnitId;
    }

    if (!existingAssignment && (assignmentData.stateId || assignmentData.constituencyId || assignmentData.mandalId || assignmentData.villageId || assignmentData.boothId || assignmentData.voterGroupId)) {
      await prisma.userHierarchyAssignment.create({
        data: assignmentData,
      });
    }
  }

  /**
   * Formats a user's hierarchy assignment into standard client response shape.
   */
  static formatHierarchyAssignment(assignment: any) {
    if (!assignment) return null;
    return {
      id: assignment.id,
      roleType: assignment.roleType,
      state: assignment.state,
      zone: assignment.zone,
      parliament: assignment.parliament,
      constituency: assignment.constituency,
      mandal: assignment.mandal,
      village: assignment.village,
      booth: assignment.booth,
      voterGroup: assignment.voterGroup,
    };
  }
}
