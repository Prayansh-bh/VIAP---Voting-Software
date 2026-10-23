import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building,
  Crown,
  Layers,
  Home,
  Vote,
  Users,
  Sparkles,
  ChevronDown,
  LogOut,
  Shield,
  Radio,
  Check,
  LayoutGrid,
  Settings,
  Database,
  UserCheck,
  Smartphone,
} from 'lucide-react';
import { RoleType, UserSession } from '../types';
import { useCms } from '../context/CmsContext';
import ChangeMobileModal from './ChangeMobileModal';
import { getAdminUrl } from '../lib/env';

interface RoleQuickSwitcherProps {
  currentRole?: RoleType;
  currentPath: string;
  onLogout: () => void;
  onSwitchRole?: (role: RoleType) => void;
  session?: UserSession | null;
  onMobileChanged?: (newMobile: string, user?: any) => void;
}

interface SwitcherItem {
  role: RoleType | 'ROLES';
  levelKey?: string;
  category: 'apex' | 'field' | 'system';
  label: string;
  shortLabel: string;
  subtitle: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  isExternal?: boolean;
}

const SWITCHER_ITEMS: SwitcherItem[] = [
  // System & Management
  { role: 'ROLES', category: 'system', label: 'CMS & Platform Admin (Port 3001)', shortLabel: 'Admin Panel', subtitle: 'Dedicated CMS Console', path: getAdminUrl(), icon: Settings, color: '#f59e0b', isExternal: true },

  // Apex Command
  { role: 'STATE_ADMIN', levelKey: 'STATE', category: 'apex', label: 'State Incharge (Apex)', shortLabel: 'State', subtitle: 'Statewide War Room', path: '/state', icon: Building, color: '#f59e0b' },
  { role: 'ZONE_INCHARGE', levelKey: 'ZONE', category: 'apex', label: 'Zone Coordinator', shortLabel: 'Zone', subtitle: 'Multi-Parliament Command', path: '/zone', icon: Building, color: '#8b5cf6' },
  { role: 'PARLIAMENT_INCHARGE', levelKey: 'PARLIAMENT', category: 'apex', label: 'Parliament Incharge (MP)', shortLabel: 'Parliament', subtitle: 'Parliamentary Constituency', path: '/parliament', icon: Crown, color: '#3b82f6' },
  { role: 'CONSTITUENCY_INCHARGE', levelKey: 'DISTRICT', category: 'apex', label: 'District Incharge', shortLabel: 'District', subtitle: 'District Level DCC Command', path: '/constituency', icon: Building, color: '#a855f7' },

  // Field Command
  { role: 'CONSTITUENCY_INCHARGE', levelKey: 'CONSTITUENCY', category: 'field', label: 'Constituency Incharge (MLA)', shortLabel: 'Constituency', subtitle: 'Assembly Command Center', path: '/constituency', icon: Crown, color: '#06b6d4' },
  { role: 'MANDAL_INCHARGE', levelKey: 'MANDAL', category: 'field', label: 'Mandal President', shortLabel: 'Mandal', subtitle: 'Mandal Level Operations', path: '/mandal', icon: Layers, color: '#10b981' },
  { role: 'VILLAGE_INCHARGE', levelKey: 'VILLAGE', category: 'field', label: 'Village Incharge', shortLabel: 'Village', subtitle: 'Village Polling Command', path: '/village', icon: Home, color: '#84cc16' },
  { role: 'BOOTH_PRESIDENT', levelKey: 'BOOTH', category: 'field', label: 'Booth President', shortLabel: 'Booth', subtitle: 'Polling Station Defense', path: '/booth', icon: Vote, color: '#eab308' },
  { role: 'VOTER_100_INCHARGE', levelKey: 'VOTER_GROUP', category: 'field', label: '100-Voter Incharge', shortLabel: '100-Voter', subtitle: 'Micro-Cluster Outreach', path: '/100-voter', icon: Users, color: '#f97316' },
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

const roleLevelMap: Record<string, string> = {
  STATE_ADMIN: 'STATE',
  ZONE_INCHARGE: 'ZONE',
  PARLIAMENT_INCHARGE: 'PARLIAMENT',
  CONSTITUENCY_INCHARGE: 'CONSTITUENCY',
  MANDAL_INCHARGE: 'MANDAL',
  VILLAGE_INCHARGE: 'VILLAGE',
  BOOTH_PRESIDENT: 'BOOTH',
  VOTER_100_INCHARGE: 'VOTER_GROUP',
};

export default function RoleQuickSwitcher({
  currentRole,
  currentPath,
  onLogout,
  onSwitchRole,
  session,
  onMobileChanged,
}: RoleQuickSwitcherProps) {
  const { config } = useCms();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or ESC key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  const enabledLevels = useMemo(() => {
    if (Array.isArray(config.activeHierarchyLevels) && config.activeHierarchyLevels.length > 0) {
      return config.activeHierarchyLevels;
    }
    try {
      const saved = localStorage.getItem('kdp_cms_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.activeHierarchyLevels) && parsed.activeHierarchyLevels.length > 0) {
          return parsed.activeHierarchyLevels;
        }
      }
    } catch { }
    return ['STATE', 'ZONE', 'PARLIAMENT', 'DISTRICT', 'CONSTITUENCY', 'MANDAL', 'VILLAGE', 'BOOTH', 'VOTER_GROUP'];
  }, [config.activeHierarchyLevels]);

  const userRank = useMemo(() => {
    return session?.role ? (ROLE_RANK_WEIGHT[session.role] || 1) : 1;
  }, [session?.role]);

  const visibleItems = useMemo(() => {
    return SWITCHER_ITEMS.filter((item) => {
      // If external Admin Panel, only show to SUPER_ADMIN or STATE_ADMIN
      if (item.isExternal) {
        return session?.role === 'SUPER_ADMIN' || session?.role === 'STATE_ADMIN';
      }

      // Prevent role escalation: hide tiers above user rank
      if (session?.role !== 'SUPER_ADMIN') {
        const itemRank = ROLE_RANK_WEIGHT[item.role] || 1;
        if (itemRank > userRank) {
          return false;
        }
      }

      const level = item.levelKey || roleLevelMap[item.role];
      if (!level) return true;
      return enabledLevels.includes(level);
    });
  }, [enabledLevels, session?.role, userRank]);

  const handleSelect = (item: SwitcherItem) => {
    setIsDropdownOpen(false);
    if (item.isExternal) {
      window.location.href = getAdminUrl();
      return;
    }
    if (item.path) {
      if (item.role !== 'ROLES' && onSwitchRole) {
        onSwitchRole(item.role as RoleType);
      } else {
        navigate(item.path);
      }
    }
  };

  const activeItem = useMemo(() => {
    return (
      visibleItems.find((i) => {
        if (currentPath === i.path) return true;
        return i.role === currentRole;
      }) ||
      visibleItems[0] ||
      SWITCHER_ITEMS[0]
    );
  }, [visibleItems, currentPath, currentRole]);

  const ActiveIcon = activeItem.icon;

  const partyName = config.organisationName || config.headerTitle || 'Political Connect';

  return (
    <header
      id="role-quick-switcher"
      className="fixed top-0 left-0 right-0 h-14 z-50 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800 text-slate-100 select-none shadow-md"
    >
      <div className="h-full px-2.5 sm:px-4 md:px-6 flex items-center justify-between gap-1.5 sm:gap-3 max-w-full">
        {/* ========================================================
            LEFT: Brand Crest & Telemetry Status
           ======================================================== */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20 shrink-0">
              <Shield className="w-4 h-4 text-slate-950 fill-slate-950" />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white tracking-tight uppercase truncate max-w-[140px] md:max-w-none">
                  {partyName}
                </span>
                <span className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-semibold tracking-wide">
                Unified Political Command
              </p>
            </div>
          </div>
        </div>

        {/* ========================================================
            CENTER: Station Command Switcher (Executive Popover)
           ======================================================== */}
        <div className="relative flex items-center gap-1.5 sm:gap-2 min-w-0" ref={dropdownRef}>
          {/* Main Station Switcher Button */}
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border transition-all cursor-pointer shadow-xs min-w-0 ${isDropdownOpen
                ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold shadow-md shadow-amber-400/20'
                : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600'
              }`}
            title="Click to switch between command stations & modules"
          >
            <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${isDropdownOpen ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-amber-400'}`}>
              <ActiveIcon className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold truncate max-w-[90px] xs:max-w-[130px] sm:max-w-[200px]">
              {activeItem.label}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-slate-950' : 'text-slate-400'}`} />
          </button>

          {/* Quick Direct Jump Pills (Gracefully hidden on small screens, NO scrollbar) */}
          <div className="hidden lg:flex items-center gap-1.5">
            {currentPath !== '/platform-admin' ? (
              <button
                onClick={() => { navigate('/platform-admin'); }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition border cursor-pointer bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800"
              >
                Platform Admin
              </button>
            ) : (
              <button
                onClick={() => { navigate('/assign-data'); }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition border cursor-pointer bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800"
              >
                Assign Data
              </button>
            )}
          </div>

          {/* Mobile Backdrop when Dropdown is open */}
          {isDropdownOpen && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 sm:hidden"
              onClick={() => setIsDropdownOpen(false)}
            />
          )}

          {/* ========================================================
              POP-OVER EXECUTIVE COMMAND PALETTE
             ======================================================== */}
          {isDropdownOpen && (
            <div className="fixed inset-x-2 top-14 mt-1.5 sm:absolute sm:inset-x-auto sm:top-full sm:mt-2 sm:left-1/2 sm:-translate-x-1/2 w-auto sm:w-96 max-h-[85vh] sm:max-h-[80vh] overflow-y-auto bg-slate-900/98 backdrop-blur-2xl border border-slate-700/80 rounded-2xl shadow-2xl z-50 p-3 space-y-3 animate-fade-in no-scrollbar">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 px-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Select Command Station
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {visibleItems.length} Available
                </span>
              </div>

              {/* Tier 1: Apex Leadership */}
              <div className="space-y-1">
                <p className="text-[9px] font-extrabold uppercase tracking-widest text-amber-400/80 px-2">
                  Apex & Regional Command
                </p>
                {visibleItems
                  .filter((i) => i.category === 'apex')
                  .map((item) => {
                    const Icon = item.icon;
                    const isCurrent = item.path === currentPath || item.role === currentRole;
                    return (
                      <button
                        key={item.label}
                        onClick={() => handleSelect(item)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition cursor-pointer ${isCurrent
                            ? 'bg-amber-400/15 text-white border border-amber-400/40 font-bold'
                            : 'hover:bg-slate-800/80 text-slate-300 hover:text-white border border-transparent'
                          }`}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${item.color}20`, color: item.color }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold truncate flex items-center justify-between">
                            <span>{item.label}</span>
                            {isCurrent && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">{item.subtitle}</div>
                        </div>
                      </button>
                    );
                  })}
              </div>

              {/* Tier 2: Field Hierarchy */}
              <div className="space-y-1 pt-2 border-t border-slate-800/80">
                <p className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-400/80 px-2">
                  Field & Polling Stations
                </p>
                {visibleItems
                  .filter((i) => i.category === 'field')
                  .map((item) => {
                    const Icon = item.icon;
                    const isCurrent = item.path === currentPath || item.role === currentRole;
                    return (
                      <button
                        key={item.label}
                        onClick={() => handleSelect(item)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition cursor-pointer ${isCurrent
                            ? 'bg-amber-400/15 text-white border border-amber-400/40 font-bold'
                            : 'hover:bg-slate-800/80 text-slate-300 hover:text-white border border-transparent'
                          }`}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${item.color}20`, color: item.color }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold truncate flex items-center justify-between">
                            <span>{item.label}</span>
                            {isCurrent && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">{item.subtitle}</div>
                        </div>
                      </button>
                    );
                  })}
              </div>

              {/* Tier 3: Management Operations */}
              <div className="space-y-1 pt-2 border-t border-slate-800/80">
                <p className="text-[9px] font-extrabold uppercase tracking-widest text-sky-400/80 px-2">
                  Operations & Setup
                </p>
                {visibleItems
                  .filter((i) => i.category === 'system')
                  .map((item) => {
                    const Icon = item.icon;
                    const isCurrent = item.path === currentPath;
                    return (
                      <button
                        key={item.label}
                        onClick={() => handleSelect(item)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition cursor-pointer ${isCurrent
                            ? 'bg-amber-400/15 text-white border border-amber-400/40 font-bold'
                            : 'hover:bg-slate-800/80 text-slate-300 hover:text-white border border-transparent'
                          }`}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${item.color}20`, color: item.color }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold truncate flex items-center justify-between">
                            <span>{item.label}</span>
                            {isCurrent && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">{item.subtitle}</div>
                        </div>
                      </button>
                    );
                  })}
              </div>

              {/* Tier 4: Account & Session Controls (Always accessible on Mobile) */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <div className="px-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-200 truncate max-w-[170px]">
                    {session?.userName || 'Connected Operator'}
                  </span>
                  {session?.mobileNumber && (
                    <span className="font-mono text-amber-400 font-bold text-[10px]">
                      +91 {session.mobileNumber}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  {session?.mobileNumber && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setIsMobileModalOpen(true);
                      }}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                      <span>Change Phone</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onLogout();
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition cursor-pointer shadow-md ${
                      !session?.mobileNumber ? 'col-span-2' : 'col-span-1'
                    }`}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================
            RIGHT: Active Hierarchy Pill & Exit Portal
           ======================================================== */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
            <Radio className="w-3 h-3 text-amber-400" />
            <span>Hierarchy:</span>
            <span className="font-mono text-amber-400 font-bold">{enabledLevels.length} Tiers</span>
          </div>

          {session?.mobileNumber && (
            <button
              onClick={() => setIsMobileModalOpen(true)}
              className="flex items-center gap-1 sm:gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-amber-500/15 text-slate-300 hover:text-amber-300 border border-slate-800 hover:border-amber-500/30 text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95 touch-manipulation"
              title="Change Registered Mobile Number"
              aria-label="Change Mobile Number"
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-mono text-[11px] hidden sm:inline">+91 {session.mobileNumber}</span>
              <span className="text-[10px] text-amber-400 font-bold ml-0.5 px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/20 hidden sm:inline">Change</span>
            </button>
          )}

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900/80 text-rose-300 hover:text-white border border-rose-800/60 hover:border-rose-600 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 touch-manipulation shrink-0"
            title="Log out or switch account"
            aria-label="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="text-[11px] sm:text-xs">Sign Out</span>
          </button>
        </div>
      </div>

      <ChangeMobileModal
        isOpen={isMobileModalOpen}
        onClose={() => setIsMobileModalOpen(false)}
        currentMobile={session?.mobileNumber || ''}
        onMobileChanged={(newMobile, user) => {
          onMobileChanged?.(newMobile, user);
          setIsMobileModalOpen(false);
        }}
      />
    </header>
  );
}
