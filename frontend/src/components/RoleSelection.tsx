import React, { useMemo } from 'react';
import { CommandRole, RoleType } from '../types';
import RoleCard from './RoleCard';
import { useCms } from '../context/CmsContext';

interface RoleSelectionProps {
  onSelectRole: (role: CommandRole) => void;
  onLock: () => void;
  onChangePasscode: () => void;
  isPanelLocked: boolean;
}

const ROLE_TO_LEVEL: Record<string, string> = {
  STATE_ADMIN: 'STATE',
  ZONE_INCHARGE: 'ZONE',
  PARLIAMENT_INCHARGE: 'PARLIAMENT',
  CONSTITUENCY_INCHARGE: 'CONSTITUENCY',
  MANDAL_INCHARGE: 'MANDAL',
  VILLAGE_INCHARGE: 'VILLAGE',
  BOOTH_PRESIDENT: 'BOOTH',
  VOTER_100_INCHARGE: 'VOTER_GROUP',
};

export default function RoleSelection({ onSelectRole, onLock, onChangePasscode, isPanelLocked }: RoleSelectionProps) {
  const { config, t } = useCms();

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
    } catch {}
    return ['STATE', 'ZONE', 'PARLIAMENT', 'DISTRICT', 'CONSTITUENCY', 'MANDAL', 'VILLAGE', 'BOOTH', 'VOTER_GROUP'];
  }, [config.activeHierarchyLevels]);

  const activeRoles = useMemo<CommandRole[]>(() => {
    const allRoles: CommandRole[] = [
      // 1. State Incharge
      {
        id: 'STATE_ADMIN',
        name: t('STATE', 'State Incharge'),
        subtitle: `${config.stateName || 'State'} Command`,
        description: 'Statewide command & majority telemetry.',
        path: '/state',
        iconName: 'Building',
      },
      // 2. Zone Coordinator
      {
        id: 'ZONE_INCHARGE' as any,
        name: t('ZONE', 'Zone Coordinator'),
        subtitle: 'Multi-Parliament Oversight',
        description: 'Multi-Parliament zone level coordination.',
        path: '/zone',
        iconName: 'Building',
      },
      // 3. Parliament Incharge
      {
        id: 'PARLIAMENT_INCHARGE' as any,
        name: t('PARLIAMENT', 'Parliament Incharge'),
        subtitle: `${config.parliamentName || 'Lok Sabha'} MP Seat`,
        description: 'Parliament MP War Room Command.',
        path: '/parliament',
        iconName: 'Crown',
      },
      // 4. Constituency Incharge
      {
        id: 'CONSTITUENCY_INCHARGE',
        name: t('CONSTITUENCY', 'Constituency Incharge'),
        subtitle: `${config.constituencies?.[0]?.name || 'Assembly'} MLA Seat`,
        description: 'Assembly Constituency MLA operations.',
        path: '/constituency',
        iconName: 'Users',
      },
      // 5. Mandal President
      {
        id: 'MANDAL_INCHARGE',
        name: t('MANDAL', 'Mandal President'),
        subtitle: 'Mandal & Block Division',
        description: 'Mandal level cadre & booth oversight.',
        path: '/mandal/dashboard',
        iconName: 'Layers',
      },
      // 6. Village Incharge
      {
        id: 'VILLAGE_INCHARGE',
        name: t('VILLAGE', 'Village Incharge'),
        subtitle: 'Gram Panchayat & Local Ward',
        description: 'Village ward & local community unit.',
        path: '/village',
        iconName: 'Home',
      },
      // 7. Booth President
      {
        id: 'BOOTH_PRESIDENT',
        name: t('BOOTH', 'Booth President'),
        subtitle: 'Polling Booth Management',
        description: 'Polling booth command & voter turnout.',
        path: '/booth/dashboard',
        iconName: 'Vote',
      },
      // 8. 100 Voter Incharge
      {
        id: 'VOTER_100_INCHARGE',
        name: t('VOTER_GROUP', '100 Voters Incharge'),
        subtitle: 'Voter Family Cluster Committee',
        description: '100-voter cluster door-to-door outreach.',
        path: '/100-voter',
        iconName: 'Users',
      },
    ];

    // Filter strictly by enabled hierarchy tiers for this party application
    return allRoles.filter((role) => {
      const level = ROLE_TO_LEVEL[role.id];
      return !level || enabledLevels.includes(level);
    });
  }, [config, t, enabledLevels]);

  const scopeLabel = useMemo(() => {
    switch (config.appScope) {
      case 'SINGLE_MLA':
        return 'Configured for 1 MLA Candidate';
      case 'PARLIAMENT_MP':
        return `Configured for 1 MP + ${config.constituencies?.length || 7} MLA Candidates`;
      case 'ZONE':
        return 'Configured for Zone Level (~3 MPs + 21 MLAs)';
      case 'STATE':
        return `Statewide Command (${config.stateName})`;
      default:
        return 'Configured Jurisdictional Hierarchy';
    }
  }, [config]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 space-y-7 animate-fade-in" id="role-selection-section">
      {/* Current Workspace Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-xs"
            style={{ backgroundColor: config.primaryColor || '#f59e0b' }}
          >
            {(config.activePartyCode || 'APP').slice(0, 3)}
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Active Workspace: {config.organisationName || 'Kondapi Connect'}</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                LIVE
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              {scopeLabel} • {config.stateName || 'Andhra Pradesh'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-medium text-[11px] text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-800">{activeRoles.length} Active Modules</span>
          </div>
        </div>
      </div>

      {/* Title block */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-1 gap-2"
        id="role-selection-bar"
      >
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Select Command Role
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Choose your assigned command module to access role-specific intelligence, field operations, and reporting.
          </p>
        </div>
      </div>

      {/* Main card grid: Dynamically rendered according to selected hierarchy tiers */}
      {activeRoles.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <p className="text-slate-600 font-bold text-sm">
            No hierarchy levels are currently active.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5" id="roles-cards-grid">
          {activeRoles.map((role, idx) => (
            <RoleCard
              key={role.id}
              role={role}
              index={idx}
              onClick={() => onSelectRole(role)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
