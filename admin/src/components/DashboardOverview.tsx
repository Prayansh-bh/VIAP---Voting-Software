import React from 'react';
import {
  Users,
  UserCheck,
  Layers,
  Vote,
  ClipboardCheck,
  ArrowUpRight,
  ShieldAlert,
  Sparkles,
  BarChart3,
  Calendar,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { AppInstance, ApprovalRecord, InchargeRecord, ApplicationSummary } from '../types';

interface DashboardOverviewProps {
  apps: AppInstance[];
  pendingApprovals: ApprovalRecord[];
  incharges?: InchargeRecord[];
  summary?: ApplicationSummary | null;
  selectedApp?: AppInstance | null;
  onNavigateTab: (tab: string) => void;
  onSelectApp: (app: AppInstance) => void;
  onCreateNewApp?: () => void;
}

export default function DashboardOverview({
  apps,
  pendingApprovals,
  incharges = [],
  summary,
  selectedApp,
  onNavigateTab,
  onSelectApp,
  onCreateNewApp,
}: DashboardOverviewProps) {
  const isTenantScoped = Boolean(selectedApp && selectedApp.id);
  const totalVoters = isTenantScoped && summary
    ? summary.totalVoters
    : apps.reduce((acc, a) => acc + (a.totalVoters || 0), 0);
  const activeTenants = apps.filter((a) => a.isActive).length;
  const inchargesCount = isTenantScoped && summary
    ? summary.totalIncharges
    : (summary?.totalIncharges ?? incharges.length);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-amber-500/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                SYSTEM EXECUTIVE OVERVIEW
              </span>
              <span className="text-xs text-slate-400 font-medium">PostgreSQL Engine • Multi-Tenant Mode</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Party Applications & CMS Command Hub
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl mt-1">
              Centralized platform administration for political tenants, dynamic hierarchy provisioning, voter roll synchronization, and field cadre approval workflows.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                if (onCreateNewApp) {
                  onCreateNewApp();
                } else {
                  onNavigateTab('applications');
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-lg shadow-amber-400/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>Create New Party App</span>
            </button>
            <button
              onClick={() => onNavigateTab('approvals')}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <ClipboardCheck className="w-4 h-4 text-amber-400" />
              <span>Pending Approvals ({pendingApprovals.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800/90 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Party Applications</span>
            <Layers className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-3xl font-black text-white">{apps.length}</div>
          <div className="text-xs text-emerald-400 font-semibold mt-1 flex items-center gap-1">
            <span>{activeTenants} Active Tenants</span>
            <span className="text-slate-500">• 100% Isolated</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800/90 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Enrolled Voters</span>
            <Vote className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-3xl font-black text-white">
            {totalVoters > 1000000 ? `${(totalVoters / 1000000).toFixed(2)}M` : totalVoters.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-blue-400 font-semibold mt-1">Electoral Rolls Synchronized</div>
        </div>

        {/* KPI 3 */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800/90 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Deployed Incharges</span>
            <UserCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-white">{inchargesCount.toLocaleString('en-IN')}</div>
          <div className="text-xs text-emerald-400 font-semibold mt-1">
            {inchargesCount > 0 ? `${inchargesCount} Cadres in Database` : '0 Cadres Assigned'}
          </div>
        </div>

        {/* KPI 4 */}
        <div
          onClick={() => onNavigateTab('approvals')}
          className="p-5 rounded-2xl bg-slate-900 border border-amber-500/40 hover:border-amber-400 shadow-sm relative overflow-hidden cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Approval Queue</span>
            <ClipboardCheck className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-3xl font-black text-amber-400">{pendingApprovals.length}</div>
          <div className="text-xs text-amber-300 font-semibold mt-1 flex items-center gap-1">
            <span>{pendingApprovals.length > 0 ? 'Awaiting Super Admin Review' : 'Queue Clear (0 Pending)'}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Main Apps Table & Action Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Applications List */}
        <div className="lg:col-span-2 p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-bold text-white">Configured Party Applications</h2>
            </div>
            <button
              onClick={() => onNavigateTab('applications')}
              className="text-xs text-amber-400 font-bold hover:underline flex items-center gap-1"
            >
              <span>Manage All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {apps.map((app) => (
              <div
                key={app.id}
                className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs shrink-0 shadow-md"
                    style={{ backgroundColor: app.primaryColor || '#F59E0B' }}
                  >
                    {app.partyCode || 'APP'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{app.name}</span>
                      {app.isDefault && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                          PRIMARY
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{app.jurisdiction} • {app.party}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(app.activeHierarchyLevels || ['100_VOTER', 'BOOTH', 'VILLAGE', 'MANDAL', 'CONSTITUENCY']).map((lvl) => (
                        <span key={lvl} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-900 text-slate-400 border border-slate-800">
                          {lvl.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => {
                      onSelectApp(app);
                      onNavigateTab('applications');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
                  >
                    Edit Hierarchy
                  </button>
                  <a
                    href="http://localhost:3000"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 transition"
                    title="Launch Party Application in new window"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Operational Status & Quick Actions */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Platform Governance Actions</span>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={() => onNavigateTab('data')}
              className="w-full p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 text-left transition flex items-center justify-between group"
            >
              <div>
                <div className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition">
                  Ingest Voter Rolls (XLSX / CSV)
                </div>
                <div className="text-[11px] text-slate-500">Import polling booths, sections, & electoral lists</div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition" />
            </button>

            <button
              onClick={() => onNavigateTab('incharges')}
              className="w-full p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 text-left transition flex items-center justify-between group"
            >
              <div>
                <div className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition">
                  Deploy & Transfer Incharges
                </div>
                <div className="text-[11px] text-slate-500">Manage replacements, status toggles & resets</div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition" />
            </button>

            <button
              onClick={() => onNavigateTab('approvals')}
              className="w-full p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 text-left transition flex items-center justify-between group"
            >
              <div>
                <div className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition">
                  Review Approvals Queue ({pendingApprovals.length})
                </div>
                <div className="text-[11px] text-slate-500">Authorise booth registrations and surveys</div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition" />
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
            <div className="font-bold text-slate-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Strict Interface Separation Active</span>
            </div>
            <p>
              The Party Application runs separately on port <strong>3000</strong> for field incharges. All administrative overrides, party generation, and approval queues are isolated to this panel on port <strong>3001</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
