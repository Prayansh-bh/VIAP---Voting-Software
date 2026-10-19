import { getAppUrl } from '../lib/env';
import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Check,
  CheckCircle2,
  Trash2,
  Copy,
  ExternalLink,
  Shield,
  Palette,
  Users,
  Settings2,
  AlertCircle,
  Loader2,
  Pencil,
  Sparkles,
} from 'lucide-react';
import { AppInstance, HierarchyLevelKey, HierarchyTierConfig } from '../types';
import Pagination from './Pagination';
import { useNotification } from '../context/NotificationContext';

interface ApplicationManagementProps {
  apps: AppInstance[];
  selectedApp: AppInstance | null;
  onSelectApp: (app: AppInstance) => void;
  onCreateApp: (app: Partial<AppInstance>) => Promise<void>;
  onUpdateApp?: (id: string, app: Partial<AppInstance>) => Promise<void>;
  onDeleteApp: (id: string) => Promise<void> | void;
  onSetDefault: (id: string) => void;
  isCreateModalOpen?: boolean;
  onOpenCreateModal?: () => void;
  onCloseCreateModal?: () => void;
  onOpenCmsStudio?: (app: AppInstance) => void;
}

const ALL_HIERARCHY_LEVELS: HierarchyTierConfig[] = [
  { id: 'VOTER_GROUP', label: '100-Voters Committee', scope: 'Micro Cluster', count: 100, description: 'Family cluster & micro-demographic mobilization', badge: 'Ground Outreach' },
  { id: 'BOOTH', label: 'Booth Management', scope: 'Polling Station', count: 1000, description: 'Polling station agent & voter turnout oversight', badge: 'Defense & Turnout' },
  { id: 'VILLAGE', label: 'Village / Ward Polling', scope: 'Gram Panchayat', count: 4000, description: 'Local community leaders & ward council coordination', badge: 'Community Core' },
  { id: 'MANDAL', label: 'Mandal Operations', scope: 'Block Unit', count: 35000, description: 'Mandal committee & multi-village cadre hub', badge: 'Operational Block' },
  { id: 'CONSTITUENCY', label: 'Constituency Incharge (MLA)', scope: 'Assembly Seat', count: 240000, description: 'MLA candidate command center & voter analytics', badge: 'Assembly Core' },
  { id: 'DISTRICT', label: 'District Committee (DCC)', scope: 'District / Zilla', count: 700000, description: 'District level party committee & inter-assembly oversight', badge: 'District DCC' },
  { id: 'PARLIAMENT', label: 'Parliament Incharge (MP)', scope: 'Lok Sabha Seat', count: 1600000, description: 'MP candidate headquarters & parliamentary cadre', badge: 'Apex Parliament' },
  { id: 'ZONE', label: 'Zone Coordinator', scope: 'Multi-Parliament', count: 4500000, description: 'Zonal party observers & regional campaign leads', badge: 'Regional Zone' },
  { id: 'STATE', label: 'State Leadership (Apex)', scope: 'Statewide Hub', count: 35000000, description: 'State party president, core committee & war room', badge: 'Apex Command' },
];

export default function ApplicationManagement({
  apps,
  selectedApp,
  onSelectApp,
  onCreateApp,
  onUpdateApp,
  onDeleteApp,
  onSetDefault,
  isCreateModalOpen,
  onOpenCreateModal,
  onCloseCreateModal,
  onOpenCmsStudio,
}: ApplicationManagementProps) {
  const { notify, confirmDialog } = useNotification();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('edit');
  const [editingAppId, setEditingAppId] = useState<string | null>(null);

  const handleOpenCreate = () => {
    if (onOpenCreateModal) {
      onOpenCreateModal();
    } else {
      setModalMode('create');
      setEditingAppId(null);
      setInitialLevels([]);
      setNewTierIncharges({});
      setFormData({
        name: '',
        party: '',
        partyCode: '',
        leaderName: '',
        jurisdiction: '',
        description: '',
        candidateMobile: '',
        primaryColor: '#F59E0B',
        secondaryColor: '#DC2626',
        accentColor: '#0F172A',
        activeHierarchyLevels: ['VOTER_GROUP', 'BOOTH', 'VILLAGE', 'MANDAL', 'CONSTITUENCY'],
      });
      setEditModalOpen(true);
    }
  };

  const [initialLevels, setInitialLevels] = useState<HierarchyLevelKey[]>([]);
  const [newTierIncharges, setNewTierIncharges] = useState<Record<string, { name: string; mobileNumber: string }>>({});

  const handleOpenEdit = (app: AppInstance, e: React.MouseEvent) => {
    e.stopPropagation();
    setModalMode('edit');
    setEditingAppId(app.id);
    const curLevels = (app.activeHierarchyLevels && app.activeHierarchyLevels.length > 0)
      ? (app.activeHierarchyLevels as HierarchyLevelKey[])
      : ['VOTER_GROUP', 'BOOTH', 'VILLAGE', 'MANDAL', 'CONSTITUENCY'] as HierarchyLevelKey[];
    setInitialLevels(curLevels);
    setNewTierIncharges({});
    setFormData({
      name: app.name || '',
      party: app.party || '',
      partyCode: app.partyCode || '',
      leaderName: app.leaderName || '',
      jurisdiction: app.jurisdiction || '',
      description: app.description || '',
      candidateMobile: '',
      primaryColor: app.primaryColor || '#F59E0B',
      secondaryColor: app.secondaryColor || '#DC2626',
      accentColor: app.accentColor || '#0F172A',
      activeHierarchyLevels: curLevels,
    });
    setEditModalOpen(true);
  };

  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(6);

  const totalPages = Math.max(1, Math.ceil(apps.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedApps = apps.slice((safePage - 1) * pageSize, safePage * pageSize);

  const [formData, setFormData] = useState({
    name: '',
    party: '',
    partyCode: '',
    leaderName: '',
    jurisdiction: '',
    description: '',
    candidateMobile: '',
    primaryColor: '#F59E0B',
    secondaryColor: '#DC2626',
    accentColor: '#0F172A',
    activeHierarchyLevels: ['VOTER_GROUP', 'BOOTH', 'VILLAGE', 'MANDAL', 'CONSTITUENCY'] as HierarchyLevelKey[],
  });
  const [saving, setSaving] = useState(false);

  const toggleLevel = (lvlId: HierarchyLevelKey) => {
    setFormData((prev) => {
      const exists = prev.activeHierarchyLevels.includes(lvlId);
      if (exists) {
        if (prev.activeHierarchyLevels.length <= 1) {
          notify.warning('At least one hierarchy level must remain enabled.', 'Validation Notice');
          return prev;
        }
        return {
          ...prev,
          activeHierarchyLevels: prev.activeHierarchyLevels.filter((k) => k !== lvlId),
        };
      } else {
        const meta = ALL_HIERARCHY_LEVELS.find((l) => l.id === lvlId);
        if (modalMode === 'edit' && !initialLevels.includes(lvlId)) {
          setNewTierIncharges((prevInc) => ({
            ...prevInc,
            [lvlId]: prevInc[lvlId] || { name: `${meta?.label || lvlId} Incharge`, mobileNumber: '' },
          }));
        }
        return {
          ...prev,
          activeHierarchyLevels: [...prev.activeHierarchyLevels, lvlId],
        };
      }
    });
  };

  const newlyEnabledTiers = modalMode === 'edit'
    ? formData.activeHierarchyLevels.filter((lvl) => !initialLevels.includes(lvl))
    : [];

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.partyCode) {
      notify.warning('Application name and Party Code are required.', 'Missing Fields');
      return;
    }

    if (modalMode === 'create' && formData.candidateMobile) {
      const cleanNum = formData.candidateMobile.replace(/\D/g, '').slice(-10);
      if (cleanNum.length < 10) {
        notify.warning('Please enter a valid 10-digit primary mobile number for the candidate.', 'Invalid Mobile');
        return;
      }
    }

    if (modalMode === 'edit' && newlyEnabledTiers.length > 0) {
      for (const tierKey of newlyEnabledTiers) {
        const inc = newTierIncharges[tierKey];
        const meta = ALL_HIERARCHY_LEVELS.find((l) => l.id === tierKey);
        const cleanNum = (inc?.mobileNumber || '').replace(/\D/g, '').slice(-10);
        if (!cleanNum || cleanNum.length < 10) {
          notify.warning(
            `Please enter a dedicated 10-digit mobile number for the newly introduced ${meta?.label || tierKey} tier.`,
            'New Tier Mobile Required'
          );
          return;
        }
      }
    }

    setSaving(true);
    try {
      if (modalMode === 'edit' && editingAppId) {
        const formattedNewIncharges = newlyEnabledTiers.map((tierKey) => {
          const inc = newTierIncharges[tierKey];
          const meta = ALL_HIERARCHY_LEVELS.find((l) => l.id === tierKey);
          return {
            tierLevel: tierKey,
            name: (inc?.name || '').trim() || `${meta?.label || tierKey} Incharge`,
            mobileNumber: (inc?.mobileNumber || '').replace(/\D/g, '').slice(-10),
          };
        });

        if (onUpdateApp) {
          await onUpdateApp(editingAppId, {
            ...formData,
            ...(formattedNewIncharges.length > 0 ? { newTierIncharges: formattedNewIncharges } : {}),
          });
        }
        setEditModalOpen(false);
        notify.success(`Party tenant "${formData.name}" has been successfully updated in PostgreSQL!`, 'Tenant Updated');
        setSuccessBanner(`Party tenant "${formData.name}" (${formData.partyCode}) updated successfully in PostgreSQL! Enabled tiers: ${formData.activeHierarchyLevels.join(' → ')}.`);
      } else {
        await onCreateApp(formData);
        const appName = formData.name;
        const partyCode = formData.partyCode;
        setJustCreatedId(partyCode);
        setEditModalOpen(false);
        notify.success(`Party tenant "${appName}" (${partyCode}) has been successfully provisioned in PostgreSQL!`, 'Tenant Provisioned');
        setSuccessBanner(`Party tenant "${appName}" (${partyCode}) has been successfully provisioned in PostgreSQL! Enabled tiers: ${formData.activeHierarchyLevels.join(' → ')}.`);
      }

      setFormData({
        name: '',
        party: '',
        partyCode: '',
        leaderName: '',
        jurisdiction: '',
        description: '',
        candidateMobile: '',
        primaryColor: '#F59E0B',
        secondaryColor: '#DC2626',
        accentColor: '#0F172A',
        activeHierarchyLevels: ['VOTER_GROUP', 'BOOTH', 'VILLAGE', 'MANDAL', 'CONSTITUENCY'],
      });
      setTimeout(() => setSuccessBanner(null), 10000);
    } catch (err: any) {
      notify.error(err.message || 'Failed to save application', modalMode === 'edit' ? 'Update Failed' : 'Provisioning Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Notification Banner */}
      {successBanner && (
        <div className="p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center justify-between shadow-xl shadow-emerald-500/5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="font-bold text-emerald-200 text-xs">Tenant Created & Provisioned Successfully</div>
              <div className="text-emerald-400/90 text-[11px] mt-0.5">{successBanner}</div>
            </div>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-400 hover:text-white text-xs font-bold px-2 py-1 rounded-lg hover:bg-emerald-500/20"
          >
            ✕
          </button>
        </div>
      )}

      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-white">Party Application Architecture & Hierarchy</h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure dynamic hierarchy levels for political applications. Unchecked levels are suppressed from the party app.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-lg shadow-amber-400/20 transition flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Provision New Party App</span>
        </button>
      </div>

      {/* Grid of Existing Applications */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {paginatedApps.map((app) => {
          const isSelected = selectedApp?.id === app.id;
          const levels = app.activeHierarchyLevels || ['VOTER_GROUP', 'BOOTH', 'VILLAGE', 'MANDAL', 'CONSTITUENCY'];

          return (
            <div
              key={app.id}
              onClick={() => onSelectApp(app)}
              className={`p-5 rounded-3xl bg-slate-900 border transition cursor-pointer flex flex-col justify-between ${
                isSelected ? 'border-amber-400 shadow-lg shadow-amber-400/10' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-md"
                      style={{ backgroundColor: app.primaryColor || '#F59E0B' }}
                    >
                      {app.partyCode || 'APP'}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white leading-tight">{app.name}</div>
                      <div className="text-[11px] text-slate-400">{app.party}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {justCreatedId === app.partyCode && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-400/20 text-emerald-300 border border-emerald-400/40 animate-pulse">
                        NEWLY CREATED
                      </span>
                    )}
                    {app.isDefault && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        DEFAULT
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 mb-3">{app.description}</p>

                {/* Enabled Levels Summary */}
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 mb-3 space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Enabled Hierarchy ({levels.length} Tiers)
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {levels.map((lvl) => (
                      <span
                        key={lvl}
                        className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-900 text-amber-400 border border-slate-800"
                      >
                        {lvl.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetDefault(app.id);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                    app.isDefault
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {app.isDefault ? 'Active Default' : 'Set as Default'}
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenCmsStudio) {
                        onOpenCmsStudio(app);
                      }
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition cursor-pointer"
                    title="Customize Visual Brand & Themes in CMS Studio"
                  >
                    <Palette className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => handleOpenEdit(app, e)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition cursor-pointer"
                    title="Edit Party Details & Hierarchy Architecture"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <a
                    href={app.tenantCode || app.configKey ? `${getAppUrl()}/?app=${encodeURIComponent(((app.tenantCode || app.configKey) || '').toLowerCase())}` : getAppUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition"
                    title="Launch this Party App"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    disabled={deletingId === app.id}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (apps.length <= 1) {
                        notify.warning('Cannot delete the sole application. At least one party application must remain active.', 'Action Not Allowed');
                        return;
                      }
                      const confirmed = await confirmDialog({
                        title: 'Delete Party Application',
                        message: `Are you sure you want to permanently delete "${app.name}" (${app.party})? All associated tenant hierarchy configuration will be purged from PostgreSQL.`,
                        confirmText: 'Delete Application',
                        danger: true,
                        icon: 'trash',
                      });
                      if (confirmed) {
                        setDeletingId(app.id);
                        try {
                          await onDeleteApp(app.id);
                          notify.success(`Application "${app.name}" has been permanently deleted from PostgreSQL.`, 'Deleted Successfully');
                        } catch (err: any) {
                          notify.error(err.message || 'Failed to delete application.', 'Deletion Error');
                        } finally {
                          setDeletingId(null);
                        }
                      }
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer disabled:opacity-50"
                    title="Delete application"
                  >
                    {deletingId === app.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dynamic Pagination Controls */}
      <Pagination
        currentPage={safePage}
        totalItems={apps.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[6, 9, 15, 30]}
        itemLabel="party applications"
        themeColor="amber"
      />

      {/* Create New Party Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto">
            <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-400 shrink-0" />
                  <span>{modalMode === 'edit' ? 'Edit Party Application Architecture' : 'Provision New Political Party Application'}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {modalMode === 'edit'
                    ? 'Update persisted tenant name, branding colors, leadership and enabled hierarchy tiers in PostgreSQL.'
                    : 'Configure identity, brand palette, and select exactly which hierarchy tiers will exist in the tenant.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition cursor-pointer shrink-0 ml-4"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
              {/* App Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Application Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Nalgonda Congress Connect"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Political Party Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Indian National Congress"
                    value={formData.party}
                    onChange={(e) => setFormData({ ...formData, party: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Party Code / Acronym *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. INC, TDP, BRS, BJP"
                    value={formData.partyCode}
                    onChange={(e) => setFormData({ ...formData, partyCode: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-400 outline-none font-bold uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Candidate / Party Leader Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. N. Uttam Kumar Reddy"
                    value={formData.leaderName}
                    onChange={(e) => setFormData({ ...formData, leaderName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Jurisdiction / Scope
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Nalgonda Parliament (7 Assembly Segments)"
                    value={formData.jurisdiction}
                    onChange={(e) => setFormData({ ...formData, jurisdiction: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-400 outline-none"
                  />
                </div>

                {modalMode === 'create' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                      <span>Candidate Login Mobile (+91) *</span>
                      <span className="text-[10px] text-amber-400 font-mono">Dedicated Login ID</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">+91</span>
                      <input
                        type="tel"
                        maxLength={10}
                        required
                        placeholder="10-digit primary mobile"
                        value={formData.candidateMobile}
                        onChange={(e) => setFormData({ ...formData, candidateMobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        className="w-full pl-11 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono font-bold focus:border-amber-400 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Brand Palette */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-amber-400" />
                  <span>Party Brand Color Tokens</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold">Primary</div>
                      <div className="text-xs font-mono font-bold text-white">{formData.primaryColor}</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold">Secondary</div>
                      <div className="text-xs font-mono font-bold text-white">{formData.secondaryColor}</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.accentColor}
                      onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold">Accent</div>
                      <div className="text-xs font-mono font-bold text-white">{formData.accentColor}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Hierarchy Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Settings2 className="w-4 h-4 text-amber-400" />
                    <span>Select Enabled Hierarchy Tiers *</span>
                  </label>
                  <span className="text-[11px] text-amber-400 font-bold">
                    {formData.activeHierarchyLevels.length} of {ALL_HIERARCHY_LEVELS.length} enabled
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mb-3">
                  Only the tiers selected below will appear in the Party Application. Unchecked tiers will not appear in the incharge UI, forms, or routing.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ALL_HIERARCHY_LEVELS.map((tier) => {
                    const isChecked = formData.activeHierarchyLevels.includes(tier.id);
                    return (
                      <div
                        key={tier.id}
                        onClick={() => toggleLevel(tier.id)}
                        className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                          isChecked
                            ? 'bg-amber-400/10 border-amber-400 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-5 h-5 rounded-lg border flex items-center justify-center text-xs font-black transition ${
                              isChecked
                                ? 'bg-amber-400 text-slate-950 border-amber-400'
                                : 'border-slate-700 bg-slate-900'
                            }`}
                          >
                            {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <div>
                            <div className="text-xs font-bold">{tier.label}</div>
                            <div className="text-[10px] text-slate-400">{tier.scope}</div>
                          </div>
                        </div>

                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                          {tier.badge}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Dedicated Incharge Details for Newly Introduced Tiers */}
                {modalMode === 'edit' && newlyEnabledTiers.length > 0 && (
                  <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                        <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Newly Introduced Tiers — Dedicated Login Mobile ({newlyEnabledTiers.length})</span>
                      </div>
                      <span className="text-[10px] text-amber-400 font-mono">Mobile required for newly introduced tier</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      You selected new hierarchy tier(s) for this party. Please provide the incharge name and mobile number for each new tier.
                    </p>
                    <div className="space-y-3 pt-1">
                      {newlyEnabledTiers.map((tierKey) => {
                        const meta = ALL_HIERARCHY_LEVELS.find((l) => l.id === tierKey);
                        const inc = newTierIncharges[tierKey] || { name: `${meta?.label || tierKey} Incharge`, mobileNumber: '' };
                        return (
                          <div key={tierKey} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                {meta?.label || tierKey} Incharge Name *
                              </label>
                              <input
                                type="text"
                                required
                                value={inc.name}
                                onChange={(e) => setNewTierIncharges({
                                  ...newTierIncharges,
                                  [tierKey]: { ...inc, name: e.target.value },
                                })}
                                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs focus:border-amber-400 outline-none"
                                placeholder={`e.g. ${meta?.label || tierKey} Incharge`}
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                Dedicated Login Mobile (+91) *
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">+91</span>
                                <input
                                  type="tel"
                                  maxLength={10}
                                  required
                                  value={inc.mobileNumber}
                                  onChange={(e) => setNewTierIncharges({
                                    ...newTierIncharges,
                                    [tierKey]: { ...inc, mobileNumber: e.target.value.replace(/\D/g, '').slice(0, 10) },
                                  })}
                                  className="w-full pl-11 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs font-mono font-bold focus:border-amber-400 outline-none"
                                  placeholder="10-digit mobile number"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions Footer - Pinned and always visible */}
              <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900 shrink-0 flex items-center justify-end gap-3 z-10">
                {modalMode === 'edit' && editingAppId && onOpenCmsStudio && (
                  <button
                    type="button"
                    onClick={() => {
                      const appToOpen = apps.find((a) => a.id === editingAppId);
                      setEditModalOpen(false);
                      if (appToOpen) onOpenCmsStudio(appToOpen);
                    }}
                    className="mr-auto px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                    title="Customize visual logo, colors, slogans and manifesto"
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>Open Visual Brand Studio</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-lg shadow-amber-400/20 transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {saving
                    ? (modalMode === 'edit' ? 'Saving Changes...' : 'Creating Application...')
                    : (modalMode === 'edit' ? 'Save Party Architecture' : 'Create & Provision Tenant')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
