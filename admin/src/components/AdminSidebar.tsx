import React from 'react';
import {
  LayoutDashboard,
  Layers,
  Database,
  UserCheck,
  ClipboardCheck,
  Settings,
  ExternalLink,
  Shield,
  LogOut,
  Radio,
  ChevronRight,
  Server,
} from 'lucide-react';
import { AdminUser } from '../types';

interface AdminSidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  adminUser: AdminUser | null;
  onLogout: () => void;
  pendingApprovalsCount?: number;
}

export default function AdminSidebar({
  activeTab,
  onSelectTab,
  adminUser,
  onLogout,
  pendingApprovalsCount = 4,
}: AdminSidebarProps) {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Executive Command',
      icon: LayoutDashboard,
      badge: null,
      description: 'Global analytics & telemetry',
    },
    {
      id: 'applications',
      label: 'Party Applications',
      icon: Layers,
      badge: null,
      description: 'Tenants & hierarchy configuration',
    },
    {
      id: 'data',
      label: 'Data Ingestion & GIS',
      icon: Database,
      badge: null,
      description: 'Voter rolls & boundaries',
    },
    {
      id: 'incharges',
      label: 'Incharge Deployment',
      icon: UserCheck,
      badge: null,
      description: 'Lifecycle, transfer & replace',
    },
    {
      id: 'approvals',
      label: 'Approval Engine',
      icon: ClipboardCheck,
      badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount}` : null,
      badgeColor: 'bg-amber-500 text-slate-950',
      description: 'Voter & cadre verification',
    },
    {
      id: 'settings',
      label: 'Platform Governance',
      icon: Settings,
      badge: null,
      description: 'Security & system controls',
    },
  ];

  return (
    <aside className="w-72 bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between h-screen sticky top-0 select-none z-30 shrink-0">
      {/* Top Brand & Telemetry Header */}
      <div>
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <Shield className="w-5 h-5 text-slate-950 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-white tracking-wider uppercase">
                  CMS CONSOLE
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  APEX
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Platform Administration</p>
            </div>
          </div>
        </div>

        {/* Database Health Pill */}
        <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2 text-slate-300">
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold">Postgres DB</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Port 5432</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 text-amber-400 border border-amber-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-xs font-bold">{item.label}</div>
                    <div className="text-[10px] text-slate-500">{item.description}</div>
                  </div>
                </div>

                {item.badge ? (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                ) : (
                  isActive && <ChevronRight className="w-4 h-4 text-amber-400" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Area: External Party App Link & Admin User Status */}
      <div className="p-4 border-t border-slate-800/80 space-y-3 bg-slate-950/60">
        {/* Launch Party App Button */}
        <a
          href="http://localhost:3000"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-bold transition group"
        >
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Party Incharge App</span>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 transition" />
        </a>

        {/* User Card */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center font-bold text-xs">
              {adminUser?.name?.charAt(0) || 'A'}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-slate-200 truncate">
                {adminUser?.name || 'Party Super Admin'}
              </div>
              <div className="text-[10px] text-amber-400 font-semibold truncate">
                {adminUser?.role || 'ORGANISER / ADMIN'}
              </div>
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Sign out of Admin Panel"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
