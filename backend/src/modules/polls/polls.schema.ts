import { z } from 'zod';
import { OrgHierarchyLevel } from '@prisma/client';

export const createPollSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().optional(),
  targetLevel: z.nativeEnum(OrgHierarchyLevel).optional(),
  unitId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
  options: z.array(z.string().min(1)).min(2),
});

export const votePollSchema = z.object({
  optionId: z.string().uuid(),
});

export type CreatePollDto = z.infer<typeof createPollSchema>;
export type VotePollDto = z.infer<typeof votePollSchema>;
