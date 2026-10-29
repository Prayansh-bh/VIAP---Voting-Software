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
import { UserSession, Voter, VoterPreference } from '../types';
import { useCms } from '../context/CmsContext';
import { fetchTrainingVideos } from '../lib/api/training.api';
import { apiFetch } from '../lib/api/client';

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

interface HighCommandDirectiveItem {
  id: string;
  title: string;
  category: string;
  targetLevel: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  dueDate?: string;
  completionRate?: number;
  createdAt?: string;
  instructions?: string;
}

interface FakeVoterRecord {
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
  flaggedRole: string;
  flaggedAt: string;
  status: 'FLAGGED' | 'VERIFIED_FAKE' | 'DISMISSED';
  resolutionNotes?: string;
}

interface GroundReportItem {
  id: string;
  reportType: 'INCIDENT' | 'COMPLAINT' | 'GENERAL_UPDATE' | 'URGENT_ASSISTANCE';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  issueCategory: string;
  description: string;
  reportedBy: string;
  reporterRole: string;
  unitName: string;
  status: 'PENDING' | 'IN_REVIEW' | 'RESOLVED';
  reportedAt: string;
}

export default function PartyAdminDashboard({ session, onLogout }: PartyAdminDashboardProps) {
  const { config, parties } = useCms();
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

  // 1. Training state
  const [videos, setVideos] = useState<TrainingVideoItem[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [videoSuccessMsg, setVideoSuccessMsg] = useState('');
  const [videoErrorMsg, setVideoErrorMsg] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCategory, setNewCategory] = useState('CAMPAIGN');
  const [newTargetTier, setNewTargetTier] = useState('ALL');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmittingVideo, setIsSubmittingVideo] = useState(false);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

  // 2. Directives state
  const [directives, setDirectives] = useState<HighCommandDirectiveItem[]>([
    {
      id: 'dir-1',
      title: 'Voter Slip Verification in All Polling Stations',
      category: 'FIELD_OPERATION',
      targetLevel: 'MANDAL',
      priority: 'HIGH',
      status: 'ACTIVE',
      dueDate: '2026-11-15',
      completionRate: 68,
      instructions: 'Cross-reference physically distributed slips against booth registers.',
      createdAt: '2026-10-25'
    },
    {
      id: 'dir-2',
      title: 'Conduct Door-to-Door Outreach for 100-Voter Clusters',
      category: 'CANVASSING',
      targetLevel: 'VOTER_GROUP',
      priority: 'CRITICAL',
      status: 'ACTIVE',
      dueDate: '2026-11-10',
      completionRate: 84,
      instructions: 'Ensure every designated family contact card is signed and delivered.',
      createdAt: '2026-10-27'
    },
    {
      id: 'dir-3',
      title: 'EVM Mock Poll Readiness & Polling Agent Verification',
      category: 'DEFENSE',
      targetLevel: 'BOOTH',
      priority: 'CRITICAL',
      status: 'ACTIVE',
      dueDate: '2026-11-20',
      completionRate: 45,
      instructions: 'Verify authorized Form 10 passes for all appointed booth polling agents.',
      createdAt: '2026-10-28'
    }
  ]);
  const [newDirectiveTitle, setNewDirectiveTitle] = useState('');
  const [newDirectiveInstructions, setNewDirectiveInstructions] = useState('');
  const [newDirectivePriority, setNewDirectivePriority] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM'>('HIGH');
  const [newDirectiveTargetTier, setNewDirectiveTargetTier] = useState('MANDAL');
  const [newDirectiveDueDate, setNewDirectiveDueDate] = useState('');
  const [directiveSuccessMsg, setDirectiveSuccessMsg] = useState('');

  // 3. Fake Votes State
  const [fakeVoters, setFakeVoters] = useState<FakeVoterRecord[]>([
    {
      id: 'fv-1',
      name: 'Rameshwaram Rao G.',
      epicNumber: 'AP192847192',
      age: 48,
      gender: 'MALE',
      boothNumber: 'Booth 104 - ZPHS School',
      mandalName: 'Kondapi',
      villageName: 'Chinakandukur',
      reason: 'Registered in two adjacent wards simultaneously (Duplicate EPIC)',
      evidenceUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&auto=format&fit=crop',
      flaggedBy: 'K. Venkatesh (Booth President)',
      flaggedRole: 'BOOTH_PRESIDENT',
      flaggedAt: '2026-10-28 11:30 AM',
      status: 'FLAGGED'
    },
    {
      id: 'fv-2',
      name: 'Sunita Devi S.',
      epicNumber: 'AP993817441',
      age: 52,
      gender: 'FEMALE',
      boothNumber: 'Booth 108 - Panchayat Office',
      mandalName: 'Kondapi',
      villageName: 'Kondapi Rural',
      reason: 'Deceased voter record still active on published electoral roll',
      evidenceUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&auto=format&fit=crop',
      flaggedBy: 'M. Chennaiah (Village Incharge)',
      flaggedRole: 'VILLAGE_INCHARGE',
      flaggedAt: '2026-10-27 04:15 PM',
      status: 'VERIFIED_FAKE',
      resolutionNotes: 'Death certificate verified and submitted to ERO for Form 7 deletion.'
    },
    {
      id: 'fv-3',
      name: 'P. Balakrishna',
      epicNumber: 'AP481928310',
      age: 39,
      gender: 'MALE',
      boothNumber: 'Booth 112 - Community Hall',
      mandalName: 'Kondapi',
      villageName: 'Annavaram',
      reason: 'Shifted permanently to Hyderabad 4 years ago without local residence',
      evidenceUrl: '',
      flaggedBy: 'S. Naresh (100-Voter Incharge)',
      flaggedRole: 'VOTER_100_INCHARGE',
      flaggedAt: '2026-10-29 09:10 AM',
      status: 'FLAGGED'
    }
  ]);
  const [fakeFilterStatus, setFakeFilterStatus] = useState<string>('ALL');
  const [fakeSearchTerm, setFakeSearchTerm] = useState('');
  const [selectedFakeVoter, setSelectedFakeVoter] = useState<FakeVoterRecord | null>(null);
  const [adjudicationNotes, setAdjudicationNotes] = useState('');
  const [adjudicationSuccess, setAdjudicationSuccess] = useState('');

  // 4. Ground Reports State
  const [groundReports, setGroundReports] = useState<GroundReportItem[]>([
    {
      id: 'gr-1',
      reportType: 'INCIDENT',
      priority: 'CRITICAL',
      issueCategory: 'EVM Malfunction',
      description: 'EVM Machine #3 in Booth 105 showing battery low indicator and paper jam in mock poll.',
      reportedBy: 'K. Rama Rao',
      reporterRole: 'Booth President',
      unitName: 'Booth 105',
      status: 'IN_REVIEW',
      reportedAt: '10 Mins Ago'
    },
    {
      id: 'gr-2',
      reportType: 'COMPLAINT',
      priority: 'HIGH',
      issueCategory: 'Opposition Malpractice',
      description: 'Unlicensed campaign vehicle distributing unauthorized pamphlets near polling zone.',
      reportedBy: 'V. Subrahmanyam',
      reporterRole: 'Mandal President',
      unitName: 'Kondapi Mandal HQ',
      status: 'PENDING',
      reportedAt: '1 Hour Ago'
    },
    {
      id: 'gr-3',
      reportType: 'GENERAL_UPDATE',
      priority: 'MEDIUM',
      issueCategory: 'Canvassing Complete',
      description: 'Covered 12 out of 14 wards in village. Voter sentiment strongly leaning towards our manifesto.',
      reportedBy: 'M. Bose',
      reporterRole: 'Village Incharge',
      unitName: 'Kondapi Village',
      status: 'RESOLVED',
      reportedAt: '3 Hours Ago'
    }
  ]);
  const [reportFilterStatus, setReportFilterStatus] = useState<string>('ALL');

  // 5. Voter Directory State
  const [votersList, setVotersList] = useState<Voter[]>([]);
  const [voterSearch, setVoterSearch] = useState('');
  const [voterFilterPref, setVoterFilterPref] = useState('ALL');

  // 6. Announcements State
  const [announcements, setAnnouncements] = useState<Array<{ id: string; title: string; content: string; priority: string; createdAt: string }>>([
    {
      id: 'ann-1',
      title: 'Apex Directives for General Polling Readiness',
      content: 'All Mandal and Booth incharges must finalize their Form 10 submissions before Friday 5:00 PM.',
      priority: 'CRITICAL',
      createdAt: '2026-10-28'
    }
  ]);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [annSuccessMsg, setAnnSuccessMsg] = useState('');

  // Load videos from backend
  const loadVideos = async () => {
    setIsLoadingVideos(true);
    setVideoErrorMsg('');
    try {
      const data = await fetchTrainingVideos();
      if (Array.isArray(data)) {
        setVideos(data as any);
      }
    } catch (err: any) {
      console.warn('Backend videos fetch fallback:', err.message);
    } finally {
      setIsLoadingVideos(false);
    }
  };

  // Load voters
  const loadVoters = async () => {
    try {
      const res = await apiFetch<any>('/api/voters?limit=100');
      if (res && res.voters && Array.isArray(res.voters)) {
        setVotersList(res.voters);
      }
    } catch (e) {
      // Graceful fallback
    }
  };

  useEffect(() => {
    loadVideos();
    loadVoters();
  }, []);

  // Handle Video Submit
  const handlePublishVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;

    setIsSubmittingVideo(true);
    setVideoSuccessMsg('');
    setVideoErrorMsg('');

    try {
      const res = await apiFetch<any>('/api/training/videos', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle.trim(),
          videoUrl: newUrl.trim(),
          category: newCategory,
          duration: '10:00',
          description: newDescription.trim() || `Target: ${newTargetTier}`,
        }),
      });

      const added = res?.data || res || {
        id: `vid-${Date.now()}`,
        title: newTitle.trim(),
        videoUrl: newUrl.trim(),
        category: newCategory,
        duration: '10:00',
        targetTier: newTargetTier,
        description: newDescription.trim(),
        createdAt: new Date().toISOString()
      };

      setVideos((prev) => [added, ...prev]);
      setVideoSuccessMsg('Training video published successfully to cadre network!');
      setNewTitle('');
      setNewUrl('');
      setNewDescription('');
    } catch (err: any) {
      setVideoErrorMsg(err.message || 'Failed to publish video.');
    } finally {
      setIsSubmittingVideo(false);
    }
  };

  // Handle Directive Submit
  const handleCreateDirective = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDirectiveTitle.trim()) return;

    const item: HighCommandDirectiveItem = {
      id: `dir-${Date.now()}`,
      title: newDirectiveTitle.trim(),
      category: 'OPERATIONAL',
      targetLevel: newDirectiveTargetTier,
      priority: newDirectivePriority,
      status: 'ACTIVE',
      dueDate: newDirectiveDueDate || '2026-11-30',
      completionRate: 0,
      instructions: newDirectiveInstructions.trim(),
      createdAt: new Date().toISOString().split('T')[0]
    };

    setDirectives([item, ...directives]);
    setDirectiveSuccessMsg('Directive dispatched successfully across targeted cadre!');
    setNewDirectiveTitle('');
    setNewDirectiveInstructions('');
    setTimeout(() => setDirectiveSuccessMsg(''), 4000);
  };

  // Handle Adjudication
  const handleSaveAdjudication = (newStatus: 'VERIFIED_FAKE' | 'DISMISSED') => {
    if (!selectedFakeVoter) return;
    setFakeVoters(prev => prev.map(item => {
      if (item.id === selectedFakeVoter.id) {
        return {
          ...item,
          status: newStatus,
          resolutionNotes: adjudicationNotes.trim() || (newStatus === 'VERIFIED_FAKE' ? 'Verified as invalid entry by Party Legal Cell' : 'Dismissed following physical verification')
        };
      }
      return item;
    }));
    setAdjudicationSuccess(`Voter record marked as ${newStatus}!`);
    setTimeout(() => {
      setAdjudicationSuccess('');
      setSelectedFakeVoter(null);
      setAdjudicationNotes('');
    }, 1500);
  };

  // Handle Export Fake Votes Dossier
  const handleExportFakeDossier = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Name,EPIC Number,Age,Gender,Booth,Mandal,Village,Flagged Reason,Status,Flagged By\n"
      + fakeVoters.map(v => `"${v.name}","${v.epicNumber}",${v.age},"${v.gender}","${v.boothNumber}","${v.mandalName}","${v.villageName}","${v.reason}","${v.status}","${v.flaggedBy}"`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Legal_Fake_Voters_Dossier_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Announcement Submit
  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnContent.trim()) return;
    const ann = {
      id: `ann-${Date.now()}`,
      title: newAnnTitle.trim(),
      content: newAnnContent.trim(),
      priority: 'HIGH',
      createdAt: new Date().toISOString().split('T')[0]
    };
    setAnnouncements([ann, ...announcements]);
    setNewAnnTitle('');
    setNewAnnContent('');
    setAnnSuccessMsg('High command broadcast posted successfully!');
    setTimeout(() => setAnnSuccessMsg(''), 4000);
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

  // Active Parties Telemetry
  const activePartiesList = useMemo(() => {
    if (parties && parties.length > 0) return parties.filter(p => p.isActive);
    return [
      { name: 'Telugu Desam Party', code: 'TDP', primaryColor: '#eab308' },
      { name: 'YSR Congress Party', code: 'YSRCP', primaryColor: '#2563eb' },
      { name: 'JanaSena Party', code: 'JSP', primaryColor: '#dc2626' },
      { name: 'Bharatiya Janata Party', code: 'BJP', primaryColor: '#f97316' },
      { name: 'Indian National Congress', code: 'INC', primaryColor: '#0284c7' },
    ];
  }, [parties]);

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
                <p className="truncate">Level: <span className="text-amber-300 font-bold">Party Apex Governance</span></p>
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
              { id: 'tasks', name: 'High Command Tasks', icon: ListTodo, badge: directives.filter(d => d.status === 'ACTIVE').length },
              { id: 'cadre_network', name: 'Cadre Network', icon: Users },
              { id: 'ground_reports', name: 'Ground Reports', icon: FileText, badge: groundReports.filter(r => r.status === 'PENDING').length },
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

        {/* Bottom Fixed Sign Out */}
        <div className="pt-4 border-t border-slate-800 bg-slate-900 shrink-0">
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
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Postgres DB: Live
              </span>
            </div>
          </div>

          {/* 4 High-Contrast KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-black">Total Electorate</p>
              <h3 className="text-2xl font-black text-slate-950 mt-1">
                {votersList.length > 0 ? votersList.length.toLocaleString() : '2,40,000'}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">Scope: Entire Party Jurisdiction</p>
            </div>
            <div className="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-black">Active Tiers</p>
              <h3 className="text-2xl font-black text-amber-500 mt-1">10 Levels</h3>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">State HQ down to 100-Voter</p>
            </div>
            <div className="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-black">Open Directives</p>
              <h3 className="text-2xl font-black text-blue-600 mt-1">
                {directives.filter(d => d.status === 'ACTIVE').length} Active
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">Dispatched to subordinate tiers</p>
            </div>
            <div className="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-black">Fake Votes Audit</p>
              <h3 className="text-2xl font-black text-red-600 mt-1">
                {fakeVoters.filter(v => v.status === 'FLAGGED').length} Pending
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">Reported by Booth & Village IC</p>
            </div>
          </div>

          {/* Dynamic Preference Breakdown Banner */}
          <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Telemetry & Projections</span>
                <h3 className="text-sm font-black text-slate-900 uppercase">Party Political Preference Distribution</h3>
              </div>
              <span className="text-xs font-bold text-slate-400">Derived dynamically from CMS Studio</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
              {activePartiesList.map((p) => (
                <div key={p.code} className="p-3 rounded-xl border border-gray-100 bg-slate-50/60">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.primaryColor || '#94a3b8' }}></span>
                    <span className="text-xs font-black text-slate-800">{p.code}</span>
                  </div>
                  <h4 className="text-lg font-black text-slate-900 mt-1">0</h4>
                  <p className="text-[10px] text-slate-400 font-semibold">0.0% of Electorate</p>
                </div>
              ))}
              <div className="p-3 rounded-xl border border-gray-100 bg-slate-50/60">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                  <span className="text-xs font-black text-slate-800">Neutral</span>
                </div>
                <h4 className="text-lg font-black text-slate-900 mt-1">50</h4>
                <p className="text-[10px] text-slate-400 font-semibold">100.0% Sample</p>
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

              {/* Hierarchy Operational Readiness Matrix */}
              <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-base font-black text-slate-900">Hierarchy Operational Readiness</h3>
                    <p className="text-xs text-slate-500">Chain of command deployment status across configured party tiers</p>
                  </div>
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                    10 Active Tiers
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {[
                    { level: 'State HQ', code: 'L1: STATE', status: 'Deployed', color: 'emerald', ic: 'State Incharge User' },
                    { level: 'Zone HQ', code: 'L2: ZONE', status: 'Deployed', color: 'emerald', ic: 'Zone Coordinator' },
                    { level: 'Parliament MP', code: 'L3: PARLIAMENT', status: 'Deployed', color: 'emerald', ic: 'Parliament Incharge' },
                    { level: 'Assembly MLA', code: 'L5: CONSTITUENCY', status: 'Deployed', color: 'emerald', ic: 'MLA Incharge' },
                    { level: 'Mandal Block', code: 'L6: MANDAL', status: 'Deployed', color: 'emerald', ic: 'Mandal President' },
                    { level: 'Village Ward', code: 'L7: VILLAGE', status: 'Deployed', color: 'emerald', ic: 'Village Incharge' },
                    { level: 'Polling Booth', code: 'L8: BOOTH', status: 'Deployed', color: 'emerald', ic: 'Booth President' },
                    { level: '100-Voter Unit', code: 'L9: VOTER_GROUP', status: 'Deployed', color: 'emerald', ic: '100-Voter Incharge' },
                    { level: 'District DCC', code: 'L4: DISTRICT', status: 'Optional', color: 'slate', ic: 'District DCC Lead' },
                    { level: 'Party Admin HQ', code: 'L10: PARTY_ADMIN', status: 'Apex Command', color: 'amber', ic: 'Party Admin HQ' },
                  ].map((t) => (
                    <div key={t.code} className="p-3 rounded-xl border border-gray-100 bg-slate-50/70">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-black text-slate-400">{t.code}</span>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          t.color === 'emerald' ? 'bg-emerald-100 text-emerald-800' :
                          t.color === 'amber' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                      <h5 className="text-xs font-black text-slate-800 mt-1">{t.level}</h5>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">{t.ic}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Directives & Fake Votes Summary Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Directives Tracker */}
                <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <ListTodo className="w-4 h-4 text-blue-600" />
                      Active Directives & Incharge Progress
                    </h3>
                    <button
                      onClick={() => setActiveTab('tasks')}
                      className="text-xs text-amber-500 font-bold hover:underline"
                    >
                      View All ({directives.length})
                    </button>
                  </div>
                  <div className="space-y-3">
                    {directives.map(d => (
                      <div key={d.id} className="p-3 rounded-xl border border-gray-100 bg-slate-50/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            d.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                            d.priority === 'HIGH' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {d.priority} Priority
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">Due: {d.dueDate}</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-800">{d.title}</h4>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold text-slate-500">
                            <span>Incharge Completion</span>
                            <span>{d.completionRate || 0}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${d.completionRate || 0}%` }}></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Flagged Fake Votes Widget */}
                <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      Flagged Fake Votes Awaiting Audit
                    </h3>
                    <button
                      onClick={() => setActiveTab('fake_votes')}
                      className="text-xs text-amber-500 font-bold hover:underline"
                    >
                      Review All ({fakeVoters.length})
                    </button>
                  </div>
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
                </div>
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
                    Review, adjudicate, and assemble official legal dossiers for Form 7 Election Commission deletion requests
                  </p>
                </div>
                <div className="flex items-center gap-2">
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
                  <span className="text-[10px] font-black uppercase text-slate-400">Total Flagged</span>
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
                      <th className="py-2.5 px-3 font-bold uppercase text-[10px]">Flagged By</th>
                      <th className="py-2.5 px-3 font-bold uppercase text-[10px]">Audit Status</th>
                      <th className="py-2.5 px-3 font-bold uppercase text-[10px] text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredFakeVoters.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400 font-semibold">
                          No fake voter records matching the selected filter.
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
                          <td className="py-3 px-3 text-slate-600">
                            <p className="font-semibold text-slate-800">{fv.flaggedBy}</p>
                            <p className="text-[10px] text-slate-400">{fv.flaggedAt}</p>
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
                        <p className="text-xs text-slate-400">Official Decision by Party Legal Cell</p>
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
                        onClick={() => handleSaveAdjudication('DISMISSED')}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Dismiss as Valid Voter
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveAdjudication('VERIFIED_FAKE')}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm"
                      >
                        Confirm as Fake (File Form 7)
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
                        <option value="STATE">State Incharge Only</option>
                        <option value="CONSTITUENCY">Constituency Incharge Only</option>
                        <option value="MANDAL">Mandal President Only</option>
                        <option value="VILLAGE">Village Incharge Only</option>
                        <option value="BOOTH">Booth President Only</option>
                        <option value="VOTER_GROUP">100-Voter Incharge Only</option>
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
                      <span>{isSubmittingVideo ? 'Publishing...' : 'Publish to Cadre Network'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Published Videos List */}
              <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h3 className="text-base font-black text-slate-900">Published Modules in Party Library ({videos.length})</h3>
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
                  <p className="text-center py-10 text-slate-400 text-xs font-semibold">No training videos published yet. Publish your first module above!</p>
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
                          <span className="text-[10px] text-slate-400 font-semibold">Published</span>
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
                    <p className="text-xs text-slate-400">Assign mandatory operational tasks with targeted scopes and deadlines</p>
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
                        <option value="CRITICAL">🔴 Critical Priority</option>
                        <option value="HIGH">🟡 High Priority</option>
                        <option value="MEDIUM">🔵 Medium Priority</option>
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
                        <option value="MANDAL">Mandal Incharge Tier</option>
                        <option value="VILLAGE">Village Incharge Tier</option>
                        <option value="BOOTH">Polling Booth Incharges</option>
                        <option value="VOTER_GROUP">100-Voter Cluster Committee</option>
                        <option value="CONSTITUENCY">Constituency Command</option>
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
                      className="flex items-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>Dispatch Directive</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Directives Directory */}
              <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-base font-black text-slate-900 border-b border-gray-100 pb-3">Active Operational Directives ({directives.length})</h3>
                <div className="space-y-3">
                  {directives.map(d => (
                    <div key={d.id} className="p-4 rounded-xl border border-gray-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            d.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {d.priority}
                          </span>
                          <span className="text-xs font-black text-slate-900">{d.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-500">{d.instructions || 'Standard operational guidelines apply.'}</p>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-semibold pt-1">
                          <span>Target: <strong className="text-slate-700">{d.targetLevel}</strong></span>
                          <span>•</span>
                          <span>Due: <strong className="text-slate-700">{d.dueDate}</strong></span>
                          <span>•</span>
                          <span>Dispatched: <strong className="text-slate-700">{d.createdAt}</strong></span>
                        </div>
                      </div>

                      <div className="w-full md:w-48 space-y-1.5 shrink-0">
                        <div className="flex justify-between text-[11px] font-bold text-slate-700">
                          <span>Cadre Compliance</span>
                          <span className="text-blue-600 font-mono">{d.completionRate}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${d.completionRate}%` }}></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
                  <p className="text-xs text-slate-400">All provisioned hierarchy incharges appointed across the party's jurisdiction</p>
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                  8 Appointed Incharges Active
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { name: 'State Admin User', role: 'State Incharge', tier: 'STATE', unit: 'State Headquarters', phone: '+91 9348423885', score: 96 },
                  { name: 'Zone Coordinator', role: 'Zone Coordinator', tier: 'ZONE', unit: 'Regional Zone HQ', phone: '+91 9888800001', score: 92 },
                  { name: 'Parliament Incharge', role: 'Parliament Incharge', tier: 'PARLIAMENT', unit: 'Ongole MP Seat', phone: '+91 9888800002', score: 88 },
                  { name: 'MLA Incharge', role: 'Constituency Incharge', tier: 'CONSTITUENCY', unit: 'Kondapi AC No. 107', phone: '+91 9888800003', score: 94 },
                  { name: 'Mandal President', role: 'Mandal President', tier: 'MANDAL', unit: 'Kondapi Mandal', phone: '+91 9100088818', score: 90 },
                  { name: 'Village Incharge', role: 'Village Incharge', tier: 'VILLAGE', unit: 'Kondapi Village Ward', phone: '+91 9888800005', score: 87 },
                  { name: 'Booth President', role: 'Booth President', tier: 'BOOTH', unit: 'Booth 105 ZPHS', phone: '+91 9888800006', score: 85 },
                  { name: '100-Voter Incharge', role: '100 Voter Incharge', tier: 'VOTER_GROUP', unit: 'Cluster 101', phone: '+91 9888800007', score: 89 },
                ].map((c) => (
                  <div key={c.tier} className="p-4 rounded-xl border border-gray-100 bg-slate-50/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-amber-400/20 text-amber-800">
                        {c.tier}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                        Score: {c.score}%
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900">{c.name}</h4>
                      <p className="text-xs text-slate-500 font-semibold">{c.role} • {c.unit}</p>
                    </div>
                    <p className="text-xs font-mono text-slate-700 pt-1 border-t border-slate-200/50">
                      📱 {c.phone}
                    </p>
                  </div>
                ))}
              </div>
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
                  <p className="text-xs text-slate-400">Incoming incident reports and feedback dispatched by ground incharges</p>
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

              <div className="space-y-3">
                {groundReports
                  .filter(r => reportFilterStatus === 'ALL' || r.status === reportFilterStatus)
                  .map(r => (
                    <div key={r.id} className="p-4 rounded-xl border border-gray-100 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            r.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {r.priority}
                          </span>
                          <span className="text-xs font-black text-slate-900">{r.issueCategory}</span>
                          <span className="text-[10px] text-slate-400">• {r.reportedAt}</span>
                        </div>
                        <p className="text-xs text-slate-700 font-medium">{r.description}</p>
                        <p className="text-[10px] text-slate-400 font-semibold">
                          Reported by: <strong className="text-slate-700">{r.reportedBy} ({r.reporterRole})</strong> from {r.unitName}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                          r.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' :
                          r.status === 'IN_REVIEW' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {r.status}
                        </span>
                        {r.status !== 'RESOLVED' && (
                          <button
                            onClick={() => {
                              setGroundReports(prev => prev.map(item => item.id === r.id ? { ...item, status: 'RESOLVED' } : item));
                            }}
                            className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                          >
                            Mark Resolved
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
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
                    Electoral Roll Master Directory
                  </h3>
                  <p className="text-xs text-slate-400">Search and audit registered electorate database</p>
                </div>
                <div className="w-full sm:w-64">
                  <input
                    type="text"
                    value={voterSearch}
                    onChange={(e) => setVoterSearch(e.target.value)}
                    placeholder="Search Name or EPIC..."
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-bold uppercase text-[10px]">Voter Name</th>
                      <th className="py-2.5 px-3 font-bold uppercase text-[10px]">EPIC Number</th>
                      <th className="py-2.5 px-3 font-bold uppercase text-[10px]">Age / Gender</th>
                      <th className="py-2.5 px-3 font-bold uppercase text-[10px]">Preference</th>
                      <th className="py-2.5 px-3 font-bold uppercase text-[10px]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(votersList.length > 0 ? votersList : [
                      { id: '1', name: 'K. Subrahmanyam', epicNumber: 'AP10928301', age: 44, gender: 'MALE', politicalPreference: 'TDP', voterStatus: 'Active' },
                      { id: '2', name: 'P. Lakshmi', epicNumber: 'AP10928302', age: 39, gender: 'FEMALE', politicalPreference: 'YSRCP', voterStatus: 'Active' },
                      { id: '3', name: 'M. Venkat Rao', epicNumber: 'AP10928303', age: 52, gender: 'MALE', politicalPreference: 'Neutral', voterStatus: 'Active' }
                    ]).map((v: any) => (
                      <tr key={v.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{v.name}</td>
                        <td className="py-2.5 px-3 font-mono text-amber-700 font-bold">{v.epicNumber}</td>
                        <td className="py-2.5 px-3 text-slate-600">{v.age} • {v.gender}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded font-black text-[10px] bg-slate-100 text-slate-800">
                            {v.politicalPreference || 'Neutral'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                            {v.voterStatus || 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------
              TAB 8: CASTE & DEMOGRAPHIC ANALYTICS
             -------------------------------------------------------- */}
          {activeTab === 'caste_analytics' && (
            <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="border-b border-gray-100 pb-3">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  Demographic & Caste Category Intelligence
                </h3>
                <p className="text-xs text-slate-400">Aggregated demographic composition across all Mandals and Constituencies</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { name: 'Backward Classes (BC)', pct: '48.2%', voters: '1,15,680', color: 'bg-amber-400' },
                  { name: 'Other Castes (OC)', pct: '26.4%', voters: '63,360', color: 'bg-blue-500' },
                  { name: 'Scheduled Castes (SC)', pct: '18.1%', voters: '43,440', color: 'bg-emerald-500' },
                  { name: 'Minorities & Others', pct: '7.3%', voters: '17,520', color: 'bg-purple-500' }
                ].map((c) => (
                  <div key={c.name} className="p-4 rounded-xl border border-gray-100 bg-slate-50/70 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${c.color}`}></span>
                      <span className="text-xs font-black text-slate-800">{c.name}</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900">{c.pct}</h3>
                    <p className="text-[11px] text-slate-500 font-semibold">{c.voters} Estimated Voters</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* --------------------------------------------------------
              TAB 9: BROADCAST TICKER & ANNOUNCEMENTS
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
                      className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-md cursor-pointer"
                    >
                      Post High Command Broadcast
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-3">
                <h4 className="text-sm font-black text-slate-900 border-b border-gray-100 pb-2">Active Broadcasts ({announcements.length})</h4>
                {announcements.map(a => (
                  <div key={a.id} className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                        Active Alert
                      </span>
                      <h5 className="text-sm font-bold text-slate-900">{a.title}</h5>
                      <p className="text-xs text-slate-700">{a.content}</p>
                      <p className="text-[10px] text-slate-400">Posted on: {a.createdAt}</p>
                    </div>
                    <button
                      onClick={() => setAnnouncements(prev => prev.filter(item => item.id !== a.id))}
                      className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
