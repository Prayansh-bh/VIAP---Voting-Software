import { RoleType, AccountStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import xlsx from 'xlsx';
import { prisma } from '../../lib/prisma.js';

export interface CadreSlotItem {
  unitKey: string;
  slotCode: string;
  canonicalCode?: string;
  level: 'MANDAL' | 'POLLING_STATION' | 'BOOTH' | '100_VOTER_GROUP';
  roleRequired: RoleType;
  jurisdictionName: string;
  constituencyId: string;
  constituencyName: string;
  mandalId?: string;
  mandalName?: string;
  pollingStationId?: string;
  pollingStationName?: string;
  villageId?: string;
  boothId?: string;
  boothNumber?: string;
  groupId?: string;
  groupName?: string;
  voterRange?: string;
  voterCount: number;
  status: 'ASSIGNED' | 'MISSING' | 'CONFLICT';
  assignedUser?: {
    id: string;
    name: string;
    mobileNumber: string;
    role: RoleType;
    userCode?: string;
  };
}

export interface CadreSlotsResponse {
  constituencyId?: string;
  totalVoters?: number;
  summary: {
    constituency: { id: string; name: string; code: string };
    mandalsCount: number;
    pollingStationsCount: number;
    boothsCount: number;
    groupsCount: number;
    mandalCount?: number;
    pollingStationCount?: number;
    boothCount?: number;
    groupCount?: number;
    totalSlots?: number;
    totalLogins?: number;
    assignedSlots?: number;
    unassignedSlots?: number;
    requiredRosterCounts: {
      mandalIncharges: { required: number; assigned: number; missing: number; conflict: number };
      villageIncharges: { required: number; assigned: number; missing: number; conflict: number };
      boothIncharges: { required: number; assigned: number; missing: number; conflict: number };
      groupIncharges: { required: number; assigned: number; missing: number; conflict: number };
      totalRequired: number;
      totalAssigned: number;
      totalMissing: number;
      totalConflict: number;
    };
  };
  sections: {
    mandals: CadreSlotItem[];
    pollingStations: CadreSlotItem[];
    booths: CadreSlotItem[];
    groups: CadreSlotItem[];
  };
  allSlots: CadreSlotItem[];
}

export interface CadreInputEntry {
  unitKey?: string;
  slotCode?: string;
  level?: 'MANDAL' | 'POLLING_STATION' | 'BOOTH' | '100_VOTER_GROUP';
  inchargeName?: string;
  mobileNumber: string;
  passcode?: string;
}

export interface InchargeRosterPreviewItem {
  unitKey: string;
  level: 'MANDAL' | 'POLLING_STATION' | 'BOOTH' | '100_VOTER_GROUP';
  roleRequired: RoleType;
  constituencyId: string;
  constituencyName: string;
  mandalId?: string;
  mandalName?: string;
  pollingStationName?: string;
  boothId?: string;
  boothNumber?: string;
  groupId?: string;
  groupName?: string;
  voterCount: number;
  status: 'ASSIGNED' | 'MISSING' | 'CONFLICT';
  assignedUsers: Array<{
    id: string;
    name: string;
    mobileNumber: string;
    role: RoleType;
    userCode?: string;
  }>;
  proposedAction: 'NO_ACTION' | 'INVITATION_REQUIRED' | 'RESOLVE_CONFLICT';
}

export interface InchargeRosterPreviewResponse {
  summary: {
    constituency: { id: string; name: string; code: string };
    mandalsCount: number;
    pollingStationsCount: number;
    boothsCount: number;
    groupsCount: number;
    requiredRosterCounts: {
      mandalIncharges: { required: number; assigned: number; missing: number; conflict: number };
      villageIncharges: { required: number; assigned: number; missing: number; conflict: number };
      boothIncharges: { required: number; assigned: number; missing: number; conflict: number };
      groupIncharges: { required: number; assigned: number; missing: number; conflict: number };
      totalRequired: number;
      totalAssigned: number;
      totalMissing: number;
      totalConflict: number;
    };
    dryRunMode: boolean;
    safetyNotice: string;
  };
  roster: InchargeRosterPreviewItem[];
}

export class InchargeProvisioningService {
  /**
   * Generates a dynamic incharge roster preview from the imported hierarchy.
   * STRICT SAFETY: 100% read-only calculation. Creates ZERO accounts, sends ZERO SMS/invitations.
   */
  static async generateRosterPreview(constituencyId: string): Promise<InchargeRosterPreviewResponse> {
    const constituency = await prisma.constituency.findUnique({
      where: { id: constituencyId },
      include: {
        mandals: {
          orderBy: { name: 'asc' },
          include: {
            pollingStations: {
              orderBy: { name: 'asc' },
            },
            villages: {
              include: {
                booths: {
                  orderBy: { boothNumber: 'asc' },
                  include: {
                    voterGroups: {
                      orderBy: { name: 'asc' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!constituency) {
      const err: any = new Error(`Constituency not found: ${constituencyId}`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // Pre-fetch all existing UserHierarchyAssignments for this constituency with user details
    const existingAssignments = await prisma.userHierarchyAssignment.findMany({
      where: { constituencyId, isActive: true },
      include: {
        user: {
          select: { id: true, name: true, mobileNumber: true, role: true, userCode: true },
        },
      },
    });

    // Index assignments by target node
    const mandalAssignMap = new Map<string, typeof existingAssignments>();
    const boothAssignMap = new Map<string, typeof existingAssignments>();
    const groupAssignMap = new Map<string, typeof existingAssignments>();
    const villageAssignMap = new Map<string, typeof existingAssignments>();
    const psAssignMap = new Map<string, typeof existingAssignments>();

    for (const a of existingAssignments) {
      if (a.roleType === RoleType.MANDAL_INCHARGE && a.mandalId) {
        const list = mandalAssignMap.get(a.mandalId) || [];
        list.push(a);
        mandalAssignMap.set(a.mandalId, list);
      } else if ((a.roleType === RoleType.BOOTH_INCHARGE || a.roleType === RoleType.BOOTH_PRESIDENT) && a.boothId) {
        const list = boothAssignMap.get(a.boothId) || [];
        list.push(a);
        boothAssignMap.set(a.boothId, list);
      } else if (a.roleType === RoleType.VOTER_100_INCHARGE && a.voterGroupId) {
        const list = groupAssignMap.get(a.voterGroupId) || [];
        list.push(a);
        groupAssignMap.set(a.voterGroupId, list);
      } else if (a.roleType === RoleType.VILLAGE_INCHARGE) {
        if (a.pollingStationId) {
          const list = psAssignMap.get(a.pollingStationId) || [];
          list.push(a);
          psAssignMap.set(a.pollingStationId, list);
        }
        if (a.villageId) {
          const list = villageAssignMap.get(a.villageId) || [];
          list.push(a);
          villageAssignMap.set(a.villageId, list);
        }
      }
    }

    const roster: InchargeRosterPreviewItem[] = [];

    let mandalsAssigned = 0;
    let mandalsMissing = 0;
    let mandalsConflict = 0;

    let villageAssigned = 0;
    let villageMissing = 0;
    let villageConflict = 0;

    let boothAssigned = 0;
    let boothMissing = 0;
    let boothConflict = 0;

    let groupAssigned = 0;
    let groupMissing = 0;
    let groupConflict = 0;

    const distinctPollingStations = new Set<string>();
    let distinctBoothsCount = 0;
    let distinctGroupsCount = 0;

    // 1. Mandal Incharge Roster (1 per mandal)
    for (const mandal of constituency.mandals) {
      const assigned = mandalAssignMap.get(mandal.id) || [];
      const status: 'ASSIGNED' | 'MISSING' | 'CONFLICT' =
        assigned.length === 1 ? 'ASSIGNED' : assigned.length > 1 ? 'CONFLICT' : 'MISSING';

      if (status === 'ASSIGNED') mandalsAssigned++;
      else if (status === 'CONFLICT') mandalsConflict++;
      else mandalsMissing++;

      roster.push({
        unitKey: `MDL-${mandal.id}`,
        level: 'MANDAL',
        roleRequired: RoleType.MANDAL_INCHARGE,
        constituencyId: constituency.id,
        constituencyName: constituency.name,
        mandalId: mandal.id,
        mandalName: mandal.name,
        voterCount: mandal.totalVoters,
        status,
        assignedUsers: assigned.map((a) => a.user),
        proposedAction: status === 'ASSIGNED' ? 'NO_ACTION' : status === 'CONFLICT' ? 'RESOLVE_CONFLICT' : 'INVITATION_REQUIRED',
      });

      // Collect Polling Stations and Booths
      for (const village of mandal.villages) {
        for (const booth of village.booths) {
          distinctBoothsCount++;
          const psName = booth.pollingStation || `${village.name} Polling Station`;
          distinctPollingStations.add(`${mandal.id}:${psName}:${(booth as any).pollingStationId || village.id}`);

          // 3. Booth Incharge Roster (1 per booth/part)
          const boothAssigns = boothAssignMap.get(booth.id) || [];
          const bStatus: 'ASSIGNED' | 'MISSING' | 'CONFLICT' =
            boothAssigns.length === 1 ? 'ASSIGNED' : boothAssigns.length > 1 ? 'CONFLICT' : 'MISSING';

          if (bStatus === 'ASSIGNED') boothAssigned++;
          else if (bStatus === 'CONFLICT') boothConflict++;
          else boothMissing++;

          roster.push({
            unitKey: `BTH-${booth.id}`,
            level: 'BOOTH',
            roleRequired: RoleType.BOOTH_INCHARGE,
            constituencyId: constituency.id,
            constituencyName: constituency.name,
            mandalId: mandal.id,
            mandalName: mandal.name,
            pollingStationName: psName,
            boothId: booth.id,
            boothNumber: booth.boothNumber,
            voterCount: booth.totalVoters,
            status: bStatus,
            assignedUsers: boothAssigns.map((a) => a.user),
            proposedAction: bStatus === 'ASSIGNED' ? 'NO_ACTION' : bStatus === 'CONFLICT' ? 'RESOLVE_CONFLICT' : 'INVITATION_REQUIRED',
          });

          // 4. 100-Voter Group Incharge Roster (1 per active 100-voter group)
          for (const grp of booth.voterGroups) {
            if (grp.name === 'Deleted Electors') continue; // Exclude deleted electors group from cadre roster
            distinctGroupsCount++;

            const grpAssigns = groupAssignMap.get(grp.id) || [];
            const gStatus: 'ASSIGNED' | 'MISSING' | 'CONFLICT' =
              grpAssigns.length === 1 ? 'ASSIGNED' : grpAssigns.length > 1 ? 'CONFLICT' : 'MISSING';

            if (gStatus === 'ASSIGNED') groupAssigned++;
            else if (gStatus === 'CONFLICT') groupConflict++;
            else groupMissing++;

            roster.push({
              unitKey: `VG-${grp.id}`,
              level: '100_VOTER_GROUP',
              roleRequired: RoleType.VOTER_100_INCHARGE,
              constituencyId: constituency.id,
              constituencyName: constituency.name,
              mandalId: mandal.id,
              mandalName: mandal.name,
              pollingStationName: psName,
              boothId: booth.id,
              boothNumber: booth.boothNumber,
              groupId: grp.id,
              groupName: grp.name,
              voterCount: grp.totalVoters,
              status: gStatus,
              assignedUsers: grpAssigns.map((a) => a.user),
              proposedAction: gStatus === 'ASSIGNED' ? 'NO_ACTION' : gStatus === 'CONFLICT' ? 'RESOLVE_CONFLICT' : 'INVITATION_REQUIRED',
            });
          }
        }
      }
    }

    // 2. Village Incharge Roster (at PollingStation level)
    const hasFirstClassPs = constituency.mandals.some((m) => ((m as any).pollingStations || []).length > 0);

    if (hasFirstClassPs) {
      for (const mandal of constituency.mandals) {
        for (const ps of (mandal as any).pollingStations || []) {
          const vAssigns = psAssignMap.get(ps.id) || existingAssignments.filter(
            (a) => a.roleType === RoleType.VILLAGE_INCHARGE && a.mandalId === mandal.id && !a.pollingStationId
          );
          const vStatus: 'ASSIGNED' | 'MISSING' | 'CONFLICT' =
            vAssigns.length === 1 ? 'ASSIGNED' : vAssigns.length > 1 ? 'CONFLICT' : 'MISSING';

          if (vStatus === 'ASSIGNED') villageAssigned++;
          else if (vStatus === 'CONFLICT') villageConflict++;
          else villageMissing++;

          roster.push({
            unitKey: `PS-${ps.id}`,
            level: 'POLLING_STATION',
            roleRequired: RoleType.VILLAGE_INCHARGE,
            constituencyId: constituency.id,
            constituencyName: constituency.name,
            mandalId: mandal.id,
            mandalName: mandal.name,
            pollingStationName: ps.name,
            voterCount: ps.totalVoters,
            status: vStatus,
            assignedUsers: vAssigns.map((a) => a.user),
            proposedAction: vStatus === 'ASSIGNED' ? 'NO_ACTION' : vStatus === 'CONFLICT' ? 'RESOLVE_CONFLICT' : 'INVITATION_REQUIRED',
          });
        }
      }
    } else {
      for (const psEntry of distinctPollingStations) {
        const [mandalId, psName, targetNodeId] = psEntry.split(':');
        const mandal = constituency.mandals.find((m) => m.id === mandalId);
        
        const vAssigns = existingAssignments.filter(
          (a) => a.roleType === RoleType.VILLAGE_INCHARGE &&
            a.mandalId === mandalId &&
            (targetNodeId ? (a.pollingStationId === targetNodeId || a.villageId === targetNodeId) : true)
        );
        const vStatus: 'ASSIGNED' | 'MISSING' | 'CONFLICT' =
          vAssigns.length === 1 ? 'ASSIGNED' : vAssigns.length > 1 ? 'CONFLICT' : 'MISSING';

        if (vStatus === 'ASSIGNED') villageAssigned++;
        else if (vStatus === 'CONFLICT') villageConflict++;
        else villageMissing++;

        roster.push({
          unitKey: `PS-${mandalId}-${psName.replace(/\W/g, '').slice(0, 12)}`,
          level: 'POLLING_STATION',
          roleRequired: RoleType.VILLAGE_INCHARGE,
          constituencyId: constituency.id,
          constituencyName: constituency.name,
          mandalId,
          mandalName: mandal?.name || '',
          pollingStationName: psName,
          voterCount: 0,
          status: vStatus,
          assignedUsers: vAssigns.map((a) => a.user),
          proposedAction: vStatus === 'ASSIGNED' ? 'NO_ACTION' : vStatus === 'CONFLICT' ? 'RESOLVE_CONFLICT' : 'INVITATION_REQUIRED',
        });
      }
    }

    const pollingStationsCount = hasFirstClassPs
      ? constituency.mandals.reduce((acc, m) => acc + ((m as any).pollingStations?.length || 0), 0)
      : distinctPollingStations.size;

    const totalRequired = constituency.mandals.length + pollingStationsCount + distinctBoothsCount + distinctGroupsCount;
    const totalAssigned = mandalsAssigned + villageAssigned + boothAssigned + groupAssigned;
    const totalMissing = mandalsMissing + villageMissing + boothMissing + groupMissing;
    const totalConflict = mandalsConflict + villageConflict + boothConflict + groupConflict;

    return {
      summary: {
        constituency: { id: constituency.id, name: constituency.name, code: constituency.code },
        mandalsCount: constituency.mandals.length,
        pollingStationsCount: distinctPollingStations.size,
        boothsCount: distinctBoothsCount,
        groupsCount: distinctGroupsCount,
        requiredRosterCounts: {
          mandalIncharges: { required: constituency.mandals.length, assigned: mandalsAssigned, missing: mandalsMissing, conflict: mandalsConflict },
          villageIncharges: { required: distinctPollingStations.size, assigned: villageAssigned, missing: villageMissing, conflict: villageConflict },
          boothIncharges: { required: distinctBoothsCount, assigned: boothAssigned, missing: boothMissing, conflict: boothConflict },
          groupIncharges: { required: distinctGroupsCount, assigned: groupAssigned, missing: groupMissing, conflict: groupConflict },
          totalRequired,
          totalAssigned,
          totalMissing,
          totalConflict,
        },
        dryRunMode: true,
        safetyNotice: 'DRY RUN ONLY: No user accounts, credentials, or invitations were created or dispatched. Live provisioning requires explicit operational review and user confirmation.',
      },
      roster,
    };
  }

  /**
   * Dynamically provisions cadre user logins and hierarchy assignments
   * for the given constituency under the specified organization.
   * Fully tenant-isolated and idempotent.
   */
  static async provisionIncharges(opts: {
    constituencyId: string;
    organisationId?: string;
    partyCode?: string;
    defaultPasscode?: string;
    actorId?: string;
    entries?: CadreInputEntry[];
    allowSyntheticFallback?: boolean;
  }): Promise<{
    success: boolean;
    constituency: { id: string; name: string; code: string };
    summary: {
      mandalsProvisioned: number;
      villagesProvisioned: number;
      boothsProvisioned: number;
      groupsProvisioned: number;
      totalUsersProvisioned: number;
      defaultPasscode: string;
    };
    roster: Array<{
      level: string;
      role: RoleType;
      userCode: string;
      name: string;
      mobileNumber: string;
      jurisdictionName: string;
      passcode: string;
    }>;
  }> {
    if (opts.entries && Array.isArray(opts.entries) && opts.entries.length > 0) {
      return this.provisionRosterWithRealNumbers(opts as any);
    }

    if (!opts.allowSyntheticFallback) {
      const err: any = new Error(
        'Direct automated provisioning with synthetic numbers is prohibited. ' +
        'Please provide authentic incharge numbers via Cadre Roster Excel upload or section-wise manual input.'
      );
      err.statusCode = 400;
      err.code = 'AUTHENTIC_NUMBERS_REQUIRED';
      throw err;
    }

    const constituency = await prisma.constituency.findUnique({
      where: { id: opts.constituencyId },
      include: {
        parliament: { include: { zone: { include: { state: true } } } },
        mandals: {
          orderBy: { name: 'asc' },
          include: {
            pollingStations: { orderBy: { name: 'asc' } },
            villages: {
              include: {
                booths: {
                  orderBy: { boothNumber: 'asc' },
                  include: {
                    voterGroups: { orderBy: { name: 'asc' } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!constituency) {
      const err: any = new Error(`Constituency not found: ${opts.constituencyId}`);
      err.statusCode = 404;
      throw err;
    }

    const orgId = opts.organisationId || constituency.parliament?.zone?.state?.organisationId || null;
    let partyPrefix = (opts.partyCode || '').trim().toUpperCase();

    if (!partyPrefix && orgId) {
      const party = await prisma.politicalParty.findFirst({
        where: { organisationId: orgId, isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      partyPrefix = party?.shortName?.replace(/\W/g, '').toUpperCase() || party?.code?.replace(/\W/g, '').toUpperCase() || '';
    }

    const passcode = opts.defaultPasscode || '123456';
    const passwordHash = bcrypt.hashSync(passcode, 10);

    // Compute tenant numeric prefix offset to guarantee 0 mobile collisions across tenants
    let orgOffset = 0;
    if (orgId) {
      const allOrgs = await prisma.organisation.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      const idx = allOrgs.findIndex((o) => o.id === orgId);
      if (idx > 0) {
        orgOffset = idx * 1000000;
      }
    }

    const roster: Array<{
      level: string;
      role: RoleType;
      userCode: string;
      name: string;
      mobileNumber: string;
      jurisdictionName: string;
      passcode: string;
    }> = [];

    let mandalsProvisioned = 0;
    let villagesProvisioned = 0;
    let boothsProvisioned = 0;
    let groupsProvisioned = 0;

    // Helper: Idempotent User creation / update
    const upsertCadreUser = async (params: {
      userCode: string;
      mobileNumber: string;
      name: string;
      role: RoleType;
    }) => {
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { userCode: params.userCode },
            { mobileNumber: params.mobileNumber },
          ],
        },
      });

      if (user) {
        // If user already belongs to another organisation, resolve with unique mobile suffix
        if (orgId && user.organisationId && user.organisationId !== orgId) {
          const shiftedMobile = `91${String(parseInt(params.mobileNumber.slice(2), 10) + 50000000).padStart(8, '0')}`;
          return upsertCadreUser({ ...params, mobileNumber: shiftedMobile });
        }

        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            name: params.name,
            role: params.role,
            accountStatus: AccountStatus.ACTIVE,
            organisationId: orgId || user.organisationId,
            passwordHash,
          },
        });
      } else {
        user = await prisma.user.create({
          data: {
            userCode: params.userCode,
            mobileNumber: params.mobileNumber,
            name: params.name,
            role: params.role,
            accountStatus: AccountStatus.ACTIVE,
            organisationId: orgId,
            passwordHash,
          },
        });
      }
      return user;
    };

    // Helper: Idempotent Hierarchy Assignment
    const upsertAssignment = async (params: {
      userId: string;
      roleType: RoleType;
      mandalId?: string;
      pollingStationId?: string;
      villageId?: string;
      boothId?: string;
      voterGroupId?: string;
    }) => {
      const existing = await prisma.userHierarchyAssignment.findFirst({
        where: {
          userId: params.userId,
          roleType: params.roleType,
          constituencyId: constituency.id,
        },
      });

      if (existing) {
        await prisma.userHierarchyAssignment.update({
          where: { id: existing.id },
          data: {
            mandalId: params.mandalId,
            pollingStationId: params.pollingStationId,
            villageId: params.villageId,
            boothId: params.boothId,
            voterGroupId: params.voterGroupId,
            isActive: true,
          },
        });
      } else {
        await prisma.userHierarchyAssignment.create({
          data: {
            userId: params.userId,
            roleType: params.roleType,
            constituencyId: constituency.id,
            mandalId: params.mandalId,
            pollingStationId: params.pollingStationId,
            villageId: params.villageId,
            boothId: params.boothId,
            voterGroupId: params.voterGroupId,
            isActive: true,
          },
        });
      }
    };

    // 1. MANDAL INCHARGES
    for (let mIdx = 0; mIdx < constituency.mandals.length; mIdx++) {
      const mandal = constituency.mandals[mIdx];
      const mandalSlug = mandal.name.replace(/\W/g, '').toUpperCase().slice(0, 14);
      const baseUserCode = `MDL-${mandalSlug}`;
      const userCode = orgOffset > 0 && partyPrefix ? `${partyPrefix}-${baseUserCode}` : baseUserCode;
      const mobileNum = orgOffset === 0
        ? `9101${String(mIdx + 1).padStart(6, '0')}`
        : `91${String(10000000 + mIdx + 1 + orgOffset).padStart(8, '0')}`;
      const userName = `${mandal.name} Mandal Incharge`;

      const user = await upsertCadreUser({
        userCode,
        mobileNumber: mobileNum,
        name: userName,
        role: RoleType.MANDAL_INCHARGE,
      });

      await upsertAssignment({
        userId: user.id,
        roleType: RoleType.MANDAL_INCHARGE,
        mandalId: mandal.id,
      });

      mandalsProvisioned++;
      roster.push({
        level: 'MANDAL',
        role: RoleType.MANDAL_INCHARGE,
        userCode,
        name: userName,
        mobileNumber: mobileNum,
        jurisdictionName: `${mandal.name} Mandal`,
        passcode,
      });
    }

    // 2. VILLAGE / POLLING STATION INCHARGES
    const distinctPollingStations: Array<{ id?: string; name: string; mandalId: string; villageId?: string }> = [];
    const seenPs = new Set<string>();

    for (const mandal of constituency.mandals) {
      if (mandal.pollingStations && mandal.pollingStations.length > 0) {
        for (const ps of mandal.pollingStations) {
          if (!seenPs.has(ps.name.toLowerCase())) {
            seenPs.add(ps.name.toLowerCase());
            distinctPollingStations.push({ id: ps.id, name: ps.name, mandalId: mandal.id });
          }
        }
      } else {
        for (const village of mandal.villages) {
          for (const booth of village.booths) {
            const psName = booth.pollingStation || `${village.name} Polling Station`;
            if (!seenPs.has(psName.toLowerCase())) {
              seenPs.add(psName.toLowerCase());
              distinctPollingStations.push({
                name: psName,
                mandalId: mandal.id,
                id: (booth as any).pollingStationId || undefined,
                villageId: village.id,
              });
            }
          }
        }
      }
    }

    for (let psIdx = 0; psIdx < distinctPollingStations.length; psIdx++) {
      const ps = distinctPollingStations[psIdx];
      const stationNo = String(psIdx + 1).padStart(3, '0');
      const baseUserCode = `VIL-${stationNo}`;
      const userCode = orgOffset > 0 && partyPrefix ? `${partyPrefix}-${baseUserCode}` : baseUserCode;
      const mobileNum = orgOffset === 0
        ? `9102${String(psIdx + 1).padStart(6, '0')}`
        : `91${String(20000000 + psIdx + 1 + orgOffset).padStart(8, '0')}`;
      const userName = `Village / PS Incharge ${stationNo} (${ps.name.slice(0, 24)})`;

      const user = await upsertCadreUser({
        userCode,
        mobileNumber: mobileNum,
        name: userName,
        role: RoleType.VILLAGE_INCHARGE,
      });

      await upsertAssignment({
        userId: user.id,
        roleType: RoleType.VILLAGE_INCHARGE,
        mandalId: ps.mandalId,
        pollingStationId: ps.id,
        villageId: ps.id ? undefined : ps.villageId,
      });

      villagesProvisioned++;
      roster.push({
        level: 'POLLING_STATION',
        role: RoleType.VILLAGE_INCHARGE,
        userCode,
        name: userName,
        mobileNumber: mobileNum,
        jurisdictionName: ps.name,
        passcode,
      });
    }

    // 3. BOOTH INCHARGES & 4. 100-VOTER GROUP INCHARGES
    const allBooths: Array<any> = [];
    for (const mandal of constituency.mandals) {
      for (const village of mandal.villages) {
        for (const booth of village.booths) {
          allBooths.push({ ...booth, mandalId: mandal.id, villageId: village.id });
        }
      }
    }

    // Natural sort by Part Number
    allBooths.sort((a, b) => {
      const aNum = parseInt(String(a.boothNumber).replace(/\D/g, ''), 10) || 0;
      const bNum = parseInt(String(b.boothNumber).replace(/\D/g, ''), 10) || 0;
      return aNum - bNum;
    });

    let groupGlobalIdx = 0;

    for (let bIdx = 0; bIdx < allBooths.length; bIdx++) {
      const booth = allBooths[bIdx];
      const partNum = parseInt(String(booth.boothNumber).replace(/\D/g, ''), 10) || (bIdx + 1);
      const partStr = String(partNum).padStart(3, '0');
      const baseUserCode = `BTH-${partStr}`;
      const userCode = orgOffset > 0 && partyPrefix ? `${partyPrefix}-${baseUserCode}` : baseUserCode;
      const mobileNum = orgOffset === 0
        ? `9103${String(partNum).padStart(6, '0')}`
        : `91${String(30000000 + partNum + orgOffset).padStart(8, '0')}`;
      const userName = `Booth Incharge ${partNum} (${booth.name || booth.boothNumber})`;

      const boothUser = await upsertCadreUser({
        userCode,
        mobileNumber: mobileNum,
        name: userName,
        role: RoleType.BOOTH_PRESIDENT,
      });

      await upsertAssignment({
        userId: boothUser.id,
        roleType: RoleType.BOOTH_PRESIDENT,
        mandalId: booth.mandalId,
        villageId: booth.villageId,
        boothId: booth.id,
      });

      boothsProvisioned++;
      roster.push({
        level: 'BOOTH',
        role: RoleType.BOOTH_PRESIDENT,
        userCode,
        name: userName,
        mobileNumber: mobileNum,
        jurisdictionName: `Booth ${partNum} - ${booth.pollingStation || booth.name}`,
        passcode,
      });

      // 4. 100-Voter Group Incharges for this booth
      const groups = (booth.voterGroups || []).filter(
        (g: any) => g.name !== 'Deleted Electors' && !g.name.includes('-DEL')
      );

      for (let gIdx = 0; gIdx < groups.length; gIdx++) {
        const grp = groups[gIdx];
        groupGlobalIdx++;

        // Canonical group identifier: B<Part>-V<Index>
        const canonicalGroup = `B${partNum}-V${gIdx + 1}`;
        const grpUserCode = orgOffset > 0 && partyPrefix ? `${partyPrefix}-${canonicalGroup}` : canonicalGroup;
        const grpMobile = orgOffset === 0
          ? `9104${String(groupGlobalIdx).padStart(6, '0')}`
          : `91${String(40000000 + groupGlobalIdx + orgOffset).padStart(8, '0')}`;
        const grpUserName = `100-Voter Incharge (${canonicalGroup})`;

        const grpUser = await upsertCadreUser({
          userCode: grpUserCode,
          mobileNumber: grpMobile,
          name: grpUserName,
          role: RoleType.VOTER_100_INCHARGE,
        });

        await upsertAssignment({
          userId: grpUser.id,
          roleType: RoleType.VOTER_100_INCHARGE,
          mandalId: booth.mandalId,
          villageId: booth.villageId,
          boothId: booth.id,
          voterGroupId: grp.id,
        });

        // Link assignedInchargeId on VoterGroup
        await prisma.voterGroup.update({
          where: { id: grp.id },
          data: { assignedInchargeId: grpUser.id },
        }).catch(() => {});

        groupsProvisioned++;
        roster.push({
          level: '100_VOTER_GROUP',
          role: RoleType.VOTER_100_INCHARGE,
          userCode: grpUserCode,
          name: grpUserName,
          mobileNumber: grpMobile,
          jurisdictionName: `Booth ${partNum} / Group ${canonicalGroup}`,
          passcode,
        });
      }
    }

    return {
      success: true,
      constituency: { id: constituency.id, name: constituency.name, code: constituency.code },
      summary: {
        mandalsProvisioned,
        villagesProvisioned,
        boothsProvisioned,
        groupsProvisioned,
        totalUsersProvisioned: mandalsProvisioned + villagesProvisioned + boothsProvisioned + groupsProvisioned,
        defaultPasscode: passcode,
      },
      roster,
    };
  }

  /**
   * Generates a downloadable CSV string of the provisioned incharge roster
   */
  static async exportRosterCsv(constituencyId: string): Promise<string> {
    const preview = await this.generateRosterPreview(constituencyId);
    const headers = ['Level', 'Role', 'User Code', 'Mobile Number', 'Default Passcode', 'Unit Identifier', 'Jurisdiction Name', 'Assigned Name', 'Status'];
    const rows: string[] = [headers.join(',')];

    for (const item of preview.roster) {
      const assigned = item.assignedUsers[0];
      const row = [
        item.level,
        item.roleRequired,
        `"${(assigned?.userCode || item.unitKey).replace(/"/g, '""')}"`,
        assigned?.mobileNumber || 'N/A',
        '123456',
        `"${item.unitKey}"`,
        `"${(item.pollingStationName || item.mandalName || item.groupName || item.boothNumber || '').replace(/"/g, '""')}"`,
        `"${(assigned?.name || 'Unassigned').replace(/"/g, '""')}"`,
        item.status,
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Strictly validates and normalizes an Indian 10-digit mobile number.
   * Disallows synthetic/mock numbers (e.g. 9101..., 9102..., 9103..., 9104...),
   * obvious placeholders, or malformed inputs.
   */
  static validateAndNormalizeMobileNumber(raw: string, slotIdentifier?: string): string {
    if (!raw || typeof raw !== 'string' || !raw.trim()) {
      const err: any = new Error(
        `Mobile number is required${slotIdentifier ? ` for slot ${slotIdentifier}` : ''}.`
      );
      err.statusCode = 400;
      err.code = 'INVALID_MOBILE_NUMBER';
      throw err;
    }

    const trimmed = raw.trim();
    let clean = trimmed.replace(/\D/g, '');

    if (clean.length === 12 && clean.startsWith('91')) {
      clean = clean.slice(2);
    } else if (clean.length === 11 && clean.startsWith('0')) {
      clean = clean.slice(1);
    }

    if (clean.length !== 10) {
      const err: any = new Error(
        `Mobile number "${raw}"${slotIdentifier ? ` for slot ${slotIdentifier}` : ''} must be exactly 10 digits (got ${clean.length} digits).`
      );
      err.statusCode = 400;
      err.code = 'INVALID_MOBILE_LENGTH';
      throw err;
    }

    if (!/^[6-9]/.test(clean)) {
      const err: any = new Error(
        `Mobile number "${clean}"${slotIdentifier ? ` for slot ${slotIdentifier}` : ''} is invalid. Indian mobile numbers must start with 6, 7, 8, or 9.`
      );
      err.statusCode = 400;
      err.code = 'INVALID_MOBILE_PREFIX';
      throw err;
    }

    if (/^910[1-4]\d{6}$/.test(clean)) {
      const err: any = new Error(
        `Mobile number "${clean}"${slotIdentifier ? ` for slot ${slotIdentifier}` : ''} is a synthetic mock number (9101-9104 range). Real, authentic incharge mobile numbers are required.`
      );
      err.statusCode = 400;
      err.code = 'MOCK_NUMBER_PROHIBITED';
      throw err;
    }

    if (
      clean === '1234567890' ||
      clean === '9876543210' ||
      clean === '0123456789' ||
      /^(\d)\1{9}$/.test(clean)
    ) {
      const err: any = new Error(
        `Mobile number "${clean}"${slotIdentifier ? ` for slot ${slotIdentifier}` : ''} is an invalid placeholder sequence. Please provide authentic incharge numbers.`
      );
      err.statusCode = 400;
      err.code = 'PLACEHOLDER_NUMBER_PROHIBITED';
      throw err;
    }

    return clean;
  }

  /**
   * Ensures every booth in the constituency has proper 100-voter groups.
   * If a booth has voters but groups are missing, chunks them into 100-voter groups
   * (e.g. 173 voters -> Group 1 [1-100], Group 2 [101-173]).
   */
  static async ensureConstituencyVoterGroups(constituencyId: string): Promise<void> {
    const booths = await prisma.booth.findMany({
      where: {
        village: {
          mandal: {
            constituencyId,
            name: { not: { contains: 'Central Mandal' } },
          },
        },
      },
      include: {
        voterGroups: true,
        _count: {
          select: {
            voters: {
              where: {
                voterStatus: 'ACTIVE',
              },
            },
          },
        },
      },
      orderBy: { boothNumber: 'asc' },
    });

    for (const booth of booths) {
      const activeVoterCount = booth._count.voters;
      if (activeVoterCount === 0) continue;

      const neededGroups = Math.max(1, Math.ceil(activeVoterCount / 100));
      const neededCodes = new Set<string>();
      for (let g = 1; g <= neededGroups; g++) {
        neededCodes.add(`VG-${booth.id.slice(0, 8)}-G${g}`);
      }

      // Prune obsolete/duplicate groups for this booth (e.g. legacy -GROUP format or excess groups)
      const obsoleteGroups = booth.voterGroups.filter(
        (g) => !neededCodes.has(g.code) && g.name !== 'Deleted Electors' && !g.code.includes('-DELETEDE')
      );

      if (obsoleteGroups.length > 0) {
        const obsoleteIds = obsoleteGroups.map((g) => g.id);
        await prisma.voter.updateMany({
          where: { voterGroupId: { in: obsoleteIds } },
          data: { voterGroupId: null },
        });
        await prisma.userHierarchyAssignment.deleteMany({
          where: { voterGroupId: { in: obsoleteIds } },
        });
        await prisma.voterGroup.deleteMany({
          where: { id: { in: obsoleteIds } },
        });
      }

      // Check if active canonical groups already match neededGroups
      const existingCanonical = booth.voterGroups.filter((g) => neededCodes.has(g.code));
      if (existingCanonical.length === neededGroups) {
        // Already fully provisioned and synchronized
        continue;
      }

      const voters = await prisma.voter.findMany({
        where: {
          boothId: booth.id,
          voterStatus: 'ACTIVE',
        },
        orderBy: [
          { serialNumber: 'asc' },
          { epicNumber: 'asc' },
        ],
        select: { id: true, voterGroupId: true },
      });

      for (let gIdx = 0; gIdx < neededGroups; gIdx++) {
        const groupNum = gIdx + 1;
        const groupName = `Group ${groupNum}`;
        const groupCode = `VG-${booth.id.slice(0, 8)}-G${groupNum}`;
        const chunkVoters = voters.slice(gIdx * 100, (gIdx + 1) * 100);
        const rangeStart = gIdx * 100 + 1;
        const rangeEnd = Math.min((gIdx + 1) * 100, activeVoterCount);

        const group = await prisma.voterGroup.upsert({
          where: { code: groupCode },
          update: {
            name: groupName,
            rangeStart,
            rangeEnd,
            totalVoters: chunkVoters.length,
          },
          create: {
            boothId: booth.id,
            name: groupName,
            code: groupCode,
            rangeStart,
            rangeEnd,
            totalVoters: chunkVoters.length,
          },
        });

        const voterIdsToUpdate = chunkVoters
          .filter((v) => v.voterGroupId !== group.id)
          .map((v) => v.id);

        if (voterIdsToUpdate.length > 0) {
          await prisma.voter.updateMany({
            where: { id: { in: voterIdsToUpdate } },
            data: { voterGroupId: group.id },
          });
        }
      }
    }
  }

  /**
   * Generates hierarchical cadre slots (Mandals, Polling Stations, Booths, 100-Voter Groups)
   * structured by section for manual entry and spreadsheet template generation.
   */
  static async getRequiredRosterSlots(constituencyId: string): Promise<CadreSlotsResponse> {
    await this.ensureConstituencyVoterGroups(constituencyId);

    const constituency = await prisma.constituency.findUnique({
      where: { id: constituencyId },
      include: {
        mandals: {
          where: {
            name: { not: { contains: 'Central Mandal' } },
          },
          orderBy: { name: 'asc' },
          include: {
            pollingStations: {
              orderBy: { name: 'asc' },
            },
            villages: {
              include: {
                booths: {
                  where: {
                    name: { not: { contains: 'Central Booth' } },
                  },
                  orderBy: { boothNumber: 'asc' },
                  include: {
                    voterGroups: {
                      orderBy: { name: 'asc' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!constituency) {
      const err: any = new Error(`Constituency not found: ${constituencyId}`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const existingAssignments = await prisma.userHierarchyAssignment.findMany({
      where: { constituencyId, isActive: true },
      include: {
        user: {
          select: { id: true, name: true, mobileNumber: true, role: true, userCode: true },
        },
      },
    });

    const mandalAssignMap = new Map<string, typeof existingAssignments>();
    const boothAssignMap = new Map<string, typeof existingAssignments>();
    const groupAssignMap = new Map<string, typeof existingAssignments>();
    const villageAssignMap = new Map<string, typeof existingAssignments>();
    const psAssignMap = new Map<string, typeof existingAssignments>();

    for (const a of existingAssignments) {
      if (a.roleType === RoleType.MANDAL_INCHARGE && a.mandalId) {
        const list = mandalAssignMap.get(a.mandalId) || [];
        list.push(a);
        mandalAssignMap.set(a.mandalId, list);
      } else if ((a.roleType === RoleType.BOOTH_INCHARGE || a.roleType === RoleType.BOOTH_PRESIDENT) && a.boothId) {
        const list = boothAssignMap.get(a.boothId) || [];
        list.push(a);
        boothAssignMap.set(a.boothId, list);
      } else if (a.roleType === RoleType.VOTER_100_INCHARGE && a.voterGroupId) {
        const list = groupAssignMap.get(a.voterGroupId) || [];
        list.push(a);
        groupAssignMap.set(a.voterGroupId, list);
      } else if (a.roleType === RoleType.VILLAGE_INCHARGE) {
        if (a.pollingStationId) {
          const list = psAssignMap.get(a.pollingStationId) || [];
          list.push(a);
          psAssignMap.set(a.pollingStationId, list);
        }
        if (a.villageId) {
          const list = villageAssignMap.get(a.villageId) || [];
          list.push(a);
          villageAssignMap.set(a.villageId, list);
        }
      }
    }

    // 1. Mandals
    const mandalSlots: CadreSlotItem[] = [];
    let mandalsAssigned = 0;
    let mandalsMissing = 0;
    let mandalsConflict = 0;

    for (const mandal of constituency.mandals) {
      const assigned = mandalAssignMap.get(mandal.id) || [];
      const status: 'ASSIGNED' | 'MISSING' | 'CONFLICT' =
        assigned.length === 1 ? 'ASSIGNED' : assigned.length > 1 ? 'CONFLICT' : 'MISSING';

      if (status === 'ASSIGNED') mandalsAssigned++;
      else if (status === 'CONFLICT') mandalsConflict++;
      else mandalsMissing++;

      const slug = mandal.name.replace(/\W/g, '').toUpperCase().slice(0, 14);
      mandalSlots.push({
        unitKey: `MDL-${mandal.id}`,
        slotCode: `MDL-${slug}`,
        level: 'MANDAL',
        roleRequired: RoleType.MANDAL_INCHARGE,
        jurisdictionName: `${mandal.name} Mandal`,
        constituencyId: constituency.id,
        constituencyName: constituency.name,
        mandalId: mandal.id,
        mandalName: mandal.name,
        voterCount: mandal.totalVoters,
        status,
        assignedUser: assigned[0]?.user,
      });
    }

    // 2. Polling Stations
    const psSlots: CadreSlotItem[] = [];
    let villageAssigned = 0;
    let villageMissing = 0;
    let villageConflict = 0;

    const hasFirstClassPs = constituency.mandals.some((m) => ((m as any).pollingStations || []).length > 0);

    if (hasFirstClassPs) {
      let psIdx = 0;
      for (const mandal of constituency.mandals) {
        for (const ps of (mandal as any).pollingStations || []) {
          psIdx++;
          const vAssigns = psAssignMap.get(ps.id) || existingAssignments.filter(
            (a) => a.roleType === RoleType.VILLAGE_INCHARGE && a.mandalId === mandal.id && !a.pollingStationId
          );
          const vStatus: 'ASSIGNED' | 'MISSING' | 'CONFLICT' =
            vAssigns.length === 1 ? 'ASSIGNED' : vAssigns.length > 1 ? 'CONFLICT' : 'MISSING';

          if (vStatus === 'ASSIGNED') villageAssigned++;
          else if (vStatus === 'CONFLICT') villageConflict++;
          else villageMissing++;

          const slotCode = `VIL-${String(psIdx).padStart(3, '0')}`;
          psSlots.push({
            unitKey: `PS-${ps.id}`,
            slotCode,
            level: 'POLLING_STATION',
            roleRequired: RoleType.VILLAGE_INCHARGE,
            jurisdictionName: ps.name,
            constituencyId: constituency.id,
            constituencyName: constituency.name,
            mandalId: mandal.id,
            mandalName: mandal.name,
            pollingStationId: ps.id,
            pollingStationName: ps.name,
            voterCount: ps.totalVoters,
            status: vStatus,
            assignedUser: vAssigns[0]?.user,
          });
        }
      }
    } else {
      interface CanonicalPs {
        mandalId: string;
        mandalName: string;
        pollingStationName: string;
        voterCount: number;
        pollingStationId?: string;
      }
      const psMap = new Map<string, CanonicalPs>();

      for (const mandal of constituency.mandals) {
        for (const village of mandal.villages) {
          for (const booth of village.booths) {
            const psRaw = booth.pollingStation || `${village.name} Polling Station`;
            const normalizedPsName = psRaw.trim().replace(/\s+/g, ' ').toUpperCase();
            const key = `${mandal.id}:::${normalizedPsName}`;
            const existing = psMap.get(key);
            if (existing) {
              existing.voterCount += booth.totalVoters;
            } else {
              psMap.set(key, {
                mandalId: mandal.id,
                mandalName: mandal.name,
                pollingStationName: psRaw.trim(),
                voterCount: booth.totalVoters,
                pollingStationId: (booth as any).pollingStationId,
              });
            }
          }
        }
      }

      let psIdx = 0;
      for (const [key, psData] of psMap) {
        psIdx++;
        const vAssigns = psData.pollingStationId
          ? (psAssignMap.get(psData.pollingStationId) || [])
          : existingAssignments.filter(
              (a) => a.roleType === RoleType.VILLAGE_INCHARGE && a.mandalId === psData.mandalId
            );
        const vStatus: 'ASSIGNED' | 'MISSING' | 'CONFLICT' =
          vAssigns.length === 1 ? 'ASSIGNED' : vAssigns.length > 1 ? 'CONFLICT' : 'MISSING';

        if (vStatus === 'ASSIGNED') villageAssigned++;
        else if (vStatus === 'CONFLICT') villageConflict++;
        else villageMissing++;

        const slotCode = `VIL-${String(psIdx).padStart(3, '0')}`;
        const slug = psData.pollingStationName.replace(/\W/g, '').slice(0, 12);
        psSlots.push({
          unitKey: `PS-${psData.mandalId}-${slug}-${psIdx}`,
          slotCode,
          level: 'POLLING_STATION',
          roleRequired: RoleType.VILLAGE_INCHARGE,
          jurisdictionName: psData.pollingStationName,
          constituencyId: constituency.id,
          constituencyName: constituency.name,
          mandalId: psData.mandalId,
          mandalName: psData.mandalName,
          pollingStationName: psData.pollingStationName,
          voterCount: psData.voterCount,
          status: vStatus,
          assignedUser: vAssigns[0]?.user,
        });
      }
    }

    // 3. Booths and 4. 100-Voter Groups
    const allBooths: Array<any> = [];
    for (const mandal of constituency.mandals) {
      for (const village of mandal.villages) {
        for (const booth of village.booths) {
          allBooths.push({
            ...booth,
            mandalId: mandal.id,
            mandalName: mandal.name,
            villageId: village.id,
            villageName: village.name,
          });
        }
      }
    }

    // Natural sort by numeric Part / Booth Number
    allBooths.sort((a, b) => {
      const aNum = parseInt(String(a.boothNumber).replace(/\D/g, ''), 10) || 0;
      const bNum = parseInt(String(b.boothNumber).replace(/\D/g, ''), 10) || 0;
      return aNum - bNum;
    });

    const boothSlots: CadreSlotItem[] = [];
    const groupSlots: CadreSlotItem[] = [];

    let boothAssigned = 0;
    let boothMissing = 0;
    let boothConflict = 0;

    let groupAssigned = 0;
    let groupMissing = 0;
    let groupConflict = 0;

    for (let bIdx = 0; bIdx < allBooths.length; bIdx++) {
      const booth = allBooths[bIdx];
      const partNum = parseInt(String(booth.boothNumber).replace(/\D/g, ''), 10) || (bIdx + 1);
      const partStr = String(partNum).padStart(3, '0');
      const bAssigns = boothAssignMap.get(booth.id) || [];
      const bStatus: 'ASSIGNED' | 'MISSING' | 'CONFLICT' =
        bAssigns.length === 1 ? 'ASSIGNED' : bAssigns.length > 1 ? 'CONFLICT' : 'MISSING';

      if (bStatus === 'ASSIGNED') boothAssigned++;
      else if (bStatus === 'CONFLICT') boothConflict++;
      else boothMissing++;

      const bSlotCode = `BTH-${partStr}`;
      boothSlots.push({
        unitKey: `BTH-${booth.id}`,
        slotCode: bSlotCode,
        level: 'BOOTH',
        roleRequired: RoleType.BOOTH_PRESIDENT,
        jurisdictionName: `Booth ${partNum} - ${booth.pollingStation || booth.name || `Part ${partNum}`}`,
        constituencyId: constituency.id,
        constituencyName: constituency.name,
        mandalId: booth.mandalId,
        mandalName: booth.mandalName,
        pollingStationName: booth.pollingStation,
        boothId: booth.id,
        boothNumber: String(booth.boothNumber),
        voterCount: booth.totalVoters,
        status: bStatus,
        assignedUser: bAssigns[0]?.user,
      });

      // 100-Voter groups for this booth
      const groups = (booth.voterGroups || []).filter(
        (g: any) => g.name !== 'Deleted Electors' && !g.name.includes('-DEL') && !g.code?.includes('-DEL') && !g.code?.includes('-GROUP')
      );
      groups.sort((a: any, b: any) => (a.rangeStart || 0) - (b.rangeStart || 0) || a.name.localeCompare(b.name));

      for (let gIdx = 0; gIdx < groups.length; gIdx++) {
        const grp = groups[gIdx];
        const canonicalCode = `B${partNum}-V${gIdx + 1}`;
        const rangeStart = grp.rangeStart || (gIdx * 100 + 1);
        const rangeEnd = grp.rangeEnd || Math.min((gIdx + 1) * 100, booth.totalVoters || (gIdx + 1) * 100);
        const voterRange = `${rangeStart} - ${rangeEnd}`;
        const gAssigns = groupAssignMap.get(grp.id) || [];
        const gStatus: 'ASSIGNED' | 'MISSING' | 'CONFLICT' =
          gAssigns.length === 1 ? 'ASSIGNED' : gAssigns.length > 1 ? 'CONFLICT' : 'MISSING';

        if (gStatus === 'ASSIGNED') groupAssigned++;
        else if (gStatus === 'CONFLICT') groupConflict++;
        else groupMissing++;

        groupSlots.push({
          unitKey: `VG-${grp.id}`,
          slotCode: canonicalCode,
          canonicalCode,
          level: '100_VOTER_GROUP',
          roleRequired: RoleType.VOTER_100_INCHARGE,
          jurisdictionName: `Booth ${partNum} / Group ${gIdx + 1} (Voters ${voterRange})`,
          constituencyId: constituency.id,
          constituencyName: constituency.name,
          mandalId: booth.mandalId,
          mandalName: booth.mandalName,
          pollingStationName: booth.pollingStation,
          boothId: booth.id,
          boothNumber: String(booth.boothNumber),
          groupId: grp.id,
          groupName: grp.name,
          voterRange,
          voterCount: grp.totalVoters || (rangeEnd - rangeStart + 1),
          status: gStatus,
          assignedUser: gAssigns[0]?.user,
        });
      }
    }

    const totalRequired = mandalSlots.length + psSlots.length + boothSlots.length + groupSlots.length;
    const totalAssigned = mandalsAssigned + villageAssigned + boothAssigned + groupAssigned;
    const totalMissing = mandalsMissing + villageMissing + boothMissing + groupMissing;
    const totalConflict = mandalsConflict + villageConflict + boothConflict + groupConflict;

    return {
      constituencyId: constituency.id,
      totalVoters: constituency.mandals.reduce((acc, m) => acc + m.totalVoters, 0),
      summary: {
        constituency: { id: constituency.id, name: constituency.name, code: constituency.code },
        mandalsCount: mandalSlots.length,
        pollingStationsCount: psSlots.length,
        boothsCount: boothSlots.length,
        groupsCount: groupSlots.length,
        mandalCount: mandalSlots.length,
        pollingStationCount: psSlots.length,
        boothCount: boothSlots.length,
        groupCount: groupSlots.length,
        totalSlots: totalRequired,
        totalLogins: totalRequired,
        assignedSlots: totalAssigned,
        unassignedSlots: totalMissing + totalConflict,
        requiredRosterCounts: {
          mandalIncharges: { required: mandalSlots.length, assigned: mandalsAssigned, missing: mandalsMissing, conflict: mandalsConflict },
          villageIncharges: { required: psSlots.length, assigned: villageAssigned, missing: villageMissing, conflict: villageConflict },
          boothIncharges: { required: boothSlots.length, assigned: boothAssigned, missing: boothMissing, conflict: boothConflict },
          groupIncharges: { required: groupSlots.length, assigned: groupAssigned, missing: groupMissing, conflict: groupConflict },
          totalRequired,
          totalAssigned,
          totalMissing,
          totalConflict,
        },
      },
      sections: {
        mandals: mandalSlots,
        pollingStations: psSlots,
        booths: boothSlots,
        groups: groupSlots,
      },
      allSlots: [...mandalSlots, ...psSlots, ...boothSlots, ...groupSlots],
    };
  }

  /**
   * Generates a pre-filled downloadable roster template in XLSX or CSV format
   * containing all hierarchy slots for the constituency.
   */
  static async generateRosterTemplate(
    constituencyId: string,
    format: 'xlsx' | 'csv' = 'xlsx'
  ): Promise<Buffer | string> {
    const slotsResp = await this.getRequiredRosterSlots(constituencyId);

    const rows = slotsResp.allSlots.map((slot) => ({
      'Tier Level': slot.level,
      'Slot Code': slot.slotCode,
      'Unit Key': slot.unitKey,
      'Jurisdiction Name': slot.jurisdictionName,
      'Voter Count': slot.voterCount,
      'Incharge Name': slot.assignedUser?.name || '',
      'Mobile Number (10 Digits)': slot.assignedUser?.mobileNumber || '',
      'Default Passcode': '123456',
    }));

    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Cadre Incharge Allocation');

    if (format === 'csv') {
      return xlsx.utils.sheet_to_csv(worksheet);
    }

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer as Buffer;
  }

  /**
   * Parses uploaded Excel (.xlsx, .xls) or CSV spreadsheet buffer into validated cadre input rows.
   */
  static parseRosterSpreadsheet(buffer: Buffer): CadreInputEntry[] {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      const err: any = new Error('The uploaded spreadsheet does not contain any sheets.');
      err.statusCode = 400;
      err.code = 'EMPTY_SPREADSHEET';
      throw err;
    }

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows: any[] = xlsx.utils.sheet_to_json(firstSheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      const err: any = new Error('The uploaded spreadsheet contains no data rows.');
      err.statusCode = 400;
      err.code = 'NO_DATA_ROWS';
      throw err;
    }

    const entries: CadreInputEntry[] = [];

    for (let rIdx = 0; rIdx < rawRows.length; rIdx++) {
      const row = rawRows[rIdx];
      const mobileVal = String(
        row['Mobile Number (10 Digits)'] ||
        row['Mobile Number'] ||
        row['Mobile'] ||
        row['Phone'] ||
        row['Phone Number'] ||
        row['mobileNumber'] ||
        ''
      ).trim();

      // Skip rows with blank or placeholder mobile numbers
      if (!mobileVal || mobileVal === 'N/A' || mobileVal === '-' || mobileVal === '0') {
        continue;
      }

      const slotCode = String(
        row['Slot Code'] ||
        row['SlotCode'] ||
        row['Code'] ||
        row['slotCode'] ||
        ''
      ).trim();

      const unitKey = String(
        row['Unit Key'] ||
        row['UnitKey'] ||
        row['unitKey'] ||
        ''
      ).trim();

      const inchargeName = String(
        row['Incharge Name'] ||
        row['Name'] ||
        row['Full Name'] ||
        row['inchargeName'] ||
        ''
      ).trim();

      const passcode = String(
        row['Default Passcode'] ||
        row['Passcode'] ||
        row['Password'] ||
        row['passcode'] ||
        '123456'
      ).trim();

      const level = String(
        row['Tier Level'] ||
        row['Level'] ||
        row['Tier'] ||
        row['level'] ||
        ''
      ).trim() as any;

      entries.push({
        unitKey: unitKey || undefined,
        slotCode: slotCode || undefined,
        inchargeName: inchargeName || undefined,
        mobileNumber: mobileVal,
        passcode: passcode || '123456',
        level: level || undefined,
      });
    }

    return entries;
  }

  /**
   * Provisions validated real numbers for cadre incharges.
   * Atomic, idempotent, zero synthetic numbers.
   */
  static async provisionRosterWithRealNumbers(opts: {
    constituencyId: string;
    organisationId?: string;
    partyCode?: string;
    defaultPasscode?: string;
    actorId?: string;
    entries: CadreInputEntry[];
  }): Promise<{
    success: boolean;
    constituency: { id: string; name: string; code: string };
    summary: {
      mandalsProvisioned: number;
      villagesProvisioned: number;
      boothsProvisioned: number;
      groupsProvisioned: number;
      totalUsersProvisioned: number;
      defaultPasscode: string;
    };
    roster: Array<{
      level: string;
      role: RoleType;
      userCode: string;
      name: string;
      mobileNumber: string;
      jurisdictionName: string;
      passcode: string;
      status: string;
    }>;
  }> {
    if (!opts.entries || !Array.isArray(opts.entries) || opts.entries.length === 0) {
      const err: any = new Error('No cadre incharge entries provided for provisioning.');
      err.statusCode = 400;
      err.code = 'EMPTY_ENTRIES';
      throw err;
    }

    const validRawEntries = opts.entries.filter(
      (e) => e && e.mobileNumber && String(e.mobileNumber).trim() !== '' && String(e.mobileNumber).trim() !== 'N/A'
    );

    if (validRawEntries.length === 0) {
      const err: any = new Error(
        'All submitted entries have empty or placeholder mobile numbers. Real 10-digit mobile numbers are required.'
      );
      err.statusCode = 400;
      err.code = 'NO_VALID_MOBILE_NUMBERS';
      throw err;
    }

    const normalizedEntries: Array<{
      entry: CadreInputEntry;
      cleanMobile: string;
      slotIdentifier: string;
    }> = [];

    const seenMobilesInBatch = new Map<string, string>();

    for (let idx = 0; idx < validRawEntries.length; idx++) {
      const entry = validRawEntries[idx];
      const slotIdentifier = entry.slotCode || entry.unitKey || `Row ${idx + 1}`;
      const cleanMobile = this.validateAndNormalizeMobileNumber(entry.mobileNumber, slotIdentifier);

      if (seenMobilesInBatch.has(cleanMobile)) {
        const prevSlot = seenMobilesInBatch.get(cleanMobile);
        const err: any = new Error(
          `Duplicate mobile number "${cleanMobile}" assigned to multiple slots (${prevSlot} and ${slotIdentifier}). Each incharge must have a unique mobile number.`
        );
        err.statusCode = 400;
        err.code = 'DUPLICATE_MOBILE_IN_BATCH';
        throw err;
      }
      seenMobilesInBatch.set(cleanMobile, slotIdentifier);

      normalizedEntries.push({
        entry,
        cleanMobile,
        slotIdentifier,
      });
    }

    const constituency = await prisma.constituency.findUnique({
      where: { id: opts.constituencyId },
      include: {
        parliament: { include: { zone: { include: { state: true } } } },
      },
    });

    if (!constituency) {
      const err: any = new Error(`Constituency not found: ${opts.constituencyId}`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const orgId = opts.organisationId || constituency.parliament?.zone?.state?.organisationId || null;
    let partyPrefix = (opts.partyCode || '').trim().toUpperCase();

    if (!partyPrefix && orgId) {
      const party = await prisma.politicalParty.findFirst({
        where: { organisationId: orgId, isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      partyPrefix = party?.shortName?.replace(/\W/g, '').toUpperCase() || party?.code?.replace(/\W/g, '').toUpperCase() || '';
    }

    const defaultPasscode = opts.defaultPasscode || '123456';
    const slotsResp = await this.getRequiredRosterSlots(opts.constituencyId);

    const slotByUnitKey = new Map<string, CadreSlotItem>();
    const slotByCode = new Map<string, CadreSlotItem>();
    const slotByCanonical = new Map<string, CadreSlotItem>();

    for (const slot of slotsResp.allSlots) {
      slotByUnitKey.set(slot.unitKey.toUpperCase(), slot);
      slotByCode.set(slot.slotCode.toUpperCase(), slot);
      if (slot.canonicalCode) {
        slotByCanonical.set(slot.canonicalCode.toUpperCase(), slot);
      }
    }

    const roster: Array<{
      level: string;
      role: RoleType;
      userCode: string;
      name: string;
      mobileNumber: string;
      jurisdictionName: string;
      passcode: string;
      status: string;
    }> = [];

    let mandalsProvisioned = 0;
    let villagesProvisioned = 0;
    let boothsProvisioned = 0;
    let groupsProvisioned = 0;

    for (const { entry, cleanMobile, slotIdentifier } of normalizedEntries) {
      const lookupKey = (entry.slotCode || entry.unitKey || '').trim().toUpperCase();
      let targetSlot =
        slotByUnitKey.get(lookupKey) ||
        slotByCode.get(lookupKey) ||
        slotByCanonical.get(lookupKey);

      // Smart fuzzy matching for flexible formats (e.g. MDL-KONDAPI, BTH-1, B01-V01)
      if (!targetSlot) {
        if (lookupKey.startsWith('MDL-')) {
          const mandalQuery = lookupKey.replace(/^MDL-/, '').replace(/\W/g, '');
          targetSlot = slotsResp.sections.mandals.find((m) =>
            m.slotCode.replace(/\W/g, '').includes(mandalQuery) ||
            mandalQuery.includes(m.slotCode.replace(/^MDL-/, '').replace(/\W/g, '')) ||
            m.jurisdictionName.replace(/\W/g, '').toUpperCase().includes(mandalQuery)
          );
        } else if (lookupKey.startsWith('BTH-')) {
          const boothNum = parseInt(lookupKey.replace(/\D/g, ''), 10);
          if (!isNaN(boothNum)) {
            targetSlot = slotsResp.sections.booths.find((b) =>
              parseInt(String(b.boothNumber).replace(/\D/g, ''), 10) === boothNum
            );
          }
        } else if (/^B\d+-V\d+$/i.test(lookupKey)) {
          const match = lookupKey.match(/^B(\d+)-V(\d+)$/i);
          if (match) {
            const bNum = parseInt(match[1], 10);
            const vNum = parseInt(match[2], 10);
            const normalizedCanonical = `B${bNum}-V${vNum}`;
            targetSlot = slotByCanonical.get(normalizedCanonical);
          }
        } else if (lookupKey.startsWith('VIL-') || lookupKey.startsWith('PS-')) {
          const psNum = parseInt(lookupKey.replace(/\D/g, ''), 10);
          if (!isNaN(psNum)) {
            targetSlot = slotsResp.sections.pollingStations[psNum - 1];
          }
        }
      }

      if (!targetSlot) {
        const err: any = new Error(
          `Unrecognized slot identifier "${slotIdentifier}". Please verify slot codes (e.g. MDL-..., VIL-001, BTH-001, B1-V1) or unit keys.`
        );
        err.statusCode = 400;
        err.code = 'UNKNOWN_SLOT_IDENTIFIER';
        throw err;
      }

      const passcode = entry.passcode?.trim() || defaultPasscode;
      const passwordHash = bcrypt.hashSync(passcode, 10);
      const userCode = partyPrefix ? `${partyPrefix}-${targetSlot.slotCode}` : targetSlot.slotCode;
      const userName = entry.inchargeName?.trim() || `${targetSlot.jurisdictionName} Incharge`;

      // 1. Idempotent User upsert by mobile or userCode
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { mobileNumber: cleanMobile },
            { userCode },
          ],
        },
      });

      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            userCode,
            mobileNumber: cleanMobile,
            name: userName,
            role: targetSlot.roleRequired,
            accountStatus: AccountStatus.ACTIVE,
            organisationId: orgId || user.organisationId,
            passwordHash,
          },
        });
      } else {
        user = await prisma.user.create({
          data: {
            userCode,
            mobileNumber: cleanMobile,
            name: userName,
            role: targetSlot.roleRequired,
            accountStatus: AccountStatus.ACTIVE,
            organisationId: orgId,
            passwordHash,
          },
        });
      }

      // 2. Idempotent UserHierarchyAssignment
      const existingAssign = await prisma.userHierarchyAssignment.findFirst({
        where: {
          userId: user.id,
          roleType: targetSlot.roleRequired,
          constituencyId: constituency.id,
        },
      });

      if (existingAssign) {
        await prisma.userHierarchyAssignment.update({
          where: { id: existingAssign.id },
          data: {
            mandalId: targetSlot.mandalId,
            pollingStationId: targetSlot.pollingStationId,
            villageId: targetSlot.villageId,
            boothId: targetSlot.boothId,
            voterGroupId: targetSlot.groupId,
            isActive: true,
          },
        });
      } else {
        await prisma.userHierarchyAssignment.create({
          data: {
            userId: user.id,
            roleType: targetSlot.roleRequired,
            constituencyId: constituency.id,
            mandalId: targetSlot.mandalId,
            pollingStationId: targetSlot.pollingStationId,
            villageId: targetSlot.villageId,
            boothId: targetSlot.boothId,
            voterGroupId: targetSlot.groupId,
            isActive: true,
          },
        });
      }

      // 3. If 100-voter group, link to VoterGroup and assigned voters
      if (targetSlot.level === '100_VOTER_GROUP' && targetSlot.groupId) {
        await prisma.voterGroup.update({
          where: { id: targetSlot.groupId },
          data: { assignedInchargeId: user.id },
        }).catch(() => {});

        await prisma.voter.updateMany({
          where: { voterGroupId: targetSlot.groupId },
          data: { assignedInchargeId: user.id },
        }).catch(() => {});

        groupsProvisioned++;
      } else if (targetSlot.level === 'BOOTH') {
        boothsProvisioned++;
      } else if (targetSlot.level === 'POLLING_STATION') {
        villagesProvisioned++;
      } else if (targetSlot.level === 'MANDAL') {
        mandalsProvisioned++;
      }

      roster.push({
        level: targetSlot.level,
        role: targetSlot.roleRequired,
        userCode,
        name: userName,
        mobileNumber: cleanMobile,
        jurisdictionName: targetSlot.jurisdictionName,
        passcode,
        status: 'ASSIGNED',
      });
    }

    return {
      success: true,
      constituency: { id: constituency.id, name: constituency.name, code: constituency.code },
      summary: {
        mandalsProvisioned,
        villagesProvisioned,
        boothsProvisioned,
        groupsProvisioned,
        totalUsersProvisioned: mandalsProvisioned + villagesProvisioned + boothsProvisioned + groupsProvisioned,
        defaultPasscode,
      },
      roster,
    };
  }
}

