/**
 * Platform Admin Portal — Kondapi Platform Administration
 * Multi-tenant engine for creating and managing constituency applications
 * Modeled after data-assigining.ai.studio
 */
import React, { useState, useEffect } from 'react';
import {
  Settings,
  Plus,
  Search,
  Eye,
  Edit3,
  Copy,
  ChevronLeft,
  Monitor,
  Smartphone,
  ShieldCheck,
  Users,
  BarChart3,
  MapPin,
  CheckCircle2,
  AlertCircle,
  X,
  Upload,
  ArrowLeft,
  Layers,
  Activity,
  Building2,
  Zap,
  Database,
  ClipboardCheck,
} from 'lucide-react';
import { useCms } from '../context/CmsContext';
import { fetchCmsApplications, fetchApplicationSummary, type ApplicationSummaryKpis } from '../lib/api/applications.api';
import AssignDataModule from './cms/AssignDataModule';
import AssignInchargesModule from './cms/AssignInchargesModule';
import ApprovalManagementModule from './cms/ApprovalManagementModule';

// ─── Types ──────────────────────────────────────────────────────────────────
interface AppInstance {
  id: string;
  name: string;
  party: string;
  partyCode: string;
  leaderName: string;
  jurisdiction: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  totalVoters: number;
  turnoutPercent: number;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  logoUrl?: string;
}

// ─── Live Brand Preview ───────────────────────────────────────────────────
function LiveBrandPreview({
  app,
  isMobile,
}: {
  app: Partial<AppInstance> | null;
  isMobile: boolean;
}) {
  const name = app?.name || 'Your App Name';
  const primary = app?.primaryColor || '#FF6600';
  const secondary = app?.secondaryColor || '#138808';
  const partyCode = app?.partyCode || 'INC';
  const voters = app?.totalVoters || 0;
  const turnout = app?.turnoutPercent || 0;
  const jurisdiction = app?.jurisdiction || 'Your Jurisdiction';

  return (
    <div
      className={`border border-gray-200 rounded-2xl overflow-hidden shadow-md bg-white transition-all duration-300 ${
        isMobile ? 'max-w-[280px] mx-auto' : 'w-full'
      }`}
    >
      {/* Preview top bar */}
      <div className="h-1 flex">
        <div className="flex-1" style={{ backgroundColor: primary }} />
      </div>

      {/* App Preview Content */}
      <div className="p-4 space-y-3">
        {/* Logo + Title */}
        <div className="flex flex-col items-center gap-2 py-2">
          <div
            className="w-12 h-12 rounded-full border-4 flex items-center justify-center bg-white font-black text-sm"
            style={{ borderColor: primary, color: primary }}
          >
            {partyCode.slice(0, 3)}
          </div>
          <div className="text-center">
            <div className="font-black text-slate-900 text-sm leading-tight">{name}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mt-0.5">
              INTEGRATED VOTER MANAGEMENT
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5">Jurisdiction: {jurisdiction}</div>
          </div>
        </div>

        {/* Active Parties */}
        <div className="border border-gray-100 rounded-xl p-2.5">
          <div className="text-[9px] uppercase tracking-wider font-bold text-slate-400 mb-1">
            ACTIVE POLITICAL PARTIES
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-black"
              style={{ backgroundColor: primary }}
            >
              {partyCode.slice(0, 1)}
            </div>
            <span className="text-[10px] font-bold text-slate-700">{app?.party || 'Indian National Congress'}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="border border-gray-100 rounded-xl p-2.5">
            <div className="text-[8px] uppercase tracking-wide font-bold text-slate-400">TOTAL VOTERS</div>
            <div className="text-base font-black text-slate-900 mt-0.5">
              {voters > 0 ? (voters / 1000000).toFixed(1) + 'M' : '—'}
            </div>
            <div className="text-[8px] text-green-600 font-bold mt-0.5">▲ 100% Verified</div>
          </div>
          <div className="border border-gray-100 rounded-xl p-2.5">
            <div className="text-[8px] uppercase tracking-wide font-bold text-slate-400">TURNOUT DONE</div>
            <div className="text-base font-black text-slate-900 mt-0.5">{turnout > 0 ? `${turnout}%` : '—'}</div>
            <div className="h-1 rounded-full mt-1.5 bg-gray-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${turnout}%`, backgroundColor: primary }}
              />
            </div>
          </div>
        </div>

        {/* CTA Buttons */}
        <button
          className="w-full py-2 rounded-xl text-xs font-black uppercase tracking-wide text-white"
          style={{ backgroundColor: primary }}
        >
          ⚡ ESTABLISH SECURE SESSION
        </button>
        <button className="w-full py-2 rounded-xl text-xs font-bold uppercase tracking-wide border border-gray-200 text-slate-700">
          DOWNLOAD GROUND REPORTS
        </button>

        <div className="text-center text-[8px] text-slate-300 uppercase tracking-widest pt-1">
          SECURE OPERATIONAL NODE: APP-TPCC
        </div>
      </div>
    </div>
  );
}

// ─── Create New App Form ──────────────────────────────────────────────────
function CreateAppForm({ onClose, onCreate }: { onClose: () => void; onCreate: (app: AppInstance) => void }) {
  const [form, setForm] = useState({
    name: '',
    party: 'Indian National Congress',
    partyCode: 'INC',
    leaderName: '',
    jurisdiction: '',
    description: '',
    primaryColor: '#FF6600',
    secondaryColor: '#138808',
    accentColor: '#0038A8',
    totalVoters: 0,
    turnoutPercent: 0,
  });
  const [previewMobile, setPreviewMobile] = useState(false);
  const [selectedHierarchy, setSelectedHierarchy] = useState<string[]>([
    'VOTER_GROUP',
    'BOOTH',
    'VILLAGE',
    'MANDAL',
    'CONSTITUENCY',
  ]);

  const handleCreate = async () => {
    if (!form.name || !form.jurisdiction) return;
    const newApp: AppInstance = {
      id: Date.now().toString(),
      ...form,
      isActive: true,
      isDefault: false,
      createdAt: new Date().toLocaleDateString('en-IN'),
    };
    try {
      const { apiFetch } = await import('../lib/api');
      await apiFetch('/api/cms/build-application', {
        method: 'POST',
        body: JSON.stringify({
          appName: form.name,
          organisationName: form.name,
          stateName: form.jurisdiction.includes('Andhra') ? 'Andhra Pradesh' : 'Telangana',
          primaryColor: form.primaryColor,
          secondaryColor: form.secondaryColor,
          accentColor: form.accentColor,
          activePartyCode: form.partyCode,
          activeHierarchyLevels: selectedHierarchy,
        }),
      });
    } catch {
      // safe fallback
    }
    onCreate(newApp);
    onClose();
  };

  return (
    <div className="flex gap-6 h-full">
      {/* Left Form Panel */}
      <div className="flex-1 overflow-y-auto space-y-5 pr-2">
        {/* App Name */}
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
            APPLICATION NAME *
          </label>
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:border-transparent bg-gray-50"
            style={{ '--tw-ring-color': form.primaryColor } as any}
            placeholder="e.g. Warangal Congress Connect"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>

        {/* Party Details */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
              PARTY NAME
            </label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none bg-gray-50"
              placeholder="Indian National Congress"
              value={form.party}
              onChange={(e) => setForm((f) => ({ ...f, party: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
              PARTY CODE
            </label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none bg-gray-50 uppercase"
              placeholder="INC"
              value={form.partyCode}
              onChange={(e) => setForm((f) => ({ ...f, partyCode: e.target.value.toUpperCase() }))}
            />
          </div>
        </div>

        {/* Leader Name */}
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
            LEADER / CANDIDATE NAME
          </label>
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none bg-gray-50"
            placeholder="e.g. Revanth Reddy"
            value={form.leaderName}
            onChange={(e) => setForm((f) => ({ ...f, leaderName: e.target.value }))}
          />
        </div>

        {/* Jurisdiction */}
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
            JURISDICTION / CONSTITUENCY *
          </label>
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none bg-gray-50"
            placeholder="e.g. Warangal Parliament Constituency"
            value={form.jurisdiction}
            onChange={(e) => setForm((f) => ({ ...f, jurisdiction: e.target.value }))}
          />
        </div>

        {/* Party Names Row */}
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
            COMPETING PARTY NAMES (comma separated)
          </label>
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none bg-gray-50"
            placeholder="INC, BRS, BJP, AIMIM, OTH"
          />
          <button className="mt-1.5 text-[10px] font-bold flex items-center gap-1" style={{ color: form.primaryColor }}>
            <Plus className="w-3 h-3" /> ADD PARTY NAME
          </button>
        </div>

        {/* Color Pickers */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'PRIMARY COLOR', key: 'primaryColor' },
            { label: 'SECONDARY COLOR', key: 'secondaryColor' },
            { label: 'ACCENT COLOR', key: 'accentColor' },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                {label}
              </label>
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-2.5 py-2 bg-gray-50">
                <input
                  type="color"
                  className="w-5 h-5 rounded cursor-pointer border-0"
                  value={(form as any)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
                <span className="text-xs font-mono font-bold text-slate-600 uppercase">
                  {(form as any)[key]}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Description */}
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
            APPLICATION DESCRIPTION (OPTIONAL)
          </label>
          <textarea
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none bg-gray-50 resize-none"
            placeholder="Provide a brief explanation of this application's scope..."
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>

        {/* Dynamic Hierarchy Selection */}
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
            ENABLED HIERARCHY LEVELS * (Only selected tiers appear in Party App)
          </label>
          <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-200">
            {[
              { key: 'VOTER_GROUP', label: '100 Voters Incharge' },
              { key: 'BOOTH', label: 'Booth Incharge / President' },
              { key: 'VILLAGE', label: 'Village Incharge' },
              { key: 'MANDAL', label: 'Mandal President' },
              { key: 'CONSTITUENCY', label: 'Constituency Incharge' },
              { key: 'DISTRICT', label: 'District Incharge' },
              { key: 'ZONE', label: 'Zone Coordinator' },
              { key: 'STATE', label: 'State Incharge / HQ' },
            ].map(({ key, label }) => {
              const isChecked = selectedHierarchy.includes(key);
              return (
                <label
                  key={key}
                  className={`flex items-center gap-2 p-2 rounded-xl text-xs font-bold cursor-pointer transition border ${
                    isChecked
                      ? 'bg-white border-amber-300 text-slate-900 shadow-xs'
                      : 'bg-transparent border-transparent text-slate-400 hover:bg-gray-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedHierarchy((prev) => [...prev, key]);
                      } else {
                        setSelectedHierarchy((prev) => prev.filter((k) => k !== key));
                      }
                    }}
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Levels left unchecked (e.g. State, District, Zone) will be completely hidden from the Party Application.
          </p>
        </div>

        {/* Logo Upload */}
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 text-center">
            APPLICATION LOGO
          </label>
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-orange-300 transition-colors">
            <Upload className="w-6 h-6 text-gray-300 mx-auto mb-2" />
            <button className="text-sm font-bold" style={{ color: form.primaryColor }}>
              ⬆ Select Logo
            </button>
            <p className="text-[10px] text-gray-400 mt-1">PNG / JPG (max 2MB)</p>
          </div>
        </div>

        {/* Create Button */}
        <button
          onClick={handleCreate}
          disabled={!form.name || !form.jurisdiction}
          className="w-full py-3.5 rounded-xl text-sm font-black uppercase tracking-widest text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ backgroundColor: form.primaryColor }}
        >
          <Plus className="w-4 h-4" />
          CREATE APPLICATION
        </button>
      </div>

      {/* Right Preview Panel */}
      <div className="w-72 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
            <Eye className="w-3.5 h-3.5" />
            LIVE BRAND PREVIEW
          </div>
          <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-lg">
            <button
              onClick={() => setPreviewMobile(false)}
              className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wide transition-all ${
                !previewMobile ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              DESKTOP
            </button>
            <button
              onClick={() => setPreviewMobile(true)}
              className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wide transition-all ${
                previewMobile ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              MOBILE
            </button>
          </div>
        </div>
        <LiveBrandPreview app={form as any} isMobile={previewMobile} />
      </div>
    </div>
  );
}

// ─── Main Platform Admin Portal ──────────────────────────────────────────
export default function PlatformAdminPortal() {
  const [apps, setApps] = useState<AppInstance[]>([]);
  const [selectedApp, setSelectedApp] = useState<AppInstance | null>(null);
  const [summaryKpis, setSummaryKpis] = useState<ApplicationSummaryKpis | null>(null);
  const [view, setView] = useState<'list' | 'create' | 'assign-data' | 'assign-incharges' | 'approvals'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [previewMobile, setPreviewMobile] = useState(false);

  const { config, updateConfig } = useCms();

  useEffect(() => {
    async function loadBackendApps() {
      try {
        const backendConfigs = await fetchCmsApplications();
        if (backendConfigs && backendConfigs.length > 0) {
          const mapped: AppInstance[] = backendConfigs.map((c) => ({
            id: c.id,
            name: c.appName || c.organisationName,
            party: c.parties?.[0]?.name || 'Telugu Desam Party',
            partyCode: c.parties?.[0]?.code || 'TDP',
            leaderName: c.candidateName || 'Constituency In-Charge',
            jurisdiction: `${c.appName} (${c.constituenciesCount || 1} Constituencies)`,
            description: `CMS Application for ${c.appName}, ${c.stateName}`,
            primaryColor: c.primaryColor || '#F59E0B',
            secondaryColor: c.secondaryColor || '#DC2626',
            accentColor: c.accentColor || '#0F172A',
            totalVoters: c.votersCount || 0,
            turnoutPercent: c.turnoutPercent || 0,
            isActive: true,
            isDefault: c.isDefault || false,
            createdAt: new Date(c.createdAt).toLocaleDateString('en-IN'),
          }));
          setApps(mapped);
          setSelectedApp(mapped.find((a) => a.isDefault) || mapped[0] || null);
        }
      } catch (err) {
        console.error('Failed to load apps from backend:', err);
      }
    }
    loadBackendApps();
  }, []);

  useEffect(() => {
    if (!selectedApp?.id) {
      setSummaryKpis(null);
      return;
    }
    fetchApplicationSummary(selectedApp.id)
      .then((kpis) => setSummaryKpis(kpis))
      .catch(() => setSummaryKpis(null));
  }, [selectedApp?.id]);

  const handleLaunchApp = async (app: AppInstance) => {
    setApps((prev) => prev.map((a) => ({ ...a, isDefault: a.id === app.id })));
    try {
      await updateConfig({
        organisationName: app.name,
        activePartyCode: app.partyCode,
        primaryColor: app.primaryColor,
        secondaryColor: app.secondaryColor,
        accentColor: app.accentColor,
        candidateName: app.leaderName,
        stateName: app.jurisdiction,
      });
    } catch {
      // fallback
    }
    window.location.hash = '/app';
  };

  const filteredApps = apps.filter((app) => {
    const matchSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.party.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.jurisdiction.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus =
      filterStatus === 'All' ||
      (filterStatus === 'Active' && app.isActive) ||
      (filterStatus === 'Inactive' && !app.isActive);
    return matchSearch && matchStatus;
  });

  const handleSetDefault = (appId: string) => {
    setApps((prev) => prev.map((a) => ({ ...a, isDefault: a.id === appId })));
    setSelectedApp(apps.find((a) => a.id === appId) || null);
  };

  const handleDuplicate = (app: AppInstance) => {
    const clone: AppInstance = {
      ...app,
      id: Date.now().toString(),
      name: `${app.name} (Copy)`,
      isDefault: false,
      createdAt: new Date().toLocaleDateString('en-IN'),
    };
    setApps((prev) => [...prev, clone]);
  };

  const defaultApp = apps.find((a) => a.isDefault);

  return (
    <div id="platform-admin-root" className="min-h-screen bg-slate-900/90 p-3 sm:p-6 font-sans antialiased flex justify-center items-start">
      <div className="w-full max-w-7xl bg-slate-100 rounded-[28px] shadow-2xl border border-slate-300 overflow-hidden">
        {/* Dark Blue Header */}
        <div className="bg-[#0F172A] text-white px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  window.history.back();
                } else {
                  window.location.hash = '/roles';
                }
              }}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200 transition-colors shadow-xs cursor-pointer"
              title="Return"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <Settings className="w-5 h-5 text-amber-400" />
                <h1 className="font-bold text-lg md:text-xl tracking-tight text-white">
                  {config.organisationName || 'Kondapi'} Platform Administration
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400 text-slate-950 shadow-xs">
                  MULTI-TENANT ENGINE
                </span>
              </div>
              <p className="text-xs text-slate-400 font-normal mt-0.5">
                Configure, deploy, and isolate branded constituency applications from the master template
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setView('list')}
              className={`px-3.5 py-1.5 rounded-xl text-xs md:text-sm transition-all cursor-pointer ${
                view === 'list'
                  ? 'bg-amber-400 text-slate-950 shadow-md font-bold'
                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white font-medium'
              }`}
            >
              Manage Applications
            </button>
            <button
              onClick={() => setView('create')}
              className={`px-3.5 py-1.5 rounded-xl text-xs md:text-sm transition-all cursor-pointer ${
                view === 'create'
                  ? 'bg-amber-400 text-slate-950 shadow-md font-bold'
                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white font-medium'
              }`}
            >
              Create New App
            </button>
            <button
              onClick={() => setView('assign-data')}
              className={`px-3.5 py-1.5 rounded-xl text-xs md:text-sm transition-all cursor-pointer ${
                view === 'assign-data'
                  ? 'bg-amber-400 text-slate-950 shadow-md font-bold'
                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white font-medium'
              }`}
            >
              Assign Data
            </button>
            <button
              onClick={() => setView('assign-incharges')}
              className={`px-3.5 py-1.5 rounded-xl text-xs md:text-sm transition-all cursor-pointer ${
                view === 'assign-incharges'
                  ? 'bg-amber-400 text-slate-950 shadow-md font-bold'
                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white font-medium'
              }`}
            >
              Assign Incharges
            </button>
            <button
              onClick={() => setView('approvals')}
              className={`px-3.5 py-1.5 rounded-xl text-xs md:text-sm transition-all cursor-pointer flex items-center gap-1.5 ${
                view === 'approvals'
                  ? 'bg-amber-400 text-slate-950 shadow-md font-bold'
                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white font-medium'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Approval Queue</span>
            </button>
          </div>
        </div>

        {/* Main Content Body */}
        <div className="p-4 sm:p-6 bg-slate-50">
          {view === 'approvals' ? (
            <ApprovalManagementModule
              partyId={selectedApp?.partyCode || selectedApp?.id}
              onClose={() => setView('list')}
            />
          ) : view === 'assign-data' ? (
            <AssignDataModule
              initialAppId={selectedApp?.id}
              onNavigateToIncharges={(appId) => {
                setSelectedApp(apps.find((a) => a.id === appId) || null);
                setView('assign-incharges');
              }}
              onClose={() => setView('list')}
            />
          ) : view === 'assign-incharges' ? (
            <AssignInchargesModule
              initialAppId={selectedApp?.id}
              onNavigateToData={(appId) => {
                setSelectedApp(apps.find((a) => a.id === appId) || null);
                setView('assign-data');
              }}
              onClose={() => setView('list')}
            />
          ) : view === 'create' ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <button
                  onClick={() => setView('list')}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Apps
                </button>
                <div className="flex-1">
                  <h2 className="font-black text-slate-900 text-lg">Create New Application</h2>
                  <p className="text-xs text-slate-500">Configure a new branded constituency workspace</p>
                </div>
              </div>
              <CreateAppForm
                onClose={() => setView('list')}
                onCreate={(app) => {
                  setApps((prev) => [...prev, app]);
                  setView('list');
                  handleLaunchApp(app);
                }}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
              {/* Left Column: Apps List */}
              <div className="space-y-4">
                {/* CMS Party Executive Summary Dashboard Widgets */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-amber-500" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                        CMS Party Executive Overview ({selectedApp?.name || config.organisationName || 'Platform'})
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">Live Telemetry</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="text-[9px] uppercase font-bold text-slate-400">Total Incharges</div>
                      <div className="text-base font-black text-slate-900 mt-0.5">
                        {summaryKpis ? summaryKpis.totalIncharges.toLocaleString() : '0'}
                      </div>
                      <div className="text-[9px] text-emerald-600 font-bold">Assigned Cadre</div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="text-[9px] uppercase font-bold text-slate-400">Total Voters</div>
                      <div className="text-base font-black text-slate-900 mt-0.5">
                        {summaryKpis ? (summaryKpis.totalVoters > 1000 ? (summaryKpis.totalVoters / 1000).toFixed(0) + 'K' : summaryKpis.totalVoters.toLocaleString()) : (selectedApp?.totalVoters ? (selectedApp.totalVoters > 1000 ? (selectedApp.totalVoters / 1000).toFixed(0) + 'K' : selectedApp.totalVoters.toLocaleString()) : '0')}
                      </div>
                      <div className="text-[9px] text-blue-600 font-bold">Electoral Roll DB</div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="text-[9px] uppercase font-bold text-slate-400">Total Booths</div>
                      <div className="text-base font-black text-slate-900 mt-0.5">
                        {summaryKpis ? summaryKpis.totalBooths.toLocaleString() : '0'}
                      </div>
                      <div className="text-[9px] text-emerald-600 font-bold">Mapped Booths</div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="text-[9px] uppercase font-bold text-slate-400">Completed Surveys</div>
                      <div className="text-base font-black text-slate-900 mt-0.5">
                        {summaryKpis ? summaryKpis.verifiedCount.toLocaleString() : '0'}
                      </div>
                      <div className="text-[9px] text-purple-600 font-bold">Ground Verified</div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="text-[9px] uppercase font-bold text-slate-400">Total Tasks</div>
                      <div className="text-base font-black text-slate-900 mt-0.5">
                        {summaryKpis ? summaryKpis.totalTasks.toLocaleString() : '0'}
                      </div>
                      <div className="text-[9px] text-slate-600 font-bold">Operational</div>
                    </div>
                    <div
                      className="bg-amber-50/80 p-2.5 rounded-xl border border-amber-200 cursor-pointer hover:bg-amber-100 transition"
                      onClick={() => setView('approvals')}
                    >
                      <div className="text-[9px] uppercase font-bold text-amber-800">Pending Approvals</div>
                      <div className="text-base font-black text-amber-900 mt-0.5">0</div>
                      <div className="text-[9px] text-amber-700 font-bold flex items-center gap-1">Open Queue ➔</div>
                    </div>
                  </div>
                </div>

                {/* Amber Warning Box if no default selected */}
                {!defaultApp && (
                  <div className="p-4 rounded-2xl border border-amber-300 bg-amber-50/90 text-amber-900 flex items-start gap-3 shadow-xs">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">
                        No default application selected
                      </h4>
                      <p className="text-xs font-semibold text-amber-800 mt-0.5">
                        Please select an application from the list below and choose <span className="font-black">"Set as Default"</span> to load it automatically on startup.
                      </p>
                    </div>
                  </div>
                )}

                {/* Search and Filter Row */}
                <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                  <div className="w-full sm:w-auto flex-1 relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                      placeholder="Search by name, party, or constituency..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
                    {(['All', 'Active', 'Inactive'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setFilterStatus(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                          filterStatus === s ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* App Cards Grid (2 Column Grid) */}
                {filteredApps.length === 0 ? (
                  <div className="bg-white rounded-2xl p-12 border-2 border-dashed border-slate-200 text-center space-y-3">
                    <Database className="w-10 h-10 text-slate-300 mx-auto" />
                    <h4 className="text-sm font-bold text-slate-700">No Applications Configured</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      No constituency workspaces were found matching your criteria. Create a new application to get started.
                    </p>
                    <button
                      onClick={() => setView('create')}
                      className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-xs transition"
                    >
                      + Create New Application
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredApps.map((app) => {
                      const isSelected = selectedApp?.id === app.id;
                      const isDefault = app.isDefault;

                      return (
                        <div
                          key={app.id}
                          onClick={() => setSelectedApp(app)}
                          className={`relative bg-white rounded-2xl p-4 border-2 transition-all cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between ${
                            isDefault
                              ? 'border-[#F59E0B] ring-2 ring-[#F59E0B]/20'
                              : isSelected
                              ? 'border-slate-400 bg-slate-50/50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {/* Top Active Workspace Gold Pill */}
                          {isDefault && (
                            <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-[#F59E0B] text-slate-950 shadow-xs">
                              <Zap className="w-3 h-3 fill-slate-950" />
                              ACTIVE WORKSPACE
                            </div>
                          )}

                          <div>
                            {/* Card Header: Icon Badge & Name */}
                            <div className="flex items-start gap-3 mb-3">
                              <div
                                className="w-13 h-13 rounded-2xl flex items-center justify-center text-slate-950 font-black text-sm shrink-0 shadow-xs"
                                style={{ backgroundColor: app.primaryColor || '#F59E0B' }}
                              >
                                {app.partyCode.slice(0, 3)}
                              </div>
                              <div className="min-w-0 flex-1 pr-16">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-black text-slate-900 text-sm truncate">{app.name}</h3>
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-emerald-100 text-emerald-700 shrink-0">
                                    ACTIVE
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 font-extrabold truncate mt-0.5">
                                  {app.jurisdiction}
                                </p>
                                {app.party && (
                                  <span className="inline-block mt-1 px-2 py-0.5 rounded bg-slate-100 text-[9px] font-black uppercase text-slate-600 tracking-wider">
                                    {app.party} ({app.partyCode})
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Leader & Location Info */}
                            <div className="space-y-1 text-[11px] text-slate-500 font-semibold mb-3">
                              {app.leaderName && (
                                <div>
                                  Leader: <span className="font-bold text-slate-800">{app.leaderName}</span>
                                </div>
                              )}
                              <div>
                                Loc: <span className="font-bold text-slate-800">{app.jurisdiction}</span>
                              </div>
                            </div>

                            {/* Gray Description Box */}
                            {app.description && (
                              <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-[10px] text-slate-500 leading-relaxed font-semibold mb-3 line-clamp-2">
                                {app.description}
                              </div>
                            )}
                          </div>

                          {/* Card Footer Row */}
                          <div>
                            <div className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-2">
                              CREATED: {app.createdAt}
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
                              {/* Open App Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLaunchApp(app);
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black text-white bg-slate-950 hover:bg-slate-800 shadow-xs transition-all active:scale-95 cursor-pointer"
                              >
                                <span>▶ Open App</span>
                              </button>

                              {/* Assign Data Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedApp(app);
                                  setView('assign-data');
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 transition-all cursor-pointer"
                                title="Upload and Assign Data to this application"
                              >
                                <Database className="w-3 h-3 text-amber-600" /> Assign Data
                              </button>

                              {/* Assign Incharges Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedApp(app);
                                  setView('assign-incharges');
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-blue-900 bg-blue-100 hover:bg-blue-200 transition-all cursor-pointer"
                                title="Assign Incharges and Jurisdiction to this application"
                              >
                                <Users className="w-3 h-3 text-blue-600" /> Assign Incharges
                              </button>

                              {/* Duplicate Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDuplicate(app);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer"
                              >
                                <Copy className="w-3 h-3" /> Duplicate
                              </button>

                              {/* Set Default */}
                              {!app.isDefault && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetDefault(app.id);
                                  }}
                                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 hover:border-amber-400 transition-all cursor-pointer"
                                >
                                  Set as Default
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Live Brand Preview Panel */}
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      <Eye className="w-3.5 h-3.5 text-slate-400" />
                      LIVE BRAND PREVIEW
                    </div>
                    <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
                      <button
                        onClick={() => setPreviewMobile(false)}
                        className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wide transition-all ${
                          !previewMobile ? 'bg-slate-950 text-white shadow-xs' : 'text-slate-500'
                        }`}
                      >
                        DESKTOP
                      </button>
                      <button
                        onClick={() => setPreviewMobile(true)}
                        className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wide transition-all ${
                          previewMobile ? 'bg-slate-950 text-white shadow-xs' : 'text-slate-500'
                        }`}
                      >
                        MOBILE
                      </button>
                    </div>
                  </div>

                  {/* Card Mockup */}
                  <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-xs text-center space-y-3">
                    <div className="w-14 h-14 rounded-full border-4 border-[#F59E0B] text-[#F59E0B] font-black text-sm flex items-center justify-center mx-auto shadow-xs">
                      APP
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-sm">
                        {selectedApp?.name || 'Kondapi TDP Connect'}
                      </h3>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                        CONNECTING PEOPLE, BUILDING PROGRESS
                      </p>
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        Jurisdiction: {selectedApp?.jurisdiction || 'Kondapi Constituency'}
                      </p>
                    </div>

                    {/* Active Political Parties */}
                    <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/50 text-left">
                      <div className="text-[8px] font-black uppercase tracking-wider text-slate-400 mb-1">
                        ACTIVE POLITICAL PARTIES
                      </div>
                      <p className="text-[10px] italic text-slate-400">No active parties defined yet</p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-2 text-left">
                      <div className="border border-slate-100 rounded-xl p-2.5 bg-slate-50/50">
                        <div className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                          TOTAL VOTERS
                        </div>
                        <div className="text-base font-black text-slate-900 mt-0.5">1,247</div>
                        <div className="text-[8px] font-black text-emerald-600 mt-0.5">▲ 100% Verified</div>
                      </div>
                      <div className="border border-slate-100 rounded-xl p-2.5 bg-slate-50/50">
                        <div className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                          TURNOUT DONE
                        </div>
                        <div className="text-base font-black text-slate-900 mt-0.5">76.3%</div>
                        <div className="h-1.5 w-full bg-slate-200 rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-[#F59E0B] rounded-full w-[76.3%]" />
                        </div>
                      </div>
                    </div>

                    {/* Establish Secure Session Primary Button */}
                    <button
                      onClick={() => {
                        if (selectedApp) {
                          handleLaunchApp(selectedApp);
                        } else {
                          window.location.hash = '/app';
                        }
                      }}
                      className="w-full py-3 bg-[#F59E0B] hover:bg-[#d98206] text-slate-950 font-black rounded-xl text-xs tracking-wider uppercase shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                    >
                      <Zap className="w-4 h-4 fill-slate-950" />
                      ESTABLISH SECURE SESSION
                    </button>

                    {/* Secondary Button */}
                    <button
                      onClick={() => {
                        if (selectedApp) {
                          handleLaunchApp(selectedApp);
                        } else {
                          window.location.hash = '/app';
                        }
                      }}
                      className="w-full py-2.5 border border-slate-200 text-slate-700 font-extrabold rounded-xl text-xs uppercase tracking-wider hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      DOWNLOAD GROUND REPORTS
                    </button>

                    <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest pt-1">
                      SECURE OPERATIONAL NODE: APP01-SIM
                    </div>
                  </div>
                </div>

                {/* Bottom Tip Box */}
                <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-4 text-blue-900 space-y-1">
                  <p className="text-[11px] leading-relaxed font-semibold">
                    <span className="font-black">Tip:</span> Ensure you select contrast-compliant color codes. To guarantee that the buttons are readable, have your primary and accent colors be distinct from your background and text tones.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
