import React from 'react';
import { Shield, ChevronDown, Radio, User, Sparkles } from 'lucide-react';
import { RoleType, UserSession } from '../types';

interface MobileAppHeaderProps {
  session?: UserSession | null;
  currentRole?: RoleType;
  onOpenTierSheet: () => void;
  onOpenProfileSheet: () => void;
}

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  PARTY_ADMIN: 'Party HQ',
  HIGH_COMMAND: 'High Command',
  STATE_ADMIN: 'State Incharge',
  ZONE_INCHARGE: 'Zone Coordinator',
  PARLIAMENT_INCHARGE: 'Parliament MP',
  CONSTITUENCY_INCHARGE: 'Constituency MLA',
  MANDAL_INCHARGE: 'Mandal President',
  VILLAGE_INCHARGE: 'Village Incharge',
  BOOTH_PRESIDENT: 'Booth President',
  POLLING_AGENT: 'Polling Agent',
  VOTER_100_INCHARGE: '100-Voter Cadre',
  VIEWER: 'Observer',
};

export default function MobileAppHeader({
  session,
  currentRole,
  onOpenTierSheet,
  onOpenProfileSheet,
}: MobileAppHeaderProps) {
  const roleTitle = currentRole ? (ROLE_DISPLAY_NAMES[currentRole] || currentRole) : 'Command';
  const unitInfo = session?.assignedBooth 
    ? `Booth ${session.assignedBooth}` 
    : session?.assignedVillage 
    ? session.assignedVillage 
    : session?.assignedMandal 
    ? session.assignedMandal 
    : session?.assignedConstituency || 'Active';

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 flex items-center justify-between z-40 md:hidden">
      {/* Left: Brand + Unit Badge */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-white font-black text-xs shadow-md shadow-cyan-500/20 shrink-0">
          ✓
        </div>
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-white truncate">{unitInfo}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          </div>
          <div className="text-[10px] text-cyan-400 font-medium truncate">{roleTitle}</div>
        </div>
      </div>

      {/* Right: Quick Tier Switcher Pill + Profile Avatar */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenTierSheet}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700/80 text-[11px] font-semibold text-slate-200 active:scale-95 transition"
        >
          <span>Tiers</span>
          <ChevronDown className="w-3 h-3 text-cyan-400" />
        </button>

        <button
          onClick={onOpenProfileSheet}
          className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 active:scale-95 transition text-xs font-bold"
          title="Account Profile"
        >
          {session?.userName ? session.userName.charAt(0).toUpperCase() : <User className="w-4 h-4 text-slate-400" />}
        </button>
      </div>
    </header>
  );
}

