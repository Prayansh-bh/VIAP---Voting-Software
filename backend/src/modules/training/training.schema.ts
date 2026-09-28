import { z } from 'zod';
import { RoleType, TrainingStatus } from '@prisma/client';

export const createTrainingVideoSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(2),
  category: z.string().min(2),
  duration: z.string().min(1),
  videoUrl: z.string().optional(),
  youtubeId: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  sortOrder: z.number().default(0),
});

export const updateTrainingVideoSchema = createTrainingVideoSchema.partial();

export const assignTrainingSchema = z.object({
  targetRole: z.nativeEnum(RoleType).optional(),
  userIds: z.array(z.string().uuid()).optional(),
});

export const updateTrainingProgressSchema = z.object({
  status: z.nativeEnum(TrainingStatus),
  quizScore: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});
