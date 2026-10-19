'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState, Suspense, lazy } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import RoleQuickSwitcher from './components/RoleQuickSwitcher';
import AdminPanelHandoff from './components/AdminPanelHandoff';
import LandingPage from './components/landing/LandingPage';
import NotFoundPage from './pages/NotFoundPage';
import { RoleType, UserSession } from './types';

// ── Lazy-loaded heavy dashboards and views (Zero initial bundle lag) ──
const LoginPage = lazy(() => import('./pages/LoginPage'));
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

export default function App({ initialPath }: { initialPath?: string } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
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

  // Backward compatibility: detect legacy hash entry on initial load only
  useEffect(() => {
    const rawHash = window.location.hash.replace(/^#\/?/, '');
    if (rawHash && rawHash !== '/' && !rawHash.includes('#')) {
      const cleanPath = rawHash.startsWith('/') ? rawHash : `/${rawHash}`;
      window.history.replaceState(null, '', cleanPath);
      navigate(cleanPath, { replace: true });
    }
  }, [navigate]);

  // Dev helper: allows resetting party setup from developer console if needed
  useEffect(() => {
    (window as any).__resetPartySetup = () => {
      localStorage.removeItem('kdp_party_created');
      localStorage.removeItem('kdp_cms_config');
      localStorage.removeItem('kdp_custom_parties');
      navigate('/');
      window.location.reload();
    };
  }, [navigate]);

  // Validate & re-hydrate user session from backend on mount
  useEffect(() => {
    let isMounted = true;
    async function checkCurrentSession() {
      // 1. Try restoring via existing auth token
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

      // 2. Persistent Device Authorization
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
        } catch {
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

  const currentPath = location.pathname;
  const isLandingRoute = currentPath === '/' || currentPath === '/landing';
  const isLoginRoute = currentPath === '/login' || currentPath === '/auth/login';
  const isCmsRoute =
    currentPath === '/cms' ||
    currentPath === '/admin' ||
    currentPath === '/platform-admin' ||
    currentPath === '/assign-data' ||
    currentPath === '/assign-incharges' ||
    currentPath === '/approvals';

  const isDashboardActive = Boolean(activeSession) && !isCmsRoute && !isLandingRoute && !isLoginRoute;

  const handleResetParty = () => {
    localStorage.removeItem('kdp_party_created');
    localStorage.removeItem('kdp_active_session');
    clearAuthToken();
    setIsPartyCreated(false);
    setActiveSession(null);
    navigate('/');
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

  const handleLoginSuccess = async (session: UserSession, token: string) => {
    setAuthToken(token);
    setActiveSession(session);
    localStorage.setItem('kdp_active_session', JSON.stringify(session));
    localStorage.removeItem('kdp_logged_out');

    const orgId = session.organisationId || (session as any).organisation?.id;
    const tenantCode = (session as any).organisation?.code;
    try {
      await reloadConfig({ organisationId: orgId, tenantCode });
    } catch (e) {
      console.warn('Tenant config reload error:', e);
    }

    const targetRoute = ROUTE_BY_ROLE[session.role] || '/state';
    navigate(targetRoute);
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

    navigate('/login');
  };

  // Safe role switcher: prevents privilege escalation
  const handleSwitchRole = (newRole: RoleType) => {
    if (!activeSession) return;
    const userMaxRank = ROLE_RANK_WEIGHT[activeSession.role] || 1;
    const targetRank = ROLE_RANK_WEIGHT[newRole] || 1;

    // Disallow escalation higher than server-authorized rank
    if (targetRank > userMaxRank) {
      console.warn('Unauthorized role switch attempt prevented.');
      return;
    }

    const updatedSession = { ...activeSession, role: newRole };
    setActiveSession(updatedSession);
    localStorage.setItem('kdp_active_session', JSON.stringify(updatedSession));
    const targetPath = ROUTE_BY_ROLE[newRole] || '/state';
    navigate(targetPath);
  };

  const renderDashboardByRole = (role: RoleType) => {
    if (!activeSession) {
      return <Navigate to="/login" replace />;
    }

    switch (role) {
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

  const showTopSwitcher = Boolean(activeSession) && !isLandingRoute && !isLoginRoute && currentPath !== '/cms';

  return (
    <div className={`${isDashboardActive ? 'h-screen overflow-hidden' : 'min-h-screen'} bg-gray-50 text-gray-900 flex flex-col justify-between selection:bg-yellow-200`}>
      {showTopSwitcher && (
        <RoleQuickSwitcher
          currentRole={activeSession?.role}
          currentPath={currentPath}
          session={activeSession}
          onLogout={handleLogout}
          onSwitchRole={handleSwitchRole}
          onMobileChanged={(newMobile, user) => {
            if (activeSession) {
              const updatedSession = {
                ...activeSession,
                mobileNumber: newMobile,
                ...(user?.userName ? { userName: user.userName } : {}),
              };
              setActiveSession(updatedSession);
              localStorage.setItem('kdp_active_session', JSON.stringify(updatedSession));
            }
          }}
        />
      )}

      <div className={`${isDashboardActive ? 'h-full overflow-hidden' : 'flex-1'} ${showTopSwitcher ? 'pt-14' : ''} flex flex-col`}>
        {!activeSession && !isLandingRoute && !isLoginRoute && currentPath !== '/cms' && <Header />}

        <div className={`flex-1 ${isDashboardActive ? 'p-0 overflow-hidden' : (isLandingRoute || isLoginRoute) ? 'p-0' : 'pb-4 md:pb-6'}`}>
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
            <Routes>
              {/* Landing Route */}
              <Route
                path="/"
                element={
                  <LandingPage
                    isPartyCreated={isPartyCreated}
                    onResetParty={handleResetParty}
                    onEnterApp={() => navigate('/login')}
                    onOpenLogin={() => navigate('/login')}
                    onGetStarted={() => navigate('/login')}
                  />
                }
              />
              <Route path="/landing" element={<Navigate to="/" replace />} />

              {/* Login Route */}
              <Route
                path="/login"
                element={
                  activeSession ? (
                    <Navigate to={ROUTE_BY_ROLE[activeSession.role] || '/state'} replace />
                  ) : (
                    <LoginPage
                      onLoginSuccess={handleLoginSuccess}
                      onBackToLanding={() => navigate('/')}
                    />
                  )
                }
              />
              <Route path="/auth/login" element={<Navigate to="/login" replace />} />

              {/* Platform Admin & CMS Handoff */}
              <Route
                path="/cms"
                element={<AdminPanelHandoff onReturnToPartyApp={() => navigate('/')} />}
              />
              <Route path="/platform-admin" element={<Navigate to="/cms" replace />} />
              <Route path="/assign-data" element={<Navigate to="/cms" replace />} />
              <Route path="/assign-incharges" element={<Navigate to="/cms" replace />} />
              <Route path="/approvals" element={<Navigate to="/cms" replace />} />
              <Route path="/admin" element={<Navigate to="/cms" replace />} />

              {/* Role Dashboards - Base & Sub-route Wildcards */}
              <Route
                path="/super-admin"
                element={renderDashboardByRole('SUPER_ADMIN')}
              />
              <Route
                path="/super-admin/*"
                element={renderDashboardByRole('SUPER_ADMIN')}
              />
              <Route
                path="/state"
                element={renderDashboardByRole('STATE_ADMIN')}
              />
              <Route
                path="/state/*"
                element={renderDashboardByRole('STATE_ADMIN')}
              />
              <Route
                path="/zone"
                element={renderDashboardByRole('ZONE_INCHARGE')}
              />
              <Route
                path="/zone/*"
                element={renderDashboardByRole('ZONE_INCHARGE')}
              />
              <Route
                path="/parliament"
                element={renderDashboardByRole('PARLIAMENT_INCHARGE')}
              />
              <Route
                path="/parliament/*"
                element={renderDashboardByRole('PARLIAMENT_INCHARGE')}
              />
              <Route
                path="/constituency"
                element={renderDashboardByRole('CONSTITUENCY_INCHARGE')}
              />
              <Route
                path="/constituency/*"
                element={renderDashboardByRole('CONSTITUENCY_INCHARGE')}
              />
              <Route
                path="/mandal"
                element={renderDashboardByRole('MANDAL_INCHARGE')}
              />
              <Route
                path="/mandal/*"
                element={renderDashboardByRole('MANDAL_INCHARGE')}
              />
              <Route
                path="/village"
                element={renderDashboardByRole('VILLAGE_INCHARGE')}
              />
              <Route
                path="/village/*"
                element={renderDashboardByRole('VILLAGE_INCHARGE')}
              />
              <Route
                path="/booth"
                element={renderDashboardByRole('BOOTH_PRESIDENT')}
              />
              <Route
                path="/booth/*"
                element={renderDashboardByRole('BOOTH_PRESIDENT')}
              />
              <Route
                path="/100-voter"
                element={renderDashboardByRole('VOTER_100_INCHARGE')}
              />
              <Route
                path="/100-voter/*"
                element={renderDashboardByRole('VOTER_100_INCHARGE')}
              />

              {/* Tenant-scoped route aliases */}
              <Route
                path="/:tenantCode/dashboard/:role/*"
                element={
                  activeSession ? (
                    renderDashboardByRole(activeSession.role)
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />
              <Route
                path="/:tenantCode/dashboard/:role"
                element={
                  activeSession ? (
                    renderDashboardByRole(activeSession.role)
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />

              {/* Legacy route redirects */}
              <Route path="/roles" element={<Navigate to="/login" replace />} />
              <Route path="/app/*" element={<Navigate to="/state" replace />} />

              {/* 404 Catch-All Route */}
              <Route
                path="*"
                element={
                  <NotFoundPage
                    onGoHome={() => navigate('/')}
                    onGoLogin={() => navigate('/login')}
                  />
                }
              />
            </Routes>
          </Suspense>
        </div>
      </div>

      {!isDashboardActive && !isLandingRoute && !isLoginRoute && currentPath !== '/cms' && <Footer />}
    </div>
  );
}
