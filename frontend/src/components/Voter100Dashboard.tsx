/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  AlertTriangle, 
  CheckSquare, 
  Video, 
  LogOut, 
  Search, 
  Filter, 
  Send, 
  AlertCircle, 
  ChevronRight, 
  SlidersHorizontal, 
  X, 
  CheckCircle2, 
  FileText, 
  Eye, 
  HelpCircle, 
  Flame, 
  Clock, 
  Compass, 
  ChevronDown, 
  ShieldAlert, 
  Play, 
  Plus, 
  Smartphone,
  Menu,
  ShieldCheck,
  Award,
  Activity,
  Phone,
  Pencil
} from 'lucide-react';
import Pagination from './common/Pagination';
import { 
  UserSession, 
  Voter, 
  VoterPreference, 
  VoterStatus, 
  SurveyStatus, 
  GroundReport, 
  VoterTask, 
  TrainingVideo 
} from '../types';
import {
  createReport,
  ensureTrainingAssigned,
  fetchReportsForUser,
  fetchTasksForUser,
  fetchTrainingProgress,
  fetchTrainingVideos,
  fetchVotersForIncharge,
  flagFakeVoter,
  markNotVoted,
  markVoteDone,
  syncVoter,
  type TrainingProgressItem,
  updateTaskStatus,
  updateTrainingProgress,
} from '../lib/api';
import { createRealtimeSocket, RealtimeReportEvent, RealtimeTaskEvent, RealtimeVoteEvent } from '../lib/realtime';

interface Voter100DashboardProps {
  session: UserSession;
  onLogout: () => void;
}

const PROFESSION_PRESETS = [
  "Agriculture",
  "Farmer",
  "Agricultural Labour",
  "Government Employee",
  "Private Employee",
  "Business",
  "Self Employed",
  "Student",
  "Homemaker",
  "Daily Wage Worker",
  "Driver",
  "Teacher",
  "Retired",
  "Unemployed"
];


// Color definitions for parties
const PARTY_COLORS: Record<VoterPreference, { bg: string; text: string; hex: string; lightBg: string; border: string; darkText: string }> = {
  TDP: { bg: 'bg-yellow-400', text: 'text-yellow-800', hex: '#eab308', lightBg: 'bg-yellow-50', border: 'border-yellow-200', darkText: 'text-yellow-800' },
  YSRCP: { bg: 'bg-blue-600', text: 'text-white', hex: '#2563eb', lightBg: 'bg-blue-50', border: 'border-blue-200', darkText: 'text-blue-800' },
  JSP: { bg: 'bg-red-600', text: 'text-white', hex: '#dc2626', lightBg: 'bg-red-50', border: 'border-red-200', darkText: 'text-red-800' },
  BJP: { bg: 'bg-orange-500', text: 'text-white', hex: '#f97316', lightBg: 'bg-orange-50', border: 'border-orange-200', darkText: 'text-orange-800' },
  INC: { bg: 'bg-sky-400', text: 'text-sky-950', hex: '#38bdf8', lightBg: 'bg-sky-50', border: 'border-sky-200', darkText: 'text-sky-950' },
  Neutral: { bg: 'bg-gray-400', text: 'text-gray-800', hex: '#9ca3af', lightBg: 'bg-gray-50', border: 'border-gray-200', darkText: 'text-gray-800' },
  OTH: { bg: 'bg-purple-600', text: 'text-white', hex: '#9333ea', lightBg: 'bg-purple-50', border: 'border-purple-200', darkText: 'text-purple-800' }
};

export default function Voter100Dashboard({ session, onLogout }: Voter100DashboardProps) {
  // Navigation tabs state: 'dashboard' | 'voters' | 'live-track' | 'fake-doubtful' | 'tasks' | 'videos'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'voters' | 'live-track' | 'fake-doubtful' | 'tasks' | 'videos'>(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === '/100-voter/voters') return 'voters';
    if (hash === '/100-voter/live-track') return 'live-track';
    if (hash === '/100-voter/fake-doubtful') return 'fake-doubtful';
    if (hash === '/100-voter/tasks') return 'tasks';
    if (hash === '/100-voter/training') return 'videos';
    return 'dashboard';
  });

  // Track tab route updates
  useEffect(() => {
    const pathMap = {
      dashboard: '/100-voter',
      voters: '/100-voter/voters',
      'live-track': '/100-voter/live-track',
      'fake-doubtful': '/100-voter/fake-doubtful',
      tasks: '/100-voter/tasks',
      videos: '/100-voter/training'
    };
    window.location.hash = pathMap[activeTab];
  }, [activeTab]);

  // Mobile sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Load Voters State specifically for the logged-in User Id
  const [voters, setVoters] = useState<Voter[]>([]);
  const [backendSyncStatus, setBackendSyncStatus] = useState<'idle' | 'loading' | 'synced' | 'offline'>('idle');
  const [trainingVideos, setTrainingVideos] = useState<TrainingVideo[]>([]);
  const [trainingProgress, setTrainingProgress] = useState<Record<string, TrainingProgressItem>>({});

  const [reports, setReports] = useState<GroundReport[]>([]);
  const [tasks, setTasks] = useState<VoterTask[]>([]);

  // Live Voter Track specific states
  const [liveSearchQuery, setLiveSearchQuery] = useState('');
  const [liveFilter, setLiveFilter] = useState<'ALL' | 'DONE' | 'NOT_VOTED'>('ALL');
  const [liveSyncQueue, setLiveSyncQueue] = useState<{ id: string; voterName: string; time: string; status: string; assessment: string; synced: boolean }[]>([]);

  useEffect(() => {
    let isActive = true;

    const hydrateFromBackend = async () => {
      setBackendSyncStatus('loading');
      try {
        const [items, taskItems, reportItems, videos, progressItems] = await Promise.all([
          fetchVotersForIncharge(session.userId),
          fetchTasksForUser(session.userId).catch(() => null),
          fetchReportsForUser(session.userId).catch(() => null),
          fetchTrainingVideos().catch(() => null),
          fetchTrainingProgress(session.userId).catch(() => null),
        ]);
        if (!isActive) {
          return;
        }

        setVoters(items);

        if (taskItems) {
          setTasks(taskItems);
        }

        if (reportItems) {
          setReports(reportItems);
        }

        if (videos) {
          setTrainingVideos(videos);
        }

        if (progressItems) {
          const progressMap: Record<string, TrainingProgressItem> = {};
          progressItems.forEach((item) => {
            progressMap[item.video.id] = item;
          });
          setTrainingProgress(progressMap);
        }

        setBackendSyncStatus('synced');
      } catch (error) {
        console.warn('Backend sync unavailable.', error);
        if (isActive) {
          setBackendSyncStatus('offline');
        }
      }
    };

    hydrateFromBackend();

    return () => {
      isActive = false;
    };
  }, [session.userId]);

  useEffect(() => {
    const socket = createRealtimeSocket({ userId: session.userId, unitId: session.unitId });

    socket.on('vote:event', (event: RealtimeVoteEvent) => {
      setLiveSyncQueue((prev) => {
        const item = {
          id: event.id,
          voterName: event.voter.name,
          time: new Date(event.changedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: event.nextStatus === 'VOTE_DONE' ? '✓ VOTE DONE' : 'PENDING',
          assessment: 'Unknown',
          synced: true,
        };
        return [item, ...prev.filter((log) => log.id !== item.id)].slice(0, 5);
      });
    });

    socket.on('task:event', (_event: RealtimeTaskEvent) => {
      void fetchTasksForUser(session.userId)
        .then(setTasks)
        .catch(() => {
        });
    });

    socket.on('report:event', (_event: RealtimeReportEvent) => {
      void fetchReportsForUser(session.userId)
        .then(setReports)
        .catch(() => {
        });
    });

    return () => {
      socket.disconnect();
    };
  }, [session.unitId, session.userId]);

  // Handle survey saving
  const handleSaveVoterSurvey = (updatedVoter: Voter) => {
    const nextVoter = {
      ...updatedVoter,
      lastUpdated: new Date().toISOString().split('T')[0],
      updatedBy: session.userId
    };
    setVoters(prev => prev.map(v => v.id === updatedVoter.id ? nextVoter : v));
    void syncVoter(nextVoter, session.userId).catch(() => {
      setBackendSyncStatus('offline');
    });
  };

  // Handle reporting voter status directly
  const handleFlagVoterStatus = (voterId: string, status: VoterStatus, notes: string) => {
    let updatedVoter: Voter | null = null;
    setVoters(prev => prev.map(v => {
      if (v.id !== voterId) {
        return v;
      }

      updatedVoter = {
        ...v,
        voterStatus: status,
        notes,
        lastUpdated: new Date().toISOString().split('T')[0],
        updatedBy: session.userId
      };
      return updatedVoter;
    }));
    if (updatedVoter) {
      void syncVoter(updatedVoter, session.userId).catch(() => {
        setBackendSyncStatus('offline');
      });
    }
  };

  // Add a general/complaint report
  const handleAddReport = (report: Omit<GroundReport, 'id' | 'inchargeId' | 'inchargeName' | 'constituency' | 'mandal' | 'village' | 'booth' | 'date' | 'time' | 'status'>) => {
    const now = new Date();
    const newReport: GroundReport = {
      ...report,
      id: "REP-" + Math.floor(1000 + Math.random() * 9000),
      inchargeId: session.userId,
      inchargeName: session.userName,
      constituency: session.assignedConstituency,
      mandal: session.assignedMandal || "Jarugumalli",
      village: session.assignedVillage || "Jarugumalli Village",
      booth: session.assignedBooth || "Booth 76 (ZPH School)",
      date: now.toISOString().split('T')[0],
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'Pending'
    };
    setReports(prev => [newReport, ...prev]);
    void createReport({
      reportType: newReport.reportType,
      priority: newReport.priority,
      description: newReport.description,
      issueCategory: newReport.issueCategory,
      affectedVotersCount: newReport.affectedVotersCount,
      unitId: session.unitId,
      createdById: session.userId,
    })
      .then((savedReport) => {
        setReports((prev) => [savedReport, ...prev.filter((item) => item.id !== newReport.id)]);
      })
      .catch(() => {
        setBackendSyncStatus('offline');
      });
  };

  // Update Task Status
  const handleUpdateTaskStatus = (taskId: string, newStatus: 'Pending' | 'In Progress' | 'Completed') => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    void updateTaskStatus(taskId, newStatus).catch(() => {
      setBackendSyncStatus('offline');
    });
  };

  const handleWatchTraining = (video: TrainingVideo) => {
    setWatchingVideo(video);

    const existing = trainingProgress[video.id];
    if (existing) {
      if (existing.status === 'WATCHED' || existing.status === 'COMPLETED') {
        return;
      }

      void updateTrainingProgress(existing.id, 'WATCHED')
        .then(() => {
          setTrainingProgress((prev) => ({
            ...prev,
            [video.id]: { ...existing, status: 'WATCHED', watchedAt: new Date().toISOString() },
          }));
        })
        .catch(() => {
          setBackendSyncStatus('offline');
        });
      return;
    }

    void ensureTrainingAssigned(session.userId, video.id)
      .then((progress) => updateTrainingProgress(progress.id, 'WATCHED').then(() => progress))
      .then((progress) => {
        setTrainingProgress((prev) => ({
          ...prev,
          [video.id]: {
            id: progress.id,
            status: 'WATCHED',
            watchedAt: new Date().toISOString(),
            user: { id: session.userId, userCode: session.userId, name: session.userName },
            video: { id: video.id, title: video.title },
          },
        }));
      })
      .catch(() => {
        setBackendSyncStatus('offline');
      });
  };

  // --------------------------------------------------------
  // ANALYTICS CALCULATIONS
  // --------------------------------------------------------
  const totalVoters = voters.length; // Will be exactly 100

  // Count preferences
  const stats = useMemo(() => {
    const counts: Record<VoterPreference, number> = {
      TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0
    };
    voters.forEach(v => {
      counts[v.politicalPreference]++;
    });
    return counts;
  }, [voters]);

  // Fake / Doubtful counts
  const fakeDoubtfulCount = useMemo(() => {
    return voters.filter(v => ['Fake', 'Doubtful', 'Duplicate', 'Shifted', 'Deceased'].includes(v.voterStatus)).length;
  }, [voters]);

  // Calculate election forecast
  const forecast = useMemo(() => {
    // Compare ONLY: TDP, YSRCP, JSP, BJP, INC, OTH
    // Neutral voters must NOT be counted.
    const candidates: { party: VoterPreference; votes: number }[] = [
      { party: 'TDP', votes: stats.TDP },
      { party: 'YSRCP', votes: stats.YSRCP },
      { party: 'JSP', votes: stats.JSP },
      { party: 'BJP', votes: stats.BJP },
      { party: 'INC', votes: stats.INC },
      { party: 'OTH', votes: stats.OTH }
    ];

    // Sort descending
    candidates.sort((a, b) => b.votes - a.votes);

    const highest = candidates[0];
    const runnerUp = candidates[1];

    if (highest.votes === runnerUp.votes) {
      return {
        status: 'TOO CLOSE TO CALL',
        lead: 0,
        winner: null as VoterPreference | null
      };
    } else {
      return {
        status: `${highest.party} LEADS`,
        lead: highest.votes - runnerUp.votes,
        winner: highest.party
      };
    }
  }, [stats]);


  // --------------------------------------------------------
  // SUB-COMPONENT: DONUT CHART (SVG-based)
  // --------------------------------------------------------
  const donutChartData = useMemo(() => {
    const dataKeys: VoterPreference[] = ['TDP', 'YSRCP', 'JSP', 'BJP', 'INC', 'Neutral', 'OTH'];
    let cumulativeValue = 0;
    
    return dataKeys.map((key) => {
      const value = stats[key];
      const percentage = totalVoters > 0 ? (value / totalVoters) * 100 : 0;
      const startValue = cumulativeValue;
      cumulativeValue += percentage;
      return {
        key,
        value,
        percentage,
        startValue,
        endValue: cumulativeValue,
        color: PARTY_COLORS[key].hex
      };
    });
  }, [stats, totalVoters]);

  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

  // --------------------------------------------------------
  // MODAL FOR EDITING/SURVEYING A VOTER
  // --------------------------------------------------------
  const [editingVoter, setEditingVoter] = useState<Voter | null>(null);
  
  // Voter list filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [prefFilter, setPrefFilter] = useState<string>('ALL');
  const [voterStatusFilter, setVoterStatusFilter] = useState<string>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');

  // Filtered voters list
  const filteredVoters = useMemo(() => {
    return voters.filter(v => {
      // Search matches
      const matchesSearch = 
        (v.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.epicNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.serialNumber || '').toString() === searchQuery ||
        (v.houseNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.mobileNumber || '').includes(searchQuery);

      // Category Filters
      const matchesPref = prefFilter === 'ALL' || v.politicalPreference === prefFilter;
      const matchesStatus = voterStatusFilter === 'ALL' || (v.voterStatus || '').toUpperCase() === voterStatusFilter.toUpperCase();
      const matchesLocation = 
        locationFilter === 'ALL' || 
        (locationFilter === 'Local' && (v.voterLocationStatus === 'Local' || !v.voterLocationStatus)) || 
        (locationFilter === 'Migrated' && v.voterLocationStatus === 'Migrated');

      return matchesSearch && matchesPref && matchesStatus && matchesLocation;
    });
  }, [voters, searchQuery, prefFilter, voterStatusFilter, locationFilter]);

  // Pagination for Voter Registry Table
  const [voterPage, setVoterPage] = useState<number>(1);
  const [voterPageSize, setVoterPageSize] = useState<number>(20);

  const paginatedVoters = useMemo(() => {
    const start = (voterPage - 1) * voterPageSize;
    return filteredVoters.slice(start, start + voterPageSize);
  }, [filteredVoters, voterPage, voterPageSize]);

  useEffect(() => {
    setVoterPage(1);
  }, [searchQuery, prefFilter, voterStatusFilter, locationFilter]);

  const localCount = useMemo(() => voters.filter(v => v.voterLocationStatus === 'Local' || !v.voterLocationStatus).length, [voters]);
  const migratedCount = useMemo(() => voters.filter(v => v.voterLocationStatus === 'Migrated').length, [voters]);
  const totalCount = voters.length;
  const localPercent = totalCount > 0 ? ((localCount / totalCount) * 100).toFixed(1) : '0.0';
  const migratedPercent = totalCount > 0 ? ((migratedCount / totalCount) * 100).toFixed(1) : '0.0';

  // Live Voter Track calculations
  const liveAssessmentStats = useMemo(() => {
    const counts: Record<string, number> = {
      TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0, Unknown: 0
    };
    voters.forEach(v => {
      if (v.voteStatus === 'VOTE DONE') {
        const ass = v.inchargeAssessment || 'Unknown';
        counts[ass] = (counts[ass] || 0) + 1;
      }
    });
    return counts;
  }, [voters]);

  // Live Voter Track Pagination
  const [livePage, setLivePage] = useState<number>(1);
  const [livePageSize, setLivePageSize] = useState<number>(20);

  const liveFilteredVoters = useMemo(() => {
    return voters.filter(v => {
      const query = liveSearchQuery.trim().toLowerCase();
      const matchSearch = !query || 
        (v.name || '').toLowerCase().includes(query) ||
        (v.epicNumber || '').toLowerCase().includes(query) ||
        (v.serialNumber || '').toString() === query ||
        ((v.mobileNumber || '').includes(query));

      const isVoted = v.voteStatus === 'VOTE DONE';
      if (liveFilter === 'DONE') {
        return matchSearch && isVoted;
      } else if (liveFilter === 'NOT_VOTED') {
        return matchSearch && !isVoted;
      }
      return matchSearch;
    });
  }, [voters, liveSearchQuery, liveFilter]);

  const paginatedLiveVoters = useMemo(() => {
    const start = (livePage - 1) * livePageSize;
    return liveFilteredVoters.slice(start, start + livePageSize);
  }, [liveFilteredVoters, livePage, livePageSize]);

  useEffect(() => {
    setLivePage(1);
  }, [liveSearchQuery, liveFilter]);

  // Video watch modal state
  const [watchingVideo, setWatchingVideo] = useState<TrainingVideo | null>(null);

  return (
    <div className="w-full h-screen overflow-hidden flex flex-col lg:flex-row animate-fade-in text-gray-800" id="incharge-dashboard-container">
      
      {/* --------------------------------------------------------
          LEFT SIDEBAR (Fixed and Styled dark navy)
         -------------------------------------------------------- */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white p-5 flex flex-col justify-between transform transition-transform duration-300 lg:fixed lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        id="dashboard-sidebar"
      >
        <div className="space-y-6">
          {/* Circular logo & Title block */}
          <div className="flex items-center gap-3 border-b border-slate-800 pb-5">
            <div className="w-11 h-11 bg-yellow-400 rounded-full flex items-center justify-center text-slate-950 font-black text-lg shadow-inner">
              TDP
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-yellow-400">Kondapi TDP Connect</h2>
              <span className="text-[10px] bg-slate-800 text-yellow-300 font-extrabold uppercase px-2 py-0.5 rounded tracking-wide">
                100 Voter Incharge
              </span>
            </div>
            {/* Mobile close button */}
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-1.5 ml-auto text-slate-400 hover:text-white hover:bg-slate-800 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User profile brief */}
          <div className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-800/60 space-y-1">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Active Agent</p>
            <h4 className="text-xs font-bold text-slate-100">{session.userName}</h4>
            <div className="text-[10px] text-slate-400 flex flex-col gap-0.5 font-mono">
              <span title={session.userId}>ID: {session.userId?.slice(-8).toUpperCase() || 'AGENT'}</span>
              <span>Village: {session.assignedVillage}</span>
              <span>Booth: {session.assignedBooth?.split(' ')[1] || '76'}</span>
              <span>Group: {session.assignedVoterGroup}</span>
            </div>
          </div>

          {/* Menu Items */}
          <nav className="space-y-1" id="sidebar-navigation">
            <button
              onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'dashboard' ? 'bg-yellow-400 text-slate-950 shadow' : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'}`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              Dashboard
            </button>

            <button
              onClick={() => { setActiveTab('voters'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'voters' ? 'bg-yellow-400 text-slate-950 shadow' : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'}`}
            >
              <Users className="w-4 h-4 shrink-0" />
              Voter List (100)
            </button>

            <button
              onClick={() => { setActiveTab('live-track'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'live-track' ? 'bg-yellow-400 text-slate-950 shadow' : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'}`}
            >
              <Activity className="w-4 h-4 shrink-0" />
              Live Voter Track
            </button>

            <button
              onClick={() => { setActiveTab('fake-doubtful'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'fake-doubtful' ? 'bg-yellow-400 text-slate-950 shadow' : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'}`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Fake Votes
            </button>

            <button
              onClick={() => { setActiveTab('tasks'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'tasks' ? 'bg-yellow-400 text-slate-950 shadow' : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'}`}
            >
              <CheckSquare className="w-4 h-4 shrink-0" />
              Tasks
              {tasks.filter(t => t.status !== 'Completed').length > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                  {tasks.filter(t => t.status !== 'Completed').length}
                </span>
              )}
            </button>

            <button
              onClick={() => { setActiveTab('videos'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'videos' ? 'bg-yellow-400 text-slate-950 shadow' : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'}`}
            >
              <Video className="w-4 h-4 shrink-0" />
              Training Videos
            </button>
          </nav>
        </div>

        {/* Sign Out block */}
        <div className="pt-4 border-t border-slate-800 mt-auto">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold text-red-400 hover:bg-red-950/20 hover:text-red-300 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/40 z-40 lg:hidden"
        />
      )}

      {/* --------------------------------------------------------
          MAIN WORKSPACE
         -------------------------------------------------------- */}
      <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden min-w-0 lg:pl-64" id="main-workspace-section">
        <div className="p-6 md:p-8 space-y-6 max-w-7xl w-full mx-auto">
        
        {/* Mobile Header Bar */}
        <div className="lg:hidden flex items-center justify-between bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-lg text-slate-700"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="text-center">
            <h1 className="text-xs font-black text-slate-900 uppercase tracking-widest">Kondapi Connect</h1>
            <p className="text-[9px] font-bold text-yellow-600">100 Voter Dashboard</p>
          </div>
          <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center font-bold text-sm">
            TDP
          </div>
        </div>

        {/* DASHBOARD HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900" id="workspace-title">
              {activeTab === 'dashboard' && "My Voters Overview (100)"}
              {activeTab === 'voters' && "Voter List (100)"}
              {activeTab === 'fake-doubtful' && "Fake & Doubtful Audit Registry"}
              {activeTab === 'tasks' && "Campaign Operation Tasks"}
              {activeTab === 'videos' && "Training & Guidance Videos"}
            </h1>
            {activeTab !== 'voters' && (
              <p className="text-xs font-medium text-gray-500 mt-1">
                {activeTab === 'dashboard' && "Live analytics from your assigned voters."}
                {activeTab === 'fake-doubtful' && "Purify voters database by auditing fake, duplicate, shifted, or deceased listings."}
                {activeTab === 'tasks' && "Keep track of active door-to-door campaigning instructions assigned by leadership."}
                {activeTab === 'videos' && "Enhance campaign efficiency with video training guides and political operation rules."}
              </p>
            )}
          </div>
          {activeTab === 'voters' ? (
            <div className="flex items-center gap-3 self-end md:self-center">
              <span className="bg-slate-50 border border-slate-200 text-slate-700 font-extrabold px-3.5 py-1.5 rounded-lg text-xs shadow-sm uppercase tracking-wider">
                {session.assignedBooth?.split(' (')[0] || "Booth 112A"}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-end shrink-0 bg-white border border-gray-100 p-3 rounded-lg shadow-sm text-right">
              <div className="flex items-center gap-1.5 text-xs font-bold text-green-600">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Data Synced with Command Center
              </div>
              <p className="text-[10px] text-gray-400 font-semibold uppercase mt-1">Updated: Just now</p>
            </div>
          )}
        </div>

        {/* --------------------------------------------------------
            TAB 1: DASHBOARD MAIN PAGE
           -------------------------------------------------------- */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6" id="dashboard-tab-view">
            
            {/* ELECTION FORECAST BANNER */}
            <div className="relative bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-6 md:p-8 shadow-md overflow-hidden border border-slate-800" id="forecast-banner">
              {/* background decoration pattern */}
              <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-5 pointer-events-none bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] from-yellow-400 via-transparent to-transparent"></div>
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-yellow-400/20 text-yellow-400 text-[10px] font-black uppercase tracking-widest rounded">
                      Election Forecast / Result
                    </span>
                  </div>
                  
                  <h2 className="text-3xl font-black tracking-tight" id="forecast-lead-title">
                    {forecast.status === 'TOO CLOSE TO CALL' ? (
                      <span className="text-orange-400">TOO CLOSE TO CALL</span>
                    ) : (
                      <>
                        <span className="text-yellow-400">{forecast.status.split(' ')[0]}</span>{' '}
                        <span className="text-white">LEADS</span>
                      </>
                    )}
                  </h2>
                  
                  <p className="text-lg font-bold text-gray-300">
                    {forecast.status === 'TOO CLOSE TO CALL' ? (
                      "Voter support is perfectly split."
                    ) : (
                      <>by <span className="text-yellow-400 text-xl font-extrabold">{forecast.lead}</span> Votes</>
                    )}
                  </p>
                  
                  <p className="text-xs text-gray-400 font-medium">
                    Based on 100 voters in this assigned area.
                  </p>
                </div>
                
                {/* Trophy Graphic */}
                <div className="p-4 bg-slate-800 rounded-2xl border border-slate-700/60 flex items-center justify-center shrink-0 shadow">
                  <Award className="w-12 h-12 text-yellow-400" />
                </div>
              </div>
            </div>

            {/* TOP 4 ANALYTICS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="analytics-grid">
              
              {/* Card 1: Total Voters */}
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Total Voters</p>
                <h3 className="text-3xl font-black text-slate-950">{totalVoters}</h3>
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-slate-900">
                  <span className="text-slate-500 font-semibold">100% Verified</span>
                  <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded font-black uppercase">Verified</span>
                </div>
              </div>

              {/* Card 2: TDP Supporters */}
              <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                <p className="text-xs font-black text-amber-700 uppercase tracking-wider">TDP Supporters</p>
                <h3 className="text-3xl font-black text-amber-500">{stats.TDP}</h3>
                <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs font-bold text-amber-600">
                  <span className="text-amber-600 font-black">{((stats.TDP / totalVoters) * 100).toFixed(1)}% of total</span>
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-black uppercase font-mono">TDP</span>
                </div>
              </div>

              {/* Card 3: Neutral / Swing */}
              <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Neutral / Swing</p>
                <h3 className="text-3xl font-black text-slate-600">{stats.Neutral}</h3>
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-bold text-slate-500">
                  <span className="text-slate-500 font-semibold">Target for Conversion</span>
                  <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-black">High Priority</span>
                </div>
              </div>

              {/* Card 4: Fake Votes */}
              <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-3" id="fake-votes-card">
                <p className="text-xs font-black text-rose-700 uppercase tracking-wider">Fake Votes</p>
                <h3 className="text-3xl font-black text-rose-600">{voters.filter(v => v.voterStatus === 'Fake').length}</h3>
                <div className="pt-2 border-t border-rose-200/60 flex items-center justify-between text-xs font-bold text-rose-700">
                  <span className="font-semibold">Action Required</span>
                  <span className="text-[10px] bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded font-black uppercase">Flagged</span>
                </div>
              </div>

            </div>

            {/* GROUND REPORT BREAKDOWN & DONUT CHART & REPORT SUBMISSION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* LEFT COLUMN: GROUND REPORT BREAKDOWN */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Ground Report Breakdown Cards */}
                <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h3 className="font-bold text-base text-gray-900">Ground Report Breakdown</h3>
                    <span className="text-xs font-bold text-gray-400 uppercase">Total: {totalVoters} Voters</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    {(['TDP', 'YSRCP', 'JSP', 'BJP', 'INC', 'Neutral', 'OTH'] as VoterPreference[]).map((key) => {
                      const count = stats[key];
                      const pct = Math.round((count / totalVoters) * 100);
                      const colorInfo = PARTY_COLORS[key];
                      
                      return (
                        <div 
                          key={key} 
                          className="bg-slate-50 border border-gray-100 hover:border-gray-200 rounded-xl p-3 flex flex-col items-center justify-between text-center space-y-2 transition-all shadow-sm"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2.5 h-2.5 rounded-full ${colorInfo.bg}`}></span>
                            <span className="text-xs font-bold text-slate-700">{key}</span>
                          </div>
                          
                          <div className="space-y-0.5">
                            <p className="text-xl font-black text-slate-900">{count}</p>
                            <p className="text-[10px] text-slate-500 font-bold">Votes</p>
                          </div>
                          
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${colorInfo.lightBg || 'bg-slate-100'} ${colorInfo.darkText || 'text-slate-800'}`}>
                            {pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* VOTER SENTIMENT SHARE DONUT CHART */}
                <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                  <div className="border-b border-gray-100 pb-3 mb-5">
                    <h3 className="font-bold text-base text-gray-900">Voter Sentiment Share</h3>
                    <p className="text-xs text-gray-400 font-medium">Interactive breakdown of 7 registered categories.</p>
                  </div>

                  <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-4">
                    {/* SVG Donut Chart */}
                    <div className="relative w-48 h-48 flex items-center justify-center">
                      <svg width="100%" height="100%" viewBox="0 0 120 120" className="-rotate-90">
                        {donutChartData.map((slice) => {
                          // Standard strokeDasharray calculations for circle radius=45 (circumference = 282.7)
                          const r = 40;
                          const circ = 2 * Math.PI * r;
                          const strokeDashOffset = circ - (circ * slice.percentage) / 100;
                          const rotationAngle = (slice.startValue / 100) * 360;

                          return (
                            <circle
                              key={slice.key}
                              cx="60"
                              cy="60"
                              r={r}
                              fill="transparent"
                              stroke={slice.color}
                              strokeWidth="14"
                              strokeDasharray={circ}
                              strokeDashoffset={strokeDashOffset}
                              transform={`rotate(${rotationAngle} 60 60)`}
                              className="transition-[stroke-width,stroke] duration-200 cursor-pointer hover:stroke-[16px]"
                              onMouseEnter={() => setHoveredSlice(slice.key)}
                              onMouseLeave={() => setHoveredSlice(null)}
                            />
                          );
                        })}
                      </svg>

                      {/* Hover text in center */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
                        {hoveredSlice ? (
                          <>
                            <span className="text-xs font-black uppercase text-slate-400">{hoveredSlice}</span>
                            <span className="text-xl font-black text-slate-900">{stats[hoveredSlice as VoterPreference]}</span>
                            <span className="text-[10px] font-bold text-slate-500">
                              {Math.round((stats[hoveredSlice as VoterPreference] / totalVoters) * 100)}% Share
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] font-bold uppercase text-slate-400">Total</span>
                            <span className="text-2xl font-black text-slate-900">{totalVoters}</span>
                            <span className="text-[9px] font-semibold text-green-600 uppercase">Voters</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Legends table */}
                    <div className="grid grid-cols-2 md:grid-cols-1 gap-3 w-full max-w-xs text-xs font-bold">
                      {donutChartData.map((slice) => (
                        <div 
                          key={slice.key} 
                          className={`flex items-center justify-between p-2 rounded-lg transition-colors ${hoveredSlice === slice.key ? 'bg-slate-50 border border-gray-200' : 'border border-transparent'}`}
                          onMouseEnter={() => setHoveredSlice(slice.key)}
                          onMouseLeave={() => setHoveredSlice(null)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-3.5 h-3.5 rounded" style={{ backgroundColor: slice.color }}></span>
                            <span className="text-slate-700">{slice.key}</span>
                          </div>
                          <span className="text-slate-900 ml-auto">{slice.value} Voters ({Math.round(slice.percentage)}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: REPORT SUBMISSION PANEL */}
              <div className="space-y-6">
                <SendReportPanel onAddReport={handleAddReport} reports={reports} />
              </div>

            </div>

          </div>
        )}

        {/* --------------------------------------------------------
            TAB 2: VOTERS LIST PAGE
           -------------------------------------------------------- */}
        {activeTab === 'voters' && (
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-6" id="voters-tab-view">
            
            {/* Search and Filters panel */}
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-3">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    placeholder="Search name, phone, booth..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-yellow-400 focus:outline-none transition-all placeholder:text-gray-400 font-extrabold"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-3.5 text-gray-400 hover:text-slate-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Compact Filters row */}
              <div className="flex flex-wrap items-center gap-4 bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-xs font-bold text-slate-600">
                {/* 1. Preference Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 uppercase tracking-wider text-[10px] font-black">Preference:</span>
                  <select
                    value={prefFilter}
                    onChange={(e) => setPrefFilter(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:border-yellow-400 cursor-pointer"
                  >
                    <option value="ALL">All</option>
                    <option value="TDP">TDP</option>
                    <option value="YSRCP">YSRCP</option>
                    <option value="JSP">JSP</option>
                    <option value="BJP">BJP</option>
                    <option value="INC">INC</option>
                    <option value="Neutral">Neutral</option>
                    <option value="OTH">OTH</option>
                  </select>
                </div>

                {/* 2. Voter Status Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 uppercase tracking-wider text-[10px] font-black">Status:</span>
                  <select
                    value={voterStatusFilter}
                    onChange={(e) => setVoterStatusFilter(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:border-yellow-400 cursor-pointer"
                  >
                    <option value="ALL">All</option>
                    <option value="Active">Active</option>
                    <option value="Fake">Fake</option>
                    <option value="Doubtful">Doubtful</option>
                    <option value="Shifted">Shifted</option>
                    <option value="Deceased">Deceased</option>
                    <option value="Duplicate">Duplicate</option>
                  </select>
                </div>

                {/* 3. Location Filter */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 uppercase tracking-wider text-[10px] font-black">Location:</span>
                    <select
                      value={locationFilter}
                      onChange={(e) => setLocationFilter(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:border-yellow-400 cursor-pointer"
                    >
                      <option value="ALL">All ({totalCount})</option>
                      <option value="Local">Local ({localCount})</option>
                      <option value="Migrated">Migrated ({migratedCount})</option>
                    </select>
                  </div>

                  {/* Summary Block below select */}
                  <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 rounded-lg p-1.5 w-fit" id="voter100-migration-summary">
                    <div className="flex items-baseline gap-1 text-[9px] font-bold text-slate-600">
                      <span>Local:</span>
                      <span className="text-slate-900 font-black">{localCount}</span>
                      <span className="text-[8px] text-slate-400">({localPercent}%)</span>
                    </div>
                    <div className="h-3 w-px bg-slate-200"></div>
                    <div className="flex items-baseline gap-1 text-[9px] font-bold text-slate-600">
                      <span>Migrated:</span>
                      <span className="text-slate-900 font-black">{migratedCount}</span>
                      <span className="text-[8px] text-slate-400">({migratedPercent}%)</span>
                    </div>
                  </div>
                </div>

                {/* Results Counter */}
                <div className="ml-auto text-slate-400 uppercase tracking-wider text-[10px] font-black">
                  Found: <span className="text-slate-800 font-extrabold">{filteredVoters.length}</span> / 100
                </div>
              </div>
            </div>

            {/* Voter list Grid */}
            <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200 text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
                    <th className="px-6 py-4 text-center w-20">S.NO</th>
                    <th className="px-6 py-4">VOTER NAME / INFO</th>
                    <th className="px-6 py-4">DETAILS</th>
                    <th className="px-6 py-4">PREFERENCE</th>
                    <th className="px-6 py-4">VOTER STATUS</th>
                    <th className="px-6 py-4 text-center w-28">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs font-semibold">
                  {filteredVoters.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-400 font-bold">
                        No voter records match the active search or filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedVoters.map((v) => {
                      return (
                        <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* S.NO */}
                          <td className="px-6 py-5 text-center font-mono text-slate-400 font-bold text-sm">
                            {v.serialNumber}
                          </td>
                          
                          {/* VOTER NAME / INFO */}
                          <td className="px-6 py-5">
                            <div className="space-y-1">
                              <h4 className="font-extrabold text-slate-900 text-sm tracking-tight">{v.name}</h4>
                              <p className="text-xs text-slate-500">
                                {v.relationType || 'Father'}: {v.fatherHusbandName}
                              </p>
                              <p className="text-[11px] text-slate-400 font-mono tracking-wide">
                                EPIC: {v.epicNumber}
                              </p>
                              {(() => {
                                const mob = v.mobileNumber ? v.mobileNumber.trim() : '';
                                const isInvalidMob = !mob || 
                                  ['n/a', 'na', 'no mobile', 'no mobile number', '0000000000', 'dummy number', 'dummy', 'none', 'N/A', 'No Mobile', 'None'].includes(mob) || 
                                  /^0+$/.test(mob);
                                if (!isInvalidMob) {
                                  return (
                                    <p className="text-[11px] text-slate-500 font-mono">
                                      Mob: +91 {mob}
                                    </p>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </td>

                          {/* DETAILS */}
                          <td className="px-6 py-5">
                            <div className="space-y-1">
                              <p className="text-sm font-extrabold text-slate-800">
                                H.No: {v.houseNumber}
                              </p>
                              <p className="text-xs text-slate-500">
                                {v.gender} • Age: {v.age}
                              </p>
                            </div>
                          </td>

                          {/* PREFERENCE */}
                          <td className="px-6 py-5">
                            {(() => {
                              switch (v.politicalPreference) {
                                case 'TDP':
                                  return <span className="inline-flex px-2.5 py-1 text-[10px] font-black tracking-wider uppercase rounded bg-yellow-400 text-slate-950 shadow-sm">TDP</span>;
                                case 'YSRCP':
                                  return <span className="inline-flex px-2.5 py-1 text-[10px] font-black tracking-wider uppercase rounded bg-blue-600 text-white shadow-sm">YSRCP</span>;
                                case 'JSP':
                                  return <span className="inline-flex px-2.5 py-1 text-[10px] font-black tracking-wider uppercase rounded bg-red-600 text-white shadow-sm">JSP</span>;
                                case 'BJP':
                                  return <span className="inline-flex px-2.5 py-1 text-[10px] font-black tracking-wider uppercase rounded bg-orange-500 text-white shadow-sm">BJP</span>;
                                case 'INC':
                                  return <span className="inline-flex px-2.5 py-1 text-[10px] font-black tracking-wider uppercase rounded bg-sky-400 text-sky-950 shadow-sm">INC</span>;
                                case 'Neutral':
                                  return <span className="inline-flex px-2.5 py-1 text-[10px] font-black tracking-wider uppercase rounded bg-slate-300 text-slate-800 shadow-sm">Neutral</span>;
                                case 'OTH':
                                default:
                                  return <span className="inline-flex px-2.5 py-1 text-[10px] font-black tracking-wider uppercase rounded bg-purple-600 text-white shadow-sm">OTH</span>;
                              }
                            })()}
                          </td>

                          {/* VOTER STATUS */}
                          <td className="px-6 py-5">
                            {(() => {
                              const normStatus = (v.voterStatus || 'Active').toUpperCase();
                              switch (normStatus) {
                                case 'ACTIVE':
                                  return <span className="inline-flex px-2 py-0.5 text-[10px] font-black tracking-wider uppercase rounded bg-green-100 text-green-800">ACTIVE</span>;
                                case 'FAKE':
                                  return <span className="inline-flex px-2 py-0.5 text-[10px] font-black tracking-wider uppercase rounded bg-red-100 text-red-800">FAKE</span>;
                                case 'DUPLICATE':
                                  return <span className="inline-flex px-2 py-0.5 text-[10px] font-black tracking-wider uppercase rounded bg-red-100 text-red-800">DUPLICATE</span>;
                                case 'DOUBTFUL':
                                  return <span className="inline-flex px-2 py-0.5 text-[10px] font-black tracking-wider uppercase rounded bg-orange-100 text-orange-800">DOUBTFUL</span>;
                                case 'SHIFTED':
                                  return <span className="inline-flex px-2 py-0.5 text-[10px] font-black tracking-wider uppercase rounded bg-sky-100 text-sky-800">SHIFTED</span>;
                                case 'DECEASED':
                                  return <span className="inline-flex px-2 py-0.5 text-[10px] font-black tracking-wider uppercase rounded bg-gray-100 text-gray-500">DECEASED</span>;
                                case 'UNKNOWN':
                                default:
                                  return <span className="inline-flex px-2 py-0.5 text-[10px] font-black tracking-wider uppercase rounded bg-slate-100 text-slate-600">UNKNOWN</span>;
                              }
                            })()}
                          </td>

                          {/* ACTION */}
                          <td className="px-6 py-5">
                            <div className="flex items-center justify-center gap-2.5">
                              {/* Call button */}
                              <a
                                href={v.mobileNumber ? `tel:${v.mobileNumber}` : '#'}
                                className={`w-9 h-9 rounded-full border border-green-200 flex items-center justify-center transition-all ${
                                  v.mobileNumber 
                                    ? 'hover:bg-green-50 text-green-600 active:scale-90 hover:scale-105' 
                                    : 'opacity-40 cursor-not-allowed text-gray-300'
                                }`}
                                onClick={(e) => {
                                  if (!v.mobileNumber) {
                                    e.preventDefault();
                                  }
                                }}
                                title={v.mobileNumber ? `Call ${v.name} (+91 ${v.mobileNumber})` : 'No phone number available'}
                              >
                                <Phone className="w-4 h-4 fill-none" />
                              </a>

                              {/* Edit button */}
                              <button
                                onClick={() => setEditingVoter(v)}
                                className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-500 hover:text-slate-800 active:scale-90 hover:scale-105 transition-all cursor-pointer"
                                title="Edit Voter Details"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              <Pagination
                currentPage={voterPage}
                totalItems={filteredVoters.length}
                pageSize={voterPageSize}
                onPageChange={setVoterPage}
                onPageSizeChange={setVoterPageSize}
                pageSizeOptions={[10, 20, 50, 100]}
                itemLabel="voters"
              />
            </div>

          </div>
        )}

        {/* --------------------------------------------------------
            TAB 2.5: LIVE VOTER TRACK (Election Day)
           -------------------------------------------------------- */}
        {activeTab === 'live-track' && (() => {
          const voteDoneCount = voters.filter(v => v.voteStatus === 'VOTE DONE').length;
          const yetToVoteCount = totalVoters - voteDoneCount;
          const turnoutPercentage = totalVoters > 0 ? Math.round((voteDoneCount / totalVoters) * 100) : 0;

          return (
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-6" id="live-voter-track-view">
              
              {/* Title Header */}
              <div className="border-b border-gray-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base text-gray-900">Live Voter Track</h3>
                  <p className="text-xs text-gray-400 font-medium">Election Day Voter Turnout & Field Assessment</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-xs font-bold text-green-700 font-mono">Live Uplink Active</span>
                </div>
              </div>

              {/* 4 Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-sm min-h-[90px]">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Assigned Voters</span>
                  <p className="text-3xl font-black text-slate-950">{totalVoters}</p>
                </div>
                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 flex flex-col justify-between shadow-sm min-h-[90px]">
                  <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Vote Done</span>
                  <p className="text-3xl font-black text-emerald-600">{voteDoneCount}</p>
                </div>
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 flex flex-col justify-between shadow-sm min-h-[90px]">
                  <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Yet to Vote</span>
                  <p className="text-3xl font-black text-amber-500">{yetToVoteCount}</p>
                </div>
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex flex-col justify-between shadow-sm min-h-[90px]">
                  <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider">Turnout</span>
                  <p className="text-3xl font-black text-blue-600">{turnoutPercentage}%</p>
                </div>
              </div>

              {/* Live Field Assessment (Only counts marked "Vote Done") */}
              <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                  <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide">Live Field Assessment</h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                  {(['TDP', 'YSRCP', 'JSP', 'BJP', 'INC', 'Neutral', 'OTH', 'Unknown'] as const).map((key) => {
                    const count = liveAssessmentStats[key] || 0;
                    
                    // Style logic based on colors requested
                    let colorBg = 'bg-slate-500';
                    let colorText = 'text-slate-800';
                    if (key === 'TDP') { colorBg = 'bg-yellow-400'; colorText = 'text-yellow-800'; }
                    else if (key === 'YSRCP') { colorBg = 'bg-blue-600'; colorText = 'text-white'; }
                    else if (key === 'JSP') { colorBg = 'bg-red-600'; colorText = 'text-white'; }
                    else if (key === 'BJP') { colorBg = 'bg-orange-500'; colorText = 'text-white'; }
                    else if (key === 'INC') { colorBg = 'bg-sky-400'; colorText = 'text-sky-950'; }
                    else if (key === 'Neutral') { colorBg = 'bg-gray-400'; colorText = 'text-gray-800'; }
                    else if (key === 'OTH') { colorBg = 'bg-purple-600'; colorText = 'text-white'; }

                    return (
                      <div 
                        key={key} 
                        className="bg-slate-50 border border-gray-100 rounded-lg p-2.5 flex flex-col items-center justify-center text-center space-y-1 hover:border-gray-200 transition-all shadow-sm"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${colorBg}`}></span>
                          <span className="text-[10px] font-bold text-slate-600">{key}</span>
                        </div>
                        <p className="text-base font-black text-slate-900">{count}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Search and Filters panel */}
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search by Voter Name, EPIC No, Serial No, Mobile Number..."
                    value={liveSearchQuery}
                    onChange={(e) => setLiveSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:border-yellow-400 focus:outline-none transition-all placeholder:text-gray-400"
                  />
                  {liveSearchQuery && (
                    <button 
                      onClick={() => setLiveSearchQuery('')}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-slate-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Filters Option: All, Vote Done, Not Voted */}
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
                  {(['ALL', 'DONE', 'NOT_VOTED'] as const).map((filterOpt) => (
                    <button
                      key={filterOpt}
                      type="button"
                      onClick={() => setLiveFilter(filterOpt)}
                      className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                        liveFilter === filterOpt 
                          ? 'bg-yellow-400 text-slate-950 shadow-sm font-black' 
                          : 'text-slate-600 hover:text-slate-950 font-bold'
                      }`}
                    >
                      {filterOpt === 'ALL' ? 'All' : filterOpt === 'DONE' ? 'Vote Done' : 'Not Voted'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Voter List Grid */}
              <div className="overflow-x-auto border border-gray-100 rounded-xl shadow-inner">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                      <th className="px-4 py-3 text-center w-12">S.No</th>
                      <th className="px-4 py-3">Voter Name</th>
                      <th className="px-4 py-3">EPIC No</th>
                      <th className="px-4 py-3">Age / Gender</th>
                      <th className="px-4 py-3">Mobile</th>
                      <th className="px-4 py-3">Vote Status</th>
                      <th className="px-4 py-3">Incharge Assessment</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs font-semibold">
                    {liveFilteredVoters.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-gray-400 font-bold">
                          No voter records found in this selection.
                        </td>
                      </tr>
                    ) : (
                      paginatedLiveVoters.map((v) => {
                        const isVoted = v.voteStatus === 'VOTE DONE';
                        
                        return (
                          <tr key={v.id} className={`hover:bg-slate-50/70 transition-colors ${isVoted ? 'bg-green-50/15' : ''}`}>
                            <td className="px-4 py-4 text-center font-mono text-slate-400 font-bold">
                              {v.serialNumber}
                            </td>
                            <td className="px-4 py-4 font-bold text-slate-900">
                              {v.name}
                            </td>
                            <td className="px-4 py-4 font-mono text-slate-700 tracking-wider font-bold">
                              {v.epicNumber}
                            </td>
                            <td className="px-4 py-4 font-semibold text-slate-600">
                              {v.age} / {v.gender}
                            </td>
                            <td className="px-4 py-4 font-mono text-slate-600 font-bold">
                              {v.mobileNumber ? `+91 ${v.mobileNumber}` : <span className="text-gray-300">--</span>}
                            </td>
                            <td className="px-4 py-4">
                              {isVoted ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 text-[10px] font-black uppercase rounded tracking-wide">
                                    ✓ VOTE DONE
                                  </span>
                                  <span className="block text-[9px] text-slate-400 font-mono font-bold">
                                    {v.voteDoneTime || '09:15 AM'}
                                  </span>
                                </div>
                              ) : (
                                <span className="inline-flex px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-black uppercase rounded tracking-wide">
                                  NOT VOTED
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {isVoted ? (
                                <div className="flex flex-col gap-1">
                                  <select
                                    value={v.inchargeAssessment || 'Unknown'}
                                    onChange={(e) => {
                                      const val = e.target.value as any;
                                      setVoters(prev => prev.map(item => item.id === v.id ? { ...item, inchargeAssessment: val } : item));
                                    }}
                                    className="text-[11px] font-bold p-1 bg-white border border-slate-200 rounded focus:outline-none focus:border-yellow-400 cursor-pointer min-w-[90px]"
                                  >
                                    <option value="TDP">TDP</option>
                                    <option value="YSRCP">YSRCP</option>
                                    <option value="JSP">JSP</option>
                                    <option value="BJP">BJP</option>
                                    <option value="INC">INC</option>
                                    <option value="Neutral">Neutral</option>
                                    <option value="OTH">OTH</option>
                                    <option value="Unknown">Unknown</option>
                                  </select>
                                </div>
                              ) : (
                                <span className="text-gray-300 italic text-[10px]">Mark voted first</span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-right">
                              {!isVoted ? (
                                <button
                                  onClick={() => {
                                    const now = new Date();
                                    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    
                                    setVoters(prev => prev.map(item => item.id === v.id ? { 
                                      ...item, 
                                      voteStatus: 'VOTE DONE',
                                      voteDoneTime: timeString,
                                      inchargeAssessment: item.inchargeAssessment || 'Unknown',
                                      liveTrackCreatedTime: item.liveTrackCreatedTime || new Date().toISOString(),
                                      liveTrackLastUpdatedTime: new Date().toISOString()
                                    } : item));

                                    // Persist vote tracking to backend PostgreSQL database
                                    void markVoteDone(v.id).catch(() => {
                                      void syncVoter({ id: v.id, voteStatus: 'VOTE DONE' as any });
                                    });

                                    // Add to real-time sync ticker log
                                    const newLog = {
                                      id: "SYNC-" + Math.floor(1000 + Math.random() * 9000),
                                      voterName: v.name,
                                      time: timeString,
                                      status: '✓ VOTE DONE',
                                      assessment: v.inchargeAssessment || 'Unknown',
                                      synced: false
                                    };
                                    setLiveSyncQueue(prev => [newLog, ...prev].slice(0, 5));
                                    setTimeout(() => {
                                      setLiveSyncQueue(prev => prev.map(log => log.id === newLog.id ? { ...log, synced: true } : log));
                                    }, 1000);
                                  }}
                                  className="px-2.5 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-slate-950 text-[10px] font-black rounded shadow-sm hover:shadow active:scale-95 transition-all uppercase tracking-wide cursor-pointer"
                                >
                                  MARK VOTE DONE
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    const now = new Date();
                                    setVoters(prev => prev.map(item => item.id === v.id ? { 
                                      ...item, 
                                      liveTrackLastUpdatedTime: now.toISOString()
                                    } : item));

                                    // Trigger immediate sync aggregation stream update
                                    const newLog = {
                                      id: "SYNC-" + Math.floor(1000 + Math.random() * 9000),
                                      voterName: v.name,
                                      time: v.voteDoneTime || now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                      status: '✓ VOTE DONE',
                                      assessment: v.inchargeAssessment || 'Unknown',
                                      synced: false
                                    };
                                    setLiveSyncQueue(prev => [newLog, ...prev].slice(0, 5));
                                    setTimeout(() => {
                                      setLiveSyncQueue(prev => prev.map(log => log.id === newLog.id ? { ...log, synced: true } : log));
                                    }, 1000);
                                  }}
                                  className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-white text-[10px] font-black rounded shadow-sm hover:shadow active:scale-95 transition-all uppercase tracking-wide cursor-pointer"
                                >
                                  SAVE
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                <Pagination
                  currentPage={livePage}
                  totalItems={liveFilteredVoters.length}
                  pageSize={livePageSize}
                  onPageChange={setLivePage}
                  onPageSizeChange={setLivePageSize}
                  pageSizeOptions={[10, 20, 50, 100]}
                  itemLabel="voters"
                />
              </div>

              {/* Real-time sync ticker module */}
              <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-ping"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 absolute"></span>
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-200 pl-3.5">Real-time Synchronization Uplink Active</span>
                  </div>
                  <span className="text-[10px] bg-slate-800 text-yellow-400 font-extrabold px-2.5 py-1 rounded uppercase tracking-wider font-mono">
                    Kondapi Central Aggregator
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                  Data Flow: <span className="text-yellow-400 font-black">100 Voter Incharge ({session.userId})</span> → 
                  <span className="text-slate-200"> Booth ({session.assignedBooth?.split(' ')[1] || '145'})</span> → 
                  <span className="text-slate-200"> Village ({session.assignedVillage})</span> → 
                  <span className="text-slate-200"> Mandal ({session.assignedMandal})</span> → 
                  <span className="text-yellow-400 font-black"> Kondapi Constituency Server</span>
                </p>

                <div className="space-y-2 border-t border-slate-800 pt-3">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Recent Aggregation Sync Activity</span>
                  {liveSyncQueue.length === 0 ? (
                    <div className="text-center py-4 text-slate-500 text-xs font-semibold">
                      Pending updates will automatically sync and aggregate upward in near real-time.
                    </div>
                  ) : (
                    <div className="space-y-1.5 font-mono text-[10px]">
                      {liveSyncQueue.map((log) => (
                        <div key={log.id} className="flex justify-between items-center py-1 border-b border-slate-800/50 last:border-0">
                          <div className="flex items-center gap-2 text-slate-300">
                            <span className="text-slate-500">[{log.time}]</span>
                            <span className="text-yellow-400 font-bold">{log.voterName}</span>
                            <span>has voted.</span>
                            <span>Assessment:</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase text-white ${
                              log.assessment === 'TDP' ? 'bg-yellow-500 text-slate-900' :
                              log.assessment === 'YSRCP' ? 'bg-blue-600' :
                              log.assessment === 'JSP' ? 'bg-red-600' :
                              log.assessment === 'BJP' ? 'bg-orange-500' :
                              log.assessment === 'INC' ? 'bg-sky-400 text-slate-900' :
                              log.assessment === 'Neutral' ? 'bg-gray-400 text-slate-900' :
                              log.assessment === 'OTH' ? 'bg-purple-600' : 'bg-slate-500'
                            }`}>
                              {log.assessment}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {log.synced ? (
                              <>
                                <span className="text-green-400 font-extrabold uppercase text-[9px] tracking-wider">● AGGREGATED</span>
                                <span className="text-slate-500">Ref: {log.id}</span>
                              </>
                            ) : (
                              <span className="text-yellow-400 font-extrabold uppercase text-[9px] tracking-wider animate-pulse">↻ SYNCING...</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          );
        })()}

        {activeTab === 'fake-doubtful' && (
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-6" id="fake-doubtful-tab-view">
            
            {/* Banner of safety */}
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex gap-3">
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-black text-red-950">Electoral Roll Purification Mode Active</h4>
                <p className="text-xs text-red-800 leading-relaxed font-semibold">
                  100 Voter Incharges can report, log, and flag suspicious votes. Official voter records are preserved on central servers, and flagged voters will undergo multiple validation loops by higher authorities. You cannot permanently delete voter entries.
                </p>
              </div>
            </div>

            {/* List of Suspicious voters */}
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-slate-900">Flagged Voter Registry</h3>
              
              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                      <th className="px-4 py-3">S.No</th>
                      <th className="px-4 py-3">Voter Name</th>
                      <th className="px-4 py-3">EPIC / House</th>
                      <th className="px-4 py-3">Flagged Status</th>
                      <th className="px-4 py-3">Reason / Audit Notes</th>
                      <th className="px-4 py-3">Reported By</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs font-semibold">
                    {voters.filter(v => ['Fake', 'Duplicate', 'Doubtful', 'Shifted', 'Deceased'].includes(v.voterStatus)).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-gray-400 font-bold">
                          Excellent! No suspicious or fake votes are flagged inside your 100-voter list.
                        </td>
                      </tr>
                    ) : (
                      voters.filter(v => ['Fake', 'Duplicate', 'Doubtful', 'Shifted', 'Deceased'].includes(v.voterStatus)).map((v) => (
                        <tr key={v.id} className="hover:bg-red-50/20 transition-colors">
                          <td className="px-4 py-4 font-mono text-slate-400 font-bold">{v.serialNumber}</td>
                          <td className="px-4 py-4 font-bold text-slate-900">{v.name}</td>
                          <td className="px-4 py-4 space-y-0.5">
                            <span className="font-mono text-slate-700 block font-bold">{v.epicNumber}</span>
                            <span className="text-[10px] text-gray-400 font-medium">House: {v.houseNumber}</span>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide ${
                              v.voterStatus === 'Fake' ? 'bg-red-100 text-red-800' :
                              v.voterStatus === 'Doubtful' ? 'bg-orange-100 text-orange-800' :
                              'bg-purple-100 text-purple-800'
                            }`}>
                              {v.voterStatus}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-slate-600 max-w-xs font-medium">
                            {v.notes || <span className="text-gray-300 italic">No notes provided</span>}
                          </td>
                          <td className="px-4 py-4 text-[10px] text-slate-400 font-bold">
                            <span>ID: {v.updatedBy}</span>
                            <span className="block">{v.lastUpdated}</span>
                          </td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => setEditingVoter(v)}
                              className="px-2.5 py-1 bg-white border border-gray-200 text-[10px] font-bold rounded hover:bg-gray-50 text-gray-700 shadow-sm cursor-pointer"
                            >
                              Update Status
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* --------------------------------------------------------
            TAB 4: ACTIVE OPERATIONS TASKS
           -------------------------------------------------------- */}
        {activeTab === 'tasks' && (
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-6" id="tasks-tab-view">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base text-gray-900">Campaign Operations Checklist</h3>
              <p className="text-xs text-gray-400 font-medium">Complete tasks dispatched from constituency level commands.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tasks.map((task) => (
                <div 
                  key={task.id} 
                  className={`border rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-sm transition-all ${
                    task.status === 'Completed' ? 'bg-green-50/40 border-green-100' : 
                    task.priority === 'Urgent' ? 'bg-red-50/40 border-red-100' : 'bg-white border-gray-100'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                        task.priority === 'Urgent' ? 'bg-red-100 text-red-800' :
                        task.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {task.priority} Priority
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold">Due: {task.dueDate}</span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm">{task.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed font-semibold">{task.instructions}</p>
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex flex-col gap-2">
                    <div className="text-[10px] text-gray-400 font-bold flex justify-between">
                      <span>Assigned By: {task.assignedBy}</span>
                      <span>Date: {task.assignedDate}</span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-xs font-bold text-gray-400">Status:</span>
                      <select
                        value={task.status}
                        onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value as any)}
                        className={`text-xs font-bold p-1 border rounded cursor-pointer focus:outline-none ${
                          task.status === 'Completed' ? 'bg-green-100 text-green-800 border-green-200' :
                          task.status === 'In Progress' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                          'bg-slate-100 text-slate-800 border-slate-200'
                        }`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* --------------------------------------------------------
            TAB 5: TRAINING VIDEOS PAGE
           -------------------------------------------------------- */}
        {activeTab === 'videos' && (
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-6" id="videos-tab-view">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base text-gray-900">Worker Empowerment Academy</h3>
              <p className="text-xs text-gray-400 font-medium">Educational guides on operating digital systems, compliance regulations, and voter campaigning rules.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {trainingVideos.map((video) => {
                const progress = trainingProgress[video.id];
                const progressLabel = progress?.status === 'COMPLETED'
                  ? 'Completed'
                  : progress?.status === 'WATCHED'
                    ? 'Watched'
                    : progress?.status === 'ASSIGNED'
                      ? 'Assigned'
                      : 'Not Started';

                return (
                <div key={video.id} className="border border-gray-100 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between">
                  <div className="relative h-44 bg-slate-100 group">
                    <img 
                      src={video.thumbnailUrl} 
                      alt={video.title} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center group-hover:bg-slate-900/50 transition-colors">
                      <button 
                        onClick={() => handleWatchTraining(video)}
                        className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center text-slate-950 hover:scale-105 transition-transform shadow-md cursor-pointer"
                      >
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </button>
                    </div>
                    <span className="absolute bottom-2 right-2 bg-slate-900/80 text-white text-[10px] font-black px-2 py-0.5 rounded">
                      {video.duration}
                    </span>
                  </div>

                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase font-black tracking-wider text-yellow-600 font-sans">
                          {video.category}
                        </span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                          progress?.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : progress?.status === 'WATCHED'
                              ? 'bg-blue-100 text-blue-700'
                              : progress?.status === 'ASSIGNED'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-500'
                        }`}>
                          {progressLabel}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs">{video.title}</h4>
                      <p className="text-[11px] text-gray-500 leading-relaxed font-semibold">{video.description}</p>
                    </div>

                    <button 
                      onClick={() => handleWatchTraining(video)}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg shadow-sm transition-colors mt-3 cursor-pointer"
                    >
                      Watch Video Guide
                    </button>
                  </div>
                </div>
              )})}
            </div>

          </div>
        )}
        </div>
      </main>

      {/* --------------------------------------------------------
          MODAL: EDIT VOTER SURVEY DIALOG (Compact Edit Voter Details)
         -------------------------------------------------------- */}
      {editingVoter && (
        <div className="fixed inset-0 bg-slate-950/50 flex items-center justify-center z-50 p-4" id="edit-survey-modal">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[95vh]">
            {/* Header */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm tracking-tight text-white">Edit Voter Details</h3>
                <p className="text-[11px] text-slate-300 font-bold">
                  S.No: {editingVoter.serialNumber} • {editingVoter.name}
                </p>
              </div>
              <button 
                onClick={() => setEditingVoter(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Form */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                // Ensure if they are currently on 'Not Surveyed', we upgrade them to 'Surveyed' upon being edited
                const finalVoter: Voter = {
                  ...editingVoter,
                  surveyStatus: editingVoter.surveyStatus === 'Not Surveyed' ? 'Surveyed' : editingVoter.surveyStatus,
                  voterLocationStatus: editingVoter.voterLocationStatus || 'Local',
                  currentLocation: editingVoter.voterLocationStatus === 'Migrated' ? (editingVoter.currentLocation || '') : ''
                };
                handleSaveVoterSurvey(finalVoter);
                setEditingVoter(null);
              }}
              className="p-5 space-y-4 overflow-y-auto"
            >
              
              {/* 1. VOTER CHOICE */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">1. Voter Choice</label>
                <div className="space-y-2">
                  {/* Row 1: TDP, YSRCP, JSP, BJP */}
                  <div className="grid grid-cols-4 gap-2">
                    {(['TDP', 'YSRCP', 'JSP', 'BJP'] as VoterPreference[]).map((pref) => {
                      const isSelected = editingVoter.politicalPreference === pref;
                      return (
                        <button
                          key={pref}
                          type="button"
                          onClick={() => setEditingVoter({ ...editingVoter, politicalPreference: pref })}
                          className={`py-2 text-xs rounded-lg border text-center transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-yellow-400 text-slate-950 border-yellow-400 font-black shadow-sm' 
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 font-bold'
                          }`}
                        >
                          {pref}
                        </button>
                      );
                    })}
                  </div>
                  {/* Row 2: INC, Neutral, OTH */}
                  <div className="grid grid-cols-3 gap-2">
                    {(['INC', 'Neutral', 'OTH'] as VoterPreference[]).map((pref) => {
                      const isSelected = editingVoter.politicalPreference === pref;
                      return (
                        <button
                          key={pref}
                          type="button"
                          onClick={() => setEditingVoter({ ...editingVoter, politicalPreference: pref })}
                          className={`py-2 text-xs rounded-lg border text-center transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-yellow-400 text-slate-950 border-yellow-400 font-black shadow-sm' 
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 font-bold'
                          }`}
                        >
                          {pref === 'OTH' ? 'OTH' : pref}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 2. MOBILE NUMBER */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">2. Mobile Number</label>
                <div className="flex rounded-lg border border-slate-200 bg-slate-50 overflow-hidden focus-within:border-yellow-400 focus-within:bg-white transition-all">
                  <span className="flex items-center justify-center px-3 border-r border-slate-200 text-xs font-bold text-slate-500 bg-slate-100/50 select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={editingVoter.mobileNumber || ''}
                    onChange={(e) => setEditingVoter({ ...editingVoter, mobileNumber: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3 py-1.5 text-sm text-slate-800 bg-transparent focus:outline-none placeholder:text-gray-300 font-bold"
                    placeholder="Enter 10-digit mobile number"
                  />
                </div>
              </div>

              {/* 3. CASTE AND SUB CASTE */}
              <div className="space-y-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Caste</label>
                    <input
                      type="text"
                      autoComplete="off"
                      value={editingVoter.caste || ''}
                      onChange={(e) => setEditingVoter({ ...editingVoter, caste: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:border-yellow-400 focus:outline-none placeholder:text-gray-400"
                      placeholder="Enter Caste"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Sub Caste</label>
                    <select
                      value={editingVoter.subCaste || ''}
                      onChange={(e) => setEditingVoter({ ...editingVoter, subCaste: e.target.value })}
                      className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-yellow-400 cursor-pointer"
                    >
                      <option value="" disabled>Select Category ▼</option>
                      <option value="SC">SC</option>
                      <option value="ST">ST</option>
                      <option value="BC">BC</option>
                      <option value="OC">OC</option>
                      <option value="OBC">OBC</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 4. PROFESSION */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">4. Profession</label>
                <select
                  value={
                    !editingVoter.profession 
                      ? "" 
                      : PROFESSION_PRESETS.includes(editingVoter.profession) 
                        ? editingVoter.profession 
                        : "Other"
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "Other") {
                      setEditingVoter({ ...editingVoter, profession: "Other" });
                    } else {
                      setEditingVoter({ ...editingVoter, profession: val });
                    }
                  }}
                  className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-yellow-400 cursor-pointer"
                >
                  <option value="" disabled>Select / Enter Profession</option>
                  {PROFESSION_PRESETS.map(prof => (
                    <option key={prof} value={prof}>{prof}</option>
                  ))}
                  <option value="Other">Other</option>
                </select>
                
                {(editingVoter.profession === "Other" || (editingVoter.profession && !PROFESSION_PRESETS.includes(editingVoter.profession))) && (
                  <input
                    type="text"
                    value={editingVoter.profession === "Other" ? "" : editingVoter.profession}
                    onChange={(e) => setEditingVoter({ ...editingVoter, profession: e.target.value })}
                    className="w-full mt-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:border-yellow-400 focus:outline-none"
                    placeholder="Enter Custom Profession"
                  />
                )}
              </div>

              {/* 5. VOTER LOCATION STATUS */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">5. Voter Location Status</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingVoter({ ...editingVoter, voterLocationStatus: 'Local', currentLocation: '' })}
                    className={`py-2 text-xs rounded-lg border text-center transition-all cursor-pointer ${
                      editingVoter.voterLocationStatus === 'Local' || !editingVoter.voterLocationStatus
                        ? 'bg-yellow-400 text-slate-950 border-yellow-400 font-black shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 font-bold'
                    }`}
                  >
                    LOCAL
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingVoter({ ...editingVoter, voterLocationStatus: 'Migrated' })}
                    className={`py-2 text-xs rounded-lg border text-center transition-all cursor-pointer ${
                      editingVoter.voterLocationStatus === 'Migrated'
                        ? 'bg-yellow-400 text-slate-950 border-yellow-400 font-black shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 font-bold'
                    }`}
                  >
                    MIGRATED
                  </button>
                </div>
              </div>

              {/* 6. CURRENT LOCATION (show ONLY if Migrated) */}
              {editingVoter.voterLocationStatus === 'Migrated' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">6. Current Location</label>
                  <input
                    type="text"
                    value={editingVoter.currentLocation || ''}
                    onChange={(e) => setEditingVoter({ ...editingVoter, currentLocation: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:border-yellow-400 focus:outline-none placeholder:text-gray-400"
                    placeholder="Enter City / State / Country"
                  />
                </div>
              )}

              {/* 7. SAVE BUTTON */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-slate-950 text-xs font-black rounded-lg shadow-sm hover:shadow active:scale-[0.98] transition-all uppercase tracking-wider cursor-pointer"
                >
                  SAVE / UPDATE VOTER
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------
          MODAL: WATCH TRAINING VIDEO PLAYER
         -------------------------------------------------------- */}
      {watchingVideo && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4" id="video-player-modal">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-100">
            {/* Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm text-yellow-400">{watchingVideo.title}</h3>
              <button 
                onClick={() => setWatchingVideo(null)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Embedded player mockup */}
            <div className="relative aspect-video bg-black flex items-center justify-center text-white">
              <div className="text-center space-y-4 p-6">
                <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto shadow-lg animate-pulse">
                  <Play className="w-6 h-6 fill-current ml-1" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold">Mock Training Video Stream Active</p>
                  <p className="text-xs text-gray-400 font-semibold max-w-md mx-auto">
                    In production, this module embeds secure Vimeo/YouTube videos for Kondapi TDP ground volunteers.
                  </p>
                </div>
                <div className="text-xs font-mono bg-slate-900/60 inline-block px-3 py-1.5 rounded text-yellow-400 font-bold border border-slate-800">
                  Worker ID: {session.userId} | Class ID: {watchingVideo.id}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


// --------------------------------------------------------
// AUXILIARY INTERNAL PANEL: SEND REPORT PANEL
// --------------------------------------------------------
interface SendReportPanelProps {
  onAddReport: (report: any) => void;
  reports: GroundReport[];
}

function SendReportPanel({ onAddReport, reports }: SendReportPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<'update' | 'complaint'>('update');

  // General Update fields
  const [generalContent, setGeneralContent] = useState('');

  // Complaint / Issue fields
  const [issueCategory, setIssueCategory] = useState('Voter Slip Issue');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
  const [description, setDescription] = useState('');
  const [affectedVoters, setAffectedVoters] = useState(1);
  
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const handleGeneralSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!generalContent.trim()) return;

    onAddReport({
      reportType: 'General Update',
      priority: 'Low',
      description: generalContent,
    });

    setGeneralContent('');
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  const handleComplaintSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    onAddReport({
      reportType: 'Complaint / Issue',
      priority,
      description,
      issueCategory,
      affectedVotersCount: affectedVoters
    });

    setDescription('');
    setAffectedVoters(1);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-4" id="send-report-panel-container">
      <div className="border-b border-gray-100 pb-2 flex items-center justify-between">
        <h3 className="font-bold text-base text-slate-900">Send Report to Command Center</h3>
        <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
      </div>

      {/* Sub tabs */}
      <div className="flex bg-slate-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveSubTab('update')}
          className={`flex-1 py-1.5 text-center text-[10px] font-black uppercase tracking-wide rounded-md transition-all cursor-pointer ${activeSubTab === 'update' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          General Update
        </button>
        <button
          onClick={() => setActiveSubTab('complaint')}
          className={`flex-1 py-1.5 text-center text-[10px] font-black uppercase tracking-wide rounded-md transition-all cursor-pointer ${activeSubTab === 'complaint' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Complaint / Issue
        </button>
      </div>

      {/* Forms based on active sub tab */}
      {activeSubTab === 'update' ? (
        <form onSubmit={handleGeneralSubmit} className="space-y-3" id="general-update-form">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Ground Feedback & Sentiment</label>
            <textarea
              rows={4}
              value={generalContent}
              onChange={(e) => setGeneralContent(e.target.value)}
              placeholder="Share ground sentiment, local developments, feedback or suggestions..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:outline-none focus:border-yellow-400"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-yellow-400 hover:bg-yellow-500 text-slate-950 text-xs font-black rounded-lg shadow-sm hover:shadow active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            Send Report
          </button>
        </form>
      ) : (
        <form onSubmit={handleComplaintSubmit} className="space-y-3" id="complaint-issue-form">
          {/* Issue Category */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Issue Category</label>
            <select
              value={issueCategory}
              onChange={(e) => setIssueCategory(e.target.value)}
              className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-yellow-400"
            >
              <option value="Voter Slip Issue">Voter Slip Issue</option>
              <option value="Double Voting Alert">Double Voting Alert</option>
              <option value="Booth Infrastructure">Booth Infrastructure</option>
              <option value="Law & Order Concerns">Law & Order Concerns</option>
              <option value="Other Campaign Problem">Other Campaign Problem</option>
            </select>
          </div>

          {/* Priority */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-yellow-400"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>

          {/* Affected Voters count */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Affected Voters Count</label>
            <input
              type="number"
              min={1}
              value={affectedVoters}
              onChange={(e) => setAffectedVoters(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:outline-none focus:border-yellow-400"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Complaint Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the complaint or issue in details..."
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:outline-none focus:border-yellow-400"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-yellow-400 hover:bg-yellow-500 text-slate-950 text-xs font-black rounded-lg shadow-sm hover:shadow active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Submit Issue
          </button>
        </form>
      )}

      {/* Success alert message */}
      {showSuccessToast && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-[11px] font-black rounded-lg flex items-center gap-2 animate-pulse">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          Report successfully queued & uploaded to Command Center!
        </div>
      )}

      {/* Reports history log inside widget */}
      <div className="space-y-2 pt-2 border-t border-gray-100">
        <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">My Dispatched Reports ({reports.length})</h4>
        {reports.length === 0 ? (
          <p className="text-[10px] text-gray-300 italic">No reports dispatched in this session.</p>
        ) : (
          <div className="max-h-44 overflow-y-auto space-y-2 font-semibold">
            {reports.map((rep) => (
              <div key={rep.id} className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 space-y-1 text-[11px]">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-bold text-slate-400">ID: {rep.id}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                    rep.reportType === 'Complaint / Issue' ? 'bg-red-100 text-red-800' : 'bg-slate-200 text-slate-800'
                  }`}>
                    {rep.reportType === 'Complaint / Issue' ? rep.issueCategory || 'Complaint' : 'Update'}
                  </span>
                </div>
                <p className="text-slate-800 font-bold">{rep.description}</p>
                <div className="flex justify-between text-[9px] text-gray-400 pt-1 border-t border-gray-100/50">
                  <span>Priority: {rep.priority}</span>
                  <span>{rep.date} {rep.time}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
