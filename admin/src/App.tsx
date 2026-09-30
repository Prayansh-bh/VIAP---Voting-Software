import React, { useState, useEffect } from 'react';
import AdminSidebar from './components/AdminSidebar';
import DashboardOverview from './components/DashboardOverview';
import ApplicationManagement from './components/ApplicationManagement';
import DataIngestion from './components/DataIngestion';
import InchargeManagement from './components/InchargeManagement';
import ApprovalEngine from './components/ApprovalEngine';
import AdminLogin from './components/AdminLogin';
import {
  AppInstance,
  InchargeRecord,
  ApprovalRecord,
  AdminUser,
} from './types';
import {
  fetchApplications,
  createApplication,
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
import { Shield, Radio, Server, ExternalLink } from 'lucide-react';

export default function App() {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(() => getAdminSession());
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Multi-party state
  const [apps, setApps] = useState<AppInstance[]>([]);
  const [selectedApp, setSelectedApp] = useState<AppInstance | null>(null);

  // Incharges and Approvals state
  const [incharges, setIncharges] = useState<InchargeRecord[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Load initial data from Postgres backend
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const loadedApps = await fetchApplications();
        setApps(loadedApps);
        const defaultApp = loadedApps.find((a) => a.isDefault) || loadedApps[0] || null;
        setSelectedApp(defaultApp);

        const [loadedIncharges, loadedApprovals] = await Promise.all([
          fetchIncharges(defaultApp?.id),
          fetchApprovals(),
        ]);
        setIncharges(loadedIncharges);
        setApprovals(loadedApprovals);
      } catch (err) {
        console.error('Failed to load initial data:', err);
      } finally {
        setLoading(false);
      }
    }

    if (adminUser) {
      loadData();
    }
  }, [adminUser]);

  const handleLoginSuccess = (user: AdminUser) => {
    setAdminUser(user);
    setAdminSession(user);
  };

  const handleLogout = () => {
    clearAdminToken();
    setAdminUser(null);
  };

  const handleCreateApp = async (formData: Partial<AppInstance>) => {
    const created = await createApplication(formData);
    const updated = [...apps, created];
    setApps(updated);
    localStorage.setItem('kdp_custom_parties', JSON.stringify(updated));
  };

  const handleDeleteApp = (id: string) => {
    const updated = apps.filter((a) => a.id !== id);
    setApps(updated);
    localStorage.setItem('kdp_custom_parties', JSON.stringify(updated));
    if (selectedApp?.id === id) {
      setSelectedApp(updated[0] || null);
    }
  };

  const handleSetDefault = (id: string) => {
    const updated = apps.map((a) => ({ ...a, isDefault: a.id === id }));
    setApps(updated);
    const target = updated.find((a) => a.id === id) || null;
    setSelectedApp(target);
    localStorage.setItem('kdp_custom_parties', JSON.stringify(updated));
  };

  const handleTransferIncharge = async (inchargeId: string, targetJurisdiction: string, targetLevel: string) => {
    if (!selectedApp) return;
    await transferIncharge(selectedApp.id, inchargeId, targetJurisdiction, targetLevel);
    const refreshed = await fetchIncharges(selectedApp.id);
    setIncharges(refreshed);
  };

  const handleReplaceIncharge = async (inchargeId: string, replacementName: string, replacementMobile: string, handoverNote?: string) => {
    if (!selectedApp) return;
    await replaceIncharge(selectedApp.id, inchargeId, replacementName, replacementMobile, handoverNote);
    const refreshed = await fetchIncharges(selectedApp.id);
    setIncharges(refreshed);
  };

  const handleToggleInchargeStatus = async (inchargeId: string, status: string) => {
    if (!selectedApp) return;
    await updateInchargeStatus(selectedApp.id, inchargeId, status);
    const refreshed = await fetchIncharges(selectedApp.id);
    setIncharges(refreshed);
  };

  const handleResetInchargeCredentials = async (inchargeId: string) => {
    if (!selectedApp) return;
    await resetInchargeCredentials(selectedApp.id, inchargeId);
  };

  const handleApprove = async (id: string, reviewerNote?: string) => {
    await approveRequest(id, reviewerNote);
    const refreshed = await fetchApprovals();
    setApprovals(refreshed);
  };

  const handleReject = async (id: string, reason: string) => {
    await rejectRequest(id, reason);
    const refreshed = await fetchApprovals();
    setApprovals(refreshed);
  };

  // If unauthenticated, show secure admin login
  if (!adminUser) {
    return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
  }

  const pendingApprovalsCount = approvals.filter((a) => a.status === 'PENDING').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex selection:bg-amber-400 selection:text-slate-950 font-sans">
      {/* Fixed Sidebar */}
      <AdminSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        adminUser={adminUser}
        onLogout={handleLogout}
        pendingApprovalsCount={pendingApprovalsCount}
      />

      {/* Main Administrative Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Telemetry Header Bar */}
        <header className="h-16 px-6 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Active Tenant Scope:</span>
              <span className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-black text-white flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: selectedApp?.primaryColor || '#F59E0B' }}
                />
                {selectedApp?.name || 'All Applications'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="hidden sm:flex items-center gap-2 text-slate-400">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              <span>PostgreSQL (Port 5432)</span>
            </div>

            <a
              href="http://localhost:3000"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition flex items-center gap-1.5 shadow-sm shadow-amber-400/20"
            >
              <span>Party App (Port 3000)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardOverview
              apps={apps}
              pendingApprovals={approvals}
              onNavigateTab={setActiveTab}
              onSelectApp={(app) => {
                setSelectedApp(app);
                setActiveTab('applications');
              }}
            />
          )}

          {activeTab === 'applications' && (
            <ApplicationManagement
              apps={apps}
              selectedApp={selectedApp}
              onSelectApp={setSelectedApp}
              onCreateApp={handleCreateApp}
              onDeleteApp={handleDeleteApp}
              onSetDefault={handleSetDefault}
            />
          )}

          {activeTab === 'data' && (
            <DataIngestion currentApp={selectedApp} />
          )}

          {activeTab === 'incharges' && (
            <InchargeManagement
              incharges={incharges}
              currentApp={selectedApp}
              onTransfer={handleTransferIncharge}
              onReplace={handleReplaceIncharge}
              onToggleStatus={handleToggleInchargeStatus}
              onResetCredentials={handleResetInchargeCredentials}
            />
          )}

          {activeTab === 'approvals' && (
            <ApprovalEngine
              approvals={approvals}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          )}

          {activeTab === 'settings' && (
            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-400" />
                <span>Platform Governance & Security Architecture</span>
              </h2>
              <p className="text-xs text-slate-400">
                This CMS / Admin Panel operates from the shared PostgreSQL database via Fastify REST APIs (port 4000). The incharge-facing Party Application operates on port 3000.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800 text-xs">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-bold text-amber-400">CMS Admin Panel Port</div>
                  <div className="text-slate-300 font-mono">http://localhost:3001</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-bold text-emerald-400">Party Application Port</div>
                  <div className="text-slate-300 font-mono">http://localhost:3000</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-bold text-blue-400">Backend Fastify API</div>
                  <div className="text-slate-300 font-mono">http://localhost:4000/api</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-bold text-purple-400">Shared Database</div>
                  <div className="text-slate-300 font-mono">PostgreSQL (localhost:5432)</div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
