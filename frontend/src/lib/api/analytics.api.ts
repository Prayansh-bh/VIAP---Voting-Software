import { apiFetch } from './client';

export interface ChildAreaRollup {
  unitId: string;
  id: string;
  name: string;
  code: string | null;
  level: string;
  totalVoters: number;
  voted: number;
  notVoted: number;
  surveyed: number;
  fakeVoters: number;
  local: number;
  migrated: number;
  partyPreference: Record<string, number>;
  primaryPartyCode?: string;
  primaryPartyVotes?: number;
  topOpponentCode?: string;
  topOpponentVotes?: number;
  tdp?: number;
  ysrcp?: number;
  lead: number;
  margin: number;
  leadingParty: string;
  status: 'WINNING' | 'TRAILING' | 'CLOSE_CONTEST' | 'UNSURVEYED';
}

export interface HierarchyAnalyticsResponse {
  unit: {
    id: string;
    name: string;
    code: string | null;
    level: string;
  };
  summary: {
    totalVoters: number;
    voted: number;
    notVoted: number;
    turnoutPercentage: number;
    surveyed?: number;
    pendingSurvey?: number;
    surveyCompletionPct?: number;
    fakeVoters: number;
    doubtfulVoters: number;
    shiftedVoters: number;
    deceasedVoters: number;
    activeVoters: number;
    migratedVoters: number;
    localVoters: number;
  };
  hierarchyCounts?: Record<string, number>;
  demographics: {
    caste: Record<string, number>;
    profession: Record<string, number>;
    age: Record<string, number>;
    gender: Record<string, number>;
  };
  partyPreference: Record<string, number>;
  projections: {
    primaryPartyCode?: string;
    topOpponentCode?: string;
    leadingParty?: string;
    lead?: number;
    margin?: number;
    winningAreasCount: number;
    trailingAreasCount: number;
    closeContestAreasCount: number;
    unsurveyedAreasCount?: number;
    winningAreas: ChildAreaRollup[];
    trailingAreas: ChildAreaRollup[];
    closeContestAreas: ChildAreaRollup[];
  };
  children?: ChildAreaRollup[];
  boothRollups?: ChildAreaRollup[];
  operations: {
    teamStrength: number;
    cadrePerformance: { totalCadres: number; averageScore: number };
    taskPerformance: { totalTasks: number; completed: number; pending?: number; inProgress?: number; completionRate: number };
    trainingPerformance: { totalAssigned: number; completed: number; completionRate: number };
  };
}

export interface ScopeDemographicsResponse {
  totalVoters: number;
  gender: { Male: number; Female: number; Other: number };
  age: { '18-25': number; '26-40': number; '41-60': number; '60+': number };
  caste: Record<string, number>;
  profession: Record<string, number>;
  partyPreference: Record<string, number>;
  villageBreakdown: Array<{ id: string; name: string; count: number }>;
  availableFilters: {
    villages: Array<{ id: string; name: string }>;
    castes: string[];
    professions: string[];
  };
}

export interface HierarchySummaryPayload {
  user: {
    userCode: string;
    name: string;
    role: string;
    unitId: string;
    unitName: string;
    unitLevel: string;
  };
  snapshot: {
    summary: {
      totalVoters: number;
      voted: number;
      remaining: number;
      surveyed?: number;
      pendingSurvey?: number;
      surveyCompletionPct?: number;
      fakeVoters: number;
      migrated: number;
      local: number;
    };
    hierarchyCounts: Record<string, number>;
    performance: {
      winningChildren: number;
      trailingChildren: number;
      closeContestChildren?: number;
      unsurveyedChildren?: number;
    };
    politicalPreference?: Record<string, number>;
  };
  analytics?: HierarchyAnalyticsResponse;
}

export interface ChildAnalyticsItem {
  unitId: string;
  name: string;
  code: string | null;
  level: string;
  snapshot: HierarchySummaryPayload['snapshot'] & {
    politicalPreference: Record<string, number>;
  };
}

export interface LiveVoteEventItem {
  id: string;
  previousStatus: 'NOT_VOTED' | 'VOTE_DONE';
  nextStatus: 'NOT_VOTED' | 'VOTE_DONE';
  changedAt: string;
  voter: {
    id: string;
    name: string;
    epicNumber: string;
  };
  unit: {
    id: string;
    name: string;
    level: string;
  };
  incharge: {
    id: string;
    userCode: string;
    name: string;
  };
}

export type CadreNetworkItem = any;
export type LiveTurnoutSummaryPayload = any;

function mapAnalyticsToSummaryPayload(
  analytics: HierarchyAnalyticsResponse,
  fallbackUnitId = ''
): HierarchySummaryPayload {
  const unitId = analytics.unit?.id || fallbackUnitId;
  const level = analytics.unit?.level || 'CONSTITUENCY';
  return {
    user: {
      userCode: analytics.unit?.code || unitId,
      name: (analytics.unit as any)?.inchargeName || 'In-Charge',
      role: `${level}_INCHARGE`,
      unitId,
      unitName: analytics.unit?.name || 'Jurisdiction',
      unitLevel: level,
    },
    snapshot: {
      summary: {
        totalVoters: analytics.summary?.totalVoters ?? 0,
        voted: analytics.summary?.voted ?? 0,
        remaining: analytics.summary?.notVoted ?? 0,
        surveyed: analytics.summary?.surveyed ?? 0,
        pendingSurvey: analytics.summary?.pendingSurvey ?? (analytics.summary?.totalVoters ?? 0),
        surveyCompletionPct: analytics.summary?.surveyCompletionPct ?? 0,
        fakeVoters: analytics.summary?.fakeVoters ?? 0,
        migrated: analytics.summary?.migratedVoters ?? 0,
        local: analytics.summary?.localVoters ?? 0,
      },
      hierarchyCounts: analytics.hierarchyCounts || {},
      performance: {
        winningChildren: analytics.projections?.winningAreasCount ?? 0,
        trailingChildren: analytics.projections?.trailingAreasCount ?? 0,
        closeContestChildren: analytics.projections?.closeContestAreasCount ?? 0,
        unsurveyedChildren: analytics.projections?.unsurveyedAreasCount ?? 0,
      },
      politicalPreference: analytics.partyPreference || {},
    },
    analytics,
  };
}

export async function fetchMyScopeAnalytics(): Promise<HierarchyAnalyticsResponse> {
  return apiFetch<HierarchyAnalyticsResponse>('/api/analytics/me');
}

export async function fetchScopeDemographics(filters: {
  villageId?: string;
  village?: string;
  boothId?: string;
  caste?: string;
  gender?: string;
  ageGroup?: string;
  profession?: string;
} = {}): Promise<ScopeDemographicsResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v && v !== 'all') params.append(k, v);
  });
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<ScopeDemographicsResponse>(`/api/analytics/demographics${qs}`);
}

export async function fetchHierarchyAnalytics(level: string, id: string): Promise<HierarchyAnalyticsResponse> {
  let normalizedLevel = level.toLowerCase().replace(/_/g, '-');
  if (normalizedLevel === 'voter-group') {
    normalizedLevel = 'voter-incharge';
  }
  return apiFetch<HierarchyAnalyticsResponse>(`/api/analytics/${normalizedLevel}/${encodeURIComponent(id)}`);
}

export async function fetchStateAnalytics(): Promise<HierarchyAnalyticsResponse> {
  return apiFetch<HierarchyAnalyticsResponse>('/api/analytics/state');
}

export async function fetchZoneAnalytics(id: string): Promise<HierarchyAnalyticsResponse> {
  return fetchHierarchyAnalytics('zone', id);
}

export async function fetchParliamentAnalytics(id: string): Promise<HierarchyAnalyticsResponse> {
  return fetchHierarchyAnalytics('parliament', id);
}

export async function fetchConstituencyAnalytics(id: string): Promise<HierarchyAnalyticsResponse> {
  return fetchHierarchyAnalytics('constituency', id);
}

export async function fetchMandalAnalytics(id: string): Promise<HierarchyAnalyticsResponse> {
  return fetchHierarchyAnalytics('mandal', id);
}

export async function fetchVillageAnalytics(id: string): Promise<HierarchyAnalyticsResponse> {
  return fetchHierarchyAnalytics('village', id);
}

export async function fetchBoothAnalytics(id: string): Promise<HierarchyAnalyticsResponse> {
  return fetchHierarchyAnalytics('booth', id);
}

export async function fetchVoterGroupAnalytics(id: string): Promise<HierarchyAnalyticsResponse> {
  return fetchHierarchyAnalytics('voter-group', id);
}

export async function fetchHierarchySummary(unitId?: string, level?: string): Promise<HierarchySummaryPayload> {
  try {
    const analytics =
      level && unitId
        ? await fetchHierarchyAnalytics(level, unitId)
        : await fetchMyScopeAnalytics();
    return mapAnalyticsToSummaryPayload(analytics, unitId || '');
  } catch {
    if (unitId) {
      const analytics = await apiFetch<HierarchyAnalyticsResponse>(`/api/analytics/constituency/${encodeURIComponent(unitId)}`);
      return mapAnalyticsToSummaryPayload(analytics, unitId);
    }
    throw new Error('Failed to load hierarchy summary');
  }
}

export async function fetchChildrenAnalytics(unitId: string, level?: string): Promise<ChildAnalyticsItem[]> {
  try {
    let analytics: HierarchyAnalyticsResponse;
    if (level) {
      analytics = await fetchHierarchyAnalytics(level, unitId);
    } else {
      try {
        const me = await fetchMyScopeAnalytics();
        if (!unitId || me.unit?.id === unitId) {
          analytics = me;
        } else {
          // Try constituency first, then mandal (handles Constituency -> Mandal -> Village drill-down)
          analytics = await fetchConstituencyAnalytics(unitId).catch(() => fetchMandalAnalytics(unitId));
        }
      } catch {
        analytics = await fetchConstituencyAnalytics(unitId).catch(() => fetchMandalAnalytics(unitId));
      }
    }

    const allChildren: ChildAreaRollup[] =
      Array.isArray(analytics.children) && analytics.children.length > 0
        ? analytics.children
        : (analytics.projections?.winningAreas || [])
            .concat(analytics.projections?.trailingAreas || [])
            .concat(analytics.projections?.closeContestAreas || []);

    return allChildren.map((area) => ({
      unitId: area.unitId || area.id,
      name: area.name,
      code: area.code || null,
      level: area.level || 'MANDAL',
      snapshot: {
        summary: {
          totalVoters: area.totalVoters || 0,
          voted: area.voted ?? 0,
          remaining: area.notVoted ?? Math.max(0, (area.totalVoters || 0) - (area.voted ?? 0)),
          surveyed: area.surveyed ?? 0,
          pendingSurvey: Math.max(0, (area.totalVoters || 0) - (area.surveyed ?? 0)),
          fakeVoters: area.fakeVoters ?? 0,
          migrated: area.migrated ?? 0,
          local: area.local ?? 0,
        },
        hierarchyCounts: {},
        performance: { winningChildren: 0, trailingChildren: 0 },
        politicalPreference: area.partyPreference || {},
      },
    }));
  } catch {
    return [];
  }
}

export async function fetchHierarchySummaryByUser(_userId: string): Promise<HierarchySummaryPayload> {
  const analytics = await fetchMyScopeAnalytics();
  return mapAnalyticsToSummaryPayload(analytics);
}

export async function fetchLiveVoteEvents(unitId?: string): Promise<LiveVoteEventItem[]> {
  try {
    const qs = unitId ? `?unitId=${encodeURIComponent(unitId)}` : '';
    const res = await apiFetch<LiveVoteEventItem[]>(`/api/analytics/live-events${qs}`);
    return Array.isArray(res) ? res : [];
  } catch (err) {
    console.warn('[Analytics API] Failed to fetch live vote events:', err);
    return [];
  }
}

export async function fetchLiveVoteEventsByUser(_userId?: string, limit?: number): Promise<LiveVoteEventItem[]> {
  try {
    const params = new URLSearchParams();
    if (limit) params.append('limit', String(limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await apiFetch<LiveVoteEventItem[]>(`/api/analytics/live-events${qs}`);
    return Array.isArray(res) ? res : [];
  } catch (err) {
    console.warn('[Analytics API] Failed to fetch live vote events by user:', err);
    return [];
  }
}

export async function fetchLiveTurnoutSummaryByUser(_userId: string): Promise<any> {
  try {
    const analytics = await fetchMyScopeAnalytics();
    const prefs = analytics.partyPreference || {};
    const tdp = prefs.TDP ?? 0;
    const ysrcp = prefs.YSRCP ?? 0;
    const jsp = prefs.JSP ?? 0;
    const bjp = prefs.BJP ?? 0;
    const inc = prefs.INC ?? 0;
    const others = (prefs.OTH ?? 0) + (prefs.NEUTRAL ?? 0);
    const totalPolled = analytics.summary?.voted ?? 0;
    const totalAssigned = analytics.summary?.totalVoters ?? 0;
    const pendingVotes = analytics.summary?.notVoted ?? Math.max(0, totalAssigned - totalPolled);

    const mandalStats = (analytics.children || []).map((c) => ({
      unitId: c.unitId,
      name: c.name,
      totalVoters: c.totalVoters,
      voted: c.voted,
      notVoted: c.notVoted,
      turnoutPct: c.totalVoters > 0 ? Math.round((c.voted / c.totalVoters) * 1000) / 10 : 0,
      partyPreference: c.partyPreference,
    }));

    return {
      totalAssigned,
      totalVotesPolled: totalPolled,
      pendingVotes,
      totalPolled,
      turnoutPct: analytics.summary?.turnoutPercentage ?? 0,
      partyAggregates: {
        ...prefs,
        TDP: tdp,
        YSRCP: ysrcp,
        JSP: jsp,
        BJP: bjp,
        INC: inc,
        Others: others,
      },
      tdpCount: tdp,
      ysrcpCount: ysrcp,
      jspCount: jsp,
      bjpCount: bjp,
      incCount: inc,
      othersCount: others,
      unitName: analytics.unit?.name || 'Jurisdiction',
      mandalStats,
      pollingReports: [],
    };
  } catch {
    return {
      totalAssigned: 0,
      totalVotesPolled: 0,
      pendingVotes: 0,
      totalPolled: 0,
      turnoutPct: 0,
      partyAggregates: {
        TDP: 0,
        YSRCP: 0,
        JSP: 0,
        BJP: 0,
        INC: 0,
        Others: 0,
      },
      tdpCount: 0,
      ysrcpCount: 0,
      jspCount: 0,
      bjpCount: 0,
      incCount: 0,
      othersCount: 0,
      unitName: 'Jurisdiction',
      mandalStats: [],
      pollingReports: [],
    };
  }
}
