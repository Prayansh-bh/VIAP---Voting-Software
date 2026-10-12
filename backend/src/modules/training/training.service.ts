import { AuditAction, Prisma, TrainingStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { logAudit } from '../../middleware/audit.js';

export class TrainingService {
  static async listVideos() {
    return prisma.trainingVideo.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  static async createVideo(dto: any, actorId: string) {
    const video = await prisma.trainingVideo.create({ data: dto });

    await logAudit({
      action: AuditAction.CREATE,
      entityType: 'TrainingVideo',
      entityId: video.id,
      userId: actorId,
      changes: dto as unknown as Prisma.InputJsonValue,
    });

    return video;
  }

  static async updateVideo(id: string, dto: any, actorId: string) {
    const video = await prisma.trainingVideo.update({
      where: { id },
      data: dto,
    });

    await logAudit({
      action: AuditAction.UPDATE,
      entityType: 'TrainingVideo',
      entityId: video.id,
      userId: actorId,
      changes: dto as unknown as Prisma.InputJsonValue,
    });

    return video;
  }

  static async deleteVideo(id: string, actorId: string) {
    await prisma.trainingVideo.update({
      where: { id },
      data: { isActive: false },
    });

    await logAudit({
      action: AuditAction.DELETE,
      entityType: 'TrainingVideo',
      entityId: id,
      userId: actorId,
    });

    return { id, deleted: true };
  }

  static async assignVideo(videoId: string, dto: any, actorId: string) {
    const video = await prisma.trainingVideo.findUnique({ where: { id: videoId } });
    if (!video) throw new Error('Training video not found');

    if (dto.targetRole) {
      await prisma.trainingAssignment.create({
        data: {
          videoId,
          targetRole: dto.targetRole,
        },
      });

      const users = await prisma.user.findMany({ where: { role: dto.targetRole } });
      for (const u of users) {
        await prisma.trainingProgress.upsert({
          where: { userId_videoId: { userId: u.id, videoId } },
          update: {},
          create: {
            userId: u.id,
            videoId,
            status: TrainingStatus.ASSIGNED,
            assignedById: actorId,
          },
        });
      }
    }

    if (dto.userIds && dto.userIds.length > 0) {
      for (const uid of dto.userIds) {
        await prisma.trainingProgress.upsert({
          where: { userId_videoId: { userId: uid, videoId } },
          update: {},
          create: {
            userId: uid,
            videoId,
            status: TrainingStatus.ASSIGNED,
            assignedById: actorId,
          },
        });
      }
    }

    return { videoId, assigned: true };
  }

  static async updateProgress(videoId: string, userId: string, dto: any) {
    const progress = await prisma.trainingProgress.upsert({
      where: { userId_videoId: { userId, videoId } },
      update: {
        status: dto.status,
        quizScore: dto.quizScore,
        notes: dto.notes,
        watchedAt: dto.status === TrainingStatus.WATCHED || dto.status === TrainingStatus.COMPLETED ? new Date() : undefined,
        completedAt: dto.status === TrainingStatus.COMPLETED ? new Date() : undefined,
      },
      create: {
        userId,
        videoId,
        status: dto.status,
        quizScore: dto.quizScore,
        notes: dto.notes,
        watchedAt: dto.status === TrainingStatus.WATCHED || dto.status === TrainingStatus.COMPLETED ? new Date() : undefined,
        completedAt: dto.status === TrainingStatus.COMPLETED ? new Date() : undefined,
      },
    });

    return progress;
  }

  static async getTrainingAnalytics(accessibleUnitIds?: Set<string>) {
    const whereUser: any = {};
    if (accessibleUnitIds && accessibleUnitIds.size > 0) {
      whereUser.unitId = { in: Array.from(accessibleUnitIds) };
    }

    const [totalVideos, progressRecords, usersCount] = await Promise.all([
      prisma.trainingVideo.count({ where: { isActive: true } }),
      prisma.trainingProgress.findMany({
        where: { user: whereUser },
        include: { video: true, user: true },
      }),
      prisma.user.count({ where: whereUser }),
    ]);

    const completed = progressRecords.filter((p) => p.status === TrainingStatus.COMPLETED).length;
    const watched = progressRecords.filter((p) => p.status === TrainingStatus.WATCHED).length;
    const assigned = progressRecords.length;

    const completionRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;

    return {
      totalVideos,
      totalCadreMembers: usersCount,
      totalAssignedTrainings: assigned,
      totalWatched: watched,
      totalCompleted: completed,
      completionRate,
    };
  }
}
