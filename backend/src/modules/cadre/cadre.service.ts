import { AuditAction, TaskStatus, TrainingStatus, VoteStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { logAudit } from '../../middleware/audit.js';

export class CadreService {
  static async listCadres(accessibleUnitIds?: Set<string>, page = 1, limit = 100) {
    const where: any = {};
    if (accessibleUnitIds && accessibleUnitIds.size > 0) {
      where.user = { unitId: { in: Array.from(accessibleUnitIds) } };
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

  static async createCadre(dto: any, actorId: string) {
    const cadre = await prisma.cadre.create({
      data: dto,
      include: { user: true },
    });

    await logAudit({
      action: AuditAction.CREATE,
      entityType: 'Cadre',
      entityId: cadre.id,
      userId: actorId,
      changes: dto,
    });

    return cadre;
  }

  static async updateCadre(id: string, dto: any, actorId: string) {
    const cadre = await prisma.cadre.update({
      where: { id },
      data: dto,
      include: { user: true },
    });

    await logAudit({
      action: AuditAction.UPDATE,
      entityType: 'Cadre',
      entityId: cadre.id,
      userId: actorId,
      changes: dto,
    });

    return cadre;
  }

  static async getCadreNetwork(accessibleUnitIds?: Set<string>) {
    const where: any = {};
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

  static async getCadrePerformance(accessibleUnitIds?: Set<string>) {
    const network = await this.getCadreNetwork(accessibleUnitIds);
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
