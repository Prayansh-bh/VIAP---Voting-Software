import { AuditAction, TaskStatus, TrainingStatus, VoteStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { logAudit } from '../../middleware/audit.js';

export class CadreService {
  static async listCadres(
    accessibleUnitIds?: Set<string>,
    page = 1,
    limit = 100,
    organisationId?: string | null,
    isSuperAdmin = false,
  ) {
    if (!isSuperAdmin && !organisationId) {
      return [];
    }

    const where: any = {};
    if (!isSuperAdmin || organisationId) {
      where.user = { organisationId };
    }
    if (accessibleUnitIds && accessibleUnitIds.size > 0) {
      where.user = {
        ...(where.user || {}),
        unitId: { in: Array.from(accessibleUnitIds) },
      };
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 100));
    const skip = (safePage - 1) * safeLimit;

    return prisma.cadre.findMany({
      where,
      include: {
        user: {
          include: { unit: true, assignedVoters: true },
        },
      },
      orderBy: { performanceScore: 'desc' },
      skip,
      take: safeLimit,
    });
  }

  static async createCadre(dto: any, actorId: string, actorOrgId?: string | null, isSuperAdmin = false) {
    const user = await prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) {
      const err: any = new Error('User not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (!isSuperAdmin && actorOrgId && user.organisationId !== actorOrgId) {
      const err: any = new Error('Access denied: Target user belongs to another organization');
      err.statusCode = 403;
      err.code = 'FORBIDDEN_TENANT';
      throw err;
    }

    const safeData: any = {
      userId: dto.userId,
      skills: dto.skills || [],
      badges: dto.badges || [],
      performanceScore: typeof dto.performanceScore === 'number' ? dto.performanceScore : 85.0,
      totalAssignedVoters: Number(dto.totalAssignedVoters) || 0,
      votedCoveredCount: Number(dto.votedCoveredCount) || 0,
      tasksCompletedCount: Number(dto.tasksCompletedCount) || 0,
      trainingCompletedCount: Number(dto.trainingCompletedCount) || 0,
    };

    const cadre = await prisma.cadre.create({
      data: safeData,
      include: { user: true },
    });

    await logAudit({
      action: AuditAction.CREATE,
      entityType: 'Cadre',
      entityId: cadre.id,
      userId: actorId,
      changes: safeData,
    });

    return cadre;
  }

  static async updateCadre(id: string, dto: any, actorId: string, actorOrgId?: string | null, isSuperAdmin = false) {
    const existing = await prisma.cadre.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!existing) {
      const err: any = new Error('Cadre not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (!isSuperAdmin && (!actorOrgId || existing.user?.organisationId !== actorOrgId)) {
      const err: any = new Error('Access denied: Cadre belongs to another organization');
      err.statusCode = 403;
      err.code = 'FORBIDDEN_TENANT';
      throw err;
    }

    const ALLOWED_FIELDS = [
      'skills',
      'badges',
      'performanceScore',
      'totalAssignedVoters',
      'votedCoveredCount',
      'tasksCompletedCount',
      'trainingCompletedCount',
    ];

    const safeData: Record<string, any> = {};
    for (const key of ALLOWED_FIELDS) {
      if (dto && dto[key] !== undefined) {
        safeData[key] = dto[key];
      }
    }

    const cadre = await prisma.cadre.update({
      where: { id },
      data: safeData,
      include: { user: true },
    });

    await logAudit({
      action: AuditAction.UPDATE,
      entityType: 'Cadre',
      entityId: cadre.id,
      userId: actorId,
      changes: safeData,
    });

    return cadre;
  }

  static async deleteCadre(id: string, actorId: string, actorOrgId?: string | null, isSuperAdmin = false) {
    const existing = await prisma.cadre.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!existing) {
      const err: any = new Error('Cadre profile not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (!isSuperAdmin && (!actorOrgId || existing.user?.organisationId !== actorOrgId)) {
      const err: any = new Error('Access denied: Cadre belongs to another organization');
      err.statusCode = 403;
      err.code = 'FORBIDDEN_TENANT';
      throw err;
    }

    await prisma.cadre.delete({ where: { id } });

    await logAudit({
      action: AuditAction.DELETE,
      entityType: 'Cadre',
      entityId: id,
      userId: actorId,
      metadata: { userId: existing.userId },
    });

    return { id, deleted: true };
  }

  static async getCadreNetwork(
    accessibleUnitIds?: Set<string>,
    organisationId?: string | null,
    isSuperAdmin = false,
  ) {
    if (!isSuperAdmin && !organisationId) {
      return [];
    }

    const where: any = {};
    if (!isSuperAdmin || organisationId) {
      where.organisationId = organisationId;
    }
    if (accessibleUnitIds && accessibleUnitIds.size > 0) {
      where.unitId = { in: Array.from(accessibleUnitIds) };
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        unit: true,
        assignedVoters: true,
        assignedTasks: true,
        trainingProgress: true,
        cadreProfile: true,
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    return users.map((u) => {
      const totalAssigned = u.assignedVoters.length;
      const voted = u.assignedVoters.filter((v) => v.voteStatus === VoteStatus.VOTE_DONE).length;
      const openTasks = u.assignedTasks.filter((t) => t.status !== TaskStatus.COMPLETED).length;
      const completedTraining = u.trainingProgress.filter((tp) => tp.status === TrainingStatus.COMPLETED).length;
      const performanceScore = u.cadreProfile?.performanceScore ?? (totalAssigned > 0 ? Math.round((voted / totalAssigned) * 100) : 80);

      return {
        userId: u.id,
        userCode: u.userCode,
        name: u.name,
        role: u.role,
        unitId: u.unitId,
        unitName: u.unit?.name ?? '',
        mobileNumber: u.mobileNumber,
        totalAssignedVoters: totalAssigned,
        voted,
        remaining: totalAssigned - voted,
        openTasks,
        completedTraining,
        performanceScore,
        badges: u.cadreProfile?.badges ?? [],
        skills: u.cadreProfile?.skills ?? [],
      };
    });
  }

  static async getCadrePerformance(
    accessibleUnitIds?: Set<string>,
    organisationId?: string | null,
    isSuperAdmin = false,
  ) {
    const network = await this.getCadreNetwork(accessibleUnitIds, organisationId, isSuperAdmin);
    const topPerformers = [...network].sort((a, b) => b.performanceScore - a.performanceScore).slice(0, 10);
    const needsAttention = [...network].filter((c) => c.performanceScore < 60 || c.openTasks > 3);

    const avgScore = network.length > 0
      ? Math.round(network.reduce((sum, c) => sum + c.performanceScore, 0) / network.length)
      : 0;

    return {
      totalCadre: network.length,
      averagePerformanceScore: avgScore,
      topPerformers,
      needsAttention,
    };
  }
}
