import { z } from 'zod';

export const createStateSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  capital: z.string().optional(),
  organisationId: z.string().uuid().optional(),
});

export const createZoneSchema = z.object({
  stateId: z.string().uuid(),
  name: z.string().min(2),
  code: z.string().min(2),
  headquarters: z.string().optional(),
});

export const createParliamentSchema = z.object({
  zoneId: z.string().uuid(),
  name: z.string().min(2),
  code: z.string().min(2),
  parliamentNumber: z.number().optional(),
});

export const createConstituencySchema = z.object({
  parliamentId: z.string().uuid(),
  name: z.string().min(2),
  code: z.string().min(2),
  constituencyNumber: z.number().optional(),
  isReservedSC: z.boolean().default(false),
  isReservedST: z.boolean().default(false),
});

export const createMandalSchema = z.object({
  constituencyId: z.string().uuid(),
  name: z.string().min(2),
  code: z.string().min(2),
  mandalNumber: z.number().optional(),
});

export const createVillageSchema = z.object({
  mandalId: z.string().uuid(),
  name: z.string().min(2),
  code: z.string().min(2),
  isPanchayat: z.boolean().default(true),
});

export const createBoothSchema = z.object({
  villageId: z.string().uuid(),
  boothNumber: z.string().min(1),
  name: z.string().min(2),
  code: z.string().min(2),
  pollingStation: z.string().optional(),
  totalVoters: z.number().default(1000),
});

export const createVoterInchargeSchema = z.object({
  boothId: z.string().uuid(),
  name: z.string().min(2),
  code: z.string().min(2),
  rangeStart: z.number().default(1),
  rangeEnd: z.number().default(100),
  assignedInchargeId: z.string().uuid().optional(),
});
