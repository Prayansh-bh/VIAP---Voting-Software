import { PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

let pollTaskIntervalTimer: NodeJS.Timeout | null = null;
let cleanupIntervalTimer: NodeJS.Timeout | null = null;
let isJobRunning = false;

/**
 * Sweep polls that have passed their expiresAt timestamp and mark them CLOSED
 */
export async function sweepExpiredPolls(db: PrismaClient = prisma): Promise<number> {
  const now = new Date();
  try {
    const result = await db.poll.updateMany({
      where: {
        status: 'PUBLISHED',
        expiresAt: {
          not: null,
          lte: now,
        },
      },
      data: {
        status: 'CLOSED',
      },
    });
    return result.count;
  } catch (err: any) {
    console.warn('⚠️ [LifecycleJob] sweepExpiredPolls error:', err?.message || err);
    return 0;
  }
}

/**
 * Sweep tasks that are past their due date and notify assignees
 */
export async function sweepOverdueTasks(db: PrismaClient = prisma): Promise<number> {
  const now = new Date();
  try {
    const overdueTasks = await db.task.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          not: null,
          lt: now,
        },
      },
      select: {
        id: true,
        title: true,
        assigneeId: true,
        dueDate: true,
      },
      take: 50,
    });

    if (overdueTasks.length === 0) return 0;

    for (const task of overdueTasks) {
      if (task.assigneeId) {
        // Check if an overdue alert notification was already created today to avoid spamming
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const existingAlert = await db.notification.findFirst({
          where: {
            userId: task.assigneeId,
            type: 'ALERT_TRIGGERED',
            title: 'Directive Overdue',
            createdAt: { gte: todayStart },
            message: { contains: task.id },
          },
        });

        if (!existingAlert) {
          await db.notification.create({
            data: {
              userId: task.assigneeId,
              title: 'Directive Overdue',
              message: `Directive "${task.title}" (Ref: ${task.id.slice(0, 8)}) is past due date. Immediate submission required.`,
              type: 'ALERT_TRIGGERED',
              metadata: { priority: 'HIGH' },
            },
          }).catch(() => {});
        }
      }
    }

    return overdueTasks.length;
  } catch (err: any) {
    console.warn('⚠️ [LifecycleJob] sweepOverdueTasks error:', err?.message || err);
    return 0;
  }
}

/**
 * Purge expired OTP verification codes (> 24 hours old) and stale revoked login sessions (> 7 days old)
 */
export async function cleanStaleData(db: PrismaClient = prisma): Promise<{ otpsDeleted: number; sessionsDeleted: number }> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  let otpsDeleted = 0;
  let sessionsDeleted = 0;

  try {
    const otpRes = await db.oTPVerification.deleteMany({
      where: {
        expiresAt: { lt: oneDayAgo },
      },
    });
    otpsDeleted = otpRes.count;
  } catch (err: any) {
    console.warn('⚠️ [LifecycleJob] cleanStaleData OTP purge notice:', err?.message || err);
  }

  try {
    const sessionRes = await db.loginSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: sevenDaysAgo } },
          { revokedAt: { not: null, lt: sevenDaysAgo } },
        ],
      },
    });
    sessionsDeleted = sessionRes.count;
  } catch (err: any) {
    console.warn('⚠️ [LifecycleJob] cleanStaleData Session purge notice:', err?.message || err);
  }

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const expiredPolls = await db.poll.findMany({
      where: {
        status: 'CLOSED',
        expiresAt: { lte: thirtyDaysAgo },
      },
      select: { id: true },
    });
    if (expiredPolls.length > 0) {
      const pollIds = expiredPolls.map((p) => p.id);
      await db.pollVote.deleteMany({ where: { option: { pollId: { in: pollIds } } } });
      await db.pollOption.deleteMany({ where: { pollId: { in: pollIds } } });
      await db.poll.deleteMany({ where: { id: { in: pollIds } } });
    }
  } catch (err: any) {
    console.warn('⚠️ [LifecycleJob] cleanStaleData Poll purge notice:', err?.message || err);
  }

  return { otpsDeleted, sessionsDeleted };
}

/**
 * Initialize background lifecycle scheduler
 */
export function initLifecycleScheduler(db: PrismaClient = prisma): void {
  // Run initial sweep on boot
  void sweepExpiredPolls(db);
  void sweepOverdueTasks(db);
  void cleanStaleData(db);

  // Poll and Task overdue check runs every 60 seconds
  if (!pollTaskIntervalTimer) {
    pollTaskIntervalTimer = setInterval(async () => {
      if (isJobRunning) return;
      isJobRunning = true;
      try {
        await sweepExpiredPolls(db);
        await sweepOverdueTasks(db);
      } finally {
        isJobRunning = false;
      }
    }, 60 * 1000);
    pollTaskIntervalTimer.unref();
  }

  // Cleanup runs once per hour
  if (!cleanupIntervalTimer) {
    cleanupIntervalTimer = setInterval(async () => {
      await cleanStaleData(db);
    }, 60 * 60 * 1000);
    cleanupIntervalTimer.unref();
  }
}

/**
 * Stop background lifecycle scheduler gracefully
 */
export function stopLifecycleScheduler(): void {
  if (pollTaskIntervalTimer) {
    clearInterval(pollTaskIntervalTimer);
    pollTaskIntervalTimer = null;
  }
  if (cleanupIntervalTimer) {
    clearInterval(cleanupIntervalTimer);
    cleanupIntervalTimer = null;
  }
}

