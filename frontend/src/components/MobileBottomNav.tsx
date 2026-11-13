import React, { useState } from 'react';
import {
  LayoutDashboard,
  Layers,
  MapPin,
  User,
  X,
  Check,
  LogOut,
  Smartphone,
  Shield,
  Building,
  Crown,
  Home,
  Vote,
  Users,
} from 'lucide-react';
import { RoleType, UserSession } from '../types';

interface MobileBottomNavProps {
  currentRole?: RoleType;
  currentPath: string;
  session?: UserSession | null;
  onLogout: () => void;
  onSwitchRole?: (role: RoleType) => void;
  onChangeMobileClick: () => void;
  isTierSheetOpen: boolean;
  setIsTierSheetOpen: (open: boolean) => void;
  isProfileSheetOpen: boolean;
  setIsProfileSheetOpen: (open: boolean) => void;
}

interface TierOption {
  role: RoleType;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  rank: number;
}

const TIER_OPTIONS: TierOption[] = [
  { role: 'PARTY_ADMIN', label: 'Party Administrator (HQ)', subtitle: 'State HQ Command', icon: Shield, color: '#06b6d4', rank: 85 },
  { role: 'STATE_ADMIN', label: 'State Incharge (Apex)', subtitle: 'Statewide War Room', icon: Building, color: '#6366f1', rank: 80 },
  { role: 'ZONE_INCHARGE', label: 'Zone Coordinator', subtitle: 'Zone Command', icon: Building, color: '#8b5cf6', rank: 70 },
  { role: 'PARLIAMENT_INCHARGE', label: 'Parliament Incharge (MP)', subtitle: 'Parliamentary Level', icon: Crown, color: '#3b82f6', rank: 60 },
  { role: 'CONSTITUENCY_INCHARGE', label: 'Constituency Incharge (MLA)', subtitle: 'Assembly Command', icon: Crown, color: '#06b6d4', rank: 50 },
  { role: 'MANDAL_INCHARGE', label: 'Mandal President', subtitle: 'Mandal Operations', icon: Layers, color: '#10b981', rank: 40 },
  { role: 'VILLAGE_INCHARGE', label: 'Village Incharge', subtitle: 'Village Polling Unit', icon: Home, color: '#84cc16', rank: 30 },
  { role: 'BOOTH_PRESIDENT', label: 'Booth President', subtitle: 'Polling Station Defense', icon: Vote, color: '#eab308', rank: 20 },
  { role: 'VOTER_100_INCHARGE', label: '100-Voter Incharge', subtitle: 'Cadre Cluster Outreach', icon: Users, color: '#f97316', rank: 10 },
];

const ROLE_RANK_WEIGHT: Record<string, number> = {
  SUPER_ADMIN: 100,
  HIGH_COMMAND: 90,
  PARTY_ADMIN: 85,
  STATE_ADMIN: 80,
  ZONE_INCHARGE: 70,
  PARLIAMENT_INCHARGE: 60,
  CONSTITUENCY_INCHARGE: 50,
  MANDAL_INCHARGE: 40,
  VILLAGE_INCHARGE: 30,
  BOOTH_PRESIDENT: 20,
  POLLING_AGENT: 20,
  VOTER_100_INCHARGE: 10,
  VOLUNTEER: 5,
  VIEWER: 1,
};

export default function MobileBottomNav({
  currentRole,
  currentPath,
  session,
  onLogout,
  onSwitchRole,
  onChangeMobileClick,
  isTierSheetOpen,
  setIsTierSheetOpen,
  isProfileSheetOpen,
  setIsProfileSheetOpen,
}: MobileBottomNavProps) {
  const [isHierarchySheetOpen, setIsHierarchySheetOpen] = useState(false);

  const userRank = session?.role ? (ROLE_RANK_WEIGHT[session.role] || 1) : 1;

  const allowedTiers = TIER_OPTIONS.filter((t) => {
    if (session?.role === 'SUPER_ADMIN') return true;
    return t.rank <= userRank;
  });

  const handleTierSelect = (role: RoleType) => {
    setIsTierSheetOpen(false);
    if (onSwitchRole) {
      onSwitchRole(role);
    }
  };

  return (
    <>
      {/* ========================================================= */}
      {/* FIXED BOTTOM NAVIGATION BAR */}
      {/* ========================================================= */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/90 px-3 flex items-center justify-around z-40 md:hidden pb-[env(safe-area-inset-bottom)]">
        {/* Tab 1: Dashboard */}
        <button
          onClick={() => {
            setIsTierSheetOpen(false);
            setIsProfileSheetOpen(false);
            setIsHierarchySheetOpen(false);
          }}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
            !isTierSheetOpen && !isProfileSheetOpen && !isHierarchySheetOpen
              ? 'text-cyan-400 font-black'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">Overview</span>
        </button>

        {/* Tab 2: Switch Tier */}
        <button
          onClick={() => {
            setIsTierSheetOpen(true);
            setIsProfileSheetOpen(false);
            setIsHierarchySheetOpen(false);
          }}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
            isTierSheetOpen ? 'text-cyan-400 font-black' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">Tiers</span>
        </button>

        {/* Tab 3: Unit Hierarchy */}
        <button
          onClick={() => {
            setIsHierarchySheetOpen(true);
            setIsTierSheetOpen(false);
            setIsProfileSheetOpen(false);
          }}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
            isHierarchySheetOpen ? 'text-cyan-400 font-black' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapPin className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">Hierarchy</span>
        </button>

        {/* Tab 4: Incharge Profile */}
        <button
          onClick={() => {
            setIsProfileSheetOpen(true);
            setIsTierSheetOpen(false);
            setIsHierarchySheetOpen(false);
          }}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
            isProfileSheetOpen ? 'text-cyan-400 font-black' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">Incharge</span>
        </button>
      </nav>

      {/* ========================================================= */}
      {/* BOTTOM SHEET 1: TIER SWITCHER DRAWER */}
      {/* ========================================================= */}
      {isTierSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs md:hidden animate-fade-in">
          <div
            className="w-full bg-slate-900 border-t border-slate-700/80 rounded-t-3xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle & Header */}
            <div className="p-4 border-b border-white/[0.08] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Switch Operational Tier</h3>
              </div>
              <button
                onClick={() => setIsTierSheetOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List of Allowed Tiers */}
            <div className="p-3 overflow-y-auto space-y-2">
              {allowedTiers.map((t) => {
                const Icon = t.icon;
                const isSelected = currentRole === t.role;
                return (
                  <button
                    key={t.role}
                    onClick={() => handleTierSelect(t.role)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition active:scale-[0.98] ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300 shadow-md shadow-cyan-500/10'
                        : 'bg-slate-950/60 border-white/[0.06] text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${t.color}20`, color: t.color }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{t.label}</div>
                        <div className="text-[10px] text-slate-400">{t.subtitle}</div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* BOTTOM SHEET 2: HIERARCHY JURISDICTION DRAWER */}
      {/* ========================================================= */}
      {isHierarchySheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs md:hidden animate-fade-in">
          <div
            className="w-full bg-slate-900 border-t border-slate-700/80 rounded-t-3xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Assigned Jurisdiction</h3>
              </div>
              <button
                onClick={() => setIsHierarchySheetOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Constituency:</span>
                <span className="font-bold text-white">{session?.assignedConstituency || 'Kondapi (142)'}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Mandal:</span>
                <span className="font-bold text-white">{session?.assignedMandal || 'Kondapi Mandal'}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Village:</span>
                <span className="font-bold text-white">{session?.assignedVillage || 'Rajupalem'}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Polling Booth:</span>
                <span className="font-bold text-emerald-400">Booth #{session?.assignedBooth || '142'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* BOTTOM SHEET 3: INCHARGE PROFILE DRAWER */}
      {/* ========================================================= */}
      {isProfileSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs md:hidden animate-fade-in">
          <div
            className="w-full bg-slate-900 border-t border-slate-700/80 rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-white/[0.08] pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Incharge Account</h3>
              </div>
              <button
                onClick={() => setIsProfileSheetOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#08090E] border border-white/[0.08] space-y-2">
              <div className="text-base font-bold text-white">{session?.userName || 'Field Incharge'}</div>
              <div className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                <span>+91 {session?.mobileNumber || '9876543210'}</span>
              </div>
              <div className="text-[11px] text-emerald-400 font-mono mt-1">Status: Active Authorized Cadre</div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  setIsProfileSheetOpen(false);
                  onChangeMobileClick();
                }}
                className="w-full py-3 rounded-2xl bg-slate-850 hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 border border-white/[0.08] transition"
              >
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>Update Registered Mobile Number</span>
              </button>

              <button
                onClick={() => {
                  setIsProfileSheetOpen(false);
                  onLogout();
                }}
                className="w-full py-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold flex items-center justify-center gap-2 border border-rose-500/30 transition"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>Sign Out of Command Session</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

