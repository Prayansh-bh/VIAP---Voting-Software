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
  getCmsCacheKey,
  getCustomPartiesCacheKey,
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
  reloadConfig: (options?: { organisationId?: string; tenantCode?: string; applicationId?: string; configKey?: string }) => Promise<void>;
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
    let saved = null;
    try {
      const urlParams = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '');
      const tenant = urlParams.get('app') || urlParams.get('tenant') || urlParams.get('applicationId');
      const sessionStr = localStorage.getItem('kdp_active_session');
      let session: any = null;
      if (sessionStr) {
        try { session = JSON.parse(sessionStr); } catch {}
      }
      const requestedApp = tenant || session?.configKey || session?.applicationId;
      if (requestedApp && requestedApp.toLowerCase() !== 'default') {
        const cacheKey = getCmsCacheKey(requestedApp);
        if (cacheKey) {
          saved = localStorage.getItem(cacheKey);
        }
      } else if (!tenant && !session?.configKey && !session?.applicationId && !session?.organisationId) {
        saved = localStorage.getItem('kdp_cms_config_default');
      }
    } catch {}
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

  const loadData = async (options?: { organisationId?: string; tenantCode?: string; applicationId?: string; configKey?: string }) => {
    try {
      // Auto-detect tenant options from session or URL if not explicitly passed
      let effectiveOptions = options;
      if (!effectiveOptions && typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '');
        const urlTenant = urlParams.get('app') || urlParams.get('tenant') || urlParams.get('applicationId');
        const sessionStr = localStorage.getItem('kdp_active_session');
        let session: any = null;
        if (sessionStr) {
          try { session = JSON.parse(sessionStr); } catch {}
        }
        const sessionOrgId = session?.organisationId || session?.organisation?.id;
        const sessionTenant = session?.organisation?.code || session?.configKey;
        if (sessionOrgId || urlTenant || sessionTenant) {
          effectiveOptions = {
            organisationId: sessionOrgId,
            tenantCode: urlTenant || sessionTenant,
            applicationId: urlParams.get('applicationId') || session?.applicationId,
          };
        }
      }

      const data = await fetchCmsConfig(effectiveOptions);
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
      const cacheKey = getCmsCacheKey(data?.config || effectiveOptions);
      const customPartiesKey = getCustomPartiesCacheKey(data?.config || effectiveOptions);
      try {
        if (cacheKey) {
          localStorage.setItem(cacheKey, JSON.stringify(data?.config || {}));
        }
        if (customPartiesKey && cleanParties.length > 0) {
          localStorage.setItem(customPartiesKey, JSON.stringify(cleanParties));
        }
      } catch {}

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
      if (config.faviconUrl && !config.faviconUrl.startsWith('data:')) {
        let favicon = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
        if (!favicon) {
          favicon = document.createElement('link');
          favicon.rel = 'icon';
          document.getElementsByTagName('head')[0].appendChild(favicon);
        }
        favicon.href = config.faviconUrl;
      }
      const toStore = { ...config };
      if (toStore.logoUrl && toStore.logoUrl.startsWith('data:')) {
        toStore.logoUrl = '';
      }
      if (toStore.faviconUrl && toStore.faviconUrl.startsWith('data:')) {
        toStore.faviconUrl = '';
      }
      const cacheKey = getCmsCacheKey(config);
      try {
        if (cacheKey) {
          localStorage.setItem(cacheKey, JSON.stringify(toStore));
        }
      } catch {}
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
    // If logo or favicon is raw base64 data, upload as asset first
    const { uploadAssetApi } = await import('../lib/cms');
    if (payload.logoUrl && payload.logoUrl.startsWith('data:')) {
      try {
        const uploaded = await uploadAssetApi({
          base64Data: payload.logoUrl,
          filename: `${(payload.appName || 'logo').toLowerCase().replace(/[^a-z0-9]/g, '')}-logo.png`,
        });
        payload.logoUrl = uploaded.assetUrl;
      } catch (e) {
        console.warn('Logo asset upload failed in buildApplication:', e);
      }
    }

    if (payload.faviconUrl && payload.faviconUrl.startsWith('data:')) {
      try {
        const uploaded = await uploadAssetApi({
          base64Data: payload.faviconUrl,
          filename: `${(payload.appName || 'favicon').toLowerCase().replace(/[^a-z0-9]/g, '')}-favicon.png`,
        });
        payload.faviconUrl = uploaded.assetUrl;
      } catch (e) {
        console.warn('Favicon asset upload failed in buildApplication:', e);
      }
    }

    let res: any = {};
    try {
      res = await buildApplicationApi(payload);
    } catch (err) {
      console.warn('Backend buildApplicationApi warning:', err);
    }

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
    const toStore = { ...nextConfig };
    if (toStore.logoUrl && toStore.logoUrl.startsWith('data:')) toStore.logoUrl = '';
    localStorage.setItem('kdp_cms_config', JSON.stringify(toStore));
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

  const reloadConfig = async (options?: { organisationId?: string; tenantCode?: string }) => {
    await loadData(options);
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
