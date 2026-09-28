import { AuditAction, NotificationType, Prisma, TaskStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { logAudit } from '../../middleware/audit.js';
import { emitHierarchyEvent } from '../../lib/socket.js';

export class TasksService {
  static async listTasks(query: any, scope?: import('../../common/types.js').UserHierarchyScope) {
    const { status, priority, unitId, assigneeId } = query;
    const where: Prisma.TaskWhereInput = {};

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assigneeId) where.assigneeId = assigneeId;

    if (scope && !scope.isGlobalScope) {
      if (scope.role === 'VOTER_100_INCHARGE') {
        where.OR = [
          { assigneeId: scope.userId },
          { assignments: { some: { userId: scope.userId } } },
          { targetLevel: 'VOTER_GROUP' },
          ...(scope.accessibleUnitIds.size > 0 ? [{ unitId: { in: Array.from(scope.accessibleUnitIds) } }] : []),
        ];
      } else if (scope.accessibleUnitIds.size > 0) {
        where.OR = [
          { unitId: { in: Array.from(scope.accessibleUnitIds) } },
          { assigneeId: scope.userId },
          { assignments: { some: { userId: scope.userId } } },
        ];
      }
    } else if (unitId) {
      where.unitId = unitId;
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = query.all === 'true' ? 500 : Math.min(200, Math.max(1, Number(query.limit) || 100));
    const skip = (page - 1) * limit;

    return prisma.task.findMany({
      where,
      include: {
        createdBy: true,
        assignee: true,
        assignments: { include: { user: true } },
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
      skip,
      take: limit,
    });
  }

  private static isTaskAccessible(
    task: any,
    scope?: import('../../common/types.js').UserHierarchyScope,
    actorId?: string,
    action: 'read' | 'status' | 'update' | 'assign' = 'read',
  ): boolean {
    if (!scope) return true;
    if (scope.isGlobalScope) return true;

    // Creator always has full access
    if (task.createdById === (actorId || scope.userId)) return true;

    // Direct assignee check (permitted for reading and updating status)
    const isDirectAssignee =
      task.assigneeId === (actorId || scope.userId) ||
      (task.assignments && task.assignments.some((a: any) => a.userId === (actorId || scope.userId)));

    if (action === 'read' || action === 'status') {
      if (isDirectAssignee) return true;
    }

    // Unit / jurisdiction check
    if (task.unitId && scope.accessibleUnitIds.has(task.unitId)) return true;
    if (task.constituencyId && scope.accessibleConstituencyIds.has(task.constituencyId)) return true;
    if (task.mandalId && scope.accessibleMandalIds.has(task.mandalId)) return true;
    if (task.villageId && scope.accessibleVillageIds.has(task.villageId)) return true;
    if (task.boothId && scope.accessibleBoothIds.has(task.boothId)) return true;

    if (task.targetLevel === 'VOTER_GROUP' && scope.accessibleVoterGroupIds.size > 0) return true;

    return false;
  }

  static async getTaskById(id: string, scope?: import('../../common/types.js').UserHierarchyScope, actorId?: string) {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        createdBy: true,
        assignee: true,
        assignments: { include: { user: true } },
        statusHistory: { orderBy: { changedAt: 'desc' } },
      },
    });

    if (!task) {
      const err: any = new Error('Task not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (scope && !this.isTaskAccessible(task, scope, actorId, 'read')) {
      const err: any = new Error('Access denied: Task is outside your authorized hierarchy scope.');
      err.statusCode = 403;
      err.code = 'FORBIDDEN_SCOPE';
      throw err;
    }

    return task;
  }

  static async createTask(dto: any, actorId: string, scope?: import('../../common/types.js').UserHierarchyScope) {
    if (scope && !scope.isGlobalScope) {
      if (dto.unitId && !scope.accessibleUnitIds.has(dto.unitId)) {
        const err: any = new Error(`Access denied: Geographical node ${dto.unitId} is outside your authorized hierarchy scope.`);
        err.statusCode = 403;
        err.code = 'FORBIDDEN_SCOPE';
        throw err;
      }
      if (dto.constituencyId && !scope.accessibleConstituencyIds.has(dto.constituencyId)) {
        const err: any = new Error(`Access denied: Constituency ${dto.constituencyId} is outside your authorized hierarchy scope.`);
        err.statusCode = 403;
        err.code = 'FORBIDDEN_SCOPE';
        throw err;
      }
      if (dto.mandalId && !scope.accessibleMandalIds.has(dto.mandalId)) {
        const err: any = new Error(`Access denied: Mandal ${dto.mandalId} is outside your authorized hierarchy scope.`);
        err.statusCode = 403;
        err.code = 'FORBIDDEN_SCOPE';
        throw err;
      }
      if (dto.villageId && !scope.accessibleVillageIds.has(dto.villageId)) {
        const err: any = new Error(`Access denied: Village ${dto.villageId} is outside your authorized hierarchy scope.`);
        err.statusCode = 403;
        err.code = 'FORBIDDEN_SCOPE';
        throw err;
      }
      if (dto.boothId && !scope.accessibleBoothIds.has(dto.boothId)) {
        const err: any = new Error(`Access denied: Booth ${dto.boothId} is outside your authorized hierarchy scope.`);
        err.statusCode = 403;
        err.code = 'FORBIDDEN_SCOPE';
        throw err;
      }
    }

    const task = await prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        instructions: dto.instructions,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        sourceLevel: dto.sourceLevel,
        targetLevel: dto.targetLevel,
        constituencyId: dto.constituencyId,
        mandalId: dto.mandalId,
        villageId: dto.villageId,
        boothId: dto.boothId,
        unitId: dto.unitId,
        assigneeId: dto.assigneeId,
        createdById: actorId,
      },
    });

    if (dto.assignedUserIds && dto.assignedUserIds.length > 0) {
      for (const uid of dto.assignedUserIds) {
        await prisma.taskAssignment.create({
          data: {
            taskId: task.id,
            userId: uid,
          },
        });

        await prisma.notification.create({
          data: {
            type: NotificationType.TASK_ASSIGNED,
            title: 'New Task Assigned',
            message: dto.title,
            userId: uid,
          },
        });
      }
    }

    await logAudit({
      action: AuditAction.CREATE,
      entityType: 'Task',
      entityId: task.id,
      userId: actorId,
      unitId: task.unitId ?? undefined,
      changes: dto as unknown as Prisma.InputJsonValue,
    });

    if (task.unitId) {
      await emitHierarchyEvent(task.unitId, 'task:event', {
        type: 'created',
        taskId: task.id,
        title: task.title,
      });
    }

    return task;
  }

  static async updateTask(id: string, dto: any, actorId: string, scope?: import('../../common/types.js').UserHierarchyScope) {
    const existing = await prisma.task.findUnique({
      where: { id },
      include: { assignments: true },
    });
    if (!existing) {
      const err: any = new Error('Task not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (scope && !this.isTaskAccessible(existing, scope, actorId, 'update')) {
      const err: any = new Error('Access denied: You do not have permission to modify this task.');
      err.statusCode = 403;
      err.code = 'FORBIDDEN_SCOPE';
      throw err;
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        instructions: dto.instructions,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: dto.status,
      },
    });

    await logAudit({
      action: AuditAction.UPDATE,
      entityType: 'Task',
      entityId: task.id,
      userId: actorId,
      unitId: task.unitId ?? undefined,
      changes: dto as unknown as Prisma.InputJsonValue,
    });

    return task;
  }

  static async assignTask(id: string, userIds: string[], actorId: string, scope?: import('../../common/types.js').UserHierarchyScope) {
    const task = await prisma.task.findUnique({
      where: { id },
      include: { assignments: true },
    });
    if (!task) {
      const err: any = new Error('Task not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (scope && !this.isTaskAccessible(task, scope, actorId, 'assign')) {
      const err: any = new Error('Access denied: You do not have permission to reassign this task.');
      err.statusCode = 403;
      err.code = 'FORBIDDEN_SCOPE';
      throw err;
    }

    for (const uid of userIds) {
      await prisma.taskAssignment.upsert({
        where: {
          taskId_userId: { taskId: id, userId: uid },
        },
        update: { status: TaskStatus.PENDING },
        create: {
          taskId: id,
          userId: uid,
        },
      });

      await prisma.notification.create({
        data: {
          type: NotificationType.TASK_ASSIGNED,
          title: 'Task Assigned',
          message: task.title,
          userId: uid,
        },
      });
    }

    await logAudit({
      action: AuditAction.UPDATE,
      entityType: 'TaskAssignment',
      entityId: id,
      userId: actorId,
      changes: { userIds } as unknown as Prisma.InputJsonValue,
    });

    return { taskId: id, assignedCount: userIds.length };
  }

  static async updateTaskStatus(id: string, status: TaskStatus, comments?: string, actorId?: string, scope?: import('../../common/types.js').UserHierarchyScope) {
    const existing = await prisma.task.findUnique({
      where: { id },
      include: { assignments: true },
    });
    if (!existing) {
      const err: any = new Error('Task not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (scope && !this.isTaskAccessible(existing, scope, actorId, 'status')) {
      const err: any = new Error('Access denied: You do not have permission to update the status of this task.');
      err.statusCode = 403;
      err.code = 'FORBIDDEN_SCOPE';
      throw err;
    }

    const task = await prisma.task.update({
      where: { id },
      data: { status },
    });

    await prisma.taskStatusHistory.create({
      data: {
        taskId: id,
        previousStatus: existing.status,
        newStatus: status,
        notes: comments,
        changedById: actorId,
      },
    });

    if (actorId) {
      await logAudit({
        action: AuditAction.STATUS_CHANGE,
        entityType: 'Task',
        entityId: id,
        userId: actorId,
        unitId: task.unitId ?? undefined,
        changes: { previous: existing.status, next: status, comments },
      });
    }

    if (task.unitId) {
      await emitHierarchyEvent(task.unitId, 'task:event', {
        type: 'status_updated',
        taskId: task.id,
        status,
      });
    }

    return task;
  }
}
