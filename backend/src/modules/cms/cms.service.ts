import { AuditAction, OrgHierarchyLevel, Prisma, RoleType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { saveAsset } from '../../lib/storage.js';
import { prisma } from '../../lib/prisma.js';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value?: string | null): value is string {
  return Boolean(value && UUID_RE.test(value));
}

const DEFAULT_FEATURE_TOGGLES = {
  voterManagement: true,
  fakeVoterFlagging: true,
  migrationTracking: true,
  liveVoteTracking: true,
  casteAnalytics: true,
  cadreNetwork: true,
  training: true,
  tasks: true,
  groundReports: true,
  aiStrategicIntelligence: true,
  electionProjection: true,
};

const DEFAULT_HIERARCHY_LABELS: Record<string, string> = {
  STATE: 'State Incharge',
  ZONE: 'Zone Coordinator',
  PARLIAMENT: 'Parliament Incharge',
  CONSTITUENCY: 'Constituency Incharge',
  MANDAL: 'Mandal President',
  VILLAGE: 'Village Incharge',
  BOOTH: 'Booth President',
  VOTER_GROUP: '100 Voters Incharge',
};

const DEFAULT_DASHBOARD_CONFIG = {
  CONSTITUENCY_INCHARGE: {
    showPulseBar: true,
    showMetricsGrid: true,
    showVoterDirectory: true,
    showLiveVotingHub: true,
    showWarRoomProjections: true,
    showCadreOperations: true,
    showGroundIntelligence: true,
    showAIStrategicCenter: true,
  },
  MANDAL_INCHARGE: {
    showPulseBar: true,
    showMetricsGrid: true,
    showVoterDirectory: true,
    showLiveVotingHub: true,
    showVillageBreakdown: true,
    showCadreOperations: true,
    showGroundIntelligence: true,
  },
  VILLAGE_INCHARGE: {
    showPulseBar: true,
    showMetricsGrid: true,
    showVoterDirectory: true,
    showLiveVotingHub: true,
    showBoothList: true,
    showCadreOperations: true,
  },
  BOOTH_PRESIDENT: {
    showPulseBar: true,
    showMetricsGrid: true,
    showVoterDirectory: true,
    showLiveVotingHub: true,
    showInchargeClusters: true,
  },
  VOTER_100_INCHARGE: {
    showPulseBar: true,
    showMetricsGrid: true,
    showVoterChecklist: true,
    showLiveTurnoutLogger: true,
    showSurveyForm: true,
  },
};

const DEFAULT_ANALYTICS_CONFIG = {
  electionYear: 2024,
  targetSeats: 175,
  majorityMark: 88,
  leadParty: 'TDP',
  challengerParty: 'YSRCP',
  projectionConfidence: 0.92,
  trackedParties: ['TDP', 'YSRCP', 'JSP', 'BJP', 'INC', 'NEUTRAL', 'OTH'],
};

export function normalizeFeatureToggles(raw: unknown): Record<string, boolean> {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    ...DEFAULT_FEATURE_TOGGLES,
    voterManagement: Boolean(src.voterManagement ?? true),
    fakeVoterFlagging: Boolean(src.fakeVoterFlagging ?? src.enableFakeVoterDetection ?? true),
    migrationTracking: Boolean(src.migrationTracking ?? src.enableMigratedOutreach ?? true),
    liveVoteTracking: Boolean(src.liveVoteTracking ?? src.enableLiveVoteTracking ?? true),
    casteAnalytics: Boolean(src.casteAnalytics ?? true),
    cadreNetwork: Boolean(src.cadreNetwork ?? src.enableCadreRating ?? true),
    training: Boolean(src.training ?? true),
    tasks: Boolean(src.tasks ?? true),
    groundReports: Boolean(src.groundReports ?? true),
    aiStrategicIntelligence: Boolean(src.aiStrategicIntelligence ?? src.enableAIIntelligence ?? true),
    electionProjection: Boolean(src.electionProjection ?? true),
  };
}

export function normalizeHierarchyLabels(raw: unknown): Record<string, string> {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, string>;
  const mapped: Record<string, string> = { ...DEFAULT_HIERARCHY_LABELS };
  for (const [key, value] of Object.entries(src)) {
    if (!value) continue;
    const upper = key.toUpperCase() === 'VOTERGROUP' ? 'VOTER_GROUP' : key.toUpperCase();
    mapped[upper] = value;
  }
  if (mapped.VOTER_GROUP === 'Indiramma Incharge (100 Voters)' || mapped.VOTER_GROUP?.includes('Indiramma')) {
    mapped.VOTER_GROUP = '100 Voters Incharge';
  }
  return mapped;
}

export type CmsConfigInput = {
  id?: string;
  applicationId?: string;
  configKey?: string;
  organisationId?: string | null;
  organisationName?: string;
  headerTitle?: string;
  slogan?: string;
  logoUrl?: string;
  faviconUrl?: string;
  stateName?: string;
  defaultLanguage?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  activePartyCode?: string;
  appScope?: string;
  parliamentName?: string;
  parliamentCode?: string;
  candidateName?: string;
  hierarchyLabels?: Record<string, string>;
  featureToggles?: Record<string, boolean>;
  activeHierarchyLevels?: string[];
  dashboardConfig?: Record<string, any>;
  analyticsConfig?: Record<string, any>;
  aiEnabled?: boolean;
};

export function serializeCmsConfig(
  row: any,
  extras: { constituencies?: any[]; parties?: any[]; tierIncharges?: any[] } = {},
) {
  const activeParty =
    extras.parties?.find((p) => p.code === row?.activePartyCode) || extras.parties?.[0];

  return {
    id: row?.id,
    organisationId: row?.organisationId,
    configKey: row?.configKey,
    organisationName: row?.organisationName || row?.organisation?.name || 'Political Connect',
    headerTitle: row?.headerTitle || row?.organisationName || row?.organisation?.name || 'Political Connect',
    slogan: row?.slogan || '',
    logoUrl: row?.logoUrl || row?.organisation?.logoUrl || activeParty?.logoUrl || '',
    faviconUrl: row?.faviconUrl || row?.organisation?.faviconUrl || '',
    stateName: row?.stateName || 'Andhra Pradesh',
    defaultLanguage: row?.defaultLanguage || 'en',
    primaryColor: row?.primaryColor || activeParty?.primaryColor || '#eab308',
    secondaryColor: row?.secondaryColor || activeParty?.secondaryColor || '#1e293b',
    accentColor: row?.accentColor || activeParty?.accentColor || '#3b82f6',
    activePartyCode: row?.activePartyCode || activeParty?.code || '',
    appScope: row?.appScope || 'SINGLE_MLA',
    parliamentName: row?.parliamentName || '',
    parliamentCode: row?.parliamentCode || '',
    candidateName: row?.candidateName || '',
    hierarchyLabels: normalizeHierarchyLabels(row?.hierarchyLabels),
    featureToggles: normalizeFeatureToggles(row?.featureToggles),
    activeHierarchyLevels: Array.isArray(row?.activeHierarchyLevels)
      ? row.activeHierarchyLevels
      : ['VOTER_GROUP', 'BOOTH', 'VILLAGE', 'MANDAL', 'CONSTITUENCY'],
    dashboardConfig: (row?.dashboardConfig as Record<string, any>) || DEFAULT_DASHBOARD_CONFIG,
    analyticsConfig: (row?.analyticsConfig as Record<string, any>) || DEFAULT_ANALYTICS_CONFIG,
    aiEnabled: row?.aiEnabled ?? true,
    constituencies: extras.constituencies || [],
    tierIncharges: extras.tierIncharges || [],
  };
}

export async function persistCmsConfig(input: CmsConfigInput, client: Prisma.TransactionClient = prisma) {
  let targetKey = (input.configKey || '').trim().toLowerCase();
  const inputId = input.id || input.applicationId;
  const isTargetKeyUuid = targetKey ? isUuid(targetKey) : false;

  // If organisationId is provided, resolve organization and derive tenant-scoped key if needed
  let org: any = null;
  if (input.organisationId) {
    org = await client.organisation.findUnique({
      where: { id: input.organisationId },
    });
    if (!org) {
      const err: any = new Error(`Organisation '${input.organisationId}' not found.`);
      err.statusCode = 404;
      err.code = 'ORGANISATION_NOT_FOUND';
      throw err;
    }
    if (!targetKey && !inputId && org) {
      targetKey = org.code.toLowerCase();
    }
  }

  if (!targetKey && !inputId && !input.organisationId) {
    targetKey = 'default';
  }

  // Application-specific canonical lookup: Prioritize id or configKey to prevent
  // multi-application configuration collision under the same organisation
  let existing: any = null;
  if (inputId) {
    existing = await client.cMSConfiguration.findUnique({
      where: { id: inputId },
    });
    if (!existing) {
      const err: any = new Error(`Application configuration '${inputId}' not found.`);
      err.statusCode = 404;
      err.code = 'APPLICATION_NOT_FOUND';
      throw err;
    }
    if (input.organisationId && existing.organisationId && existing.organisationId !== input.organisationId) {
      const err: any = new Error(`Application '${inputId}' does not belong to organisation '${input.organisationId}'.`);
      err.statusCode = 403;
      err.code = 'FORBIDDEN_APPLICATION_ACCESS';
      throw err;
    }
  }
  if (!existing && targetKey && targetKey !== 'default') {
    existing = await client.cMSConfiguration.findFirst({
      where: {
        OR: [
          ...(isTargetKeyUuid ? [{ id: targetKey }] : []),
          { configKey: targetKey },
        ],
      },
    });
  }
  if (!existing && input.organisationId && (!input.configKey || input.configKey === 'default') && !inputId) {
    existing = await client.cMSConfiguration.findFirst({
      where: { organisationId: input.organisationId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  const nextFeatureToggles = input.featureToggles
    ? normalizeFeatureToggles({
        ...(existing?.featureToggles as object),
        ...input.featureToggles,
      })
    : existing
      ? normalizeFeatureToggles(existing.featureToggles)
      : DEFAULT_FEATURE_TOGGLES;

  const nextLabels = input.hierarchyLabels
    ? normalizeHierarchyLabels({
        ...(existing?.hierarchyLabels as object),
        ...input.hierarchyLabels,
      })
    : existing
      ? normalizeHierarchyLabels(existing.hierarchyLabels)
      : DEFAULT_HIERARCHY_LABELS;

  const data: Prisma.CMSConfigurationUncheckedCreateInput = {
    configKey: existing?.configKey || targetKey,
    organisationId: input.organisationId ?? existing?.organisationId ?? undefined,
    organisationName: input.organisationName || org?.name || existing?.organisationName || 'Political Connect',
    stateName: input.stateName || existing?.stateName || 'Andhra Pradesh',
    defaultLanguage: input.defaultLanguage || existing?.defaultLanguage || 'en',
    headerTitle: input.headerTitle ?? existing?.headerTitle ?? input.organisationName ?? org?.name,
    slogan: input.slogan ?? existing?.slogan,
    logoUrl: input.logoUrl ?? existing?.logoUrl ?? org?.logoUrl,
    faviconUrl: input.faviconUrl ?? existing?.faviconUrl,
    primaryColor: input.primaryColor ?? existing?.primaryColor,
    secondaryColor: input.secondaryColor ?? existing?.secondaryColor,
    accentColor: input.accentColor ?? existing?.accentColor,
    activePartyCode: input.activePartyCode ?? existing?.activePartyCode,
    appScope: input.appScope ?? existing?.appScope ?? 'SINGLE_MLA',
    parliamentName: input.parliamentName ?? existing?.parliamentName,
    parliamentCode: input.parliamentCode ?? existing?.parliamentCode,
    candidateName: input.candidateName ?? existing?.candidateName,
    hierarchyLabels: nextLabels as Prisma.InputJsonValue,
    featureToggles: nextFeatureToggles as Prisma.InputJsonValue,
    activeHierarchyLevels: (input.activeHierarchyLevels ||
      existing?.activeHierarchyLevels ||
      ['VOTER_GROUP', 'BOOTH', 'VILLAGE', 'MANDAL', 'CONSTITUENCY']) as Prisma.InputJsonValue,
    dashboardConfig: (input.dashboardConfig || existing?.dashboardConfig || DEFAULT_DASHBOARD_CONFIG) as Prisma.InputJsonValue,
    analyticsConfig: (input.analyticsConfig || existing?.analyticsConfig || DEFAULT_ANALYTICS_CONFIG) as Prisma.InputJsonValue,
    aiEnabled: input.aiEnabled ?? existing?.aiEnabled ?? true,
  };

  const saved = await client.cMSConfiguration.upsert({
    where: { configKey: existing?.configKey || targetKey },
    update: data,
    create: data,
    include: { organisation: true },
  });

  // Sync back to Organisation entity if organisationId is linked
  if (input.organisationId) {
    await client.organisation.update({
      where: { id: input.organisationId },
      data: {
        ...(input.organisationName ? { name: input.organisationName } : {}),
        ...(input.logoUrl ? { logoUrl: input.logoUrl } : {}),
      },
    }).catch(() => {});
  }

  return saved;
}

export async function loadCmsBundle(options?: {
  organisationId?: string;
  configKey?: string;
  applicationId?: string;
  allowDefaultFallback?: boolean;
}) {
  let config: any = null;
  const rawTarget = options?.applicationId || options?.configKey;
  const isTargetUuid = rawTarget ? isUuid(rawTarget) : false;
  const isExplicitAppRequested = Boolean(
    options?.applicationId ||
    (options?.configKey && options.configKey.trim().toLowerCase() !== 'default')
  );

  // 1. If explicit applicationId or UUID configKey is provided, find that specific application first
  if (rawTarget && isTargetUuid) {
    config = await prisma.cMSConfiguration.findFirst({
      where: {
        id: rawTarget,
        ...(options?.organisationId ? { organisationId: options.organisationId } : {}),
      },
      include: { organisation: true },
    });
  }

  // 2. If a specific slug or party code is provided, query by configKey / party code
  if (!config && options?.configKey && !isTargetUuid) {
    const searchKey = options.configKey.trim();
    config = await prisma.cMSConfiguration.findFirst({
      where: {
        AND: [
          ...(options?.organisationId ? [{ organisationId: options.organisationId }] : []),
          {
            OR: [
              { configKey: searchKey.toLowerCase() },
              { activePartyCode: { equals: searchKey, mode: 'insensitive' } },
              { organisation: { code: { equals: searchKey, mode: 'insensitive' } } },
              { organisationName: { contains: searchKey, mode: 'insensitive' } },
            ],
          },
        ],
      },
      include: { organisation: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // If a specific application was requested but not found, DO NOT fall back to default or other tenants!
  if (!config && isExplicitAppRequested && !options?.allowDefaultFallback) {
    const err: any = new Error(`Application '${rawTarget}' not found`);
    err.statusCode = 404;
    err.code = 'APPLICATION_NOT_FOUND';
    throw err;
  }

  // 3. Only if no specific application identity was matched, resolve by organisationId
  if (!config && options?.organisationId) {
    config = await prisma.cMSConfiguration.findFirst({
      where: { organisationId: options.organisationId },
      include: { organisation: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!config) {
      const org = await prisma.organisation.findUnique({
        where: { id: options.organisationId },
      });
      if (org) {
        config = await persistCmsConfig({
          configKey: org.code.toLowerCase(),
          organisationId: org.id,
          organisationName: org.name,
          headerTitle: org.name,
          logoUrl: org.logoUrl || undefined,
          primaryColor: '#eab308',
          stateName: 'Andhra Pradesh',
        });
      } else {
        const err: any = new Error(`Organisation '${options.organisationId}' not found.`);
        err.statusCode = 404;
        err.code = 'ORGANISATION_NOT_FOUND';
        throw err;
      }
    }
  }

  // 4. Safe global default ONLY for flows explicitly designed to use it (no specific app or tenant scope requested)
  if (!config && !options?.organisationId && !isExplicitAppRequested) {
    config = await prisma.cMSConfiguration.findUnique({
      where: { configKey: 'default' },
      include: { organisation: true },
    });
  }

  if (!config && !options?.organisationId && !isExplicitAppRequested) {
    config = await persistCmsConfig({
      configKey: 'default',
      organisationName: 'Political Connect',
      stateName: 'Andhra Pradesh',
    });
  }

  const orgId = config?.organisationId || options?.organisationId;

  const parties = await prisma.politicalParty.findMany({
    where: {
      isActive: true,
      NOT: {
        code: { startsWith: 'TEST_' },
      },
      ...(orgId ? { organisationId: orgId } : {}),
    },
    orderBy: { sortOrder: 'asc' },
  });

  const announcements = await prisma.announcement.findMany({
    where: {
      ...(orgId ? { OR: [{ organisationId: orgId }, { organisationId: null }] } : {}),
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  let constituencies: any[] = [];
  if (orgId) {
    constituencies = await prisma.constituency.findMany({
      where: {
        parliament: {
          zone: {
            state: {
              organisationId: orgId,
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        code: true,
        totalVoters: true,
        parliament: { select: { id: true, name: true, code: true } },
        _count: { select: { mandals: true, voters: true } },
      },
      orderBy: { name: 'asc' },
    });
  } else {
    constituencies = await prisma.constituency.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        totalVoters: true,
        parliament: { select: { id: true, name: true, code: true } },
        _count: { select: { mandals: true, voters: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  let tierIncharges: Array<{
    tierLevel: string;
    role: string;
    name: string;
    mobileNumber: string;
    unitName?: string;
    unitCode?: string;
    unitId?: string;
  }> = [];

  if (orgId) {
    const assignments = await prisma.userHierarchyAssignment.findMany({
      where: {
        isActive: true,
        user: {
          organisationId: orgId,
          accountStatus: 'ACTIVE',
        },
      },
      select: {
        id: true,
        roleType: true,
        user: {
          select: {
            id: true,
            name: true,
            mobileNumber: true,
            role: true,
          },
        },
        stateId: true,
        zoneId: true,
        parliamentId: true,
        constituencyId: true,
        mandalId: true,
        villageId: true,
        boothId: true,
        voterGroupId: true,
        state: { select: { id: true, name: true, code: true } },
        zone: { select: { id: true, name: true, code: true } },
        parliament: { select: { id: true, name: true, code: true } },
        constituency: { select: { id: true, name: true, code: true } },
        mandal: { select: { id: true, name: true, code: true } },
        village: { select: { id: true, name: true, code: true } },
        booth: { select: { id: true, name: true, code: true, boothNumber: true } },
        voterGroup: { select: { id: true, name: true, code: true } },
      },
      orderBy: { assignedAt: 'asc' },
    });

    const roleToTier: Record<string, string> = {
      STATE_ADMIN: 'STATE',
      ZONE_INCHARGE: 'ZONE',
      PARLIAMENT_INCHARGE: 'PARLIAMENT',
      CONSTITUENCY_INCHARGE: 'CONSTITUENCY',
      MANDAL_INCHARGE: 'MANDAL',
      VILLAGE_INCHARGE: 'VILLAGE',
      BOOTH_PRESIDENT: 'BOOTH',
      BOOTH_INCHARGE: 'BOOTH',
      VOTER_100_INCHARGE: 'VOTER_GROUP',
    };

    const seenTiers = new Set<string>();
    for (const a of assignments) {
      const tierLevel = a.stateId && !a.zoneId ? 'STATE'
        : a.zoneId && !a.parliamentId ? 'ZONE'
        : a.parliamentId && !a.constituencyId ? 'PARLIAMENT'
        : a.constituencyId && !a.mandalId ? 'CONSTITUENCY'
        : a.mandalId && !a.villageId ? 'MANDAL'
        : a.villageId && !a.boothId ? 'VILLAGE'
        : a.boothId && !a.voterGroupId ? 'BOOTH'
        : a.voterGroupId ? 'VOTER_GROUP'
        : (roleToTier[a.roleType] || 'CONSTITUENCY');

      const unitName = a.voterGroup?.name || a.booth?.name || a.village?.name || a.mandal?.name || a.constituency?.name || a.parliament?.name || a.zone?.name || a.state?.name;
      const unitCode = a.voterGroup?.code || a.booth?.code || a.village?.code || a.mandal?.code || a.constituency?.code || a.parliament?.code || a.zone?.code || a.state?.code;
      const unitId = a.voterGroupId || a.boothId || a.villageId || a.mandalId || a.constituencyId || a.parliamentId || a.zoneId || a.stateId || undefined;

      if (!seenTiers.has(tierLevel)) {
        seenTiers.add(tierLevel);
        tierIncharges.push({
          tierLevel,
          role: a.roleType,
          name: a.user.name,
          mobileNumber: a.user.mobileNumber,
          unitName: unitName || undefined,
          unitCode: unitCode || undefined,
          unitId: unitId || undefined,
        });
      }
    }

    const directUsers = await prisma.user.findMany({
      where: {
        organisationId: orgId,
        accountStatus: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        mobileNumber: true,
        role: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const u of directUsers) {
      const tierLevel = roleToTier[u.role];
      if (tierLevel && !seenTiers.has(tierLevel)) {
        seenTiers.add(tierLevel);
        tierIncharges.push({
          tierLevel,
          role: u.role,
          name: u.name,
          mobileNumber: u.mobileNumber,
        });
      }
    }
  }

  return {
    config: serializeCmsConfig(config, { constituencies, parties, tierIncharges }),
    rawConfig: config,
    parties,
    announcements,
    constituencies,
    tierIncharges,
  };
}

export { DEFAULT_DASHBOARD_CONFIG, DEFAULT_ANALYTICS_CONFIG, DEFAULT_FEATURE_TOGGLES };

export const tierInchargeInputSchema = z.object({
  tier: z.string().optional(),
  tierLevel: z.string().optional(),
  name: z.string().min(1, 'Incharge name is required'),
  mobileNumber: z.string().min(10, 'Valid 10-digit mobile number is required'),
  role: z.nativeEnum(RoleType).optional(),
  email: z.string().nullish(),
  unitName: z.string().nullish(),
  unitId: z.string().uuid().nullish(),
}).passthrough().refine((data) => data.tier || data.tierLevel, {
  message: 'Tier or tierLevel is required',
});

export const buildApplicationSchema = z.object({
  id: z.string().nullish(),
  appKey: z.string().nullish(),
  appName: z.string().min(1).default('My Application'),
  organisationName: z.string().min(1).default('My Organisation'),
  headerTitle: z.string().nullish(),
  slogan: z.string().nullish(),
  logoUrl: z.string().nullish(),
  faviconUrl: z.string().nullish(),
  stateName: z.string().nullish().default('Andhra Pradesh'),
  primaryColor: z.string().nullish().default('#eab308'),
  secondaryColor: z.string().nullish().default('#1e293b'),
  accentColor: z.string().nullish().default('#3b82f6'),
  activePartyCode: z.string().nullish().default('TDP'),
  appScope: z.enum(['SINGLE_MLA', 'PARLIAMENT_MP', 'ZONE', 'STATE']).default('SINGLE_MLA'),
  activeHierarchyLevels: z.array(z.string()).default(['STATE', 'ZONE', 'PARLIAMENT', 'DISTRICT', 'CONSTITUENCY', 'MANDAL', 'VILLAGE', 'BOOTH', 'VOTER_GROUP']),
  parliamentName: z.string().nullish(),
  parliamentCode: z.string().nullish(),
  constituencies: z.array(z.object({
    id: z.string().nullish(),
    name: z.string().min(1),
    code: z.string().nullish(),
    totalVoters: z.number().nullish(),
    votersCount: z.number().nullish(),
    candidateName: z.string().nullish(),
    mlaName: z.string().nullish(),
    parliamentName: z.string().nullish(),
    candidateEmail: z.string().nullish(),
  }).passthrough()).default([]),
  candidateName: z.string().nullish(),
  candidateMobile: z.string().nullish(),
  candidateEmail: z.string().nullish(),
  tierIncharges: z.array(tierInchargeInputSchema).nullish(),
  password: z.string().nullish(),
  tenantCode: z.string().nullish(),
  politicalParties: z.array(z.object({
    name: z.string().min(1),
    code: z.string().min(1),
    shortName: z.string().nullish(),
    primaryColor: z.string().nullish().default('#eab308'),
    secondaryColor: z.string().nullish(),
    accentColor: z.string().nullish(),
    symbolName: z.string().nullish(),
    logoUrl: z.string().nullish(),
    isActive: z.boolean().default(true),
    sortOrder: z.number().nullish(),
  }).passthrough()).default([]),
  hierarchyLabels: z.record(z.string(), z.string()).nullish(),
  featureToggles: z.record(z.string(), z.boolean()).nullish(),
}).passthrough();

export type BuildApplicationDto = z.infer<typeof buildApplicationSchema>;

export async function provisionApplication(
  body: BuildApplicationDto,
  actor?: any,
) {
  // Pre-compute credential hash outside transaction
  const initialPassword = body.password?.trim();
  const passwordToHash = initialPassword || crypto.randomBytes(32).toString('hex');
  const passwordHash = await bcrypt.hash(passwordToHash, 10);

  const rawCode = (body.tenantCode || body.appKey || `${body.activePartyCode || 'APP'}-${body.appName || 'DEFAULT'}`)
    .replace(/[^A-Za-z0-9]/g, '-')
    .toUpperCase()
    .slice(0, 15);

  // Extract and validate all incoming incharges
  const incomingIncharges = Array.isArray(body.tierIncharges) && body.tierIncharges.length > 0
    ? [...body.tierIncharges]
    : [];

  const rawCandidateMobile = (body as any).candidateMobile?.trim();
  const legacyCandidateMobile = rawCandidateMobile ? rawCandidateMobile.replace(/\D/g, '').slice(-10) : undefined;
  const candidateName = (body as any).candidateName?.trim() || 'Tenant Administrator';
  const candidateEmail = (body as any).candidateEmail?.trim().toLowerCase() || `admin@${(body.appName || 'party').toLowerCase().replace(/[^a-z0-9]/g, '')}.org`;

  const primaryRole = body.appScope === 'STATE'
    ? RoleType.STATE_ADMIN
    : body.appScope === 'ZONE'
    ? RoleType.ZONE_INCHARGE
    : body.appScope === 'PARLIAMENT_MP'
    ? RoleType.PARLIAMENT_INCHARGE
    : RoleType.CONSTITUENCY_INCHARGE;
  const primaryTier = body.appScope === 'STATE'
    ? 'STATE'
    : body.appScope === 'ZONE'
    ? 'ZONE'
    : body.appScope === 'PARLIAMENT_MP'
    ? 'PARLIAMENT'
    : 'CONSTITUENCY';

  if (incomingIncharges.length === 0 && legacyCandidateMobile) {
    incomingIncharges.push({
      tier: primaryTier,
      name: candidateName,
      mobileNumber: legacyCandidateMobile,
      role: primaryRole,
      email: candidateEmail,
    });
  }

  // 1. Validate required fields, phone formats, duplicate numbers within request
  const seenMobiles = new Set<string>();
  for (const incharge of incomingIncharges) {
    const tierKey = ((incharge as any).tierLevel || incharge.tier || 'CONSTITUENCY').toUpperCase();
    if (!incharge.name || !incharge.name.trim()) {
      const err: any = new Error(`Incharge name is required for tier '${tierKey}'.`);
      err.statusCode = 400;
      err.code = 'INVALID_INCHARGE_NAME';
      throw err;
    }
    const cleanMobile = (incharge.mobileNumber || '').replace(/\D/g, '').slice(-10);
    if (cleanMobile.length < 10) {
      const err: any = new Error(`Invalid mobile number '${incharge.mobileNumber}' for tier '${tierKey}'. Must be a valid 10-digit mobile number.`);
      err.statusCode = 400;
      err.code = 'INVALID_PHONE_NUMBER';
      throw err;
    }
    if (seenMobiles.has(cleanMobile)) {
      const err: any = new Error(`Duplicate mobile number '${cleanMobile}' specified for multiple tiers. Each configured tier must have a unique mobile number.`);
      err.statusCode = 400;
      err.code = 'DUPLICATE_PHONE_NUMBER';
      throw err;
    }
    seenMobiles.add(cleanMobile);

    const ALLOWED_TIER_ROLES = [
      RoleType.STATE_ADMIN,
      RoleType.ZONE_INCHARGE,
      RoleType.PARLIAMENT_INCHARGE,
      RoleType.CONSTITUENCY_INCHARGE,
      RoleType.MANDAL_INCHARGE,
      RoleType.VILLAGE_INCHARGE,
      RoleType.BOOTH_PRESIDENT,
      RoleType.BOOTH_INCHARGE,
      RoleType.VOTER_100_INCHARGE,
    ];

    if (incharge.role && !ALLOWED_TIER_ROLES.includes(incharge.role as any)) {
      const err: any = new Error(`Invalid role '${incharge.role}' for tier '${tierKey}'.`);
      err.statusCode = 400;
      err.code = 'INVALID_ROLE';
      throw err;
    }
  }

  // 2. Validate existing accounts: reject duplicate existing phone numbers
  if (seenMobiles.size > 0) {
    const existingUsers = await prisma.user.findMany({
      where: { mobileNumber: { in: Array.from(seenMobiles) } },
      select: { mobileNumber: true },
    });
    if (existingUsers.length > 0) {
      const err: any = new Error(`Mobile number '${existingUsers[0].mobileNumber}' is already registered to an existing account. Duplicate account registration rejected.`);
      err.statusCode = 409;
      err.code = 'EXISTING_ACCOUNT_CONFLICT';
      throw err;
    }
  }

  // Preflight uniqueness check: reject if tenant already exists rather than silently overwriting
  const existingOrg = await prisma.organisation.findFirst({
    where: {
      OR: [
        { code: rawCode },
        { name: { equals: body.organisationName || body.appName, mode: 'insensitive' } },
      ],
    },
  });

  if (existingOrg) {
    const err: any = new Error(`Tenant organization already exists with code '${existingOrg.code}' or name '${existingOrg.name}'. Duplicate provisioning is rejected.`);
    err.statusCode = 409;
    err.code = 'TENANT_ALREADY_EXISTS';
    throw err;
  }

  try {
    const provisionResult = await prisma.$transaction(
      async (tx) => {
        const orgName = (body.organisationName || body.appName).trim();

        // Advisory transaction lock on case-insensitive organization name
        try {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(lower(${orgName})))`;
        } catch {
          // Non-PostgreSQL test fallback
        }

        const inTxExisting = await tx.organisation.findFirst({
          where: {
            OR: [
              { code: rawCode },
              { name: { equals: orgName, mode: 'insensitive' } },
            ],
          },
        });

        if (inTxExisting) {
          const conflictErr: any = new Error(
            `Tenant organization already exists with code '${inTxExisting.code}' or name '${inTxExisting.name}'. Duplicate provisioning is rejected.`
          );
          conflictErr.code = 'TENANT_ALREADY_EXISTS';
          conflictErr.statusCode = 409;
          throw conflictErr;
        }

        // 1. Resolve & permanently persist logo asset if uploaded as base64
        let resolvedLogoUrl = (body.logoUrl || '').trim() || undefined;
        if (resolvedLogoUrl && resolvedLogoUrl.startsWith('data:')) {
          try {
            const commaIdx = resolvedLogoUrl.indexOf(',');
            const base64Str = commaIdx !== -1 ? resolvedLogoUrl.slice(commaIdx + 1) : resolvedLogoUrl;
            const buffer = Buffer.from(base64Str, 'base64');
            const cleanSlug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
            const saved = await saveAsset(buffer, `${cleanSlug}-logo.png`);
            resolvedLogoUrl = saved.assetUrl;
          } catch (e) {
            console.warn('Failed to auto-persist base64 logo in provisionApplication:', e);
          }
        }

        // Create distinct isolated Organisation
        const org = await tx.organisation.create({
          data: {
            name: orgName,
            code: rawCode,
            logoUrl: resolvedLogoUrl,
            isActive: true,
          },
        });

        // 2. Ensure State exists for this organisation
        const targetStateName = body.stateName || 'Andhra Pradesh';
        let stateCode = `${(body.stateName || 'AP').slice(0, 3).toUpperCase()}-${org.code.slice(0, 4)}`;
        const stateCodeCollision = await tx.state.findUnique({ where: { code: stateCode } });
        if (stateCodeCollision) {
          stateCode = `${(body.stateName || 'AP').slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        }
        const state = await tx.state.create({
          data: {
            organisationId: org.id,
            name: targetStateName,
            code: stateCode,
            totalVoters: 0,
          },
        });
        await tx.organizationUnit.upsert({
          where: { code: state.code },
          update: {
            name: `${state.name} (${org.name})`,
            level: OrgHierarchyLevel.STATE,
          },
          create: {
            name: `${state.name} (${org.name})`,
            code: state.code,
            level: OrgHierarchyLevel.STATE,
          },
        });
        const stateUnitRecord = await tx.organizationUnit.findFirst({
          where: { code: state.code, level: OrgHierarchyLevel.STATE },
        });

        // 3. Ensure Zone exists
        const zoneName = `${org.name} Operations Zone`;
        let zoneCode = `ZN-${org.code.slice(0, 4)}-01`;
        const zCollision = await tx.zone.findUnique({ where: { code: zoneCode } });
        if (zCollision) {
          zoneCode = `ZN-${org.code.slice(0, 4)}-${Date.now().toString().slice(-4)}`;
        }
        const zone = await tx.zone.create({
          data: {
            stateId: state.id,
            name: zoneName,
            code: zoneCode,
          },
        });
        await tx.organizationUnit.upsert({
          where: { code: zoneCode },
          update: {
            name: zoneName,
            level: OrgHierarchyLevel.ZONE,
            parentId: stateUnitRecord?.id,
          },
          create: {
            name: zoneName,
            code: zoneCode,
            level: OrgHierarchyLevel.ZONE,
            parentId: stateUnitRecord?.id,
          },
        });
        const zoneUnitRecord = await tx.organizationUnit.findFirst({
          where: { code: zoneCode, level: OrgHierarchyLevel.ZONE },
        });

        // 4. Ensure Parliament exists
        const parliamentName = body.parliamentName || `${org.name} Parliament Lok Sabha`;
        let parliamentCode = body.parliamentCode || `PC-${org.code.slice(0, 4)}-01`;
        const pCollision = await tx.parliament.findUnique({ where: { code: parliamentCode } });
        if (pCollision) {
          parliamentCode = `PC-${org.code.slice(0, 4)}-${Date.now().toString().slice(-4)}`;
        }
        const parliament = await tx.parliament.create({
          data: {
            zoneId: zone.id,
            name: parliamentName,
            code: parliamentCode,
          },
        });
        await tx.organizationUnit.upsert({
          where: { code: parliamentCode },
          update: {
            name: parliamentName,
            level: OrgHierarchyLevel.PARLIAMENT,
            parentId: zoneUnitRecord?.id,
          },
          create: {
            name: parliamentName,
            code: parliamentCode,
            level: OrgHierarchyLevel.PARLIAMENT,
            parentId: zoneUnitRecord?.id,
          },
        });
        const parUnit = await tx.organizationUnit.findFirst({
          where: { code: parliamentCode, level: OrgHierarchyLevel.PARLIAMENT },
        });
        const parUnitRecord = parUnit;

        // 5. Ensure Assembly Constituencies exist
        const rawConstituencies = body.constituencies && body.constituencies.length > 0
          ? body.constituencies
          : [{ name: `${org.name} Assembly Constituency`, code: `AC-${org.code.slice(0, 4)}-01`, totalVoters: 0 }];

        const createdConstituencies = [];
        for (let i = 0; i < rawConstituencies.length; i++) {
          const c = rawConstituencies[i];
          const cleanName = c.name.trim();

          let code = c.code || `AC-${cleanName.slice(0, 4).toUpperCase()}-${org.code.slice(0, 4)}-${i + 1}`;
          const codeCollision = await tx.constituency.findUnique({ where: { code } });
          if (codeCollision) {
            code = `AC-${cleanName.slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}-${i + 1}`;
          }
          const totalVoters = c.totalVoters || (c as any).votersCount || 0;

          const constRecord = await tx.constituency.create({
            data: {
              parliamentId: parliament.id,
              name: cleanName,
              code,
              totalVoters,
            },
          });
          await tx.organizationUnit.upsert({
            where: { code },
            update: {
              name: cleanName,
              level: OrgHierarchyLevel.CONSTITUENCY,
              parentId: parUnit?.id,
            },
            create: {
              name: cleanName,
              code,
              level: OrgHierarchyLevel.CONSTITUENCY,
              parentId: parUnit?.id,
            },
          });

          createdConstituencies.push(constRecord);
        }

        // 6. Sync Political Parties
        const incomingParties = body.politicalParties && body.politicalParties.length > 0
          ? body.politicalParties
          : [{
              name: body.appName || body.organisationName || 'Default Political Party',
              code: (body.activePartyCode || 'TDP').toUpperCase(),
              shortName: (body.activePartyCode || 'TDP').toUpperCase().slice(0, 6),
              primaryColor: body.primaryColor || '#eab308',
              secondaryColor: body.secondaryColor || null,
              accentColor: body.accentColor || null,
              isActive: true,
              sortOrder: 1,
            }];

        for (let i = 0; i < incomingParties.length; i++) {
          const p = incomingParties[i];
          const partyCode = p.code.trim().toUpperCase();
          if (!partyCode) continue;

          const existingParty = await tx.politicalParty.findUnique({ where: { code: partyCode } });
          if (!existingParty) {
            await tx.politicalParty.create({
              data: {
                organisationId: org.id,
                name: p.name,
                code: partyCode,
                shortName: p.shortName || partyCode,
                primaryColor: p.primaryColor || '#eab308',
                secondaryColor: p.secondaryColor || null,
                accentColor: p.accentColor || null,
                symbolName: p.symbolName || null,
                logoUrl: p.logoUrl || null,
                isActive: p.isActive !== false,
                sortOrder: p.sortOrder !== undefined && p.sortOrder !== null ? p.sortOrder : i,
              },
            });
          } else {
            await tx.politicalParty.update({
              where: { id: existingParty.id },
              data: {
                name: p.name,
                shortName: p.shortName || partyCode,
                primaryColor: p.primaryColor || '#eab308',
                secondaryColor: p.secondaryColor || null,
                accentColor: p.accentColor || null,
                symbolName: p.symbolName || null,
                logoUrl: p.logoUrl || null,
                isActive: p.isActive !== false,
                sortOrder: p.sortOrder !== undefined && p.sortOrder !== null ? p.sortOrder : i,
                ...(!existingParty.organisationId ? { organisationId: org.id } : {}),
              },
            });
          }
        }

        // 7. Store / Update CMSConfiguration
        const mergedHierarchyLabels = {
          STATE: 'State',
          ZONE: 'Zone',
          PARLIAMENT: 'Parliament',
          CONSTITUENCY: 'Constituency',
          MANDAL: 'Mandal',
          VILLAGE: 'Village',
          BOOTH: 'Booth',
          VOTER_GROUP: '100-Voter Incharge',
          ...(body.hierarchyLabels || {}),
        };

        const configKey = org.code.toLowerCase();
        const updatedConfig = await tx.cMSConfiguration.upsert({
          where: { configKey },
          update: {
            organisationId: org.id,
            organisationName: org.name,
            headerTitle: body.headerTitle || org.name,
            slogan: body.slogan || `Command War Room for ${org.name}`,
            logoUrl: resolvedLogoUrl,
            stateName: targetStateName,
            primaryColor: body.primaryColor || '#eab308',
            secondaryColor: body.secondaryColor || '#1e293b',
            accentColor: body.accentColor || '#3b82f6',
            activePartyCode: body.activePartyCode || 'TDP',
            appScope: body.appScope || 'SINGLE_MLA',
            parliamentName: parliament.name,
            parliamentCode: parliament.code,
            candidateName,
            activeHierarchyLevels: body.activeHierarchyLevels,
            hierarchyLabels: mergedHierarchyLabels,
            featureToggles: body.featureToggles || DEFAULT_FEATURE_TOGGLES,
            dashboardConfig: DEFAULT_DASHBOARD_CONFIG,
            analyticsConfig: DEFAULT_ANALYTICS_CONFIG,
            aiEnabled: true,
          },
          create: {
            configKey,
            organisationId: org.id,
            organisationName: org.name,
            headerTitle: body.headerTitle || org.name,
            slogan: body.slogan || `Command War Room for ${org.name}`,
            logoUrl: resolvedLogoUrl,
            stateName: targetStateName,
            primaryColor: body.primaryColor || '#eab308',
            secondaryColor: body.secondaryColor || '#1e293b',
            accentColor: body.accentColor || '#3b82f6',
            activePartyCode: body.activePartyCode || 'TDP',
            appScope: body.appScope || 'SINGLE_MLA',
            parliamentName: parliament.name,
            parliamentCode: parliament.code,
            candidateName,
            activeHierarchyLevels: body.activeHierarchyLevels,
            hierarchyLabels: mergedHierarchyLabels,
            featureToggles: body.featureToggles || DEFAULT_FEATURE_TOGGLES,
            dashboardConfig: DEFAULT_DASHBOARD_CONFIG,
            analyticsConfig: DEFAULT_ANALYTICS_CONFIG,
            aiEnabled: true,
          },
        });

        // Hierarchy node linking for all tiers
        const constUnitRecord = createdConstituencies.length > 0
          ? await tx.organizationUnit.findFirst({
              where: { code: createdConstituencies[0].code, level: OrgHierarchyLevel.CONSTITUENCY },
            })
          : null;

        const primaryConstituency = createdConstituencies[0];
        const cleanMandalName = `${primaryConstituency?.name || 'Constituency'} Central Mandal`;
        let mandalCode = `MD-${org.code.slice(0, 4)}-01`;
        const mCollision = await tx.mandal.findUnique({ where: { code: mandalCode } });
        if (mCollision) mandalCode = `MD-${org.code.slice(0, 4)}-${Date.now().toString().slice(-4)}`;
        const mandalRecord = await tx.mandal.create({
          data: {
            constituencyId: primaryConstituency.id,
            name: cleanMandalName,
            code: mandalCode,
            totalVoters: 0,
          },
        });
        const mandalUnitRecord = await tx.organizationUnit.upsert({
          where: { code: mandalCode },
          update: { name: cleanMandalName, level: OrgHierarchyLevel.MANDAL, parentId: constUnitRecord?.id },
          create: { name: cleanMandalName, code: mandalCode, level: OrgHierarchyLevel.MANDAL, parentId: constUnitRecord?.id },
        });

        const cleanVillageName = `${cleanMandalName} Ward 1`;
        let villageCode = `VL-${org.code.slice(0, 4)}-01`;
        const vCollision = await tx.village.findUnique({ where: { code: villageCode } });
        if (vCollision) villageCode = `VL-${org.code.slice(0, 4)}-${Date.now().toString().slice(-4)}`;
        const villageRecord = await tx.village.create({
          data: {
            mandalId: mandalRecord.id,
            name: cleanVillageName,
            code: villageCode,
            totalVoters: 0,
          },
        });
        const villageUnitRecord = await tx.organizationUnit.upsert({
          where: { code: villageCode },
          update: { name: cleanVillageName, level: OrgHierarchyLevel.VILLAGE, parentId: mandalUnitRecord?.id },
          create: { name: cleanVillageName, code: villageCode, level: OrgHierarchyLevel.VILLAGE, parentId: mandalUnitRecord?.id },
        });

        const cleanBoothName = `Polling Station 1`;
        let boothCode = `BT-${org.code.slice(0, 4)}-01`;
        const bCollision = await tx.booth.findUnique({ where: { code: boothCode } });
        if (bCollision) boothCode = `BT-${org.code.slice(0, 4)}-${Date.now().toString().slice(-4)}`;
        const boothRecord = await tx.booth.create({
          data: {
            villageId: villageRecord.id,
            boothNumber: '1',
            name: cleanBoothName,
            code: boothCode,
            totalVoters: 0,
          },
        });
        const boothUnitRecord = await tx.organizationUnit.upsert({
          where: { code: boothCode },
          update: { name: cleanBoothName, level: OrgHierarchyLevel.BOOTH, parentId: villageUnitRecord?.id },
          create: { name: cleanBoothName, code: boothCode, level: OrgHierarchyLevel.BOOTH, parentId: villageUnitRecord?.id },
        });

        const cleanVgName = `Cluster 1 (1-100)`;
        let vgCode = `VG-${org.code.slice(0, 4)}-01`;
        const vgCollision = await tx.voterGroup.findUnique({ where: { code: vgCode } });
        if (vgCollision) vgCode = `VG-${org.code.slice(0, 4)}-${Date.now().toString().slice(-4)}`;
        const vgRecord = await tx.voterGroup.create({
          data: {
            boothId: boothRecord.id,
            name: cleanVgName,
            code: vgCode,
            rangeStart: 1,
            rangeEnd: 100,
            totalVoters: 100,
          },
        });
        const vgUnitRecord = await tx.organizationUnit.upsert({
          where: { code: vgCode },
          update: { name: cleanVgName, level: OrgHierarchyLevel.VOTER_GROUP, parentId: boothUnitRecord?.id },
          create: { name: cleanVgName, code: vgCode, level: OrgHierarchyLevel.VOTER_GROUP, parentId: boothUnitRecord?.id },
        });

        const tierDataMap: Record<string, { unit: any; role: RoleType; assignment: any }> = {
          STATE: {
            unit: stateUnitRecord,
            role: RoleType.STATE_ADMIN,
            assignment: { stateId: state.id },
          },
          ZONE: {
            unit: zoneUnitRecord,
            role: RoleType.ZONE_INCHARGE,
            assignment: { stateId: state.id, zoneId: zone.id },
          },
          PARLIAMENT: {
            unit: parUnitRecord,
            role: RoleType.PARLIAMENT_INCHARGE,
            assignment: { stateId: state.id, zoneId: zone.id, parliamentId: parliament.id },
          },
          DISTRICT: {
            unit: constUnitRecord,
            role: RoleType.CONSTITUENCY_INCHARGE,
            assignment: { stateId: state.id, zoneId: zone.id, parliamentId: parliament.id, constituencyId: primaryConstituency?.id },
          },
          CONSTITUENCY: {
            unit: constUnitRecord,
            role: RoleType.CONSTITUENCY_INCHARGE,
            assignment: { stateId: state.id, zoneId: zone.id, parliamentId: parliament.id, constituencyId: primaryConstituency?.id },
          },
          MANDAL: {
            unit: mandalUnitRecord,
            role: RoleType.MANDAL_INCHARGE,
            assignment: { stateId: state.id, zoneId: zone.id, parliamentId: parliament.id, constituencyId: primaryConstituency?.id, mandalId: mandalRecord.id },
          },
          VILLAGE: {
            unit: villageUnitRecord,
            role: RoleType.VILLAGE_INCHARGE,
            assignment: { stateId: state.id, zoneId: zone.id, parliamentId: parliament.id, constituencyId: primaryConstituency?.id, mandalId: mandalRecord.id, villageId: villageRecord.id },
          },
          BOOTH: {
            unit: boothUnitRecord,
            role: RoleType.BOOTH_PRESIDENT,
            assignment: { stateId: state.id, zoneId: zone.id, parliamentId: parliament.id, constituencyId: primaryConstituency?.id, mandalId: mandalRecord.id, villageId: villageRecord.id, boothId: boothRecord.id },
          },
          VOTER_GROUP: {
            unit: vgUnitRecord,
            role: RoleType.VOTER_100_INCHARGE,
            assignment: { stateId: state.id, zoneId: zone.id, parliamentId: parliament.id, constituencyId: primaryConstituency?.id, mandalId: mandalRecord.id, villageId: villageRecord.id, boothId: boothRecord.id, voterGroupId: vgRecord.id },
          },
        };

        const provisionedIncharges: any[] = [];
        for (let idx = 0; idx < incomingIncharges.length; idx++) {
          const incharge = incomingIncharges[idx];
          const cleanMobile = incharge.mobileNumber.replace(/\D/g, '').slice(-10);
          const tierKey = ((incharge as any).tierLevel || incharge.tier || 'CONSTITUENCY').toUpperCase();
          const tierData = tierDataMap[tierKey] || tierDataMap.CONSTITUENCY;
          const inchargeRole = incharge.role || tierData.role;
          const resolvedUnitId = incharge.unitId || tierData.unit?.id || null;

          let userCode = `LEADER-${inchargeRole.slice(0, 3)}-${cleanMobile.slice(-4)}`;
          const codeCollision = await tx.user.findUnique({ where: { userCode } });
          if (codeCollision) {
            userCode = `LEADER-${inchargeRole.slice(0, 3)}-${cleanMobile.slice(-4)}-${idx + 1}`;
          }

          const inchargeUser = await tx.user.upsert({
            where: { mobileNumber: cleanMobile },
            update: {
              name: incharge.name.trim(),
              email: incharge.email?.trim().toLowerCase() || `${inchargeRole.toLowerCase()}-${cleanMobile.slice(-4)}@${org.code.toLowerCase()}.org`,
              passwordHash,
              role: inchargeRole,
              accountStatus: 'ACTIVE',
              organisationId: org.id,
              unitId: resolvedUnitId,
              isVerified: true,
            },
            create: {
              organisationId: org.id,
              userCode,
              name: incharge.name.trim(),
              mobileNumber: cleanMobile,
              email: incharge.email?.trim().toLowerCase() || `${inchargeRole.toLowerCase()}-${cleanMobile.slice(-4)}@${org.code.toLowerCase()}.org`,
              passwordHash,
              role: inchargeRole,
              accountStatus: 'ACTIVE',
              isVerified: true,
              unitId: resolvedUnitId,
            },
          });

          if (resolvedUnitId) {
            const existingAssignment = await tx.userHierarchyAssignment.findFirst({
              where: { userId: inchargeUser.id },
            });
            if (existingAssignment) {
              await tx.userHierarchyAssignment.update({
                where: { id: existingAssignment.id },
                data: {
                  roleType: inchargeRole,
                  isActive: true,
                  ...tierData.assignment,
                },
              });
            } else {
              await tx.userHierarchyAssignment.create({
                data: {
                  userId: inchargeUser.id,
                  roleType: inchargeRole,
                  isActive: true,
                  ...tierData.assignment,
                },
              });
            }
          }

          provisionedIncharges.push({
            ...inchargeUser,
            tier: tierKey,
          });
        }

        const candidateUser = provisionedIncharges[0] || null;

        return {
          org,
          state,
          zone,
          parliament,
          createdConstituencies,
          updatedConfig,
          candidateUser,
          primaryRole: candidateUser?.role || primaryRole,
          provisionedIncharges,
        };
      },
      { timeout: 45000 },
    );

    const allParties = await prisma.politicalParty.findMany({
      where: { organisationId: provisionResult.org.id },
      orderBy: { sortOrder: 'asc' },
    });

    const formattedIncharges = provisionResult.provisionedIncharges.map((u: any) => ({
      tier: u.tier,
      name: u.name,
      mobileNumber: u.mobileNumber,
      role: u.role,
      unitId: u.unitId,
    }));

    return {
      application: {
        appKey: body.appKey || `app_${Date.now()}`,
        tenantCode: provisionResult.org.code,
        organisationId: provisionResult.org.id,
        appName: body.appName,
        organisationName: body.organisationName,
        headerTitle: body.headerTitle || body.appName,
        slogan: body.slogan,
        logoUrl: body.logoUrl,
        stateName: body.stateName,
        primaryColor: body.primaryColor,
        secondaryColor: body.secondaryColor,
        accentColor: body.accentColor,
        activePartyCode: body.activePartyCode,
        appScope: body.appScope,
        activeHierarchyLevels: body.activeHierarchyLevels,
        parliamentName: provisionResult.parliament.name,
        candidateName: provisionResult.candidateUser?.name || (body as any).candidateName,
        candidateMobile: provisionResult.candidateUser?.mobileNumber || (body as any).candidateMobile,
        candidateRole: provisionResult.primaryRole,
        tierIncharges: formattedIncharges,
        constituencies: provisionResult.createdConstituencies,
        parties: allParties,
      },
      credentials: {
        mobileNumber: provisionResult.candidateUser?.mobileNumber || (body as any).candidateMobile,
        role: provisionResult.primaryRole,
        password: initialPassword || undefined,
        tenantCode: provisionResult.org.code,
        tierIncharges: formattedIncharges,
      },
      tierIncharges: formattedIncharges,
      constituencies: provisionResult.createdConstituencies,
      parties: allParties,
    };
  } catch (err: any) {
    if (
      err.code === 'P2002' ||
      err.code === '23505' ||
      err.code === 'TENANT_ALREADY_EXISTS' ||
      err.message?.includes('Organisation_lower_name_key') ||
      err.message?.includes('Unique constraint failed')
    ) {
      const conflictErr: any = new Error(
        err.message || 'Tenant code or organization conflict during provisioning.'
      );
      conflictErr.statusCode = 409;
      conflictErr.code = 'TENANT_ALREADY_EXISTS';
      throw conflictErr;
    }
    throw err;
  }
}

