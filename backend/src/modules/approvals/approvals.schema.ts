import { z } from 'zod';

export const ApprovalTypeEnum = z.enum([
  'USER_REGISTRATION',
  'INCHARGE_APPROVAL',
  'DATA_SUBMISSION',
  'SURVEY_APPROVAL',
  'TRANSFER_APPROVAL',
  'DATA_CORRECTION',
]);

export const ApprovalStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED']);

export const createApprovalSchema = z.object({
  partyId: z.string().optional(),
  type: ApprovalTypeEnum,
  title: z.string().min(2),
  description: z.string().optional(),
  entityId: z.string().optional(),
  entityType: z.string().optional(),
  payload: z.record(z.string(), z.any()).default({}),
  requestedByName: z.string().optional(),
  requestedByRole: z.string().optional(),
  requestedByMobile: z.string().optional(),
});

export const rejectApprovalSchema = z.object({
  reason: z.string().min(2, 'Rejection reason is required'),
});

export type ApprovalType = z.infer<typeof ApprovalTypeEnum>;
export type ApprovalStatus = z.infer<typeof ApprovalStatusEnum>;
export type CreateApprovalDto = z.infer<typeof createApprovalSchema>;
