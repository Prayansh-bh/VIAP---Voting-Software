import { getAppUrl } from './lib/env';
import React, { useState, useEffect } from 'react';
import {
  useLocation,
  useNavigate,
  useParams,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import AdminSidebar from './components/AdminSidebar';
import DashboardOverview from './components/DashboardOverview';
import ApplicationManagement from './components/ApplicationManagement';
import DataIngestion from './components/DataIngestion';
import InchargeManagement from './components/InchargeManagement';
import ApprovalEngine from './components/ApprovalEngine';
import AdminLogin from './components/AdminLogin';
import CmsStudio from './components/CmsStudio';
import CmsBrandGateway from './components/CmsBrandGateway';
import ApiCredentialsManager from './components/ApiCredentialsManager';
import AdminProfileSecurity from './components/AdminProfileSecurity';
import {
  AppInstance,
  InchargeRecord,
  ApprovalRecord,
  AdminUser,
  ApplicationSummary,
} from './types';
import {
  fetchApplications,
  createApplication,
  updateApplication,
  deleteApplication,
  fetchApplicationSummary,
  fetchIncharges,
  transferIncharge,
  replaceIncharge,
  updateInchargeStatus,
  resetInchargeCredentials,
  fetchApprovals,
  approveRequest,
  rejectRequest,
} from './lib/api';
import {
  getAdminSession,
  setAdminSession,
  clearAdminToken,
} from './lib/auth';
import { useNotification } from './context/NotificationContext';
import { useCms } from './context/CmsContext';
import { Shield, Radio, Server, ExternalLink, AlertTriangle, ArrowLeft, Plus, Layers, Palette, Sparkles } from 'lucide-react';

// 404 Route View
function AdminNotFound() {
  const navigate = useNavigate();
  return (
    <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl max-w-xl mx-auto my-12 space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-2xl font-black">
        404
      </div>
      <h2 className="text-xl font-bold text-white">Route Not Found</h2>
      <p className="text-xs text-slate-400">The administrative route you navigated to does not exist or has moved.</p>
      <button
        onClick={() => navigate('/admin/dashboard')}
        className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer shadow-lg shadow-amber-400/20 transition"
      >
        Return to Executive Command
      </button>
    </div>
  );
}

// Wrapper for /admin/applications/:id/edit
function RouteAppEditor({
  apps,
  onAppSaved,
}: {
  apps: AppInstance[];
  onAppSaved: () => Promise<void>;
}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const matchedApp = apps.find(
    (a) => a.id === id || a.configKey === id || a.tenantCode === id
  );

  if (!matchedApp && apps.length > 0) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl max-w-lg mx-auto my-12 space-y-3">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <h3 className="text-base font-bold text-white">Application Not Found</h3>
        <p className="text-xs text-slate-400">
          No political party application matches identifier: <code className="text-amber-300 font-mono">{id}</code>
        </p>
        <button
          onClick={() => navigate('/admin/applications')}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
        >
          Back to Party Applications
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 text-slate-100">
      <CmsStudio
        isOpen={true}
        mode="editor"
        currentApp={matchedApp || null}
        targetAppId={id}
        onClose={() => navigate('/admin/applications')}
        onAppBuilt={async () => {
          await onAppSaved();
          navigate('/admin/applications');
        }}
        onOpenRoleModules={() => navigate('/admin/applications')}
      />
    </div>
  );
}

// Wrapper for /admin/cms/:applicationId
function RouteCmsEditor({
  apps,
  selectedApp,
  onAppSaved,
}: {
  apps: AppInstance[];
  selectedApp: AppInstance | null;
  onAppSaved: () => Promise<void>;
}) {
  const { applicationId } = useParams<{ applicationId?: string }>();
  const navigate = useNavigate();

  // If route is /admin/cms/new, redirect directly to the new application wizard
  if (applicationId === 'new') {
    return <Navigate to="/admin/applications/new" replace />;
  }

  const targetApp = applicationId
    ? apps.find(
        (a) => a.id === applicationId || a.configKey === applicationId || a.tenantCode === applicationId
      ) || null
    : selectedApp;

  if (applicationId && !targetApp && apps.length > 0) {
    return (
      <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl max-w-xl mx-auto my-12 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-2xl font-black">
          <Palette className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Party Application Not Found</h2>
        <p className="text-xs text-slate-400">
          The requested application ID was not found among your active political tenants.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => navigate('/admin/cms')}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer border border-slate-700 transition"
          >
            Back to CMS Studio Hub
          </button>
          <button
            onClick={() => navigate('/admin/applications/new')}
            className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer shadow-lg shadow-amber-400/20 transition"
          >
            Provision New Party
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Contextual Top Bar when inside CMS Editor */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/cms')}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-700/60"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Parties (CMS Hub)</span>
          </button>

          {targetApp && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">Editing Brand Identity for:</span>
              <span className="px-2.5 py-1 rounded-lg font-bold bg-amber-400/10 text-amber-300 border border-amber-400/30 flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: targetApp.primaryColor || '#F59E0B' }}
                />
                {targetApp.name} ({targetApp.partyCode})
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {targetApp && (
            <button
              onClick={() => navigate('/admin/applications')}
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition font-medium flex items-center gap-1.5 cursor-pointer"
              title="Edit Administrative Hierarchy Tiers (Booths, Mandals, etc.)"
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Party Tiers & Hierarchy</span>
            </button>
          )}

          <button
            onClick={() => navigate('/admin/applications/new')}
            className="px-3 py-1.5 rounded-xl bg-amber-400/10 hover:bg-amber-400 text-amber-300 hover:text-slate-950 font-bold transition flex items-center gap-1.5 cursor-pointer border border-amber-400/30"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Provision New Party</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-900/90 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 text-slate-100">
        <CmsStudio
          isOpen={true}
          mode="editor"
          currentApp={targetApp}
          targetAppId={applicationId || targetApp?.id}
          onClose={() => navigate('/admin/cms')}
          onAppBuilt={async () => {
            await onAppSaved();
            navigate('/admin/cms');
          }}
          onOpenRoleModules={() => navigate('/admin/applications')}
        />
      </div>
    </div>
  );
}

export default function App() {
  const { notify } = useNotification();
  const { reloadConfig } = useCms();
  const location = useLocation();
  const navigate = useNavigate();

  const [adminUser, setAdminUser] = useState<AdminUser | null>(() => getAdminSession());

  // Multi-party state
  const [apps, setApps] = useState<AppInstance[]>([]);
  const [selectedApp, setSelectedApp] = useState<AppInstance | null>(null);

  // Incharge state
  const [incharges, setIncharges] = useState<InchargeRecord[]>([]);

  // Approval state
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);

  // Summary telemetry state
  const [summary, setSummary] = useState<ApplicationSummary | null>(null);

  const [loading, setLoading] = useState(true);

  // Determine active tab from URL path
  const currentTab = (() => {
    const p = location.pathname;
    if (p.startsWith('/admin/applications')) return 'applications';
    if (p.startsWith('/admin/cms')) return 'cms';
    if (p.startsWith('/admin/data')) return 'data';
    if (p.startsWith('/admin/incharges')) return 'incharges';
    if (p.startsWith('/admin/approvals')) return 'approvals';
    if (p.startsWith('/admin/credentials')) return 'credentials';
    if (p.startsWith('/admin/settings')) return 'settings';
    return 'dashboard';
  })();

  const loadData = async () => {
    try {
      const [appsData, inchargesData, approvalsData, summaryData] = await Promise.all([
        fetchApplications(),
        fetchIncharges(),
        fetchApprovals(),
        fetchApplicationSummary(),
      ]);

      setApps(appsData);
      setIncharges(inchargesData);
      setApprovals(approvalsData);
      setSummary(summaryData);

      if (appsData.length > 0 && !selectedApp) {
        const defaultApp = appsData.find((a) => a.isDefault) || appsData[0];
        setSelectedApp(defaultApp);
        reloadConfig({
          organisationId: (defaultApp as any).organisationId || (defaultApp.id && defaultApp.id.length === 36 ? defaultApp.id : undefined),
          tenantCode: defaultApp.tenantCode || defaultApp.configKey,
        });
      }
    } catch (err: any) {
      console.warn('Backend connection issue:', err);
      notify.error('Failed to connect to Fastify API on port 4000. Is backend running?', 'API Offline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminUser) {
      loadData();
    }
  }, [adminUser]);

  const handleSelectApp = (app: AppInstance | null) => {
    setSelectedApp(app);
    if (app) {
      reloadConfig({
        organisationId: (app as any).organisationId || (app.id && app.id.length === 36 ? app.id : undefined),
        tenantCode: app.tenantCode || app.configKey,
      });
    }
  };

  const handleCreateApp = async (formData: Partial<AppInstance>) => {
    const created = await createApplication(formData);
    const refreshed = await fetchApplications();
    setApps(refreshed);
    handleSelectApp(created);
  };

  const handleUpdateApp = async (id: string, formData: Partial<AppInstance>) => {
    const updated = await updateApplication(id, formData);
    const refreshed = await fetchApplications();
    setApps(refreshed);
    if (selectedApp?.id === id) {
      const refreshedTarget = refreshed.find((a) => a.id === id) || updated;
      handleSelectApp(refreshedTarget);
    }
  };

  const handleDeleteApp = async (id: string) => {
    await deleteApplication(id);
    try {
      const refreshed = await fetchApplications();
      setApps(refreshed);
      if (selectedApp?.id === id) {
        const nextApp = refreshed.find((a) => a.isDefault) || refreshed[0] || null;
        handleSelectApp(nextApp);
      }
    } catch (refreshErr) {
      setApps((prev) => prev.filter((a) => a.id !== id));
      throw refreshErr;
    }
  };

  const handleSetDefault = (id: string) => {
    setApps(apps.map((a) => ({ ...a, isDefault: a.id === id })));
    notify.success('Default political application updated.', 'Default Tenant');
  };

  const handleTransferIncharge = async (inchargeId: string, targetJurisdiction: string, targetLevel: string) => {
    const appId = selectedApp?.id || 'default';
    const res = await transferIncharge(appId, inchargeId, targetJurisdiction, targetLevel);
    if (res?.success) {
      const refreshed = await fetchIncharges(appId);
      setIncharges(refreshed);
    }
  };

  const handleReplaceIncharge = async (inchargeId: string, newName: string, newPhone: string, note?: string) => {
    const appId = selectedApp?.id || 'default';
    const res = await replaceIncharge(appId, inchargeId, newName, newPhone, note);
    if (res?.success) {
      const refreshed = await fetchIncharges(appId);
      setIncharges(refreshed);
    }
  };

  const handleToggleInchargeStatus = async (inchargeId: string, status: string) => {
    const appId = selectedApp?.id || 'default';
    const res = await updateInchargeStatus(appId, inchargeId, status);
    if (res?.success) {
      const refreshed = await fetchIncharges(appId);
      setIncharges(refreshed);
    }
  };

  const handleResetInchargeCredentials = async (inchargeId: string) => {
    const appId = selectedApp?.id || 'default';
    await resetInchargeCredentials(appId, inchargeId);
  };

  const handleApprove = async (id: string, reviewerNote?: string) => {
    await approveRequest(id, reviewerNote);
    setApprovals(approvals.filter((a) => a.id !== id));
  };

  const handleReject = async (id: string, reason: string) => {
    await rejectRequest(id, reason);
    setApprovals(approvals.filter((a) => a.id !== id));
  };

  const handleLoginSuccess = (user: AdminUser) => {
    setAdminUser(user);
    setAdminSession(user);
    notify.success(`Authenticated as ${user.name} (${user.role})`, 'Access Granted');
    navigate('/admin/dashboard');
  };

  const handleLogout = () => {
    clearAdminToken();
    setAdminUser(null);
    notify.info('Logged out of Platform Governance.', 'Session Ended');
  };

  if (!adminUser) {
    return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row antialiased selection:bg-amber-400 selection:text-slate-950 font-sans">
      {/* Platform Sidebar */}
      <AdminSidebar
        activeTab={currentTab}
        onSelectTab={(tab) => navigate(`/admin/${tab}`)}
        adminUser={adminUser}
        onLogout={handleLogout}
        pendingApprovalsCount={approvals.filter((a) => a.status === 'PENDING').length}
      />

      {/* Main Administrative Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Operational Header */}
        <header className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                Platform Telemetry Online
              </span>
            </div>
            {selectedApp && (
              <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-400/10 text-amber-300 border border-amber-400/30">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Selected: {selectedApp.name} ({selectedApp.partyCode})
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="hidden sm:flex items-center gap-2 text-slate-400">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              <span>PostgreSQL Connected</span>
            </div>

            <a
              href={getAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition flex items-center gap-1.5 shadow-sm shadow-amber-400/20"
            >
              <span>Launch Party App</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </header>

        {/* Content Area with Declarative Routes */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

            <Route
              path="/admin/dashboard"
              element={
                <DashboardOverview
                  apps={apps}
                  incharges={incharges}
                  summary={summary}
                  selectedApp={selectedApp}
                  pendingApprovals={approvals}
                  onNavigateTab={(tab) => navigate(`/admin/${tab}`)}
                  onCreateNewApp={() => navigate('/admin/applications/new')}
                  onSelectApp={(app) => {
                    handleSelectApp(app);
                    navigate('/admin/applications');
                  }}
                />
              }
            />

            <Route
              path="/admin/applications"
              element={
                <ApplicationManagement
                  apps={apps}
                  selectedApp={selectedApp}
                  onSelectApp={handleSelectApp}
                  onCreateApp={handleCreateApp}
                  onUpdateApp={handleUpdateApp}
                  onDeleteApp={handleDeleteApp}
                  onSetDefault={handleSetDefault}
                  onOpenCreateModal={() => navigate('/admin/applications/new')}
                  onOpenCmsStudio={(app) => {
                    handleSelectApp(app);
                    navigate(`/admin/cms/${app.id}`);
                  }}
                />
              }
            />

            <Route
              path="/admin/applications/new"
              element={
                <div className="bg-slate-900/90 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 text-slate-100">
                  <CmsStudio
                    isOpen={true}
                    mode="setup"
                    onClose={() => navigate('/admin/applications')}
                    onAppBuilt={async (newAppData) => {
                      const loaded = await fetchApplications();
                      setApps(loaded);
                      if (newAppData?.id) {
                        const found = loaded.find((a) => a.id === newAppData.id || a.name === newAppData.appName);
                        if (found) handleSelectApp(found);
                      }
                      navigate('/admin/applications');
                    }}
                    onOpenRoleModules={async () => {
                      const loaded = await fetchApplications();
                      setApps(loaded);
                      navigate('/admin/applications');
                    }}
                  />
                </div>
              }
            />

            <Route
              path="/admin/applications/:id/edit"
              element={<RouteAppEditor apps={apps} onAppSaved={loadData} />}
            />

            <Route
              path="/admin/applications/:id"
              element={
                <ApplicationManagement
                  apps={apps}
                  selectedApp={selectedApp}
                  onSelectApp={handleSelectApp}
                  onCreateApp={handleCreateApp}
                  onUpdateApp={handleUpdateApp}
                  onDeleteApp={handleDeleteApp}
                  onSetDefault={handleSetDefault}
                  onOpenCreateModal={() => navigate('/admin/applications/new')}
                  onOpenCmsStudio={(app) => {
                    handleSelectApp(app);
                    navigate(`/admin/cms/${app.id}`);
                  }}
                />
              }
            />

            <Route
              path="/admin/cms"
              element={
                <CmsBrandGateway
                  apps={apps}
                  selectedApp={selectedApp}
                  onSelectApp={(app) => {
                    handleSelectApp(app);
                    navigate(`/admin/cms/${app.id}`);
                  }}
                  onProvisionNewParty={() => navigate('/admin/applications/new')}
                />
              }
            />

            <Route
              path="/admin/cms/:applicationId"
              element={<RouteCmsEditor apps={apps} selectedApp={selectedApp} onAppSaved={loadData} />}
            />

            <Route
              path="/admin/data"
              element={<DataIngestion currentApp={selectedApp} />}
            />

            <Route
              path="/admin/data/:applicationId"
              element={
                <DataIngestion
                  currentApp={
                    apps.find((a) => a.id === location.pathname.split('/')[3]) || selectedApp
                  }
                />
              }
            />

            <Route
              path="/admin/incharges"
              element={
                <InchargeManagement
                  incharges={incharges}
                  currentApp={selectedApp}
                  onTransfer={handleTransferIncharge}
                  onReplace={handleReplaceIncharge}
                  onToggleStatus={handleToggleInchargeStatus}
                  onResetCredentials={handleResetInchargeCredentials}
                />
              }
            />

            <Route
              path="/admin/incharges/:applicationId"
              element={
                <InchargeManagement
                  incharges={incharges}
                  currentApp={
                    apps.find((a) => a.id === location.pathname.split('/')[3]) || selectedApp
                  }
                  onTransfer={handleTransferIncharge}
                  onReplace={handleReplaceIncharge}
                  onToggleStatus={handleToggleInchargeStatus}
                  onResetCredentials={handleResetInchargeCredentials}
                />
              }
            />

            <Route
              path="/admin/approvals"
              element={
                <ApprovalEngine
                  approvals={approvals}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              }
            />

            <Route
              path="/admin/credentials"
              element={
                <ApiCredentialsManager
                  currentApp={selectedApp}
                  apps={apps}
                  onSelectApp={handleSelectApp}
                />
              }
            />

            <Route
              path="/admin/credentials/:applicationId"
              element={
                <ApiCredentialsManager
                  currentApp={
                    apps.find((a) => a.id === location.pathname.split('/')[3]) || selectedApp
                  }
                  apps={apps}
                  onSelectApp={handleSelectApp}
                />
              }
            />

            <Route
              path="/admin/settings"
              element={
                <AdminProfileSecurity
                  adminUser={adminUser}
                  onProfileUpdated={(updated) => setAdminUser(updated)}
                />
              }
            />

            {/* Real Catch-All 404 Route */}
            <Route path="*" element={<AdminNotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
