import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Activity, 
  AlertTriangle, 
  CheckSquare, 
  Video, 
  LogOut, 
  Search, 
  Filter, 
  Plus, 
  X, 
  ArrowLeft, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  ChevronDown, 
  User, 
  Smartphone, 
  MapPin, 
  Mail, 
  SlidersHorizontal, 
  BookOpen, 
  Trash2,
  Award,
  HelpCircle,
  Menu,
  ShieldCheck,
  BarChart3,
  Calendar,
  Check,
  Phone,
  Pencil,
  Play
} from 'lucide-react';
import { UserSession, Voter, VoterPreference, VoterStatus, SurveyStatus, VoterTask, TrainingVideo, GroundReport } from '../types';
import {
  createReport,
  createTask,
  ensureTrainingAssigned,
  fetchHierarchySummaryByUser,
  fetchReportsForUnit,
  fetchTasksForUnit,
  fetchTrainingProgress,
  fetchTrainingVideos,
  fetchVotersForUnit,
  type HierarchySummaryPayload,
  type TrainingProgressItem,
  syncVoter,
  updateTaskStatus,
  updateTrainingProgress,
} from '../lib/api';
import { 
  INCHARGES, 
  TRAINING_VIDEOS, 
} from '../utils/boothHelpers';

interface BoothInchargeDashboardProps {
  session: UserSession;
  onLogout: () => void;
}

const PARTY_COLORS: Record<VoterPreference, { bg: string; text: string; hex: string; lightBg: string; border: string; darkText: string }> = {
  TDP: { bg: 'bg-yellow-400', text: 'text-yellow-800', hex: '#eab308', lightBg: 'bg-yellow-50', border: 'border-yellow-200', darkText: 'text-yellow-800' },
  YSRCP: { bg: 'bg-blue-600', text: 'text-blue-600', hex: '#2563eb', lightBg: 'bg-blue-50', border: 'border-blue-200', darkText: 'text-blue-800' },
  JSP: { bg: 'bg-red-600', text: 'text-red-600', hex: '#dc2626', lightBg: 'bg-red-50', border: 'border-red-200', darkText: 'text-red-800' },
  BJP: { bg: 'bg-orange-500', text: 'text-orange-500', hex: '#f97316', lightBg: 'bg-orange-50', border: 'border-orange-200', darkText: 'text-orange-800' },
  INC: { bg: 'bg-sky-400', text: 'text-sky-400', hex: '#38bdf8', lightBg: 'bg-sky-50', border: 'border-sky-200', darkText: 'text-sky-950' },
  Neutral: { bg: 'bg-gray-400', text: 'text-gray-500', hex: '#9ca3af', lightBg: 'bg-gray-50', border: 'border-gray-200', darkText: 'text-gray-800' },
  OTH: { bg: 'bg-purple-600', text: 'text-purple-600', hex: '#9333ea', lightBg: 'bg-purple-50', border: 'border-purple-200', darkText: 'text-purple-800' }
};

export function getVoterCategory(v: Voter): 'SC' | 'ST' | 'BC' | 'OC' | 'OBC' | 'Unknown' {
  const cat = (v.subCaste || '').trim().toUpperCase();
  if (['SC', 'ST', 'BC', 'OC', 'OBC'].includes(cat)) {
    return cat as any;
  }
  // Otherwise, fallback map from v.caste
  const caste = (v.caste || '').trim();
  if (!caste) return 'Unknown';
  
  const cLower = caste.toLowerCase();
  if (['mala', 'madiga'].includes(cLower)) return 'SC';
  if (['yanadi', 'yerukula'].includes(cLower)) return 'ST';
  if (['yadava', 'goud', 'rajaka', 'nayee brahmin', 'vaddera', 'devanga', 'padmasali', 'viswabrahmin', 'mudhiraj', 'munnuru kapu'].includes(cLower)) return 'BC';
  if (['kamma', 'reddy', 'kapu', 'balija', 'telaga', 'brahmin', 'arya vysya', 'velama'].includes(cLower)) return 'OC';
  if (['obc'].includes(cLower)) return 'OBC';
  if (cLower === 'muslim') return 'BC';
  if (cLower === 'christian') return 'OC';
  
  return 'Unknown';
}

export function standardizeCasteName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'Other';
  const lower = trimmed.toLowerCase();
  if (lower === 'kamma') return 'Kamma';
  if (lower === 'reddy') return 'Reddy';
  if (lower === 'kapu') return 'Kapu';
  if (lower === 'balija') return 'Balija';
  if (lower === 'telaga') return 'Telaga';
  if (lower === 'yadava' || lower === 'yadav') return 'Yadava';
  if (lower === 'goud') return 'Goud';
  if (lower === 'padmasali') return 'Padmasali';
  if (lower === 'devanga') return 'Devanga';
  if (lower === 'rajaka') return 'Rajaka';
  if (lower === 'nayee brahmin' || lower === 'nayee' || lower === 'nayi') return 'Nayee Brahmin';
  if (lower === 'vaddera') return 'Vaddera';
  if (lower === 'viswabrahmin' || lower === 'viswakarma') return 'Viswabrahmin';
  if (lower === 'mala') return 'Mala';
  if (lower === 'madiga') return 'Madiga';
  if (lower === 'yanadi') return 'Yanadi';
  if (lower === 'yerukula') return 'Yerukula';
  if (lower === 'muslim') return 'Muslim';
  if (lower === 'christian') return 'Christian';
  if (lower === 'brahmin') return 'Brahmin';
  if (lower === 'mudhiraj') return 'Mudhiraj';
  if (lower === 'munnuru kapu') return 'Munnuru Kapu';
  if (lower === 'velama') return 'Velama';
  if (lower === 'lambada') return 'Lambada';
  if (lower === 'gond') return 'Gond';
  if (lower === 'syed') return 'Syed';
  if (lower === 'pathan') return 'Pathan';
  if (lower === 'shaik') return 'Shaik';
  
  return trimmed.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export function standardizeProfession(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'Other';
  const lower = trimmed.toLowerCase();
  if (lower === 'farmer') return 'Farmer';
  if (lower.includes('labour') || lower.includes('agricultural')) return 'Agricultural Labour';
  if (lower.includes('private')) return 'Private Job';
  if (lower.includes('government') || lower === 'govt') return 'Government Employee';
  if (lower === 'business') return 'Business';
  if (lower.includes('self')) return 'Self Employed';
  if (lower === 'homemaker' || lower === 'housewife') return 'Homemaker';
  if (lower.includes('wage') || lower === 'coolie') return 'Daily Wage';
  if (lower === 'student') return 'Student';
  if (lower === 'driver') return 'Driver';
  if (lower === 'teacher') return 'Teacher';
  if (lower === 'retired' || lower === 'pensioner') return 'Retired';
  if (lower === 'unemployed') return 'Unemployed';
  
  return trimmed.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

interface ChartCardProps {
  title: string;
  icon: React.ReactNode;
  totalVoters: number;
  data: Array<{
    label: string;
    count: number;
    preferences: Record<VoterPreference, number>;
  }>;
}

function StackedBarChartCard({ title, icon, totalVoters, data }: ChartCardProps) {
  return (
    <div className="bg-white border border-slate-200/60 rounded-xl p-5 shadow-sm space-y-5 flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100/80 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">{icon}</span>
            <h3 className="font-bold text-[14px] text-slate-800">{title}</h3>
          </div>
          <span className="text-[10px] bg-slate-50 border border-slate-100 text-slate-500 font-extrabold px-2 py-0.5 rounded-md">
            N={totalVoters.toLocaleString()}
          </span>
        </div>

        {/* Chart Rows */}
        <div className="space-y-3.5">
          {data.map((row, idx) => {
            const rowTotal = row.count;
            return (
              <div key={row.label + '-' + idx} className="grid grid-cols-[140px_1fr] items-center gap-3">
                {/* Left label, right-aligned */}
                <div className="text-right truncate text-[11px] font-bold text-slate-600 pr-1" title={`${row.label} (${row.count})`}>
                  {row.label} <span className="text-slate-400 font-medium">({row.count})</span>
                </div>
                
                {/* Bar area */}
                <div className="relative h-6 flex items-center pl-2 border-l-2 border-slate-300">
                  {/* Subtle background grid lines */}
                  <div className="absolute inset-0 flex pointer-events-none pl-2">
                    <div className="w-1/5 h-full border-r border-dashed border-slate-100/80" />
                    <div className="w-1/5 h-full border-r border-dashed border-slate-100/80" />
                    <div className="w-1/5 h-full border-r border-dashed border-slate-100/80" />
                    <div className="w-1/5 h-full border-r border-dashed border-slate-100/80" />
                  </div>

                  {/* Horizontal Stacked Bar */}
                  {rowTotal > 0 ? (
                    <div className="relative w-full h-4 bg-slate-50 rounded-sm flex overflow-hidden shadow-sm z-10">
                      {(Object.keys(PARTY_COLORS) as VoterPreference[]).map(party => {
                        const count = row.preferences[party] || 0;
                        const pct = (count / rowTotal) * 100;
                        if (pct <= 0) return null;
                        return (
                          <div
                            key={party}
                            style={{ width: `${pct}%`, backgroundColor: PARTY_COLORS[party].hex }}
                            className="h-full cursor-pointer hover:brightness-105 transition-all relative group"
                            title={`${party}: ${count} (${pct.toFixed(1)}%)`}
                          >
                            {/* Hover tooltip */}
                            <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-slate-900 text-white text-[9px] rounded font-bold whitespace-nowrap pointer-events-none transition-opacity duration-150 z-50 shadow-md">
                              {party}: {count} ({pct.toFixed(1)}%)
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="w-full h-4 bg-slate-50 border border-dashed border-slate-200 rounded-sm flex items-center justify-center text-[9px] text-slate-400 italic z-10">
                    No voter records
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend below the chart */}
      <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5 pt-4 mt-4 border-t border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-wider select-none">
        {(Object.keys(PARTY_COLORS) as VoterPreference[]).map(party => (
          <div key={party} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PARTY_COLORS[party].hex }} />
            <span>{party}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BoothInchargeDashboard({ session, onLogout }: BoothInchargeDashboardProps) {
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'voters' | 'live-track' | 'fake-votes' | 'tasks' | 'caste' | 'teams' | 'videos'>(() => {
    const hash = window.location.hash;
    if (hash === '#/booth/voters') return 'voters';
    if (hash === '#/booth/live-track') return 'live-track';
    if (hash === '#/booth/fake-votes') return 'fake-votes';
    if (hash === '#/booth/tasks') return 'tasks';
    if (hash === '#/booth/caste') return 'caste';
    if (hash === '#/booth/cadre-network' || hash === '#/booth/teams') return 'teams';
    if (hash === '#/booth/videos') return 'videos';
    return 'dashboard';
  });

  // Track hash update
  useEffect(() => {
    const pathMap = {
      dashboard: '#/booth/dashboard',
      voters: '#/booth/voters',
      'live-track': '#/booth/live-track',
      'fake-votes': '#/booth/fake-votes',
      tasks: '#/booth/tasks',
      caste: '#/booth/caste',
      teams: '#/booth/cadre-network',
      videos: '#/booth/videos'
    };
    window.location.hash = pathMap[activeTab];
  }, [activeTab]);

  // Mobile sidebar open
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [backendSummary, setBackendSummary] = useState<HierarchySummaryPayload | null>(null);
  const [trainingVideos, setTrainingVideos] = useState<TrainingVideo[]>([]);
  const [trainingProgress, setTrainingProgress] = useState<Record<string, TrainingProgressItem>>({});

  const [voters, setVoters] = useState<Voter[]>([]);
  const [reports, setReports] = useState<GroundReport[]>([]);
  const [tasks, setTasks] = useState<VoterTask[]>([]);

  useEffect(() => {
    let active = true;

    Promise.all([
      fetchHierarchySummaryByUser(session.userId),
      fetchReportsForUnit(session.unitId).catch(() => null),
      fetchTasksForUnit(session.unitId).catch(() => null),
      fetchTrainingVideos(session.unitId).catch(() => null),
      fetchTrainingProgress(session.userId).catch(() => null),
      fetchVotersForUnit(session.unitId).catch(() => null),
    ])
      .then(([payload, reportsPayload, tasksPayload, videosPayload, progressItems, voterItems]) => {
        if (!active) {
          return;
        }

        setBackendSummary(payload);

        if (reportsPayload) {
          setReports(reportsPayload);
        }

        if (voterItems) {
          setVoters(voterItems);
        }

        if (tasksPayload) {
          setTasks(tasksPayload);
        }

        if (videosPayload) {
          setTrainingVideos(videosPayload);
        }

        if (progressItems) {
          const progressMap: Record<string, TrainingProgressItem> = {};
          progressItems.forEach((item) => {
            progressMap[item.video.id] = item;
          });
          setTrainingProgress(progressMap);
        }
      })
      .catch(() => {
      });

    return () => {
      active = false;
    };
  }, [session.userId]);

  // --------------------------------------------------------
  // DASHBOARD CALCULATIONS & METRICS
  // --------------------------------------------------------
  const totalVoters = voters.length;

  const partyStats = useMemo(() => {
    const stats: Record<VoterPreference, number> = {
      TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0
    };
    voters.forEach(v => {
      if (v.voterStatus !== 'Fake' && v.voterStatus !== 'Deceased') {
        stats[v.politicalPreference]++;
      }
    });
    return stats;
  }, [voters]);

  const totalValid = useMemo(() => {
    return (Object.values(partyStats) as number[]).reduce((a, b) => a + b, 0);
  }, [partyStats]);

  const fakeCount = voters.filter(v => v.voterStatus === 'Fake').length;
  const doubtfulCount = voters.filter(v => v.voterStatus === 'Doubtful').length;

  // Forecast leading calculation
  const forecast = useMemo(() => {
    const tdpVotes = (partyStats.TDP as number) + (partyStats.JSP as number) + (partyStats.BJP as number); // NDA alliance
    const ysrcpVotes = partyStats.YSRCP as number;
    
    if (tdpVotes > ysrcpVotes) {
      return { status: "TDP LEADS", lead: tdpVotes - ysrcpVotes };
    } else if (ysrcpVotes > tdpVotes) {
      return { status: "YSRCP LEADS", lead: ysrcpVotes - tdpVotes };
    } else {
      return { status: "TOO CLOSE TO CALL", lead: 0 };
    }
  }, [partyStats]);

  // --------------------------------------------------------
  // SEARCH & FILTERS FOR TAB 2: VOTERS LIST
  // --------------------------------------------------------
  const [voterSearch, setVoterSearch] = useState('');
  const [voterGroupFilter, setVoterGroupFilter] = useState('ALL');
  const [voterPrefFilter, setVoterPrefFilter] = useState('ALL');
  const [voterStatusFilter, setVoterStatusFilter] = useState('ALL');
  const [voterGenderFilter, setVoterGenderFilter] = useState('ALL');

  const filteredVoters = useMemo(() => {
    return voters.filter(v => {
      const q = voterSearch.toLowerCase().trim();
      const matchSearch = !q || 
        (v.name || '').toLowerCase().includes(q) ||
        (v.epicNumber || '').toLowerCase().includes(q) ||
        (v.serialNumber || '').toString() === q ||
        (v.mobileNumber || '').includes(q) ||
        (v.houseNumber || '').toLowerCase().includes(q) ||
        (v.caste || '').toLowerCase().includes(q);

      const matchGroup = voterGroupFilter === 'ALL' || v.assignedVoterGroup === voterGroupFilter;
      const matchPref = voterPrefFilter === 'ALL' || v.politicalPreference === voterPrefFilter;
      const matchStatus = voterStatusFilter === 'ALL' || v.voterStatus === voterStatusFilter;
      const matchGender = voterGenderFilter === 'ALL' || v.gender === voterGenderFilter;

      return matchSearch && matchGroup && matchPref && matchStatus && matchGender;
    });
  }, [voters, voterSearch, voterGroupFilter, voterPrefFilter, voterStatusFilter, voterGenderFilter]);

  // --------------------------------------------------------
  // EDITING MODAL STATE
  // --------------------------------------------------------
  const [editingVoter, setEditingVoter] = useState<Voter | null>(null);

  const handleUpdateVoter = (updated: Voter) => {
    setVoters(prev => prev.map(v => v.id === updated.id ? updated : v));
    setEditingVoter(null);

    void syncVoter(updated, session.userId).catch(() => {
      console.warn('Failed to sync voter update to backend');
    });
  };

  // --------------------------------------------------------
  // TAB 3: LIVE VOTER TRACK (ELECTION DAY)
  // --------------------------------------------------------
  const [liveSearch, setLiveSearch] = useState('');
  const [liveFilter, setLiveFilter] = useState<'ALL' | 'DONE' | 'NOT_VOTED'>('ALL');
  const [liveTeamFilter, setLiveTeamFilter] = useState('ALL');

  const voteDoneCount = voters.filter(v => v.voteStatus === 'VOTE DONE').length;
  const yetToVoteCount = totalVoters - voteDoneCount;
  const turnoutPercentage = totalVoters > 0 ? Math.round((voteDoneCount / totalVoters) * 100) : 0;

  const liveBoothStats = useMemo(() => {
    const migratedFallback = voters.filter((voter) => voter.voterLocationStatus === 'Migrated').length;
    const snapshot = backendSummary?.snapshot;

    return {
      totalVoters: snapshot?.summary.totalVoters ?? totalVoters,
      voted: snapshot?.summary.voted ?? voteDoneCount,
      remaining: snapshot?.summary.remaining ?? yetToVoteCount,
      fake: snapshot?.summary.fakeVoters ?? fakeCount,
      migrated: snapshot?.summary.migrated ?? migratedFallback,
    };
  }, [backendSummary, fakeCount, totalVoters, voteDoneCount, voters, yetToVoteCount]);

  const liveAssessmentStats = useMemo(() => {
    const counts: Record<string, number> = {
      TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0, Unknown: 0
    };
    voters.forEach(v => {
      if (v.voteStatus === 'VOTE DONE') {
        const ass = v.inchargeAssessment || 'Unknown';
        counts[ass]++;
      }
    });
    return counts;
  }, [voters]);

  const liveTrackVoters = useMemo(() => {
    return voters.filter(v => {
      const q = liveSearch.toLowerCase().trim();
      const matchSearch = !q || 
        (v.name || '').toLowerCase().includes(q) ||
        (v.epicNumber || '').toLowerCase().includes(q) ||
        (v.serialNumber || '').toString() === q ||
        (v.mobileNumber || '').includes(q);

      const isVoted = v.voteStatus === 'VOTE DONE';
      const matchVoteStatus = liveFilter === 'ALL' || 
        (liveFilter === 'DONE' && isVoted) || 
        (liveFilter === 'NOT_VOTED' && !isVoted);

      const matchTeam = liveTeamFilter === 'ALL' || v.assignedVoterGroup === liveTeamFilter;

      return matchSearch && matchVoteStatus && matchTeam;
    });
  }, [voters, liveSearch, liveFilter, liveTeamFilter]);

  // --------------------------------------------------------
  // TAB 5: TASK DELEGATION
  // --------------------------------------------------------
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskInstructions, setNewTaskInstructions] = useState('');
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState('100-INC-4592');
  const [newTaskPriority, setNewTaskPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const added: VoterTask = {
      id: `booth-task-${Date.now()}`,
      title: newTaskTitle,
      instructions: newTaskInstructions,
      assignedBy: "Booth Incharge",
      priority: newTaskPriority,
      assignedDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0], // 4 days due
      status: "Pending",
      assignedTo: newTaskAssignedTo
    };

    setTasks([added, ...tasks]);
    setNewTaskTitle('');
    setNewTaskInstructions('');

    void createTask({
      title: added.title,
      instructions: added.instructions,
      assignedBy: 'Booth Incharge',
      priority: added.priority,
      dueDate: added.dueDate,
      sourceUnitId: session.unitId,
      assigneeId: added.assignedTo,
    })
      .then((savedTask) => {
        setTasks((prev) => [savedTask, ...prev.filter((item) => item.id !== added.id)]);
      })
      .catch(() => {
      });
  };

  const handleToggleTaskStatus = (taskId: string) => {
    let nextStatus: VoterTask['status'] = 'Pending';
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        nextStatus = t.status === 'Completed' ? 'Pending' : 'Completed';
        return { ...t, status: nextStatus };
      }
      return t;
    }));

    void updateTaskStatus(taskId, nextStatus).catch(() => {
    });
  };

  // --------------------------------------------------------
  // TAB 6: CASTE & DEMOGRAPHIC ANALYTICS (DYNAMICS FOR 4 CHARTS)
  // --------------------------------------------------------
  
  // 1. Sub-Caste Analysis data
  const subCasteChartData = useMemo(() => {
    const grouped: Record<string, { label: string; count: number; preferences: Record<VoterPreference, number> }> = {};
    voters.forEach(v => {
      const rawCaste = (v.caste || '').trim();
      if (!rawCaste) return; // Only use manually entered data
      const stdName = standardizeCasteName(rawCaste);
      
      if (!grouped[stdName]) {
        grouped[stdName] = {
          label: stdName,
          count: 0,
          preferences: { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 }
        };
      }
      grouped[stdName].count++;
      grouped[stdName].preferences[v.politicalPreference]++;
    });
    
    // Sort descending by count, slice top 15
    return Object.values(grouped)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [voters]);

  // 2. Profession Analysis data
  const professionChartData = useMemo(() => {
    const grouped: Record<string, { label: string; count: number; preferences: Record<VoterPreference, number> }> = {};
    voters.forEach(v => {
      const rawProf = (v.profession || '').trim();
      if (!rawProf) return; // Only use manually entered data
      const stdName = standardizeProfession(rawProf);
      
      if (!grouped[stdName]) {
        grouped[stdName] = {
          label: stdName,
          count: 0,
          preferences: { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 }
        };
      }
      grouped[stdName].count++;
      grouped[stdName].preferences[v.politicalPreference]++;
    });
    
    // Sort descending by count
    return Object.values(grouped)
      .sort((a, b) => b.count - a.count);
  }, [voters]);

  // 3. Age Group Analysis data
  const ageGroupChartData = useMemo(() => {
    const groups = [
      { label: '18-25', count: 0, preferences: { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 } },
      { label: '26-40', count: 0, preferences: { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 } },
      { label: '41-60', count: 0, preferences: { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 } },
      { label: '60+', count: 0, preferences: { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 } }
    ];
    
    voters.forEach(v => {
      if (!v.age) return;
      let targetGroup = groups[3]; // Default to '60+'
      if (v.age >= 18 && v.age <= 25) targetGroup = groups[0];
      else if (v.age >= 26 && v.age <= 40) targetGroup = groups[1];
      else if (v.age >= 41 && v.age <= 60) targetGroup = groups[2];
      
      targetGroup.count++;
      targetGroup.preferences[v.politicalPreference]++;
    });
    
    return groups;
  }, [voters]);

  // 4. Gender Analysis data
  const genderChartData = useMemo(() => {
    const groups = [
      { label: 'Male', count: 0, preferences: { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 } },
      { label: 'Female', count: 0, preferences: { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 } },
      { label: 'Other', count: 0, preferences: { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 } }
    ];
    
    voters.forEach(v => {
      let targetGroup = groups[2]; // Default to 'Other'
      if (v.gender === 'Male') targetGroup = groups[0];
      else if (v.gender === 'Female') targetGroup = groups[1];
      
      targetGroup.count++;
      targetGroup.preferences[v.politicalPreference]++;
    });
    
    return groups;
  }, [voters]);

  // --------------------------------------------------------
  // TAB 7: CADRE NETWORK AGGREGATION
  // --------------------------------------------------------
  const teamSummaries = useMemo(() => {
    return INCHARGES.map(inc => {
      const teamVoters = voters.filter(v => v.assignedInchargeId === inc.id);
      const assignedCount = teamVoters.length;

      const pStats: Record<VoterPreference, number> = {
        TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0
      };
      teamVoters.forEach(v => {
        pStats[v.politicalPreference]++;
      });

      return {
        ...inc,
        assignedCount,
        pStats
      };
    });
  }, [voters]);

  // --------------------------------------------------------
  // REPORT SUBMISSION STATE
  // --------------------------------------------------------
  const [reportTab, setReportTab] = useState<'update' | 'complaint'>('update');
  const [generalContent, setGeneralContent] = useState('');
  const [issueCategory, setIssueCategory] = useState('Voter Slip Issue');
  const [complaintPriority, setComplaintPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
  const [complaintDesc, setComplaintDesc] = useState('');
  const [affectedVotersCount, setAffectedVotersCount] = useState(1);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const handleGeneralSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!generalContent.trim()) return;

    const newReport: GroundReport = {
      id: `REP-${Math.floor(1000 + Math.random() * 9000)}`,
      inchargeId: session.userId,
      inchargeName: session.userName,
      constituency: session.assignedConstituency,
      mandal: session.assignedMandal || "Kondapi",
      village: session.assignedVillage || "Kondapi Village",
      booth: session.assignedBooth || "Booth 145 (ZPHS North)",
      reportType: "General Update",
      priority: "Low",
      description: generalContent,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: "Pending"
    };

    setReports([newReport, ...reports]);
    setGeneralContent('');
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);

    void createReport({
      reportType: newReport.reportType,
      priority: newReport.priority,
      description: newReport.description,
      unitId: session.unitId,
      createdById: session.userId,
    })
      .then((savedReport) => {
        setReports((prev) => [savedReport, ...prev.filter((item) => item.id !== newReport.id)]);
      })
      .catch(() => {
      });
  };

  const handleComplaintSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintDesc.trim()) return;

    const newReport: GroundReport = {
      id: `REP-${Math.floor(1000 + Math.random() * 9000)}`,
      inchargeId: session.userId,
      inchargeName: session.userName,
      constituency: session.assignedConstituency,
      mandal: session.assignedMandal || "Kondapi",
      village: session.assignedVillage || "Kondapi Village",
      booth: session.assignedBooth || "Booth 145 (ZPHS North)",
      reportType: "Complaint / Issue",
      priority: complaintPriority,
      description: `[${issueCategory}] ${complaintDesc} (Affected Voters: ${affectedVotersCount})`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: "Pending",
      issueCategory,
      affectedVotersCount
    };

    setReports([newReport, ...reports]);
    setComplaintDesc('');
    setAffectedVotersCount(1);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);

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

  // Donut chart hover
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

  const donutChartData = useMemo(() => {
    return (Object.entries(partyStats) as [VoterPreference, number][]).map(([key, value]) => {
      const percentage = totalValid > 0 ? (value / totalValid) * 100 : 0;
      return {
        key,
        value,
        percentage,
        color: PARTY_COLORS[key as VoterPreference].hex
      };
    }).sort((a, b) => b.value - a.value);
  }, [partyStats, totalValid]);

  // Video state
  const [watchingVideo, setWatchingVideo] = useState<TrainingVideo | null>(null);

  return (
    <div className="w-full h-screen overflow-hidden flex flex-col lg:flex-row animate-fade-in text-gray-800" id="booth-dashboard-container">
      
      {/* --------------------------------------------------------
          LEFT SIDEBAR (Dark Navy themed)
         -------------------------------------------------------- */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-950 text-white p-5 flex flex-col justify-between transform transition-transform duration-300 lg:fixed lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        id="dashboard-sidebar"
      >
        <div className="space-y-6">
          {/* Logo & Branding */}
          <div className="flex items-center gap-3 border-b border-slate-800/80 pb-5">
            <div className="w-11 h-11 bg-yellow-400 rounded-full flex items-center justify-center text-slate-950 font-black text-lg shadow-md shrink-0">
              TDP
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-yellow-400">Kondapi TDP Connect</h2>
              <span className="text-[10px] bg-slate-900 text-yellow-300 font-extrabold uppercase px-2 py-0.5 rounded tracking-wide border border-yellow-400/20">
                BOOTH INCHARGE
              </span>
            </div>
            {/* Mobile close button */}
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-1.5 ml-auto text-slate-400 hover:text-white hover:bg-slate-900 rounded-md cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Operator Profile card */}
          <div className="bg-slate-900/50 p-3.5 rounded-xl border border-slate-800/60 space-y-1">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Assigned Jurisdiction</p>
            <h4 className="text-xs font-bold text-slate-100">{session.userName}</h4>
            <div className="text-[10px] text-slate-400 flex flex-col gap-0.5 font-mono">
              <span title={session.userId}>ID: {session.userId?.slice(-8).toUpperCase() || 'BOOTH'}</span>
              <span>Booth: {session.assignedBooth?.split(' ')[1] || '145'}</span>
              <span>Village: {session.assignedVillage || 'Kondapi Village'}</span>
              <span>Total Teams: {INCHARGES.length} Incharges</span>
            </div>
          </div>

          {/* Navigation links */}
          <nav className="space-y-1" id="sidebar-navigation">
            <button
              onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'dashboard' ? 'bg-yellow-400 text-slate-950 shadow font-black' : 'text-slate-300 hover:bg-slate-900 hover:text-white'}`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              Dashboard
            </button>

            <button
              onClick={() => { setActiveTab('voters'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'voters' ? 'bg-yellow-400 text-slate-950 shadow font-black' : 'text-slate-300 hover:bg-slate-900 hover:text-white'}`}
            >
              <Users className="w-4 h-4 shrink-0" />
              Voter List
            </button>

            <button
              onClick={() => { setActiveTab('live-track'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'live-track' ? 'bg-yellow-400 text-slate-950 shadow font-black' : 'text-slate-300 hover:bg-slate-900 hover:text-white'}`}
            >
              <Activity className="w-4 h-4 shrink-0" />
              Live Voter Track
            </button>

            <button
              onClick={() => { setActiveTab('fake-votes'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'fake-votes' ? 'bg-yellow-400 text-slate-950 shadow font-black' : 'text-slate-300 hover:bg-slate-900 hover:text-white'}`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Fake Votes
            </button>

            <button
              onClick={() => { setActiveTab('tasks'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'tasks' ? 'bg-yellow-400 text-slate-950 shadow font-black' : 'text-slate-300 hover:bg-slate-900 hover:text-white'}`}
            >
              <CheckSquare className="w-4 h-4 shrink-0" />
              Tasks
            </button>

            <button
              onClick={() => { setActiveTab('caste'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'caste' ? 'bg-yellow-400 text-slate-950 shadow font-black' : 'text-slate-300 hover:bg-slate-900 hover:text-white'}`}
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              Caste Analytics
            </button>

            <button
              onClick={() => { setActiveTab('teams'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'teams' ? 'bg-yellow-400 text-slate-950 shadow font-black' : 'text-slate-300 hover:bg-slate-900 hover:text-white'}`}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              Cadre Network
            </button>

            <button
              onClick={() => { setActiveTab('videos'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'videos' ? 'bg-yellow-400 text-slate-950 shadow font-black' : 'text-slate-300 hover:bg-slate-900 hover:text-white'}`}
            >
              <Video className="w-4 h-4 shrink-0" />
              Training Videos
            </button>
          </nav>
        </div>

        {/* Sign Out */}
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

      {/* Mobile backdrop */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/50 z-40 lg:hidden"
        />
      )}

      {/* --------------------------------------------------------
          MAIN CONTENT WORKSPACE
         -------------------------------------------------------- */}
      <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden min-w-0 lg:pl-64" id="main-booth-workspace">
        <div className="p-6 md:p-8 space-y-6 max-w-7xl w-full mx-auto">
        
        {/* Mobile Header Bar */}
        <div className="lg:hidden flex items-center justify-between bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-lg text-slate-700 cursor-pointer"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="text-center">
            <h1 className="text-xs font-black text-slate-900 uppercase tracking-widest">Kondapi Connect</h1>
            <p className="text-[9px] font-bold text-yellow-600">Booth Dashboard</p>
          </div>
          <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center font-bold text-sm">
            TDP
          </div>
        </div>

        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900" id="booth-title">
              My Booth Overview
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500 font-semibold">
              <span className="text-slate-900">Booth No: <strong className="font-extrabold">{session.assignedBooth || "Booth 145 (ZPHS North)"}</strong></span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-900">Total Voters: <strong className="font-extrabold text-slate-950">{totalVoters}</strong></span>
              <span className="text-slate-300">|</span>
              <span>Village: {session.assignedVillage || 'Kondapi Village'}</span>
            </div>
            <p className="text-xs font-medium text-slate-400 mt-1">
              Live analytics from your assigned polling booth.
            </p>
          </div>
          <div className="flex flex-col items-end shrink-0 bg-white border border-gray-100 p-3 rounded-lg shadow-sm text-right">
            <div className="flex items-center gap-1.5 text-xs font-bold text-green-600">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Live Booth Network Active
            </div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase mt-1">Aggregated Teams: {INCHARGES.length}</p>
          </div>
        </div>

        {/* --------------------------------------------------------
            TAB 1: DASHBOARD OVERVIEW
           -------------------------------------------------------- */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6" id="dashboard-tab-view">
            
            {/* ELECTION FORECAST BANNER */}
            <div className="relative bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white rounded-2xl p-6 md:p-8 shadow-md border border-slate-800" id="booth-forecast-banner">
              <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] from-yellow-400 via-transparent to-transparent"></div>
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="space-y-2">
                  <span className="px-2 py-0.5 bg-yellow-400/20 text-yellow-400 text-[10px] font-black uppercase tracking-widest rounded border border-yellow-400/20">
                    ELECTION FORECAST / RESULT
                  </span>
                  
                  <h2 className="text-3xl font-black tracking-tight" id="forecast-winner">
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
                    Based on voters in this polling booth.
                  </p>
                </div>
                
                {/* Trophy Accent Graphic */}
                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-center shrink-0 shadow">
                  <Award className="w-12 h-12 text-yellow-400" />
                </div>
              </div>
            </div>

            {/* TOP 4 CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="booth-top-cards">
              
              {/* Card 1: Total Voters */}
              <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Total Voters</p>
                <h3 className="text-3xl font-black text-slate-950">{liveBoothStats.totalVoters}</h3>
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                  <span>Assigned Teams</span>
                  <span className="font-extrabold text-slate-900">{INCHARGES.length} Incharges</span>
                </div>
              </div>

              {/* Card 2: Votes Completed */}
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                <p className="text-xs font-black text-amber-700 uppercase tracking-wider">Votes Completed</p>
                <h3 className="text-3xl font-black text-amber-500">{liveBoothStats.voted}</h3>
                <div className="pt-2 border-t border-amber-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                  <span>Turnout</span>
                  <span className="font-black text-amber-600">{liveBoothStats.totalVoters > 0 ? Math.round((liveBoothStats.voted / liveBoothStats.totalVoters) * 100) : 0}%</span>
                </div>
              </div>

              {/* Card 3: Remaining */}
              <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                <p className="text-xs font-black text-purple-700 uppercase tracking-wider">Remaining</p>
                <h3 className="text-3xl font-black text-purple-600">{liveBoothStats.remaining}</h3>
                <div className="pt-2 border-t border-purple-200/60 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                  <span>Pending outreach</span>
                  <span className="font-black text-purple-600">Active</span>
                </div>
              </div>

              {/* Card 4: Fake Votes */}
              <div className="bg-rose-50/50 border-2 border-rose-200 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                <p className="text-xs font-black text-rose-700 uppercase tracking-wider">Fake Votes</p>
                <h3 className="text-3xl font-black text-rose-600">{liveBoothStats.fake}</h3>
                <div className="pt-2 border-t border-rose-200/60 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                  <span>Migrated</span>
                  <span className="font-black text-rose-600">{liveBoothStats.migrated}</span>
                </div>
              </div>
            </div>

            {/* GROUND REPORT BREAKDOWN AND DONUT CHART SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="donut-reports-grid">
              
              {/* Left 2 Columns: Analytics */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Donut Chart and Ground Report Breakdown */}
                <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-6">
                  <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base text-slate-900">Voter Sentiment & Ground Report Breakdown</h3>
                      <p className="text-xs text-slate-400 font-medium">Dynamic preference distribution of voters</p>
                    </div>
                    <span className="text-[11px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded">
                      Total Voters: {totalVoters}
                    </span>
                  </div>

                  {/* Layout split: Donut and Party list */}
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    
                    {/* SVG Donut Chart */}
                    <div className="relative w-44 h-44 shrink-0" id="booth-donut-chart">
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
                            <span className="text-lg font-black text-slate-950">{partyStats[hoveredSlice as VoterPreference]}</span>
                            <span className="text-[9px] font-bold text-slate-500">
                              {Math.round((partyStats[hoveredSlice as VoterPreference] / totalValid) * 100)}% Share
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-[9px] font-bold uppercase text-slate-400">Total</span>
                            <span className="text-xl font-black text-slate-950">{totalValid}</span>
                            <span className="text-[9px] font-semibold text-green-600 uppercase">Voters</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Ground Report Breakdown table list */}
                    <div className="flex-1 w-full space-y-2">
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Ground Preference Counts</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {donutChartData.map((slice) => {
                          const info = PARTY_COLORS[slice.key as VoterPreference];
                          const isHovered = hoveredSlice === slice.key;
                          return (
                            <div 
                              key={slice.key}
                              onMouseEnter={() => setHoveredSlice(slice.key)}
                              onMouseLeave={() => setHoveredSlice(null)}
                              className={`flex items-center justify-between p-2 rounded-lg border text-xs font-bold transition-all ${isHovered ? 'bg-slate-50 border-yellow-400 shadow-sm' : 'bg-white border-slate-100'}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded" style={{ backgroundColor: slice.color }}></span>
                                <span className="text-slate-700">{slice.key}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-900">{slice.value} Votes</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${info.lightBg} ${info.darkText}`}>
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

              </div>

              {/* Right Column: Send Report to Command Center */}
              <div className="space-y-6">
                
                <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-4" id="send-report-panel-container">
                  <div className="border-b border-gray-100 pb-2 flex items-center justify-between">
                    <h3 className="font-bold text-base text-slate-900">Send Report to Command Center</h3>
                    <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
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
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Ground Feedback & Sentiment</label>
                        <textarea
                          rows={3}
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
                          value={complaintPriority}
                          onChange={(e) => setComplaintPriority(e.target.value as any)}
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
                          value={affectedVotersCount}
                          onChange={(e) => setAffectedVotersCount(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:outline-none focus:border-yellow-400"
                        />
                      </div>

                      {/* Description */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Complaint Description</label>
                        <textarea
                          rows={2}
                          value={complaintDesc}
                          onChange={(e) => setComplaintDesc(e.target.value)}
                          placeholder="Describe the issue in details..."
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:outline-none focus:border-yellow-400"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-yellow-400 hover:bg-yellow-500 text-slate-950 text-xs font-black rounded-lg shadow-sm hover:shadow active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        Submit Issue
                      </button>
                    </form>
                  )}

                  {/* Toast notification */}
                  {showSuccessToast && (
                    <div className="p-2.5 bg-green-50 border border-green-200 text-green-800 text-[10px] font-black rounded-lg flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      Report uploaded to Command Center!
                    </div>
                  )}

                  {/* Report Dispatched History */}
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Dispatched Reports ({reports.length})</h4>
                    <div className="max-h-40 overflow-y-auto space-y-1.5 font-semibold">
                      {reports.length === 0 ? (
                        <p className="text-[10px] text-gray-300 italic">No reports sent in this session.</p>
                      ) : (
                        reports.map((rep) => (
                          <div key={rep.id} className="bg-slate-50 border border-slate-100 rounded-lg p-2 space-y-1 text-[11px]">
                            <div className="flex justify-between items-center text-[9px]">
                              <span className="font-bold text-slate-400">{rep.id}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                rep.reportType === 'Complaint / Issue' ? 'bg-red-100 text-red-800' : 'bg-slate-200 text-slate-800'
                              }`}>
                                {rep.reportType === 'Complaint / Issue' ? rep.issueCategory || 'Complaint' : 'Update'}
                              </span>
                            </div>
                            <p className="text-slate-800 font-bold leading-tight">{rep.description}</p>
                            <div className="flex justify-between text-[8px] text-gray-400 pt-1 border-t border-gray-100/30">
                              <span>Priority: {rep.priority}</span>
                              <span>{rep.date} {rep.time}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* --------------------------------------------------------
            TAB 2: VOTER MANAGEMENT LIST
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
                    placeholder="Search by Voter Name, EPIC No, Serial No, Mobile Number..."
                    value={voterSearch}
                    onChange={(e) => setVoterSearch(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-yellow-400 focus:outline-none transition-all placeholder:text-gray-400 font-extrabold"
                  />
                  {voterSearch && (
                    <button 
                      onClick={() => setVoterSearch('')}
                      className="absolute right-3 top-3.5 text-gray-400 hover:text-slate-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Compact Filters row */}
              <div className="flex flex-wrap items-center gap-4 bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-xs font-bold text-slate-600">
                {/* 1. 100-Voter Team Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 uppercase tracking-wider text-[10px] font-black">100 Voter Team:</span>
                  <select
                    value={voterGroupFilter}
                    onChange={(e) => setVoterGroupFilter(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:border-yellow-400 cursor-pointer"
                  >
                    <option value="ALL">All Teams</option>
                    {INCHARGES.map(inc => (
                      <option key={inc.id} value={inc.group}>{inc.group}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Preference Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 uppercase tracking-wider text-[10px] font-black">Preference:</span>
                  <select
                    value={voterPrefFilter}
                    onChange={(e) => setVoterPrefFilter(e.target.value)}
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

                {/* 3. Voter Status Filter */}
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

                {/* Results Counter */}
                <div className="ml-auto text-slate-400 uppercase tracking-wider text-[10px] font-black">
                  Found: <span className="text-slate-800 font-extrabold">{filteredVoters.length}</span> / 1,247
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
                    <th className="px-6 py-4">100-VOTER TEAM</th>
                    <th className="px-6 py-4 text-center w-28">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs font-semibold">
                  {filteredVoters.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-400 font-bold">
                        No voter records match the active search or filters.
                      </td>
                    </tr>
                  ) : (
                    filteredVoters.map((v) => {
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
                              <p className="text-[11px] text-slate-400 font-mono tracking-wide font-bold">
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

                          {/* 100-VOTER TEAM */}
                          <td className="px-6 py-5">
                            <span className="inline-flex px-2.5 py-1 text-xs font-black text-slate-700 bg-slate-100 rounded-lg">
                              {v.assignedVoterGroup}
                            </span>
                          </td>

                          {/* ACTION */}
                          <td className="px-6 py-5">
                            <div className="flex items-center justify-center gap-2.5">
                              {/* Call button */}
                              <a
                                href={v.mobileNumber ? `tel:${v.mobileNumber}` : '#'}
                                className={`w-9 h-9 rounded-full border border-green-200 flex items-center justify-center transition-all ${
                                  v.mobileNumber 
                                    ? 'hover:bg-green-50 text-green-600 active:scale-90 hover:scale-105 animate-none' 
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
            </div>

          </div>
        )}

        {/* --------------------------------------------------------
            TAB 3: LIVE VOTER TRACK (Election Day)
           -------------------------------------------------------- */}
        {activeTab === 'live-track' && (
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-6" id="live-voter-track-view">
            
            {/* Title */}
            <div className="border-b border-gray-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-base text-slate-900">Live Voter Track</h3>
                <p className="text-xs text-slate-400 font-medium font-semibold">Real-time election turnout monitoring and campaign field assessment</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-xs font-bold text-green-700 font-mono">Real-time Aggregation Active</span>
              </div>
            </div>

            {/* Turnout Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col justify-between shadow-sm min-h-[90px]">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Total Booth Voters</span>
                <p className="text-3xl font-black text-slate-900">{totalVoters}</p>
              </div>
              <div className="bg-green-50/50 border border-green-100 rounded-xl p-4 flex flex-col justify-between shadow-sm min-h-[90px]">
                <span className="text-[10px] font-black uppercase text-green-700 tracking-wider">Votes Polled</span>
                <p className="text-3xl font-black text-green-600">{voteDoneCount}</p>
              </div>
              <div className="bg-yellow-50/50 border border-yellow-100 rounded-xl p-4 flex flex-col justify-between shadow-sm min-h-[90px]">
                <span className="text-[10px] font-black uppercase text-yellow-700 tracking-wider">Yet to Vote</span>
                <p className="text-3xl font-black text-yellow-600">{yetToVoteCount}</p>
              </div>
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex flex-col justify-between shadow-sm min-h-[90px]">
                <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider">Turnout Percentage</span>
                <p className="text-3xl font-black text-blue-600">{turnoutPercentage}%</p>
              </div>
            </div>

            {/* Live Field Assessment Grid (Vote Done Only) */}
            <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide">INCHARGE ASSESSMENT (CONFIDENTIAL)</h4>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-center">
                {(['TDP', 'YSRCP', 'JSP', 'BJP', 'INC', 'Neutral', 'OTH', 'Unknown'] as const).map((key) => {
                  const count = liveAssessmentStats[key] || 0;
                  const colorInfo = key !== 'Unknown' ? PARTY_COLORS[key as VoterPreference] : { bg: 'bg-gray-400', hex: '#64748b' };
                  
                  return (
                    <div key={key} className="bg-white border border-slate-100 rounded-lg p-2.5 shadow-sm space-y-1">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorInfo.hex }}></span>
                        <span className="text-[10px] font-bold text-slate-500">{key}</span>
                      </div>
                      <p className="text-lg font-black text-slate-900">{count}</p>
                    </div>
                  );
                })}
              </div>
              <p className="text-[9px] text-slate-400 font-medium italic">*Incharge assessments represent confidential feedback from doorstep volunteers; these are not official EVM counts.</p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by Name, EPIC No, Serial No, Phone..."
                  value={liveSearch}
                  onChange={(e) => setLiveSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:border-yellow-400 focus:outline-none placeholder:text-gray-400"
                />
              </div>

              {/* Team Group Filter */}
              <select
                value={liveTeamFilter}
                onChange={(e) => setLiveTeamFilter(e.target.value)}
                className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-yellow-400 cursor-pointer min-w-[120px]"
              >
                <option value="ALL">All Teams</option>
                {INCHARGES.map(inc => (
                  <option key={inc.id} value={inc.group}>{inc.group}</option>
                ))}
              </select>

              {/* Status filter buttons */}
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

            {/* Live Voter Track Table */}
            <div className="overflow-x-auto border border-gray-100 rounded-xl shadow-inner">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                    <th className="px-4 py-3 text-center w-12">S.No</th>
                    <th className="px-4 py-3">Voter Name</th>
                    <th className="px-4 py-3">EPIC No</th>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3">Mobile No</th>
                    <th className="px-4 py-3">Vote Status</th>
                    <th className="px-4 py-3">Incharge Assessment</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs font-semibold">
                  {liveTrackVoters.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400 font-bold">
                        No voters found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    liveTrackVoters.map((v) => {
                      const isVoted = v.voteStatus === 'VOTE DONE';
                      
                      return (
                        <tr key={v.id} className={`hover:bg-slate-50/70 transition-all ${isVoted ? 'bg-green-50/10' : ''}`}>
                          <td className="px-4 py-4 text-center font-mono text-slate-400 font-bold">
                            {v.serialNumber}
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-bold text-slate-900">{v.name}</div>
                            <div className="text-[10px] text-slate-400 font-medium">Age: {v.age} | {v.gender}</div>
                          </td>
                          <td className="px-4 py-4 font-mono text-slate-700 tracking-wider">
                            {v.epicNumber}
                          </td>
                          <td className="px-4 py-4 text-slate-500 font-bold text-[11px]">
                            {v.assignedVoterGroup}
                          </td>
                          <td className="px-4 py-4 font-mono font-bold text-slate-600">
                            {v.mobileNumber ? `+91 ${v.mobileNumber}` : '--'}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <input 
                                type="checkbox"
                                checked={isVoted}
                                onChange={(e) => {
                                  const updated: Voter = {
                                    ...v,
                                    voteStatus: e.target.checked ? 'VOTE DONE' : 'NOT VOTED',
                                    voteDoneTime: e.target.checked ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
                                    inchargeAssessment: e.target.checked ? v.politicalPreference : 'Unknown'
                                  };
                                  handleUpdateVoter(updated);
                                }}
                                className="w-4 h-4 rounded text-yellow-500 focus:ring-yellow-400 cursor-pointer accent-yellow-400"
                              />
                              {isVoted ? (
                                <div className="space-y-0.5">
                                  <span className="px-1.5 py-0.5 bg-green-100 text-green-800 text-[9px] font-black rounded uppercase">
                                    ✓ VOTE DONE
                                  </span>
                                  <span className="block text-[8px] text-slate-400 font-mono font-bold">{v.voteDoneTime || '11:00 AM'}</span>
                                </div>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 text-[9px] font-black rounded uppercase">
                                  PENDING
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            {isVoted ? (
                              <select
                                value={v.inchargeAssessment || 'Unknown'}
                                onChange={(e) => {
                                  const val = e.target.value as any;
                                  const updated: Voter = { ...v, inchargeAssessment: val };
                                  handleUpdateVoter(updated);
                                }}
                                className="text-[11px] font-extrabold p-1.5 bg-white border border-slate-200 rounded focus:outline-none focus:border-yellow-400 cursor-pointer min-w-[100px]"
                              >
                                <option value="Unknown">Unknown</option>
                                <option value="TDP">TDP</option>
                                <option value="YSRCP">YSRCP</option>
                                <option value="JSP">JSP</option>
                                <option value="BJP">BJP</option>
                                <option value="INC">INC</option>
                                <option value="Neutral">Neutral</option>
                                <option value="OTH">OTH</option>
                              </select>
                            ) : (
                              <span className="text-slate-300 italic text-[11px]">Not voted yet</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button
                              onClick={() => setEditingVoter(v)}
                              className="px-2.5 py-1 text-[11px] font-black text-yellow-700 bg-yellow-50 hover:bg-yellow-100 border border-yellow-100 rounded transition-all cursor-pointer"
                            >
                              Update
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* --------------------------------------------------------
            TAB 4: FAKE VOTES AUDITING
           -------------------------------------------------------- */}
        {activeTab === 'fake-votes' && (() => {
          const fakeVotersList = voters.filter(v => v.voterStatus === 'Fake' || v.voterStatus === 'Doubtful');
          return (
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-6" id="fake-doubtful-view">
              
              <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900">Fake & Doubtful Voter Purification</h3>
                  <p className="text-xs text-slate-400 font-medium font-semibold">Flagged entries undergoing database audit inside assigned booth</p>
                </div>
                <span className="text-xs bg-red-50 text-red-700 font-extrabold px-2.5 py-1 rounded border border-red-100">
                  Total Flagged: {fakeVotersList.length}
                </span>
              </div>

              {/* Status counts box */}
              <div className="grid grid-cols-2 gap-4 max-w-md">
                <div className="p-4 bg-red-50/50 border border-red-100 rounded-xl space-y-1">
                  <p className="text-[10px] font-black text-red-600 uppercase tracking-wider">Fake Voter Entries</p>
                  <h3 className="text-2xl font-black text-slate-900">{fakeCount}</h3>
                  <p className="text-[9px] text-slate-500 font-medium">To submit objection form (Form-7)</p>
                </div>
                <div className="p-4 bg-yellow-50/50 border border-yellow-100 rounded-xl space-y-1">
                  <p className="text-[10px] font-black text-yellow-600 uppercase tracking-wider">Doubtful Entries</p>
                  <h3 className="text-2xl font-black text-slate-900">{doubtfulCount}</h3>
                  <p className="text-[9px] text-slate-500 font-medium">Requires home visits verification</p>
                </div>
              </div>

              {/* Flagged Table */}
              <div className="overflow-x-auto border border-gray-100 rounded-xl shadow-inner">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                      <th className="px-4 py-3 text-center w-12">S.No</th>
                      <th className="px-4 py-3">Voter Name</th>
                      <th className="px-4 py-3">EPIC No</th>
                      <th className="px-4 py-3">Team Group</th>
                      <th className="px-4 py-3">Audit Reason / Remarks</th>
                      <th className="px-4 py-3">Preferences</th>
                      <th className="px-4 py-3">Audit Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs font-semibold">
                    {fakeVotersList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-slate-400 font-bold">
                          Wonderful! No Fake or Doubtful voter entries are currently flagged in this booth.
                        </td>
                      </tr>
                    ) : (
                      fakeVotersList.map((v) => {
                        return (
                          <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-4 text-center font-mono text-slate-400 font-bold">
                              {v.serialNumber}
                            </td>
                            <td className="px-4 py-4 font-bold text-slate-950">
                              {v.name}
                              <div className="text-[10px] text-slate-400 font-medium">Age: {v.age} | {v.gender}</div>
                            </td>
                            <td className="px-4 py-4 font-mono font-bold text-slate-700 tracking-wider">
                              {v.epicNumber}
                            </td>
                            <td className="px-4 py-4 text-slate-500 font-bold text-[11px]">
                              {v.assignedVoterGroup}
                            </td>
                            <td className="px-4 py-4 text-slate-600 font-medium max-w-[200px] truncate" title={v.notes}>
                              {v.notes || 'Awaiting physical verification on ground.'}
                            </td>
                            <td className="px-4 py-4 uppercase font-black text-slate-600">
                              {v.politicalPreference}
                            </td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${v.voterStatus === 'Fake' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                {v.voterStatus}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <button
                                onClick={() => setEditingVoter(v)}
                                className="px-2.5 py-1 text-[11px] font-black text-yellow-700 hover:text-yellow-800 bg-yellow-50 border border-yellow-200 rounded transition-all cursor-pointer"
                              >
                                Edit / Resolve
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          );
        })()}

        {/* --------------------------------------------------------
            TAB 5: OPERATIONAL TASKS
           -------------------------------------------------------- */}
        {activeTab === 'tasks' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="tasks-tab-view">
            
            {/* Left 2 Columns: Tasks List */}
            <div className="lg:col-span-2 bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-6">
              <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900">Assigned Operational Tasks</h3>
                  <p className="text-xs text-slate-400 font-medium">Keep track of door-to-door campaigning instructions assigned to teams</p>
                </div>
                <span className="text-xs bg-yellow-50 text-yellow-800 font-extrabold px-2.5 py-1 rounded border border-yellow-200">
                  Pending: {tasks.filter(t => t.status !== 'Completed').length}
                </span>
              </div>

              {/* Tasks List rendering */}
              <div className="space-y-4">
                {tasks.length === 0 ? (
                  <p className="text-center py-12 text-slate-400 font-bold">No campaigning tasks created yet.</p>
                ) : (
                  tasks.map((t) => {
                    const assignedTeam = INCHARGES.find(inc => inc.id === t.assignedTo);
                    const isCompleted = t.status === 'Completed';

                    return (
                      <div 
                        key={t.id} 
                        className={`p-4 border rounded-xl transition-all space-y-3 shadow-sm ${
                          isCompleted ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200 hover:border-yellow-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                t.priority === 'Urgent' ? 'bg-red-100 text-red-800' : t.priority === 'High' ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-800'
                              }`}>
                                {t.priority}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono font-bold">Due: {t.dueDate}</span>
                            </div>
                            <h4 className={`text-sm font-bold text-slate-900 ${isCompleted ? 'line-through text-slate-400' : ''}`}>
                              {t.title}
                            </h4>
                          </div>

                          <button 
                            onClick={() => handleToggleTaskStatus(t.id)}
                            className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg border transition-all cursor-pointer ${
                              isCompleted 
                                ? 'bg-green-100 text-green-800 border-green-200 font-black' 
                                : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 font-bold'
                            }`}
                          >
                            {isCompleted ? '✓ Completed' : 'Mark Done'}
                          </button>
                        </div>

                        <p className={`text-xs font-semibold ${isCompleted ? 'text-slate-400' : 'text-slate-600'}`}>
                          {t.instructions}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2.5 border-t border-slate-100/50">
                          <span className="font-semibold text-slate-400">Assigned To: <strong className="font-bold text-slate-700">{assignedTeam ? assignedTeam.name : 'Unknown Incharge'} ({assignedTeam?.group || ''})</strong></span>
                          <span>Created: {t.assignedDate}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right 1 Column: Assign New Task */}
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-4 h-fit">
              <div className="border-b border-gray-100 pb-2">
                <h3 className="font-bold text-base text-slate-900">Delegate Campaign Task</h3>
                <p className="text-xs text-slate-400 font-medium">Create and push tasks to specific 100 Voter Incharges</p>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-3" id="create-task-form">
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Task Title</label>
                  <input
                    type="text"
                    required
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="e.g. Purify ward-3 doubtful entries"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:outline-none focus:border-yellow-400"
                  />
                </div>

                {/* Target Team */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Assign To Team Incharge</label>
                  <select
                    value={newTaskAssignedTo}
                    onChange={(e) => setNewTaskAssignedTo(e.target.value)}
                    className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-yellow-400"
                  >
                    {INCHARGES.map(inc => (
                      <option key={inc.id} value={inc.id}>{inc.name} ({inc.group})</option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Task Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-yellow-400"
                  >
                    <option value="Low">Low Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="High">High Priority</option>
                    <option value="Urgent">Urgent Priority</option>
                  </select>
                </div>

                {/* Instructions */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Instructions</label>
                  <textarea
                    rows={4}
                    value={newTaskInstructions}
                    onChange={(e) => setNewTaskInstructions(e.target.value)}
                    placeholder="Provide detailed campaign instructions for the team to execute..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:outline-none focus:border-yellow-400"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-yellow-400 hover:bg-yellow-500 text-slate-950 text-xs font-black rounded-lg shadow-sm hover:shadow active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Delegate Campaign Task
                </button>
              </form>
            </div>

          </div>
        )}

        {/* --------------------------------------------------------
            TAB 6: CASTE & SUB-CASTE ANALYTICS
           -------------------------------------------------------- */}
        {activeTab === 'caste' && (
          <div className="space-y-6" id="caste-analytics-view">
            
            {/* Header section with theme standard style */}
            <div className="bg-white border border-slate-200/60 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
              <div>
                <h3 className="font-black text-lg text-slate-900">Demographic & Caste Analytics</h3>
                <p className="text-xs text-slate-400 font-semibold mt-1">Unified dynamic analysis of Sub-Caste, Profession, Age and Gender from the 1,247 Booth voter database.</p>
              </div>
              <span className="text-xs bg-slate-50 text-slate-700 font-black px-3 py-1.5 rounded-lg border border-slate-100 self-start sm:self-center">
                Electoral Purified Data
              </span>
            </div>

            {/* 4-CARD ANALYTICS LAYOUT GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
              {/* CARD 1: Sub-Caste Analysis */}
              <StackedBarChartCard
                title="Sub-Caste Analysis"
                icon={<Users className="w-4 h-4 text-slate-400" />}
                totalVoters={totalVoters}
                data={subCasteChartData}
              />

              {/* CARD 2: Profession Analysis */}
              <StackedBarChartCard
                title="Profession Analysis"
                icon={<BookOpen className="w-4 h-4 text-slate-400" />}
                totalVoters={totalVoters}
                data={professionChartData}
              />

              {/* CARD 3: Age Group Analysis */}
              <StackedBarChartCard
                title="Age Group Analysis"
                icon={<Calendar className="w-4 h-4 text-slate-400" />}
                totalVoters={totalVoters}
                data={ageGroupChartData}
              />

              {/* CARD 4: Gender Analysis */}
              <StackedBarChartCard
                title="Gender Analysis"
                icon={<User className="w-4 h-4 text-slate-400" />}
                totalVoters={totalVoters}
                data={genderChartData}
              />
            </div>

          </div>
        )}

        {/* --------------------------------------------------------
            TAB 7: CADRE NETWORK
           -------------------------------------------------------- */}
        {activeTab === 'teams' && (
          <div className="space-y-6" id="cadre-network-view">
            
            {/* Header section with theme standard style */}
            <div className="bg-white border border-slate-200/60 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
              <div>
                <h3 className="font-black text-lg text-slate-900">Cadre Network</h3>
                <p className="text-xs text-slate-400 font-semibold mt-1">
                  Performance tracking and political preference audit of the 13 Cadre Incharges working under Booth 145.
                </p>
              </div>
              <span className="text-xs bg-slate-50 text-slate-700 font-black px-3 py-1.5 rounded-lg border border-slate-100 self-start sm:self-center">
                Total Cadre: 13 Incharges
              </span>
            </div>

            {/* Cadre Cards 3-Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
              {teamSummaries.map((team, idx) => {
                // Calculate leading party, majority, etc.
                const parties: VoterPreference[] = ['TDP', 'YSRCP', 'JSP', 'BJP', 'INC', 'Neutral', 'OTH'];
                const sortedParties = parties
                  .map(party => ({ party, count: team.pStats[party] || 0 }))
                  .sort((a, b) => b.count - a.count);

                const leader = sortedParties[0];
                const runnerUp = sortedParties[1];
                const diff = leader.count - runnerUp.count;
                const leadingParty = leader.party;
                const leadVotes = diff;

                const colorInfo = PARTY_COLORS[leadingParty];
                const majorityLabel = diff === 0 ? "TIE (NO MAJORITY)" : `${leadingParty} MAJORITY`;
                const majorityValue = diff === 0 ? "0 Votes" : `+${leadVotes} Votes`;

                return (
                  <div 
                    key={team.id}
                    onClick={() => {
                      // Clicking a card filters the voter list for this team and redirects
                      setVoterGroupFilter(team.group);
                      setVoterSearch('');
                      setVoterPrefFilter('ALL');
                      setVoterStatusFilter('ALL');
                      setVoterGenderFilter('ALL');
                      setActiveTab('voters');
                    }}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 hover:border-yellow-400/80 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div className="space-y-4">
                      {/* Card Header: #Index and Sector Badge */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-400 font-mono uppercase">
                          #{String(idx + 1).padStart(3, '0')}
                        </span>
                        <span className="text-[10px] bg-blue-50 border border-blue-200 text-blue-600 font-extrabold px-2.5 py-0.5 rounded">
                          Sector {idx + 1}
                        </span>
                      </div>

                      {/* Incharge Details (Shield & Name/Phone) */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center shrink-0 shadow-sm group-hover:bg-yellow-50 group-hover:border-yellow-100 transition-colors">
                          <ShieldCheck className="w-5 h-5 text-slate-400 group-hover:text-yellow-600 transition-colors" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-slate-800 group-hover:text-yellow-600 transition-all truncate leading-snug">
                            {team.name}
                          </h4>
                          <p className="text-[10px] text-slate-500 font-bold flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            +91 {team.mobile}
                          </p>
                        </div>
                      </div>

                      {/* Assigned Voters pill */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-slate-950 text-white font-black px-2 py-0.5 rounded shrink-0">
                          {team.assignedCount} Voters
                        </span>
                        <span className="text-[11px] text-slate-400 font-semibold truncate">
                          assigned to this Sector Incharge
                        </span>
                      </div>

                      {/* Party summary boxes */}
                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 pt-1">
                        {parties.map(party => {
                          const count = team.pStats[party] || 0;
                          const info = PARTY_COLORS[party];
                          return (
                            <div 
                              key={party} 
                              className={`${info.lightBg} border ${info.border} rounded-lg py-1.5 px-1 flex flex-col items-center justify-between`}
                              title={`${party}: ${count} Voters`}
                            >
                              <span className={`text-[9px] font-black tracking-wide ${info.darkText}`}>{party}</span>
                              <span className={`text-xs font-black mt-1 ${info.darkText}`}>{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Dynamic Majority Strip */}
                    <div 
                      className={`px-5 py-2.5 ${colorInfo.lightBg} border-t ${colorInfo.border} flex items-center justify-between rounded-b-2xl text-[11px] font-black mt-2 mx-[-20px] mb-[-20px]`}
                    >
                      <span className={`uppercase tracking-wider ${colorInfo.darkText}`}>{majorityLabel}</span>
                      <span className={`font-black ${colorInfo.darkText}`}>{majorityValue}</span>
                    </div>

                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* --------------------------------------------------------
            TAB 8: VIDEOS
           -------------------------------------------------------- */}
        {activeTab === 'videos' && (
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-6" id="training-videos-view">
            
            <div className="border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">Training & Operation Videos</h3>
              <p className="text-xs text-slate-400 font-medium font-semibold">Official training briefings for managing polling day operations and voter rosters</p>
            </div>

            {watchingVideo ? (
              <div className="space-y-4" id="video-player-container">
                <button
                  onClick={() => setWatchingVideo(null)}
                  className="flex items-center gap-1.5 text-xs font-black text-yellow-700 hover:text-yellow-800 uppercase tracking-wider bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Videos List
                </button>
                
                {/* Simulated High-Fidelity Video Player */}
                <div className="relative aspect-video w-full max-w-3xl mx-auto rounded-xl overflow-hidden border border-slate-200 bg-slate-950 shadow-md flex flex-col justify-between group">
                  {/* Mock Thumbnail Image Poster */}
                  <img 
                    src={watchingVideo.thumbnailUrl} 
                    alt={watchingVideo.title} 
                    className="absolute inset-0 w-full h-full object-cover opacity-25"
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Top Bar Overlay */}
                  <div className="relative z-10 p-4 bg-gradient-to-b from-black/90 to-transparent flex items-center justify-between text-white">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[9px] bg-yellow-400 text-slate-950 font-black uppercase px-2 py-0.5 rounded shrink-0">
                        {watchingVideo.category}
                      </span>
                      <h4 className="text-xs font-bold truncate max-w-xs sm:max-w-md">{watchingVideo.title}</h4>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-slate-900/85 text-yellow-400 border border-yellow-400/20 px-2 py-0.5 rounded shrink-0">
                      TRAINING PREVIEW
                    </span>
                  </div>

                  {/* Play Center Overlay */}
                  <div className="relative z-10 flex flex-col items-center justify-center text-white gap-2 py-6">
                    <div className="p-4 bg-yellow-400 text-slate-950 rounded-full shadow-lg ring-4 ring-yellow-400/30 cursor-pointer hover:scale-105 transition-transform">
                      <Play className="w-6 h-6 fill-slate-950 text-slate-950" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-wider text-yellow-400 mt-2">
                      Playing Training Simulation...
                    </p>
                    <p className="text-[10px] text-slate-300 max-w-sm text-center px-4">
                      This official video playback is running in full-fidelity simulation mode. All guidelines are verified.
                    </p>
                  </div>

                  {/* Player Controls Overlay */}
                  <div className="relative z-10 p-4 bg-gradient-to-t from-black/95 to-transparent space-y-2.5">
                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div className="w-2/5 h-full bg-yellow-400 rounded-full" />
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-400 font-mono font-bold">
                        <span>04:42</span>
                        <span>{watchingVideo.duration}</span>
                      </div>
                    </div>

                    {/* Bottom buttons */}
                    <div className="flex items-center justify-between text-white text-[10px] font-bold">
                      <div className="flex items-center gap-3">
                        <span className="text-yellow-400 cursor-pointer hover:underline">PAUSE</span>
                        <span className="text-slate-400">|</span>
                        <span className="text-slate-300 cursor-pointer hover:underline">RESTART</span>
                        <span className="text-slate-400">|</span>
                        <span className="text-slate-300 cursor-pointer hover:underline">MUTE</span>
                      </div>
                      <span className="text-slate-400 font-mono font-medium">
                        Booth 145 Operation Portal
                      </span>
                    </div>
                  </div>
                </div>

                <div className="max-w-3xl mx-auto space-y-2">
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[9px] font-black uppercase rounded tracking-wide">
                    {watchingVideo.category}
                  </span>
                  <h3 className="text-lg font-bold text-slate-950">{watchingVideo.title}</h3>
                  <p className="text-xs font-semibold text-slate-600 leading-relaxed">{watchingVideo.description}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trainingVideos.map((vid) => {
                  const progress = trainingProgress[vid.id];
                  const progressLabel = progress?.status === 'COMPLETED'
                    ? 'Completed'
                    : progress?.status === 'WATCHED'
                      ? 'Watched'
                      : progress?.status === 'ASSIGNED'
                        ? 'Assigned'
                        : 'Not Started';

                  return (
                  <div key={vid.id} className="bg-white border border-slate-200/70 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between hover:border-yellow-300">
                    {/* Thumbnail click play */}
                    <div className="relative group cursor-pointer aspect-video bg-slate-950 overflow-hidden" onClick={() => handleWatchTraining(vid)}>
                      <img 
                        src={vid.thumbnailUrl} 
                        alt={vid.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/45 flex items-center justify-center transition-all">
                        <div className="p-3 bg-yellow-400 text-slate-950 rounded-full shadow-md hover:scale-110 transition-all">
                          <Play className="w-4 h-4 fill-slate-950 text-slate-950" />
                        </div>
                      </div>
                      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-slate-950/80 text-white text-[9px] font-bold rounded">
                        {vid.duration}
                      </span>
                    </div>

                    <div className="p-4 space-y-3 flex-1 flex flex-col justify-between bg-slate-50/30">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] uppercase font-black text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded">
                            {vid.category}
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
                        <h4 className="font-bold text-xs text-slate-900 leading-snug line-clamp-2">
                          {vid.title}
                        </h4>
                        <p className="text-[11px] font-semibold text-slate-400 line-clamp-3 leading-relaxed">
                          {vid.description}
                        </p>
                      </div>

                      <button
                        onClick={() => handleWatchTraining(vid)}
                        className="w-full mt-2 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-slate-950 text-xs font-black uppercase rounded-lg border border-yellow-400 tracking-wide transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Play className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                        Play Video
                      </button>
                    </div>
                  </div>
                )})}
              </div>
            )}

          </div>
        )}
        </div>
      </main>

      {/* --------------------------------------------------------
          VOTER EDIT/RESOLVE DIALOG POPUP MODAL
         -------------------------------------------------------- */}
      {editingVoter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 overflow-y-auto animate-fade-in" id="booth-edit-modal">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 my-8">
            {/* Modal Header */}
            <div className="bg-slate-950 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
              <div>
                <span className="text-[10px] bg-yellow-400 text-slate-950 font-black uppercase px-2 py-0.5 rounded">
                  Edit Voter Profile
                </span>
                <h3 className="text-base font-bold text-slate-100 mt-1">
                  S.No {editingVoter.serialNumber} &mdash; {editingVoter.name}
                </h3>
              </div>
              <button 
                onClick={() => setEditingVoter(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Scrollable Form */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateVoter(editingVoter);
              }}
              className="p-6 space-y-4 max-h-[75vh] overflow-y-auto font-semibold"
            >
              
              {/* 1. POLITICAL PREFERENCE CHOICE */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">1. Voter Political Choice</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['TDP', 'YSRCP', 'JSP', 'BJP'] as VoterPreference[]).map((pref) => {
                    const isSel = editingVoter.politicalPreference === pref;
                    return (
                      <button
                        key={pref}
                        type="button"
                        onClick={() => setEditingVoter({ ...editingVoter, politicalPreference: pref })}
                        className={`py-2 text-xs rounded-lg border text-center transition-all cursor-pointer ${
                          isSel ? 'bg-yellow-400 text-slate-950 border-yellow-400 font-black shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 font-bold'
                        }`}
                      >
                        {pref}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['INC', 'Neutral', 'OTH'] as VoterPreference[]).map((pref) => {
                    const isSel = editingVoter.politicalPreference === pref;
                    return (
                      <button
                        key={pref}
                        type="button"
                        onClick={() => setEditingVoter({ ...editingVoter, politicalPreference: pref })}
                        className={`py-2 text-xs rounded-lg border text-center transition-all cursor-pointer ${
                          isSel ? 'bg-yellow-400 text-slate-950 border-yellow-400 font-black shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 font-bold'
                        }`}
                      >
                        {pref}
                      </button>
                    );
                  })}
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

              {/* 3. CASTE AND CATEGORY */}
              <div className="space-y-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Caste</label>
                    <input
                      type="text"
                      value={editingVoter.caste || ''}
                      onChange={(e) => setEditingVoter({ ...editingVoter, caste: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:border-yellow-400 focus:outline-none placeholder:text-gray-400"
                      placeholder="Enter Caste"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Category</label>
                    <select
                      value={editingVoter.subCaste || ''}
                      onChange={(e) => setEditingVoter({ ...editingVoter, subCaste: e.target.value })}
                      className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-yellow-400 cursor-pointer"
                    >
                      <option value="">Select Category ▼</option>
                      <option value="SC">SC</option>
                      <option value="ST">ST</option>
                      <option value="BC">BC</option>
                      <option value="OC">OC</option>
                      <option value="OBC">OBC</option>
                      <option value="Unknown">Unknown</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 4. AUDIT AUDIT STATUS */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">4. Database Audit Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Active', 'Fake', 'Doubtful'] as VoterStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setEditingVoter({ ...editingVoter, voterStatus: st })}
                      className={`py-2 text-[11px] rounded-lg border text-center transition-all cursor-pointer ${
                        editingVoter.voterStatus === st 
                          ? 'bg-yellow-400 text-slate-950 border-yellow-400 font-black shadow-sm' 
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 font-bold'
                      }`}
                    >
                      {st.toUpperCase()}
                    </button>
                  ))}
                </div>
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

              {/* 6. CURRENT LOCATION */}
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

              {/* Remarks notes */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Audit Remarks & Notes</label>
                <textarea
                  rows={2}
                  value={editingVoter.notes || ''}
                  onChange={(e) => setEditingVoter({ ...editingVoter, notes: e.target.value })}
                  placeholder="Enter audit flags, verification remarks, physical check results..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:outline-none focus:border-yellow-400"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingVoter(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-slate-950 text-xs font-black rounded-xl shadow-sm hover:shadow transition-all cursor-pointer text-center"
                >
                  Save Profile
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
