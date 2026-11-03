import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  AlertTriangle,
  Video,
  ListTodo,
  Users,
  FileText,
  UserCheck,
  BarChart3,
  Megaphone,
  LogOut,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Send,
  RefreshCw,
  X,
  Search,
  Filter,
  Download,
  Check,
  Play,
  Clock,
  Building,
  Layers,
  MapPin,
  Vote,
  Menu,
  Eye,
  Sliders,
  TrendingUp,
  UserPlus
} from 'lucide-react';
import { UserSession, Voter, VoterTask, GroundReport } from '../types';
import { useCms } from '../context/CmsContext';
import { useNotification } from '../context/NotificationContext';
import { fetchStateAnalytics, HierarchyAnalyticsResponse } from '../lib/api/analytics.api';
import { fetchTasks, createTask, updateTaskStatus, deleteTask } from '../lib/api/tasks.api';
import { fetchGroundReports } from '../lib/api/reports.api';
import { fetchVoters, updateVoter, bulkImportVoters } from '../lib/api/voters.api';
import { fetchTrainingVideos, deleteTrainingVideo } from '../lib/api/training.api';
import { fetchApplicationIncharges, InchargeRecord } from '../lib/api/applications.api';
import { fetchCadrePerformance } from '../lib/api/cadre.api';
import { apiFetch } from '../lib/api/client';
import CadrePulseWidget from './common/CadrePulseWidget';
import ActiveSessionsModal from './common/ActiveSessionsModal';

export type PartyAdminTabType =
  | 'dashboard'
  | 'fake_votes'
  | 'training'
  | 'tasks'
  | 'cadre_network'
  | 'ground_reports'
  | 'voters'
  | 'caste_analytics'
  | 'announcements';

const PARTY_ADMIN_TAB_TO_PATH: Record<PartyAdminTabType, string> = {
  dashboard: '/party-admin',
  fake_votes: '/party-admin/fake-votes',
  training: '/party-admin/training',
  tasks: '/party-admin/tasks',
  cadre_network: '/party-admin/cadre',
  ground_reports: '/party-admin/reports',
  voters: '/party-admin/voters',
  caste_analytics: '/party-admin/caste',
  announcements: '/party-admin/announcements',
};

const PARTY_ADMIN_PATH_TO_TAB: Record<string, PartyAdminTabType> = {
  '': 'dashboard',
  dashboard: 'dashboard',
  fake_votes: 'fake_votes',
  'fake-votes': 'fake_votes',
  training: 'training',
  tasks: 'tasks',
  cadre_network: 'cadre_network',
  cadre: 'cadre_network',
  ground_reports: 'ground_reports',
  reports: 'ground_reports',
  voters: 'voters',
  caste_analytics: 'caste_analytics',
  caste: 'caste_analytics',
  announcements: 'announcements',
};

interface PartyAdminDashboardProps {
  session: UserSession;
  onLogout: () => void;
}

interface TrainingVideoItem {
  id: string;
  title: string;
  videoUrl: string;
  category: string;
  duration?: string;
  targetTier?: string;
  description?: string;
  createdAt?: string;
}

interface FakeVoterItem {
  id: string;
  name: string;
  epicNumber: string;
  age: number;
  gender: string;
  boothNumber: string;
  mandalName: string;
  villageName: string;
  reason: string;
  evidenceUrl?: string;
  flaggedBy: string;
  flaggedAt: string;
  status: 'FLAGGED' | 'VERIFIED_FAKE' | 'DISMISSED';
  resolutionNotes?: string;
}

export default function PartyAdminDashboard({ session, onLogout }: PartyAdminDashboardProps) {
  const { config, parties } = useCms();
  const { notify, confirmDialog } = useNotification();
  const location = useLocation();
  const navigate = useNavigate();

  const subPath = location.pathname.replace(/^\/party-admin\/?/, '').split('/')[0] || '';
  const isKnownSubPath = subPath === '' || subPath in PARTY_ADMIN_PATH_TO_TAB;
  const activeTab: PartyAdminTabType = isKnownSubPath ? (PARTY_ADMIN_PATH_TO_TAB[subPath] || 'dashboard') : 'dashboard';

  useEffect(() => {
    if (!isKnownSubPath) {
      navigate('/party-admin', { replace: true });
    }
  }, [isKnownSubPath, navigate]);

  const setActiveTab = (tab: PartyAdminTabType) => {
    navigate(PARTY_ADMIN_TAB_TO_PATH[tab]);
    setIsSidebarOpen(false);
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSessionsModalOpen, setIsSessionsModalOpen] = useState(false);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  // 1. Live Analytics / Telemetry from PostgreSQL
  const [analytics, setAnalytics] = useState<HierarchyAnalyticsResponse | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // 2. Live Training Videos from PostgreSQL
  const [videos, setVideos] = useState<TrainingVideoItem[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [videoSuccessMsg, setVideoSuccessMsg] = useState('');
  const [videoErrorMsg, setVideoErrorMsg] = useState('');
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCategory, setNewCategory] = useState('CAMPAIGN');
  const [newTargetTier, setNewTargetTier] = useState('ALL');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmittingVideo, setIsSubmittingVideo] = useState(false);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

  // 3. Live Directives / Tasks from PostgreSQL
  const [directives, setDirectives] = useState<VoterTask[]>([]);
  const [isLoadingDirectives, setIsLoadingDirectives] = useState(false);
  const [deletingDirectiveId, setDeletingDirectiveId] = useState<string | null>(null);
  const [newDirectiveTitle, setNewDirectiveTitle] = useState('');
  const [newDirectiveInstructions, setNewDirectiveInstructions] = useState('');
  const [newDirectivePriority, setNewDirectivePriority] = useState<'High' | 'Urgent' | 'Medium'>('High');
  const [newDirectiveTargetTier, setNewDirectiveTargetTier] = useState('MANDAL');
  const [newDirectiveDueDate, setNewDirectiveDueDate] = useState('');
  const [isSubmittingDirective, setIsSubmittingDirective] = useState(false);
  const [directiveSuccessMsg, setDirectiveSuccessMsg] = useState('');

  // Dynamic hierarchy mapping for directives & training
  const DEFAULT_HIERARCHY_TIER_LABELS: Record<string, string> = {
    STATE: 'State HQ',
    ZONE: 'Zone HQ',
    PARLIAMENT: 'Parliament Command',
    DISTRICT: 'District Unit',
    CONSTITUENCY: 'Constituency Command',
    MANDAL: 'Mandal Incharge Tier',
    VILLAGE: 'Village Incharge Tier',
    BOOTH: 'Polling Booth Incharges',
    VOTER_GROUP: '100-Voter Cluster Committee',
  };

  const availableDirectiveTiers = useMemo(() => {
    const active = config.activeHierarchyLevels && config.activeHierarchyLevels.length > 0
      ? config.activeHierarchyLevels.filter(lvl => lvl !== 'PARTY_ADMIN')
      : ['CONSTITUENCY', 'MANDAL', 'VILLAGE', 'BOOTH', 'VOTER_GROUP'];

    const standardOrder = ['STATE', 'ZONE', 'PARLIAMENT', 'DISTRICT', 'CONSTITUENCY', 'MANDAL', 'VILLAGE', 'BOOTH', 'VOTER_GROUP'];
    return [...active].sort((a, b) => {
      const idxA = standardOrder.indexOf(a);
      const idxB = standardOrder.indexOf(b);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });
  }, [config.activeHierarchyLevels]);

  useEffect(() => {
    if (availableDirectiveTiers.length > 0 && !availableDirectiveTiers.includes(newDirectiveTargetTier)) {
      setNewDirectiveTargetTier(availableDirectiveTiers[0]);
    }
  }, [availableDirectiveTiers, newDirectiveTargetTier]);

  // 4. Live Fake Votes Audit from PostgreSQL
  const [fakeVoters, setFakeVoters] = useState<FakeVoterItem[]>([]);
  const [isLoadingFakeVoters, setIsLoadingFakeVoters] = useState(false);
  const [fakeFilterStatus, setFakeFilterStatus] = useState<string>('ALL');
  const [fakeSearchTerm, setFakeSearchTerm] = useState('');
  const [selectedFakeVoter, setSelectedFakeVoter] = useState<FakeVoterItem | null>(null);
  const [adjudicationNotes, setAdjudicationNotes] = useState('');
  const [isAdjudicating, setIsAdjudicating] = useState(false);
  const [adjudicationSuccess, setAdjudicationSuccess] = useState('');

  // 5. Live Ground Reports from PostgreSQL
  const [groundReports, setGroundReports] = useState<GroundReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [reportFilterStatus, setReportFilterStatus] = useState<string>('ALL');

  // 6. Live Cadre Incharges from PostgreSQL
  const [inchargesList, setInchargesList] = useState<InchargeRecord[]>([]);
  const [isLoadingCadre, setIsLoadingCadre] = useState(false);
  const [cadrePerformanceScore, setCadrePerformanceScore] = useState<number | null>(null);

  // 7. Live Electoral Roll Master from PostgreSQL
  const [votersList, setVotersList] = useState<Voter[]>([]);
  const [votersTotal, setVotersTotal] = useState(0);
  const [voterPage, setVoterPage] = useState(1);
  const [voterSearch, setVoterSearch] = useState('');
  const [voterFilterPref, setVoterFilterPref] = useState('ALL');
  const [isLoadingVoters, setIsLoadingVoters] = useState(false);

  // 8. Live Announcements from PostgreSQL
  const [announcements, setAnnouncements] = useState<Array<{ id: string; title: string; content: string; priority: string; createdAt: string }>>([]);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(false);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [isSubmittingAnn, setIsSubmittingAnn] = useState(false);
  const [annSuccessMsg, setAnnSuccessMsg] = useState('');

  // =========================================================================
  // DATA LOADERS CONNECTED DIRECTLY TO POSTGRESQL & FASTIFY APIS
  // =========================================================================

  // A. Load Real Analytics (Telemetry, Voters Count, Preferences, Caste)
  const loadAnalytics = async () => {
    setIsLoadingAnalytics(true);
    try {
      const data = await fetchStateAnalytics();
      setAnalytics(data);
    } catch (err: any) {
      console.warn('Analytics API notice:', err.message);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  // B. Load Real Tasks / Directives
  const loadDirectives = async () => {
    setIsLoadingDirectives(true);
    try {
      const items = await fetchTasks();
      if (Array.isArray(items)) {
        setDirectives(items);
      }
    } catch (err: any) {
      console.warn('Directives API notice:', err.message);
    } finally {
      setIsLoadingDirectives(false);
    }
  };

  // C. Load Real Flagged / Doubtful Voters from DB
  const loadFakeVoters = async () => {
    setIsLoadingFakeVoters(true);
    try {
      // Query real voters flagged as FAKE or DOUBTFUL
      const [fakeRes, doubtfulRes] = await Promise.all([
        fetchVoters({ voterStatus: 'FAKE' as any, limit: 100 }),
        fetchVoters({ voterStatus: 'DOUBTFUL' as any, limit: 100 })
      ]);

      const combined = [...(fakeRes?.items || []), ...(doubtfulRes?.items || [])];
      const mapped: FakeVoterItem[] = combined.map((v) => ({
        id: v.id,
        name: v.name,
        epicNumber: v.epicNumber,
        age: v.age,
        gender: v.gender,
        boothNumber: v.boothNumber ? `Booth ${v.boothNumber}` : ((v as any).booth?.name || 'Assigned Booth'),
        mandalName: (v as any).mandal?.name || (v as any).mandal || (v as any).mandalName || 'Constituency Mandal',
        villageName: (v as any).village?.name || (v as any).village || (v as any).villageName || 'Village Ward',
        reason: (v as any).notes || (v.voterStatus === 'Fake' ? 'Flagged as Duplicate or Invalid by Field Incharge' : 'Doubtful physical residency'),
        evidenceUrl: (v as any).evidenceUrl || '',
        flaggedBy: (v as any).flaggedBy?.name || 'Field Incharge',
        flaggedAt: (v as any).updatedAt || v.lastUpdated || 'Recent',
        status: v.voterStatus === 'Fake' ? 'VERIFIED_FAKE' : 'FLAGGED',
        resolutionNotes: (v as any).resolutionNotes || ''
      }));

      setFakeVoters(mapped);
    } catch (err: any) {
      console.warn('Fake voters API notice:', err.message);
    } finally {
      setIsLoadingFakeVoters(false);
    }
  };

  // D. Load Real Training Videos
  const loadVideos = async () => {
    setIsLoadingVideos(true);
    setVideoErrorMsg('');
    try {
      const data = await fetchTrainingVideos();
      if (Array.isArray(data)) {
        setVideos(data as any);
      }
    } catch (err: any) {
      console.warn('Videos API notice:', err.message);
    } finally {
      setIsLoadingVideos(false);
    }
  };

  // E. Load Real Ground Reports
  const loadGroundReports = async () => {
    setIsLoadingReports(true);
    try {
      const items = await fetchGroundReports();
      if (Array.isArray(items)) {
        setGroundReports(items);
      }
    } catch (err: any) {
      console.warn('Ground reports API notice:', err.message);
    } finally {
      setIsLoadingReports(false);
    }
  };

  // F. Load Real Incharges & Cadre Roster from CMS Config / DB
  const loadCadre = async () => {
    setIsLoadingCadre(true);
    try {
      const appId = config.id || (session as any).applicationId || 'default';
      const [incharges, perf] = await Promise.all([
        fetchApplicationIncharges(appId).catch(() => []),
        fetchCadrePerformance().catch(() => null),
      ]);
      if (Array.isArray(incharges) && incharges.length > 0) {
        setInchargesList(incharges);
      } else if ((config as any).tierIncharges && Array.isArray((config as any).tierIncharges)) {
        setInchargesList((config as any).tierIncharges as any);
      }
      if (perf?.averageScore !== undefined && perf.averageScore !== null) {
        setCadrePerformanceScore(Math.round(perf.averageScore));
      }
    } catch (err: any) {
      if ((config as any).tierIncharges && Array.isArray((config as any).tierIncharges)) {
        setInchargesList((config as any).tierIncharges as any);
      }
    } finally {
      setIsLoadingCadre(false);
    }
  };

  // G. Load Real Voters with Server Pagination & Filters
  const loadVoters = async () => {
    setIsLoadingVoters(true);
    try {
      const res = await fetchVoters({
        page: voterPage,
        limit: 20,
        search: voterSearch.trim() || undefined,
        politicalPreference: voterFilterPref === 'ALL' ? undefined : (voterFilterPref as any)
      });
      if (res && res.items) {
        setVotersList(res.items);
        setVotersTotal(res.total || 0);
      }
    } catch (err: any) {
      console.warn('Voters master API notice:', err.message);
    } finally {
      setIsLoadingVoters(false);
    }
  };

  const handleFastBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(Boolean);
      if (lines.length <= 1) {
        notify.error('File must contain a header and at least one voter row', 'Invalid File');
        return;
      }
      const headers = lines[0].split(',').map((h) => h.trim());
      const rows = lines.slice(1).map((l) => {
        const vals = l.split(',').map((v) => v.trim());
        const obj: any = {};
        headers.forEach((h, i) => {
          obj[h] = vals[i] || '';
        });
        return obj;
      });
      const constituencyId = (session as any).assignedConstituencyId || config.id || 'default';
      await bulkImportVoters(constituencyId, rows, { importMode: 'APPEND' });
      notify.success(`Imported ${rows.length} voter records successfully!`, 'Batch Ingest Complete');
      await loadVoters();
    } catch (err: any) {
      notify.error(err.message || 'Bulk import failed', 'Ingest Error');
    }
  };

  // H. Load Real Announcements from DB
  const loadAnnouncements = async () => {
    setIsLoadingAnnouncements(true);
    try {
      const res = await apiFetch<any>('/api/notifications/announcements');
      if (Array.isArray(res)) {
        setAnnouncements(res);
      } else if (res && Array.isArray(res.data)) {
        setAnnouncements(res.data);
      }
    } catch (err: any) {
      console.warn('Announcements API notice:', err.message);
    } finally {
      setIsLoadingAnnouncements(false);
    }
  };

  // Initial Load on Mount
  useEffect(() => {
    loadAnalytics();
    loadDirectives();
    loadFakeVoters();
    loadVideos();
    loadGroundReports();
    loadCadre();
    loadAnnouncements();
  }, [config.id]);

  useEffect(() => {
    loadVoters();
  }, [voterPage, voterFilterPref]);

  const handleRefreshAll = async () => {
    setIsRefreshingAll(true);
    await Promise.all([
      loadAnalytics(),
      loadDirectives(),
      loadFakeVoters(),
      loadVideos(),
      loadGroundReports(),
      loadCadre(),
      loadVoters(),
      loadAnnouncements()
    ]);
    setIsRefreshingAll(false);
  };

  // =========================================================================
  // REAL MUTATION HANDLERS (PERSIST TO POSTGRESQL)
  // =========================================================================

  // 1. Publish Video to DB
  const handlePublishVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;

    setIsSubmittingVideo(true);
    setVideoSuccessMsg('');
    setVideoErrorMsg('');

    try {
      await apiFetch<any>('/api/training/videos', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle.trim(),
          videoUrl: newUrl.trim(),
          category: newCategory,
          duration: '10:00',
          description: newDescription.trim() || `Target: ${newTargetTier}`,
        }),
      });

      setVideoSuccessMsg('Training video published successfully to cadre network!');
      notify.success('Training video published successfully to cadre network!', 'Module Published');
      setNewTitle('');
      setNewUrl('');
      setNewDescription('');
      await loadVideos();
    } catch (err: any) {
      setVideoErrorMsg(err.message || 'Failed to publish video.');
      notify.error(err.message || 'Failed to publish video.', 'Publish Failed');
    } finally {
      setIsSubmittingVideo(false);
    }
  };

  // Delete Video from DB
  const handleDeleteVideo = async (videoId: string, title: string) => {
    const confirmed = await confirmDialog({
      title: 'Delete Training Module',
      message: `Are you sure you want to delete module "${title}" from the PostgreSQL library? This will remove the module from the cadre network.`,
      confirmText: 'Delete Module',
      cancelText: 'Cancel',
      danger: true,
      icon: 'trash',
    });
    if (!confirmed) return;

    setDeletingVideoId(videoId);
    setVideoSuccessMsg('');
    setVideoErrorMsg('');
    try {
      await deleteTrainingVideo(videoId);
      setVideoSuccessMsg(`Module "${title}" deleted successfully.`);
      notify.success(`Module "${title}" deleted successfully from PostgreSQL library.`, 'Module Deleted');
      await loadVideos();
    } catch (err: any) {
      setVideoErrorMsg(err.message || 'Failed to delete training module.');
      notify.error(err.message || 'Failed to delete training module.', 'Deletion Error');
    } finally {
      setDeletingVideoId(null);
    }
  };

  // 2. Dispatch Directive to DB (POST /api/tasks)
  const handleCreateDirective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDirectiveTitle.trim()) return;

    setIsSubmittingDirective(true);
    setDirectiveSuccessMsg('');

    try {
      await createTask({
        title: newDirectiveTitle.trim(),
        instructions: newDirectiveInstructions.trim(),
        priority: newDirectivePriority.toUpperCase() as any,
        dueDate: newDirectiveDueDate ? new Date(newDirectiveDueDate).toISOString() : undefined,
        targetLevel: newDirectiveTargetTier as any,
        targetHierarchyLevel: newDirectiveTargetTier,
      } as any);

      setDirectiveSuccessMsg('Operational directive dispatched to cadre network and saved in database!');
      notify.success('Operational directive dispatched to cadre network and saved in database!', 'Directive Dispatched');
      setNewDirectiveTitle('');
      setNewDirectiveInstructions('');
      setNewDirectiveDueDate('');
      await loadDirectives();
    } catch (err: any) {
      console.error('Directive dispatch error:', err);
      notify.error(err.message || 'Failed to dispatch directive.', 'Dispatch Error');
    } finally {
      setIsSubmittingDirective(false);
    }
  };

  // Delete Directive from DB
  const handleDeleteDirective = async (directiveId: string, title: string) => {
    const confirmed = await confirmDialog({
      title: 'Delete Operational Directive',
      message: `Are you sure you want to delete directive "${title}" from the database? This action will permanently remove the directive for assigned field cadres.`,
      confirmText: 'Delete Directive',
      cancelText: 'Cancel',
      danger: true,
      icon: 'trash',
    });
    if (!confirmed) return;

    setDeletingDirectiveId(directiveId);
    setDirectiveSuccessMsg('');
    try {
      await deleteTask(directiveId);
      setDirectiveSuccessMsg(`Directive "${title}" deleted successfully.`);
      notify.success(`Directive "${title}" deleted successfully from database.`, 'Directive Deleted');
      await loadDirectives();
    } catch (err: any) {
      console.error('Directive deletion error:', err);
      notify.error(err.message || 'Failed to delete directive.', 'Deletion Error');
    } finally {
      setDeletingDirectiveId(null);
    }
  };

  // 3. Adjudicate Fake Voter in DB (PATCH /api/voters/:id/status)
  const handleSaveAdjudication = async (newStatus: 'VERIFIED_FAKE' | 'DISMISSED') => {
    if (!selectedFakeVoter) return;
    setIsAdjudicating(true);
    setAdjudicationSuccess('');

    try {
      const targetVoterStatus = newStatus === 'VERIFIED_FAKE' ? 'FAKE' : 'ACTIVE';
      await updateVoter(selectedFakeVoter.id, {
        voterStatus: targetVoterStatus as any,
        notes: adjudicationNotes.trim() || `Adjudicated as ${newStatus} by Party Legal Cell`
      } as any);

      notify.success(`Voter status updated in database to ${targetVoterStatus}!`, 'Adjudication Complete');
      setAdjudicationSuccess(`Voter status updated in PostgreSQL database to ${targetVoterStatus}!`);
      setTimeout(() => {
        setAdjudicationSuccess('');
        setSelectedFakeVoter(null);
        setAdjudicationNotes('');
      }, 1500);

      await Promise.all([loadFakeVoters(), loadAnalytics()]);
    } catch (err: any) {
      console.error('Adjudication update error:', err);
      notify.error(err.message || 'Failed to update adjudication status.', 'Adjudication Error');
    } finally {
      setIsAdjudicating(false);
    }
  };

  // 4. Resolve Ground Report in DB (PATCH /api/reports/ground/:id/status)
  const handleResolveGroundReport = async (reportId: string) => {
    try {
      await apiFetch(`/api/reports/ground/${reportId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'RESOLVED', resolutionNotes: 'Reviewed & resolved by Party Admin HQ' })
      });
      await loadGroundReports();
    } catch (err: any) {
      console.error('Resolve report error:', err);
    }
  };

  // 5. Post Announcement to DB (POST /api/notifications/announcements)
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnContent.trim()) return;

    setIsSubmittingAnn(true);
    setAnnSuccessMsg('');

    try {
      await apiFetch('/api/notifications/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title: newAnnTitle.trim(),
          content: newAnnContent.trim(),
          priority: 'HIGH'
        })
      });

      setAnnSuccessMsg('Announcement broadcast saved in PostgreSQL and published!');
      setNewAnnTitle('');
      setNewAnnContent('');
      await loadAnnouncements();
    } catch (err: any) {
      console.error('Announcement create error:', err);
    } finally {
      setIsSubmittingAnn(false);
    }
  };

  // 6. Delete Announcement in DB
  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await apiFetch(`/api/notifications/announcements/${id}`, { method: 'DELETE' });
      await loadAnnouncements();
    } catch (err: any) {
      console.error('Delete announcement error:', err);
    }
  };

  // Export Fake Votes CSV
  const handleExportFakeDossier = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Name,EPIC Number,Age,Gender,Booth,Mandal,Village,Flagged Reason,Status,Flagged At\n"
      + fakeVoters.map(v => `"${v.name}","${v.epicNumber}",${v.age},"${v.gender}","${v.boothNumber}","${v.mandalName}","${v.villageName}","${v.reason}","${v.status}","${v.flaggedAt}"`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Live_Fake_Voters_Dossier_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Fake Voters
  const filteredFakeVoters = useMemo(() => {
    return fakeVoters.filter(v => {
      const matchStatus = fakeFilterStatus === 'ALL' || v.status === fakeFilterStatus;
      const matchSearch = !fakeSearchTerm.trim() || 
        v.name.toLowerCase().includes(fakeSearchTerm.toLowerCase()) || 
        v.epicNumber.toLowerCase().includes(fakeSearchTerm.toLowerCase()) ||
        v.boothNumber.toLowerCase().includes(fakeSearchTerm.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [fakeVoters, fakeFilterStatus, fakeSearchTerm]);

  // Active Parties Telemetry derived dynamically from CMS Studio & Analytics
  const activePartiesList = useMemo(() => {
    const list: Array<{ name: string; code: string; primaryColor?: string }> = [];
    const seenCodes = new Set<string>();

    const primaryCode = config?.activePartyCode || 'SDS';
    const primaryName = config?.organisationName || config?.headerTitle || 'SDS Party';
    const primaryColor = config?.primaryColor || '#a31de2';

    list.push({
      name: primaryName,
      code: primaryCode,
      primaryColor,
    });
    seenCodes.add(primaryCode);

    if (parties && parties.length > 0) {
      for (const p of parties) {
        if (p.isActive && !seenCodes.has(p.code)) {
          seenCodes.add(p.code);
          list.push({
            name: p.name || p.code,
            code: p.code,
            primaryColor: p.primaryColor || '#94a3b8',
          });
        }
      }
    }

    return list;
  }, [parties, config]);

  // Real Counts from PostgreSQL
  const totalElectorateCount = (analytics?.summary?.totalVoters && analytics.summary.totalVoters > 0)
    ? analytics.summary.totalVoters
    : ((votersTotal && votersTotal > 0) ? votersTotal : 0);
  const realPartyPreferences = analytics?.partyPreference || {};
  const neutralVotesCount = realPartyPreferences['NEUTRAL'] || realPartyPreferences['Neutral'] || 0;
  const casteDistribution = analytics?.demographics?.caste || {};

  return (
    <div className="w-full h-screen overflow-hidden flex flex-col md:flex-row bg-slate-50 text-slate-800" id="party-admin-container">

      {/* --------------------------------------------------------
          LEFT NAVIGATION SIDEBAR (Standard VIAP Dark Navy)
         -------------------------------------------------------- */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white p-5 flex flex-col justify-between shrink-0 h-screen overflow-hidden transition-transform duration-300 md:fixed md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        id="party-admin-sidebar"
      >
        <div className="space-y-6 overflow-y-auto max-h-[85vh] no-scrollbar">
          {/* Brand Logo & Organization Name */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              {config.logoUrl ? (
                <img src={config.logoUrl} alt="Logo" className="w-9 h-9 rounded-xl object-cover shadow-md border border-slate-700" />
              ) : (
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-950 font-black shadow-md shadow-yellow-400/10"
                  style={{ backgroundColor: config.primaryColor || '#EAB308' }}
                >
                  {(config.organisationName || session.organisationName || 'P').slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-sm font-black tracking-tight uppercase" style={{ color: config.primaryColor || '#FACC15' }}>
                  {config.organisationName || session.organisationName || 'Political Connect'}
                </h1>
                <p className="text-[9px] font-black tracking-widest uppercase text-slate-400">Party Apex Command</p>
              </div>
            </div>

            {/* Mobile close menu */}
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Connected User Profile Card */}
          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400 font-extrabold shrink-0 text-xs">
              PA
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-black text-slate-100 truncate uppercase">{session.userName || 'Party Admin HQ'}</h4>
              <p className="text-[9px] text-amber-400 font-bold truncate tracking-wide">PARTY ADMINISTRATOR (HQ)</p>
              <div className="text-[8px] text-slate-300 font-semibold mt-1 uppercase space-y-0.5">
                <p className="truncate">Jurisdiction: <span className="text-slate-100 font-bold">Central Party Command</span></p>
                <p className="truncate">Database: <span className="text-emerald-400 font-bold">PostgreSQL Live</span></p>
              </div>
              <div className="flex items-center gap-1 mt-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[8px] text-slate-400 font-black tracking-widest uppercase font-mono">
                  ID: {session.userId?.slice(-8).toUpperCase() || 'HQ-LEADER'}
                </span>
              </div>
            </div>
          </div>

          {/* Main Navigation Menu */}
          <nav className="space-y-1">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">Main Navigation</p>
            {[
              { id: 'dashboard', name: 'Dashboard', icon: Home },
              { id: 'fake_votes', name: 'Fake Votes Audit', icon: AlertTriangle, badge: fakeVoters.filter(v => v.status === 'FLAGGED').length },
              { id: 'training', name: 'Training Studio', icon: Video, badge: videos.length || undefined },
              { id: 'tasks', name: 'High Command Tasks', icon: ListTodo, badge: directives.filter(d => (d as any).status !== 'COMPLETED' && (d as any).status !== 'CANCELLED').length },
              { id: 'cadre_network', name: 'Cadre Network', icon: Users, badge: inchargesList.length || undefined },
              { id: 'ground_reports', name: 'Ground Reports', icon: FileText, badge: groundReports.filter(r => (r as any).status === 'PENDING').length },
              { id: 'voters', name: 'Electoral Roll Master', icon: UserCheck },
              { id: 'caste_analytics', name: 'Caste Analytics', icon: BarChart3 },
              { id: 'announcements', name: 'Broadcast Ticker', icon: Megaphone }
            ].map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as PartyAdminTabType)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-400/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                      isActive ? 'bg-slate-950 text-amber-400' : 'bg-red-500 text-white'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Fixed Sign Out & Sessions */}
        <div className="pt-4 border-t border-slate-800 bg-slate-900 shrink-0 space-y-2">
          <button
            type="button"
            onClick={() => setIsSessionsModalOpen(true)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-amber-400" />
              Active Sessions
            </span>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-between px-4 py-3 bg-red-950/40 hover:bg-red-900/60 border border-red-900/30 text-red-400 hover:text-white rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <LogOut className="w-4 h-4 shrink-0 text-red-500" />
              Sign Out Portal
            </span>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>
        </div>
      </aside>

      {/* Active Device Sessions Modal */}
      <ActiveSessionsModal
        isOpen={isSessionsModalOpen}
        onClose={() => setIsSessionsModalOpen(false)}
      />

      {/* --------------------------------------------------------
          MAIN SCROLLABLE WORKSPACE
         -------------------------------------------------------- */}
      <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden bg-slate-50 relative md:pl-64">

        {/* Mobile Top Navigation Header */}
        <div className="md:hidden flex items-center justify-between p-4 bg-slate-900 text-white sticky top-0 z-30 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs font-black tracking-tight uppercase" style={{ color: config.primaryColor || '#FACC15' }}>
              {config.organisationName || session.organisationName || 'Party Admin'}
            </span>
          </div>
          <span className="text-[10px] font-mono bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded font-black">
            HQ APEX
          </span>
        </div>

        <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">

          {/* Top Operational Header Card */}
          <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-md bg-amber-400 text-slate-950 inline-block mb-1 tracking-wider">
                Party Apex Command
              </span>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Party Operations & Central Governance Cockpit
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {config.organisationName || session.organisationName || 'Party Administration'} • Independent Party Directives, Training Media & Legal Cadre War Room
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefreshAll}
                disabled={isRefreshingAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingAll ? 'animate-spin' : ''}`} />
                <span>Sync DB</span>
              </button>
              <span className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Postgres: Live
              </span>
            </div>
          </div>

          {/* 4 High-Contrast KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-black">Total Electorate</p>
              <h3 className="text-2xl font-black text-slate-950 mt-1">
                {totalElectorateCount.toLocaleString()}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">Postgres Scoped Aggregate</p>
            </div>
            <div className="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-black">Active Tiers</p>
              <h3 className="text-2xl font-black text-amber-500 mt-1">
                {config.activeHierarchyLevels?.length || 10} Levels
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">From State HQ to 100-Voter</p>
            </div>
            <div className="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-black">Open Directives</p>
              <h3 className="text-2xl font-black text-blue-600 mt-1">
                {directives.filter(d => (d as any).status !== 'COMPLETED' && (d as any).status !== 'CANCELLED').length} Active
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">Dispatched in database</p>
            </div>
            <div className="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-black">Fake Votes Audit</p>
              <h3 className="text-2xl font-black text-red-600 mt-1">
                {fakeVoters.filter(v => v.status === 'FLAGGED').length} Pending
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">Live flags in database</p>
            </div>
          </div>

          {/* Dynamic Preference Breakdown Banner (Real PostgreSQL Counts) */}
          <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Live Telemetry & Projections</span>
                <h3 className="text-sm font-black text-slate-900 uppercase">Party Political Preference Distribution</h3>
              </div>
              <span className="text-xs font-bold text-slate-400">Queried dynamically from PostgreSQL database</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
              {activePartiesList.map((p) => {
                const count = realPartyPreferences[p.code] || 0;
                const pct = totalElectorateCount > 0 ? ((count / totalElectorateCount) * 100).toFixed(1) : '0.0';
                return (
                  <div key={p.code} className="p-3 rounded-xl border border-gray-100 bg-slate-50/60">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.primaryColor || '#94a3b8' }}></span>
                      <span className="text-xs font-black text-slate-800">{p.code}</span>
                    </div>
                    <h4 className="text-lg font-black text-slate-900 mt-1">{count.toLocaleString()}</h4>
                    <p className="text-[10px] text-slate-400 font-semibold">{pct}% of Electorate</p>
                  </div>
                );
              })}
              <div className="p-3 rounded-xl border border-gray-100 bg-slate-50/60">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                  <span className="text-xs font-black text-slate-800">Neutral</span>
                </div>
                <h4 className="text-lg font-black text-slate-900 mt-1">{neutralVotesCount.toLocaleString()}</h4>
                <p className="text-[10px] text-slate-400 font-semibold">
                  {totalElectorateCount > 0 ? ((neutralVotesCount / totalElectorateCount) * 100).toFixed(1) : '0.0'}% Sample
                </p>
              </div>
            </div>
          </div>

          {/* --------------------------------------------------------
              TAB 1: DASHBOARD / APEX WAR ROOM
             -------------------------------------------------------- */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Quick Jump Action Station */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  onClick={() => setActiveTab('tasks')}
                  className="p-4 bg-white border border-gray-200/80 hover:border-amber-400/50 rounded-2xl shadow-sm text-left group transition-all cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-400/10 text-amber-500 flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform">
                    <ListTodo className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-black text-slate-900">Dispatch Directive</h4>
                  <p className="text-xs text-slate-500 mt-1">Assign operational tasks to Mandal, Village or Booth incharges.</p>
                </button>

                <button
                  onClick={() => setActiveTab('training')}
                  className="p-4 bg-white border border-gray-200/80 hover:border-blue-400/50 rounded-2xl shadow-sm text-left group transition-all cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform">
                    <Video className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-black text-slate-900">Training Studio</h4>
                  <p className="text-xs text-slate-500 mt-1">Upload and distribute video briefings to cadre tiers.</p>
                </button>

                <button
                  onClick={() => setActiveTab('fake_votes')}
                  className="p-4 bg-white border border-gray-200/80 hover:border-red-400/50 rounded-2xl shadow-sm text-left group transition-all cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-black text-slate-900">Fake Votes Audit</h4>
                  <p className="text-xs text-slate-500 mt-1">Adjudicate voter flags & compile Election Commission dossiers.</p>
                </button>

                <button
                  onClick={() => setActiveTab('cadre_network')}
                  className="p-4 bg-white border border-gray-200/80 hover:border-emerald-400/50 rounded-2xl shadow-sm text-left group transition-all cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-black text-slate-900">Cadre Network</h4>
                  <p className="text-xs text-slate-500 mt-1">Inspect appointed leadership across all 10 hierarchy levels.</p>
                </button>
              </div>

              {/* Hierarchy Operational Readiness Matrix (Connected to CMS Config & DB Incharges) */}
              <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-base font-black text-slate-900">Hierarchy Operational Readiness</h3>
                    <p className="text-xs text-slate-500">Live deployment status across active party tiers</p>
                  </div>
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                    {config.activeHierarchyLevels?.length || 10} Tiers Configured
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {[
                    { level: 'State HQ', code: 'STATE', badge: 'L1' },
                    { level: 'Zone HQ', code: 'ZONE', badge: 'L2' },
                    { level: 'Parliament MP', code: 'PARLIAMENT', badge: 'L3' },
                    { level: 'Assembly MLA', code: 'CONSTITUENCY', badge: 'L5' },
                    { level: 'Mandal Block', code: 'MANDAL', badge: 'L6' },
                    { level: 'Village Ward', code: 'VILLAGE', badge: 'L7' },
                    { level: 'Polling Booth', code: 'BOOTH', badge: 'L8' },
                    { level: '100-Voter Unit', code: 'VOTER_GROUP', badge: 'L9' },
                    { level: 'District DCC', code: 'DISTRICT', badge: 'L4' },
                    { level: 'Party Admin HQ', code: 'PARTY_ADMIN', badge: 'L10' },
                  ].map((t) => {
                    const isConfigured = !config.activeHierarchyLevels || config.activeHierarchyLevels.includes(t.code);
                    const matchingIncharge = inchargesList.find(i => ((i as any).level || (i as any).tierLevel || (i as any).tier || i.role || i.jurisdictionType) === t.code);
                    const isDeployed = Boolean(matchingIncharge);

                    return (
                      <div key={t.code} className="p-3 rounded-xl border border-gray-100 bg-slate-50/70">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-black text-slate-400">{t.badge}: {t.code}</span>
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                            !isConfigured ? 'bg-slate-200 text-slate-600' :
                            isDeployed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {!isConfigured ? 'Inactive' : isDeployed ? 'Deployed' : 'Pending'}
                          </span>
                        </div>
                        <h5 className="text-xs font-black text-slate-800 mt-1">{t.level}</h5>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">
                          {matchingIncharge?.userName || (matchingIncharge as any)?.name || (isConfigured ? 'Pending Appointment' : 'Not Active in Scope')}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Directives & Fake Votes Summary Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Directives Tracker */}
                <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <ListTodo className="w-4 h-4 text-blue-600" />
                      Active Directives in PostgreSQL ({directives.length})
                    </h3>
                    <button
                      onClick={() => setActiveTab('tasks')}
                      className="text-xs text-amber-500 font-bold hover:underline"
                    >
                      View All
                    </button>
                  </div>
                  {directives.length === 0 ? (
                    <p className="text-center py-8 text-xs text-slate-400 font-medium">No operational directives dispatched yet. Create one from the Directives tab.</p>
                  ) : (
                    <div className="space-y-3">
                      {directives.slice(0, 3).map(d => {
                        const isOverdue = String(d.status).toUpperCase() !== 'COMPLETED' && Boolean(d.dueDate && new Date(d.dueDate) < new Date());
                        return (
                        <div key={d.id} className="p-3 rounded-xl border border-gray-100 bg-slate-50/60 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                d.priority === 'Urgent' || d.priority === 'High' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'
                              }`}>
                                {d.priority} Priority
                              </span>
                              {isOverdue && (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500 text-white animate-pulse">
                                  OVERDUE
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">Due: {d.dueDate ? String(d.dueDate).slice(0, 10) : 'Open'}</span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-800">{d.title}</h4>
                          <p className="text-[10px] text-slate-500 truncate">{d.instructions || 'Standard guidelines'}</p>
                        </div>
                      );})}
                    </div>
                  )}
                </div>

                {/* Flagged Fake Votes Widget */}
                <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      Flagged Fake Votes in Database ({fakeVoters.length})
                    </h3>
                    <button
                      onClick={() => setActiveTab('fake_votes')}
                      className="text-xs text-amber-500 font-bold hover:underline"
                    >
                      Audit Desk
                    </button>
                  </div>
                  {fakeVoters.length === 0 ? (
                    <p className="text-center py-8 text-xs text-slate-400 font-medium">No flagged fake voter records found in database.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {fakeVoters.slice(0, 3).map(fv => (
                        <div key={fv.id} className="p-3 rounded-xl border border-gray-100 bg-slate-50/60 flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h5 className="text-xs font-black text-slate-900">{fv.name}</h5>
                              <span className="text-[10px] font-mono text-amber-700 font-bold">{fv.epicNumber}</span>
                            </div>
                            <p className="text-[10px] text-slate-500">{fv.boothNumber} • {fv.villageName}</p>
                            <p className="text-[11px] text-slate-700 font-medium">{fv.reason}</p>
                          </div>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
                            fv.status === 'VERIFIED_FAKE' ? 'bg-red-100 text-red-700' :
                            fv.status === 'DISMISSED' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {fv.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cadre Pulse Polls Widget */}
                <CadrePulseWidget isAdmin={true} />
              </div>
            </div>
          )}

          {/* --------------------------------------------------------
              TAB 2: FAKE VOTES AUDIT & ADJUDICATION
             -------------------------------------------------------- */}
          {activeTab === 'fake_votes' && (
            <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    Fake Votes Legal Cell & Audit Desk
                  </h2>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Live voter records flagged in PostgreSQL for official deletion procedures and Form 7 submissions
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadFakeVoters}
                    disabled={isLoadingFakeVoters}
                    className="p-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600"
                    title="Refresh Fake Voters"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFakeVoters ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={handleExportFakeDossier}
                    className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Legal Dossier (CSV)
                  </button>
                </div>
              </div>

              {/* Status KPI Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl border border-red-100 bg-red-50/30">
                  <span className="text-[10px] font-black uppercase text-slate-400">Total Flagged in DB</span>
                  <h4 className="text-xl font-black text-red-600 mt-1">{fakeVoters.length}</h4>
                </div>
                <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/30">
                  <span className="text-[10px] font-black uppercase text-slate-400">Awaiting Adjudication</span>
                  <h4 className="text-xl font-black text-amber-600 mt-1">
                    {fakeVoters.filter(v => v.status === 'FLAGGED').length}
                  </h4>
                </div>
                <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/30">
                  <span className="text-[10px] font-black uppercase text-slate-400">Confirmed Fake (Form 7)</span>
                  <h4 className="text-xl font-black text-emerald-600 mt-1">
                    {fakeVoters.filter(v => v.status === 'VERIFIED_FAKE').length}
                  </h4>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[10px] font-black uppercase text-slate-400">Dismissed False Flags</span>
                  <h4 className="text-xl font-black text-slate-700 mt-1">
                    {fakeVoters.filter(v => v.status === 'DISMISSED').length}
                  </h4>
                </div>
              </div>

              {/* Filter and Search Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={fakeSearchTerm}
                    onChange={(e) => setFakeSearchTerm(e.target.value)}
                    placeholder="Search by Voter Name, EPIC, Booth..."
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-[11px] font-bold text-slate-500">Filter Status:</span>
                  <select
                    value={fakeFilterStatus}
                    onChange={(e) => setFakeFilterStatus(e.target.value)}
                    className="bg-white border border-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-amber-400"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="FLAGGED">Pending Audit</option>
                    <option value="VERIFIED_FAKE">Confirmed Fake</option>
                    <option value="DISMISSED">Dismissed</option>
                  </select>
                </div>
              </div>

              {/* Fake Voters Table */}
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 text-slate-500 border-b border-slate-200">
                      <th className="py-2.5 px-3 font-bold uppercase text-[10px]">Voter Name & Details</th>
                      <th className="py-2.5 px-3 font-bold uppercase text-[10px]">EPIC Number</th>
                      <th className="py-2.5 px-3 font-bold uppercase text-[10px]">Jurisdiction</th>
                      <th className="py-2.5 px-3 font-bold uppercase text-[10px]">Reason & Evidence</th>
                      <th className="py-2.5 px-3 font-bold uppercase text-[10px]">Audit Status</th>
                      <th className="py-2.5 px-3 font-bold uppercase text-[10px] text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredFakeVoters.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-400 font-semibold">
                          {isLoadingFakeVoters ? 'Loading live fake voter records...' : 'No fake voter records matching the selected filter in PostgreSQL.'}
                        </td>
                      </tr>
                    ) : (
                      filteredFakeVoters.map((fv) => (
                        <tr key={fv.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-3">
                            <p className="font-bold text-slate-900">{fv.name}</p>
                            <p className="text-[10px] text-slate-400">Age: {fv.age} • Gender: {fv.gender}</p>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-amber-700">
                            {fv.epicNumber}
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-semibold text-slate-800">{fv.boothNumber}</p>
                            <p className="text-[10px] text-slate-400">{fv.villageName}, {fv.mandalName}</p>
                          </td>
                          <td className="py-3 px-3 max-w-xs">
                            <p className="text-slate-800 text-[11px] font-semibold">{fv.reason}</p>
                            {fv.evidenceUrl && (
                              <a
                                href={fv.evidenceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 mt-0.5"
                              >
                                <ExternalLink className="w-3 h-3" /> View Evidence Attachment
                              </a>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                              fv.status === 'VERIFIED_FAKE' ? 'bg-red-100 text-red-700 border border-red-200' :
                              fv.status === 'DISMISSED' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}>
                              {fv.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedFakeVoter(fv);
                                setAdjudicationNotes(fv.resolutionNotes || '');
                              }}
                              className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-sm"
                            >
                              Adjudicate
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Adjudication Modal */}
              {selectedFakeVoter && (
                <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <div>
                        <h3 className="text-base font-black text-slate-900">Adjudicate Flagged Voter Record</h3>
                        <p className="text-xs text-slate-400">Official Decision written to PostgreSQL</p>
                      </div>
                      <button
                        onClick={() => setSelectedFakeVoter(null)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
                      <p><strong className="text-slate-900">Name:</strong> {selectedFakeVoter.name}</p>
                      <p><strong className="text-slate-900">EPIC Number:</strong> <span className="font-mono text-amber-700 font-bold">{selectedFakeVoter.epicNumber}</span></p>
                      <p><strong className="text-slate-900">Booth:</strong> {selectedFakeVoter.boothNumber}</p>
                      <p><strong className="text-slate-900">Reported Ground Reason:</strong> {selectedFakeVoter.reason}</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Legal Audit & Resolution Remarks</label>
                      <textarea
                        value={adjudicationNotes}
                        onChange={(e) => setAdjudicationNotes(e.target.value)}
                        placeholder="Add verification notes, death certificate reference, or Form 7 tracking number..."
                        className="w-full h-20 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    {adjudicationSuccess && (
                      <p className="text-xs font-bold text-emerald-600 bg-emerald-50 p-2 rounded-lg">
                        {adjudicationSuccess}
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                      <button
                        type="button"
                        disabled={isAdjudicating}
                        onClick={() => handleSaveAdjudication('DISMISSED')}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Dismiss as Valid Voter
                      </button>
                      <button
                        type="button"
                        disabled={isAdjudicating}
                        onClick={() => handleSaveAdjudication('VERIFIED_FAKE')}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm"
                      >
                        {isAdjudicating ? 'Updating DB...' : 'Confirm as Fake (File Form 7)'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --------------------------------------------------------
              TAB 3: TRAINING VIDEO STUDIO & DISTRIBUTION
             -------------------------------------------------------- */}
          {activeTab === 'training' && (
            <div className="space-y-6">
              {/* Creator Form */}
              <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <Video className="w-5 h-5 text-blue-600" />
                      Publish New Training Module
                    </h3>
                    <p className="text-xs text-slate-400">Ingest instructional video streams and publish to targeted incharge tiers</p>
                  </div>
                </div>

                {videoSuccessMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{videoSuccessMsg}</span>
                  </div>
                )}
                {videoErrorMsg && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs font-bold text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{videoErrorMsg}</span>
                  </div>
                )}

                <form onSubmit={handlePublishVideo} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Module Title *</label>
                      <input
                        type="text"
                        required
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g. Polling Booth Agent Readiness & EVM Verification"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Video / Stream URL (YouTube, Vimeo, MP4) *</label>
                      <input
                        type="url"
                        required
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Category</label>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400"
                      >
                        <option value="CAMPAIGN">Campaign & Canvassing</option>
                        <option value="BOOTHS">Booth Defense & Turnout</option>
                        <option value="EVM">EVM Mock Poll & Verification</option>
                        <option value="LEGAL">Legal Guidelines & Form 7/10</option>
                        <option value="VOTER_CLUSTER">Door-to-Door Voter Outreach</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Target Incharge Tier</label>
                      <select
                        value={newTargetTier}
                        onChange={(e) => setNewTargetTier(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400 font-bold"
                      >
                        <option value="ALL">All Hierarchy Tiers (Universal)</option>
                        {availableDirectiveTiers.map((tier) => (
                          <option key={tier} value={tier}>
                            {config.hierarchyLabels?.[tier] || DEFAULT_HIERARCHY_TIER_LABELS[tier] || tier} Only
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Brief Directive / Key Takeaways for Cadre</label>
                    <textarea
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Outline 3 key action items cadre must follow after watching this module..."
                      className="w-full h-18 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmittingVideo}
                      className="flex items-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isSubmittingVideo ? 'Publishing to DB...' : 'Publish to Cadre Network'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Published Videos List */}
              <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h3 className="text-base font-black text-slate-900">Published Modules in PostgreSQL Library ({videos.length})</h3>
                  <button
                    onClick={loadVideos}
                    disabled={isLoadingVideos}
                    className="flex items-center gap-1.5 text-xs text-slate-500 font-bold hover:text-slate-800"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingVideos ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                {videos.length === 0 ? (
                  <p className="text-center py-10 text-slate-400 text-xs font-semibold">No training videos published in PostgreSQL database yet. Publish your first module above!</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {videos.map(v => (
                      <div key={v.id} className="border border-slate-200/80 rounded-xl p-4 bg-slate-50/50 space-y-3 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                              {v.category || 'CAMPAIGN'}
                            </span>
                            <span className="text-[9px] font-mono font-bold text-slate-400">
                              {v.duration || '10:00'}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 leading-tight">{v.title}</h4>
                          <p className="text-[11px] text-slate-500 line-clamp-2">{v.description || 'Universal cadre training module'}</p>
                        </div>

                        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                          <button
                            onClick={() => setPreviewVideoUrl(v.videoUrl)}
                            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5" /> Watch Stream
                          </button>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-semibold">Postgres Sync</span>
                            <button
                              onClick={() => handleDeleteVideo(v.id, v.title)}
                              disabled={deletingVideoId === v.id}
                              title="Delete training module"
                              className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Video Player Modal */}
              {previewVideoUrl && (
                <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-slate-900 rounded-2xl max-w-2xl w-full p-4 space-y-3 border border-slate-800">
                    <div className="flex items-center justify-between text-white pb-2 border-b border-slate-800">
                      <span className="text-xs font-bold">Stream Preview</span>
                      <button onClick={() => setPreviewVideoUrl(null)} className="p-1 text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
                      <iframe
                        src={previewVideoUrl.replace('watch?v=', 'embed/')}
                        title="Video Player"
                        className="w-full h-full"
                        allowFullScreen
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --------------------------------------------------------
              TAB 4: HIGH COMMAND DIRECTIVES
             -------------------------------------------------------- */}
          {activeTab === 'tasks' && (
            <div className="space-y-6">
              {/* Directive Creator Form */}
              <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <ListTodo className="w-5 h-5 text-amber-500" />
                      Dispatch Operational Directive to Field Cadre
                    </h3>
                    <p className="text-xs text-slate-400">Assign mandatory operational tasks in PostgreSQL with targeted scopes and deadlines</p>
                  </div>
                </div>

                {directiveSuccessMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700">
                    {directiveSuccessMsg}
                  </div>
                )}

                <form onSubmit={handleCreateDirective} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs font-bold text-slate-700">Directive Title *</label>
                      <input
                        type="text"
                        required
                        value={newDirectiveTitle}
                        onChange={(e) => setNewDirectiveTitle(e.target.value)}
                        placeholder="e.g. Mandatory Cross-Verification of Form 10 Booth Polling Passes"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Priority Level</label>
                      <select
                        value={newDirectivePriority}
                        onChange={(e) => setNewDirectivePriority(e.target.value as any)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                      >
                        <option value="Urgent">🔴 Urgent Priority</option>
                        <option value="High">🟡 High Priority</option>
                        <option value="Medium">🔵 Medium Priority</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Target Operational Level</label>
                      <select
                        value={newDirectiveTargetTier}
                        onChange={(e) => setNewDirectiveTargetTier(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                      >
                        {availableDirectiveTiers.map((tier) => (
                          <option key={tier} value={tier}>
                            {config.hierarchyLabels?.[tier] || DEFAULT_HIERARCHY_TIER_LABELS[tier] || tier}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Due Date / Target Deadline</label>
                      <input
                        type="date"
                        value={newDirectiveDueDate}
                        onChange={(e) => setNewDirectiveDueDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Operational Instructions & Field Guidelines</label>
                    <textarea
                      value={newDirectiveInstructions}
                      onChange={(e) => setNewDirectiveInstructions(e.target.value)}
                      placeholder="Detail step-by-step instructions for incharge execution..."
                      className="w-full h-18 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmittingDirective}
                      className="flex items-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>{isSubmittingDirective ? 'Dispatching to DB...' : 'Dispatch Directive'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Directives Directory */}
              <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h3 className="text-base font-black text-slate-900">Directives Stored in PostgreSQL ({directives.length})</h3>
                  <button onClick={loadDirectives} disabled={isLoadingDirectives} className="text-xs text-slate-500 font-bold hover:text-slate-800">
                    <RefreshCw className={`w-3.5 h-3.5 inline mr-1 ${isLoadingDirectives ? 'animate-spin' : ''}`} /> Refresh
                  </button>
                </div>
                {directives.length === 0 ? (
                  <p className="text-center py-10 text-slate-400 text-xs font-medium">No tasks found in PostgreSQL database. Create your first operational task above!</p>
                ) : (
                  <div className="space-y-3">
                    {directives.map(d => {
                      const targetDisplay = (d.targetHierarchyLevel || (d as any).targetLevel);
                      const targetLabel = targetDisplay
                        ? (config.hierarchyLabels?.[targetDisplay] || DEFAULT_HIERARCHY_TIER_LABELS[targetDisplay] || targetDisplay)
                        : 'All Levels';
                      const isHighPriority = String(d.priority).toUpperCase() === 'URGENT' || String(d.priority).toUpperCase() === 'HIGH';
                      const isOverdue = String(d.status).toUpperCase() !== 'COMPLETED' && Boolean(d.dueDate && new Date(d.dueDate) < new Date());

                      return (
                        <div key={d.id} className="p-4 rounded-xl border border-gray-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                isHighPriority ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {d.priority} Priority
                              </span>
                              {isOverdue && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-500 text-white animate-pulse">
                                  OVERDUE
                                </span>
                              )}
                              <span className="text-xs font-black text-slate-900">{d.title}</span>
                            </div>
                            <p className="text-[11px] text-slate-500">{d.instructions || 'Standard operational guidelines apply.'}</p>
                            <div className="flex items-center gap-3 text-[10px] text-slate-400 font-semibold pt-1">
                              <span>Status: <strong className="text-slate-700">{d.status}</strong></span>
                              <span>•</span>
                              <span>Target: <strong className="text-slate-700">{targetLabel}</strong></span>
                              <span>•</span>
                              <span>Due: <strong className="text-slate-700">{d.dueDate ? String(d.dueDate).slice(0, 10) : 'Open'}</strong></span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {String(d.status).toUpperCase() !== 'COMPLETED' && (
                              <button
                                onClick={async () => {
                                  try {
                                    await updateTaskStatus(d.id, 'COMPLETED', 'Marked completed by Party Admin HQ');
                                    notify.success(`Directive "${d.title}" marked as completed in database.`, 'Status Updated');
                                    await loadDirectives();
                                  } catch (err: any) {
                                    console.error('Failed to update directive status:', err);
                                    notify.error(err.message || 'Failed to mark directive as completed.', 'Status Update Failed');
                                  }
                                }}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
                              >
                                Mark Completed
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteDirective(d.id, d.title)}
                              disabled={deletingDirectiveId === d.id}
                              title="Delete operational directive"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --------------------------------------------------------
              TAB 5: CADRE NETWORK DIRECTORY
             -------------------------------------------------------- */}
          {activeTab === 'cadre_network' && (
            <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-600" />
                    Party Cadre Chain of Command Roster
                  </h3>
                  <p className="text-xs text-slate-400">All appointed leadership and incharges provisioned in PostgreSQL database</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                    {inchargesList.length} Appointed Cadre Incharges Active
                  </span>
                  {cadrePerformanceScore !== null && (
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
                      Avg Score: {cadrePerformanceScore}%
                    </span>
                  )}
                </div>
              </div>

              {inchargesList.length === 0 ? (
                <p className="text-center py-10 text-slate-400 text-xs font-medium">No incharge cadre appointed yet. Incharges configured in CMS Studio Section 7 will appear here.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inchargesList.map((c, idx) => {
                    const level = (c as any).level || (c as any).tierLevel || (c as any).tier || c.inchargeType || c.role || 'CADRE';
                    const phone = (c as any).phone || c.mobileNumber || 'Not Registered';
                    return (
                      <div key={c.id || idx} className="p-4 rounded-xl border border-gray-100 bg-slate-50/70 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-amber-400/20 text-amber-800">
                            {level}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                            Active Incharge
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900">{c.userName || (c as any).name || 'Tier Incharge'}</h4>
                          <p className="text-xs text-slate-500 font-semibold">{c.role} • {c.jurisdictionName || (c as any).unitName || 'Jurisdiction Unit'}</p>
                        </div>
                        <p className="text-xs font-mono text-slate-700 pt-1 border-t border-slate-200/50">
                          📱 +91 {phone.replace(/\D/g, '').slice(-10)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* --------------------------------------------------------
              TAB 6: GROUND REPORTS & GRIEVANCES
             -------------------------------------------------------- */}
          {activeTab === 'ground_reports' && (
            <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    Field Intelligence & Ground Reports Feed
                  </h3>
                  <p className="text-xs text-slate-400">Incoming incident reports and feedback dispatched by ground incharges into PostgreSQL</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={reportFilterStatus}
                    onChange={(e) => setReportFilterStatus(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg"
                  >
                    <option value="ALL">All Reports</option>
                    <option value="PENDING">Pending Triage</option>
                    <option value="IN_REVIEW">Under Review</option>
                    <option value="RESOLVED">Resolved</option>
                  </select>
                </div>
              </div>

              {groundReports.length === 0 ? (
                <p className="text-center py-12 text-slate-400 text-xs font-semibold">No field incident reports in database yet. Reports submitted by ground incharges will appear here live.</p>
              ) : (
                <div className="space-y-3">
                  {groundReports
                    .filter(r => reportFilterStatus === 'ALL' || (r as any).status === reportFilterStatus)
                    .map(r => (
                      <div key={r.id} className="p-4 rounded-xl border border-gray-100 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                              (r as any).priority === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {(r as any).priority || 'MEDIUM'}
                            </span>
                            <span className="text-xs font-black text-slate-900">{r.issueCategory || 'Field Incident'}</span>
                            <span className="text-[10px] text-slate-400">• {(r as any).createdAt ? String((r as any).createdAt).slice(0, 10) : 'Recent'}</span>
                          </div>
                          <p className="text-xs text-slate-700 font-medium">{r.description}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">
                            Reported by incharge unit: <strong className="text-slate-700">{r.unitId || 'Ground Unit'}</strong>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            (r as any).status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' :
                            (r as any).status === 'IN_REVIEW' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {(r as any).status || 'PENDING'}
                          </span>
                          {(r as any).status !== 'RESOLVED' && (
                            <button
                              onClick={() => handleResolveGroundReport(r.id)}
                              className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                            >
                              Mark Resolved
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* --------------------------------------------------------
              TAB 7: ELECTORAL ROLL MASTER
             -------------------------------------------------------- */}
          {activeTab === 'voters' && (
            <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-indigo-600" />
                    Electoral Roll Master Directory ({votersTotal.toLocaleString()} Voters)
                  </h3>
                  <p className="text-xs text-slate-400">Live electorate records from PostgreSQL database</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-full sm:w-64">
                    <input
                      type="text"
                      value={voterSearch}
                      onChange={(e) => setVoterSearch(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { setVoterPage(1); loadVoters(); } }}
                      placeholder="Search Name or EPIC (Press Enter)..."
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <button onClick={() => { setVoterPage(1); loadVoters(); }} className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer">
                    Search
                  </button>
                  <label className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1 shrink-0">
                    <Download className="w-3.5 h-3.5 rotate-180" />
                    <span>Quick CSV Ingest</span>
                    <input type="file" accept=".csv" onChange={handleFastBulkImport} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-bold uppercase text-[10px]">Voter Name</th>
                      <th className="py-2.5 px-3 font-bold uppercase text-[10px]">EPIC Number</th>
                      <th className="py-2.5 px-3 font-bold uppercase text-[10px]">Age / Gender</th>
                      <th className="py-2.5 px-3 font-bold uppercase text-[10px]">Jurisdiction</th>
                      <th className="py-2.5 px-3 font-bold uppercase text-[10px]">Preference</th>
                      <th className="py-2.5 px-3 font-bold uppercase text-[10px]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {votersList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-slate-400">
                          {isLoadingVoters ? 'Loading voters from database...' : 'No voters found in database matching criteria.'}
                        </td>
                      </tr>
                    ) : (
                      votersList.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{v.name}</td>
                          <td className="py-2.5 px-3 font-mono text-amber-700 font-bold">{v.epicNumber}</td>
                          <td className="py-2.5 px-3 text-slate-600">{v.age} • {v.gender}</td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {v.boothNumber ? `Booth ${v.boothNumber}` : (v.village || v.mandal || 'Assigned Unit')}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded font-black text-[10px] bg-slate-100 text-slate-800">
                              {v.politicalPreference || 'Neutral'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              v.voterStatus === 'Fake' ? 'bg-red-100 text-red-700' : 'text-emerald-600 bg-emerald-50'
                            }`}>
                              {v.voterStatus || 'Active'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Server Pagination Controls */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                <span>Page {voterPage} of {Math.max(1, Math.ceil(votersTotal / 20))}</span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={voterPage <= 1}
                    onClick={() => setVoterPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg font-bold"
                  >
                    Previous
                  </button>
                  <button
                    disabled={voterPage >= Math.ceil(votersTotal / 20)}
                    onClick={() => setVoterPage(p => p + 1)}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg font-bold"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------
              TAB 8: CASTE & DEMOGRAPHIC ANALYTICS (REAL DATABASE)
             -------------------------------------------------------- */}
          {activeTab === 'caste_analytics' && (
            <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="border-b border-gray-100 pb-3">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  Demographic & Caste Category Intelligence
                </h3>
                <p className="text-xs text-slate-400">Aggregated directly from PostgreSQL voter database</p>
              </div>

              {Object.keys(casteDistribution).length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-slate-600">No categorized caste records populated in PostgreSQL yet.</p>
                  <p className="text-[11px] text-slate-400">As voters are tagged with caste categories in the voter database, demographic distributions will dynamically populate here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(casteDistribution).map(([casteName, count]) => {
                    const pct = totalElectorateCount > 0 ? ((count / totalElectorateCount) * 100).toFixed(1) : '0.0';
                    return (
                      <div key={casteName} className="p-4 rounded-xl border border-gray-100 bg-slate-50/70 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-amber-400"></span>
                          <span className="text-xs font-black text-slate-800">{casteName}</span>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900">{pct}%</h3>
                        <p className="text-[11px] text-slate-500 font-semibold">{count.toLocaleString()} Recorded Voters</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* --------------------------------------------------------
              TAB 9: BROADCAST TICKER & ANNOUNCEMENTS (REAL DATABASE)
             -------------------------------------------------------- */}
          {activeTab === 'announcements' && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2 border-b border-gray-100 pb-3">
                  <Megaphone className="w-5 h-5 text-amber-500" />
                  Broadcast Urgent Ticker to Subordinate Incharges
                </h3>

                {annSuccessMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl">
                    {annSuccessMsg}
                  </div>
                )}

                <form onSubmit={handleCreateAnnouncement} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Broadcast Title *</label>
                    <input
                      type="text"
                      required
                      value={newAnnTitle}
                      onChange={(e) => setNewAnnTitle(e.target.value)}
                      placeholder="e.g. Critical Polling Station Pass Collection Reminder"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Broadcast Message *</label>
                    <textarea
                      required
                      value={newAnnContent}
                      onChange={(e) => setNewAnnContent(e.target.value)}
                      placeholder="Enter urgent broadcast message to be displayed at the top of all incharge cockpits..."
                      className="w-full h-20 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmittingAnn}
                      className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-md cursor-pointer"
                    >
                      {isSubmittingAnn ? 'Posting to DB...' : 'Post High Command Broadcast'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <h4 className="text-sm font-black text-slate-900">Active Broadcasts in PostgreSQL ({announcements.length})</h4>
                  <button onClick={loadAnnouncements} disabled={isLoadingAnnouncements} className="text-xs text-slate-500 font-bold hover:text-slate-800">
                    <RefreshCw className={`w-3.5 h-3.5 inline mr-1 ${isLoadingAnnouncements ? 'animate-spin' : ''}`} /> Refresh
                  </button>
                </div>
                {announcements.length === 0 ? (
                  <p className="text-center py-8 text-slate-400 text-xs font-medium">No announcements posted in database yet.</p>
                ) : (
                  announcements.map(a => (
                    <div key={a.id} className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                          Active Alert
                        </span>
                        <h5 className="text-sm font-bold text-slate-900">{a.title}</h5>
                        <p className="text-xs text-slate-700">{a.content}</p>
                        <p className="text-[10px] text-slate-400">Posted on: {String(a.createdAt).slice(0, 10)}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteAnnouncement(a.id)}
                        className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                        title="Delete from database"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
