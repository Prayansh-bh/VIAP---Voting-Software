'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { VoterPreference } from '../types';
import {
  applyThemeVariables,
  buildPartyThemes,
  CmsConfig,
  CmsParty,
  ConstituencyItem,
  DEFAULT_CONFIG,
  DEFAULT_PARTY_THEMES,
  fetchCmsConfig,
  PARTY_PRESETS,
  PartyPreset,
  PartyTheme,
  saveCmsConfig,
  buildApplicationApi,
  fetchConstituenciesApi,
  APPLICATION_TEMPLATES,
  ApplicationTemplate,
} from '../lib/cms';

interface CmsContextValue {
  config: CmsConfig;
  parties: CmsParty[];
  activeParty: CmsParty | null;
  partyThemes: Record<VoterPreference, PartyTheme>;
  announcements: any[];
  constituencies: ConstituencyItem[];
  isReady: boolean;
  applyPreset: (presetId: string) => Promise<void>;
  applyTemplate: (templateId: string) => Promise<void>;
  buildApplication: (payload: any) => Promise<any>;
  updateConfig: (next: Partial<CmsConfig>) => Promise<void>;
  updateParties: (nextParties: CmsParty[]) => void;
  updateFeatureToggles: (toggles: Partial<CmsConfig['featureToggles']>) => Promise<void>;
  updateHierarchyLabels: (labels: Record<string, string>) => Promise<void>;
  reloadConfig: () => Promise<void>;
  t: (hierarchyLevel: string, fallback?: string) => string;
  isFeatureEnabled: (feature: keyof CmsConfig['featureToggles']) => boolean;
}

const CmsContext = createContext<CmsContextValue>({
  config: DEFAULT_CONFIG,
  parties: [],
  activeParty: null,
  partyThemes: DEFAULT_PARTY_THEMES,
  announcements: [],
  constituencies: DEFAULT_CONFIG.constituencies,
  isReady: false,
  applyPreset: async () => {},
  applyTemplate: async () => {},
  buildApplication: async () => {},
  updateConfig: async () => {},
  updateParties: () => {},
  updateFeatureToggles: async () => {},
  updateHierarchyLabels: async () => {},
  reloadConfig: async () => {},
  t: (k, fb) => fb || k,
  isFeatureEnabled: () => true,
});

export function CmsProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<CmsConfig>(() => {
    if (typeof window === 'undefined') return DEFAULT_CONFIG;
    const saved = localStorage.getItem('kdp_cms_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as CmsConfig;
        const initialLabels = { ...DEFAULT_CONFIG.hierarchyLabels, ...(parsed.hierarchyLabels || {}) };
        if (initialLabels.VOTER_GROUP && (initialLabels.VOTER_GROUP === 'Indiramma Incharge (100 Voters)' || initialLabels.VOTER_GROUP.includes('Indiramma'))) {
          initialLabels.VOTER_GROUP = '100 Voters Incharge';
        }
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          activeHierarchyLevels: parsed.activeHierarchyLevels || DEFAULT_CONFIG.activeHierarchyLevels,
          featureToggles: { ...DEFAULT_CONFIG.featureToggles, ...(parsed.featureToggles || {}) },
          hierarchyLabels: initialLabels,
          constituencies: parsed.constituencies?.length ? parsed.constituencies : DEFAULT_CONFIG.constituencies,
        };
      } catch {
        // ignore
      }
    }
    return DEFAULT_CONFIG;
  });

  const [parties, setParties] = useState<CmsParty[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [constituencies, setConstituencies] = useState<ConstituencyItem[]>(config.constituencies || DEFAULT_CONFIG.constituencies);
  const [isReady, setIsReady] = useState(false);

  const loadData = async () => {
    try {
      const data = await fetchCmsConfig();
      const constList = await fetchConstituenciesApi();

      const mergedLabels = {
        ...DEFAULT_CONFIG.hierarchyLabels,
        ...(data?.config?.hierarchyLabels || {}),
      };
      if (mergedLabels.VOTER_GROUP && (mergedLabels.VOTER_GROUP === 'Indiramma Incharge (100 Voters)' || mergedLabels.VOTER_GROUP.includes('Indiramma'))) {
        mergedLabels.VOTER_GROUP = '100 Voters Incharge';
      }

      setConfig({
        ...DEFAULT_CONFIG,
        ...(data?.config || {}),
        hierarchyLabels: mergedLabels,
        constituencies: constList.length > 0 ? constList : (data?.config?.constituencies || DEFAULT_CONFIG.constituencies),
      });

      const rawParties = Array.isArray(data?.parties) ? data.parties : [];
      const cleanParties = rawParties.filter(
        (p: any) => !p.code?.startsWith('TEST_') && p.name !== 'Democratic Progressive Front'
      );
      setParties(cleanParties);
      if (cleanParties.length > 0) {
        localStorage.setItem('kdp_custom_parties', JSON.stringify(cleanParties));
      } else {
        localStorage.removeItem('kdp_custom_parties');
      }

      setAnnouncements(Array.isArray(data?.announcements) ? data.announcements : []);
      if (constList.length > 0) {
        setConstituencies(constList);
      }
      setIsReady(true);
    } catch {
      setIsReady(true);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update document title, favicon, and CSS variables when config changes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = config.organisationName || 'Political Connect Platform';
      applyThemeVariables(config.primaryColor, config.secondaryColor, config.accentColor);
      localStorage.setItem('kdp_cms_config', JSON.stringify(config));
    }
  }, [config]);

  const activeParty = useMemo(() => {
    return parties.find((p) => p.code === config.activePartyCode) || parties[0] || null;
  }, [parties, config.activePartyCode]);

  const partyThemes = useMemo(() => buildPartyThemes(parties), [parties]);

  const applyPreset = async (presetId: string) => {
    const preset = PARTY_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const nextConfig: CmsConfig = {
      ...config,
      organisationName: preset.appName,
      headerTitle: preset.appName,
      stateName: preset.stateName,
      activePartyCode: preset.code,
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
      accentColor: preset.accentColor,
      slogan: preset.slogan,
      logoUrl: preset.logoUrl,
    };

    setConfig(nextConfig);
    applyThemeVariables(preset.primaryColor, preset.secondaryColor, preset.accentColor);
    await saveCmsConfig(nextConfig);
  };

  const applyTemplate = async (templateId: string) => {
    const tpl = APPLICATION_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;

    const payload = {
      appName: tpl.name,
      organisationName: tpl.name,
      headerTitle: tpl.name,
      slogan: tpl.slogan,
      logoUrl: tpl.logoUrl,
      stateName: tpl.stateName,
      primaryColor: tpl.primaryColor,
      secondaryColor: tpl.secondaryColor,
      accentColor: tpl.accentColor,
      activePartyCode: tpl.activePartyCode,
      appScope: tpl.scope,
      activeHierarchyLevels: tpl.hierarchyLevels,
      parliamentName: tpl.parliamentName,
      constituencies: tpl.constituencies,
      politicalParties: tpl.parties,
    };

    await buildApplication(payload);
  };

  const buildApplication = async (payload: any) => {
    const res: any = await buildApplicationApi(payload);

    const app = res?.application || payload;
    const activeHierarchyLevels = payload.activeHierarchyLevels && payload.activeHierarchyLevels.length > 0
      ? payload.activeHierarchyLevels
      : (app.activeHierarchyLevels || config.activeHierarchyLevels);

    const nextConfig: CmsConfig = {
      ...config,
      organisationName: app.organisationName || app.appName || payload.appName || payload.organisationName,
      headerTitle: app.headerTitle || app.appName || payload.headerTitle || payload.organisationName,
      stateName: app.stateName || payload.stateName,
      slogan: app.slogan || payload.slogan,
      logoUrl: app.logoUrl || payload.logoUrl,
      primaryColor: app.primaryColor || payload.primaryColor,
      secondaryColor: app.secondaryColor || payload.secondaryColor,
      accentColor: app.accentColor || payload.accentColor,
      activePartyCode: app.activePartyCode || payload.activePartyCode,
      appScope: app.appScope || payload.appScope,
      activeHierarchyLevels,
      parliamentName: app.parliamentName || payload.parliamentName,
      constituencies: res?.constituencies || app.constituencies || payload.constituencies || [],
    };

    setConfig(nextConfig);
    if (res?.constituencies) {
      setConstituencies(res.constituencies);
    }
    if (res?.parties && res.parties.length > 0) {
      setParties(res.parties);
      localStorage.setItem('kdp_custom_parties', JSON.stringify(res.parties));
    } else if (payload.politicalParties && payload.politicalParties.length > 0) {
      setParties(payload.politicalParties);
      localStorage.setItem('kdp_custom_parties', JSON.stringify(payload.politicalParties));
    }
    applyThemeVariables(nextConfig.primaryColor, nextConfig.secondaryColor, nextConfig.accentColor);
    localStorage.setItem('kdp_cms_config', JSON.stringify(nextConfig));
    return res;
  };

  const updateParties = (nextParties: CmsParty[]) => {
    setParties(nextParties);
    localStorage.setItem('kdp_custom_parties', JSON.stringify(nextParties));
  };

  const updateConfig = async (next: Partial<CmsConfig>) => {
    const merged = { ...config, ...next };
    setConfig(merged);
    await saveCmsConfig(merged);
  };

  const updateFeatureToggles = async (toggles: Partial<CmsConfig['featureToggles']>) => {
    const nextToggles = { ...config.featureToggles, ...toggles };
    const merged = { ...config, featureToggles: nextToggles };
    setConfig(merged);
    await saveCmsConfig(merged);
  };

  const updateHierarchyLabels = async (labels: Record<string, string>) => {
    const nextLabels = { ...config.hierarchyLabels, ...labels };
    const merged = { ...config, hierarchyLabels: nextLabels };
    setConfig(merged);
    await saveCmsConfig(merged);
  };

  const reloadConfig = async () => {
    await loadData();
  };

  const t = (hierarchyLevel: string, fallback?: string): string => {
    const label = config.hierarchyLabels?.[hierarchyLevel];
    if (label === 'Indiramma Incharge (100 Voters)' || (hierarchyLevel === 'VOTER_GROUP' && label?.includes('Indiramma'))) {
      return '100 Voters Incharge';
    }
    return label || fallback || hierarchyLevel;
  };

  const isFeatureEnabled = (feature: keyof CmsConfig['featureToggles']): boolean => {
    return config.featureToggles[feature] ?? true;
  };

  return (
    <CmsContext.Provider
      value={{
        config,
        parties,
        activeParty,
        partyThemes,
        announcements,
        constituencies,
        isReady,
        applyPreset,
        applyTemplate,
        buildApplication,
        updateConfig,
        updateParties,
        updateFeatureToggles,
        updateHierarchyLabels,
        reloadConfig,
        t,
        isFeatureEnabled,
      }}
    >
      {children}
    </CmsContext.Provider>
  );
}

export function useCms() {
  const context = useContext(CmsContext);
  if (!context) {
    throw new Error('useCms must be used within a CmsProvider');
  }
  return context;
}
