'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState, Suspense, lazy } from 'react';
import Header from './components/Header';
import RoleSelection from './components/RoleSelection';
import Footer from './components/Footer';
import RoleQuickSwitcher from './components/RoleQuickSwitcher';
import AdminPanelHandoff from './components/AdminPanelHandoff';
import LandingPage from './components/landing/LandingPage';
import { CommandRole, RoleType, UserSession } from './types';

// ── Lazy-loaded heavy dashboards and modals (Zero initial bundle lag) ──
const OtpLoginModal = lazy(() => import('./components/OtpLoginModal'));
const Voter100Dashboard = lazy(() => import('./components/Voter100Dashboard'));
const BoothInchargeDashboard = lazy(() => import('./components/BoothInchargeDashboard'));
const VillageInchargeDashboard = lazy(() => import('./components/VillageInchargeDashboard'));
const MandalInchargeDashboard = lazy(() => import('./components/MandalInchargeDashboard'));
const ConstituencyInchargeDashboard = lazy(() => import('./components/ConstituencyInchargeDashboard'));
const SuperAdminDashboard = lazy(() => import('./components/SuperAdminDashboard'));
const StateDashboard = lazy(() => import('./components/StateDashboard'));
const ZoneParliamentDashboard = lazy(() => import('./components/ZoneParliamentDashboard'));
const DashboardPlaceholders = lazy(() => import('./components/DashboardPlaceholders'));
import {
  clearAuthToken,
  getAuthToken,
  setAuthToken,
  getOrCreateDeviceId,
  getDeviceToken,
  clearDeviceToken,
} from './lib/authStorage';
import { authenticateDeviceSession } from './lib/api';
import { useCms } from './context/CmsContext';

const ROUTE_BY_ROLE: Record<RoleType, string> = {
  SUPER_ADMIN: '/super-admin',
  STATE_ADMIN: '/state',
  ZONE_INCHARGE: '/zone',
  PARLIAMENT_INCHARGE: '/parliament',
  CONSTITUENCY_INCHARGE: '/constituency',
  MANDAL_INCHARGE: '/mandal',
  VILLAGE_INCHARGE: '/village',
  BOOTH_PRESIDENT: '/booth',
  VOTER_100_INCHARGE: '/100-voter',
  POLLING_AGENT: '/booth',
  VIEWER: '/constituency',
};

export default function App({ initialPath }: { initialPath?: string } = {}) {
  const { config, reloadConfig } = useCms();
  const [isPartyCreated, setIsPartyCreated] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('kdp_party_created') === 'true';
  });

  const [activeSession, setActiveSession] = useState<UserSession | null>(() => {
    if (typeof window === 'undefined') return null;
    const token = getAuthToken();
    const saved = localStorage.getItem('kdp_active_session');
    if (!saved || !token) {
      return null;
    }

    try {
      return JSON.parse(saved) as UserSession;
    } catch {
      return null;
    }
  });

  const [selectedRole, setSelectedRole] = useState<CommandRole | null>(null);
  const [currentPath, setCurrentPath] = useState(() => {
    if (initialPath) return initialPath;
    if (typeof window === 'undefined') return '/';
    const hash = window.location.hash.replace('#', '');
    if (hash && hash !== '/') return hash;
    const pathname = window.location.pathname;
    if (pathname && pathname !== '/') return pathname;
    return '/';
  });

  // Dev helper: allows resetting party setup from developer console if ever needed
  useEffect(() => {
    (window as any).__resetPartySetup = () => {
      localStorage.removeItem('kdp_party_created');
      localStorage.removeItem('kdp_cms_config');
      localStorage.removeItem('kdp_custom_parties');
      window.location.hash = '/';
      window.location.reload();
    };
  }, []);

  useEffect(() => {
    const handleLocationChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && hash !== '/') {
        setCurrentPath(hash);
      } else {
        const pathname = window.location.pathname;
        setCurrentPath(pathname || '/');
      }
    };

    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  // When party is already created, only lock out first-time wizard setup route
  useEffect(() => {
    const isSuperAdmin = activeSession?.role === 'SUPER_ADMIN';
    if (isPartyCreated && !isSuperAdmin && currentPath === '/setup/party') {
      window.location.hash = '/app';
    }
  }, [isPartyCreated, currentPath, activeSession]);

  // Validate & re-hydrate user session from backend on mount (including Zomato/Uber style device auto-login)
  useEffect(() => {
    let isMounted = true;
    async function checkCurrentSession() {
      // 1. Try restoring via existing auth cookie / access token
      try {
        const user = await import('./lib/api').then((m) => m.fetchCurrentUser());
        if (isMounted && user) {
          const assignment = user.hierarchyAssignment;
          const restoredSession: UserSession = {
            userName: user.name || user.userCode || 'In-Charge',
            mobileNumber: user.mobileNumber || '',
            role: user.role,
            unitId: user.unitId || assignment?.unitId || '',
            assignedConstituency: assignment?.constituency?.name || 'Nalgonda',
            assignedMandal: assignment?.mandal?.name || user.unitName,
            assignedVillage: assignment?.village?.name,
            assignedBooth: assignment?.booth?.boothNumber || assignment?.booth?.name,
            assignedVoterGroup: assignment?.voterGroup?.name,
            userId: user.id,
            accountStatus: user.accountStatus === 'ACTIVE' ? 'Active' : 'Pending',
          };
          setActiveSession(restoredSession);
          localStorage.setItem('kdp_active_session', JSON.stringify(restoredSession));
          return;
        }
      } catch {
        // Access token invalid or expired, check device session
      }

      // 2. Persistent Device Authorization (Zero OTP prompts on authorized devices)
      const deviceId = getOrCreateDeviceId();
      const deviceToken = getDeviceToken();
      const isExplicitlyLoggedOut = localStorage.getItem('kdp_logged_out') === 'true';

      if (deviceId && deviceToken && !isExplicitlyLoggedOut) {
        try {
          const result = await authenticateDeviceSession(deviceId, deviceToken);
          if (isMounted && result?.session) {
            setAuthToken(result.token);
            setActiveSession(result.session);
            localStorage.setItem('kdp_active_session', JSON.stringify(result.session));
            return;
          }
        } catch (deviceErr: any) {
          // Device revoked or unauthorized by admin: force fresh OTP verification
          clearDeviceToken();
          clearAuthToken();
          if (isMounted) {
            setActiveSession(null);
            localStorage.removeItem('kdp_active_session');
          }
        }
      } else {
        if (isMounted && !localStorage.getItem('kdp_active_session')) {
          setActiveSession(null);
        }
      }
    }

    checkCurrentSession();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (activeSession) {
      localStorage.setItem('kdp_active_session', JSON.stringify(activeSession));
      localStorage.removeItem('kdp_logged_out');
      return;
    }

    localStorage.removeItem('kdp_active_session');
  }, [activeSession]);

  const roleLevelMap: Partial<Record<RoleType, string>> = {
    STATE_ADMIN: 'STATE',
    ZONE_INCHARGE: 'ZONE',
    PARLIAMENT_INCHARGE: 'PARLIAMENT',
    CONSTITUENCY_INCHARGE: 'CONSTITUENCY',
    MANDAL_INCHARGE: 'MANDAL',
    VILLAGE_INCHARGE: 'VILLAGE',
    BOOTH_PRESIDENT: 'BOOTH',
    VOTER_100_INCHARGE: 'VOTER_GROUP',
  };

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

  const currentRouteRole = useMemo<RoleType | null>(() => {
    if (currentPath.startsWith('/super-admin')) return 'SUPER_ADMIN';
    if (currentPath.startsWith('/state')) return 'STATE_ADMIN';
    if (currentPath.startsWith('/zone')) return 'ZONE_INCHARGE';
    if (currentPath.startsWith('/parliament')) return 'PARLIAMENT_INCHARGE';
    if (currentPath.startsWith('/constituency')) return 'CONSTITUENCY_INCHARGE';
    if (currentPath.startsWith('/mandal')) return 'MANDAL_INCHARGE';
    if (currentPath.startsWith('/village')) return 'VILLAGE_INCHARGE';
    if (currentPath.startsWith('/booth')) return 'BOOTH_PRESIDENT';
    if (currentPath.startsWith('/100-voter')) return 'VOTER_100_INCHARGE';
    return null;
  }, [currentPath]);

  // Enforce session check & dynamic hierarchy level availability on protected role routes:
  useEffect(() => {
    if (currentRouteRole) {
      if (!activeSession) {
        window.location.hash = '/roles';
        return;
      }

      const routeLevel = roleLevelMap[currentRouteRole];
      const isLevelAllowed = !routeLevel || enabledLevels.includes(routeLevel);

      // If the hierarchy tier is restricted for this party application, redirect away
      if (!isLevelAllowed) {
        window.location.hash = ROUTE_BY_ROLE[activeSession.role] || '/roles';
        return;
      }

      // If accessing an allotted tier, align the activeSession role if different
      if (activeSession.role !== currentRouteRole) {
        const updatedSession: UserSession = {
          ...activeSession,
          role: currentRouteRole,
        };
        setActiveSession(updatedSession);
        localStorage.setItem('kdp_active_session', JSON.stringify(updatedSession));
      }
    }
  }, [currentRouteRole, activeSession, enabledLevels]);

  const isLandingRoute = currentPath === '/' || currentPath === '' || currentPath === '/landing';
  const isRolesRoute = currentPath === '/app' || currentPath === '/app/' || currentPath === '/roles';
  const isCmsRoute =
    currentPath === '/cms' ||
    currentPath === '/admin' ||
    currentPath === '/platform-admin' ||
    currentPath === '/assign-data' ||
    currentPath === '/assign-incharges' ||
    currentPath === '/approvals';
  const isDashboardActive = Boolean(activeSession) && !isCmsRoute && !isLandingRoute && !isRolesRoute;

  const handleResetParty = () => {
    localStorage.removeItem('kdp_party_created');
    localStorage.removeItem('kdp_active_session');
    clearAuthToken();
    setIsPartyCreated(false);
    setActiveSession(null);
    window.location.hash = '/';
  };

  useEffect(() => {
    if (isDashboardActive) {
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100vh';
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.height = '100vh';
    } else {
      document.body.style.overflow = '';
      document.body.style.height = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.height = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
    };
  }, [isDashboardActive]);

  const handleSelectRole = (role: CommandRole) => {
    setSelectedRole(role);
  };

  const handleLoginSuccess = async (session: UserSession, token: string) => {
    setAuthToken(token);
    setActiveSession(session);
    localStorage.setItem('kdp_active_session', JSON.stringify(session));
    localStorage.removeItem('kdp_logged_out');
    setSelectedRole(null);

    // Dynamically switch CMS configuration to the authenticated user's organization
    const orgId = session.organisationId || (session as any).organisation?.id;
    const tenantCode = (session as any).organisation?.code;
    try {
      await reloadConfig({ organisationId: orgId, tenantCode });
    } catch (e) {
      console.warn('Tenant config reload error:', e);
    }

    const targetRoute = ROUTE_BY_ROLE[session.role] || '/roles';
    setCurrentPath(targetRoute);
    window.location.hash = targetRoute;
  };

  const handleLogout = async () => {
    try {
      const { logoutApi } = await import('./lib/api');
      await logoutApi();
    } catch {
      // ignore network errors on logout
    }
    clearAuthToken();
    clearDeviceToken();
    localStorage.setItem('kdp_logged_out', 'true');
    localStorage.removeItem('kdp_active_session');
    setActiveSession(null);

    try {
      await reloadConfig();
    } catch (e) {
      console.warn('Default config reload error:', e);
    }

    window.location.hash = '/roles';
  };

  const renderRoleSelection = () => (
    <RoleSelection
      onSelectRole={handleSelectRole}
      onLock={() => {}}
      onChangePasscode={() => {}}
      isPanelLocked={false}
    />
  );

  const renderAuthenticatedView = () => {
    if (!activeSession) {
      return renderRoleSelection();
    }

    const component = (() => {
      switch (activeSession.role) {
        case 'SUPER_ADMIN':
          return <SuperAdminDashboard session={activeSession} onLogout={handleLogout} />;
        case 'STATE_ADMIN':
          return <StateDashboard session={activeSession} onLogout={handleLogout} />;
        case 'ZONE_INCHARGE':
        case 'PARLIAMENT_INCHARGE':
          return <ZoneParliamentDashboard session={activeSession} onLogout={handleLogout} />;
        case 'CONSTITUENCY_INCHARGE':
        case 'VIEWER':
          return <ConstituencyInchargeDashboard session={activeSession} onLogout={handleLogout} />;
        case 'MANDAL_INCHARGE':
          return <MandalInchargeDashboard session={activeSession} onLogout={handleLogout} />;
        case 'VILLAGE_INCHARGE':
          return <VillageInchargeDashboard session={activeSession} onLogout={handleLogout} />;
        case 'BOOTH_PRESIDENT':
        case 'POLLING_AGENT':
          return <BoothInchargeDashboard session={activeSession} onLogout={handleLogout} />;
        case 'VOTER_100_INCHARGE':
          return <Voter100Dashboard session={activeSession} onLogout={handleLogout} />;
        default:
          return <DashboardPlaceholders session={activeSession} onLogout={handleLogout} />;
      }
    })();

    return (
      <Suspense
        fallback={
          <div className="h-full min-h-[50vh] w-full flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-3 border-amber-400 border-t-transparent animate-spin" />
            <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">
              Loading Command Station...
            </span>
          </div>
        }
      >
        {component}
      </Suspense>
    );
  };

  const renderView = () => {
    // 1. Landing Page (Default initial view)
    if (isLandingRoute) {
      return (
        <LandingPage
          isPartyCreated={isPartyCreated}
          onResetParty={handleResetParty}
          onEnterApp={() => {
            window.location.hash = '/roles';
          }}
          onOpenLogin={() => {
            window.location.hash = '/roles';
          }}
          onGetStarted={() => {
            window.location.hash = '/roles';
          }}
        />
      );
    }

    // 2. Dedicated Platform Admin Panel Hand-off
    if (isCmsRoute) {
      return (
        <AdminPanelHandoff
          onReturnToPartyApp={() => {
            window.location.hash = '/roles';
          }}
        />
      );
    }

    // 4. Role Selection Route: Direct universal gateway to login & role command selection
    if (isRolesRoute || !activeSession) {
      return renderRoleSelection();
    }

    return renderAuthenticatedView();
  };

  const showTopSwitcher = Boolean(activeSession) && !isLandingRoute && !isRolesRoute && currentPath !== '/cms';

  return (
    <div className={`${isDashboardActive ? 'h-screen overflow-hidden' : 'min-h-screen'} bg-gray-50 text-gray-900 flex flex-col justify-between selection:bg-yellow-200`}>
      {/* Top Quick Switcher Navigator: hidden on landing, cms, and roles selection page */}
      {showTopSwitcher && (
        <RoleQuickSwitcher
          currentRole={activeSession?.role}
          currentPath={currentPath}
          onLogout={handleLogout}
          onSwitchRole={(newRole) => {
            if (activeSession) {
              const updatedSession = { ...activeSession, role: newRole };
              setActiveSession(updatedSession);
              localStorage.setItem('kdp_active_session', JSON.stringify(updatedSession));
            }
          }}
        />
      )}

      <div className={`${isDashboardActive ? 'h-full overflow-hidden' : 'flex-1'} ${showTopSwitcher ? 'pt-14' : ''} flex flex-col`}>
        {!activeSession && !isLandingRoute && !isRolesRoute && currentPath !== '/cms' && <Header />}

        <div className={`flex-1 ${isDashboardActive ? 'p-0 overflow-hidden' : (isLandingRoute || isRolesRoute) ? 'p-0' : 'pb-4 md:pb-6'}`}>
          {renderView()}
        </div>
      </div>

      {!isDashboardActive && !isLandingRoute && !isRolesRoute && currentPath !== '/cms' && <Footer />}

      {selectedRole && (
        <Suspense fallback={null}>
          <OtpLoginModal
            role={selectedRole}
            onClose={() => setSelectedRole(null)}
            onSuccess={handleLoginSuccess}
          />
        </Suspense>
      )}
    </div>
  );
}
