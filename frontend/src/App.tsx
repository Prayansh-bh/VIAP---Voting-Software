'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import RoleSelection from './components/RoleSelection';
import OtpLoginModal from './components/OtpLoginModal';
import DashboardPlaceholders from './components/DashboardPlaceholders';
import Voter100Dashboard from './components/Voter100Dashboard';
import BoothInchargeDashboard from './components/BoothInchargeDashboard';
import VillageInchargeDashboard from './components/VillageInchargeDashboard';
import MandalInchargeDashboard from './components/MandalInchargeDashboard';
import ConstituencyInchargeDashboard from './components/ConstituencyInchargeDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import StateDashboard from './components/StateDashboard';
import ZoneParliamentDashboard from './components/ZoneParliamentDashboard';
import Footer from './components/Footer';
import CmsStudio from './components/cms/CmsStudio';
import RoleQuickSwitcher from './components/RoleQuickSwitcher';
import PlatformAdminPortal from './components/PlatformAdminPortal';
import AssignDataModule from './components/cms/AssignDataModule';
import AssignInchargesModule from './components/cms/AssignInchargesModule';
import LandingPage from './components/landing/LandingPage';
import { Sliders } from 'lucide-react';
import { CommandRole, RoleType, UserSession } from './types';
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

  // Enforce session check on protected role routes:
  // If user navigates to a role route without a valid session, redirect to login flow (/roles)
  useEffect(() => {
    if (currentRouteRole) {
      if (!activeSession) {
        window.location.hash = '/roles';
      } else if (activeSession.role !== currentRouteRole) {
        window.location.hash = ROUTE_BY_ROLE[activeSession.role] || '/roles';
      }
    }
  }, [currentRouteRole, activeSession]);

  const isLandingRoute = currentPath === '/' || currentPath === '' || currentPath === '/landing';
  const isRolesRoute = currentPath === '/app' || currentPath === '/app/' || currentPath === '/roles';
  const isCmsRoute =
    currentPath === '/cms' ||
    currentPath === '/admin' ||
    currentPath === '/platform-admin' ||
    currentPath === '/assign-data' ||
    currentPath === '/assign-incharges';
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

  const handleLoginSuccess = (session: UserSession, token: string) => {
    setAuthToken(token);
    setActiveSession(session);
    setSelectedRole(null);
    window.location.hash = ROUTE_BY_ROLE[session.role];
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
  };

  const { config } = useCms();

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
            window.location.hash = '/cms';
          }}
        />
      );
    }

    // 2. CMS Platform Admin & Assignment routes
    if (currentPath === '/platform-admin' || currentPath === '/admin') {
      return <PlatformAdminPortal />;
    }

    if (currentPath === '/assign-data') {
      return (
        <AssignDataModule
          onNavigateToIncharges={() => {
            window.location.hash = '/assign-incharges';
          }}
          onClose={() => {
            window.location.hash = '/platform-admin';
          }}
        />
      );
    }

    if (currentPath === '/assign-incharges') {
      return (
        <AssignInchargesModule
          onNavigateToData={() => {
            window.location.hash = '/assign-data';
          }}
          onClose={() => {
            window.location.hash = '/platform-admin';
          }}
        />
      );
    }

    // 3. CMS Studio
    if (currentPath === '/cms') {
      return (
        <CmsStudio
          isOpen={true}
          mode={isPartyCreated ? 'editor' : 'setup'}
          onClose={() => {
            window.location.hash = '/roles';
          }}
          onOpenRoleModules={() => {
            setIsPartyCreated(true);
            localStorage.setItem('kdp_party_created', 'true');
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
        <OtpLoginModal
          role={selectedRole}
          onClose={() => setSelectedRole(null)}
          onSuccess={handleLoginSuccess}
        />
      )}
    </div>
  );
}
