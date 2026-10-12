import { z } from 'zod';

export const createCadreSchema = z.object({
  userId: z.string().uuid(),
  skills: z.array(z.string()).default([]),
  badges: z.array(z.string()).default([]),
  performanceScore: z.number().min(0).max(100).default(80),
});

export const updateCadreSchema = z.object({
  skills: z.array(z.string()).optional(),
  badges: z.array(z.string()).optional(),
  performanceScore: z.number().min(0).max(100).optional(),
});
