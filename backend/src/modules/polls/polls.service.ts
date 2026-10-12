import { prisma } from '../../lib/prisma.js';
import { CreatePollDto, VotePollDto } from './polls.schema.js';
import { AuthenticatedUserPayload, UserHierarchyScope } from '../../common/types.js';
import { logAudit } from '../../middleware/audit.js';
import { AuditAction } from '@prisma/client';

export class PollsService {
  static async listPolls(user: AuthenticatedUserPayload) {
    const polls = await prisma.poll.findMany({
      where: {
        status: { in: ['PUBLISHED', 'CLOSED'] },
      },
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

  static async vote(pollId: string, dto: VotePollDto, user: AuthenticatedUserPayload) {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: true },
    });

    if (!poll) {
      const err: any = new Error('Poll not found');
      err.statusCode = 404;
      throw err;
    }

    if (poll.status !== 'PUBLISHED') {
      const err: any = new Error('This poll is closed or not accepting votes');
      err.statusCode = 400;
      throw err;
    }

    const optionExists = poll.options.some((o: any) => o.id === dto.optionId);
    if (!optionExists) {
      const err: any = new Error('Invalid option selected for this poll');
      err.statusCode = 400;
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
      throw err;
    }

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
  }

  static async closePoll(pollId: string, user: AuthenticatedUserPayload, scope?: UserHierarchyScope) {
    const existing = await prisma.poll.findUnique({
      where: { id: pollId },
    });

    if (!existing) {
      const err: any = new Error('Poll not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
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
