import { prisma } from '../../lib/prisma.js';
import { CreatePollDto, VotePollDto } from './polls.schema.js';
import { AuthenticatedUserPayload, UserHierarchyScope } from '../../common/types.js';
import { logAudit } from '../../middleware/audit.js';
import { AuditAction } from '@prisma/client';

export class PollsService {
  static async listPolls(user: AuthenticatedUserPayload, scope?: UserHierarchyScope) {
    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    if (!isSuperAdmin && !user.organisationId) {
      return []; // Fail closed if non-superadmin lacks tenant context
    }

    const where: any = {
      status: { in: ['PUBLISHED', 'CLOSED'] },
    };

    if (!isSuperAdmin) {
      where.createdBy = {
        organisationId: user.organisationId,
      };

      if (scope && !scope.isGlobalScope) {
        where.OR = [
          { unitId: null },
          { unitId: { in: Array.from(scope.accessibleUnitIds) } },
        ];
      }
    }

    const polls = await prisma.poll.findMany({
      where,
      include: {
        options: {
          include: {
            _count: {
              select: { votes: true },
            },
          },
          orderBy: { order: 'asc' },
        },
        votes: {
          where: { userId: user.userId },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return polls.map((poll: any) => {
      const totalVotes = poll.options.reduce((sum: number, opt: any) => sum + opt._count.votes, 0);
      const userVote = poll.votes[0] || null;

      return {
        id: poll.id,
        title: poll.title,
        description: poll.description,
        targetLevel: poll.targetLevel,
        status: poll.status,
        expiresAt: poll.expiresAt,
        createdAt: poll.createdAt,
        totalVotes,
        hasVoted: !!userVote,
        userVotedOptionId: userVote?.optionId || null,
        options: poll.options.map((opt: any) => ({
          id: opt.id,
          label: opt.label,
          order: opt.order,
          voteCount: opt._count.votes,
          percentage: totalVotes > 0 ? Math.round((opt._count.votes / totalVotes) * 100) : 0,
        })),
      };
    });
  }

  static async createPoll(dto: CreatePollDto, user: AuthenticatedUserPayload, scope?: UserHierarchyScope) {
    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    if (!isSuperAdmin && !user.organisationId) {
      const err: any = new Error('Access denied: Tenant organization context missing.');
      err.statusCode = 403;
      err.code = 'FORBIDDEN_TENANT';
      throw err;
    }

    if (scope && !scope.isGlobalScope && dto.unitId) {
      if (!scope.accessibleUnitIds.has(dto.unitId)) {
        const err: any = new Error(`Access denied: Geographical node ${dto.unitId} is outside your authorized hierarchy scope.`);
        err.statusCode = 403;
        err.code = 'FORBIDDEN_SCOPE';
        throw err;
      }
    }

    const poll = await prisma.poll.create({
      data: {
        title: dto.title,
        description: dto.description,
        targetLevel: dto.targetLevel,
        unitId: dto.unitId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdById: user.userId,
        status: 'PUBLISHED',
        options: {
          create: dto.options.map((label, idx) => ({
            label,
            order: idx + 1,
          })),
        },
      },
      include: {
        options: true,
      },
    });

    await logAudit({
      action: AuditAction.CREATE,
      entityType: 'Poll',
      entityId: poll.id,
      userId: user.userId,
      changes: { title: poll.title, optionCount: dto.options.length },
    });

    return poll;
  }

  static async vote(pollId: string, dto: VotePollDto, user: AuthenticatedUserPayload, scope?: UserHierarchyScope) {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        options: true,
        createdBy: { select: { organisationId: true } },
      },
    });

    if (!poll) {
      const err: any = new Error('Poll not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    if (!isSuperAdmin) {
      if (!user.organisationId || poll.createdBy?.organisationId !== user.organisationId) {
        const err: any = new Error('Access denied: Poll belongs to another organization.');
        err.statusCode = 403;
        err.code = 'FORBIDDEN_TENANT';
        throw err;
      }

      if (scope && !scope.isGlobalScope && poll.unitId) {
        if (!scope.accessibleUnitIds.has(poll.unitId)) {
          const err: any = new Error('Access denied: Poll is outside your authorized hierarchy scope.');
          err.statusCode = 403;
          err.code = 'FORBIDDEN_SCOPE';
          throw err;
        }
      }
    }

    if (poll.status !== 'PUBLISHED') {
      const err: any = new Error('This poll is closed or not accepting votes');
      err.statusCode = 400;
      err.code = 'POLL_NOT_ACCEPTING_VOTES';
      throw err;
    }

    if (poll.expiresAt && poll.expiresAt < new Date()) {
      const err: any = new Error('This poll has expired and is no longer accepting votes');
      err.statusCode = 400;
      err.code = 'POLL_EXPIRED';
      throw err;
    }

    const optionExists = poll.options.some((o: any) => o.id === dto.optionId);
    if (!optionExists) {
      const err: any = new Error('Invalid option selected for this poll');
      err.statusCode = 400;
      err.code = 'INVALID_POLL_OPTION';
      throw err;
    }

    // Check if user already voted
    const existingVote = await prisma.pollVote.findUnique({
      where: {
        pollId_userId: {
          pollId,
          userId: user.userId,
        },
      },
    });

    if (existingVote) {
      const err: any = new Error('You have already voted on this poll');
      err.statusCode = 409;
      err.code = 'DUPLICATE_VOTE';
      throw err;
    }

    try {
      const vote = await prisma.pollVote.create({
        data: {
          pollId,
          optionId: dto.optionId,
          userId: user.userId,
        },
      });

      return {
        success: true,
        voteId: vote.id,
        pollId,
        optionId: vote.optionId,
        message: 'Vote recorded successfully',
      };
    } catch (err: any) {
      if (err.code === 'P2002') {
        const conflictErr: any = new Error('You have already voted on this poll');
        conflictErr.statusCode = 409;
        conflictErr.code = 'DUPLICATE_VOTE';
        throw conflictErr;
      }
      throw err;
    }
  }

  static async closePoll(pollId: string, user: AuthenticatedUserPayload, scope?: UserHierarchyScope) {
    const existing = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        createdBy: { select: { organisationId: true } },
      },
    });

    if (!existing) {
      const err: any = new Error('Poll not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    if (!isSuperAdmin) {
      if (!user.organisationId || existing.createdBy?.organisationId !== user.organisationId) {
        const err: any = new Error('Access denied: Poll belongs to another organization.');
        err.statusCode = 403;
        err.code = 'FORBIDDEN_TENANT';
        throw err;
      }
    }

    if (scope && !scope.isGlobalScope) {
      const isCreator = existing.createdById === user.userId;
      const isUnitAdmin = existing.unitId && scope.accessibleUnitIds.has(existing.unitId);

      if (!isCreator && !isUnitAdmin) {
        const err: any = new Error('Access denied: You do not have permission to close this poll.');
        err.statusCode = 403;
        err.code = 'FORBIDDEN_SCOPE';
        throw err;
      }
    }

    const poll = await prisma.poll.update({
      where: { id: pollId },
      data: { status: 'CLOSED' },
    });

    await logAudit({
      action: AuditAction.UPDATE,
      entityType: 'Poll',
      entityId: poll.id,
      userId: user.userId,
      changes: { status: 'CLOSED' },
    });

    return poll;
  }
}
