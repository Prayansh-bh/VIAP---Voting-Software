import bcrypt from 'bcryptjs';
import { AuditAction, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { logAudit } from '../../middleware/audit.js';
import { CreateUserDto, UpdateUserDto, UpdateUserStatusDto, UserQueryDto } from './users.schema.js';

export class UsersService {
  static async listUsers(query: UserQueryDto, accessibleUnitIds?: Set<string>) {
    const { page, limit, search, role, unitId, accountStatus } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

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

  static async getUserById(id: string) {
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
      throw new Error('User not found');
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

  static async updateUser(id: string, dto: UpdateUserDto, actorId: string) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new Error('User not found');

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

  static async updateUserStatus(id: string, dto: UpdateUserStatusDto, actorId: string) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new Error('User not found');

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

  static async deleteUser(id: string, actorId: string) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new Error('User not found');

    await prisma.user.delete({ where: { id } });

    await logAudit({
      action: AuditAction.DELETE,
      entityType: 'User',
      entityId: id,
      userId: actorId,
      unitId: existing.unitId ?? undefined,
      metadata: { userCode: existing.userCode, name: existing.name },
    });

    return { id, deleted: true };
  }
}
