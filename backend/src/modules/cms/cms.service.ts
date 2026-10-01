import { Prisma } from '@prisma/client';
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

export function serializeCmsConfig(row: any, extras: { constituencies?: any[]; parties?: any[] } = {}) {
  const activeParty =
    extras.parties?.find((p) => p.code === row?.activePartyCode) || extras.parties?.[0];

  return {
    organisationName: row?.organisationName || 'Political Connect',
    headerTitle: row?.headerTitle || row?.organisationName || 'Political Connect',
    slogan: row?.slogan || '',
    logoUrl: row?.logoUrl || activeParty?.logoUrl || '',
    faviconUrl: row?.faviconUrl || '',
    stateName: row?.stateName || 'Andhra Pradesh',
    defaultLanguage: row?.defaultLanguage || 'en',
    primaryColor: row?.primaryColor || activeParty?.primaryColor || '#eab308',
    secondaryColor: row?.secondaryColor || activeParty?.secondaryColor || '#1e293b',
    accentColor: row?.accentColor || activeParty?.accentColor || '#3b82f6',
    activePartyCode: row?.activePartyCode || activeParty?.code || 'TDP',
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
  };
}

export async function persistCmsConfig(input: CmsConfigInput) {
  const targetKey = (input.configKey || 'default').toLowerCase();

  const existing = await prisma.cMSConfiguration.findUnique({
    where: { configKey: targetKey },
  });

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
    configKey: targetKey,
    organisationId: input.organisationId ?? existing?.organisationId ?? undefined,
    organisationName: input.organisationName || existing?.organisationName || 'Political Connect',
    stateName: input.stateName || existing?.stateName || 'Andhra Pradesh',
    defaultLanguage: input.defaultLanguage || existing?.defaultLanguage || 'en',
    headerTitle: input.headerTitle ?? existing?.headerTitle,
    slogan: input.slogan ?? existing?.slogan,
    logoUrl: input.logoUrl ?? existing?.logoUrl,
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

  const saved = await prisma.cMSConfiguration.upsert({
    where: { configKey: targetKey },
    update: data,
    create: data,
    include: { organisation: true },
  });

  if (targetKey !== 'default') {
    const hasDefault = await prisma.cMSConfiguration.findUnique({ where: { configKey: 'default' } });
    if (!hasDefault) {
      await prisma.cMSConfiguration.create({
        data: {
          ...data,
          configKey: 'default',
        },
      });
    }
  }

  return saved;
}

export async function loadCmsBundle() {
  let config = await prisma.cMSConfiguration.findUnique({
    where: { configKey: 'default' },
    include: { organisation: true },
  });

  if (!config) {
    config = await persistCmsConfig({
      organisationName: 'Kondapi TDP Connect',
      stateName: 'Andhra Pradesh',
    });
  }

  const parties = await prisma.politicalParty.findMany({
    where: {
      isActive: true,
      NOT: {
        code: { startsWith: 'TEST_' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  const announcements = await prisma.announcement.findMany({
    where: {
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const constituencies = await prisma.constituency.findMany({
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

  return {
    config: serializeCmsConfig(config, { constituencies, parties }),
    rawConfig: config,
    parties,
    announcements,
    constituencies,
  };
}

export { DEFAULT_DASHBOARD_CONFIG, DEFAULT_ANALYTICS_CONFIG, DEFAULT_FEATURE_TOGGLES };
