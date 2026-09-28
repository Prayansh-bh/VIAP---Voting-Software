import { z } from 'zod';
import { OrgHierarchyLevel, TaskPriority, TaskStatus } from '@prisma/client';

export const createTaskSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  instructions: z.string().optional(),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  dueDate: z.string().datetime().optional(),
  sourceLevel: z.nativeEnum(OrgHierarchyLevel).default(OrgHierarchyLevel.CONSTITUENCY),
  targetLevel: z.nativeEnum(OrgHierarchyLevel).default(OrgHierarchyLevel.VOTER_GROUP),
  constituencyId: z.string().uuid().optional(),
  mandalId: z.string().uuid().optional(),
  villageId: z.string().uuid().optional(),
  boothId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  assignedUserIds: z.array(z.string().uuid()).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueDate: z.string().datetime().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
});

export const assignTaskSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
});

export const updateTaskStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus),
  comments: z.string().optional(),
});
