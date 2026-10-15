import { AuditAction, NotificationType, Prisma, TaskStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { logAudit } from '../../middleware/audit.js';
import { emitHierarchyEvent } from '../../lib/socket.js';

export class TasksService {
  static async listTasks(query: any, scope?: import('../../common/types.js').UserHierarchyScope) {
    if (!scope) return [];
    const { status, priority, unitId, assigneeId } = query;
    const where: Prisma.TaskWhereInput = {};

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assigneeId) where.assigneeId = assigneeId;

    if (!scope.isGlobalScope) {
      if (!scope.organisationId) return [];

      const orgFilter: Prisma.TaskWhereInput = {
        OR: [
          { createdBy: { organisationId: scope.organisationId } },
          { assignee: { organisationId: scope.organisationId } },
          { constituency: { parliament: { zone: { state: { organisationId: scope.organisationId } } } } },
          { mandal: { constituency: { parliament: { zone: { state: { organisationId: scope.organisationId } } } } } },
          { village: { mandal: { constituency: { parliament: { zone: { state: { organisationId: scope.organisationId } } } } } } },
          { booth: { village: { mandal: { constituency: { parliament: { zone: { state: { organisationId: scope.organisationId } } } } } } } },
        ],
      };

      const scopeOrConditions: Prisma.TaskWhereInput[] = [
        { createdById: scope.userId },
        { assigneeId: scope.userId },
        { assignments: { some: { userId: scope.userId } } },
      ];

      if (scope.role === 'HIGH_COMMAND' || scope.role === 'STATE_ADMIN') {
        // Full tenant visibility
      } else if (scope.role === 'VOTER_100_INCHARGE') {
        if (scope.accessibleUnitIds.size > 0) {
          scopeOrConditions.push({ unitId: { in: Array.from(scope.accessibleUnitIds) } });
        }
        if (scope.accessibleBoothIds.size > 0) {
          scopeOrConditions.push({ boothId: { in: Array.from(scope.accessibleBoothIds) } });
        }
      } else {
        if (scope.accessibleUnitIds.size > 0) {
          scopeOrConditions.push({ unitId: { in: Array.from(scope.accessibleUnitIds) } });
        }
        if (scope.accessibleConstituencyIds.size > 0) {
          scopeOrConditions.push({ constituencyId: { in: Array.from(scope.accessibleConstituencyIds) } });
        }
        if (scope.accessibleMandalIds.size > 0) {
          scopeOrConditions.push({ mandalId: { in: Array.from(scope.accessibleMandalIds) } });
        }
        if (scope.accessibleVillageIds.size > 0) {
          scopeOrConditions.push({ villageId: { in: Array.from(scope.accessibleVillageIds) } });
        }
        if (scope.accessibleBoothIds.size > 0) {
          scopeOrConditions.push({ boothId: { in: Array.from(scope.accessibleBoothIds) } });
        }
      }

      where.AND = [
        orgFilter,
        ...(scopeOrConditions.length > 0 && scope.role !== 'HIGH_COMMAND' && scope.role !== 'STATE_ADMIN'
          ? [{ OR: scopeOrConditions }]
          : []),
      ];
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
    if (!scope) return false;
    if (scope.isGlobalScope) return true;
    if (!scope.organisationId) return false;

    // Verify tenant ownership
    const belongsToOrg =
      task.createdBy?.organisationId === scope.organisationId ||
      task.assignee?.organisationId === scope.organisationId ||
      task.constituency?.parliament?.zone?.state?.organisationId === scope.organisationId ||
      task.mandal?.constituency?.parliament?.zone?.state?.organisationId === scope.organisationId ||
      task.village?.mandal?.constituency?.parliament?.zone?.state?.organisationId === scope.organisationId ||
      task.booth?.village?.mandal?.constituency?.parliament?.zone?.state?.organisationId === scope.organisationId;

    if (!belongsToOrg) return false;

    // High Command and State Admin have full access within their tenant
    if (scope.role === 'HIGH_COMMAND' || scope.role === 'STATE_ADMIN') return true;

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
        constituency: { include: { parliament: { include: { zone: { include: { state: true } } } } } },
        mandal: { include: { constituency: { include: { parliament: { include: { zone: { include: { state: true } } } } } } } },
        village: { include: { mandal: { include: { constituency: { include: { parliament: { include: { zone: { include: { state: true } } } } } } } } } },
        booth: { include: { village: { include: { mandal: { include: { constituency: { include: { parliament: { include: { zone: { include: { state: true } } } } } } } } } } } },
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
      if (!scope.organisationId) {
        const err: any = new Error('Tenant context required');
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
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
    const TASK_ACCESS_INCLUDE = {
      createdBy: true,
      assignee: true,
      assignments: { include: { user: true } },
      constituency: { include: { parliament: { include: { zone: { include: { state: true } } } } } },
      mandal: { include: { constituency: { include: { parliament: { include: { zone: { include: { state: true } } } } } } } },
      village: { include: { mandal: { include: { constituency: { include: { parliament: { include: { zone: { include: { state: true } } } } } } } } } },
      booth: { include: { village: { include: { mandal: { include: { constituency: { include: { parliament: { include: { zone: { include: { state: true } } } } } } } } } } } },
    };

    const existing = await prisma.task.findUnique({
      where: { id },
      include: TASK_ACCESS_INCLUDE,
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
    const TASK_ACCESS_INCLUDE = {
      createdBy: true,
      assignee: true,
      assignments: { include: { user: true } },
      constituency: { include: { parliament: { include: { zone: { include: { state: true } } } } } },
      mandal: { include: { constituency: { include: { parliament: { include: { zone: { include: { state: true } } } } } } } },
      village: { include: { mandal: { include: { constituency: { include: { parliament: { include: { zone: { include: { state: true } } } } } } } } } },
      booth: { include: { village: { include: { mandal: { include: { constituency: { include: { parliament: { include: { zone: { include: { state: true } } } } } } } } } } } },
    };

    const task = await prisma.task.findUnique({
      where: { id },
      include: TASK_ACCESS_INCLUDE,
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
    const TASK_ACCESS_INCLUDE = {
      createdBy: true,
      assignee: true,
      assignments: { include: { user: true } },
      constituency: { include: { parliament: { include: { zone: { include: { state: true } } } } } },
      mandal: { include: { constituency: { include: { parliament: { include: { zone: { include: { state: true } } } } } } } },
      village: { include: { mandal: { include: { constituency: { include: { parliament: { include: { zone: { include: { state: true } } } } } } } } } },
      booth: { include: { village: { include: { mandal: { include: { constituency: { include: { parliament: { include: { zone: { include: { state: true } } } } } } } } } } } },
    };

    const existing = await prisma.task.findUnique({
      where: { id },
      include: TASK_ACCESS_INCLUDE,
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
