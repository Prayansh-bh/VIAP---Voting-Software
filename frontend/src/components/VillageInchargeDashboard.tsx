import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserSession, 
  Voter, 
  VoterPreference, 
  VoterStatus, 
  GroundReport, 
  VoterTask,
  TrainingVideo 
} from '../types';
import { 
  saveVoterRecord 
} from '../utils/boothHelpers';
import { 
  Home, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  Terminal, 
  Calendar, 
  BarChart3, 
  Users, 
  Video, 
  LogOut, 
  Menu, 
  X, 
  ShieldCheck, 
  User, 
  Smartphone, 
  MapPin, 
  Send, 
  AlertCircle, 
  Plus, 
  Check, 
  Filter, 
  Edit2, 
  CheckCircle, 
  TrendingUp, 
  ChevronRight, 
  FileText,
  Clock
} from 'lucide-react';
import {
  createReport,
  createTask,
  ensureTrainingAssigned,
  fetchHierarchySummaryByUser,
  fetchLiveVoteEventsByUser,
  fetchReportsForUnit,
  fetchTasksForUnit,
  fetchTrainingProgress,
  fetchTrainingVideos,
  fetchVotersForUnit,
  fetchCadreNetwork,
  syncVoter,
  type HierarchySummaryPayload,
  type TrainingProgressItem,
  updateTrainingProgress,
} from '../lib/api';
import { createRealtimeSocket, RealtimeVoteEvent } from '../lib/realtime';
import Pagination from './common/Pagination';
import { useNotification } from '../context/NotificationContext';

interface VillageCadreItem {
  id: string;
  name: string;
  mobile: string;
  group: string;
  role: string;
  unitName: string;
  votersCount: number;
}

interface VillageInchargeDashboardProps {
  session: UserSession;
  onLogout: () => void;
}

type TabType = 
  | 'dashboard' 
  | 'voters' 
  | 'live_track' 
  | 'fake_votes' 
  | 'tasks' 
  | 'caste_analytics' 
  | 'cadre_network' 
  | 'training';

const PARTY_COLORS: Record<VoterPreference, string> = {
  TDP: '#eab308',     // Yellow-500
  YSRCP: '#2563eb',   // Blue-600
  JSP: '#dc2626',     // Red-600
  BJP: '#f97316',     // Orange-500
  INC: '#38bdf8',     // Sky-400
  Neutral: '#64748b', // Slate-500
  OTH: '#a855f7'      // Purple-500
};

const PARTY_NAMES: Record<VoterPreference, string> = {
  TDP: 'TDP',
  YSRCP: 'YSRCP',
  JSP: 'JSP',
  BJP: 'BJP',
  INC: 'INC',
  Neutral: 'Neutral',
  OTH: 'OTH'
};

const PARTY_TEXT_COLORS: Record<VoterPreference, string> = {
  TDP: 'text-amber-600',
  YSRCP: 'text-blue-600',
  JSP: 'text-red-600',
  BJP: 'text-orange-600',
  INC: 'text-sky-500',
  Neutral: 'text-slate-500',
  OTH: 'text-purple-600'
};

const PARTY_BG_COLORS: Record<VoterPreference, string> = {
  TDP: 'bg-amber-50 text-amber-800 border-amber-200',
  YSRCP: 'bg-blue-50 text-blue-800 border-blue-200',
  JSP: 'bg-red-50 text-red-800 border-red-200',
  BJP: 'bg-orange-50 text-orange-800 border-orange-200',
  INC: 'bg-sky-50 text-sky-800 border-sky-200',
  Neutral: 'bg-slate-50 text-slate-800 border-slate-200',
  OTH: 'bg-purple-50 text-purple-800 border-purple-200'
};

export default function VillageInchargeDashboard({ session, onLogout }: VillageInchargeDashboardProps) {
  const { notify } = useNotification();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [cadreActiveTab, setCadreActiveTab] = useState<'booth' | 'voter'>('booth');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [voters, setVoters] = useState<Voter[]>([]);
  
  // States for user interaction
  const [searchQuery, setSearchQuery] = useState('');
  const [boothFilter, setBoothFilter] = useState('All');
  const [preferenceFilter, setPreferenceFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All'); // Local vs Migrated
  
  // Pagination states
  const [voterCurrentPage, setVoterCurrentPage] = useState(1);
  const [voterPageSize, setVoterPageSize] = useState(25);
  const [fakeVotersPage, setFakeVotersPage] = useState(1);
  const [fakeVotersPageSize, setFakeVotersPageSize] = useState(15);
  const [cadrePage, setCadrePage] = useState(1);
  const [cadrePageSize, setCadrePageSize] = useState(12);

  // Auto reset page on filter change
  useEffect(() => {
    setVoterCurrentPage(1);
  }, [searchQuery, boothFilter, preferenceFilter, statusFilter, locationFilter]);
  
  // Voter Edit modal state
  const [editingVoter, setEditingVoter] = useState<Voter | null>(null);
  const [editPreference, setEditPreference] = useState<VoterPreference>('Neutral');
  const [editStatus, setEditStatus] = useState<VoterStatus>('Active');
  const [editNotes, setEditNotes] = useState('');
  const [editCaste, setEditCaste] = useState('');
  const [editSubCaste, setEditSubCaste] = useState('');
  const [editProfession, setEditProfession] = useState('');
  const [editLocationStatus, setEditLocationStatus] = useState<'Local' | 'Migrated'>('Local');
  const [editCurrentLocation, setEditCurrentLocation] = useState('');
  const [editVoteStatus, setEditVoteStatus] = useState<'NOT VOTED' | 'VOTE DONE'>('NOT VOTED');
  const [editVoteDoneTime, setEditVoteDoneTime] = useState('');
  const [editInchargeAssessment, setEditInchargeAssessment] = useState<VoterPreference | 'Unknown'>('Unknown');
  
  // Live updates states
  const [recentVoteDoneActivity, setRecentVoteDoneActivity] = useState<{voterName: string, boothName: string, time: string}[]>([]);
  const [backendSummary, setBackendSummary] = useState<HierarchySummaryPayload | null>(null);
  const [trainingVideos, setTrainingVideos] = useState<TrainingVideo[]>([]);
  const [trainingProgress, setTrainingProgress] = useState<Record<string, TrainingProgressItem>>({});

  // Ground Reports states
  const [reportTab, setReportTab] = useState<'update' | 'complaint'>('update');
  const [generalContent, setGeneralContent] = useState('');
  const [complaintCategory, setComplaintCategory] = useState('EVM Malfunction');
  const [complaintPriority, setComplaintPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
  const [complaintDescription, setComplaintDescription] = useState('');
  const [reportsList, setReportsList] = useState<GroundReport[]>([]);
  
  // Tasks states
  const [tasksList, setTasksList] = useState<VoterTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskInstructions, setNewTaskInstructions] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
  const [newTaskAssignee, setNewTaskAssignee] = useState('All');
  const [newTaskDueDate, setNewTaskDueDate] = useState('2026-08-05');
  const [cadreList, setCadreList] = useState<VillageCadreItem[]>([]);

  // Video watching modal
  const [watchingVideo, setWatchingVideo] = useState<TrainingVideo | null>(null);

  useEffect(() => {
    let active = true;

    const hydrateLiveScope = async () => {
      try {
        const [summaryPayload, eventItems, reports, tasks, videos, progressItems, voterItems, cadrePayload] = await Promise.all([
          fetchHierarchySummaryByUser(session.userId),
          fetchLiveVoteEventsByUser(session.userId, 8),
          fetchReportsForUnit(session.unitId).catch(() => null),
          fetchTasksForUnit(session.unitId).catch(() => null),
          fetchTrainingVideos(session.unitId).catch(() => null),
          fetchTrainingProgress(session.userId).catch(() => null),
          fetchVotersForUnit(session.unitId).catch(() => null),
          fetchCadreNetwork(session.unitId).catch(() => null),
        ]);

        if (!active) {
          return;
        }

        setBackendSummary(summaryPayload);

        if (eventItems.length > 0) {
          setRecentVoteDoneActivity(
            eventItems.map((item) => ({
              voterName: item.voter.name,
              boothName: item.unit.name,
              time: new Date(item.changedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            })),
          );
        }

        if (reports) {
          setReportsList(reports);
        }

        if (voterItems && voterItems.length > 0) {
          setVoters(voterItems);
        }

        if (tasks) {
          setTasksList(tasks);
        }

        if (videos && videos.length > 0) {
          setTrainingVideos(videos);
        }

        if (cadrePayload) {
          const items = Array.isArray(cadrePayload) ? cadrePayload : cadrePayload.items || [];
          setCadreList(items.map((c: any, idx: number) => ({
            id: c.userId || c.id || `cadre-${idx + 1}`,
            name: c.name || `Cadre ${idx + 1}`,
            mobile: c.mobileNumber || c.mobile || '',
            group: c.unitName || `Unit ${idx + 1}`,
            role: c.role || 'VOTER_100_INCHARGE',
            unitName: c.unitName || '',
            votersCount: c.totalAssignedVoters || 0,
          })));
        }

        if (progressItems) {
          const progressMap: Record<string, TrainingProgressItem> = {};
          progressItems.forEach((item) => {
            progressMap[item.video.id] = item;
          });
          setTrainingProgress(progressMap);
        }
      } catch {
      }
    };

    void hydrateLiveScope();

    return () => {
      active = false;
    };
  }, [session.userId]);

  useEffect(() => {
    const socket = createRealtimeSocket({ userId: session.userId, unitId: session.unitId });

    socket.on('vote:event', (event: RealtimeVoteEvent) => {
      setRecentVoteDoneActivity((prev) => [
        {
          voterName: event.voter.name,
          boothName: event.unit.name,
          time: new Date(event.changedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev,
      ].slice(0, 5));
    });

    return () => {
      socket.disconnect();
    };
  }, [session.unitId, session.userId]);

  // Sync / Refresh data
  const refreshVoters = () => {
    void fetchVotersForUnit(session.unitId)
      .then(setVoters)
      .catch(() => {});
  };

  // Metric Computations (Dynamic and fully synchronous)
  const totalVotersCount = voters.length;
  
  // Voters filtered by active (excluding deceased)
  const activeVoters = useMemo(() => voters.filter(v => v.voterStatus !== 'Deceased'), [voters]);

  // Party support breakdown
  const partyStats = useMemo(() => {
    const stats: Record<VoterPreference, number> = {
      TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0
    };
    activeVoters.forEach(v => {
      const pref = v.politicalPreference || 'Neutral';
      if (stats[pref] !== undefined) stats[pref]++;
    });
    return stats;
  }, [activeVoters]);

  // Fake votes count (Fake, Duplicate, Doubtful)
  const fakeVotesCount = useMemo(() => {
    return voters.filter(v => v.voterStatus === 'Fake' || v.voterStatus === 'Duplicate' || v.voterStatus === 'Doubtful').length;
  }, [voters]);

  // Dynamic Election Forecast computation
  const forecastData = useMemo(() => {
    const partiesList: { party: VoterPreference; count: number }[] = [
      { party: 'TDP', count: partyStats.TDP },
      { party: 'YSRCP', count: partyStats.YSRCP },
      { party: 'JSP', count: partyStats.JSP },
      { party: 'BJP', count: partyStats.BJP },
      { party: 'INC', count: partyStats.INC },
      { party: 'Neutral', count: partyStats.Neutral },
      { party: 'OTH', count: partyStats.OTH }
    ];

    // Exclude Neutral and OTH from core winner calculation to determine political contest
    const politicalPartiesOnly = partiesList.filter(p => p.party !== 'Neutral' && p.party !== 'OTH');
    const sorted = [...politicalPartiesOnly].sort((a, b) => b.count - a.count);
    
    const leader = sorted[0] || { party: 'TDP' as VoterPreference, count: 0 };
    const runnerUp = sorted[1] || { party: 'YSRCP' as VoterPreference, count: 0 };
    const lead = leader.count - runnerUp.count;

    return {
      leadingParty: leader.party,
      leadCount: lead,
      leaderCount: leader.count,
      runnerUpParty: runnerUp.party,
      runnerUpCount: runnerUp.count
    };
  }, [partyStats]);

  // Donut chart calculations
  const donutChartData = useMemo(() => {
    let totalValid = 0;
    (Object.keys(partyStats) as VoterPreference[]).forEach(k => {
      totalValid += partyStats[k];
    });

    return (Object.keys(partyStats) as VoterPreference[]).map(key => {
      const value = partyStats[key];
      const percentage = totalValid > 0 ? (value / totalValid) * 100 : 0;
      return {
        key,
        value,
        percentage,
        color: PARTY_COLORS[key]
      };
    });
  }, [partyStats]);

  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

  // Unique Booths list
  const uniqueBooths = useMemo(() => {
    const booths = new Set<string>();
    voters.forEach(v => { if (v.boothNumber) booths.add(v.boothNumber); });
    return Array.from(booths).sort();
  }, [voters]);

  // Save edits of a voter record
  const handleSaveVoterEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVoter) return;

    const updated: Voter = {
      ...editingVoter,
      politicalPreference: editPreference,
      voterStatus: editStatus,
      notes: editNotes,
      caste: editCaste,
      subCaste: editSubCaste,
      profession: editProfession,
      voterLocationStatus: editLocationStatus,
      currentLocation: editCurrentLocation,
      voteStatus: editVoteStatus,
      voteDoneTime: editVoteStatus === 'VOTE DONE' ? (editVoteDoneTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : undefined,
      inchargeAssessment: editInchargeAssessment,
      lastUpdated: new Date().toISOString().split('T')[0],
      updatedBy: session.userId
    };

    setVoters((prev) => prev.map((voter) => voter.id === updated.id ? updated : voter));
    setEditingVoter(null);

    void syncVoter(updated, session.userId).catch(() => {
      saveVoterRecord(updated);
      refreshVoters();
    });

    // If marked as voted now, add to recent stream
    if (editVoteStatus === 'VOTE DONE' && editingVoter.voteStatus !== 'VOTE DONE') {
      const nowTime = editVoteDoneTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setRecentVoteDoneActivity(prev => [
        { voterName: updated.name, boothName: updated.boothNumber, time: nowTime },
        ...prev.slice(0, 4)
      ]);
    }

    // If updated to Fake, log a general info update
    if (editStatus === 'Fake') {
      const newReport: GroundReport = {
        id: `rep-${Date.now()}`,
        inchargeId: session.userId,
        inchargeName: session.userName,
        constituency: session.assignedConstituency,
        mandal: session.assignedMandal || 'Kondapi',
        village: session.assignedVillage || 'Kondapi Village',
        booth: updated.boothNumber,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        reportType: 'Complaint / Issue',
        priority: 'High',
        issueCategory: 'Fake Voters Identified',
        description: `Marked voter ${updated.name} (EPIC: ${updated.epicNumber}) in ${updated.boothNumber} as FAKE.`,
        status: 'Pending'
      };
      const updatedReports = [newReport, ...reportsList];
      setReportsList(updatedReports);
    }
  };

  const handleOpenEditModal = (voter: Voter) => {
    setEditingVoter(voter);
    setEditPreference(voter.politicalPreference);
    setEditStatus(voter.voterStatus);
    setEditNotes(voter.notes || '');
    setEditCaste(voter.caste || '');
    setEditSubCaste(voter.subCaste || '');
    setEditProfession(voter.profession || '');
    setEditLocationStatus(voter.voterLocationStatus || 'Local');
    setEditCurrentLocation(voter.currentLocation || '');
    setEditVoteStatus(voter.voteStatus || 'NOT VOTED');
    setEditVoteDoneTime(voter.voteDoneTime || '');
    setEditInchargeAssessment(voter.inchargeAssessment || 'Unknown');
  };

  // Handle report submission to Command Center
  const handleGeneralSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!generalContent.trim()) return;

    const newReport: GroundReport = {
      id: `rep-${Date.now()}`,
      inchargeId: session.userId,
      inchargeName: session.userName,
      constituency: session.assignedConstituency,
      mandal: session.assignedMandal || 'Kondapi',
      village: session.assignedVillage || 'Kondapi Village',
      booth: 'All Polling Booths',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      reportType: 'General Update',
      priority: 'Medium',
      description: generalContent,
      status: 'Pending'
    };

    const updated = [newReport, ...reportsList];
    setReportsList(updated);
    setGeneralContent('');
    void createReport({
      reportType: newReport.reportType,
      priority: newReport.priority,
      description: newReport.description,
      unitId: session.unitId,
      createdById: session.userId,
    })
      .then((savedReport) => {
        setReportsList((prev) => [savedReport, ...prev.filter((item) => item.id !== newReport.id)]);
      })
      .catch(() => {
      });
  };

  const handleComplaintSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintDescription.trim()) return;

    const newReport: GroundReport = {
      id: `rep-${Date.now()}`,
      inchargeId: session.userId,
      inchargeName: session.userName,
      constituency: session.assignedConstituency,
      mandal: session.assignedMandal || 'Kondapi',
      village: session.assignedVillage || 'Kondapi Village',
      booth: 'All Polling Booths',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      reportType: 'Complaint / Issue',
      priority: complaintPriority,
      issueCategory: complaintCategory,
      description: complaintDescription,
      status: 'Pending'
    };

    const updated = [newReport, ...reportsList];
    setReportsList(updated);
    setComplaintDescription('');
    void createReport({
      reportType: newReport.reportType,
      priority: newReport.priority,
      description: newReport.description,
      issueCategory: newReport.issueCategory,
      unitId: session.unitId,
      createdById: session.userId,
    })
      .then((savedReport) => {
        setReportsList((prev) => [savedReport, ...prev.filter((item) => item.id !== newReport.id)]);
      })
      .catch(() => {
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
      });
  };

  // Create new task
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !newTaskInstructions.trim()) return;

    const assigneeObj = cadreList.find(i => i.id === newTaskAssignee);
    const assigneeName = assigneeObj ? assigneeObj.name : 'All Cadres';

    const newTask: VoterTask = {
      id: `task-${Date.now()}`,
      title: newTaskTitle,
      instructions: newTaskInstructions,
      assignedBy: 'Village Incharge',
      priority: newTaskPriority,
      assignedDate: new Date().toISOString().split('T')[0],
      dueDate: newTaskDueDate,
      status: 'Pending',
      assignedTo: newTaskAssignee
    };

    const updated = [newTask, ...tasksList];
    setTasksList(updated);
    void createTask({
      title: newTask.title,
      instructions: newTask.instructions,
      assignedBy: 'Village Incharge',
      priority: newTask.priority,
      dueDate: newTask.dueDate,
      sourceUnitId: session.unitId,
      assigneeId: newTaskAssignee === 'All' ? undefined : newTaskAssignee,
    })
      .then((savedTask) => {
        setTasksList((prev) => [savedTask, ...prev.filter((item) => item.id !== newTask.id)]);
      })
      .catch(() => {
      });

    setNewTaskTitle('');
    setNewTaskInstructions('');
    notify.success(`Task assigned successfully to ${assigneeName}!`, 'Task Delegated');
  };

  // Filtered Voters for Voter List View
  const filteredVoters = useMemo(() => {
    return voters.filter(v => {
      // 1. Search Query
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        (v.name || '').toLowerCase().includes(query) ||
        (v.fatherHusbandName || '').toLowerCase().includes(query) ||
        (v.epicNumber || '').toLowerCase().includes(query) ||
        (v.houseNumber || '').toLowerCase().includes(query);
      
      // 2. Booth Filter
      const matchesBooth = boothFilter === 'All' || v.boothNumber === boothFilter;

      // 3. Preference Filter
      const matchesPref = preferenceFilter === 'All' || v.politicalPreference === preferenceFilter;

      // 4. Status Filter
      const matchesStatus = statusFilter === 'All' || v.voterStatus === statusFilter;

      // 5. Local/Migrated Filter
      let matchesLocation = true;
      if (locationFilter === 'Local') {
        matchesLocation = v.voterLocationStatus === 'Local' || !v.voterLocationStatus;
      } else if (locationFilter === 'Migrated') {
        matchesLocation = v.voterLocationStatus === 'Migrated';
      }

      return matchesSearch && matchesBooth && matchesPref && matchesStatus && matchesLocation;
    });
  }, [voters, searchQuery, boothFilter, preferenceFilter, statusFilter, locationFilter]);

  // Paginated Voters for Table
  const paginatedVoters = useMemo(() => {
    const start = (voterCurrentPage - 1) * voterPageSize;
    return filteredVoters.slice(start, start + voterPageSize);
  }, [filteredVoters, voterCurrentPage, voterPageSize]);

  // Live Voter Tracking metrics
  const liveTrackStats = useMemo(() => {
    const activeValid = voters.filter(v => v.voterStatus !== 'Deceased' && v.voterStatus !== 'Fake');
    const total = activeValid.length;
    const voted = activeValid.filter(v => v.voteStatus === 'VOTE DONE').length;
    const pending = total - voted;
    const turnoutPct = total > 0 ? (voted / total) * 100 : 0;

    // Field Assessments among Voted Citizens
    const assessmentStats: Record<string, number> = {
      TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0, Unknown: 0
    };

    activeValid.forEach(v => {
      if (v.voteStatus === 'VOTE DONE') {
        const assessment = v.inchargeAssessment || 'Unknown';
        if (assessmentStats[assessment] !== undefined) {
          assessmentStats[assessment]++;
        } else {
          assessmentStats.Unknown++;
        }
      }
    });

    return {
      total,
      voted,
      pending,
      turnoutPct,
      assessments: assessmentStats
    };
  }, [voters]);

  const liveVillageStats = useMemo(() => {
    const migratedFallback = voters.filter((voter) => voter.voterLocationStatus === 'Migrated').length;
    const snapshot = backendSummary?.snapshot;

    return {
      totalVoters: snapshot?.summary.totalVoters ?? totalVotersCount,
      totalBooths: snapshot?.hierarchyCounts.BOOTH ?? uniqueBooths.length,
      voted: snapshot?.summary.voted ?? liveTrackStats.voted,
      remaining: snapshot?.summary.remaining ?? liveTrackStats.pending,
      fake: snapshot?.summary.fakeVoters ?? fakeVotesCount,
      migrated: snapshot?.summary.migrated ?? migratedFallback,
    };
  }, [backendSummary, fakeVotesCount, liveTrackStats.pending, liveTrackStats.voted, totalVotersCount, uniqueBooths.length, voters]);

  // Fake Votes List (aggregates Fake, Duplicate, and Doubtful)
  const fakeVotersList = useMemo(() => {
    return voters.filter(v => v.voterStatus === 'Fake' || v.voterStatus === 'Duplicate' || v.voterStatus === 'Doubtful');
  }, [voters]);

  const paginatedFakeVoters = useMemo(() => {
    const start = (fakeVotersPage - 1) * fakeVotersPageSize;
    return fakeVotersList.slice(start, start + fakeVotersPageSize);
  }, [fakeVotersList, fakeVotersPage, fakeVotersPageSize]);

  // Caste / Demographics Analytics Datasets
  const casteChartsData = useMemo(() => {
    // 1. Caste Support Breakdown
    const casteSupport: Record<string, Record<VoterPreference, number>> = {};
    const professionSupport: Record<string, Record<VoterPreference, number>> = {};
    const ageSupport: Record<string, Record<VoterPreference, number>> = {
      '18 - 30 (Youth)': { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 },
      '31 - 45': { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 },
      '46 - 60': { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 },
      '60+ (Seniors)': { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 }
    };
    const genderSupport: Record<string, Record<VoterPreference, number>> = {
      'Male': { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 },
      'Female': { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 }
    };

    activeVoters.forEach(v => {
      const p = v.politicalPreference || 'Neutral';
      
      // Caste
      const casteKey = v.caste || 'Other Caste';
      if (!casteSupport[casteKey]) {
        casteSupport[casteKey] = { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 };
      }
      casteSupport[casteKey][p]++;

      // Profession
      const profKey = v.profession || 'Unspecified';
      if (!professionSupport[profKey]) {
        professionSupport[profKey] = { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 };
      }
      professionSupport[profKey][p]++;

      // Age Group
      let ageKey = '46 - 60';
      if (v.age <= 30) ageKey = '18 - 30 (Youth)';
      else if (v.age <= 45) ageKey = '31 - 45';
      else if (v.age > 60) ageKey = '60+ (Seniors)';
      ageSupport[ageKey][p]++;

      // Gender
      const genderKey = v.gender === 'Female' ? 'Female' : 'Male';
      genderSupport[genderKey][p]++;
    });

    const formatChartData = (rawObj: Record<string, Record<VoterPreference, number>>, maxRows = 10) => {
      return Object.entries(rawObj).map(([name, prefs]) => {
        const total = Object.values(prefs).reduce((a, b) => a + b, 0);
        return {
          name,
          total,
          prefs
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, maxRows);
    };

    return {
      caste: formatChartData(casteSupport, 17),
      profession: formatChartData(professionSupport, 6),
      age: formatChartData(ageSupport),
      gender: formatChartData(genderSupport)
    };
  }, [activeVoters]);

  // Cadre Network computations
  const cadreNetworkList = useMemo(() => {
    const items = cadreList.filter(c => c.role === 'VOTER_100_INCHARGE' || c.role === 'Voter100' || (!c.role.includes('BOOTH') && !c.role.includes('VILLAGE')));
    return items.map((inc) => {
      // Get all voters assigned to this 100 Voter Incharge
      const incVoters = voters.filter(v => v.assignedInchargeId === inc.id && v.voterStatus !== 'Deceased');
      
      const counts: Record<VoterPreference, number> = {
        TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0
      };

      incVoters.forEach(v => {
        const p = v.politicalPreference || 'Neutral';
        if (counts[p] !== undefined) counts[p]++;
      });

      // Find leading party
      const sortedSupport = Object.entries(counts)
        .filter(([p]) => p !== 'Neutral' && p !== 'OTH')
        .sort((a, b) => b[1] - a[1]);
      
      const leaderParty = sortedSupport[0] ? (sortedSupport[0][0] as VoterPreference) : 'Neutral' as VoterPreference;
      const runnerParty = sortedSupport[1] ? (sortedSupport[1][0] as VoterPreference) : 'Neutral' as VoterPreference;
      const leaderCount = counts[leaderParty] || 0;
      const runnerCount = counts[runnerParty] || 0;
      const majorityLead = leaderCount - runnerCount;

      return {
        id: inc.id,
        name: inc.name,
        mobile: inc.mobile,
        group: inc.group,
        boothNumber: inc.unitName || 'Assigned Booth',
        votersCount: incVoters.length || inc.votersCount,
        counts,
        majorityParty: leaderParty,
        majorityCount: counts[leaderParty] || 0,
        majorityLead: majorityLead
      };
    });
  }, [cadreList, voters]);

  const paginatedCadres = useMemo(() => {
    const start = (cadrePage - 1) * cadrePageSize;
    return cadreNetworkList.slice(start, start + cadrePageSize);
  }, [cadreNetworkList, cadrePage, cadrePageSize]);

  // Booth Incharges Computations
  const boothInchargesData = useMemo(() => {
    const boothCadres = cadreList.filter(c => c.role === 'BOOTH_INCHARGE' || c.role === 'BoothIncharge');
    return boothCadres.map((inc, idx) => {
      const bName = inc.unitName || `Booth ${idx + 1}`;
      const boothVoters = voters.filter(v => (v.boothNumber === bName || v.assignedInchargeId === inc.id) && v.voterStatus !== 'Deceased');
      
      const counts: Record<VoterPreference, number> = {
        TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0
      };
      
      boothVoters.forEach(v => {
        const p = v.politicalPreference || 'Neutral';
        if (counts[p] !== undefined) counts[p]++;
      });
      
      const politicalContenders = Object.entries(counts)
        .filter(([p]) => p !== 'Neutral' && p !== 'OTH')
        .sort((a, b) => b[1] - a[1]);
        
      const leaderParty = politicalContenders[0] ? (politicalContenders[0][0] as VoterPreference) : 'Neutral' as VoterPreference;
      const runnerParty = politicalContenders[1] ? (politicalContenders[1][0] as VoterPreference) : 'Neutral' as VoterPreference;
      const leaderCount = counts[leaderParty] || 0;
      const runnerCount = counts[runnerParty] || 0;
      const lead = leaderCount - runnerCount;
      
      return {
        serial: `#${String(idx + 1).padStart(2, '0')}`,
        name: inc.name,
        mobile: inc.mobile,
        booth: bName,
        totalVoters: boothVoters.length || inc.votersCount,
        counts,
        majorityParty: leaderParty,
        majorityLead: lead
      };
    });
  }, [cadreList, voters]);

  return (
    <div className="w-full h-screen overflow-hidden flex flex-col md:flex-row bg-slate-50 text-slate-800" id="village-dashboard-container">
      
      {/* --------------------------------------------------------
          LEFT SIDEBAR (Fixed & Styled Dark Navy)
         -------------------------------------------------------- */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white p-5 flex flex-col justify-between shrink-0 h-screen overflow-hidden transition-transform duration-300 md:fixed md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        id="dashboard-sidebar"
      >
        <div className="space-y-6 overflow-y-auto max-h-[85vh] no-scrollbar">
          {/* Brand logo & App Name */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-yellow-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-yellow-400/10">
                K
              </div>
              <div>
                <h1 className="text-sm font-black tracking-tight uppercase text-yellow-400">Kondapi TDP Connect</h1>
                <p className="text-[9px] font-black tracking-widest uppercase text-slate-400">Village Command</p>
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

          {/* Connected User Profile Widget */}
          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 font-extrabold shrink-0 text-xs">
              VI
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-black text-slate-100 truncate uppercase">{session.userName}</h4>
              <p className="text-[10px] text-slate-400 font-bold truncate">VILLAGE INCHARGE</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[9px] text-slate-400 font-bold tracking-wider uppercase font-mono">
                  ID: {session.userId.slice(-8).toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">Main Navigation</p>
            {/* Dashboard Link - Highlighted in yellow */}
            <button
              onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${activeTab === 'dashboard' ? 'bg-yellow-400 text-slate-950 font-extrabold shadow-md shadow-yellow-400/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
            >
              <Home className="w-4 h-4 shrink-0" />
              <span>Dashboard</span>
            </button>

            {/* Other links */}
            {[
              { id: 'voters', name: 'Voter List', icon: Search },
              { id: 'live_track', name: 'Live Voter Track', icon: RefreshCw },
              { id: 'fake_votes', name: 'Fake Votes', icon: AlertTriangle },
              { id: 'tasks', name: 'Tasks', icon: Calendar },
              { id: 'caste_analytics', name: 'Caste Analytics', icon: BarChart3 },
              { id: 'cadre_network', name: 'Cadre Network', icon: Users },
              { id: 'training', name: 'Training Videos', icon: Video }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id as TabType); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === item.id ? 'bg-yellow-400 text-slate-950 font-extrabold shadow-md shadow-yellow-400/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Fixed Sign Out at Bottom */}
        <div className="pt-4 border-t border-slate-800 bg-slate-900 shrink-0">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-between px-4 py-3 bg-red-950/40 hover:bg-red-900/60 border border-red-900/30 text-red-400 hover:text-white rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer"
            id="btn-sidebar-logout"
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
      <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden bg-slate-50 relative md:pl-64" id="main-workspace-section">
        <div className="p-6 md:p-8 space-y-6 max-w-7xl w-full mx-auto">
        
        {/* Mobile top navigation header */}
        <div className="md:hidden flex items-center justify-between bg-white border border-slate-100 rounded-xl p-3 shadow-sm mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-400 flex items-center justify-center font-black text-slate-950">K</div>
            <span className="font-black text-sm text-slate-900 tracking-tight">Kondapi TDP Connect</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* --------------------------------------------------------
            TAB 1: CORE DASHBOARD VIEW
           -------------------------------------------------------- */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fade-in" id="village-view-dashboard">
            
            {/* Village Header */}
            <div className="bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4" id="village-header-bar">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      Kondapi Assembly Constituency
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full font-bold">
                      Village Polling Station
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight" id="village-overview-title">
                    My Village Overview
                  </h2>
                </div>
              </div>
              
              {/* Clean Information Row */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600 font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 uppercase text-[10px] font-bold">Village:</span>
                  <span className="text-slate-900 font-extrabold">{session.assignedVillage || 'Ponnaluru'}</span>
                </div>
                <div className="hidden sm:block text-slate-300">•</div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 uppercase text-[10px] font-bold">Mandal:</span>
                  <span className="text-slate-900 font-extrabold">{session.assignedMandal || 'Ponnaluru Mandal'}</span>
                </div>
                <div className="hidden sm:block text-slate-300">•</div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 uppercase text-[10px] font-bold">Total Booths:</span>
                  <span className="text-slate-900 font-extrabold">{liveVillageStats.totalBooths}</span>
                </div>
                <div className="hidden sm:block text-slate-300">•</div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 uppercase text-[10px] font-bold">Total Voters:</span>
                  <span className="text-slate-900 font-extrabold">{liveVillageStats.totalVoters.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Election Forecast Banner */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white rounded-2xl border border-slate-800 shadow-md p-6" id="forecast-card-banner">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500"></div>
              
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold tracking-wider bg-amber-400/15 text-amber-300 border border-amber-400/30 px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1.5 w-fit">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                    Election Forecast & Analytics
                  </span>
                  
                  <h3 className="text-xl md:text-2xl font-black text-slate-100 tracking-tight">
                    {forecastData.leadingParty} LEADS by <span className="text-amber-400 font-black">{forecastData.leadCount}</span> Votes
                  </h3>
                  
                  <p className="text-xs text-slate-400 font-medium">
                    Live voter analytics for {session.assignedVillage || 'Ponnaluru'} Village. Total registered preferences: TDP ({partyStats.TDP}), YSRCP ({partyStats.YSRCP}), JSP ({partyStats.JSP}), BJP ({partyStats.BJP}), INC ({partyStats.INC}).
                  </p>
                </div>

                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 text-center w-full md:w-auto shrink-0 shadow-xs" id="forecast-comparison-badge">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Top Contest</p>
                  <div className="flex items-center justify-center gap-4 mt-1 font-black">
                    <span className="text-xs text-amber-400 font-extrabold">TDP: {partyStats.TDP}</span>
                    <span className="text-xs text-slate-500 font-normal">vs</span>
                    <span className="text-xs text-blue-400 font-extrabold">YSRCP: {partyStats.YSRCP}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top 4 Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="village-metrics-grid">
              {/* Card 1: Total Voters */}
              <div className="bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between" id="metric-total-voters">
                <div className="space-y-1">
                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Total Voters</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none">{liveVillageStats.totalVoters.toLocaleString()}</h3>
                  <p className="text-[10px] text-slate-400 font-semibold">{liveVillageStats.totalBooths} polling booths</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              {/* Card 2: Votes Completed */}
              <div className="bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between" id="metric-tdp-supporters">
                <div className="space-y-1">
                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Votes Completed</p>
                  <h3 className="text-2xl font-black text-amber-600 leading-none">{liveVillageStats.voted.toLocaleString()}</h3>
                  <p className="text-[10px] text-amber-600 font-bold">
                    {liveVillageStats.totalVoters > 0 ? Math.round((liveVillageStats.voted / liveVillageStats.totalVoters) * 100) : 0}% turnout
                  </p>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl text-amber-600 border border-amber-200/60">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>

              {/* Card 3: Remaining */}
              <div className="bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between" id="metric-neutral-swing">
                <div className="space-y-1">
                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Remaining</p>
                  <h3 className="text-2xl font-black text-slate-700 leading-none">{liveVillageStats.remaining.toLocaleString()}</h3>
                  <p className="text-[10px] text-slate-400 font-semibold">Citizens to mobilize</p>
                </div>
                <div className="p-3 bg-slate-100 rounded-xl text-slate-500 border border-slate-200">
                  <RefreshCw className="w-5 h-5" />
                </div>
              </div>

              {/* Card 4: Fake Votes */}
              <div className="bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between" id="metric-fake-votes">
                <div className="space-y-1">
                  <p className="text-[11px] text-rose-700 font-bold uppercase tracking-wider">Flagged Votes</p>
                  <h3 className="text-2xl font-black text-rose-600 leading-none">{liveVillageStats.fake}</h3>
                  <p className="text-[10px] text-rose-500 font-semibold">Requires verification</p>
                </div>
                <div className="p-3 bg-rose-50 rounded-xl text-rose-600 border border-rose-200/60">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>
            </div>


            {/* Voter Sentiment Share & Ground Report Breakdown Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="sentiment-split-section">
              
              {/* Left 2 Columns: Donut Chart + Party List */}
              <div className="lg:col-span-2 bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-5">
                <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-slate-900">Voter Sentiment & Ground Report Breakdown</h3>
                    <p className="text-xs text-slate-400 font-semibold">Dynamic preference distribution of voters across all booths</p>
                  </div>
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-100">
                    Total Voters: {totalVotersCount}
                  </span>
                </div>

                {/* Donut and breakdown table side-by-side */}
                <div className="flex flex-col md:flex-row items-center gap-8 pt-2">
                  
                  {/* SVG Donut Chart */}
                  <div className="relative w-44 h-44 shrink-0" id="village-donut-chart">
                    <svg className="w-full h-full" viewBox="0 0 120 120">
                      {/* Background light track */}
                      <circle cx="60" cy="60" r="45" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                      
                      {(() => {
                        let currentOffset = 0;
                        const r = 45;
                        const circ = 2 * Math.PI * r;

                        return donutChartData.map((slice) => {
                          const pct = slice.percentage;
                          if (pct <= 0) return null;

                          const strokeDashOffset = circ - (pct / 100) * circ;
                          const rotationAngle = (currentOffset / 100) * 360 - 90;
                          currentOffset += pct;

                          return (
                            <circle
                              key={slice.key}
                              cx="60"
                              cy="60"
                              r={r}
                              fill="transparent"
                              stroke={slice.color}
                              strokeWidth="12"
                              strokeDasharray={circ}
                              strokeDashoffset={strokeDashOffset}
                              transform={`rotate(${rotationAngle} 60 60)`}
                              className="transition-all duration-200 cursor-pointer hover:stroke-[15px]"
                              onMouseEnter={() => setHoveredSlice(slice.key)}
                              onMouseLeave={() => setHoveredSlice(null)}
                            />
                          );
                        });
                      })()}
                    </svg>

                    {/* Center label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
                      {hoveredSlice ? (
                        <>
                          <span className="text-[10px] font-black uppercase text-slate-400">{hoveredSlice}</span>
                          <span className="text-base font-black text-slate-950">{partyStats[hoveredSlice as VoterPreference]}</span>
                          <span className="text-[9px] font-bold text-slate-500">
                            {Math.round((partyStats[hoveredSlice as VoterPreference] / activeVoters.length) * 100)}% Share
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[9px] font-bold uppercase text-slate-400">Total Active</span>
                          <span className="text-lg font-black text-slate-950">{activeVoters.length}</span>
                          <span className="text-[9px] font-bold text-green-600 uppercase">Voters</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Ground Report Breakdown table list */}
                  <div className="flex-1 w-full space-y-2">
                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Ground Preference Counts</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {donutChartData.map((slice) => {
                        const isHovered = hoveredSlice === slice.key;
                        const labelBg = PARTY_BG_COLORS[slice.key as VoterPreference];
                        return (
                          <div 
                            key={slice.key}
                            onMouseEnter={() => setHoveredSlice(slice.key)}
                            onMouseLeave={() => setHoveredSlice(null)}
                            className={`flex items-center justify-between p-2 rounded-lg border text-xs font-bold transition-all ${isHovered ? 'bg-slate-50 border-yellow-400 shadow-sm' : 'bg-white border-slate-100'}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded" style={{ backgroundColor: slice.color }}></span>
                              <span className="text-slate-700">{PARTY_NAMES[slice.key as VoterPreference]}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-900">{slice.value} Votes</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${labelBg}`}>
                                {Math.round(slice.percentage)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>

              {/* Right Column: Send Report Box */}
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-4" id="send-report-panel-container">
                <div className="border-b border-gray-100 pb-2">
                  <h3 className="font-bold text-base text-slate-900">Send Report to Command Center</h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Report directly to Assembly Command Center</p>
                </div>

                {/* Sub tabs */}
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button
                    onClick={() => setReportTab('update')}
                    className={`flex-1 py-1.5 text-center text-[10px] font-black uppercase tracking-wide rounded-md transition-all cursor-pointer ${reportTab === 'update' ? 'bg-white text-slate-950 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    General Update
                  </button>
                  <button
                    onClick={() => setReportTab('complaint')}
                    className={`flex-1 py-1.5 text-center text-[10px] font-black uppercase tracking-wide rounded-md transition-all cursor-pointer ${reportTab === 'complaint' ? 'bg-white text-slate-950 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Complaint / Issue
                  </button>
                </div>

                {/* Forms */}
                {reportTab === 'update' ? (
                  <form onSubmit={handleGeneralSubmit} className="space-y-3" id="general-update-form">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Ground Feedback & Sentiment</label>
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
                      className="w-full py-2 bg-yellow-400 hover:bg-yellow-500 text-slate-950 text-xs font-black rounded-lg shadow-sm hover:shadow active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send Report
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleComplaintSubmit} className="space-y-3" id="complaint-issue-form">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Issue Category</label>
                        <select
                          value={complaintCategory}
                          onChange={(e) => setComplaintCategory(e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:outline-none"
                        >
                          <option value="EVM Malfunction">EVM Malfunction</option>
                          <option value="Fake Voters Identified">Fake Voters Identified</option>
                          <option value="Law & Order Issue">Law & Order Issue</option>
                          <option value="Power Failure at Booth">Power Failure at Booth</option>
                          <option value="Rigging / Objections">Rigging / Objections</option>
                          <option value="Other Technical Issue">Other Technical Issue</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Priority Level</label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {(['Low', 'Medium', 'High', 'Urgent'] as const).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setComplaintPriority(p)}
                              className={`py-1 text-center text-[9px] font-bold rounded-md border transition-all cursor-pointer ${complaintPriority === p ? 'bg-red-50 text-red-600 border-red-300 font-extrabold' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Incident Details</label>
                        <textarea
                          rows={2}
                          value={complaintDescription}
                          onChange={(e) => setComplaintDescription(e.target.value)}
                          placeholder="Provide specific details: Booth number, individuals involved, or affected voters count..."
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:outline-none focus:border-yellow-400"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-yellow-400 hover:bg-yellow-500 text-slate-950 text-xs font-black rounded-lg shadow-sm hover:shadow active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                      Register Complaint
                    </button>
                  </form>
                )}
              </div>

            </div>
          </div>
        )}

        {/* --------------------------------------------------------
            TAB 2: VOTER LIST VIEW
           -------------------------------------------------------- */}
        {activeTab === 'voters' && (
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-5 animate-fade-in" id="village-voter-list-view">
            
            {/* Header section with Filter toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">Village Voter Database</h2>
                <p className="text-xs text-slate-400 font-medium">Consolidated directory representing all combined polling booths</p>
              </div>
              <div className="text-xs font-black text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                Total Matches: <span className="text-yellow-600 font-black">{filteredVoters.length}</span> / {totalVotersCount} Voters
              </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3" id="database-filters-panel">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {/* Search query */}
                <div className="md:col-span-2 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Name, EPIC ID, House Number..."
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-yellow-400"
                  />
                </div>

                {/* Booth selector */}
                <div>
                  <select
                    value={boothFilter}
                    onChange={(e) => setBoothFilter(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none"
                  >
                    <option value="All">All Polling Booths</option>
                    {uniqueBooths.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                {/* Preference selector */}
                <div>
                  <select
                    value={preferenceFilter}
                    onChange={(e) => setPreferenceFilter(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none"
                  >
                    <option value="All">All Preferences</option>
                    {(Object.keys(PARTY_COLORS) as VoterPreference[]).map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* Status selector */}
                <div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none"
                  >
                    <option value="All">All Voter Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Shifted">Shifted / Migrated</option>
                    <option value="Deceased">Deceased</option>
                    <option value="Duplicate">Duplicate</option>
                    <option value="Fake">Fake</option>
                    <option value="Doubtful">Doubtful</option>
                  </select>
                </div>
              </div>

              {/* Extra Location Filter */}
              <div className="flex flex-col gap-2 pt-1" id="migration-filter-container">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400">Migration Status:</span>
                  <div className="flex gap-1.5">
                    {[
                      { value: 'All', label: 'All (3,640)' },
                      { value: 'Local', label: 'Local (3,200)' },
                      { value: 'Migrated', label: 'Migrated (440)' }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setLocationFilter(opt.value)}
                        className={`px-3 py-1 text-[10px] font-black rounded-full border transition-all cursor-pointer ${locationFilter === opt.value ? 'bg-yellow-400 border-yellow-400 text-slate-950 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Small summary beside or below the filters */}
                <div className="flex items-center gap-6 mt-1 bg-slate-50 border border-slate-100 rounded-xl p-3 w-fit" id="migration-summary-row">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Local Voters</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-black text-slate-900">3,200</span>
                      <span className="text-[9px] font-bold text-slate-500">87.9%</span>
                    </div>
                  </div>
                  <div className="h-6 w-px bg-slate-200"></div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Migrated Voters</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-black text-slate-900">440</span>
                      <span className="text-[9px] font-bold text-slate-500">12.1%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Voter Grid Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 border-b border-slate-100">
                    <th className="py-3 px-3 font-bold uppercase tracking-wider text-[10px] text-center w-12">S.No</th>
                    <th className="py-3 px-3 font-bold uppercase tracking-wider text-[10px]">Voter Name / Info</th>
                    <th className="py-3 px-3 font-bold uppercase tracking-wider text-[10px]">Details</th>
                    <th className="py-3 px-3 font-bold uppercase tracking-wider text-[10px] w-28 text-center">Preference</th>
                    <th className="py-3 px-3 font-bold uppercase tracking-wider text-[10px] w-28 text-center">Voter Status</th>
                    <th className="py-3 px-3 font-bold uppercase tracking-wider text-[10px]">Booth Location</th>
                    <th className="py-3 px-3 font-bold uppercase tracking-wider text-[10px] text-center w-16">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {filteredVoters.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        No voters found matching the current search filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedVoters.map((voter, index) => (
                      <tr key={voter.id} className="hover:bg-slate-50/50">
                        <td className="py-4 px-3 text-center text-slate-400 font-mono">
                          {(voterCurrentPage - 1) * voterPageSize + index + 1}
                        </td>
                        <td className="py-4 px-3">
                          <p className="font-bold text-slate-900">{voter.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {voter.relationType || 'Father'}: {voter.fatherHusbandName}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono tracking-wide mt-0.5">
                            EPIC: {voter.epicNumber}
                          </p>
                          {(() => {
                            const mob = voter.mobileNumber ? voter.mobileNumber.trim() : '';
                            const isInvalidMob = !mob || 
                              ['n/a', 'na', 'no mobile', 'no mobile number', '0000000000', 'dummy number', 'dummy', 'none', 'N/A', 'No Mobile', 'None'].includes(mob) || 
                              /^0+$/.test(mob);
                            if (!isInvalidMob) {
                              return (
                                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                  Mob: +91 {mob}
                                </p>
                              );
                            }
                            return null;
                          })()}
                        </td>
                        <td className="py-4 px-3">
                          <p className="text-slate-800 font-bold">H.No: {voter.houseNumber}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {voter.gender} • Age: {voter.age}
                          </p>
                        </td>
                        <td className="py-4 px-3 text-center">
                          <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider border ${PARTY_BG_COLORS[voter.politicalPreference]}`}>
                            {voter.politicalPreference}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${voter.voterStatus === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : voter.voterStatus === 'Fake' ? 'bg-red-50 text-red-700 border-red-100' : voter.voterStatus === 'Shifted' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {voter.voterStatus}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-slate-600 font-medium">
                          <p className="text-xs truncate max-w-[200px]">{voter.boothNumber}</p>
                        </td>
                        <td className="py-4 px-3 text-center">
                          <button
                            onClick={() => handleOpenEditModal(voter)}
                            className="p-1.5 text-slate-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-all cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={voterCurrentPage}
              pageSize={voterPageSize}
              totalItems={filteredVoters.length}
              onPageChange={setVoterCurrentPage}
              onPageSizeChange={(newSize) => {
                setVoterPageSize(newSize);
                setVoterCurrentPage(1);
              }}
              pageSizeOptions={[10, 25, 50, 100]}
              itemName="voters"
              accentColor="amber"
            />

          </div>
        )}

        {/* --------------------------------------------------------
            TAB 3: LIVE VOTER TRACK VIEW
           -------------------------------------------------------- */}
        {activeTab === 'live_track' && (
          <div className="space-y-6 animate-fade-in" id="village-live-track-view">
            
            {/* Disclaimer Bar */}
            <div className="bg-yellow-400/10 border border-yellow-400/20 p-4 rounded-xl flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-black text-yellow-800 uppercase tracking-wide">INCHARGE FIELD ASSESSMENTS ONLY</h4>
                <p className="text-xs text-yellow-700 leading-relaxed font-semibold mt-0.5">
                  These statistics represent estimates and real-time field assessments provided by Voter Incharges. These are NOT official EVM voting results.
                </p>
              </div>
            </div>

            {/* Live Metrics row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" id="live-metrics-row">
              <div className="bg-white border border-gray-100 p-5 rounded-xl shadow-sm">
                <p className="text-xs text-slate-400 font-black uppercase">Total Village Voters</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{liveTrackStats.total}</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-1">Excluding deceased & fake records</p>
              </div>

              <div className="bg-white border border-gray-100 p-5 rounded-xl shadow-sm">
                <p className="text-xs text-emerald-600 font-black uppercase">Voted (Vote Done)</p>
                <h3 className="text-2xl font-black text-emerald-600 mt-1">{liveTrackStats.voted}</h3>
                <p className="text-[10px] text-emerald-500 font-bold mt-1">Confirmed citizens who voted</p>
              </div>

              <div className="bg-white border border-gray-100 p-5 rounded-xl shadow-sm">
                <p className="text-xs text-amber-600 font-black uppercase">Yet to Vote</p>
                <h3 className="text-2xl font-black text-amber-600 mt-1">{liveTrackStats.pending}</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-1">Remaining citizens to mobilize</p>
              </div>

              <div className="bg-white border border-gray-100 p-5 rounded-xl shadow-sm">
                <p className="text-xs text-slate-400 font-black uppercase">Turnout Percentage</p>
                <h3 className="text-2xl font-black text-slate-950 mt-1">{Math.round(liveTrackStats.turnoutPct)}%</h3>
                {/* Visual mini progress bar */}
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2.5 overflow-hidden">
                  <div className="bg-yellow-400 h-full rounded-full" style={{ width: `${liveTrackStats.turnoutPct}%` }}></div>
                </div>
              </div>
            </div>

            {/* Split layout: Assessments and Recent Voter Log */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Field assessments */}
              <div className="lg:col-span-2 bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-4">
                <div className="border-b border-gray-100 pb-3">
                  <h3 className="font-bold text-base text-slate-900">Incharge Field Assessment (EVM Projection)</h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Estimated vote support share from citizens who have completed voting</p>
                </div>

                <div className="space-y-3 pt-2">
                  {(Object.keys(liveTrackStats.assessments) as string[]).map((pref) => {
                    const count = liveTrackStats.assessments[pref] || 0;
                    const pct = liveTrackStats.voted > 0 ? (count / liveTrackStats.voted) * 100 : 0;
                    const color = pref === 'Unknown' ? '#94a3b8' : PARTY_COLORS[pref as VoterPreference];
                    const textCol = pref === 'Unknown' ? 'text-slate-500' : PARTY_TEXT_COLORS[pref as VoterPreference];
                    const bgCol = pref === 'Unknown' ? 'bg-slate-100' : PARTY_BG_COLORS[pref as VoterPreference];
                    
                    return (
                      <div key={pref} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-black">
                          <span className={`flex items-center gap-1.5 ${textCol}`}>
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }}></span>
                            {pref === 'Unknown' ? 'Unknown/Undecided' : PARTY_NAMES[pref as VoterPreference]} Support
                          </span>
                          <span className="text-slate-950">{count} Votes ({Math.round(pct)}%)</span>
                        </div>
                        <div className="w-full bg-slate-50 h-2.5 rounded-lg border border-slate-100 overflow-hidden">
                          <div className="h-full rounded-lg transition-all duration-300" style={{ backgroundColor: color, width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Voter Activities */}
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-4">
                <div className="border-b border-gray-100 pb-2 flex items-center justify-between">
                  <h3 className="font-bold text-base text-slate-900">Live Voter Stream</h3>
                  <Clock className="w-4 h-4 text-emerald-500 animate-pulse" />
                </div>

                <div className="space-y-3.5 pt-1">
                  {recentVoteDoneActivity.map((act, index) => (
                    <div key={index} className="flex gap-3 border-l-2 border-yellow-400 pl-3 py-1 text-xs">
                      <div className="space-y-0.5 flex-1">
                        <p className="font-bold text-slate-900">{act.voterName}</p>
                        <p className="text-[10px] text-slate-400 font-semibold">{act.boothName}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono font-bold self-start">{act.time}</span>
                    </div>
                  ))}

                  <div className="bg-slate-50 rounded-lg p-3 text-[11px] text-slate-400 font-bold text-center uppercase tracking-wide">
                    Polling Booth Activity Syncing...
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* --------------------------------------------------------
            TAB 4: FAKE VOTES VIEW
           -------------------------------------------------------- */}
        {activeTab === 'fake_votes' && (
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-5 animate-fade-in" id="village-fake-votes-view">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Identified Fake Voter Registry
                </h2>
                <p className="text-xs text-slate-400 font-medium">Suspected voter records mapped for physical verification and official deletion procedures</p>
              </div>
              <div className="text-xs font-black text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
                Total Flagged: {fakeVotersList.length}
              </div>
            </div>

            {/* Fake stats widget */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="fake-stats-panels">
              <div className="bg-red-50/40 border border-red-100 p-4 rounded-xl">
                <p className="text-[10px] text-slate-400 font-black uppercase">Fake Registrations Identified</p>
                <h3 className="text-2xl font-black text-red-600 mt-1">{fakeVotersList.length}</h3>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                <p className="text-[10px] text-slate-400 font-black uppercase">Official Complaints Filed</p>
                <h3 className="text-2xl font-black text-slate-950 mt-1">
                  {reportsList.filter(r => r.issueCategory === 'Fake Voters Identified').length}
                </h3>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                <p className="text-[10px] text-slate-400 font-black uppercase">Discovered Booths</p>
                <h3 className="text-2xl font-black text-slate-950 mt-1">3 Polling Locations</h3>
              </div>
            </div>

            {/* Fake Voters Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 border-b border-slate-100">
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Voter ID / Name</th>
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Epic Card ID</th>
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Mapped Booth</th>
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Incharge Assessment & Notes</th>
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px] text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {fakeVotersList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-400">
                        Excellent! No voters in this village are flagged as FAKE.
                      </td>
                    </tr>
                  ) : (
                    paginatedFakeVoters.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">{v.name}</p>
                          <p className="text-[10px] text-slate-400 font-normal">Age: {v.age} • Gender: {v.gender}</p>
                        </td>
                        <td className="py-3 px-3 text-yellow-700 font-mono font-bold">
                          {v.epicNumber}
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-semibold">
                          {v.boothNumber}
                        </td>
                        <td className="py-3 px-3 text-slate-500 font-normal">
                          <span className="text-[11px] leading-relaxed italic">
                            "{v.notes || 'Reported fake. Address mismatch or resident not located in area.'}"
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleOpenEditModal(v)}
                            className="text-[10px] text-slate-500 hover:text-yellow-600 bg-slate-50 border border-slate-200 hover:border-yellow-300 px-2 py-1 rounded transition-all cursor-pointer"
                          >
                            Edit Status
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={fakeVotersPage}
              pageSize={fakeVotersPageSize}
              totalItems={fakeVotersList.length}
              onPageChange={setFakeVotersPage}
              onPageSizeChange={(newSize) => {
                setFakeVotersPageSize(newSize);
                setFakeVotersPage(1);
              }}
              pageSizeOptions={[10, 15, 25, 50]}
              itemName="flagged records"
              accentColor="amber"
            />

          </div>
        )}



        {/* --------------------------------------------------------
            TAB 6: TASKS PANEL
           -------------------------------------------------------- */}
        {activeTab === 'tasks' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" id="village-tasks-view">
            
            {/* Left 2 Columns: Tasks list */}
            <div className="lg:col-span-2 bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-4">
              <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Task Allocations</h2>
                  <p className="text-xs text-slate-400 font-medium">Management and delegation of local cadre responsibilities</p>
                </div>
                <span className="text-[10px] font-black text-slate-500 bg-slate-50 px-2.5 py-1 rounded border border-slate-100">
                  Active Tasks: {tasksList.length}
                </span>
              </div>

              <div className="space-y-4 pt-1">
                {tasksList.map((task) => {
                  const assignedToIncharge = cadreList.find(i => i.id === task.assignedTo);
                  const isOverdue = new Date() > new Date(task.dueDate) && task.status !== 'Completed';
                  
                  return (
                    <div key={task.id} className="border border-slate-150 rounded-xl p-4 bg-slate-50/30 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${task.priority === 'Urgent' ? 'bg-red-50 text-red-700 border border-red-100 animate-pulse' : 'bg-slate-50 text-slate-700 border border-slate-200'}`}>
                            {task.priority} Priority
                          </span>
                        </div>
                        <span className={`text-[10px] font-bold ${isOverdue ? 'text-red-500 font-extrabold' : 'text-slate-400'}`}>
                          Due Date: {task.dueDate} {isOverdue && '(Overdue)'}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-900">{task.title}</h4>
                        <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                          {task.instructions}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[10px] text-slate-400 font-semibold">
                        <p>
                          Assigned To: <span className="text-slate-700 uppercase font-bold">{assignedToIncharge ? assignedToIncharge.name : 'All Cadres'}</span> 
                          {assignedToIncharge && ` (${assignedToIncharge.group})`}
                        </p>
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black ${task.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                          {task.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Delegate Task Form */}
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-4 h-fit">
              <div className="border-b border-gray-100 pb-2">
                <h3 className="font-bold text-base text-slate-900">Delegate New Task</h3>
                <p className="text-xs text-slate-400 font-medium">Assign specific operations to 100 Voter Incharges</p>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Task Title</label>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="e.g. 100% Voter slip distribution"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-yellow-400"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Assign To (Cadre)</label>
                  <select
                    value={newTaskAssignee}
                    onChange={(e) => setNewTaskAssignee(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none"
                  >
                    <option value="All">All Incharges / Cadres</option>
                    {cadreList.map(i => (
                      <option key={i.id} value={i.id}>{i.name} ({i.group || i.role})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Priority</label>
                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as any)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Due Date</label>
                    <input
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Actionable Instructions</label>
                  <textarea
                    rows={4}
                    value={newTaskInstructions}
                    onChange={(e) => setNewTaskInstructions(e.target.value)}
                    placeholder="Provide detailed instructions to guide the cadre..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:outline-none focus:border-yellow-400"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-yellow-400 hover:bg-yellow-500 text-slate-950 text-xs font-black rounded-lg shadow-sm hover:shadow active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Delegate Task
                </button>
              </form>
            </div>

          </div>
        )}

        {/* --------------------------------------------------------
            TAB 7: CASTE & DEMOGRAPHIC ANALYTICS
           -------------------------------------------------------- */}
        {activeTab === 'caste_analytics' && (
          <div className="space-y-6 animate-fade-in" id="village-analytics-view">
            
            {/* Header / Legend Block */}
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm" id="analytics-header">
              <div className="border-b border-gray-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Demographic & Caste Intelligence</h2>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Statistical support share distributions of active village voters</p>
                </div>
                
                {/* Custom Styled Party Legend */}
                <div className="flex flex-wrap items-center gap-2.5 text-[10px] font-black uppercase">
                  {(Object.keys(PARTY_COLORS) as VoterPreference[]).map(p => (
                    <span key={p} className="flex items-center gap-1 shrink-0">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PARTY_COLORS[p] }}></span>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Caste Verification Warning Callout */}
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm flex gap-3" id="caste-verification-warning-banner">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-black text-amber-800 uppercase tracking-wide">CASTE AUDIT WARNING</h4>
                <p className="text-xs text-amber-700 font-semibold leading-relaxed mt-0.5">
                  WARNING: Never automatically infer caste from Name, Surname, Religion, Village, Profession, or Family Name. Caste must ONLY be recorded based on physical ground verification.
                </p>
              </div>
            </div>

            {/* 2x2 Stacked horizontal charts grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="analytics-grid">
              
              {/* Chart 1: Sub-Caste Analysis */}
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">Sub-Caste Analysis</h3>
                <div className="space-y-3.5">
                  {casteChartsData.caste.map((item) => (
                    <div key={item.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-900">{item.name} ({item.total} voters)</span>
                        <span className="text-slate-400">TDP: {item.prefs.TDP} • YSRCP: {item.prefs.YSRCP}</span>
                      </div>
                      
                      {/* Segmented Progress Bar representing political preferences */}
                      <div className="w-full bg-slate-100 h-3 rounded-lg border border-slate-100 overflow-hidden flex">
                        {(Object.keys(PARTY_COLORS) as VoterPreference[]).map((p) => {
                          const count = item.prefs[p] || 0;
                          const pct = item.total > 0 ? (count / item.total) * 100 : 0;
                          if (pct <= 0) return null;
                          return (
                            <div
                              key={p}
                              className="h-full transition-all duration-300"
                              style={{ 
                                width: `${pct}%`, 
                                backgroundColor: PARTY_COLORS[p] 
                              }}
                              title={`${p}: ${count} (${Math.round(pct)}%)`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart 2: Profession Analysis */}
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">Profession Analysis</h3>
                <div className="space-y-3.5">
                  {casteChartsData.profession.map((item) => (
                    <div key={item.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-900">{item.name} ({item.total} voters)</span>
                        <span className="text-slate-400">TDP: {item.prefs.TDP} • YSRCP: {item.prefs.YSRCP}</span>
                      </div>
                      
                      <div className="w-full bg-slate-100 h-3 rounded-lg border border-slate-100 overflow-hidden flex">
                        {(Object.keys(PARTY_COLORS) as VoterPreference[]).map((p) => {
                          const count = item.prefs[p] || 0;
                          const pct = item.total > 0 ? (count / item.total) * 100 : 0;
                          if (pct <= 0) return null;
                          return (
                            <div
                              key={p}
                              className="h-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: PARTY_COLORS[p] }}
                              title={`${p}: ${count} (${Math.round(pct)}%)`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart 3: Age Group Analysis */}
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">Age Group Analysis</h3>
                <div className="space-y-3.5">
                  {casteChartsData.age.map((item) => (
                    <div key={item.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-900">{item.name} ({item.total} voters)</span>
                        <span className="text-slate-400">TDP: {item.prefs.TDP} • YSRCP: {item.prefs.YSRCP}</span>
                      </div>
                      
                      <div className="w-full bg-slate-100 h-3 rounded-lg border border-slate-100 overflow-hidden flex">
                        {(Object.keys(PARTY_COLORS) as VoterPreference[]).map((p) => {
                          const count = item.prefs[p] || 0;
                          const pct = item.total > 0 ? (count / item.total) * 100 : 0;
                          if (pct <= 0) return null;
                          return (
                            <div
                              key={p}
                              className="h-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: PARTY_COLORS[p] }}
                              title={`${p}: ${count} (${Math.round(pct)}%)`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart 4: Gender Analysis */}
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">Gender Support Analysis</h3>
                <div className="space-y-3.5">
                  {casteChartsData.gender.map((item) => (
                    <div key={item.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-900">{item.name} ({item.total} voters)</span>
                        <span className="text-slate-400">TDP: {item.prefs.TDP} • YSRCP: {item.prefs.YSRCP}</span>
                      </div>
                      
                      <div className="w-full bg-slate-100 h-3 rounded-lg border border-slate-100 overflow-hidden flex">
                        {(Object.keys(PARTY_COLORS) as VoterPreference[]).map((p) => {
                          const count = item.prefs[p] || 0;
                          const pct = item.total > 0 ? (count / item.total) * 100 : 0;
                          if (pct <= 0) return null;
                          return (
                            <div
                              key={p}
                              className="h-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: PARTY_COLORS[p] }}
                              title={`${p}: ${count} (${Math.round(pct)}%)`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* --------------------------------------------------------
            TAB 8: CADRE NETWORK VIEW
           -------------------------------------------------------- */}
        {activeTab === 'cadre_network' && (
          <div className="space-y-5 animate-fade-in" id="village-cadre-network-view">
            
            {/* Redesigned Header Summary */}
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">Ponnaluru Cadre Network Dashboard</h2>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">Dual-tier cadre management mapping Booth Leaders & 100-Voter Incharges</p>
              </div>
              <div className="flex items-center gap-2 border border-slate-100 bg-slate-50 rounded-lg p-2 shrink-0">
                <div className="text-center px-3 border-r border-slate-200">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Booths</p>
                  <p className="text-sm font-black text-slate-950">3 Booths</p>
                </div>
                <div className="text-center px-3 border-r border-slate-200">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Incharges</p>
                  <p className="text-sm font-black text-slate-950">40 Active</p>
                </div>
                <div className="text-center px-3">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Village Lead</p>
                  <p className="text-sm font-black text-emerald-600">TDP +670</p>
                </div>
              </div>
            </div>

            {/* Sub-tabs Selector */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                onClick={() => setCadreActiveTab('booth')}
                className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all border cursor-pointer ${
                  cadreActiveTab === 'booth'
                    ? 'bg-yellow-400 text-slate-950 border-yellow-400 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Booth Incharges ({boothInchargesData.length})
              </button>
              <button
                onClick={() => setCadreActiveTab('voter')}
                className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all border cursor-pointer ${
                  cadreActiveTab === 'voter'
                    ? 'bg-yellow-400 text-slate-950 border-yellow-400 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                100 Voter Incharges ({cadreNetworkList.length})
              </button>
            </div>

            {/* TAB 1 CONTENT: BOOTH INCHARGES */}
            {cadreActiveTab === 'booth' && (
              boothInchargesData.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">No Booth Incharges Appointed</p>
                  <p className="text-xs text-slate-400 mt-1">Booth incharges registered in this unit will appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-fade-in" id="booth-incharges-grid">
                  {boothInchargesData.map((boothInc) => {
                    return (
                      <div key={boothInc.booth} className="bg-white border-2 border-slate-200 rounded-xl shadow-sm p-5 space-y-4 hover:shadow-md transition-all relative overflow-hidden">
                        {/* Top Accent line */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400"></div>
                        
                        {/* Serial Number & Role Badge */}
                        <div className="flex items-center justify-between">
                          <span className="text-xl font-black text-amber-500 tracking-tight">
                            {boothInc.serial}
                          </span>
                          <span className="text-[10px] bg-slate-950 text-amber-400 border border-slate-800 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                            Booth Incharge
                          </span>
                        </div>

                        {/* Header: Name, Mobile, Booth */}
                        <div className="space-y-1.5 border-b border-slate-100 pb-3">
                          <h4 className="text-sm font-black text-slate-950 uppercase">{boothInc.name}</h4>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                            <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{boothInc.mobile}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Jurisdiction:</span>
                            <span className="font-extrabold text-slate-900 text-sm">{boothInc.booth}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Total Voters:</span>
                            <span className="font-extrabold text-slate-950 text-xs bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">{boothInc.totalVoters.toLocaleString()} Voters</span>
                          </div>
                        </div>

                        {/* Counts Breakdown Section */}
                        <div className="space-y-2">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Booth Preference Breakdown</p>
                          
                          <div className="flex flex-wrap items-center gap-1.5">
                            {(Object.keys(boothInc.counts) as VoterPreference[]).map((pref) => {
                              const val = boothInc.counts[pref] || 0;
                              if (val <= 0) return null;
                              return (
                                <span 
                                  key={pref} 
                                  className={`text-[10px] font-black px-2 py-0.5 rounded-md border flex items-center gap-1 ${PARTY_BG_COLORS[pref]}`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: PARTY_COLORS[pref] }}></span>
                                  {pref}: <span className="text-[11px] font-black">{val}</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        {/* Majority/Leading party highlight */}
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-black uppercase text-[10px]">Majority Lead:</span>
                          {boothInc.totalVoters > 0 ? (
                            <span className={`font-black uppercase text-[11px] flex items-center gap-1.5 ${PARTY_TEXT_COLORS[boothInc.majorityParty]}`}>
                              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: PARTY_COLORS[boothInc.majorityParty] }}></span>
                              {boothInc.majorityParty} <span className="font-black text-xs px-2 py-0.5 rounded bg-white border border-slate-200 shadow-sm">(+{boothInc.majorityLead} Votes)</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">No active data</span>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* TAB 2 CONTENT: 100 VOTER INCHARGES */}
            {cadreActiveTab === 'voter' && (
              <div className="space-y-4">
                {paginatedCadres.length === 0 ? (
                  <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">No 100-Voter Cadres Appointed</p>
                    <p className="text-xs text-slate-400 mt-1">Local cadre incharges assigned under this village will appear here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-fade-in" id="voter-incharges-grid">
                    {paginatedCadres.map((cadre, index) => {
                      const serialNum = `#${String((cadrePage - 1) * cadrePageSize + index + 1).padStart(3, '0')}`;
                      const hasSupporters = cadre.votersCount > 0;
                    
                      return (
                        <div key={cadre.id} className="bg-white border-2 border-slate-200 rounded-xl shadow-sm p-4 space-y-4 hover:shadow-md transition-all relative overflow-hidden">
                          {/* Top Accent line */}
                          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>

                          {/* Serial Number & Role Tag */}
                          <div className="flex items-center justify-between">
                            <span className="text-xl font-black text-amber-500 tracking-tight">
                              {serialNum}
                            </span>
                            <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                              100 Voter Incharge
                            </span>
                          </div>
                          
                          {/* Header: Name, Mobile, Booth */}
                          <div className="space-y-1.5 border-b border-slate-100 pb-3">
                            <h4 className="text-sm font-black text-slate-950 uppercase">{cadre.name}</h4>
                            <p className="text-[10px] text-slate-400 font-bold tracking-wider">{cadre.group} Lead</p>
                            
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-1">
                              <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{cadre.mobile}</span>
                            </div>

                            <div className="flex items-center justify-between text-xs pt-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Booth location:</span>
                              <span className="font-extrabold text-slate-800">{cadre.boothNumber.split(' (')[0]}</span>
                            </div>

                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Assigned voters:</span>
                              <span className="font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">{cadre.votersCount} Voters</span>
                            </div>
                          </div>

                          {/* Counts Breakdown Progress Section */}
                          <div className="space-y-2">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Team Preference Breakdown</p>
                            
                            <div className="flex flex-wrap items-center gap-1.5">
                              {(Object.keys(cadre.counts) as VoterPreference[]).map((pref) => {
                                const val = cadre.counts[pref] || 0;
                                if (val <= 0) return null;
                                return (
                                  <span 
                                    key={pref} 
                                    className={`text-[9px] font-black px-1.5 py-0.5 rounded border flex items-center gap-1 ${PARTY_BG_COLORS[pref]}`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: PARTY_COLORS[pref] }}></span>
                                    {pref}: {val}
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          {/* Majority/Leading party highlight */}
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                            <span className="text-slate-500 font-black uppercase text-[10px]">Majority Lead:</span>
                            {hasSupporters ? (
                              <span className={`font-black uppercase text-[10px] flex items-center gap-1.5 ${PARTY_TEXT_COLORS[cadre.majorityParty]}`}>
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PARTY_COLORS[cadre.majorityParty] }}></span>
                                {cadre.majorityParty} <span className="font-black text-xs px-1.5 py-0.5 rounded bg-white border border-slate-200 shadow-sm">(+{cadre.majorityLead} Votes)</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">No active data</span>
                            )}
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}

              <Pagination
                currentPage={cadrePage}
                pageSize={cadrePageSize}
                totalItems={cadreNetworkList.length}
                onPageChange={setCadrePage}
                onPageSizeChange={(newSize) => {
                  setCadrePageSize(newSize);
                  setCadrePage(1);
                }}
                pageSizeOptions={[6, 12, 24, 48]}
                itemName="incharges"
                accentColor="amber"
              />
            </div>
            )}

          </div>
        )}

        {/* --------------------------------------------------------
            TAB 9: TRAINING VIDEOS PANEL
           -------------------------------------------------------- */}
        {activeTab === 'training' && (
          <div className="space-y-5 animate-fade-in" id="village-training-view">
            
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-900">Cadre Operations Training Library</h2>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">Instructional briefs and capability guidelines for election-day actions</p>
            </div>

            {/* Video grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" id="videos-grid">
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
                <div key={video.id} className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                  
                  {/* Thumbnail / Duration */}
                  <div className="relative aspect-video bg-slate-900">
                    <img 
                      referrerPolicy="no-referrer"
                      src={video.thumbnailUrl} 
                      alt={video.title} 
                      className="w-full h-full object-cover opacity-80"
                    />
                    <div className="absolute inset-0 bg-slate-950/20"></div>
                    <span className="absolute bottom-2.5 right-2.5 bg-slate-950/80 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                      {video.duration}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[8px] bg-yellow-400/10 text-yellow-600 border border-yellow-400/20 px-2 py-0.5 rounded uppercase tracking-wider font-extrabold">
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
                      <h4 className="text-xs font-black text-slate-950 leading-snug">{video.title}</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                        {video.description}
                      </p>
                    </div>

                    <button
                      onClick={() => handleWatchTraining(video)}
                      className="w-full mt-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-lg transition-all text-center uppercase cursor-pointer"
                    >
                      Watch Training Clip
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
          MODAL: VOTER RECORD EDIT
         -------------------------------------------------------- */}
      {editingVoter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" id="voter-edit-modal-wrapper">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-slate-950 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide">Edit Voter Profile</h3>
                <p className="text-[10px] text-slate-400 font-semibold">{editingVoter.name} (Age {editingVoter.age}, {editingVoter.gender})</p>
              </div>
              <button 
                onClick={() => setEditingVoter(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveVoterEdit} className="flex flex-col max-h-[85vh]">
              
              {/* Scrollable form body */}
              <div className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: '60vh' }} id="modal-scrollable-body">
                
                {/* Info summary row */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-700">
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">EPIC Number</p>
                    <p className="font-mono text-yellow-700 font-bold">{editingVoter.epicNumber}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Polling Booth</p>
                    <p className="truncate text-slate-900">{editingVoter.boothNumber}</p>
                  </div>
                </div>

                {/* Section 1: Political Affiliation */}
                <div className="border-b border-slate-100 pb-3 space-y-2">
                  <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-wider">1. Campaign Preferences</h4>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Political Preference</label>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                      {(Object.keys(PARTY_COLORS) as VoterPreference[]).map((pref) => {
                        const active = editPreference === pref;
                        return (
                          <button
                            key={pref}
                            type="button"
                            onClick={() => setEditPreference(pref)}
                            className={`py-1.5 text-center text-[10px] font-black rounded-lg border transition-all cursor-pointer ${active ? `${PARTY_BG_COLORS[pref]} border-yellow-400 font-extrabold shadow-sm` : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                          >
                            {pref}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Section 2: Registration Status */}
                <div className="border-b border-slate-100 pb-3 space-y-3">
                  <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-wider">2. Registration & Status</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Voter Status</label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as VoterStatus)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-yellow-400"
                      >
                        <option value="Active">Active / Valid resident</option>
                        <option value="Shifted">Shifted / Migrated address</option>
                        <option value="Deceased">Deceased voter</option>
                        <option value="Duplicate">Duplicate registration</option>
                        <option value="Fake">Fake registration / Flag delete</option>
                        <option value="Doubtful">Doubtful registration</option>
                        <option value="Unknown">Unknown registration</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Profession / Job Title</label>
                      <input
                        type="text"
                        value={editProfession}
                        onChange={(e) => setEditProfession(e.target.value)}
                        placeholder="e.g., Farmer, Business, Homemaker"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-yellow-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Location Tracking */}
                <div className="border-b border-slate-100 pb-3 space-y-3">
                  <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-wider">3. Voter Location Tracking</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Location Status</label>
                      <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                          type="button"
                          onClick={() => {
                            setEditLocationStatus('Local');
                            setEditCurrentLocation('');
                          }}
                          className={`flex-1 py-1 text-center text-[10px] font-black uppercase rounded-md transition-all cursor-pointer ${editLocationStatus === 'Local' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                          Local Resident
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditLocationStatus('Migrated')}
                          className={`flex-1 py-1 text-center text-[10px] font-black uppercase rounded-md transition-all cursor-pointer ${editLocationStatus === 'Migrated' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                          Migrated
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Current Location City</label>
                      <input
                        type="text"
                        value={editCurrentLocation}
                        onChange={(e) => setEditCurrentLocation(e.target.value)}
                        placeholder="e.g., Hyderabad, Dubai, Bangalore"
                        disabled={editLocationStatus === 'Local'}
                        className={`w-full p-2 border rounded-lg text-xs font-bold focus:outline-none ${editLocationStatus === 'Local' ? 'bg-slate-200 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-slate-50 border-slate-200 focus:border-yellow-400 text-slate-900'}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Caste verification with critical warning */}
                <div className="border-b border-slate-100 pb-3 space-y-3">
                  <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-wider">4. Caste & Demographics</h4>
                  
                  {/* Warning banner */}
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-[10px] font-bold text-red-700 leading-normal flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" id="alert-icon-edit-modal" />
                    <p>
                      WARNING: Never automatically infer caste from Name, Surname, Religion, Village, Profession, or Family Name. Caste must ONLY be recorded based on physical ground verification.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Caste Category</label>
                      <input
                        type="text"
                        value={editCaste}
                        onChange={(e) => setEditCaste(e.target.value)}
                        placeholder="e.g., Kamma, Reddy, Yadava"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-yellow-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Sub-Caste</label>
                      <input
                        type="text"
                        value={editSubCaste}
                        onChange={(e) => setEditSubCaste(e.target.value)}
                        placeholder="e.g., Chowdary, Naidu, None"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-yellow-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 5: Live Voter Tracking on Election Day */}
                <div className="border-b border-slate-100 pb-3 space-y-3">
                  <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-wider">5. Election Day Live Track</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Vote Done Status</label>
                      <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setEditVoteStatus('NOT VOTED')}
                          className={`flex-1 py-1 text-center text-[10px] font-black uppercase rounded-md transition-all cursor-pointer ${editVoteStatus === 'NOT VOTED' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                          Not Voted
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditVoteStatus('VOTE DONE')}
                          className={`flex-1 py-1 text-center text-[10px] font-black uppercase rounded-md transition-all cursor-pointer ${editVoteStatus === 'VOTE DONE' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                          Voted
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Vote Done Time</label>
                      <input
                        type="text"
                        value={editVoteDoneTime}
                        onChange={(e) => setEditVoteDoneTime(e.target.value)}
                        placeholder="e.g., 10:15 AM"
                        disabled={editVoteStatus === 'NOT VOTED'}
                        className={`w-full p-2 border rounded-lg text-xs font-bold focus:outline-none ${editVoteStatus === 'NOT VOTED' ? 'bg-slate-200 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-slate-50 border-slate-200 focus:border-yellow-400 text-slate-900'}`}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Polling Agent Incharge Assessment</label>
                    <select
                      value={editInchargeAssessment}
                      onChange={(e) => setEditInchargeAssessment(e.target.value as any)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-yellow-400"
                    >
                      <option value="Unknown">Unknown (Silent or Private)</option>
                      <option value="TDP">TDP Support Confirmed</option>
                      <option value="YSRCP">YSRCP Support Confirmed</option>
                      <option value="JSP">JSP Support Confirmed</option>
                      <option value="BJP">BJP Support Confirmed</option>
                      <option value="INC">INC Support Confirmed</option>
                      <option value="Neutral">Neutral / Floating</option>
                      <option value="OTH">OTH Support Confirmed</option>
                    </select>
                  </div>
                </div>

                {/* Section 6: Notes */}
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-wider">6. Remarks & Field Notes</h4>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Provide specific notes or context observed on the field..."
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-yellow-400"
                  />
                </div>

              </div>

              {/* Modal footer with action buttons */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingVoter(null)}
                  className="flex-1 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-black rounded-lg transition-all text-center uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-yellow-400 hover:bg-yellow-500 text-slate-950 text-xs font-black rounded-lg shadow-sm hover:shadow transition-all text-center uppercase cursor-pointer"
                >
                  Save Profile
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------
          MODAL: TRAINING VIDEO PLAYER
         -------------------------------------------------------- */}
      {watchingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" id="video-modal-wrapper">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-scale-up">
            
            {/* Header */}
            <div className="bg-slate-950 text-white p-4 flex items-center justify-between">
              <div>
                <span className="text-[8px] bg-yellow-400 text-slate-950 px-2 py-0.5 rounded font-black uppercase">
                  {watchingVideo.category}
                </span>
                <h3 className="text-xs font-black mt-1 uppercase truncate">{watchingVideo.title}</h3>
              </div>
              <button 
                onClick={() => setWatchingVideo(null)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Canvas Mock */}
            <div className="relative aspect-video bg-slate-900 flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-yellow-400 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center text-slate-950 shadow-md">
                <Video className="w-8 h-8 ml-0.5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Stream is buffering...</h4>
                <p className="text-xs text-slate-400 max-w-sm">
                  Connecting to secure CDN server for "{watchingVideo.title}". Ensure your mobile network is encrypted.
                </p>
              </div>
            </div>

            {/* Video description */}
            <div className="p-5 bg-slate-50 border-t border-slate-100 text-xs font-semibold text-slate-500 space-y-1">
              <span className="font-extrabold text-slate-800 uppercase text-[10px]">Strategic Briefing:</span>
              <p className="leading-relaxed">
                {watchingVideo.description}
              </p>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}
