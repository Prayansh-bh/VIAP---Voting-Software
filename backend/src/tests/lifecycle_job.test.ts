import { describe, it, expect, vi } from 'vitest';
import { sweepExpiredPolls, sweepOverdueTasks, cleanStaleData } from '../jobs/lifecycle.job.js';

describe('Lifecycle Background Engine', () => {
  it('sweeps expired polls and marks them CLOSED', async () => {
    const mockDb: any = {
      poll: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const count = await sweepExpiredPolls(mockDb);
    expect(count).toBe(2);
    expect(mockDb.poll.updateMany).toHaveBeenCalledWith({
      where: {
        status: 'PUBLISHED',
        expiresAt: {
          not: null,
          lte: expect.any(Date),
        },
      },
      data: {
        status: 'CLOSED',
      },
    });
  });

  it('sweeps overdue pending tasks and alerts assignees', async () => {
    const mockDb: any = {
      task: {
        findMany: vi.fn().mockResolvedValue([
          { id: 't-1', title: 'Collect Voter List', assigneeId: 'u-1', dueDate: new Date(Date.now() - 10000) },
        ]),
      },
      notification: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'n-1' }),
      },
    };
    const count = await sweepOverdueTasks(mockDb);
    expect(count).toBe(1);
    expect(mockDb.notification.create).toHaveBeenCalled();
  });

  it('cleans stale OTPs (>24h) and stale sessions (>7d)', async () => {
    const mockDb: any = {
      oTPVerification: {
        deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
      },
      loginSession: {
        deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
      },
    };
    const result = await cleanStaleData(mockDb);
    expect(result.otpsDeleted).toBe(5);
    expect(result.sessionsDeleted).toBe(3);
    expect(mockDb.oTPVerification.deleteMany).toHaveBeenCalled();
    expect(mockDb.loginSession.deleteMany).toHaveBeenCalled();
  });
});

