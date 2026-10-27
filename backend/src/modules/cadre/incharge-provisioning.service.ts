import { RoleType, AccountStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';

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
}

