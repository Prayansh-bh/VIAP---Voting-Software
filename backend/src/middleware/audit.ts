import { AuditAction, Prisma } from '@prisma/client';
import { FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';

export interface AuditLogInput {
  action: AuditAction;
  entityType: string;
  entityId: string;
  userId?: string;
  unitId?: string;
  changes?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
  req?: FastifyRequest;
}

export async function logAudit(input: AuditLogInput) {
  try {
    const userId = input.userId || input.req?.user?.userId;
    if (!userId) return;

    const ipAddress = input.ipAddress || input.req?.ip;
    const userAgent = input.userAgent || input.req?.headers['user-agent'];

    await prisma.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        userId,
        unitId: input.unitId,
        changes: input.changes,
        metadata: input.metadata,
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    console.error('[AuditLog] Failed to record audit entry:', err);
  }
}
