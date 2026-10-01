import { VoterPreference } from '../types';
import { getAdminToken } from './auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export async function apiFetch<T = any>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const normalized = endpoint.startsWith('/api') ? endpoint.slice(4) : endpoint;
  const url = normalized.startsWith('http') ? normalized : `${API_BASE}${normalized.startsWith('/') ? '' : '/'}${normalized}`;

  const res = await fetch(url, {
    ...init,
    headers,
  });

  const contentType = res.headers.get('content-type');
  let data: any = null;
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const errorMsg = data?.error?.message || data?.error || data?.message || `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  return (data?.data !== undefined ? data.data : data) as T;
}

export type AppScope = 'SINGLE_MLA' | 'PARLIAMENT_MP' | 'ZONE' | 'STATE';

export interface ConstituencyItem {
  id?: string;
  name: string;
  code?: string;
  totalVoters?: number;
  candidateName?: string;
  mlaName?: string;
  parliamentName?: string;
  _count?: { mandals?: number; voters?: number };
}

export interface ApplicationTemplate {
  id: string;
  name: string;
  scope: AppScope;
  scopeBadge: string;
  description: string;
  stateName: string;
  parliamentName?: string;
  constituencies: ConstituencyItem[];
  parties: { name: string; code: string; shortName: string; primaryColor: string; symbolName?: string }[];
  activePartyCode: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  slogan: string;
  logoUrl?: string;
  hierarchyLevels: string[];
}

export interface CmsConfig {
  organisationName: string;
  stateName: string;
  defaultLanguage: string;
  activePartyCode: string;
  headerTitle: string;
  slogan?: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  appScope: AppScope;
  candidateName?: string;
  activeHierarchyLevels: string[];
  parliamentName?: string;
  parliamentCode?: string;
  constituencies: ConstituencyItem[];
  hierarchyLabels: Record<string, string>;
  featureToggles: {
    voterManagement: boolean;
    fakeVoterFlagging: boolean;
    migrationTracking: boolean;
    liveVoteTracking: boolean;
    casteAnalytics: boolean;
    cadreNetwork: boolean;
    training: boolean;
    tasks: boolean;
    groundReports: boolean;
    aiStrategicIntelligence: boolean;
    electionProjection: boolean;
  };
  dashboardConfig?: Record<string, Record<string, boolean>>;
  analyticsConfig?: {
    electionYear: number;
    targetSeats: number;
    majorityMark: number;
    trackedParties: string[];
  };
  aiEnabled: boolean;
}

export interface CmsParty {
  id?: string;
  code: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor?: string | null;
  accentColor?: string | null;
  logoUrl?: string | null;
  symbolName?: string | null;
  isActive: boolean;
  sortOrder: number;
  lifecycleStatus?: 'DRAFT' | 'PUBLISHED' | 'LOCKED';
  isLocked?: boolean;
}

export interface PartyTheme {
  bg: string;
  text: string;
  hex: string;
  lightBg: string;
  border: string;
  darkText: string;
}

export interface PartyPreset {
  id: string;
  name: string;
  code: string;
  stateName: string;
  appName: string;
  slogan: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string;
}

export const APPLICATION_TEMPLATES: ApplicationTemplate[] = [
  {
    id: 'single_mla_kondapi',
    name: 'Kondapi Connect (Single MLA Candidate)',
    scope: 'SINGLE_MLA',
    scopeBadge: '1 MLA Candidate',
    description: 'Constituency War Room & Voter Intelligence cockpit for a single Assembly Constituency candidate.',
    stateName: 'Andhra Pradesh',
    constituencies: [
      { name: 'Kondapi Assembly Constituency (AC No. 107)', code: 'AC-107', totalVoters: 0 },
    ],
    parties: [
      { name: 'Telugu Desam Party', code: 'TDP', shortName: 'TDP', primaryColor: '#eab308', symbolName: 'Bicycle' },
      { name: 'YSR Congress Party', code: 'YSRCP', shortName: 'YSRCP', primaryColor: '#2563eb', symbolName: 'Fan' },
      { name: 'JanaSena Party', code: 'JSP', shortName: 'JSP', primaryColor: '#dc2626', symbolName: 'Glass' },
      { name: 'Bharatiya Janata Party', code: 'BJP', shortName: 'BJP', primaryColor: '#f97316', symbolName: 'Lotus' },
      { name: 'Indian National Congress', code: 'INC', shortName: 'INC', primaryColor: '#0284c7', symbolName: 'Hand' },
    ],
    activePartyCode: 'TDP',
    primaryColor: '#eab308',
    secondaryColor: '#1e293b',
    accentColor: '#3b82f6',
    slogan: 'Empowering Cadre, Uniting Citizens for Kondapi 2026',
    logoUrl: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=150&auto=format&fit=crop&q=80',
    hierarchyLevels: ['VOTER_GROUP', 'BOOTH', 'VILLAGE', 'MANDAL', 'CONSTITUENCY'],
  },
  {
    id: 'parliament_ongole',
    name: 'Ongole Parliament Connect (7 MLAs + 1 MP Candidate)',
    scope: 'PARLIAMENT_MP',
    scopeBadge: '7 MLAs + 1 MP Candidate',
    description: 'Integrated Parliament Segment Platform coordinating 1 MP Candidate across all 7 underlying Assembly Constituencies.',
    stateName: 'Andhra Pradesh',
    parliamentName: 'Ongole Parliament Constituency',
    constituencies: [
      { name: 'Ongole Constituency', code: 'AC-101', totalVoters: 0 },
      { name: 'Kandukur Constituency', code: 'AC-102', totalVoters: 0 },
      { name: 'Darsi Constituency', code: 'AC-103', totalVoters: 0 },
      { name: 'Addanki Constituency', code: 'AC-104', totalVoters: 0 },
      { name: 'Kondapi Constituency', code: 'AC-107', totalVoters: 0 },
      { name: 'Santhanuthalapadu Constituency', code: 'AC-106', totalVoters: 0 },
      { name: 'Kanigiri Constituency', code: 'AC-105', totalVoters: 0 },
    ],
    parties: [
      { name: 'Telugu Desam Party', code: 'TDP', shortName: 'TDP', primaryColor: '#eab308', symbolName: 'Bicycle' },
      { name: 'JanaSena Party', code: 'JSP', shortName: 'JSP', primaryColor: '#dc2626', symbolName: 'Glass' },
      { name: 'Bharatiya Janata Party', code: 'BJP', shortName: 'BJP', primaryColor: '#f97316', symbolName: 'Lotus' },
      { name: 'YSR Congress Party', code: 'YSRCP', shortName: 'YSRCP', primaryColor: '#2563eb', symbolName: 'Fan' },
      { name: 'Indian National Congress', code: 'INC', shortName: 'INC', primaryColor: '#0284c7', symbolName: 'Hand' },
    ],
    activePartyCode: 'TDP',
    primaryColor: '#eab308',
    secondaryColor: '#0f172a',
    accentColor: '#3b82f6',
    slogan: 'Ongole Parliamentary Central War Room & Multi-Constituency Command',
    logoUrl: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=150&auto=format&fit=crop&q=80',
    hierarchyLevels: ['VOTER_GROUP', 'BOOTH', 'VILLAGE', 'MANDAL', 'CONSTITUENCY', 'PARLIAMENT'],
  },
  {
    id: 'statewide_telangana',
    name: 'Telangana Congress Connect (TPCC — 119 MLAs + 17 MPs)',
    scope: 'STATE',
    scopeBadge: 'Statewide (119 MLAs + 17 MPs)',
    description: 'Telangana Pradesh Congress Committee command center — comprehensive voter management across 5 zones, 17 Parliament seats, 119 constituencies.',
    stateName: 'Telangana',
    constituencies: [
      { name: 'Nalgonda Constituency', code: 'TS-AC-92', totalVoters: 220000 },
      { name: 'Warangal West Constituency', code: 'TS-AC-105', totalVoters: 245000 },
      { name: 'Warangal East Constituency', code: 'TS-AC-106', totalVoters: 238000 },
      { name: 'Khammam Constituency', code: 'TS-AC-112', totalVoters: 250000 },
      { name: 'Karimnagar Constituency', code: 'TS-AC-26', totalVoters: 260000 },
      { name: 'Secunderabad Constituency', code: 'TS-AC-70', totalVoters: 265000 },
      { name: 'Munugode Constituency', code: 'TS-AC-91', totalVoters: 215000 },
      { name: 'Choppadandi Constituency', code: 'TS-AC-25', totalVoters: 230000 },
    ],
    parties: [
      { name: 'Indian National Congress', code: 'INC', shortName: 'INC', primaryColor: '#FF6600', symbolName: 'Hand' },
      { name: 'Bharat Rashtra Samithi', code: 'BRS', shortName: 'BRS', primaryColor: '#ec4899', symbolName: 'Car' },
      { name: 'Bharatiya Janata Party', code: 'BJP', shortName: 'BJP', primaryColor: '#f97316', symbolName: 'Lotus' },
      { name: 'AIMIM', code: 'AIMIM', shortName: 'AIMIM', primaryColor: '#15803d', symbolName: 'Kite' },
      { name: 'Telugu Desam Party', code: 'TDP', shortName: 'TDP', primaryColor: '#eab308', symbolName: 'Bicycle' },
    ],
    activePartyCode: 'INC',
    primaryColor: '#FF6600',
    secondaryColor: '#138808',
    accentColor: '#0038A8',
    slogan: 'Praja Palana — Congress Ki Guarantee for Telangana',
    hierarchyLevels: ['VOTER_GROUP', 'BOOTH', 'VILLAGE', 'MANDAL', 'CONSTITUENCY', 'PARLIAMENT', 'ZONE', 'STATE'],
  },
];

export const PARTY_PRESETS: PartyPreset[] = [
  {
    id: 'tdp',
    name: 'Telugu Desam Party (TDP)',
    code: 'TDP',
    stateName: 'Andhra Pradesh',
    appName: 'Kondapi TDP Connect',
    slogan: 'Empowering Cadre, Uniting Citizens for Kondapi 2026',
    primaryColor: '#eab308',
    secondaryColor: '#1e293b',
    accentColor: '#3b82f6',
    logoUrl: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'inc',
    name: 'Indian National Congress — TPCC (INC)',
    code: 'INC',
    stateName: 'Telangana',
    appName: 'Telangana Congress Connect',
    slogan: 'Praja Palana — Congress Ki Guarantee for Telangana',
    primaryColor: '#FF6600',
    secondaryColor: '#138808',
    accentColor: '#0038A8',
    logoUrl: '',
  },
  {
    id: 'ysrcp',
    name: 'YSR Congress Party (YSRCP)',
    code: 'YSRCP',
    stateName: 'Andhra Pradesh',
    appName: 'YSRCP Seva Dal Command',
    slogan: 'Navaratnalu for Every Household',
    primaryColor: '#2563eb',
    secondaryColor: '#15803d',
    accentColor: '#38bdf8',
    logoUrl: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'brs',
    name: 'Bharat Rashtra Samithi (BRS)',
    code: 'BRS',
    stateName: 'Telangana',
    appName: 'BRS Gulabi Sena Cockpit',
    slogan: 'KCR Pragathi & Bangaru Telangana',
    primaryColor: '#ec4899',
    secondaryColor: '#831843',
    accentColor: '#6366f1',
    logoUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'jsp',
    name: 'JanaSena Party (JSP)',
    code: 'JSP',
    stateName: 'Andhra Pradesh',
    appName: 'JanaSena Veera Mahila & Sainik Connect',
    slogan: 'Questioning Power, Empowering Common Citizens',
    primaryColor: '#dc2626',
    secondaryColor: '#1e293b',
    accentColor: '#f59e0b',
    logoUrl: 'https://images.unsplash.com/photo-1569974498991-d3c12a504f95?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'bjp',
    name: 'Bharatiya Janata Party (BJP)',
    code: 'BJP',
    stateName: 'National / State Wing',
    appName: 'BJP Sanghatan Vistarak Cockpit',
    slogan: 'Nation First, Development for All (Sabka Saath, Sabka Vikas)',
    primaryColor: '#f97316',
    secondaryColor: '#15803d',
    accentColor: '#1e293b',
    logoUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'aap',
    name: 'Aam Aadmi Party (AAP)',
    code: 'AAP',
    stateName: 'Delhi / Punjab / State Unit',
    appName: 'Aam Aadmi Karyakarta Network',
    slogan: 'Good Governance, Free Education & Healthcare',
    primaryColor: '#0284c7',
    secondaryColor: '#eab308',
    accentColor: '#10b981',
    logoUrl: 'https://images.unsplash.com/photo-1572945753563-804956783604?w=150&auto=format&fit=crop&q=80',
  },
];

export const DEFAULT_CONFIG: CmsConfig = {
  organisationName: 'Telangana Congress Connect',
  headerTitle: 'Telangana Congress Connect',
  stateName: 'Telangana',
  defaultLanguage: 'te-IN',
  activePartyCode: 'INC',
  primaryColor: '#FF6600',
  secondaryColor: '#138808',
  accentColor: '#0038A8',
  appScope: 'STATE',
  activeHierarchyLevels: ['VOTER_GROUP', 'BOOTH', 'VILLAGE', 'MANDAL', 'CONSTITUENCY', 'PARLIAMENT', 'ZONE', 'STATE'],
  constituencies: [
    { name: 'Nalgonda Constituency', code: 'TS-AC-92', totalVoters: 0 },
    { name: 'Warangal West Constituency', code: 'TS-AC-105', totalVoters: 0 },
    { name: 'Khammam Constituency', code: 'TS-AC-112', totalVoters: 0 },
    { name: 'Karimnagar Constituency', code: 'TS-AC-26', totalVoters: 0 },
    { name: 'Secunderabad Constituency', code: 'TS-AC-70', totalVoters: 0 },
  ],
  slogan: 'Praja Palana — Congress Ki Guarantee for Telangana',
  hierarchyLabels: {
    STATE: 'State Incharge',
    ZONE: 'Zone Coordinator',
    PARLIAMENT: 'Parliament Incharge',
    CONSTITUENCY: 'Constituency Incharge',
    MANDAL: 'Mandal President',
    VILLAGE: 'Village Incharge',
    BOOTH: 'Booth President',
    VOTER_GROUP: '100 Voters Incharge',
  },
  featureToggles: {
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
  },
  dashboardConfig: {
    CONSTITUENCY_INCHARGE: { showPulseBar: true, showMetricsGrid: true, showLiveVotingHub: true, showWarRoomProjections: true },
    MANDAL_INCHARGE: { showPulseBar: true, showMetricsGrid: true, showLiveVotingHub: true, showVillageBreakdown: true },
    VILLAGE_INCHARGE: { showPulseBar: true, showMetricsGrid: true, showLiveVotingHub: true, showBoothList: true },
    BOOTH_PRESIDENT: { showPulseBar: true, showMetricsGrid: true, showLiveVotingHub: true, showInchargeClusters: true },
    VOTER_100_INCHARGE: { showPulseBar: true, showMetricsGrid: true, showVoterChecklist: true, showLiveTurnoutLogger: true },
  },
  analyticsConfig: {
    electionYear: 2024,
    targetSeats: 60,
    majorityMark: 60,
    trackedParties: ['INC', 'BRS', 'BJP', 'AIMIM', 'OTH'],
  },
  aiEnabled: true,
};

export const DEFAULT_PARTY_THEMES: Record<VoterPreference, PartyTheme> = {
  TDP: { bg: 'bg-yellow-400', text: 'text-yellow-800', hex: '#eab308', lightBg: 'bg-yellow-50', border: 'border-yellow-200', darkText: 'text-yellow-800' },
  YSRCP: { bg: 'bg-blue-600', text: 'text-white', hex: '#2563eb', lightBg: 'bg-blue-50', border: 'border-blue-200', darkText: 'text-blue-800' },
  JSP: { bg: 'bg-red-600', text: 'text-white', hex: '#dc2626', lightBg: 'bg-red-50', border: 'border-red-200', darkText: 'text-red-800' },
  BJP: { bg: 'bg-orange-500', text: 'text-white', hex: '#f97316', lightBg: 'bg-orange-50', border: 'border-orange-200', darkText: 'text-orange-800' },
  INC: { bg: 'bg-sky-500', text: 'text-white', hex: '#0284c7', lightBg: 'bg-sky-50', border: 'border-sky-200', darkText: 'text-sky-950' },
  Neutral: { bg: 'bg-gray-400', text: 'text-gray-800', hex: '#9ca3af', lightBg: 'bg-gray-50', border: 'border-gray-200', darkText: 'text-gray-800' },
  OTH: { bg: 'bg-purple-600', text: 'text-white', hex: '#9333ea', lightBg: 'bg-purple-50', border: 'border-purple-200', darkText: 'text-purple-800' },
};

/**
 * Injects dynamic CSS variables into document.documentElement (:root)
 */
export function applyThemeVariables(primaryColor: string, secondaryColor?: string, accentColor?: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  root.style.setProperty('--party-primary', primaryColor);
  root.style.setProperty('--party-secondary', secondaryColor || '#1e293b');
  root.style.setProperty('--party-accent', accentColor || '#3b82f6');
  root.style.setProperty('--party-light', `${primaryColor}1a`);
  root.style.setProperty('--party-glow', `${primaryColor}4d`);
}

export async function fetchCmsConfig(): Promise<{ config: CmsConfig; parties: CmsParty[]; announcements: any[] }> {
  try {
    const payload = await apiFetch<any>('/api/cms/config');
    const rawConfig = payload?.config || payload || {};
    const parties = (payload?.parties as CmsParty[]) || [];
    const announcements = payload?.announcements || [];
    const constituencies = (payload?.constituencies as ConstituencyItem[]) || rawConfig.constituencies || DEFAULT_CONFIG.constituencies;

    const config: CmsConfig = {
      ...DEFAULT_CONFIG,
      ...rawConfig,
      organisationName: rawConfig.organisationName || DEFAULT_CONFIG.organisationName,
      headerTitle: rawConfig.headerTitle || rawConfig.organisationName || DEFAULT_CONFIG.headerTitle,
      stateName: rawConfig.stateName || DEFAULT_CONFIG.stateName,
      defaultLanguage: rawConfig.defaultLanguage || DEFAULT_CONFIG.defaultLanguage,
      activePartyCode: rawConfig.activePartyCode || DEFAULT_CONFIG.activePartyCode,
      primaryColor: rawConfig.primaryColor || DEFAULT_CONFIG.primaryColor,
      secondaryColor: rawConfig.secondaryColor || DEFAULT_CONFIG.secondaryColor,
      accentColor: rawConfig.accentColor || DEFAULT_CONFIG.accentColor,
      slogan: rawConfig.slogan || DEFAULT_CONFIG.slogan,
      logoUrl: rawConfig.logoUrl || DEFAULT_CONFIG.logoUrl,
      faviconUrl: rawConfig.faviconUrl || DEFAULT_CONFIG.faviconUrl,
      appScope: (rawConfig.appScope as AppScope) || DEFAULT_CONFIG.appScope,
      candidateName: rawConfig.candidateName || DEFAULT_CONFIG.candidateName,
      activeHierarchyLevels: Array.isArray(rawConfig.activeHierarchyLevels) && rawConfig.activeHierarchyLevels.length > 0
        ? rawConfig.activeHierarchyLevels
        : DEFAULT_CONFIG.activeHierarchyLevels,
      parliamentName: rawConfig.parliamentName || DEFAULT_CONFIG.parliamentName,
      parliamentCode: rawConfig.parliamentCode || DEFAULT_CONFIG.parliamentCode,
      constituencies: constituencies.length ? constituencies : DEFAULT_CONFIG.constituencies,
      hierarchyLabels: {
        ...DEFAULT_CONFIG.hierarchyLabels,
        ...(rawConfig.hierarchyLabels || {}),
      },
      featureToggles: {
        ...DEFAULT_CONFIG.featureToggles,
        ...(rawConfig.featureToggles || {}),
      },
      dashboardConfig: rawConfig.dashboardConfig || DEFAULT_CONFIG.dashboardConfig,
      analyticsConfig: rawConfig.analyticsConfig || DEFAULT_CONFIG.analyticsConfig,
      aiEnabled: rawConfig.aiEnabled ?? true,
    };

    if (config.hierarchyLabels?.VOTER_GROUP && (config.hierarchyLabels.VOTER_GROUP === 'Indiramma Incharge (100 Voters)' || config.hierarchyLabels.VOTER_GROUP.includes('Indiramma'))) {
      config.hierarchyLabels.VOTER_GROUP = '100 Voters Incharge';
    }

    const activeParty = parties.find((p) => p.code === config.activePartyCode) || parties[0];
    if (activeParty) {
      config.primaryColor = config.primaryColor || activeParty.primaryColor;
      config.secondaryColor = config.secondaryColor || activeParty.secondaryColor || '#1e293b';
      config.accentColor = config.accentColor || activeParty.accentColor || '#3b82f6';
      if (activeParty.logoUrl && !config.logoUrl) config.logoUrl = activeParty.logoUrl;
    }

    applyThemeVariables(config.primaryColor, config.secondaryColor, config.accentColor);
    return { config, parties, announcements };
  } catch (err) {
    console.warn('[CMS] Fallback to default local config:', err);
    applyThemeVariables(DEFAULT_CONFIG.primaryColor, DEFAULT_CONFIG.secondaryColor, DEFAULT_CONFIG.accentColor);
    return { config: DEFAULT_CONFIG, parties: [], announcements: [] };
  }
}

export async function saveCmsConfig(config: Partial<CmsConfig>, token?: string): Promise<boolean> {
  try {
    const authToken = token || getAdminToken();
    await apiFetch('/api/cms/config', {
      method: 'PUT',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      body: JSON.stringify({
        organisationName: config.organisationName,
        appName: config.organisationName,
        headerTitle: config.headerTitle || config.organisationName,
        slogan: config.slogan,
        logoUrl: config.logoUrl,
        faviconUrl: config.faviconUrl,
        stateName: config.stateName,
        defaultLanguage: config.defaultLanguage,
        primaryColor: config.primaryColor,
        secondaryColor: config.secondaryColor,
        accentColor: config.accentColor,
        activePartyCode: config.activePartyCode,
        appScope: config.appScope,
        parliamentName: config.parliamentName,
        parliamentCode: config.parliamentCode,
        candidateName: config.candidateName,
        hierarchyLabels: config.hierarchyLabels,
        featureToggles: config.featureToggles,
        activeHierarchyLevels: config.activeHierarchyLevels,
        dashboardConfig: config.dashboardConfig,
        analyticsConfig: config.analyticsConfig,
        aiEnabled: config.aiEnabled,
      }),
    });
    return true;
  } catch (err) {
    console.error('[CMS] Save failed:', err);
    return false;
  }
}

export function buildPartyThemes(parties: CmsParty[]): Record<VoterPreference, PartyTheme> {
  const themes = { ...DEFAULT_PARTY_THEMES };

  parties.forEach((party) => {
    const key = party.code as VoterPreference;
    if (key) {
      themes[key] = {
        bg: `bg-[${party.primaryColor}]`,
        text: 'text-white',
        hex: party.primaryColor,
        lightBg: `bg-[${party.primaryColor}1a]`,
        border: `border-[${party.primaryColor}4d]`,
        darkText: 'text-slate-900',
      };
    }
  });

  return themes;
}

export async function buildApplicationApi(payload: {
  appName: string;
  organisationName: string;
  headerTitle?: string;
  slogan?: string;
  logoUrl?: string;
  stateName: string;
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  activePartyCode: string;
  appScope: AppScope;
  activeHierarchyLevels: string[];
  parliamentName?: string;
  constituencies: ConstituencyItem[];
  politicalParties: { name: string; code: string; shortName: string; primaryColor: string; symbolName?: string; logoUrl?: string }[];
  hierarchyLabels?: Record<string, string>;
  featureToggles?: Record<string, boolean>;
}, token?: string): Promise<any> {
  const authToken = token || getAdminToken();
  return apiFetch('/api/cms/build-application', {
    method: 'POST',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    body: JSON.stringify(payload),
  });
}

export async function fetchConstituenciesApi(): Promise<ConstituencyItem[]> {
  try {
    return await apiFetch<ConstituencyItem[]>('/api/cms/constituencies');
  } catch {
    return [];
  }
}
