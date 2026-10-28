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

export const manualRosterEntrySchema = z.object({
  unitKey: z.string().optional(),
  slotCode: z.string().optional(),
  level: z.enum(['MANDAL', 'POLLING_STATION', 'BOOTH', '100_VOTER_GROUP']).optional(),
  inchargeName: z.string().optional(),
  mobileNumber: z.string().min(10, 'Mobile number must be at least 10 digits'),
  passcode: z.string().optional(),
});

export const manualRosterSubmissionSchema = z.object({
  partyCode: z.string().optional(),
  defaultPasscode: z.string().optional(),
  entries: z.array(manualRosterEntrySchema).min(1, 'At least one incharge entry is required'),
});
