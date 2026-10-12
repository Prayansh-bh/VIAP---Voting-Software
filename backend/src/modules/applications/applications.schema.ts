import { z } from 'zod';
import { RoleType } from '@prisma/client';

export const hierarchyLevelEnum = z.enum([
  'STATE',
  'ZONE',
  'PARLIAMENT',
  'CONSTITUENCY',
  'MANDAL',
  'VILLAGE',
  'BOOTH',
  'VOTER_GROUP',
  'VOTER',
]);

export const validateDataSchema = z.object({
  level: hierarchyLevelEnum.default('VOTER'),
  rows: z.array(z.record(z.string(), z.any())).min(1, 'At least one data row is required'),
  targetConstituencyId: z.string().optional(),
  columnMapping: z.record(z.string(), z.string()).optional(),
  fileName: z.string().optional(),
});

export const importDataSchema = z.object({
  level: hierarchyLevelEnum.default('VOTER'),
  rows: z.array(z.record(z.string(), z.any())).min(1, 'At least one data row is required'),
  targetConstituencyId: z.string().optional(),
  columnMapping: z.record(z.string(), z.string()).optional(),
  importMode: z.enum(['APPEND', 'REPLACE']).default('APPEND'),
  voterGroupSize: z.number().int().min(10).max(500).default(100),
  fileName: z.string().optional().default('import_data.xlsx'),
  fileSize: z.number().optional().default(0),
});

export const mappingSchema = z.object({
  headers: z.array(z.string()).min(1, 'At least one header column is required'),
});

export const assignInchargeSchema = z.object({
  userId: z.string().optional(),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  mobileNumber: z.string().min(10, 'Mobile number must be at least 10 digits').optional(),
  email: z.string().email().optional(),
  role: z.nativeEnum(RoleType),
  unitLevel: z.enum([
    'STATE',
    'ZONE',
    'PARLIAMENT',
    'CONSTITUENCY',
    'MANDAL',
    'VILLAGE',
    'BOOTH',
    'VOTER_GROUP',
  ]),
  unitId: z.string().min(1, 'Target unitId is required'),
  parentUnitId: z.string().optional(),
  reason: z.string().optional(),
});

export const updateInchargeSchema = z.object({
  unitLevel: z.enum([
    'STATE',
    'ZONE',
    'PARLIAMENT',
    'CONSTITUENCY',
    'MANDAL',
    'VILLAGE',
    'BOOTH',
    'VOTER_GROUP',
  ]).optional(),
  unitId: z.string().optional(),
  isActive: z.boolean().optional(),
  role: z.nativeEnum(RoleType).optional(),
  reason: z.string().optional(),
});
