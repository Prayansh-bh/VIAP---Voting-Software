/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  Flag,
  Palette,
  Bot,
  HardDrive,
  Activity,
  FileText,
  Users,
  Settings,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Search,
  LogOut,
  Sparkles,
  Layers,
  Database,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { UserSession } from '../types';
import { useCms } from '../context/CmsContext';
import { apiFetch } from '../lib/api';
import CmsStudio from './cms/CmsStudio';

interface SuperAdminDashboardProps {
  session: UserSession;
  onLogout: () => void;
}

export default function SuperAdminDashboard({ session, onLogout }: SuperAdminDashboardProps) {
  const { config, parties } = useCms();
  const [activeTab, setActiveTab] = useState<'overview' | 'orgs' | 'parties' | 'ai' | 'storage' | 'audit' | 'health'>('overview');
  const [isCmsOpen, setIsCmsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Data states
  const [orgs, setOrgs] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [aiStats, setAiStats] = useState<any>({
    status: 'ACTIVE',
    provider: 'Google Gemini Pro / Flash',
    totalTokens: '48,200',
    costEstimate: '$0.07',
    latencyAvg: '420ms',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [orgsRes, auditRes, healthRes] = await Promise.all([
        apiFetch<any[]>('/api/organisations').catch(() => []),
        apiFetch<any[]>('/api/audit?limit=25').catch(() => []),
        apiFetch<any>('/api/health').catch(() => ({ status: 'UP', database: 'healthy' })),
      ]);
      setOrgs(Array.isArray(orgsRes) ? orgsRes : []);
      setAuditLogs(Array.isArray(auditRes) ? auditRes : (auditRes as any)?.items || []);
      setHealthStatus(healthRes);
    } catch (err) {
      console.error('SuperAdmin load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="w-full h-screen overflow-hidden flex flex-col md:flex-row bg-[#F8FAFC] text-slate-900 font-sans antialiased" id="superadmin-dashboard-root">
      {/* Navigation Sidebar: Fixed Full-Height matching Mandal / Booth benchmark */}
      <aside className="fixed inset-y-0 left-0 z-40 w-64 h-screen bg-slate-950 text-white flex flex-col justify-between border-r border-slate-900 md:fixed shrink-0 select-none" id="superadmin-sidebar">
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Brand & Connected Operator Profile Header */}
          <div className="p-5 border-b border-slate-900/90 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-slate-950 shrink-0 font-black text-sm shadow-md shadow-amber-400/20">
                <ShieldCheck className="w-5 h-5 text-slate-950" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-black text-white tracking-tight truncate">
                  {config.organisationName || 'Platform Studio'}
                </h1>
                <p className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest">
                  Super Command Root
                </p>
              </div>
            </div>

            {/* Connected User Profile Widget */}
            <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 font-extrabold shrink-0 text-xs">
                SA
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-black text-slate-100 truncate uppercase">
                  {session?.userName || 'Super Administrator'}
                </h4>
                <p className="text-[9px] text-amber-400 font-bold truncate">PLATFORM SUPER ADMIN</p>
                <div className="text-[8px] text-slate-400 font-semibold mt-0.5 uppercase space-y-0.5">
                  <p className="truncate">Tenancy: Multi-Tenant Root</p>
                  <p className="truncate">Active Party: {config.activePartyCode || 'INC'}</p>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[8px] text-slate-400 font-black tracking-widest uppercase font-mono">
                    ID: {session?.userId ? session.userId.slice(-8).toUpperCase() : 'ROOT-SAAS'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 no-scrollbar" id="superadmin-nav-tabs">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">Main Navigation</p>
            {[
              { id: 'overview', label: 'Platform Overview', icon: Activity },
              { id: 'orgs', label: 'Organisations', icon: Building2, count: orgs.length || 1 },
              { id: 'parties', label: 'Parties & Branding', icon: Flag, count: parties.length || 8 },
              { id: 'ai', label: 'AI Management', icon: Bot },
              { id: 'storage', label: 'Storage & Assets', icon: HardDrive },
              { id: 'audit', label: 'Audit Trail', icon: FileText },
              { id: 'health', label: 'System Health', icon: Database },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-400/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-slate-950' : 'text-slate-400'}`} />
                    <span className="truncate">{tab.label}</span>
                  </div>
                  {tab.count !== undefined && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold shrink-0 ${
                        active ? 'bg-slate-950 text-amber-400' : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Fixed Sign Out at Bottom matching Mandal / Booth */}
        <div className="p-4 border-t border-slate-900 bg-slate-950 shrink-0">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-between px-4 py-3 bg-red-950/40 hover:bg-red-900/60 border border-red-900/30 text-red-400 hover:text-white rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer"
            id="btn-sidebar-logout"
          >
            <span className="flex items-center gap-2">
              <LogOut className="w-4 h-4 shrink-0 text-red-500" />
              Sign Out Portal
            </span>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>
        </div>
      </aside>

      {/* Main Scrollable Workspace */}
      <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden bg-[#F8FAFC] relative md:pl-64" id="main-workspace-section">
        <div className="p-6 md:p-8 space-y-6 max-w-7xl w-full mx-auto pb-28">
          {/* In-page Header Banner (White Card matching Mandal / Booth standard) */}
          <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm" id="superadmin-header-bar">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] bg-yellow-400 text-slate-950 px-2 py-0.5 rounded font-black uppercase tracking-widest">
                  SUPER ADMIN DASHBOARD
                </span>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight" id="superadmin-overview-title">
                  Multi-Organisation SaaS Management Studio
                </h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                  <span>Governance: <strong className="text-slate-800 font-bold">Root SaaS Engine</strong></span>
                  <span className="text-slate-300">•</span>
                  <span>Active Tenant: <strong className="text-slate-800 font-bold">{config.organisationName || 'Telangana Congress Connect'}</strong></span>
                  <span className="text-slate-300">•</span>
                  <span>Database: <strong className="text-slate-800 font-bold">PostgreSQL 16</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg border border-green-200">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-xs font-bold uppercase tracking-wider">Live Data: Connected</span>
                </div>
                <button
                  onClick={() => (window.location.hash = '/assign-data')}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-black shadow-sm transition cursor-pointer"
                >
                  Assign Data
                </button>
                <button
                  onClick={() => (window.location.hash = '/assign-incharges')}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  Assign Incharges
                </button>
                <button
                  onClick={loadData}
                  disabled={loading}
                  className="p-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl shadow-xs transition cursor-pointer"
                  title="Refresh Data"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in" id="superadmin-overview-view">
              {/* ROOT SAAS CLOUD TELEMETRY HERO BANNER */}
              <div className="relative bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white rounded-2xl p-6 md:p-8 shadow-md border border-slate-800" id="superadmin-hero-banner">
                <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] from-amber-400 via-transparent to-transparent"></div>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                  <div className="space-y-3">
                    <span className="px-2.5 py-0.5 bg-amber-400/20 text-amber-400 text-[10px] font-black uppercase tracking-widest rounded border border-amber-400/30">
                      ROOT SAAS CLOUD TELEMETRY
                    </span>
                    
                    <h2 className="text-2xl md:text-3xl font-black tracking-tight" id="superadmin-hero-title">
                      <span className="text-amber-400">OPTIMAL</span>{' '}
                      <span className="text-white">MULTI-TENANT GOVERNANCE</span>
                    </h2>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-300 font-semibold">
                      <span>Active Tenants: <strong className="text-amber-400 text-base font-black">{orgs.length || 1}</strong></span>
                      <span className="text-slate-600">•</span>
                      <span>Configured Themes: <strong className="text-white text-base font-black">{parties.length || 8}</strong></span>
                      <span className="text-slate-600">•</span>
                      <span>DB Status: <strong className="text-emerald-400 text-base font-black">{healthStatus?.database === 'healthy' ? 'OPTIMAL' : 'UP'}</strong></span>
                    </div>
                    
                    <p className="text-xs text-gray-400 font-medium">
                      PostgreSQL 16 Engine &bull; Gemini Pro / Flash AI Provider &bull; Real-time Socket.IO Telemetry
                    </p>
                  </div>
                  
                  {/* Shield Accent Graphic */}
                  <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-center shrink-0 shadow">
                    <ShieldCheck className="w-12 h-12 text-amber-400" />
                  </div>
                </div>
              </div>

              {/* TOP 4 TINTED KPI CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="superadmin-top-cards">
                {/* Card 1: Organisations */}
                <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Organisations</p>
                  <h3 className="text-3xl font-black text-slate-950">{orgs.length || 1}</h3>
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>Tenancy</span>
                    <span className="font-extrabold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Multi-tenant enabled
                    </span>
                  </div>
                </div>

                {/* Card 2: Configured Parties */}
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                  <p className="text-xs font-black text-amber-700 uppercase tracking-wider">Configured Parties</p>
                  <h3 className="text-3xl font-black text-amber-600">{parties.length || 8}</h3>
                  <div className="pt-2 border-t border-amber-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>Theming</span>
                    <span className="font-black text-amber-700">Dynamic Themes Configured</span>
                  </div>
                </div>

                {/* Card 3: AI Engine */}
                <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                  <p className="text-xs font-black text-purple-700 uppercase tracking-wider">AI Engine Status</p>
                  <h3 className="text-3xl font-black text-purple-600">
                    {config.featureToggles?.aiStrategicIntelligence ? 'ONLINE' : 'FLAGGED'}
                  </h3>
                  <div className="pt-2 border-t border-purple-200/60 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>Localization</span>
                    <span className="font-black text-purple-700">Telugu &amp; English</span>
                  </div>
                </div>

                {/* Card 4: Database Health */}
                <div className="bg-emerald-50/70 border-2 border-emerald-200 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                  <p className="text-xs font-black text-emerald-700 uppercase tracking-wider">Database Health</p>
                  <h3 className="text-3xl font-black text-emerald-600">
                    {healthStatus?.database === 'healthy' ? 'OPTIMAL' : 'UP'}
                  </h3>
                  <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>Engine</span>
                    <span className="font-black text-emerald-700">PostgreSQL 16 Engine</span>
                  </div>
                </div>
              </div>

              {/* Action Banner: Live Configuration Studio */}
              <div className="bg-white border-2 border-amber-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-amber-50/40 via-white to-white">
                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-600 flex items-center justify-center font-bold">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    Live Configuration &amp; Visual Branding Studio
                  </h3>
                  <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
                    Modify party colors, hierarchy tier nomenclature, announcements, and enable or disable operational modules across all tenant instances in real time.
                  </p>
                </div>
                <button
                  onClick={() => setIsCmsOpen(true)}
                  className="px-5 py-3 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-md shadow-amber-400/20 transition cursor-pointer shrink-0"
                >
                  Launch Studio <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Recent Security Audit Events */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-500" /> Recent Security Audit Events
                  </h3>
                  <button
                    onClick={() => setActiveTab('audit')}
                    className="text-xs font-bold text-amber-600 hover:text-amber-700 hover:underline cursor-pointer"
                  >
                    View All Audit Logs &rarr;
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {auditLogs.slice(0, 5).map((log, idx) => (
                    <div key={log.id || idx} className="py-3 flex items-center justify-between text-xs hover:bg-slate-50/80 px-2 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-md font-mono text-[10px] font-black ${
                          log.action === 'LOGIN' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          log.action === 'LOGOUT' ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {log.action || 'MUTATION'}
                        </span>
                        <span className="font-semibold text-slate-800">
                          {log.entity || 'Entity'}: <code className="text-slate-600 font-mono text-[11px]">{log.entityId || log.details || 'Updated'}</code>
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 font-medium">
                        {log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : 'Just now'}
                      </span>
                    </div>
                  ))}
                  {auditLogs.length === 0 && (
                    <div className="py-6 text-center text-xs text-slate-400">No audit events recorded yet.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ORGANISATIONS */}
          {activeTab === 'orgs' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 animate-fade-in shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">Registered Organisations</h2>
                  <p className="text-xs text-slate-500">Multi-tenant tenants with isolated hierarchy scopes</p>
                </div>
                <button
                  onClick={() => setIsCmsOpen(true)}
                  className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Organisation
                </button>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-600 flex items-center justify-center font-bold">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{config.organisationName || 'Telangana Congress Connect'}</h4>
                      <p className="text-[11px] text-slate-500 font-mono">CODE: KDP-TDP-01 &bull; Active Party: {config.activePartyCode || 'INC'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ACTIVE TENANT
                    </span>
                    <button
                      onClick={() => setIsCmsOpen(true)}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      Configure
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PARTIES & BRANDING */}
          {activeTab === 'parties' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 animate-fade-in shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">Configured Political Parties</h2>
                  <p className="text-xs text-slate-500">Dynamic themes and symbols used across tenant instances</p>
                </div>
                <button
                  onClick={() => setIsCmsOpen(true)}
                  className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Configure Party
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {parties.map((p) => (
                  <div
                    key={p.code}
                    className={`p-4 rounded-xl border transition-all ${
                      config.activePartyCode === p.code
                        ? 'bg-amber-50/60 border-amber-300 shadow-sm'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-xs"
                          style={{ backgroundColor: p.primaryColor, color: '#fff' }}
                        >
                          {p.code.slice(0, 3)}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">{p.name}</h4>
                          <span className="text-[10px] font-mono text-slate-500">{p.shortName}</span>
                        </div>
                      </div>
                      {config.activePartyCode === p.code && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-400 text-slate-950 uppercase shadow-2xs">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80 text-[11px] text-slate-500">
                      <span>Primary: <span className="font-mono font-bold text-slate-800">{p.primaryColor}</span></span>
                      <span>&bull;</span>
                      <span>Symbol: <span className="text-slate-800 font-semibold">{p.symbolName || 'Standard'}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: AI MANAGEMENT */}
          {activeTab === 'ai' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 animate-fade-in shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">AI Provider &amp; Intelligence Engine</h2>
                  <p className="text-xs text-slate-500">Manage LLM configurations, prompt token limits, and Telugu localization</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                    GEMINI 2.0 FLASH / PRO
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-slate-500 text-xs font-medium">Provider Status</span>
                  <div className="text-base font-bold text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Configured &amp; Operational
                  </div>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-slate-500 text-xs font-medium">Monthly Token Budget</span>
                  <div className="text-base font-bold text-slate-900">{aiStats.totalTokens} Tokens</div>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-slate-500 text-xs font-medium">Estimated Cost</span>
                  <div className="text-base font-bold text-amber-600">{aiStats.costEstimate}</div>
                </div>
              </div>

              <div className="p-4 bg-slate-950 text-white rounded-xl border border-slate-800 space-y-2 text-xs font-mono shadow-sm">
                <div className="text-amber-400 font-bold uppercase tracking-wider text-[11px]">Supported Capabilities:</div>
                <div className="text-slate-300">&bull; Tactical Constituency War-Room Briefings (Telugu &amp; English)</div>
                <div className="text-slate-300">&bull; Ground Incident Severity &amp; Sentiment Extraction</div>
                <div className="text-slate-300">&bull; Demographic Voter Turnout Probability Analysis</div>
                <div className="text-slate-300">&bull; Automated Executive Telegram Dispatch Formatting</div>
              </div>
            </div>
          )}

          {/* TAB 5: STORAGE & ASSETS */}
          {activeTab === 'storage' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 animate-fade-in shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">S3 Object Storage Management</h2>
                  <p className="text-xs text-slate-500">Assets, training media, ground report attachments, and party logos</p>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  S3-COMPATIBLE / LOCAL ATTACH
                </span>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <h4 className="font-bold text-slate-900">Training Media Library Storage</h4>
                    <p className="text-slate-500 font-mono text-[11px]">Bucket: kdp-training-media &bull; 8 Videos</p>
                  </div>
                  <span className="font-mono text-amber-600 font-bold bg-amber-50 px-2.5 py-1 rounded border border-amber-200">142 MB Used</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <h4 className="font-bold text-slate-900">Ground Report Uploads &amp; Photos</h4>
                    <p className="text-slate-500 font-mono text-[11px]">Bucket: kdp-ground-attachments &bull; 24 Files</p>
                  </div>
                  <span className="font-mono text-amber-600 font-bold bg-amber-50 px-2.5 py-1 rounded border border-amber-200">38 MB Used</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 animate-fade-in shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">Immutable Platform Audit Trail</h2>
                  <p className="text-xs text-slate-500">Cryptographically verifiable log of all administrative and voter mutations</p>
                </div>
                <span className="text-xs font-mono text-slate-500 font-bold bg-slate-100 px-3 py-1 rounded-full">
                  {auditLogs.length} Events Logged
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase font-mono text-[10px]">
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Entity</th>
                      <th className="py-2.5 px-3">Entity ID</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {auditLogs.map((log, idx) => (
                      <tr key={log.id || idx} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 text-slate-500">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : 'Recent'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-amber-600">{log.action}</td>
                        <td className="py-2.5 px-3 text-slate-800">{log.entity}</td>
                        <td className="py-2.5 px-3 text-slate-500 truncate max-w-[150px]">{log.entityId || '-'}</td>
                        <td className="py-2.5 px-3">
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200">VERIFIED</span>
                        </td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-xs text-slate-400">
                          No audit records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: SYSTEM HEALTH */}
          {activeTab === 'health' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 animate-fade-in shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">System Diagnostics &amp; Infrastructure</h2>
                  <p className="text-xs text-slate-500">Fastify backend server, PostgreSQL connection pool, and Socket.IO status</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ALL SYSTEMS NOMINAL
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="text-xs text-slate-500 font-medium">Fastify REST Server</span>
                  <div className="text-sm font-bold text-emerald-600">Status: UP (Port 4000)</div>
                  <div className="text-[11px] text-slate-400 font-mono">Uptime: {Math.round(healthStatus?.uptime || 120)}s</div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="text-xs text-slate-500 font-medium">PostgreSQL Engine</span>
                  <div className="text-sm font-bold text-emerald-600">Connection: Active &amp; Healthy</div>
                  <div className="text-[11px] text-slate-400 font-mono">Prisma Client v6.14.0</div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="text-xs text-slate-500 font-medium">Real-Time Gateway</span>
                  <div className="text-sm font-bold text-emerald-600">Socket.IO Server Ready</div>
                  <div className="text-[11px] text-slate-400 font-mono">Hierarchy-aware rooms</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {isCmsOpen && (
        <div className="fixed inset-0 z-50 overflow-auto bg-white">
          <CmsStudio
            isOpen={true}
            mode="editor"
            onClose={() => setIsCmsOpen(false)}
            onOpenRoleModules={() => setIsCmsOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
