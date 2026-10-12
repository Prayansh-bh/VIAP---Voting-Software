import { AuditAction, FakeVoterStatus, NotificationType, Prisma, VoterLocationStatus, VoterStatus, VoteStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { logAudit } from '../../middleware/audit.js';
import { emitHierarchyEvent } from '../../lib/socket.js';
import {
  CreateVoterDto,
  FlagFakeVoterDto,
  UpdateMigrationDto,
  UpdateVoterDto,
  UpdateVoterStatusDto,
  VoterQueryDto,
} from './voters.schema.js';

export class VotersService {
  static async listVoters(query: VoterQueryDto, scope?: import('../../common/types.js').UserHierarchyScope) {
    const {
      page,
      limit,
      search,
      epicNumber,
      name,
      mobileNumber,
      serialNumber,
      houseNumber,
      constituencyId,
      mandalId,
      villageId,
      boothId,
      voterGroupId,
      unitId,
      assignedInchargeId,
      voterStatus,
      surveyStatus,
      voteStatus,
      voterLocationStatus,
      politicalPreference,
      caste,
      sortBy,
      sortOrder,
    } = query;

    const skip = (page - 1) * limit;
    const where: Prisma.VoterWhereInput = {};

    // Specific field filters
    if (epicNumber) where.epicNumber = { contains: epicNumber, mode: 'insensitive' };
    if (name) where.name = { contains: name, mode: 'insensitive' };
    if (mobileNumber) where.mobileNumber = { contains: mobileNumber };
    if (serialNumber !== undefined) where.serialNumber = serialNumber;
    if (houseNumber) where.houseNumber = { contains: houseNumber, mode: 'insensitive' };

    // Hierarchy & Status Filters
    if (constituencyId) {
      if (scope && !scope.isGlobalScope && !scope.accessibleConstituencyIds.has(constituencyId)) {
        where.constituencyId = '00000000-0000-0000-0000-000000000000';
      } else {
        where.constituencyId = constituencyId;
      }
    }
    if (mandalId) {
      if (scope && !scope.isGlobalScope && !scope.accessibleMandalIds.has(mandalId)) {
        where.mandalId = '00000000-0000-0000-0000-000000000000';
      } else {
        where.mandalId = mandalId;
      }
    }
    if (villageId) {
      if (scope && !scope.isGlobalScope && !scope.accessibleVillageIds.has(villageId)) {
        where.villageId = '00000000-0000-0000-0000-000000000000';
      } else {
        where.villageId = villageId;
      }
    }
    if (boothId) {
      if (scope && !scope.isGlobalScope && !scope.accessibleBoothIds.has(boothId)) {
        where.boothId = '00000000-0000-0000-0000-000000000000';
      } else {
        where.boothId = boothId;
      }
    }
    if (voterGroupId) {
      if (scope && !scope.isGlobalScope && !scope.accessibleVoterGroupIds.has(voterGroupId)) {
        where.voterGroupId = '00000000-0000-0000-0000-000000000000';
      } else {
        where.voterGroupId = voterGroupId;
      }
    }
    if (assignedInchargeId) where.assignedInchargeId = assignedInchargeId;
    if (voterStatus) where.voterStatus = voterStatus;
    if (surveyStatus) where.surveyStatus = surveyStatus;
    if (voteStatus) where.voteStatus = voteStatus;
    if (voterLocationStatus) where.voterLocationStatus = voterLocationStatus;
    if (politicalPreference) where.politicalPreference = politicalPreference;
    if (caste) where.caste = caste;

    // Enforce Hierarchy Authorization Scope
    if (scope && !scope.isGlobalScope) {
      if (scope.role === 'VOTER_100_INCHARGE') {
        const groupIds = Array.from(scope.accessibleVoterGroupIds);
        if (groupIds.length > 0) {
          where.OR = [
            { voterGroupId: { in: groupIds } },
            { assignedInchargeId: scope.userId },
          ];
        } else {
          where.assignedInchargeId = scope.userId;
        }
      } else if (scope.role === 'BOOTH_PRESIDENT' || scope.role === 'BOOTH_INCHARGE') {
        if (!boothId) where.boothId = { in: Array.from(scope.accessibleBoothIds) };
      } else if (scope.role === 'VILLAGE_INCHARGE') {
        if (!villageId) where.villageId = { in: Array.from(scope.accessibleVillageIds) };
      } else if (scope.role === 'MANDAL_INCHARGE') {
        if (!mandalId) where.mandalId = { in: Array.from(scope.accessibleMandalIds) };
      } else if (scope.role === 'CONSTITUENCY_INCHARGE' || scope.role === 'VIEWER') {
        if (!constituencyId) where.constituencyId = { in: Array.from(scope.accessibleConstituencyIds) };
      } else if (scope.role === 'PARLIAMENT_INCHARGE') {
        where.parliamentId = { in: Array.from(scope.accessibleParliamentIds) };
      } else if (scope.role === 'ZONE_INCHARGE') {
        where.zoneId = { in: Array.from(scope.accessibleZoneIds) };
      } else if (scope.role === 'STATE_ADMIN' || scope.role === 'HIGH_COMMAND') {
        where.stateId = { in: Array.from(scope.accessibleStateIds) };
      } else if (scope.accessibleUnitIds.size > 0) {
        where.unitId = { in: Array.from(scope.accessibleUnitIds) };
      }
    } else if (unitId) {
      where.unitId = unitId;
    }

    if (search) {
      const isNum = !isNaN(Number(search));
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { epicNumber: { contains: search, mode: 'insensitive' } },
        { fatherHusbandName: { contains: search, mode: 'insensitive' } },
        { houseNumber: { contains: search, mode: 'insensitive' } },
        { mobileNumber: { contains: search } },
        ...(isNum ? [{ serialNumber: Number(search) }] : []),
      ];
    }

    const [total, items] = await Promise.all([
      prisma.voter.count({ where }),
      prisma.voter.findMany({
        where,
        skip,
        take: limit,
        include: {
          constituency: true,
          mandal: true,
          village: true,
          booth: true,
          voterGroup: true,
          assignedIncharge: true,
          fakeVoterFlags: { where: { status: FakeVoterStatus.FLAGGED } },
        },
        orderBy: { [sortBy]: sortOrder },
      }),
    ]);

    return { total, items, page, limit };
  }

  static async getVoterById(id: string) {
    const voter = await prisma.voter.findUnique({
      where: { id },
      include: {
        constituency: true,
        mandal: true,
        village: true,
        booth: true,
        voterGroup: true,
        assignedIncharge: true,
        casteCategory: true,
        voterCaste: true,
        fakeVoterFlags: true,
        migrations: true,
        voteTrackings: { orderBy: { markedAt: 'desc' } },
        statusHistory: { orderBy: { changedAt: 'desc' } },
      },
    });

    if (!voter) throw new Error('Voter record not found');
    return voter;
  }

  static async createVoter(dto: CreateVoterDto, actorId: string) {
    // 1. Prevent duplicate EPIC numbers
    const duplicate = await prisma.voter.findUnique({
      where: { epicNumber: dto.epicNumber },
    });
    if (duplicate) {
      const err: any = new Error(`Voter with EPIC number "${dto.epicNumber}" already exists`);
      err.statusCode = 409;
      err.code = 'DUPLICATE_EPIC_NUMBER';
      throw err;
    }

    let constituencyId = dto.constituencyId;
    let mandalId = dto.mandalId;
    let villageId = dto.villageId;
    let boothId = dto.boothId;
    let voterGroupId = dto.voterGroupId;
    let unitId = dto.unitId;

    // Resolve hierarchy tree if booth is provided
    if (boothId && (!villageId || !mandalId || !constituencyId)) {
      const b = await prisma.booth.findUnique({
        where: { id: boothId },
        include: { village: { include: { mandal: true } } },
      });
      if (b) {
        villageId = villageId || b.villageId;
        mandalId = mandalId || b.village.mandalId;
        constituencyId = constituencyId || b.village.mandal.constituencyId;
      }
    }

    const voter = await prisma.voter.create({
      data: {
        serialNumber: dto.serialNumber ?? 1,
        epicNumber: dto.epicNumber,
        name: dto.name,
        fatherHusbandName: dto.fatherHusbandName,
        relationType: dto.relationType,
        houseNumber: dto.houseNumber,
        age: dto.age,
        gender: dto.gender,
        mobileNumber: dto.mobileNumber,
        constituencyId,
        mandalId,
        villageId,
        boothId,
        voterGroupId,
        unitId,
        assignedInchargeId: dto.assignedInchargeId,
        caste: dto.caste,
        subCaste: dto.subCaste,
        profession: dto.profession,
        politicalPreference: dto.politicalPreference,
        voterStatus: dto.voterStatus,
        surveyStatus: dto.surveyStatus,
        voterLocationStatus: dto.voterLocationStatus,
        currentLocation: dto.currentLocation,
        notes: dto.notes,
      },
    });

    await logAudit({
      action: AuditAction.CREATE,
      entityType: 'Voter',
      entityId: voter.id,
      userId: actorId,
      unitId: voter.unitId ?? undefined,
      changes: dto as unknown as Prisma.InputJsonValue,
    });

    return voter;
  }

  static async updateVoter(id: string, dto: UpdateVoterDto, actorId: string) {
    const existing = await prisma.voter.findUnique({ where: { id } });
    if (!existing) throw new Error('Voter not found');

    // 1. Prevent duplicate EPIC numbers if changed
    if (dto.epicNumber && dto.epicNumber !== existing.epicNumber) {
      const duplicate = await prisma.voter.findUnique({
        where: { epicNumber: dto.epicNumber },
      });
      if (duplicate && duplicate.id !== id) {
        const err: any = new Error(`Voter with EPIC number "${dto.epicNumber}" already exists`);
        err.statusCode = 409;
        err.code = 'DUPLICATE_EPIC_NUMBER';
        throw err;
      }
    }

    // 2. Automatically record status change history
    if (dto.voterStatus && dto.voterStatus !== existing.voterStatus) {
      await prisma.voterStatusHistory.create({
        data: {
          voterId: id,
          previousStatus: existing.voterStatus,
          newStatus: dto.voterStatus,
          reason: dto.notes || 'Updated via voter profile',
          changedById: actorId,
        },
      });
    }

    const voter = await prisma.voter.update({
      where: { id },
      data: dto,
    });

    await logAudit({
      action: AuditAction.UPDATE,
      entityType: 'Voter',
      entityId: voter.id,
      userId: actorId,
      unitId: voter.unitId ?? undefined,
      changes: dto as unknown as Prisma.InputJsonValue,
    });

    return voter;
  }

  static async updateVoterStatus(id: string, dto: UpdateVoterStatusDto, actorId: string) {
    const existing = await prisma.voter.findUnique({ where: { id } });
    if (!existing) throw new Error('Voter not found');

    const voter = await prisma.voter.update({
      where: { id },
      data: { voterStatus: dto.status },
    });

    await prisma.voterStatusHistory.create({
      data: {
        voterId: id,
        previousStatus: existing.voterStatus,
        newStatus: dto.status,
        reason: dto.reason,
        changedById: actorId,
      },
    });

    await logAudit({
      action: AuditAction.STATUS_CHANGE,
      entityType: 'Voter',
      entityId: voter.id,
      userId: actorId,
      unitId: voter.unitId ?? undefined,
      changes: { previous: existing.voterStatus, next: dto.status, reason: dto.reason },
    });

    return voter;
  }

  static async flagFakeVoter(id: string, dto: FlagFakeVoterDto, actorId: string) {
    const voter = await prisma.voter.findUnique({ where: { id } });
    if (!voter) throw new Error('Voter not found');

    const flag = await prisma.fakeVoterFlag.create({
      data: {
        voterId: id,
        reason: dto.reason,
        evidenceUrl: dto.evidenceUrl,
        status: dto.status,
        flaggedById: actorId,
      },
    });

    await prisma.voter.update({
      where: { id },
      data: { voterStatus: VoterStatus.FAKE },
    });

    await logAudit({
      action: AuditAction.UPDATE,
      entityType: 'FakeVoterFlag',
      entityId: flag.id,
      userId: actorId,
      unitId: voter.unitId ?? undefined,
      changes: dto as unknown as Prisma.InputJsonValue,
    });

    if (voter.unitId) {
      await emitHierarchyEvent(voter.unitId, 'voter:flagged-fake', {
        voterId: voter.id,
        epicNumber: voter.epicNumber,
        reason: dto.reason,
      });
    }

    return flag;
  }

  static async markVoteDone(id: string, actorId: string) {
    const existing = await prisma.voter.findUnique({
      where: { id },
      include: { unit: true },
    });
    if (!existing) throw new Error('Voter not found');

    // Duplicate Prevention: If already voted, return existing record without double-incrementing
    if (existing.voteStatus === VoteStatus.VOTE_DONE) {
      return existing;
    }

    const now = new Date();

    // Execute atomic transaction for voter state, tracking record, and event log
    const [voter, voteTracking, liveEvent] = await prisma.$transaction(async (tx) => {
      const updated = await tx.voter.update({
        where: { id },
        data: {
          voteStatus: VoteStatus.VOTE_DONE,
          voteDoneTime: now,
        },
      });

      const tracking = await tx.voteTracking.create({
        data: {
          voterId: id,
          status: VoteStatus.VOTE_DONE,
          markedById: actorId,
          markedAt: now,
          verificationMethod: 'INCHARGE_CONFIRMATION',
        },
      });

      const event = await tx.liveVoteEvent.create({
        data: {
          voterId: id,
          unitId: updated.unitId,
          inchargeId: actorId,
          previousStatus: existing.voteStatus,
          nextStatus: VoteStatus.VOTE_DONE,
          changedAt: now,
        },
      });

      // Invalidate aggregate cache for this unit so fresh aggregations compute instantly
      if (updated.unitId) {
        await tx.aggregateCache.deleteMany({
          where: { unitId: updated.unitId },
        });
      }

      return [updated, tracking, event];
    });

    await logAudit({
      action: AuditAction.UPDATE,
      entityType: 'VoteTracking',
      entityId: id,
      userId: actorId,
      unitId: voter.unitId ?? undefined,
      changes: {
        action: 'MARK_VOTE_DONE',
        previousStatus: existing.voteStatus,
        nextStatus: VoteStatus.VOTE_DONE,
        timestamp: now,
      },
    });

    // Real-Time Upward Hierarchy Broadcasting:
    // Voter -> 100-Voter Incharge -> Booth -> Village -> Mandal -> Constituency -> Parliament -> Zone -> State
    if (voter.unitId) {
      const actor = await prisma.user.findUnique({
        where: { id: actorId },
        select: { id: true, userCode: true, name: true, role: true },
      });

      const payload = {
        id: liveEvent.id,
        previousStatus: existing.voteStatus,
        nextStatus: VoteStatus.VOTE_DONE,
        changedAt: now.toISOString(),
        voter: {
          id: voter.id,
          name: voter.name,
          epicNumber: voter.epicNumber,
          politicalPreference: voter.politicalPreference,
        },
        unit: {
          id: existing.unit?.id || voter.unitId,
          name: existing.unit?.name || '',
          level: existing.unit?.level || 'VOTER_GROUP',
        },
        incharge: {
          id: actor?.id || actorId,
          userCode: actor?.userCode || 'INCHARGE',
          name: actor?.name || 'In-Charge',
        },
      };

      await emitHierarchyEvent(voter.unitId, 'vote:event', payload);
      await emitHierarchyEvent(voter.unitId, 'summary:invalidate', {
        unitId: voter.unitId,
        delta: 1,
        voterId: voter.id,
        timestamp: now.toISOString(),
      });
    }

    return voter;
  }

  static async markNotVoted(id: string, actorId: string) {
    const existing = await prisma.voter.findUnique({
      where: { id },
      include: { unit: true },
    });
    if (!existing) throw new Error('Voter not found');

    // Duplicate Prevention: If already NOT_VOTED, do not decrement again
    if (existing.voteStatus === VoteStatus.NOT_VOTED) {
      return existing;
    }

    const now = new Date();

    const [voter, voteTracking, liveEvent] = await prisma.$transaction(async (tx) => {
      const updated = await tx.voter.update({
        where: { id },
        data: {
          voteStatus: VoteStatus.NOT_VOTED,
          voteDoneTime: null,
        },
      });

      const tracking = await tx.voteTracking.create({
        data: {
          voterId: id,
          status: VoteStatus.NOT_VOTED,
          markedById: actorId,
          markedAt: now,
          verificationMethod: 'STATUS_RESET',
        },
      });

      const event = await tx.liveVoteEvent.create({
        data: {
          voterId: id,
          unitId: updated.unitId,
          inchargeId: actorId,
          previousStatus: existing.voteStatus,
          nextStatus: VoteStatus.NOT_VOTED,
          changedAt: now,
        },
      });

      if (updated.unitId) {
        await tx.aggregateCache.deleteMany({
          where: { unitId: updated.unitId },
        });
      }

      return [updated, tracking, event];
    });

    await logAudit({
      action: AuditAction.UPDATE,
      entityType: 'VoteTracking',
      entityId: id,
      userId: actorId,
      unitId: voter.unitId ?? undefined,
      changes: {
        action: 'MARK_NOT_VOTED',
        previousStatus: existing.voteStatus,
        nextStatus: VoteStatus.NOT_VOTED,
        timestamp: now,
      },
    });

    if (voter.unitId) {
      const actor = await prisma.user.findUnique({
        where: { id: actorId },
        select: { id: true, userCode: true, name: true, role: true },
      });

      const payload = {
        id: liveEvent.id,
        previousStatus: existing.voteStatus,
        nextStatus: VoteStatus.NOT_VOTED,
        changedAt: now.toISOString(),
        voter: {
          id: voter.id,
          name: voter.name,
          epicNumber: voter.epicNumber,
          politicalPreference: voter.politicalPreference,
        },
        unit: {
          id: existing.unit?.id || voter.unitId,
          name: existing.unit?.name || '',
          level: existing.unit?.level || 'VOTER_GROUP',
        },
        incharge: {
          id: actor?.id || actorId,
          userCode: actor?.userCode || 'INCHARGE',
          name: actor?.name || 'In-Charge',
        },
      };

      await emitHierarchyEvent(voter.unitId, 'vote:event', payload);
      await emitHierarchyEvent(voter.unitId, 'summary:invalidate', {
        unitId: voter.unitId,
        delta: -1,
        voterId: voter.id,
        timestamp: now.toISOString(),
      });
    }

    return voter;
  }

  static async updateMigration(id: string, dto: UpdateMigrationDto, actorId: string) {
    const voter = await prisma.voter.findUnique({ where: { id } });
    if (!voter) throw new Error('Voter not found');

    const migration = await prisma.voterMigration.create({
      data: {
        voterId: id,
        status: dto.status,
        destinationCity: dto.destinationCity,
        destinationState: dto.destinationState,
        destinationCountry: dto.destinationCountry,
        contactInCity: dto.contactInCity,
        travelRequired: dto.travelRequired,
        transportArranged: dto.transportArranged,
        returnPlannedDate: dto.returnPlannedDate ? new Date(dto.returnPlannedDate) : undefined,
        notes: dto.notes,
      },
    });

    await prisma.voter.update({
      where: { id },
      data: {
        voterLocationStatus: dto.status,
        currentLocation: dto.status === VoterLocationStatus.MIGRATED ? dto.destinationCity : 'Local',
      },
    });

    await logAudit({
      action: AuditAction.UPDATE,
      entityType: 'VoterMigration',
      entityId: migration.id,
      userId: actorId,
      unitId: voter.unitId ?? undefined,
      changes: dto as unknown as Prisma.InputJsonValue,
    });

    return migration;
  }

  static async getVoterHistory(id: string) {
    const [statusHistory, voteTrackings, fakeFlags, migrations] = await Promise.all([
      prisma.voterStatusHistory.findMany({ where: { voterId: id }, orderBy: { changedAt: 'desc' } }),
      prisma.voteTracking.findMany({ where: { voterId: id }, include: { markedBy: true }, orderBy: { markedAt: 'desc' } }),
      prisma.fakeVoterFlag.findMany({ where: { voterId: id }, include: { flaggedBy: true, resolvedBy: true } }),
      prisma.voterMigration.findMany({ where: { voterId: id }, orderBy: { createdAt: 'desc' } }),
    ]);

    return { statusHistory, voteTrackings, fakeFlags, migrations };
  }

  static async deleteVoter(id: string, actorId: string) {
    const existing = await prisma.voter.findUnique({ where: { id } });
    if (!existing) throw new Error('Voter not found');

    await prisma.$transaction([
      prisma.voterStatusHistory.deleteMany({ where: { voterId: id } }),
      prisma.fakeVoterFlag.deleteMany({ where: { voterId: id } }),
      prisma.voterMigration.deleteMany({ where: { voterId: id } }),
      prisma.voteTracking.deleteMany({ where: { voterId: id } }),
      prisma.liveVoteEvent.deleteMany({ where: { voterId: id } }),
      prisma.voterAssignment.deleteMany({ where: { voterId: id } }),
      prisma.voter.delete({ where: { id } }),
    ]);

    await logAudit({
      action: AuditAction.DELETE,
      entityType: 'Voter',
      entityId: id,
      userId: actorId,
      unitId: existing.unitId ?? undefined,
      metadata: { epicNumber: existing.epicNumber, name: existing.name },
    });

    return { id, deleted: true };
  }
}
