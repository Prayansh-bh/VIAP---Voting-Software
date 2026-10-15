import bcrypt from 'bcryptjs';
import { AuditAction, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { logAudit } from '../../middleware/audit.js';
import { CreateUserDto, UpdateUserDto, UpdateUserStatusDto, UserQueryDto } from './users.schema.js';
export class UsersService {
  static async listUsers(
    query: UserQueryDto,
    accessibleUnitIds?: Set<string>,
    organisationId?: string | null,
    isSuperAdmin = false,
  ) {
    const { page, limit, search, role, unitId, accountStatus } = query;
    const skip = (page - 1) * limit;

    if (!isSuperAdmin && !organisationId) {
      return { total: 0, items: [], page, limit };
    }

    const where: Prisma.UserWhereInput = {};

    if (!isSuperAdmin || organisationId) {
      where.organisationId = organisationId;
    }

    if (role) where.role = role;
    if (accountStatus) where.accountStatus = accountStatus;
    if (unitId) where.unitId = unitId;

    if (accessibleUnitIds && accessibleUnitIds.size > 0 && !unitId) {
      where.unitId = { in: Array.from(accessibleUnitIds) };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { userCode: { contains: search, mode: 'insensitive' } },
        { mobileNumber: { contains: search } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          unit: true,
          roleRef: true,
          cadreProfile: true,
        },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      }),
    ]);

    return { total, items, page, limit };
  }

  static async getUserById(id: string, actorOrgId?: string | null, isSuperAdmin = false) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        unit: true,
        roleRef: true,
        cadreProfile: true,
        hierarchyAssignments: { where: { isActive: true } },
      },
    });

    if (!user) {
      const err: any = new Error('User not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (!isSuperAdmin && actorOrgId && user.organisationId && user.organisationId !== actorOrgId) {
      const err: any = new Error('Access denied: User belongs to another organization');
      err.statusCode = 403;
      err.code = 'FORBIDDEN_TENANT';
      throw err;
    }

    return user;
  }

  static async createUser(dto: CreateUserDto, actorId: string) {
    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : null;

    const user = await prisma.user.create({
      data: {
        userCode: dto.userCode,
        name: dto.name,
        mobileNumber: dto.mobileNumber,
        email: dto.email,
        passwordHash,
        role: dto.role,
        unitId: dto.unitId,
        organisationId: dto.organisationId,
      },
      include: { unit: true },
    });

    await logAudit({
      action: AuditAction.CREATE,
      entityType: 'User',
      entityId: user.id,
      userId: actorId,
      unitId: user.unitId ?? undefined,
      changes: dto as unknown as Prisma.InputJsonValue,
    });

    return user;
  }

  static async updateUser(
    id: string,
    dto: UpdateUserDto,
    actorId: string,
    actorOrgId?: string | null,
    isSuperAdmin = false,
  ) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      const err: any = new Error('User not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (!isSuperAdmin && actorOrgId && existing.organisationId && existing.organisationId !== actorOrgId) {
      const err: any = new Error('Access denied: User belongs to another organization');
      err.statusCode = 403;
      err.code = 'FORBIDDEN_TENANT';
      throw err;
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        mobileNumber: dto.mobileNumber,
        email: dto.email,
        role: dto.role,
        unitId: dto.unitId,
        accountStatus: dto.accountStatus,
      },
      include: { unit: true },
    });

    await logAudit({
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: user.id,
      userId: actorId,
      unitId: user.unitId ?? undefined,
      changes: dto as unknown as Prisma.InputJsonValue,
    });

    return user;
  }

  static async updateUserStatus(
    id: string,
    dto: UpdateUserStatusDto,
    actorId: string,
    actorOrgId?: string | null,
    isSuperAdmin = false,
  ) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      const err: any = new Error('User not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (!isSuperAdmin && actorOrgId && existing.organisationId && existing.organisationId !== actorOrgId) {
      const err: any = new Error('Access denied: User belongs to another organization');
      err.statusCode = 403;
      err.code = 'FORBIDDEN_TENANT';
      throw err;
    }

    const user = await prisma.user.update({
      where: { id },
      data: { accountStatus: dto.status },
    });

    await logAudit({
      action: AuditAction.STATUS_CHANGE,
      entityType: 'User',
      entityId: user.id,
      userId: actorId,
      unitId: user.unitId ?? undefined,
      changes: { previousStatus: existing.accountStatus, newStatus: dto.status },
    });

    return user;
  }

  static async deleteUser(
    id: string,
    actorId: string,
    actorOrgId?: string | null,
    isSuperAdmin = false,
  ) {
    const existing = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            auditLogs: true,
            voteEvents: true,
            voteTrackings: true,
            fakeVoterFlags: true,
            pollingReports: true,
            groundReports: true,
            createdTasks: true,
            assignedTasks: true,
            createdPolls: true,
            pollVotes: true,
          },
        },
      },
    });

    if (!existing) {
      const err: any = new Error('User not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (!isSuperAdmin && actorOrgId && existing.organisationId && existing.organisationId !== actorOrgId) {
      const err: any = new Error('Access denied: User belongs to another organization');
      err.statusCode = 403;
      err.code = 'FORBIDDEN_TENANT';
      throw err;
    }

    const hasElectionOrAuditHistory =
      (existing._count.voteEvents ?? 0) > 0 ||
      (existing._count.voteTrackings ?? 0) > 0 ||
      (existing._count.pollingReports ?? 0) > 0 ||
      (existing._count.groundReports ?? 0) > 0 ||
      (existing._count.auditLogs ?? 0) > 0 ||
      (existing._count.pollVotes ?? 0) > 0;

    if (hasElectionOrAuditHistory) {
      // Soft-archive user to prevent destruction of election/audit integrity
      await prisma.$transaction([
        prisma.user.update({
          where: { id },
          data: { accountStatus: 'DEACTIVATED' },
        }),
        prisma.loginSession.deleteMany({ where: { userId: id } }),
        prisma.userHierarchyAssignment.updateMany({
          where: { userId: id, isActive: true },
          data: { isActive: false },
        }),
      ]);

      await logAudit({
        action: AuditAction.STATUS_CHANGE,
        entityType: 'User',
        entityId: id,
        userId: actorId,
        unitId: existing.unitId ?? undefined,
        metadata: {
          userCode: existing.userCode,
          name: existing.name,
          softArchived: true,
          reason: 'ELECTION_AUDIT_PRESERVATION',
        },
      });

      return {
        id,
        deleted: false,
        softArchived: true,
        accountStatus: 'DEACTIVATED',
        message: 'User soft-archived to preserve audit and election history',
      };
    }

    // Clean delete if no election/audit history
    await prisma.$transaction([
      prisma.loginSession.deleteMany({ where: { userId: id } }),
      prisma.userHierarchyAssignment.deleteMany({ where: { userId: id } }),
      prisma.userDevice.deleteMany({ where: { userId: id } }),
      prisma.notification.deleteMany({ where: { userId: id } }),
      prisma.cadreAssignment.deleteMany({ where: { assigneeUserId: id } }),
      prisma.cadre.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);

    await logAudit({
      action: AuditAction.DELETE,
      entityType: 'User',
      entityId: id,
      userId: actorId,
      unitId: existing.unitId ?? undefined,
      metadata: { userCode: existing.userCode, name: existing.name, deleted: true },
    });

    return { id, deleted: true, softArchived: false };
  }
}
