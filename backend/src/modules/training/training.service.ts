import { AuditAction, Prisma, TrainingStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { logAudit } from '../../middleware/audit.js';

export class TrainingService {
  static async listVideos(organisationId?: string | null, isSuperAdmin = false) {
    if (!isSuperAdmin && !organisationId) {
      return [];
    }

    const where: Prisma.TrainingVideoWhereInput = { isActive: true };
    if (!isSuperAdmin || organisationId) {
      where.organisationId = organisationId;
    }

    return prisma.trainingVideo.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  static async createVideo(dto: any, actorId: string, organisationId?: string | null, isSuperAdmin = false) {
    if (!isSuperAdmin && !organisationId) {
      throw new Error('Tenant context required');
    }

    const orgToSet = isSuperAdmin ? (dto.organisationId || organisationId || null) : organisationId;
    const data = { ...dto, organisationId: orgToSet };

    const video = await prisma.trainingVideo.create({ data });

    await logAudit({
      action: AuditAction.CREATE,
      entityType: 'TrainingVideo',
      entityId: video.id,
      userId: actorId,
      changes: dto as unknown as Prisma.InputJsonValue,
    });

    return video;
  }

  static async updateVideo(id: string, dto: any, actorId: string, organisationId?: string | null, isSuperAdmin = false) {
    const existing = await prisma.trainingVideo.findUnique({ where: { id } });
    if (!existing) {
      throw Object.assign(new Error('Training video not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }

    if (!isSuperAdmin && (!organisationId || existing.organisationId !== organisationId)) {
      throw Object.assign(new Error('Training video not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }

    const data = { ...dto };
    if (!isSuperAdmin) {
      delete data.organisationId;
    }

    const video = await prisma.trainingVideo.update({
      where: { id },
      data,
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

  static async deleteVideo(id: string, actorId: string, organisationId?: string | null, isSuperAdmin = false) {
    const existing = await prisma.trainingVideo.findUnique({ where: { id } });
    if (!existing) {
      throw Object.assign(new Error('Training video not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }

    if (!isSuperAdmin && (!organisationId || existing.organisationId !== organisationId)) {
      throw Object.assign(new Error('Training video not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }

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

  static async assignVideo(videoId: string, dto: any, actorId: string, organisationId?: string | null, isSuperAdmin = false) {
    const video = await prisma.trainingVideo.findUnique({ where: { id: videoId } });
    if (!video) throw new Error('Training video not found');

    if (!isSuperAdmin && (!organisationId || video.organisationId !== organisationId)) {
      throw new Error('Training video not found');
    }

    if (dto.targetRole) {
      await prisma.trainingAssignment.create({
        data: {
          videoId,
          targetRole: dto.targetRole,
        },
      });

      const userWhere: Prisma.UserWhereInput = { role: dto.targetRole };
      if (!isSuperAdmin || organisationId) {
        userWhere.organisationId = organisationId;
      }

      const users = await prisma.user.findMany({ where: userWhere });
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
      const userWhere: Prisma.UserWhereInput = { id: { in: dto.userIds } };
      if (!isSuperAdmin || organisationId) {
        userWhere.organisationId = organisationId;
      }
      const validUsers = await prisma.user.findMany({ where: userWhere, select: { id: true } });
      const validUserIds = new Set(validUsers.map((u) => u.id));

      for (const uid of dto.userIds) {
        if (!validUserIds.has(uid)) continue;
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
    const [user, video] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { organisationId: true } }),
      prisma.trainingVideo.findUnique({ where: { id: videoId }, select: { organisationId: true } }),
    ]);

    if (!user || !video) {
      throw new Error('Training video or user not found');
    }

    if (video.organisationId && user.organisationId && video.organisationId !== user.organisationId) {
      throw new Error('Training video not found');
    }

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

  static async getTrainingAnalytics(accessibleUnitIds?: Set<string>, organisationId?: string | null, isSuperAdmin = false) {
    if (!isSuperAdmin && !organisationId) {
      return {
        totalVideos: 0,
        totalCadreMembers: 0,
        totalAssignedTrainings: 0,
        totalWatched: 0,
        totalCompleted: 0,
        completionRate: 0,
      };
    }

    const whereUser: Prisma.UserWhereInput = {};
    if (!isSuperAdmin || organisationId) {
      whereUser.organisationId = organisationId;
    }

    if (accessibleUnitIds && accessibleUnitIds.size > 0) {
      whereUser.unitId = { in: Array.from(accessibleUnitIds) };
    }

    const videoWhere: Prisma.TrainingVideoWhereInput = { isActive: true };
    if (!isSuperAdmin || organisationId) {
      videoWhere.organisationId = organisationId;
    }

    const [totalVideos, progressRecords, usersCount] = await Promise.all([
      prisma.trainingVideo.count({ where: videoWhere }),
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
