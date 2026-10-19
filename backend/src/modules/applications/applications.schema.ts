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

export const updateApplicationSchema = z.object({
  name: z.string().min(2, 'Application name must be at least 2 characters').max(100).optional(),
  party: z.string().min(2, 'Party name must be at least 2 characters').max(100).optional(),
  partyCode: z.string().min(2, 'Party code must be at least 2 characters').max(15).optional(),
  leaderName: z.string().max(100).optional(),
  jurisdiction: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  slogan: z.string().max(500).optional(),
  headerTitle: z.string().max(200).optional(),
  primaryColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid primary color format').optional(),
  secondaryColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid secondary color format').optional(),
  accentColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid accent color format').optional(),
  logoUrl: z.string().optional(),
  activeHierarchyLevels: z.array(z.string()).min(1, 'At least one hierarchy tier must remain enabled').optional(),
  hierarchyLevels: z.array(z.string()).min(1, 'At least one hierarchy level required').optional(),
  stateName: z.string().optional(),
  appScope: z.enum(['SINGLE_MLA', 'PARLIAMENT_MP', 'ZONE', 'STATE']).optional(),
  parliamentName: z.string().optional(),
  parliamentCode: z.string().optional(),
  hierarchyLabels: z.record(z.string(), z.string()).optional(),
  featureToggles: z.record(z.string(), z.boolean()).optional(),
  dashboardConfig: z.record(z.string(), z.any()).optional(),
  analyticsConfig: z.record(z.string(), z.any()).optional(),
  aiEnabled: z.boolean().optional(),
  politicalParties: z.array(z.object({
    name: z.string().min(1),
    code: z.string().min(1),
    shortName: z.string().optional(),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional().nullable(),
    accentColor: z.string().optional().nullable(),
    symbolName: z.string().optional().nullable(),
    logoUrl: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().optional(),
  })).optional(),
  newTierIncharges: z.array(z.object({
    tierLevel: z.string(),
    role: z.string().optional(),
    name: z.string().min(1, 'Incharge name is required'),
    mobileNumber: z.string().min(10, 'Valid 10-digit mobile number is required'),
    unitName: z.string().optional(),
  })).optional(),
}).strict();

export type UpdateApplicationDto = z.infer<typeof updateApplicationSchema>;

