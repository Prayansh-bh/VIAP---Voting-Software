import React, { useState, useEffect } from 'react';
import {
  Palette,
  Sparkles,
  Save,
  CheckCircle2,
  ExternalLink,
  Shield,
  Layers,
  Sliders,
  Vote,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { AppInstance } from '../types';
import { getAdminToken } from '../lib/auth';
import { useNotification } from '../context/NotificationContext';

interface CmsBrandStudioProps {
  currentApp: AppInstance | null;
  onRefreshApps?: () => void;
}

export default function CmsBrandStudio({ currentApp, onRefreshApps }: CmsBrandStudioProps) {
  const { notify } = useNotification();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [cmsConfig, setCmsConfig] = useState({
    organisationName: currentApp?.name || 'Telugu Desam Party',
    headerTitle: currentApp?.name || 'Kondapi TDP Connect',
    slogan: currentApp?.description || 'MLA Ground Command & Micro-Targeted Booth Mobilization',
    stateName: 'Andhra Pradesh',
    activePartyCode: currentApp?.partyCode || 'TDP',
    primaryColor: currentApp?.primaryColor || '#F59E0B',
    secondaryColor: currentApp?.secondaryColor || '#DC2626',
    accentColor: currentApp?.accentColor || '#0F172A',
    candidateName: currentApp?.leaderName || 'Dr. Dola Sree Bala Veeranjaneya Swamy',
    electionYear: 2026,
    targetSeats: 175,
    majorityMark: 88,
    features: {
      voterManagement: true,
      liveVoteTracking: true,
      cadreNetwork: true,
      fakeVoterFlagging: true,
      groundReports: true,
      aiStrategicIntelligence: true,
    },
  });

  useEffect(() => {
    async function fetchConfig() {
      setLoading(true);
      try {
        const token = getAdminToken();
        const res = await fetch('http://localhost:4000/api/cms/config', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const json = await res.json();
          const c = json?.data?.config;
          if (c) {
            setCmsConfig((prev) => ({
              ...prev,
              organisationName: c.organisationName || prev.organisationName,
              headerTitle: c.headerTitle || prev.headerTitle,
              slogan: c.slogan || prev.slogan,
              stateName: c.stateName || prev.stateName,
              activePartyCode: c.activePartyCode || prev.activePartyCode,
              primaryColor: c.primaryColor || prev.primaryColor,
              secondaryColor: c.secondaryColor || prev.secondaryColor,
              accentColor: c.accentColor || prev.accentColor,
              candidateName: c.candidateName || prev.candidateName,
              features: {
                ...prev.features,
                ...(c.featureToggles || {}),
              },
            }));
          }
        }
      } catch (err) {
        console.warn('Failed to fetch live cms config:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, [currentApp]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);

    try {
      const token = getAdminToken();
      const res = await fetch('http://localhost:4000/api/cms/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          organisationName: cmsConfig.organisationName,
          headerTitle: cmsConfig.headerTitle,
          slogan: cmsConfig.slogan,
          stateName: cmsConfig.stateName,
          activePartyCode: cmsConfig.activePartyCode,
          primaryColor: cmsConfig.primaryColor,
          secondaryColor: cmsConfig.secondaryColor,
          accentColor: cmsConfig.accentColor,
          candidateName: cmsConfig.candidateName,
          featureToggles: cmsConfig.features,
          analyticsConfig: {
            electionYear: cmsConfig.electionYear,
            targetSeats: cmsConfig.targetSeats,
            majorityMark: cmsConfig.majorityMark,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to save CMS configuration (Status ${res.status})`);
      }

      setSuccessMsg('CMS Configuration successfully saved & synchronized to PostgreSQL database!');
      notify.success('CMS & Brand Studio configuration saved to database.', 'Configuration Saved');
      if (onRefreshApps) onRefreshApps();
      setTimeout(() => setSuccessMsg(null), 8000);
    } catch (err: any) {
      notify.error(err.message || 'Error saving CMS configuration.', 'Save Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Palette className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-white">CMS Brand Studio & Architecture Engine</h1>
          </div>
          <p className="text-xs text-slate-400">
            Authoritative dynamic configuration for political identity, campaign themes, color tokens, and election telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition flex items-center gap-1.5"
          >
            <span>Preview Party App</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Live Brand Preview Card */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Live In-App Visual Header Preview
        </div>
        <div
          className="p-5 rounded-2xl border transition relative overflow-hidden"
          style={{
            borderColor: cmsConfig.primaryColor,
            backgroundColor: '#020617',
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-lg"
                style={{ backgroundColor: cmsConfig.primaryColor }}
              >
                {cmsConfig.activePartyCode || 'APP'}
              </div>
              <div>
                <div className="text-base font-black text-white leading-tight">
                  {cmsConfig.headerTitle}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {cmsConfig.slogan}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-white shadow-xs"
                style={{ backgroundColor: cmsConfig.secondaryColor }}
              >
                {cmsConfig.stateName}
              </span>
              <span
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-white shadow-xs"
                style={{ backgroundColor: cmsConfig.accentColor }}
              >
                {cmsConfig.activePartyCode}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main CMS Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Identity Block */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Shield className="w-4 h-4 text-amber-400" />
              <span>Political Identity & Headquarters</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Application Header Title
                </label>
                <input
                  type="text"
                  value={cmsConfig.headerTitle}
                  onChange={(e) => setCmsConfig({ ...cmsConfig, headerTitle: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-amber-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Political Party Full Name
                </label>
                <input
                  type="text"
                  value={cmsConfig.organisationName}
                  onChange={(e) => setCmsConfig({ ...cmsConfig, organisationName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-amber-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Party Code / Acronym
                  </label>
                  <input
                    type="text"
                    value={cmsConfig.activePartyCode}
                    onChange={(e) => setCmsConfig({ ...cmsConfig, activePartyCode: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-bold uppercase focus:border-amber-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    State Jurisdiction
                  </label>
                  <input
                    type="text"
                    value={cmsConfig.stateName}
                    onChange={(e) => setCmsConfig({ ...cmsConfig, stateName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-amber-400 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Candidate / MLA Leader Name
                </label>
                <input
                  type="text"
                  value={cmsConfig.candidateName}
                  onChange={(e) => setCmsConfig({ ...cmsConfig, candidateName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-amber-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Campaign Slogan / Tagline
                </label>
                <input
                  type="text"
                  value={cmsConfig.slogan}
                  onChange={(e) => setCmsConfig({ ...cmsConfig, slogan: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-amber-400 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Color Tokens & Election Goals */}
          <div className="space-y-5">
            {/* Color Palette */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Palette className="w-4 h-4 text-amber-400" />
                <span>Brand Palette (Hex Colors)</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                  <input
                    type="color"
                    value={cmsConfig.primaryColor}
                    onChange={(e) => setCmsConfig({ ...cmsConfig, primaryColor: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold">Primary</div>
                    <div className="text-xs font-mono font-bold text-white">{cmsConfig.primaryColor}</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                  <input
                    type="color"
                    value={cmsConfig.secondaryColor}
                    onChange={(e) => setCmsConfig({ ...cmsConfig, secondaryColor: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold">Secondary</div>
                    <div className="text-xs font-mono font-bold text-white">{cmsConfig.secondaryColor}</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                  <input
                    type="color"
                    value={cmsConfig.accentColor}
                    onChange={(e) => setCmsConfig({ ...cmsConfig, accentColor: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold">Accent</div>
                    <div className="text-xs font-mono font-bold text-white">{cmsConfig.accentColor}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Strategic Targets */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <span>Election Targets & Analytics Marks</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Election Year
                  </label>
                  <input
                    type="number"
                    value={cmsConfig.electionYear}
                    onChange={(e) => setCmsConfig({ ...cmsConfig, electionYear: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Target Seats
                  </label>
                  <input
                    type="number"
                    value={cmsConfig.targetSeats}
                    onChange={(e) => setCmsConfig({ ...cmsConfig, targetSeats: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Majority Mark
                  </label>
                  <input
                    type="number"
                    value={cmsConfig.majorityMark}
                    onChange={(e) => setCmsConfig({ ...cmsConfig, majorityMark: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-bold outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>Platform Core Feature Gates</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(cmsConfig.features).map(([key, val]) => (
              <label
                key={key}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs cursor-pointer hover:border-slate-700 transition"
              >
                <span className="font-semibold text-slate-300 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <input
                  type="checkbox"
                  checked={val}
                  onChange={(e) =>
                    setCmsConfig({
                      ...cmsConfig,
                      features: {
                        ...cmsConfig.features,
                        [key]: e.target.checked,
                      },
                    })
                  }
                  className="rounded text-amber-400 focus:ring-0 cursor-pointer"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-lg shadow-amber-400/20 transition flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Synchronizing to PostgreSQL...' : 'Save & Deploy Live CMS Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
