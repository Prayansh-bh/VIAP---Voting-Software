import { z } from 'zod';
import { FakeVoterStatus, Gender, RelationType, SurveyStatus, VoterLocationStatus, VoterStatus, VoteStatus } from '@prisma/client';

export const voterQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
  epicNumber: z.string().optional(),
  name: z.string().optional(),
  mobileNumber: z.string().optional(),
  serialNumber: z.coerce.number().optional(),
  houseNumber: z.string().optional(),
  constituencyId: z.string().uuid().optional(),
  mandalId: z.string().uuid().optional(),
  villageId: z.string().uuid().optional(),
  boothId: z.string().uuid().optional(),
  voterGroupId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  assignedInchargeId: z.string().uuid().optional(),
  voterStatus: z.nativeEnum(VoterStatus).optional(),
  surveyStatus: z.nativeEnum(SurveyStatus).optional(),
  voteStatus: z.nativeEnum(VoteStatus).optional(),
  voterLocationStatus: z.nativeEnum(VoterLocationStatus).optional(),
  politicalPreference: z.string().optional(),
  caste: z.string().optional(),
  sortBy: z.enum(['serialNumber', 'name', 'age', 'epicNumber', 'createdAt', 'updatedAt', 'voteDoneTime']).default('serialNumber'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const createVoterSchema = z.object({
  serialNumber: z.number().optional(),
  epicNumber: z.string().min(3),
  name: z.string().min(2),
  fatherHusbandName: z.string().min(2),
  relationType: z.nativeEnum(RelationType).default(RelationType.FATHER),
  houseNumber: z.string().min(1),
  age: z.number().min(18).max(120),
  gender: z.nativeEnum(Gender),
  mobileNumber: z.string().optional(),
  constituencyId: z.string().uuid().optional(),
  mandalId: z.string().uuid().optional(),
  villageId: z.string().uuid().optional(),
  boothId: z.string().uuid().optional(),
  voterGroupId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  assignedInchargeId: z.string().uuid().optional(),
  caste: z.string().optional(),
  subCaste: z.string().optional(),
  profession: z.string().optional(),
  politicalPreference: z.string().default('NEUTRAL'),
  voterStatus: z.nativeEnum(VoterStatus).default(VoterStatus.ACTIVE),
  surveyStatus: z.nativeEnum(SurveyStatus).default(SurveyStatus.NOT_SURVEYED),
  voterLocationStatus: z.nativeEnum(VoterLocationStatus).default(VoterLocationStatus.LOCAL),
  currentLocation: z.string().optional(),
  notes: z.string().optional(),
});

export const updateVoterSchema = createVoterSchema.partial();

export const updateVoterStatusSchema = z.object({
  status: z.nativeEnum(VoterStatus),
  reason: z.string().optional(),
});

export const flagFakeVoterSchema = z.object({
  reason: z.string().min(3),
  evidenceUrl: z.string().url().optional(),
  status: z.nativeEnum(FakeVoterStatus).default(FakeVoterStatus.FLAGGED),
});

export const updateMigrationSchema = z.object({
  status: z.nativeEnum(VoterLocationStatus),
  destinationCity: z.string().min(2),
  destinationState: z.string().optional(),
  destinationCountry: z.string().default('India'),
  contactInCity: z.string().optional(),
  travelRequired: z.boolean().default(false),
  transportArranged: z.boolean().default(false),
  returnPlannedDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export type VoterQueryDto = z.infer<typeof voterQuerySchema>;
export type CreateVoterDto = z.infer<typeof createVoterSchema>;
export type UpdateVoterDto = z.infer<typeof updateVoterSchema>;
export type UpdateVoterStatusDto = z.infer<typeof updateVoterStatusSchema>;
export type FlagFakeVoterDto = z.infer<typeof flagFakeVoterSchema>;
export type UpdateMigrationDto = z.infer<typeof updateMigrationSchema>;
