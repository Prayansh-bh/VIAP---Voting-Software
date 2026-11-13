import React, { useEffect, useMemo, useState } from 'react';
import { UserSession, Voter, VoterPreference, VoterStatus } from '../types';
import {
  createPollingReport,
  fetchCadreNetwork,
  fetchChildrenAnalytics,
  fetchConstituencyAnalytics,
  fetchHierarchySummaryByUser,
  fetchLiveTurnoutSummaryByUser,
  fetchLiveVoteEvents,
  fetchPollingReports,
  fetchTasksForUnit,
  fetchTrainingProgressForUnit,
  fetchVoters,
  fetchVotersForUnit,
  type CadreNetworkItem,
  type ChildAnalyticsItem,
  type HierarchySummaryPayload,
  type LiveTurnoutSummaryPayload,
  type TrainingProgressItem,
  updateTaskStatus,
  createVoter,
  updateVoter,
  updateVoterMigration,
  updateVoterStatusApi,
} from '../lib/api';
import { createRealtimeSocket, RealtimeSummaryInvalidate, RealtimeVoteEvent } from '../lib/realtime';
import { 
  Home, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  Terminal, 
  Calendar, 
  BarChart3, 
  Users, 
  LogOut, 
  Menu, 
  X, 
  ShieldCheck, 
  User, 
  Smartphone, 
  MapPin, 
  Send, 
  AlertCircle, 
  Check, 
  Filter, 
  CheckCircle, 
  TrendingUp, 
  ChevronRight, 
  FileText,
  Clock,
  Layers,
  Vote,
  Compass,
  GraduationCap,
  Sparkles,
  ArrowLeft,
  ChevronDown,
  Activity,
  Globe,
  Plus,
  Crown,
  Loader2,
  Database,
} from 'lucide-react';
import MandalInchargeDashboard from './MandalInchargeDashboard';
import AIStrategicIntelligenceCenter from './AIStrategicIntelligenceCenter';
import Pagination from './common/Pagination';
import ActiveSessionsModal from './common/ActiveSessionsModal';
import CadrePulseWidget from './common/CadrePulseWidget';

function mapMandalRollup(item: ChildAnalyticsItem) {
  const prefs = item?.snapshot?.politicalPreference ?? {};
  const voters = item?.snapshot?.summary?.totalVoters ?? 0;
  
  // Dynamically sort all party preferences descending (excluding NEUTRAL)
  const sortedParties = Object.entries(prefs)
    .filter(([p]) => p.toUpperCase() !== 'NEUTRAL')
    .map(([party, count]) => ({ party, count: Number(count) || 0 }))
    .sort((a, b) => b.count - a.count);

  const topParty = sortedParties[0] || { party: 'Neutral', count: 0 };
  const secondParty = sortedParties[1] || { party: 'Others', count: 0 };
  const lead = topParty.count - secondParty.count;
  const leading = (topParty.count > 0 ? topParty.party : 'Neutral') as VoterPreference;
  const diffPct = voters > 0 ? (lead / voters) * 100 : 0;
  const status = diffPct < 4
    ? ('CLOSE CONTEST' as const)
    : (lead > 0 ? ('WINNING' as const) : ('TRAILING' as const));

  return {
    name: item.name,
    voters,
    villages: item?.snapshot?.hierarchyCounts?.VILLAGE ?? 0,
    booths: item?.snapshot?.hierarchyCounts?.BOOTH ?? 0,
    tdp: prefs.TDP ?? 0,
    ysrcp: prefs.YSRCP ?? 0,
    neutral: prefs.NEUTRAL ?? 0,
    jsp: prefs.JSP ?? 0,
    bjp: prefs.BJP ?? 0,
    inc: prefs.INC ?? 0,
    leading,
    lead,
    status,
  };
}

interface ConstituencyInchargeDashboardProps {
  session: UserSession;
  onLogout: () => void;
}

type ConstTabType = 
  | 'dashboard'
  | 'electoral_roll'
  | 'mandal_list'
  | 'village_list'
  | 'tasks'
  | 'caste_analytics'
  | 'cadre_network'
  | 'fake_votes'
  | 'strategic_intelligence'
  | 'training_analytics'
  | 'live_voter_tracking'
  | 'migrated_voters';

import { useLocation, useNavigate } from 'react-router-dom';

const CONST_TAB_TO_PATH: Record<ConstTabType, string> = {
  dashboard: '/constituency',
  electoral_roll: '/constituency/electoral_roll',
  mandal_list: '/constituency/mandal_list',
  village_list: '/constituency/village_list',
  tasks: '/constituency/tasks',
  caste_analytics: '/constituency/caste_analytics',
  cadre_network: '/constituency/cadre_network',
  fake_votes: '/constituency/fake_votes',
  strategic_intelligence: '/constituency/strategic_intelligence',
  training_analytics: '/constituency/training_analytics',
  live_voter_tracking: '/constituency/live_voter_tracking',
  migrated_voters: '/constituency/migrated_voters',
};

const CONST_PATH_TO_TAB: Record<string, ConstTabType> = {
  '': 'dashboard',
  dashboard: 'dashboard',
  electoral_roll: 'electoral_roll',
  'electoral-roll': 'electoral_roll',
  voters: 'electoral_roll',
  mandal_list: 'mandal_list',
  mandals: 'mandal_list',
  village_list: 'village_list',
  villages: 'village_list',
  tasks: 'tasks',
  caste_analytics: 'caste_analytics',
  caste: 'caste_analytics',
  cadre_network: 'cadre_network',
  cadre: 'cadre_network',
  fake_votes: 'fake_votes',
  'fake-votes': 'fake_votes',
  strategic_intelligence: 'strategic_intelligence',
  'ai-intel': 'strategic_intelligence',
  training_analytics: 'training_analytics',
  live_voter_tracking: 'live_voter_tracking',
  'live-track': 'live_voter_tracking',
  migrated_voters: 'migrated_voters',
  migrated: 'migrated_voters',
};

interface FlaggedVoter {
  sNo: number;
  name: string;
  epic: string;
  age: number;
  gender: string;
  village: string;
  mandal: string;
  booth: string;
  reason: string;
  status: 'FLAGGED' | 'UNDER VERIFICATION' | 'VERIFIED ISSUE' | 'RESOLVED';
}

const CONST_PARTY_COLORS: Record<VoterPreference, string> = {
  TDP: '#eab308',     // Yellow-500
  YSRCP: '#2563eb',   // Blue-600
  JSP: '#dc2626',     // Red-600
  BJP: '#f97316',     // Orange-500
  INC: '#38bdf8',     // Sky-400
  Neutral: '#64748b', // Slate-500
  OTH: '#a855f7'      // Purple-500
};

export default function ConstituencyInchargeDashboard({ session, onLogout }: ConstituencyInchargeDashboardProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const subPath = location.pathname.replace(/^\/constituency\/?/, '').split('/')[0] || '';
  const isKnownSubPath = subPath === '' || subPath in CONST_PATH_TO_TAB;
  const activeTab: ConstTabType = isKnownSubPath ? (CONST_PATH_TO_TAB[subPath] || 'dashboard') : 'dashboard';

  // Unknown sub-routes safely return to base route
  useEffect(() => {
    if (!isKnownSubPath) {
      navigate('/constituency', { replace: true });
    }
  }, [isKnownSubPath, navigate]);

  const setActiveTab = (tab: ConstTabType) => {
    navigate(CONST_TAB_TO_PATH[tab]);
    setIsSidebarOpen(false);
  };
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSessionsOpen, setIsSessionsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [drilledMandal, setDrilledMandal] = useState<string | null>(null);
  const [selectedMandalInVillageList, setSelectedMandalInVillageList] = useState<string | null>(null);
  const [backendSummary, setBackendSummary] = useState<HierarchySummaryPayload | null>(null);
  const [cadreItems, setCadreItems] = useState<CadreNetworkItem[]>([]);
  const [trainingProgressItems, setTrainingProgressItems] = useState<TrainingProgressItem[]>([]);
  const [liveTurnoutSummary, setLiveTurnoutSummary] = useState<LiveTurnoutSummaryPayload | null>(null);
  const [scopedVoters, setScopedVoters] = useState<Voter[]>([]);
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  const [isRefreshingLiveTurnout, setIsRefreshingLiveTurnout] = useState(false);
  const [mandalRollups, setMandalRollups] = useState<ReturnType<typeof mapMandalRollup>[]>([]);
  const [villageRollups, setVillageRollups] = useState<Array<{
    sNo: number;
    name: string;
    mandal: string;
    voters: number;
    tdp: number;
    ysrcp: number;
    neutral: number;
    status: string;
    lead: number;
    leading: string;
  }>>([]);

  const refreshLiveTurnoutSummary = async () => {
    setIsRefreshingLiveTurnout(true);
    try {
      const [payload, standaloneReports] = await Promise.all([
        fetchLiveTurnoutSummaryByUser(session.userId),
        fetchPollingReports(session.unitId).catch(() => []),
      ]);
      if (payload && Array.isArray(standaloneReports) && standaloneReports.length > 0) {
        const existingIds = new Set((payload.pollingReports || []).map((r: any) => r.id));
        const formatted = standaloneReports
          .filter((sr: any) => !existingIds.has(sr.id))
          .map((sr: any) => ({
            id: sr.id,
            mandal: sr.mandalName || 'Mandal',
            booth: sr.boothLabel || 'Booth',
            submittedBy: sr.reporterName || sr.createdBy?.name || 'Agent',
            time: sr.createdAt ? new Date(sr.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live',
            totalVotes: sr.totalVotes || 0,
            breakdown: {
              TDP: sr.tdpVotes || 0,
              YSRCP: sr.ysrcpVotes || 0,
              JSP: sr.jspVotes || 0,
              BJP: sr.bjpVotes || 0,
              INC: sr.incVotes || 0,
              Others: sr.othersVotes || 0,
            },
          }));
        payload.pollingReports = [...(payload.pollingReports || []), ...formatted];
      }
      setLiveTurnoutSummary(payload);
    } finally {
      setIsRefreshingLiveTurnout(false);
    }
  };

  useEffect(() => {
    let active = true;

    Promise.all([
      fetchHierarchySummaryByUser(session.userId),
      fetchTasksForUnit(session.unitId).catch(() => null),
      fetchCadreNetwork(session.unitId).catch(() => null),
      fetchTrainingProgressForUnit(session.unitId).catch(() => null),
      fetchVotersForUnit(session.unitId).catch(() => null),
      fetchLiveVoteEvents(session.unitId).catch(() => []),
      fetchConstituencyAnalytics(session.unitId).catch(() => null),
    ])
      .then(([payload, tasks, cadre, training, voters, events]) => {
        if (!active) {
          return;
        }

        setBackendSummary(payload);
        if (Array.isArray(events)) {
          setLiveEvents(events);
        }

        if (tasks) {
          setTasksList(tasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.instructions,
            priority: `${task.priority.toUpperCase()} PRIORITY`,
            dueDate: task.dueDate,
            status: task.status === 'Completed' ? 'COMPLETED' : task.status === 'In Progress' ? 'IN PROGRESS' : 'PENDING',
          })));
        }

        if (cadre) {
          setCadreItems(cadre.items);
        }

        if (training) {
          setTrainingProgressItems(training);
        }

        if (voters) {
          setScopedVoters(voters);
        }

        void refreshLiveTurnoutSummary();

        void fetchChildrenAnalytics(session.unitId)
          .then(async (payload) => {
            if (!active) {
              return;
            }

            const rawItems = Array.isArray(payload) ? payload : (payload as any)?.items || [];
            const mandalItems = rawItems.filter((item: any) => item.level === 'MANDAL');
            setMandalRollups(mandalItems.map(mapMandalRollup));

            const villages: typeof villageRollups = [];
            let currentSNo = 1;

            const villagePayloads = await Promise.all(
              mandalItems.map((mandal: any) =>
                fetchChildrenAnalytics(mandal.unitId)
                  .then((villagePayload) => ({ mandal, villagePayload }))
                  .catch(() => ({ mandal, villagePayload: [] }))
              )
            );

            if (!active) return;

            for (const { mandal, villagePayload } of villagePayloads) {
              const rawVillageItems = Array.isArray(villagePayload) ? villagePayload : (villagePayload as any)?.items || [];
              rawVillageItems
                .filter((item: any) => item.level === 'VILLAGE')
                .forEach((item: any) => {
                  const prefs = item?.snapshot?.politicalPreference ?? {};
                  const tdp = prefs.TDP ?? 0;
                  const ysrcp = prefs.YSRCP ?? 0;
                  const neutral = prefs.NEUTRAL ?? 0;
                  const votersCount = item?.snapshot?.summary?.totalVoters ?? 0;
                  const lead = Math.abs(tdp - ysrcp);
                  const leading = tdp > ysrcp ? 'TDP' : 'YSRCP';
                  const diffPct = votersCount > 0 ? (lead / votersCount) * 100 : 0;
                  const status = diffPct < 4 ? 'CLOSE CONTEST' : (tdp > ysrcp ? 'WINNING' : 'TRAILING');

                  villages.push({
                    sNo: currentSNo++,
                    name: item.name,
                    mandal: mandal.name,
                    voters: votersCount,
                    tdp,
                    ysrcp,
                    neutral,
                    status,
                    lead,
                    leading,
                  });
                });
            }

            setVillageRollups(villages);
          })
          .catch(() => {
          });
      })
      .catch(() => {
      });

    return () => {
      active = false;
    };
  }, [session.userId]);

  useEffect(() => {
    const socket = createRealtimeSocket({ userId: session.userId, unitId: session.unitId });

    socket.on('summary:invalidate', (_payload: RealtimeSummaryInvalidate) => {
      void refreshLiveTurnoutSummary();
    });

    socket.on('vote:event', (_event: RealtimeVoteEvent) => {
      void refreshLiveTurnoutSummary();
    });

    return () => {
      socket.disconnect();
    };
  }, [session.unitId, session.userId]);

  const mandalsData = useMemo(() => {
    return mandalRollups || [];
  }, [mandalRollups]);

  // Rolled Up Constituency Stats
  const constituencyStats = useMemo(() => {
    const snapshot = backendSummary?.snapshot;
    if (snapshot) {
      const prefs = (snapshot as HierarchySummaryPayload['snapshot'] & { politicalPreference?: Record<string, number> }).politicalPreference;
      return {
        voters: snapshot.summary?.totalVoters ?? 0,
        mandals: snapshot.hierarchyCounts?.MANDAL ?? mandalsData.length,
        villages: snapshot.hierarchyCounts?.VILLAGE ?? villageRollups.length,
        booths: snapshot.hierarchyCounts?.BOOTH ?? 0,
        tdp: prefs?.TDP ?? mandalsData.reduce((sum, m) => sum + (m.tdp || 0), 0),
        ysrcp: prefs?.YSRCP ?? mandalsData.reduce((sum, m) => sum + (m.ysrcp || 0), 0),
        neutral: prefs?.NEUTRAL ?? mandalsData.reduce((sum, m) => sum + (m.neutral || 0), 0),
      };
    }

    let voters = 0;
    let mandals = mandalsData.length;
    let villages = villageRollups.length;
    let booths = mandalsData.reduce((sum, m) => sum + (m.booths || 0), 0);
    let tdp = 0;
    let ysrcp = 0;
    let neutral = 0;

    mandalsData.forEach(m => {
      voters += m.voters || 0;
      tdp += m.tdp || 0;
      ysrcp += m.ysrcp || 0;
      neutral += m.neutral || 0;
    });

    return { voters, mandals, villages, booths, tdp, ysrcp, neutral };
  }, [backendSummary, mandalsData, villageRollups]);

  const liveConstituencyStats = useMemo(() => {
    const snapshot = backendSummary?.snapshot;
    return {
      totalVoters: snapshot?.summary?.totalVoters ?? constituencyStats?.voters ?? 0,
      totalMandals: snapshot?.hierarchyCounts?.MANDAL ?? constituencyStats?.mandals ?? 0,
      totalVillages: snapshot?.hierarchyCounts?.VILLAGE ?? constituencyStats?.villages ?? 0,
      totalBooths: snapshot?.hierarchyCounts?.BOOTH ?? constituencyStats?.booths ?? 0,
      voted: snapshot?.summary?.voted ?? 0,
      remaining: snapshot?.summary?.remaining ?? 0,
    };
  }, [backendSummary, constituencyStats]);

  const villagesData = useMemo(() => {
    if (villageRollups.length > 0) {
      return villageRollups;
    }

    const grouped = new Map<string, {
      mandal: string;
      village: string;
      voters: number;
      tdp: number;
      ysrcp: number;
      neutral: number;
    }>();

    scopedVoters.forEach((voter) => {
      const key = `${voter.mandal}::${voter.village}`;
      const item = grouped.get(key) ?? {
        mandal: voter.mandal,
        village: voter.village,
        voters: 0,
        tdp: 0,
        ysrcp: 0,
        neutral: 0,
      };
      item.voters += 1;
      if (voter.politicalPreference === 'TDP') item.tdp += 1;
      else if (voter.politicalPreference === 'YSRCP') item.ysrcp += 1;
      else if (voter.politicalPreference === 'Neutral') item.neutral += 1;
      grouped.set(key, item);
    });

    if (grouped.size === 0) {
      return [];
    }

    let currentSNo = 1;
    return Array.from(grouped.values()).map((entry) => {
      const lead = Math.abs(entry.tdp - entry.ysrcp);
      const leading = entry.tdp > entry.ysrcp ? 'TDP' : 'YSRCP';
      const diffPct = entry.voters > 0 ? (lead / entry.voters) * 100 : 0;
      const status = diffPct < 4 ? 'CLOSE CONTEST' : (entry.tdp > entry.ysrcp ? 'WINNING' : 'TRAILING');

      return {
        sNo: currentSNo++,
        name: entry.village,
        mandal: entry.mandal,
        voters: entry.voters,
        tdp: entry.tdp,
        ysrcp: entry.ysrcp,
        neutral: entry.neutral,
        status,
        lead,
        leading,
      };
    });
  }, [scopedVoters, villageRollups]);

  // --- High Command Tasks ---
  const [tasksList, setTasksList] = useState<Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    dueDate: string;
    status: string;
  }>>([]);

  const [selectedTask, setSelectedTask] = useState<typeof tasksList[0] | null>(null);

  const cadreStats = useMemo(() => {
    const villages = new Set(cadreItems.filter((item) => item.role === 'VILLAGE_INCHARGE').map((item) => item.unitName)).size;
    const booths = new Set(cadreItems.filter((item) => item.role === 'BOOTH_PRESIDENT').map((item) => item.unitName)).size;
    const voterIncharges = cadreItems.filter((item) => item.role === 'VOTER_100_INCHARGE').length;
    const activeMembers = cadreItems.filter((item) => item.performanceScore > 0 || item.totalAssignedVoters > 0).length;
    const inactiveMembers = Math.max(0, cadreItems.length - activeMembers);

    return {
      totalCadres: cadreItems.length,
      villages,
      booths,
      voterIncharges,
      activeMembers,
      inactiveMembers,
    };
  }, [cadreItems]);

  const trainingStats = useMemo(() => {
    const total = trainingProgressItems.length;
    const completed = trainingProgressItems.filter((item) => item.status === 'COMPLETED').length;
    const watched = trainingProgressItems.filter((item) => item.status === 'WATCHED').length;
    const assigned = trainingProgressItems.filter((item) => item.status === 'ASSIGNED').length;
    const notStarted = Math.max(0, cadreStats.totalCadres - total);

    return {
      totalCadres: cadreStats.totalCadres,
      completed,
      watched,
      assigned,
      notStarted,
    };
  }, [cadreStats.totalCadres, trainingProgressItems]);

  // --- Caste & Demographics ---
  const [demoLevel, setDemoLevel] = useState<'constituency' | 'mandal' | 'village'>('constituency');
  const [demoMandal, setDemoMandal] = useState<string>('Singarayakonda');
  const [demoVillage, setDemoVillage] = useState<string>('Singarayakonda');

  const analyticsScopeVoters = useMemo(() => {
    return scopedVoters.filter((voter) => {
      if (demoLevel === 'mandal') {
        return voter.mandal === demoMandal;
      }
      if (demoLevel === 'village') {
        return voter.mandal === demoMandal && voter.village === demoVillage;
      }
      return true;
    });
  }, [demoLevel, demoMandal, demoVillage, scopedVoters]);

  const activeVotersCount = analyticsScopeVoters.length;

  const demoCasteData = useMemo(() => {
    const grouped = new Map<string, { voters: number; tdp: number; ysrcp: number; neutral: number }>();
    analyticsScopeVoters.forEach((voter) => {
      const key = String(voter.caste || 'Unknown').trim() || 'Unknown';
      const item = grouped.get(key) ?? { voters: 0, tdp: 0, ysrcp: 0, neutral: 0 };
      item.voters += 1;
      if (voter.politicalPreference === 'TDP') item.tdp += 1;
      else if (voter.politicalPreference === 'YSRCP') item.ysrcp += 1;
      else if (voter.politicalPreference === 'Neutral') item.neutral += 1;
      grouped.set(key, item);
    });

    return Array.from(grouped.entries())
      .map(([name, value]) => ({
        name,
        subCaste: name,
        voters: value.voters,
        tdpPref: value.voters > 0 ? Math.round((value.tdp / value.voters) * 100) : 0,
        ysrcpPref: value.voters > 0 ? Math.round((value.ysrcp / value.voters) * 100) : 0,
        neutralPref: value.voters > 0 ? Math.round((value.neutral / value.voters) * 100) : 0,
      }))
      .sort((a, b) => b.voters - a.voters)
      .slice(0, 8);
  }, [analyticsScopeVoters]);

  const demoProfessionData = useMemo(() => {
    const grouped = new Map<string, { voters: number; tdp: number; ysrcp: number; neutral: number }>();
    analyticsScopeVoters.forEach((voter) => {
      const key = String(voter.profession || 'Unspecified').trim() || 'Unspecified';
      const item = grouped.get(key) ?? { voters: 0, tdp: 0, ysrcp: 0, neutral: 0 };
      item.voters += 1;
      if (voter.politicalPreference === 'TDP') item.tdp += 1;
      else if (voter.politicalPreference === 'YSRCP') item.ysrcp += 1;
      else if (voter.politicalPreference === 'Neutral') item.neutral += 1;
      grouped.set(key, item);
    });

    return Array.from(grouped.entries())
      .map(([name, value]) => ({
        name,
        voters: value.voters,
        tdpPref: value.voters > 0 ? Math.round((value.tdp / value.voters) * 100) : 0,
        ysrcpPref: value.voters > 0 ? Math.round((value.ysrcp / value.voters) * 100) : 0,
        neutralPref: value.voters > 0 ? Math.round((value.neutral / value.voters) * 100) : 0,
      }))
      .sort((a, b) => b.voters - a.voters)
      .slice(0, 8);
  }, [analyticsScopeVoters]);

  const demoAgeData = useMemo(() => {
    const buckets = [
      { group: '18-30 (Youth)', min: 18, max: 30 },
      { group: '31-45 (Middle)', min: 31, max: 45 },
      { group: '46-60 (Senior)', min: 46, max: 60 },
      { group: '60+ (Elders)', min: 61, max: 200 },
    ];

    return buckets.map((bucket) => {
      const voters = analyticsScopeVoters.filter((voter) => Number(voter.age || 0) >= bucket.min && Number(voter.age || 0) <= bucket.max);
      const tdp = voters.filter((voter) => voter.politicalPreference === 'TDP').length;
      const ysrcp = voters.filter((voter) => voter.politicalPreference === 'YSRCP').length;
      const neutral = voters.filter((voter) => voter.politicalPreference === 'Neutral').length;
      return {
        group: bucket.group,
        voters: voters.length,
        tdpPref: voters.length > 0 ? Math.round((tdp / voters.length) * 100) : 0,
        ysrcpPref: voters.length > 0 ? Math.round((ysrcp / voters.length) * 100) : 0,
        neutralPref: voters.length > 0 ? Math.round((neutral / voters.length) * 100) : 0,
      };
    });
  }, [analyticsScopeVoters]);

  const demoGenderData = useMemo(() => {
    const buckets: Array<'Male' | 'Female' | 'Other'> = ['Male', 'Female', 'Other'];
    return buckets.map((bucket) => {
      const voters = analyticsScopeVoters.filter((voter) => String(voter.gender || '').toLowerCase() === bucket.toLowerCase());
      const tdp = voters.filter((voter) => voter.politicalPreference === 'TDP').length;
      const ysrcp = voters.filter((voter) => voter.politicalPreference === 'YSRCP').length;
      const neutral = voters.filter((voter) => voter.politicalPreference === 'Neutral').length;
      return {
        name: bucket,
        voters: voters.length,
        tdpPref: voters.length > 0 ? Math.round((tdp / voters.length) * 100) : 0,
        ysrcpPref: voters.length > 0 ? Math.round((ysrcp / voters.length) * 100) : 0,
        neutralPref: voters.length > 0 ? Math.round((neutral / voters.length) * 100) : 0,
      };
    }).filter((item) => item.voters > 0);
  }, [analyticsScopeVoters]);

  // --- Cadre Network Interactivity ---
  const [cadreSelectMandal, setCadreSelectMandal] = useState<string>('Singarayakonda');
  const [cadreSelectVillage, setCadreSelectVillage] = useState<string>('Singarayakonda');
  const [cadreSelectBooth, setCadreSelectBooth] = useState<string>('Booth 224');

  const cadreBoothOptions = useMemo(() => {
    return Array.from(
      new Set(
        cadreItems
          .filter((item) => item.role === 'BOOTH_PRESIDENT' || item.role === 'VOTER_100_INCHARGE')
          .map((item) => item.unitName),
      ),
    ).sort();
  }, [cadreItems]);

  const derivedCadreDirectory = useMemo(() => {
    const mandalIncharge = cadreItems.find((item) => item.role === 'MANDAL_INCHARGE' && item.unitName === cadreSelectMandal)
      ?? cadreItems.find((item) => item.role === 'MANDAL_INCHARGE');
    const villageIncharge = cadreItems.find((item) => item.role === 'VILLAGE_INCHARGE' && item.unitName === cadreSelectVillage)
      ?? cadreItems.find((item) => item.role === 'VILLAGE_INCHARGE');
    const boothIncharge = cadreItems.find((item) => item.role === 'BOOTH_PRESIDENT' && (item.unitName || '').includes(cadreSelectBooth))
      ?? cadreItems.find((item) => item.role === 'BOOTH_PRESIDENT');
    const voter100List = cadreItems
      .filter((item) => item.role === 'VOTER_100_INCHARGE' && (item.unitName || '').includes(cadreSelectBooth))
      .map((item, index) => ({
        sNo: `#${String(index + 1).padStart(3, '0')}`,
        name: item.name,
        mobile: item.mobileNumber,
        votersCount: item.totalAssignedVoters || 100,
      }));

    return {
      mandalIncharge,
      villageIncharge,
      boothIncharge,
      voter100List,
    };
  }, [cadreItems, cadreSelectBooth, cadreSelectMandal, cadreSelectVillage]);

  // --- Fake/Flagged Voters ---
  const [fakeSearch, setFakeSearch] = useState('');
  const [fakeFilterStatus, setFakeFilterStatus] = useState<string>('ALL');
  const [flaggedVoters, setFlaggedVoters] = useState<FlaggedVoter[]>([]);
  const [flaggedTotal, setFlaggedTotal] = useState(0);
  const [isFlaggedLoading, setIsFlaggedLoading] = useState(false);

  // Pagination states
  const [villagesPage, setVillagesPage] = useState(1);
  const [villagesPageSize, setVillagesPageSize] = useState(15);
  const [flaggedPage, setFlaggedPage] = useState(1);
  const [flaggedPageSize, setFlaggedPageSize] = useState(15);
  const [migratedPage, setMigratedPage] = useState(1);
  const [migratedPageSize, setMigratedPageSize] = useState(15);
  const [electoralPage, setElectoralPage] = useState(1);
  const [electoralPageSize, setElectoralPageSize] = useState(15);
  const [voterViewMode, setVoterViewMode] = useState<'cards' | 'table'>('cards');
  const [fakeViewMode, setFakeViewMode] = useState<'cards' | 'table'>('cards');
  const [electoralVoters, setElectoralVoters] = useState<Voter[]>([]);
  const [electoralTotal, setElectoralTotal] = useState(0);
  const [isElectoralLoading, setIsElectoralLoading] = useState(false);
  const [electoralError, setElectoralError] = useState<string | null>(null);
  const [electoralSearch, setElectoralSearch] = useState('');
  const [electoralPrefFilter, setElectoralPrefFilter] = useState('ALL');
  const [electoralGenderFilter, setElectoralGenderFilter] = useState('ALL');

  useEffect(() => {
    setFlaggedPage(1);
  }, [fakeSearch, fakeFilterStatus]);

  useEffect(() => {
    if (activeTab !== 'fake_votes') return;
    let active = true;
    setIsFlaggedLoading(true);

    const voterStatus =
      fakeFilterStatus === 'FLAGGED'
        ? ('FAKE' as any)
        : fakeFilterStatus === 'UNDER VERIFICATION'
        ? ('DOUBTFUL' as any)
        : undefined;

    fetchVoters({
      unitId: session.unitId,
      page: flaggedPage,
      limit: flaggedPageSize,
      search: fakeSearch || undefined,
      voterStatus,
    })
      .then((res) => {
        if (!active) return;
        const mapped = res.items.map((v, index) => ({
          sNo: (flaggedPage - 1) * flaggedPageSize + index + 1,
          name: v.name,
          epic: v.epicNumber,
          age: v.age,
          gender: v.gender,
          village: v.village,
          mandal: v.mandal,
          booth: v.boothNumber,
          reason: v.notes || `${v.voterStatus} Record`,
          status: (v.voterStatus === 'Fake' || (v.voterStatus as string) === 'FAKE' ? 'FLAGGED' : 'UNDER VERIFICATION') as FlaggedVoter['status'],
        }));
        setFlaggedVoters(mapped);
        setFlaggedTotal(res.total);
      })
      .catch(() => {
        if (!active) return;
        setFlaggedVoters([]);
        setFlaggedTotal(0);
      })
      .finally(() => {
        if (active) setIsFlaggedLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeTab, session.unitId, flaggedPage, flaggedPageSize, fakeSearch, fakeFilterStatus]);

  const [auditingVoter, setAuditingVoter] = useState<FlaggedVoter | null>(null);

  const paginatedFlaggedVoters = flaggedVoters;

  // --- Strategic Intelligence ---
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<boolean>(false);



  // --- Search & Filters for Mandal/Village lists ---
  const [mandalSearch, setMandalSearch] = useState('');
  const [mandalFilter, setMandalFilter] = useState<'ALL' | 'TDP LEADING' | 'YSRCP LEADING' | 'CLOSE CONTEST'>('ALL');

  const [villageSearch, setVillageSearch] = useState('');
  const [villageFilter, setVillageFilter] = useState<'ALL' | 'TDP WINNING' | 'YSRCP WINNING' | 'CLOSE CONTEST'>('ALL');

  useEffect(() => {
    setVillagesPage(1);
  }, [villageSearch, villageFilter, selectedMandalInVillageList]);

  const filteredMandals = useMemo(() => {
    return mandalsData.filter(m => {
      const matchSearch = (m.name || '').toLowerCase().includes((mandalSearch || '').toLowerCase());
      if (!matchSearch) return false;

      if (mandalFilter === 'ALL') return true;
      if (mandalFilter === 'TDP LEADING') return m.leading === 'TDP' && m.status === 'WINNING';
      if (mandalFilter === 'YSRCP LEADING') return m.leading === 'YSRCP' && m.status === 'TRAILING';
      if (mandalFilter === 'CLOSE CONTEST') return m.status === 'CLOSE CONTEST';
      return true;
    });
  }, [mandalsData, mandalSearch, mandalFilter]);

  const filteredVillages = useMemo(() => {
    return villagesData.filter(v => {
      if (selectedMandalInVillageList && v.mandal !== selectedMandalInVillageList) return false;

      const matchSearch = 
        (v.name || '').toLowerCase().includes((villageSearch || '').toLowerCase()) ||
        (v.mandal || '').toLowerCase().includes((villageSearch || '').toLowerCase());
      if (!matchSearch) return false;

      if (villageFilter === 'ALL') return true;
      if (villageFilter === 'TDP WINNING') return v.leading === 'TDP' && v.status === 'WINNING';
      if (villageFilter === 'YSRCP WINNING') return v.leading === 'YSRCP' && v.status === 'TRAILING';
      if (villageFilter === 'CLOSE CONTEST') return v.status === 'CLOSE CONTEST';
      return true;
    });
  }, [villagesData, selectedMandalInVillageList, villageSearch, villageFilter]);

  const paginatedVillages = useMemo(() => {
    const start = (villagesPage - 1) * villagesPageSize;
    return filteredVillages.slice(start, start + villagesPageSize);
  }, [filteredVillages, villagesPage, villagesPageSize]);

  // --- Live Voter Tracking (Aggregate Only, No Individual Preferences Stored) ---
  const [liveSearchQuery, setLiveSearchQuery] = useState('');
  
  const [newManualReport, setNewManualReport] = useState({
    mandal: 'Singarayakonda',
    booth: 'Booth 224',
    TDP: 0,
    YSRCP: 0,
    JSP: 0,
    BJP: 0,
    INC: 0,
    Others: 0,
    submittedBy: ''
  });

  const handleRegisterManualReport = (e: React.FormEvent) => {
    e.preventDefault();
    const tdp = Number(newManualReport.TDP) || 0;
    const ysrcp = Number(newManualReport.YSRCP) || 0;
    const jsp = Number(newManualReport.JSP) || 0;
    const bjp = Number(newManualReport.BJP) || 0;
    const inc = Number(newManualReport.INC) || 0;
    const others = Number(newManualReport.Others) || 0;
    const totalNewVotes = tdp + ysrcp + jsp + bjp + inc + others;

    if (totalNewVotes <= 0) return;

    void createPollingReport({
      unitId: session.unitId,
      createdById: session.userId,
      mandalName: newManualReport.mandal,
      boothLabel: newManualReport.booth || 'General Update',
      reporterName: newManualReport.submittedBy || session.userName || 'Authorized User',
      tdpVotes: tdp,
      ysrcpVotes: ysrcp,
      jspVotes: jsp,
      bjpVotes: bjp,
      incVotes: inc,
      othersVotes: others,
    }).then(() => {
      void refreshLiveTurnoutSummary();
    }).catch(() => {
    });

    setNewManualReport({
      mandal: newManualReport.mandal,
      booth: 'Booth 224',
      TDP: 0,
      YSRCP: 0,
      JSP: 0,
      BJP: 0,
      INC: 0,
      Others: 0,
      submittedBy: ''
    });
  };

  // --- Migrated Voters Tracking ---
  interface MigratedVoter {
    id: string;
    name: string;
    epic: string;
    mandal: string;
    village: string;
    booth: string;
    currentLocation: string;
    contactNumber: string;
    travelStatus: 'CONFIRMED' | 'UNREACHABLE' | 'PENDING_CONFIRMATION' | 'TRAVEL_BOOKED' | 'SELF_ARRANGEMENT';
    assistanceRequired: 'NONE' | 'TRANSPORT' | 'POSTAL_BALLOT' | 'ACCOMMODATION';
    assignedVolunteer: string;
    notes: string;
  }

  const [migratedVotersList, setMigratedVotersList] = useState<MigratedVoter[]>([]);

  const [migratedSearch, setMigratedSearch] = useState('');
  const [migratedMandalFilter, setMigratedMandalFilter] = useState('ALL');
  const [migratedStatusFilter, setMigratedStatusFilter] = useState('ALL');

  useEffect(() => {
    setMigratedPage(1);
  }, [migratedSearch, migratedMandalFilter, migratedStatusFilter]);
  const [editingMigratedVoter, setEditingMigratedVoter] = useState<MigratedVoter | null>(null);
  const [newMigratedVoter, setNewMigratedVoter] = useState({
    name: '', epic: '', mandal: 'Singarayakonda', village: 'Kalikivaya', booth: 'Booth 224',
    currentLocation: '', contactNumber: '', travelStatus: 'PENDING_CONFIRMATION' as const,
    assistanceRequired: 'NONE' as const, assignedVolunteer: '', notes: ''
  });

  const [migratedTotal, setMigratedTotal] = useState(0);
  const [isMigratedLoading, setIsMigratedLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== 'migrated_voters') return;
    let active = true;
    setIsMigratedLoading(true);

    fetchVoters({
      unitId: session.unitId,
      page: migratedPage,
      limit: migratedPageSize,
      search: migratedSearch || undefined,
      voterLocationStatus: 'MIGRATED' as any,
    })
      .then((res) => {
        if (!active) return;
        const derivedMigrated = res.items.map((voter) => ({
          id: voter.epicNumber,
          name: voter.name,
          epic: voter.epicNumber,
          mandal: voter.mandal,
          village: voter.village,
          booth: voter.boothNumber,
          currentLocation: voter.currentLocation || 'Unknown',
          contactNumber: voter.mobileNumber || 'N/A',
          travelStatus: 'PENDING_CONFIRMATION' as const,
          assistanceRequired: 'NONE' as const,
          assignedVolunteer: '',
          notes: voter.notes || '',
        }));
        setMigratedVotersList(derivedMigrated);
        setMigratedTotal(res.total);
      })
      .catch(() => {
        if (!active) return;
        setMigratedVotersList([]);
        setMigratedTotal(0);
      })
      .finally(() => {
        if (active) setIsMigratedLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeTab, session.unitId, migratedPage, migratedPageSize, migratedSearch]);

  // --- Constituency Electoral Roll Query ---
  useEffect(() => {
    setElectoralPage(1);
  }, [electoralSearch, electoralPrefFilter, electoralGenderFilter]);

  const loadElectoralRoll = () => {
    if (activeTab !== 'electoral_roll') return;
    let active = true;
    setIsElectoralLoading(true);
    setElectoralError(null);

    fetchVoters({
      unitId: session.unitId,
      constituencyId: session.unitId,
      page: electoralPage,
      limit: electoralPageSize,
      search: electoralSearch.trim() || undefined,
      politicalPreference: electoralPrefFilter !== 'ALL' ? electoralPrefFilter : undefined,
    })
      .then((res) => {
        if (!active) return;
        let items = res.items || [];
        if (electoralGenderFilter !== 'ALL') {
          items = items.filter((v) => v.gender?.toUpperCase() === electoralGenderFilter.toUpperCase());
        }
        setElectoralVoters(items);
        setElectoralTotal(res.total);
      })
      .catch((err) => {
        if (!active) return;
        setElectoralError(err?.message || 'Failed to load electoral roll');
        setElectoralVoters([]);
        setElectoralTotal(0);
      })
      .finally(() => {
        if (active) setIsElectoralLoading(false);
      });

    return () => {
      active = false;
    };
  };

  useEffect(() => {
    const cleanup = loadElectoralRoll();
    return cleanup;
  }, [activeTab, session.unitId, electoralPage, electoralPageSize, electoralSearch, electoralPrefFilter, electoralGenderFilter]);

  const paginatedMigratedVoters = migratedVotersList;

  const handleUpdateMigratedVoter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMigratedVoter) return;
    try {
      await updateVoterMigration(editingMigratedVoter.id, {
        currentLocation: editingMigratedVoter.currentLocation,
        contactNumber: editingMigratedVoter.contactNumber,
        notes: editingMigratedVoter.notes,
        travelStatus: editingMigratedVoter.travelStatus,
      }).catch(async () => {
        await updateVoter(editingMigratedVoter.id, {
          voterLocationStatus: 'Migrated',
          currentLocation: editingMigratedVoter.currentLocation,
          mobileNumber: editingMigratedVoter.contactNumber,
          notes: editingMigratedVoter.notes,
        });
      });
      setMigratedVotersList(prev => prev.map(v => v.id === editingMigratedVoter.id ? editingMigratedVoter : v));
    } catch {
      setMigratedVotersList(prev => prev.map(v => v.id === editingMigratedVoter.id ? editingMigratedVoter : v));
    } finally {
      setEditingMigratedVoter(null);
    }
  };

  const handleAddMigratedVoter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMigratedVoter.name || !newMigratedVoter.epic) return;

    try {
      const created = await createVoter({
        name: newMigratedVoter.name.trim(),
        epicNumber: newMigratedVoter.epic.trim().toUpperCase(),
        voterLocationStatus: 'Migrated',
        currentLocation: newMigratedVoter.currentLocation.trim() || 'Unknown',
        mobileNumber: newMigratedVoter.contactNumber.replace(/\D/g, '').slice(-10),
        notes: newMigratedVoter.notes,
      } as any).catch(() => null);

      const newRec: MigratedVoter = {
        id: created?.id || newMigratedVoter.epic.toUpperCase(),
        name: newMigratedVoter.name,
        epic: newMigratedVoter.epic.toUpperCase(),
        mandal: newMigratedVoter.mandal,
        village: newMigratedVoter.village,
        booth: newMigratedVoter.booth,
        currentLocation: newMigratedVoter.currentLocation || 'Unknown',
        contactNumber: newMigratedVoter.contactNumber || 'N/A',
        travelStatus: newMigratedVoter.travelStatus,
        assistanceRequired: newMigratedVoter.assistanceRequired,
        assignedVolunteer: newMigratedVoter.assignedVolunteer || 'Unassigned',
        notes: newMigratedVoter.notes || ''
      };

      setMigratedVotersList(prev => [newRec, ...prev]);
      setMigratedTotal(prev => prev + 1);
      setNewMigratedVoter({
        name: '', epic: '', mandal: 'Singarayakonda', village: 'Kalikivaya', booth: 'Booth 224',
        currentLocation: '', contactNumber: '', travelStatus: 'PENDING_CONFIRMATION',
        assistanceRequired: 'NONE', assignedVolunteer: '', notes: ''
      });
    } catch {
      // Graceful fallback
    }
  };

  // Handle drilldown to Mandal (Dynamically bind assigned lead from real cadre network)
  if (drilledMandal) {
    const assignedLead = cadreItems.find((item) => item.role === 'MANDAL_INCHARGE' && item.unitName?.toLowerCase() === drilledMandal.toLowerCase())
      ?? cadreItems.find((item) => item.role === 'MANDAL_INCHARGE');

    return (
      <MandalInchargeDashboard 
        session={{
          userName: assignedLead?.name || `${drilledMandal} Incharge`,
          mobileNumber: (assignedLead as any)?.phone || (assignedLead as any)?.mobileNumber || "9848010001",
          role: "MANDAL_INCHARGE",
          unitId: session.unitId,
          assignedConstituency: session.assignedConstituency || "Kondapi Assembly Constituency",
          assignedMandal: drilledMandal,
          userId: assignedLead?.id || `MANDAL-${drilledMandal.toUpperCase().slice(0, 3)}`,
          accountStatus: "Active"
        }}
        onLogout={() => setDrilledMandal(null)} // Click return triggers close drilldown!
      />
    );
  }

  const handleUpdateVoterStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditingVoter) return;
    try {
      const dbStatus = auditingVoter.status === 'RESOLVED' ? 'ACTIVE' :
                       auditingVoter.status === 'VERIFIED ISSUE' ? 'FAKE' :
                       'UNDER_REVIEW';

      await updateVoterStatusApi(auditingVoter.epic, dbStatus, auditingVoter.reason).catch(async () => {
        await updateVoter(auditingVoter.epic, {
          voterStatus: dbStatus as any,
          notes: auditingVoter.reason,
        });
      });
      setFlaggedVoters(prev => prev.map(v => v.sNo === auditingVoter.sNo ? auditingVoter : v));
    } catch {
      setFlaggedVoters(prev => prev.map(v => v.sNo === auditingVoter.sNo ? auditingVoter : v));
    } finally {
      setAuditingVoter(null);
    }
  };

  return (
    <div className="flex h-full overflow-hidden bg-[#06070B] text-slate-100" id="constituency-dashboard-root">
      
      {/* --------------------------------------------------------
          SLIDING MODULES DRAWER (UNIVERSAL MOBILE & DESKTOP)
         -------------------------------------------------------- */}
      <aside className={`
        fixed inset-y-0 right-0 z-50 w-80 max-w-[88vw] h-full bg-[#0D0F18]/95 backdrop-blur-2xl text-slate-300 flex flex-col justify-between border-l border-white/[0.08] transition-transform duration-300 ease-in-out shadow-2xl select-none
        ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Brand Block */}
        <div className="p-5 border-b border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-white shrink-0 font-black text-sm shadow-lg shadow-cyan-500/25">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-black text-white tracking-tight">{session.organisationName || 'Kondapi Connect'}</h1>
                <p className="text-[10px] text-cyan-400 font-extrabold uppercase tracking-widest">Constituency Command</p>
              </div>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="bg-[#121522] border border-white/[0.08] rounded-xl p-2.5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <div className="min-w-0">
              <span className="text-[11px] text-white font-bold block truncate">
                {session?.userName || 'Chundi Ramesh Naidu'}
              </span>
              <span className="text-[9px] text-cyan-400 uppercase font-mono block">Constituency Incharge</span>
            </div>
          </div>
        </div>

        {/* Drawer Nav Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 no-scrollbar">
          {[
            { id: 'dashboard', name: 'Dashboard', desc: 'Live Telemetry & Metrics', icon: Home },
            { id: 'electoral_roll', name: 'Electoral Roll', desc: 'Voter Directory & Status', icon: Database },
            { id: 'mandal_list', name: 'Mandal List', desc: 'Mandals & Village Maps', icon: Layers },
            { id: 'village_list', name: 'Village List', desc: 'Polling Station Units', icon: MapPin },
            { id: 'tasks', name: 'High Command Tasks', desc: 'Directives & Checklists', icon: Calendar },
            { id: 'caste_analytics', name: 'Caste Analytics', desc: 'Demographic Breakdown', icon: BarChart3 },
            { id: 'cadre_network', name: 'Cadre Network', desc: '7-Tier Organizational Tree', icon: Users },
            { id: 'fake_votes', name: 'Fake Votes', desc: 'Objection Audits & Reports', icon: AlertTriangle },
            { id: 'strategic_intelligence', name: 'Strategic Intelligence', desc: 'AI Battleground Forecasts', icon: Compass },
            { id: 'training_analytics', name: 'Training Analytics', desc: 'Video Course Progress', icon: GraduationCap },
            { id: 'live_voter_tracking', name: 'Live Voter Tracking', desc: 'Hourly Polling Velocity', icon: Activity },
            { id: 'migrated_voters', name: 'Migrated Voters', desc: 'Out-of-Station Outreach', icon: Globe }
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as ConstTabType);
                  setSelectedMandalInVillageList(null);
                  setIsSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3.5 py-3 text-xs font-bold rounded-2xl transition-all cursor-pointer text-left
                  ${isActive 
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white font-black shadow-lg shadow-cyan-500/25 border border-cyan-400/30' 
                    : 'hover:bg-slate-900 hover:text-white text-slate-300 bg-[#121522]/60 border border-white/[0.05]'
                  }
                `}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isActive ? 'bg-slate-950 text-cyan-300' : 'bg-slate-800 text-slate-400'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-xs">{item.name}</span>
                  <span className={`block truncate text-[10px] ${isActive ? 'text-white/80' : 'text-slate-500'}`}>{item.desc}</span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Bottom Lock / Exit Controls */}
        <div className="p-4 border-t border-white/[0.08] space-y-2">
          <button
            type="button"
            onClick={() => {
              setIsSessionsOpen(true);
              setIsSidebarOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#121522] hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer border border-white/[0.08]"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Active Sessions
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 hover:text-white rounded-xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Disconnect Portal
          </button>
        </div>
      </aside>

      {/* Drawer Backdrop Overlay (Mobile & Desktop) */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-md z-40 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* --------------------------------------------------------
          MAIN DISPLAY VIEW AREA - EXECUTIVE MOBILE CANVAS
         -------------------------------------------------------- */}
      <main className="flex-1 h-full overflow-y-auto overflow-x-hidden bg-[#06070B]" id="main-workspace-section">
        {/* Centered App Container Shell */}
        <div className="max-w-3xl xl:max-w-4xl mx-auto min-h-screen bg-[#06070B] border-x border-white/[0.06] shadow-2xl relative flex flex-col pb-28">
          
          {/* Universal Sticky App Header */}
          <div className="sticky top-0 z-30 bg-[#0C0E17]/95 backdrop-blur-md border-b border-white/[0.08] px-3.5 sm:px-5 py-3 space-y-2.5 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center font-black text-white text-sm shadow-lg shadow-cyan-500/25 shrink-0">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-sm sm:text-base text-white tracking-tight truncate block">
                      {session?.assignedConstituency || 'Kondapi'} Command
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  </div>
                  <span className="text-[10px] text-cyan-400 font-bold tracking-wide uppercase truncate block">
                    {session?.userName || 'Chundi Ramesh Naidu'} • MLA Incharge
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsSessionsOpen(true)}
                  className="p-2 bg-[#121522] hover:bg-slate-800 text-slate-300 border border-white/[0.08] rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 transition"
                  title="Active Sessions"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline text-[10px] uppercase">Sessions</span>
                </button>
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="px-3 py-2 bg-gradient-to-r from-blue-600/25 to-cyan-500/25 hover:from-blue-600/40 hover:to-cyan-500/40 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-black cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 transition"
                  aria-label="Open 12 modules menu"
                >
                  <Menu className="w-4 h-4" />
                  <span>Modules</span>
                </button>
              </div>
            </div>

            {/* Horizontal Swipeable 12-Tab Fast-Switcher Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
              {[
                { id: 'dashboard', name: 'Dashboard', icon: Home },
                { id: 'electoral_roll', name: 'Voters', icon: Database },
                { id: 'mandal_list', name: 'Mandals', icon: Layers },
                { id: 'village_list', name: 'Villages', icon: MapPin },
                { id: 'tasks', name: 'Tasks', icon: Calendar },
                { id: 'caste_analytics', name: 'Demographics', icon: BarChart3 },
                { id: 'cadre_network', name: 'Cadre', icon: Users },
                { id: 'fake_votes', name: 'Fake Votes', icon: AlertTriangle },
                { id: 'strategic_intelligence', name: 'AI Intel', icon: Compass },
                { id: 'training_analytics', name: 'Training', icon: GraduationCap },
                { id: 'live_voter_tracking', name: 'Live Turnout', icon: Activity },
                { id: 'migrated_voters', name: 'Migrated', icon: Globe }
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as ConstTabType);
                      setSelectedMandalInVillageList(null);
                    }}
                    className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white font-black shadow-lg shadow-cyan-500/30 scale-[1.02] border border-cyan-400/40'
                        : 'bg-[#121522]/80 border border-white/[0.06] text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3.5 sm:p-6 space-y-6 flex-1" id="constituency-main-container">
          
          {/* Header Title block */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-white/[0.08] pb-5 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 uppercase tracking-wider shadow-sm shadow-cyan-500/10">
                  <Crown className="w-3.5 h-3.5 text-cyan-400" />
                  Assembly Constituency Command
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-[#121522] text-slate-300 border border-white/[0.08]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  AP State • Kondapi
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Kondapi Constituency Dashboard
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 font-medium">
                Live political telemetry, booth infrastructure, and cadre performance across all Mandals.
              </p>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <div className="px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-slate-200">Constituency Incharge</span>
              </div>
            </div>
          </div>

          {/* --------------------------------------------------------
              TAB: DASHBOARD
             -------------------------------------------------------- */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in" id="const-dashboard-tab">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                
                {/* Total Voters */}
                <div className="bg-[#0D0F18]/95 backdrop-blur-xl border border-white/[0.08] hover:border-cyan-500/50 rounded-2xl p-4 shadow-xl transition-all duration-200 flex flex-col justify-between space-y-3 group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase tracking-wider">Total Voters</span>
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">{liveConstituencyStats.totalVoters.toLocaleString()}</span>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Aggregated from scoped hierarchy</p>
                  </div>
                </div>

                {/* Total Mandals */}
                <div className="bg-[#0D0F18]/95 backdrop-blur-xl border border-white/[0.08] hover:border-indigo-500/50 rounded-2xl p-4 shadow-xl transition-all duration-200 flex flex-col justify-between space-y-3 group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase tracking-wider">Total Mandals</span>
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Layers className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">{liveConstituencyStats.totalMandals}</span>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Current operational mandals</p>
                  </div>
                </div>

                {/* Total Villages */}
                <div className="bg-[#0D0F18]/95 backdrop-blur-xl border border-white/[0.08] hover:border-violet-500/50 rounded-2xl p-4 shadow-xl transition-all duration-200 flex flex-col justify-between space-y-3 group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase tracking-wider">Total Villages</span>
                    <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <MapPin className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">{liveConstituencyStats.totalVillages}</span>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Resolved from child units</p>
                  </div>
                </div>

                {/* Total Booths */}
                <div className="bg-[#0D0F18]/95 backdrop-blur-xl border border-white/[0.08] hover:border-fuchsia-500/50 rounded-2xl p-4 shadow-xl transition-all duration-200 flex flex-col justify-between space-y-3 group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase tracking-wider">Total Booths</span>
                    <div className="w-8 h-8 rounded-xl bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Vote className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">{liveConstituencyStats.totalBooths}</span>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Active polling stations</p>
                  </div>
                </div>

                {/* Live Turnout (spans full width on mobile) */}
                <div className="col-span-2 sm:col-span-2 lg:col-span-1 bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-[#0D0F18] border border-emerald-500/40 hover:border-emerald-400 rounded-2xl p-4 shadow-xl shadow-emerald-500/10 transition-all duration-200 flex flex-col justify-between space-y-3 group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-[11px] text-emerald-300 font-black uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Live Turnout
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Activity className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <span className="text-xl sm:text-2xl font-black text-white tracking-tight">{liveConstituencyStats.voted.toLocaleString()} Done</span>
                    <div className="text-[10px] font-bold text-emerald-300 bg-[#121522] px-2.5 py-1 rounded-lg border border-emerald-500/30 w-fit mt-1.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Remaining: {liveConstituencyStats.remaining.toLocaleString()}
                    </div>
                  </div>
                </div>

              </div>

              {/* Constituency Political Position Chart Card */}
              {(() => {
                const totalSurveyed = (constituencyStats.tdp || 0) + (constituencyStats.ysrcp || 0) + (constituencyStats.neutral || 0);
                const hasData = totalSurveyed > 0;
                const tdpPct = hasData ? Number(((constituencyStats.tdp / totalSurveyed) * 100).toFixed(1)) : 0;
                const ysrcpPct = hasData ? Number(((constituencyStats.ysrcp / totalSurveyed) * 100).toFixed(1)) : 0;
                const neutralPct = hasData ? Number(((constituencyStats.neutral / totalSurveyed) * 100).toFixed(1)) : 0;

                return (
                  <div className="bg-[#0F172A]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400">{backendSummary?.user?.unitName || 'Constituency'} Political Position</h3>
                      <p className="text-xs text-slate-400">Overall support share of registered parties derived directly from database voter records.</p>
                    </div>

                    {!hasData ? (
                      <div className="p-8 text-center bg-[#121522] border border-white/[0.08] rounded-xl space-y-2">
                        <p className="font-bold text-white text-sm">No Voter Survey Records Ingested</p>
                        <p className="text-xs text-slate-400">Upload official voter rolls or submit ground surveys to display live party preference distributions.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Left Column: Legend List */}
                        <div className="space-y-3">
                          {[
                            { party: 'TDP', votes: constituencyStats.tdp, pct: tdpPct, color: 'bg-yellow-400 border-yellow-500' },
                            { party: 'YSRCP', votes: constituencyStats.ysrcp, pct: ysrcpPct, color: 'bg-blue-600 border-blue-700' },
                            { party: 'Neutral', votes: constituencyStats.neutral, pct: neutralPct, color: 'bg-slate-400 border-slate-500' },
                          ].map((item) => (
                            <div key={item.party} className="flex items-center justify-between border-b border-slate-800 pb-2 last:border-b-0">
                              <div className="flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${item.color} shrink-0`} />
                                <span className="text-xs font-black text-white">{item.party}</span>
                              </div>
                              <div className="text-right text-xs">
                                <span className="font-extrabold text-white">{item.pct}%</span>
                                <span className="text-[10px] text-slate-400 ml-1.5 font-bold">({item.votes.toLocaleString()} votes)</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Middle Column: Interactive Progress Bars */}
                        <div className="md:col-span-2 flex flex-col justify-center space-y-4">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-extrabold text-slate-200">
                              <span>TDP Preference Share</span>
                              <span className="text-yellow-400">{tdpPct}%</span>
                            </div>
                            <div className="w-full h-3.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-yellow-400" style={{ width: `${tdpPct}%` }} />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-extrabold text-slate-200">
                              <span>YSRCP Preference Share</span>
                              <span className="text-blue-400">{ysrcpPct}%</span>
                            </div>
                            <div className="w-full h-3.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-600" style={{ width: `${ysrcpPct}%` }} />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-extrabold text-slate-200">
                              <span>Neutral / Deciding Voters</span>
                              <span className="text-slate-400">{neutralPct}%</span>
                            </div>
                            <div className="w-full h-3.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-slate-500" style={{ width: `${neutralPct}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Brief Quick Links Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <div className="bg-[#0D0F18]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-xl space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-cyan-400">Campaign Operations Summary</h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {constituencyStats.voters > 0 ? (
                      <>
                        The overall constituency position reflects {constituencyStats.mandals} mapped mandals with {constituencyStats.voters.toLocaleString()} enrolled voters in database.
                        Strong operational focus is directed at voter survey completion and verified door-to-door coverage.
                      </>
                    ) : (
                      <>Awaiting voter roll ingestion. No voters or campaign surveys recorded in database yet.</>
                    )}
                  </p>
                  <button 
                    onClick={() => setActiveTab('mandal_list')}
                    className="text-xs font-black text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
                  >
                    Go to Mandal Analysis <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="bg-[#0D0F18]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-xl space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-cyan-400">Command Center Status</h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {constituencyStats.booths > 0 ? (
                      <>Voter database synchronization active across all {constituencyStats.booths} polling booths. Flagged verification reports are audited continuously.</>
                    ) : (
                      <>No polling booth records configured yet in database.</>
                    )}
                  </p>
                  <button 
                    onClick={() => setActiveTab('cadre_network')}
                    className="text-xs font-black text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
                  >
                    Inspect Cadre Network <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Cadre Opinion Polls Widget */}
              <CadrePulseWidget title="Constituency Cadre Opinion Polls" />

            </div>
          )}

          {/* --------------------------------------------------------
              TAB: CONSTITUENCY ELECTORAL ROLL
             -------------------------------------------------------- */}
          {activeTab === 'electoral_roll' && (
            <div className="space-y-6 animate-fade-in" id="const-electoral-roll-tab">
              <div className="bg-[#0F172A]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-5">
                {/* Header & Quick stats */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                        <Database className="w-4 h-4" />
                      </span>
                      <h3 className="text-sm font-black uppercase tracking-wider text-white">Constituency Electoral Roll</h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Official verified voter records across all Mandals and Booths in this Assembly Constituency.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs bg-slate-900/90 border border-slate-800 text-cyan-400 px-3 py-1.5 rounded-xl font-black">
                      Total Voters: {electoralTotal.toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => void loadElectoralRoll()}
                      disabled={isElectoralLoading}
                      className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                      title="Refresh Roll"
                    >
                      <RefreshCw className={`w-4 h-4 ${isElectoralLoading ? 'animate-spin text-cyan-400' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Search & Filter Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-6 relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by Voter Name, EPIC ID, Relative Name, or Mobile..."
                      value={electoralSearch}
                      onChange={(e) => setElectoralSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-[#121522] border border-white/[0.08] rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <select
                      value={electoralPrefFilter}
                      onChange={(e) => setElectoralPrefFilter(e.target.value)}
                      className="w-full py-2 px-3 bg-[#121522] border border-white/[0.08] rounded-xl text-xs font-bold text-slate-200 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
                    >
                      <option value="ALL">All Political Alignments</option>
                      <option value="TDP">TDP (Support)</option>
                      <option value="YSRCP">YSRCP</option>
                      <option value="JSP">JSP</option>
                      <option value="BJP">BJP</option>
                      <option value="INC">INC</option>
                      <option value="Neutral">Neutral</option>
                      <option value="OTH">Other</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <select
                      value={electoralGenderFilter}
                      onChange={(e) => setElectoralGenderFilter(e.target.value)}
                      className="w-full py-2 px-3 bg-[#121522] border border-white/[0.08] rounded-xl text-xs font-bold text-slate-200 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
                    >
                      <option value="ALL">All Genders</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                {/* Error Banner */}
                {electoralError && !isElectoralLoading && (
                  <div className="p-4 bg-red-950/40 border border-red-800/80 rounded-xl flex items-center justify-between text-red-300 text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                      <span>{electoralError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadElectoralRoll()}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* Loading State */}
                {isElectoralLoading && (
                  <div className="py-16 text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-400">Querying verified electoral roll records...</p>
                  </div>
                )}

                {/* Empty State */}
                {!isElectoralLoading && !electoralError && electoralVoters.length === 0 && (
                  <div className="py-16 text-center space-y-3 border-2 border-dashed border-slate-800 rounded-2xl bg-[#0B1120]/50">
                    <Database className="w-10 h-10 text-slate-600 mx-auto" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-white uppercase tracking-tight">No Voters Found</h4>
                      <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                        No voter records match the specified filters in this constituency. Try modifying the search keyword or filter settings.
                      </p>
                    </div>
                  </div>
                )}

                {/* View Mode Switcher & Counter */}
                {!isElectoralLoading && !electoralError && electoralVoters.length > 0 && (
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-[11px] font-bold text-slate-400">
                      Showing <span className="text-white font-mono">{electoralVoters.length}</span> of <span className="text-cyan-400 font-mono">{electoralTotal.toLocaleString()}</span> voters
                    </span>
                    <div className="flex items-center gap-1 bg-[#121522] border border-white/[0.08] p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setVoterViewMode('cards')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          voterViewMode === 'cards' ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black shadow-sm' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        📱 Cards
                      </button>
                      <button
                        type="button"
                        onClick={() => setVoterViewMode('table')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          voterViewMode === 'table' ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black shadow-sm' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        📄 Table
                      </button>
                    </div>
                  </div>
                )}

                {/* Mobile Cards / Table Display */}
                {!isElectoralLoading && !electoralError && electoralVoters.length > 0 && (
                  <div className="space-y-4">
                    {voterViewMode === 'cards' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {electoralVoters.map((voter, idx) => {
                          const prefColor = CONST_PARTY_COLORS[voter.politicalPreference] || '#64748b';
                          return (
                            <div 
                              key={voter.id || voter.epicNumber || idx}
                              className="bg-[#0D0F18]/95 border border-white/[0.08] hover:border-cyan-500/50 rounded-2xl p-4 space-y-3 transition shadow-md flex flex-col justify-between"
                            >
                              <div className="space-y-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="font-black text-sm text-white uppercase tracking-tight">{voter.name}</div>
                                    <div className="text-[11px] text-slate-400 font-medium">
                                      {voter.relationType || 'S/O'}: {voter.fatherHusbandName || '—'}
                                    </div>
                                  </div>
                                  {voter.voteStatus === 'VOTE DONE' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 uppercase">
                                      <Check className="w-3 h-3 text-emerald-400" /> Voted
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700 uppercase">
                                      Not Voted
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap text-[10px]">
                                  <span className="px-2.5 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono font-black">
                                    EPIC: {voter.epicNumber}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-lg bg-[#121522] border border-white/[0.08] text-slate-300 font-bold">
                                    Age: {voter.age} • {voter.gender}
                                  </span>
                                  <span
                                    className="px-2.5 py-0.5 rounded-lg font-bold uppercase tracking-wider text-[9px]"
                                    style={{
                                      backgroundColor: `${prefColor}20`,
                                      color: prefColor,
                                      border: `1px solid ${prefColor}40`,
                                    }}
                                  >
                                    {voter.politicalPreference || 'Neutral'}
                                  </span>
                                </div>

                                <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-white/[0.08] pt-2 font-mono">
                                  <span className="truncate">📍 {voter.mandal} • {voter.village}</span>
                                  <span className="text-cyan-400 font-bold shrink-0">Booth #{voter.boothNumber || '—'}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#0D0F18]">
                        <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                          <thead>
                            <tr className="bg-[#121522] border-b border-white/[0.08] text-slate-300 font-black uppercase text-[10px] tracking-wider">
                              <th className="py-3 px-3.5 text-center">S.No</th>
                              <th className="py-3 px-3.5">EPIC ID</th>
                              <th className="py-3 px-3.5">Voter Details</th>
                              <th className="py-3 px-3.5">Relative</th>
                              <th className="py-3 px-3.5">Age / Gender</th>
                              <th className="py-3 px-3.5">Mandal / Village</th>
                              <th className="py-3 px-3.5">Booth</th>
                              <th className="py-3 px-3.5">Preference</th>
                              <th className="py-3 px-3.5 text-center">Vote Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.06] font-medium text-slate-300">
                            {electoralVoters.map((voter, idx) => {
                              const prefColor = CONST_PARTY_COLORS[voter.politicalPreference] || '#64748b';
                              return (
                                <tr key={voter.id || voter.epicNumber || idx} className="hover:bg-slate-800/40 transition-colors">
                                  <td className="py-3 px-3.5 text-center text-slate-500 font-mono text-[11px]">
                                    {(electoralPage - 1) * electoralPageSize + idx + 1}
                                  </td>
                                  <td className="py-3 px-3.5 font-mono font-black text-cyan-400 tracking-wider">
                                    {voter.epicNumber}
                                  </td>
                                  <td className="py-3 px-3.5">
                                    <div className="font-black text-white uppercase">{voter.name}</div>
                                    {voter.mobileNumber && (
                                      <div className="text-[10px] text-slate-400 font-mono">{voter.mobileNumber}</div>
                                    )}
                                    {voter.houseNumber && (
                                      <div className="text-[10px] text-slate-400 font-medium">H.No: {voter.houseNumber}</div>
                                    )}
                                  </td>
                                  <td className="py-3 px-3.5 text-slate-300">
                                    <div className="text-xs font-semibold">{voter.fatherHusbandName || '—'}</div>
                                    <div className="text-[10px] text-slate-400 uppercase font-medium">{voter.relationType || 'Relative'}</div>
                                  </td>
                                  <td className="py-3 px-3.5 text-slate-300">
                                    <span className="font-bold text-white">{voter.age}</span>
                                    <span className="text-slate-400 text-[10px] font-semibold uppercase ml-1.5">
                                      • {voter.gender}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3.5">
                                    <div className="font-bold text-white">{voter.mandal || '—'}</div>
                                    <div className="text-[10px] text-slate-400 font-medium">{voter.village || '—'}</div>
                                  </td>
                                  <td className="py-3 px-3.5 font-semibold text-slate-300">
                                    {voter.boothNumber || '—'}
                                  </td>
                                  <td className="py-3 px-3.5">
                                    <span
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
                                      style={{
                                        backgroundColor: `${prefColor}20`,
                                        color: prefColor,
                                        border: `1px solid ${prefColor}50`,
                                      }}
                                    >
                                      <span
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{ backgroundColor: prefColor }}
                                      />
                                      {voter.politicalPreference || 'Neutral'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3.5 text-center">
                                    {voter.voteStatus === 'VOTE DONE' ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 uppercase">
                                        <Check className="w-3 h-3 text-emerald-400" /> Voted
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 uppercase">
                                        Not Voted
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Pagination */}
                    <Pagination
                      currentPage={electoralPage}
                      pageSize={electoralPageSize}
                      totalItems={electoralTotal}
                      onPageChange={setElectoralPage}
                      onPageSizeChange={(newSize) => {
                        setElectoralPageSize(newSize);
                        setElectoralPage(1);
                      }}
                      pageSizeOptions={[10, 15, 25, 50, 100]}
                      itemName="voters"
                      accentColor="blue"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --------------------------------------------------------
              TAB: MANDAL LIST
             -------------------------------------------------------- */}
          {activeTab === 'mandal_list' && (
            <div className="space-y-6 animate-fade-in" id="const-mandal-tab">
              <div className="bg-[#0F172A]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
                
                {/* Header with quick stats */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400">Mandal Analysis</h3>
                    <p className="text-xs text-slate-400">View detailed performance, leadership margins, and drill-down into polling villages.</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-300 font-extrabold px-2.5 py-1 rounded-lg">
                      Total: 6
                    </span>
                    <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-extrabold px-2.5 py-1 rounded-lg">
                      TDP Leading: 4
                    </span>
                    <span className="text-[10px] bg-red-500/10 border border-red-500/30 text-red-400 font-extrabold px-2.5 py-1 rounded-lg">
                      YSRCP Leading: 2
                    </span>
                  </div>
                </div>

                {/* Filter and Search controls */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search Mandal..." 
                      value={mandalSearch}
                      onChange={(e) => setMandalSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-[#0B1120] border border-slate-700/80 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  {/* Filter pills */}
                  <div className="flex gap-2 flex-wrap">
                    {(['ALL', 'TDP LEADING', 'YSRCP LEADING', 'CLOSE CONTEST'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setMandalFilter(tab)}
                        className={`
                          px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase transition-all cursor-pointer border
                          ${mandalFilter === tab 
                            ? 'bg-gradient-to-r from-blue-600 to-cyan-500 border-cyan-400 text-white font-black shadow-md shadow-cyan-500/20' 
                            : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800 text-slate-300'
                          }
                        `}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mandals Grid list */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 pt-2">
                  {filteredMandals.map((mandal) => {
                    const isPending = false;
                    const statusColors = 
                      isPending ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse' :
                      mandal.status === 'WINNING' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
                      mandal.status === 'TRAILING' ? 'bg-red-500/20 text-red-400 border-red-500/40' :
                      'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';

                    const marginColor = 
                      mandal.status === 'WINNING' ? 'text-emerald-400' :
                      mandal.status === 'TRAILING' ? 'text-rose-400' :
                      mandal.status === 'CLOSE CONTEST' ? 'text-cyan-400' : 'text-slate-400';

                    return (
                      <div 
                        key={mandal.name} 
                        className="bg-[#0B1120] border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-5 space-y-4 hover:shadow-xl transition-all flex flex-col justify-between"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <h4 className="text-base font-black text-white uppercase tracking-tight">{mandal.name}</h4>
                            <span className={`px-2.5 py-0.5 border rounded-full text-[9px] font-black tracking-widest uppercase ${statusColors}`}>
                              {mandal.status}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 py-2 text-center text-[10px] font-bold text-slate-400">
                            <div>
                              <span className="block text-slate-500 text-[9px] uppercase font-black">Voters</span>
                              <span className="text-white font-black text-sm">{isPending ? 'PENDING' : mandal.voters.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="block text-slate-500 text-[9px] uppercase font-black">Villages</span>
                              <span className="text-sky-400 font-black text-sm">{mandal.villages}</span>
                            </div>
                            <div>
                              <span className="block text-slate-500 text-[9px] uppercase font-black">Booths</span>
                              <span className="text-purple-400 font-black text-sm">{isPending ? 'PENDING' : mandal.booths}</span>
                            </div>
                          </div>

                          {/* Party share bar visual */}
                          {isPending ? (
                            <div className="space-y-1 pt-1.5 border-t border-slate-800 text-center py-1">
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">AWAITING SYSTEM SYNC</span>
                              <div className="w-full h-2 bg-slate-800 rounded-full" />
                            </div>
                          ) : (
                            <div className="space-y-1 pt-1.5 border-t border-slate-800">
                              <div className="flex justify-between text-xs font-black">
                                <span className="text-yellow-400">TDP: {mandal.voters > 0 ? Math.round(mandal.tdp / mandal.voters * 100) : 0}%</span>
                                <span className="text-blue-400">YSRCP: {mandal.voters > 0 ? Math.round(mandal.ysrcp / mandal.voters * 100) : 0}%</span>
                              </div>
                              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                                <div className="h-full bg-yellow-400" style={{ width: `${mandal.voters > 0 ? (mandal.tdp / mandal.voters * 100) : 0}%` }} />
                                <div className="h-full bg-blue-600" style={{ width: `${mandal.voters > 0 ? (mandal.ysrcp / mandal.voters * 100) : 0}%` }} />
                                <div className="h-full bg-slate-600" style={{ width: `${mandal.voters > 0 ? (mandal.neutral / mandal.voters * 100) : 0}%` }} />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                          <div className="text-[10px] font-bold text-slate-400">
                            {isPending ? (
                              <span className="text-[9px] text-slate-500 font-bold uppercase block">NO ACTIVE SURVEY DATA</span>
                            ) : (
                              <>
                                <span className="text-[11px] font-black text-slate-400 uppercase">Leading: </span>
                                <span className={`text-[13px] md:text-sm font-black uppercase tracking-wide ${
                                  mandal.leading === 'TDP' ? 'text-yellow-400' : 'text-blue-400'
                                }`}>
                                  {mandal.leading}
                                </span>
                                <span className={`block text-[11px] font-black ${marginColor} mt-0.5`}>
                                  Margin: +{mandal.lead.toLocaleString()} votes
                                </span>
                              </>
                            )}
                          </div>
                          
                          <button
                            onClick={() => setDrilledMandal(mandal.name)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 border border-slate-800 text-[10px] font-black rounded-xl uppercase tracking-wider cursor-pointer"
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>
          )}

          {/* --------------------------------------------------------
              TAB: VILLAGE LIST
             -------------------------------------------------------- */}
          {activeTab === 'village_list' && (
            <div className="space-y-6 animate-fade-in" id="const-village-tab">
              {!selectedMandalInVillageList ? (
                // STEP 1 - LANDING PAGE: MANDAL DIRECTORY
                <div className="space-y-6">
                  <div className="bg-[#0B1120] text-white rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <p className="text-[10px] text-cyan-400 font-extrabold uppercase tracking-widest">KONDAPI CONSTITUENCY</p>
                      <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight mt-1 text-white">MANDAL DIRECTORY</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Select a mandal to explore real-time booth intelligence and village polling statistics.</p>
                    </div>
                    <div className="bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-800 text-right shrink-0">
                      <span className="block text-[10px] text-cyan-400 font-extrabold uppercase tracking-widest">6 MANDALS • 112 GRAM PANCHAYATS</span>
                      <span className="text-sm font-black text-white">{constituencyStats.voters.toLocaleString()} TOTAL VOTERS</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                    {mandalsData.map(m => {
                      const statusColors = 
                        m.status === 'WINNING' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
                        m.status === 'TRAILING' ? 'bg-red-500/20 text-red-400 border-red-500/40' :
                        'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';

                      const marginColor = 
                        m.status === 'WINNING' ? 'text-emerald-400' :
                        m.status === 'TRAILING' ? 'text-rose-400' :
                        m.status === 'CLOSE CONTEST' ? 'text-cyan-400' : 'text-slate-400';

                      return (
                        <button
                          key={m.name}
                          onClick={() => setSelectedMandalInVillageList(m.name)}
                          className="text-left bg-[#0F172A]/90 border border-slate-800 rounded-2xl p-5 hover:border-cyan-400/60 hover:shadow-xl transition-all flex flex-col justify-between space-y-4 group cursor-pointer"
                        >
                          <div className="w-full space-y-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="text-base font-black text-white group-hover:text-cyan-400 transition-colors uppercase tracking-tight">{m.name}</h4>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                  <span className="text-sky-400 font-black text-xs">{m.villages}</span> Gram Panchayats
                                </span>
                              </div>
                              <span className={`px-2 py-0.5 border rounded-full text-[9px] font-black tracking-widest uppercase shrink-0 ${statusColors}`}>
                                {m.status}
                              </span>
                            </div>

                            <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-xs">
                              <div>
                                <span className="block text-[9px] text-slate-400 font-bold uppercase">Total Voters</span>
                                <span className="font-black text-sm text-white">{m.voters.toLocaleString()}</span>
                              </div>
                              <div className="text-right">
                                <span className="block text-[9px] text-slate-400 font-bold uppercase">Booths</span>
                                <span className="font-black text-sm text-purple-400">{m.booths}</span>
                              </div>
                            </div>

                            {/* Progress bars */}
                            <div className="space-y-1 pt-1.5 border-t border-slate-800">
                              <div className="flex justify-between text-xs font-black">
                                <span className="text-yellow-400">TDP: {m.voters > 0 ? Math.round(m.tdp / m.voters * 100) : 0}%</span>
                                <span className="text-blue-400">YSRCP: {m.voters > 0 ? Math.round(m.ysrcp / m.voters * 100) : 0}%</span>
                              </div>
                              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                                <div className="h-full bg-yellow-400" style={{ width: `${m.voters > 0 ? (m.tdp / m.voters * 100) : 0}%` }} />
                                <div className="h-full bg-blue-600" style={{ width: `${m.voters > 0 ? (m.ysrcp / m.voters * 100) : 0}%` }} />
                                <div className="h-full bg-slate-600" style={{ width: `${m.voters > 0 ? (m.neutral / m.voters * 100) : 0}%` }} />
                              </div>
                            </div>
                          </div>

                          <div className="w-full pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] font-bold text-slate-400">
                            <div>
                              <span className="text-[11px] font-black text-slate-400 uppercase">Leading: </span>
                              <span className={`text-[13px] md:text-sm font-black uppercase tracking-wide ${
                                m.leading === 'TDP' ? 'text-yellow-400' : 'text-blue-400'
                              }`}>
                                {m.leading}
                              </span>
                              <span className={`block text-[11px] font-black ${marginColor} mt-0.5`}>
                                Margin: +{m.lead.toLocaleString()} votes
                              </span>
                            </div>
                            <span className="text-cyan-400 font-black uppercase tracking-wider group-hover:translate-x-1 transition-transform flex items-center gap-1">
                              Explore GP List <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // STEP 2 - DRILLDOWN VIEW: MANDAL VILLAGE LIST
                <div className="bg-[#0F172A]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-4 gap-3">
                    <div className="space-y-1">
                      <button
                        onClick={() => setSelectedMandalInVillageList(null)}
                        className="flex items-center gap-2 text-xs font-black text-cyan-400 hover:text-cyan-300 uppercase tracking-wider cursor-pointer mb-1 transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" /> Back to Mandal Directory
                      </button>
                      <h3 className="text-base font-black uppercase tracking-tight text-white">
                        {selectedMandalInVillageList} Mandal — Village List ({filteredVillages.length})
                      </h3>
                      <p className="text-xs text-slate-400 font-medium">
                        Reviewing dynamic polling data and political leanings for all active Gram Panchayats in {selectedMandalInVillageList} Mandal.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 self-start md:self-auto">
                      <span className="px-3 py-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-extrabold uppercase">
                        Real-time Synchronized
                      </span>
                    </div>
                  </div>

                  {/* Filter and Search controls */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-1">
                    <div className="flex-1 relative">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder={`Search villages in ${selectedMandalInVillageList}...`} 
                        value={villageSearch}
                        onChange={(e) => setVillageSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-[#0B1120] border border-slate-700/80 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    {/* Filter pills */}
                    <div className="flex gap-2 flex-wrap">
                      {(['ALL', 'TDP WINNING', 'YSRCP WINNING', 'CLOSE CONTEST'] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setVillageFilter(tab)}
                          className={`
                            px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase transition-all cursor-pointer border
                            ${villageFilter === tab 
                              ? 'bg-gradient-to-r from-blue-600 to-cyan-500 border-cyan-400 text-white font-black shadow-md shadow-cyan-500/20' 
                              : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800 text-slate-300'
                            }
                          `}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Villages Table */}
                  <div className="overflow-x-auto border border-slate-800 rounded-xl bg-[#0B1120]">
                    <table className="w-full min-w-[700px] text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#131E33] border-b border-slate-800 text-slate-300 font-black uppercase text-[9px] tracking-wider">
                          <th className="py-3 px-4 text-center">S.No</th>
                          <th className="py-3 px-4">Village / GP Name</th>
                          <th className="py-3 px-4">Mandal Name</th>
                          <th className="py-3 px-4 text-right">Total Voters</th>
                          <th className="py-3 px-4 text-right">TDP Support</th>
                          <th className="py-3 px-4 text-right">YSRCP Support</th>
                          <th className="py-3 px-4 text-right">Neutral</th>
                          <th className="py-3 px-4 text-right">Lead / Margin</th>
                          <th className="py-3 px-4 text-center">Status</th>
                          <th className="py-3 px-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 bg-[#0B1120]">
                        {paginatedVillages.map((v, idx) => {
                          const statusColors = 
                            v.status === 'WINNING' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
                            v.status === 'TRAILING' ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' :
                            'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';

                          return (
                            <tr key={v.name} className="hover:bg-slate-800/40 font-bold text-slate-200">
                              <td className="py-3 px-4 text-center text-slate-500">{(villagesPage - 1) * villagesPageSize + idx + 1}</td>
                              <td className="py-3 px-4 font-black text-white uppercase">{v.name}</td>
                              <td className="py-3 px-4 uppercase text-slate-400">{v.mandal}</td>
                              <td className="py-3 px-4 text-right text-white font-extrabold text-sm">{v.voters.toLocaleString()}</td>
                              <td className="py-3 px-4 text-right">
                                <span className="text-yellow-400 font-black text-sm">{v.tdp.toLocaleString()}</span>
                                <span className="block text-[10px] text-yellow-400 font-black">({Math.round(v.tdp / v.voters * 100)}%)</span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="text-blue-400 font-black text-sm">{v.ysrcp.toLocaleString()}</span>
                                <span className="block text-[10px] text-blue-400 font-black">({Math.round(v.ysrcp / v.voters * 100)}%)</span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="text-slate-300 font-black text-sm">{v.neutral.toLocaleString()}</span>
                                <span className="block text-[10px] text-slate-500 font-black">({Math.round(v.neutral / v.voters * 100)}%)</span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className={`inline-block font-black text-sm px-2 py-0.5 rounded ${v.leading === 'TDP' ? 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/30' : 'text-blue-400 bg-blue-500/10 border border-blue-500/30'}`}>
                                  {v.leading} +{v.lead.toLocaleString()}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={`px-2.5 py-1 border rounded-full text-[9px] font-black uppercase tracking-wider ${statusColors}`}>
                                  {v.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  onClick={() => setDrilledMandal(v.mandal)}
                                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                                >
                                  View Mandal
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <Pagination
                    currentPage={villagesPage}
                    pageSize={villagesPageSize}
                    totalItems={filteredVillages.length}
                    onPageChange={setVillagesPage}
                    onPageSizeChange={(newSize) => {
                      setVillagesPageSize(newSize);
                      setVillagesPage(1);
                    }}
                    pageSizeOptions={[10, 15, 25, 50]}
                    itemName="villages"
                    accentColor="blue"
                  />
                </div>
              )}
            </div>
          )}

          {/* --------------------------------------------------------
              TAB: HIGH COMMAND TASKS
             -------------------------------------------------------- */}
          {activeTab === 'tasks' && (
            <div className="space-y-6 animate-fade-in" id="const-tasks-tab">
              <div className="bg-[#0F172A]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
                
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400">High Command Tasks</h3>
                  <p className="text-xs text-slate-400">Priority strategic actions assigned to the Constituency Incharge by the Central TDP Office.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 pt-2">
                  {tasksList.map(task => {
                    const priorityColor = 
                      task.priority === 'HIGH PRIORITY' ? 'bg-red-500/20 text-red-400 border-red-500/40' :
                      task.priority === 'MEDIUM PRIORITY' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' :
                      'bg-slate-800 text-slate-300 border-slate-700';

                    const statusColor = 
                      task.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' :
                      task.status === 'IN PROGRESS' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-slate-800 text-slate-400';

                    return (
                      <div 
                        key={task.id} 
                        className="bg-[#0B1120] border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-lg transition-all"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className={`px-2.5 py-0.5 border rounded-full text-[9px] font-black uppercase tracking-widest ${priorityColor}`}>
                              {task.priority}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${statusColor}`}>
                              {task.status}
                            </span>
                          </div>
                          
                          <h4 className="text-sm font-black text-white uppercase tracking-tight">{task.title}</h4>
                          <p className="text-xs text-slate-300 font-medium leading-relaxed">{task.description}</p>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-800 pt-3 mt-1.5">
                          <span className="text-[10px] text-slate-400 font-bold">DUE DATE: {task.dueDate}</span>
                          <button
                            onClick={() => setSelectedTask(task)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 border border-slate-800 text-[10px] font-black rounded-xl uppercase tracking-wider cursor-pointer transition-colors"
                          >
                            Open Details
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* Task Details Modal */}
              {selectedTask && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="bg-[#0F172A] rounded-2xl border border-slate-700 max-w-md w-full p-6 space-y-4 shadow-2xl">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[9px] font-black text-red-400 bg-red-500/20 border border-red-500/30 px-2 py-0.5 rounded-full uppercase tracking-widest">
                          {selectedTask.priority}
                        </span>
                        <h4 className="text-base font-black text-white uppercase mt-1.5">{selectedTask.title}</h4>
                      </div>
                      <button 
                        onClick={() => setSelectedTask(null)}
                        className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-2 border-y border-slate-800 py-3 text-xs leading-relaxed text-slate-300 font-medium">
                      <p>{selectedTask.description}</p>
                      
                      <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-3.5 space-y-2 font-bold mt-3">
                        <p className="text-[10px] text-cyan-400 font-black uppercase">Action Progress Checklist:</p>
                        <div className="flex items-center gap-2 text-slate-200">
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Assign task coordinators in each mandal</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-200">
                          {selectedTask.status === 'COMPLETED' ? (
                            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <span className="w-4 h-4 rounded-full border border-slate-600 shrink-0" />
                          )}
                          <span>Consolidate field visit tracking logs</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-200">
                          <span className="w-4 h-4 rounded-full border border-slate-600 shrink-0" />
                          <span>Submit final audit to Assembly Desk</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold">Due Date: {selectedTask.dueDate}</span>
                      <div className="flex gap-2">
                        {selectedTask.status !== 'COMPLETED' && (
                          <button
                            onClick={() => {
                              setTasksList(prev => prev.map(t => t.id === selectedTask.id ? { ...t, status: 'COMPLETED' } : t));
                              void updateTaskStatus(selectedTask.id, 'COMPLETED').catch(() => {
                              });
                              setSelectedTask(null);
                            }}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black rounded-xl text-[10px] uppercase cursor-pointer shadow-md shadow-cyan-500/20"
                          >
                            Mark Complete
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedTask(null)}
                          className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black rounded-xl text-[10px] uppercase cursor-pointer"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* --------------------------------------------------------
              TAB: CASTE & DEMOGRAPHIC ANALYTICS
             -------------------------------------------------------- */}
          {activeTab === 'caste_analytics' && (() => {
            const activeVotersCount = demoLevel === 'constituency'
              ? constituencyStats.voters
              : demoLevel === 'mandal'
                ? (mandalsData.find(m => m.name === demoMandal)?.voters || 0)
                : (villagesData.find(v => v.name === demoVillage)?.voters || 0);

            const formattedActiveVoters = (activeVotersCount / 1000).toFixed(1) + ' k';

            const maxCasteVoters = Math.max(...demoCasteData.map(c => c.voters), 1);
            const maxProfessionVoters = Math.max(...demoProfessionData.map(p => p.voters), 1);
            const maxAgeVoters = Math.max(...demoAgeData.map(a => a.voters), 1);
            const maxGenderVoters = Math.max(...demoGenderData.map(g => g.voters), 1);

            return (
              <div className="space-y-6 animate-fade-in" id="const-caste-tab">
                {/* HEADER SECTION */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0F172A]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/30 shadow-sm shrink-0">
                      <FileText className="w-5.5 h-5.5" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-white uppercase tracking-tight">Caste & Demographic Analytics</h2>
                      <p className="text-[11px] text-slate-400 font-bold uppercase mt-0.5">
                        Detailed breakdown of {demoLevel === 'constituency' ? 'Constituency' : demoLevel === 'mandal' ? `${demoMandal} Mandal` : `${demoVillage} Village`}: {formattedActiveVoters} Voters
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#0B1120] border border-slate-800 rounded-xl px-4 py-2 text-right shadow-sm shrink-0 min-w-[140px]">
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider">ACTIVE VIEW VOTERS</p>
                    <p className="text-base font-black text-cyan-400 tracking-tight mt-0.5">{formattedActiveVoters}</p>
                  </div>
                </div>

                {/* TABS CONTAINER */}
                <div className="bg-[#0F172A]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
                  <div className="flex flex-wrap border-b border-slate-800 gap-4 sm:gap-8 text-[11px] font-black uppercase tracking-wider pb-px">
                    <button
                      onClick={() => setDemoLevel('constituency')}
                      className={`flex items-center gap-2 pb-3 transition-all cursor-pointer border-b-2 ${
                        demoLevel === 'constituency'
                          ? 'border-cyan-400 text-cyan-400 font-black'
                          : 'border-transparent text-slate-400 hover:text-white'
                      }`}
                    >
                      <Home className={`w-4 h-4 ${demoLevel === 'constituency' ? 'text-cyan-400' : 'text-slate-400'}`} />
                      Constituency Level
                    </button>
                    <button
                      onClick={() => setDemoLevel('mandal')}
                      className={`flex items-center gap-2 pb-3 transition-all cursor-pointer border-b-2 ${
                        demoLevel === 'mandal'
                          ? 'border-cyan-400 text-cyan-400 font-black'
                          : 'border-transparent text-slate-400 hover:text-white'
                      }`}
                    >
                      <Compass className={`w-4 h-4 ${demoLevel === 'mandal' ? 'text-cyan-400' : 'text-slate-400'}`} />
                      Mandal Level Analytics
                    </button>
                    <button
                      onClick={() => setDemoLevel('village')}
                      className={`flex items-center gap-2 pb-3 transition-all cursor-pointer border-b-2 ${
                        demoLevel === 'village'
                          ? 'border-cyan-400 text-cyan-400 font-black'
                          : 'border-transparent text-slate-400 hover:text-white'
                      }`}
                    >
                      <MapPin className={`w-4 h-4 ${demoLevel === 'village' ? 'text-cyan-400' : 'text-slate-400'}`} />
                      Village Level Analytics
                    </button>
                  </div>

                  {/* Granular Drill Down Selectors */}
                  {demoLevel !== 'constituency' && (
                    <div className="flex flex-wrap gap-4 bg-[#0B1120] border border-slate-800 p-4 rounded-xl">
                      <div className="flex flex-col gap-1 shrink-0">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Select Mandal</label>
                        <select 
                          value={demoMandal} 
                          onChange={(e) => {
                            setDemoMandal(e.target.value);
                            // Auto set village to first matching village in list
                            const matching = villagesData.find(v => v.mandal === e.target.value);
                            if (matching) setDemoVillage(matching.name);
                          }}
                          className="bg-[#131E33] border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
                        >
                          {mandalsData.map(m => (
                            <option key={m.name} value={m.name}>{m.name}</option>
                          ))}
                        </select>
                      </div>

                      {demoLevel === 'village' && (
                        <div className="flex flex-col gap-1 shrink-0">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Select Village</label>
                          <select 
                            value={demoVillage} 
                            onChange={(e) => setDemoVillage(e.target.value)}
                            className="bg-[#131E33] border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
                          >
                            {villagesData.filter(v => v.mandal === demoMandal).map(v => (
                              <option key={v.name} value={v.name}>{v.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* THE 4 ANALYTICS CARDS GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  
                  {/* 1. SUB-CASTE ANALYSIS */}
                  <div className="bg-[#0F172A]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-400" />
                          <h3 className="text-xs font-black text-white uppercase tracking-tight">Sub-Caste Analysis</h3>
                        </div>
                        <span className="bg-slate-900 border border-slate-800 text-cyan-400 font-mono text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                          N={formattedActiveVoters}
                        </span>
                      </div>

                      {/* Chart Container */}
                      <div className="relative pt-1">
                        {/* Gridlines Background */}
                        <div className="absolute inset-y-0 left-[120px] right-0 flex justify-between pointer-events-none pl-3 pr-1">
                          <div className="w-px h-full border-l border-dashed border-slate-800"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-800/80"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-800/80"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-800/80"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-800/80"></div>
                        </div>

                        {/* Bar Rows */}
                        <div className="relative space-y-3.5 z-10">
                          {demoCasteData.map((item, idx) => {
                            const barWidthPercent = (item.voters / maxCasteVoters) * 100;
                            const formattedVoters = (item.voters / 1000).toFixed(1) + ' k';
                            return (
                              <div key={idx} className="flex items-center min-h-[22px]">
                                {/* Label */}
                                <div className="w-[120px] text-right pr-3 text-[10px] font-bold text-slate-400 truncate uppercase">
                                  {item.name} ({formattedVoters})
                                </div>
                                {/* Axis Line */}
                                <div className="w-px h-5.5 bg-slate-700 self-stretch"></div>
                                {/* Bar Area */}
                                <div className="flex-1 pl-3 flex items-center">
                                  <div 
                                    className="h-3.5 flex rounded-sm overflow-hidden hover:opacity-90 transition-opacity w-full"
                                    style={{ width: `${barWidthPercent}%`, maxWidth: '100%' }}
                                    title={`${item.name}\nTotal: ${item.voters.toLocaleString()} Voters\n• TDP: ${item.tdpPref}%\n• YSRCP: ${item.ysrcpPref}%\n• Neutral: ${item.neutralPref}%`}
                                  >
                                    {item.tdpPref > 0 && (
                                      <div className="h-full bg-yellow-400 border-r border-yellow-500/20" style={{ width: `${item.tdpPref}%` }} />
                                    )}
                                    {item.ysrcpPref > 0 && (
                                      <div className="h-full bg-blue-600 border-r border-blue-700/20" style={{ width: `${item.ysrcpPref}%` }} />
                                    )}
                                    {item.neutralPref > 0 && (
                                      <div className="h-full bg-slate-500" style={{ width: `${item.neutralPref}%` }} />
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="flex justify-center gap-5 pt-3.5 border-t border-slate-800 text-[9px] font-black uppercase tracking-wider text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-yellow-400 rounded-sm"></div>
                        <span>TDP Support</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-blue-600 rounded-sm"></div>
                        <span>YSRCP Support</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-slate-500 rounded-sm"></div>
                        <span>Neutral</span>
                      </div>
                    </div>
                  </div>

                  {/* 2. PROFESSION ANALYSIS */}
                  <div className="bg-[#0F172A]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-slate-400" />
                          <h3 className="text-xs font-black text-white uppercase tracking-tight">Profession Analysis</h3>
                        </div>
                        <span className="bg-slate-900 border border-slate-800 text-cyan-400 font-mono text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                          N={formattedActiveVoters}
                        </span>
                      </div>

                      {/* Chart Container */}
                      <div className="relative pt-1">
                        {/* Gridlines Background */}
                        <div className="absolute inset-y-0 left-[140px] right-0 flex justify-between pointer-events-none pl-3 pr-1">
                          <div className="w-px h-full border-l border-dashed border-slate-800"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-800/80"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-800/80"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-800/80"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-800/80"></div>
                        </div>

                        {/* Bar Rows */}
                        <div className="relative space-y-3.5 z-10">
                          {demoProfessionData.map((item, idx) => {
                            const barWidthPercent = (item.voters / maxProfessionVoters) * 100;
                            const formattedVoters = (item.voters / 1000).toFixed(1) + ' k';
                            return (
                              <div key={idx} className="flex items-center min-h-[22px]">
                                {/* Label */}
                                <div className="w-[140px] text-right pr-3 text-[10px] font-bold text-slate-400 truncate uppercase">
                                  {item.name.replace("Farmers / Agri Workers", "Farmer").replace("Private Employee", "Private Job").replace("Homemakers", "Homemaker").replace("Students / Youth", "Student").replace("Business Owners", "Business")} ({formattedVoters})
                                </div>
                                {/* Axis Line */}
                                <div className="w-px h-5.5 bg-slate-700 self-stretch"></div>
                                {/* Bar Area */}
                                <div className="flex-1 pl-3 flex items-center">
                                  <div 
                                    className="h-3.5 flex rounded-sm overflow-hidden hover:opacity-90 transition-opacity w-full"
                                    style={{ width: `${barWidthPercent}%`, maxWidth: '100%' }}
                                    title={`${item.name}\nTotal: ${item.voters.toLocaleString()} Voters\n• TDP: ${item.tdpPref}%\n• YSRCP: ${item.ysrcpPref}%\n• Neutral: ${item.neutralPref}%`}
                                  >
                                    {item.tdpPref > 0 && (
                                      <div className="h-full bg-yellow-400 border-r border-yellow-500/20" style={{ width: `${item.tdpPref}%` }} />
                                    )}
                                    {item.ysrcpPref > 0 && (
                                      <div className="h-full bg-blue-600 border-r border-blue-700/20" style={{ width: `${item.ysrcpPref}%` }} />
                                    )}
                                    {item.neutralPref > 0 && (
                                      <div className="h-full bg-slate-500" style={{ width: `${item.neutralPref}%` }} />
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="flex justify-center gap-5 pt-3.5 border-t border-slate-800 text-[9px] font-black uppercase tracking-wider text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-yellow-400 rounded-sm"></div>
                        <span>TDP Support</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-blue-600 rounded-sm"></div>
                        <span>YSRCP Support</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-slate-500 rounded-sm"></div>
                        <span>Neutral</span>
                      </div>
                    </div>
                  </div>

                  {/* 3. AGE GROUP ANALYSIS */}
                  <div className="bg-[#0F172A]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <h3 className="text-xs font-black text-white uppercase tracking-tight">Age Group Analysis</h3>
                        </div>
                        <span className="bg-slate-900 border border-slate-800 text-cyan-400 font-mono text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                          N={formattedActiveVoters}
                        </span>
                      </div>

                      {/* Chart Container */}
                      <div className="relative pt-1">
                        {/* Gridlines Background */}
                        <div className="absolute inset-y-0 left-[120px] right-0 flex justify-between pointer-events-none pl-3 pr-1">
                          <div className="w-px h-full border-l border-dashed border-slate-800"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-800/80"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-800/80"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-800/80"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-800/80"></div>
                        </div>

                        {/* Bar Rows */}
                        <div className="relative space-y-3.5 z-10">
                          {demoAgeData.map((item, idx) => {
                            const barWidthPercent = (item.voters / maxAgeVoters) * 100;
                            const formattedVoters = (item.voters / 1000).toFixed(1) + ' k';
                            return (
                              <div key={idx} className="flex items-center min-h-[22px]">
                                {/* Label */}
                                <div className="w-[120px] text-right pr-3 text-[10px] font-bold text-slate-400 truncate uppercase">
                                  {item.group.replace(" (Youth)", "").replace(" (Middle)", "").replace(" (Senior)", "").replace(" (Elders)", "")} ({formattedVoters})
                                </div>
                                {/* Axis Line */}
                                <div className="w-px h-5.5 bg-slate-700 self-stretch"></div>
                                {/* Bar Area */}
                                <div className="flex-1 pl-3 flex items-center">
                                  <div 
                                    className="h-3.5 flex rounded-sm overflow-hidden hover:opacity-90 transition-opacity w-full"
                                    style={{ width: `${barWidthPercent}%`, maxWidth: '100%' }}
                                    title={`${item.group}\nTotal: ${item.voters.toLocaleString()} Voters\n• TDP: ${item.tdpPref}%\n• YSRCP: ${item.ysrcpPref}%\n• Neutral: ${item.neutralPref}%`}
                                  >
                                    {item.tdpPref > 0 && (
                                      <div className="h-full bg-yellow-400 border-r border-yellow-500/20" style={{ width: `${item.tdpPref}%` }} />
                                    )}
                                    {item.ysrcpPref > 0 && (
                                      <div className="h-full bg-blue-600 border-r border-blue-700/20" style={{ width: `${item.ysrcpPref}%` }} />
                                    )}
                                    {item.neutralPref > 0 && (
                                      <div className="h-full bg-slate-500" style={{ width: `${item.neutralPref}%` }} />
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="flex justify-center gap-5 pt-3.5 border-t border-slate-800 text-[9px] font-black uppercase tracking-wider text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-yellow-400 rounded-sm"></div>
                        <span>TDP Support</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-blue-600 rounded-sm"></div>
                        <span>YSRCP Support</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-slate-500 rounded-sm"></div>
                        <span>Neutral</span>
                      </div>
                    </div>
                  </div>

                  {/* 4. GENDER ANALYSIS */}
                  <div className="bg-[#0F172A]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <h3 className="text-xs font-black text-white uppercase tracking-tight">Gender Analysis</h3>
                        </div>
                        <span className="bg-slate-900 border border-slate-800 text-cyan-400 font-mono text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                          N={formattedActiveVoters}
                        </span>
                      </div>

                      {/* Chart Container */}
                      <div className="relative pt-1">
                        {/* Gridlines Background */}
                        <div className="absolute inset-y-0 left-[120px] right-0 flex justify-between pointer-events-none pl-3 pr-1">
                          <div className="w-px h-full border-l border-dashed border-slate-800"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-800/80"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-800/80"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-800/80"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-800/80"></div>
                        </div>

                        {/* Bar Rows */}
                        <div className="relative space-y-3.5 z-10">
                          {demoGenderData.map((item, idx) => {
                            const barWidthPercent = (item.voters / maxGenderVoters) * 100;
                            const formattedVoters = (item.voters / 1000).toFixed(1) + ' k';
                            return (
                              <div key={idx} className="flex items-center min-h-[22px]">
                                {/* Label */}
                                <div className="w-[120px] text-right pr-3 text-[10px] font-bold text-slate-400 truncate uppercase">
                                  {item.name} ({formattedVoters})
                                </div>
                                {/* Axis Line */}
                                <div className="w-px h-5.5 bg-slate-700 self-stretch"></div>
                                {/* Bar Area */}
                                <div className="flex-1 pl-3 flex items-center">
                                  <div 
                                    className="h-3.5 flex rounded-sm overflow-hidden hover:opacity-90 transition-opacity w-full"
                                    style={{ width: `${barWidthPercent}%`, maxWidth: '100%' }}
                                    title={`${item.name}\nTotal: ${item.voters.toLocaleString()} Voters\n• TDP: ${item.tdpPref}%\n• YSRCP: ${item.ysrcpPref}%\n• Neutral: ${item.neutralPref}%`}
                                  >
                                    {item.tdpPref > 0 && (
                                      <div className="h-full bg-yellow-400 border-r border-yellow-500/20" style={{ width: `${item.tdpPref}%` }} />
                                    )}
                                    {item.ysrcpPref > 0 && (
                                      <div className="h-full bg-blue-600 border-r border-blue-700/20" style={{ width: `${item.ysrcpPref}%` }} />
                                    )}
                                    {item.neutralPref > 0 && (
                                      <div className="h-full bg-slate-500" style={{ width: `${item.neutralPref}%` }} />
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="flex justify-center gap-5 pt-3.5 border-t border-slate-800 text-[9px] font-black uppercase tracking-wider text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-yellow-400 rounded-sm"></div>
                        <span>TDP Support</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-blue-600 rounded-sm"></div>
                        <span>YSRCP Support</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-slate-500 rounded-sm"></div>
                        <span>Neutral</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            );
          })()}

          {/* --------------------------------------------------------
              TAB: CADRE NETWORK
             -------------------------------------------------------- */}
          {activeTab === 'cadre_network' && (
            <div className="space-y-6 animate-fade-in" id="const-cadre-tab">
              
              {/* Core Strengths */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                {[
                  { title: 'Constituency', count: 1, color: 'text-cyan-400 border-slate-800 hover:border-cyan-500/40' },
                  { title: 'Mandals Covered', count: liveConstituencyStats.totalMandals, color: 'text-white border-slate-800 hover:border-cyan-500/40' },
                  { title: 'Villages Covered', count: cadreStats.villages || liveConstituencyStats.totalVillages, color: 'text-sky-400 border-slate-800 hover:border-sky-500/40' },
                  { title: 'Booths Covered', count: cadreStats.booths || liveConstituencyStats.totalBooths, color: 'text-purple-400 border-slate-800 hover:border-purple-500/40' },
                  { title: '100-Voter Incharges', count: cadreStats.voterIncharges, color: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10' }
                ].map(card => (
                  <div key={card.title} className={`bg-[#0F172A]/90 backdrop-blur-xl ${card.color} border rounded-2xl p-4 shadow-xl text-center flex flex-col justify-between transition-all`}>
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">{card.title}</span>
                    <span className="text-2xl font-black mt-1 block tracking-tight">{card.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Strength & Health Report */}
              <div className="bg-[#0F172A]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400">Network Strength & Health Report</h3>
                  <p className="text-xs text-slate-400">Verification counts, active member ratios, and directory of working leaders.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                  {/* Performance Indicators */}
                  <div className="bg-[#0B1120] border border-slate-800 rounded-2xl p-4 space-y-3.5 flex flex-col justify-center">
                    <div className="flex justify-between items-center text-xs font-bold border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Active Members:</span>
                      <span className="text-emerald-400 font-black text-sm">{cadreStats.activeMembers} ({cadreStats.totalCadres > 0 ? ((cadreStats.activeMembers / cadreStats.totalCadres) * 100).toFixed(1) : '0.0'}%)</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Inactive Members:</span>
                      <span className="text-rose-400 font-black text-sm">{cadreStats.inactiveMembers} ({cadreStats.totalCadres > 0 ? ((cadreStats.inactiveMembers / cadreStats.totalCadres) * 100).toFixed(1) : '0.0'}%)</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold pb-1">
                      <span className="text-slate-400">Network Coverage:</span>
                      <span className="text-emerald-400 font-black text-sm bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">{liveConstituencyStats.totalBooths > 0 && cadreStats.booths > 0 ? Math.round((cadreStats.booths / liveConstituencyStats.totalBooths) * 100) : 0}% of Booths</span>
                    </div>
                  </div>

                  {/* Interactive Cadre Drill-Down selectors */}
                  <div className="md:col-span-2 space-y-4">
                    <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <h4 className="text-[11px] font-black text-white uppercase">Interactive Cadre Directory</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase">Mandal</label>
                        <select 
                          value={cadreSelectMandal}
                          onChange={(e) => setCadreSelectMandal(e.target.value)}
                          className="w-full bg-[#0B1120] border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-cyan-400"
                        >
                          <option value="Singarayakonda">Singarayakonda</option>
                          <option value="Kondapi">Kondapi</option>
                          <option value="Tangutur">Tangutur</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase">Village</label>
                        <select 
                          value={cadreSelectVillage}
                          onChange={(e) => setCadreSelectVillage(e.target.value)}
                          className="w-full bg-[#0B1120] border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-cyan-400"
                        >
                          {villagesData.filter(v => v.mandal === cadreSelectMandal).map(v => (
                            <option key={v.name} value={v.name}>{v.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase">Booth ID</label>
                        <select 
                          value={cadreSelectBooth}
                          onChange={(e) => setCadreSelectBooth(e.target.value)}
                          className="w-full bg-[#0B1120] border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-cyan-400"
                        >
                          {cadreBoothOptions.map((booth) => (
                            <option key={booth} value={booth}>{booth}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Hierarchy Flow Chart List */}
                    <div className="space-y-3.5 bg-[#0B1120] border border-slate-800 rounded-2xl p-4 text-xs font-bold">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-cyan-400 text-slate-950 text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm">M</span>
                        <div>
                          <p className="text-[9px] text-slate-400 font-black uppercase">Mandal President</p>
                          <p className="text-white font-extrabold">{derivedCadreDirectory.mandalIncharge?.name || 'Unavailable'} ({derivedCadreDirectory.mandalIncharge?.mobileNumber || 'N/A'})</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-slate-800 text-white text-[10px] font-black flex items-center justify-center shrink-0 border border-slate-700">V</span>
                        <div>
                          <p className="text-[9px] text-slate-400 font-black uppercase">Village Coordinator</p>
                          <p className="text-white font-extrabold">{derivedCadreDirectory.villageIncharge?.name || 'Unavailable'} ({derivedCadreDirectory.villageIncharge?.mobileNumber || 'N/A'})</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-400 text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm">B</span>
                        <div>
                          <p className="text-[9px] text-slate-400 font-black uppercase">Booth Incharge ({derivedCadreDirectory.boothIncharge?.unitName || cadreSelectBooth})</p>
                          <p className="text-white font-extrabold">{derivedCadreDirectory.boothIncharge?.name || 'Unavailable'} ({derivedCadreDirectory.boothIncharge?.mobileNumber || 'N/A'})</p>
                        </div>
                      </div>

                      <div className="border-t border-slate-800 pt-2.5">
                        <p className="text-[9px] text-slate-400 font-black uppercase mb-1.5">100-Voter Ground Incharges assigned to this booth:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          {derivedCadreDirectory.voter100List.map((item, idx) => (
                            <div key={idx} className="bg-[#131E33] border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
                              <div>
                                <p className="text-white font-extrabold uppercase text-[10px]">{item.name}</p>
                                <p className="text-[9px] text-slate-400 font-mono mt-0.5">{item.mobile}</p>
                              </div>
                              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-md font-black">{item.votersCount} Voters</span>
                            </div>
                          ))}
                          {derivedCadreDirectory.voter100List.length === 0 && (
                            <div className="bg-[#131E33] border border-slate-800 rounded-xl p-2.5 text-slate-400 font-semibold col-span-full">
                              No backend-assigned 100-voter incharges found for this booth yet.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* --------------------------------------------------------
              TAB: FAKE VOTES
             -------------------------------------------------------- */}
          {activeTab === 'fake_votes' && (
            <div className="space-y-6 animate-fade-in" id="const-fake-tab">
              <div className="bg-[#0F172A]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
                
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400">Identified / Flagged Voter Records</h3>
                  <p className="text-xs text-slate-400">Monitor and audit potential duplicates, shifted residences, or address discrepancies undergoing investigation.</p>
                </div>

                {/* Filter and Search controls */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search Name / EPIC / Booth / Village..." 
                      value={fakeSearch}
                      onChange={(e) => setFakeSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-[#0B1120] border border-slate-700/80 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  {/* Filter pills */}
                  <div className="flex gap-2 flex-wrap">
                    {['ALL', 'FLAGGED', 'UNDER VERIFICATION', 'VERIFIED ISSUE', 'RESOLVED'].map(tab => (
                      <button
                        key={tab}
                        onClick={() => setFakeFilterStatus(tab)}
                        className={`
                          px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase transition-all cursor-pointer border
                          ${fakeFilterStatus === tab 
                            ? 'bg-gradient-to-r from-blue-600 to-cyan-500 border-cyan-400 text-white font-black shadow-md shadow-cyan-500/20' 
                            : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800 text-slate-300'
                          }
                        `}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* View Switcher */}
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[11px] font-bold text-slate-400">
                    Flagged Records: <span className="text-cyan-400 font-mono font-black">{flaggedTotal}</span>
                  </span>
                  <div className="flex items-center gap-1 bg-[#121522] border border-white/[0.08] p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFakeViewMode('cards')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        fakeViewMode === 'cards' ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      📱 Cards
                    </button>
                    <button
                      type="button"
                      onClick={() => setFakeViewMode('table')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        fakeViewMode === 'table' ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      📄 Table
                    </button>
                  </div>
                </div>

                {/* Flagged Cards or Table */}
                {fakeViewMode === 'cards' ? (
                  <div className="space-y-3">
                    {paginatedFlaggedVoters.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 font-medium border border-dashed border-slate-800 rounded-2xl bg-[#0B1120]/40">
                        No flagged or doubtful voters found in records.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {paginatedFlaggedVoters.map((item) => {
                          const statusColors = 
                            item.status === 'RESOLVED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            item.status === 'VERIFIED ISSUE' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                            item.status === 'UNDER VERIFICATION' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                            'bg-slate-800 text-slate-300 border border-slate-700';

                          return (
                            <div 
                              key={item.sNo}
                              className="bg-[#0D0F18]/95 border border-red-500/20 hover:border-red-500/50 rounded-2xl p-4 space-y-3 transition shadow-md flex flex-col justify-between"
                            >
                              <div className="space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="font-black text-sm text-white uppercase tracking-tight">{item.name}</div>
                                    <span className="text-[10px] text-cyan-400 font-mono font-black">
                                      EPIC: {item.epic}
                                    </span>
                                  </div>
                                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${statusColors}`}>
                                    {item.status}
                                  </span>
                                </div>

                                <div className="p-2.5 bg-red-950/20 border border-red-900/30 rounded-xl space-y-1">
                                  <span className="text-[9px] font-black uppercase tracking-wider text-rose-400 block">Flag Reason:</span>
                                  <p className="text-xs font-semibold text-rose-200">{item.reason}</p>
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono border-t border-white/[0.08] pt-2">
                                  <span>📍 {item.village} • {item.booth}</span>
                                  <span className="text-slate-300 font-bold">{item.age} yrs • {item.gender}</span>
                                </div>
                              </div>

                              <button
                                onClick={() => setAuditingVoter(item)}
                                className="w-full py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow-md shadow-cyan-500/20 active:scale-95 transition"
                              >
                                Audit / Verify Status &rarr;
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0B1120]">
                    <table className="w-full min-w-[700px] text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#131E33] border-b border-slate-800 text-slate-300 font-black uppercase text-[9px] tracking-wider">
                          <th className="py-3 px-4 text-center">S.No</th>
                          <th className="py-3 px-4">Voter Name</th>
                          <th className="py-3 px-4 font-mono">EPIC</th>
                          <th className="py-3 px-4 text-center">Age / Sex</th>
                          <th className="py-3 px-4">Village</th>
                          <th className="py-3 px-4">Booth</th>
                          <th className="py-3 px-4">Reason Flagged</th>
                          <th className="py-3 px-4 text-center">Verification Status</th>
                          <th className="py-3 px-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {paginatedFlaggedVoters.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                              No flagged or doubtful voters found in records.
                            </td>
                          </tr>
                        ) : paginatedFlaggedVoters.map((item, idx) => {
                          const statusColors = 
                            item.status === 'RESOLVED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            item.status === 'VERIFIED ISSUE' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                            item.status === 'UNDER VERIFICATION' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                            'bg-slate-800 text-slate-300 border border-slate-700';

                          return (
                            <tr key={item.sNo} className="hover:bg-slate-800/40 font-bold text-slate-200">
                              <td className="py-3 px-4 text-center text-slate-500">{(flaggedPage - 1) * flaggedPageSize + idx + 1}</td>
                              <td className="py-3 px-4 font-black text-white uppercase">{item.name}</td>
                              <td className="py-3 px-4 font-mono text-cyan-400">{item.epic}</td>
                              <td className="py-3 px-4 text-center text-slate-300">{item.age} / {item.gender[0]}</td>
                              <td className="py-3 px-4 uppercase text-white">{item.village}</td>
                              <td className="py-3 px-4 uppercase text-slate-400">{item.booth}</td>
                              <td className="py-3 px-4 text-slate-300">{item.reason}</td>
                              <td className="py-3 px-4 text-center">
                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${statusColors}`}>
                                  {item.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  onClick={() => setAuditingVoter(item)}
                                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                                >
                                  Audit/Verify
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <Pagination
                  currentPage={flaggedPage}
                  pageSize={flaggedPageSize}
                  totalItems={flaggedTotal}
                  onPageChange={setFlaggedPage}
                  onPageSizeChange={(newSize) => {
                    setFlaggedPageSize(newSize);
                    setFlaggedPage(1);
                  }}
                  pageSizeOptions={[10, 15, 25, 50]}
                  itemName="flagged voters"
                  accentColor="blue"
                />

              </div>

              {/* Audit/Verification Status Update Modal */}
              {auditingVoter && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                  <form onSubmit={handleUpdateVoterStatus} className="bg-[#0F172A] rounded-2xl border border-slate-700 max-w-md w-full p-6 space-y-4 shadow-2xl">
                    <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                      <div>
                        <h4 className="text-base font-black text-white uppercase">Update Verification Status</h4>
                        <p className="text-[10px] text-cyan-400 font-semibold mt-0.5">Voter EPIC: {auditingVoter.epic}</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setAuditingVoter(null)}
                        className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-4 text-xs font-bold text-slate-200">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase">Voter Profile:</p>
                        <p className="text-white text-sm font-black mt-0.5">{auditingVoter.name} ({auditingVoter.age} / {auditingVoter.gender})</p>
                        <p className="text-slate-400 text-[11px] uppercase mt-0.5">Location: {auditingVoter.village} &bull; {auditingVoter.booth}</p>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-slate-400 uppercase">Verification Reason Flagged</label>
                        <input 
                          type="text" 
                          value={auditingVoter.reason}
                          onChange={(e) => setAuditingVoter({ ...auditingVoter, reason: e.target.value })}
                          className="w-full bg-[#0B1120] border border-slate-700 rounded-xl p-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-slate-400 uppercase">Audit Status Decision</label>
                        <select
                          value={auditingVoter.status}
                          onChange={(e) => setAuditingVoter({ ...auditingVoter, status: e.target.value as any })}
                          className="w-full bg-[#0B1120] border border-slate-700 rounded-xl p-2 text-white font-extrabold focus:outline-none focus:border-cyan-400"
                        >
                          <option value="FLAGGED">FLAGGED (NOT VERIFIED)</option>
                          <option value="UNDER VERIFICATION">UNDER VERIFICATION</option>
                          <option value="VERIFIED ISSUE">VERIFIED ISSUE</option>
                          <option value="RESOLVED">RESOLVED / VERIFIED OK</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setAuditingVoter(null)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black rounded-xl text-[10px] uppercase cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black rounded-xl text-[10px] uppercase cursor-pointer shadow-md shadow-cyan-500/20"
                      >
                        Save Decision
                      </button>
                    </div>
                  </form>
                </div>
              )}

            </div>
          )}

          {/* --------------------------------------------------------
              TAB: STRATEGIC INTELLIGENCE CENTER
             -------------------------------------------------------- */}
          {activeTab === 'strategic_intelligence' && (
            <AIStrategicIntelligenceCenter
              mandalsData={mandalsData}
              villagesData={villagesData}
              constituencyStats={constituencyStats}
              flaggedVoters={flaggedVoters}
              tasksList={tasksList}
            />
          )}

          {/* --------------------------------------------------------
              TAB: TRAINING ANALYTICS
             -------------------------------------------------------- */}
          {activeTab === 'training_analytics' && (
            <div className="space-y-6 animate-fade-in" id="const-training-tab">
              <div className="bg-[#0F172A]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
                
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400">Training Completion Analytics</h3>
                  <p className="text-xs text-slate-400">Track and assess completion statistics of crucial operational modules across all cadre network layers.</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {[
                    { title: 'Total Cadre', count: trainingStats.totalCadres, stat: '100%', bg: 'bg-[#0B1120] border-slate-800', countColor: 'text-white text-2xl', badgeColor: 'bg-slate-900 border border-slate-800 text-slate-300' },
                    { title: 'Fully Trained', count: trainingStats.completed, stat: `${trainingStats.totalCadres > 0 ? ((trainingStats.completed / trainingStats.totalCadres) * 100).toFixed(1) : '0.0'}%`, bg: 'bg-emerald-500/10 border-emerald-500/30', countColor: 'text-emerald-400 text-2xl', badgeColor: 'bg-emerald-500/20 text-emerald-300' },
                    { title: 'In Progress', count: trainingStats.watched + trainingStats.assigned, stat: `${trainingStats.totalCadres > 0 ? (((trainingStats.watched + trainingStats.assigned) / trainingStats.totalCadres) * 100).toFixed(1) : '0.0'}%`, bg: 'bg-cyan-500/10 border-cyan-500/30', countColor: 'text-cyan-400 text-2xl', badgeColor: 'bg-cyan-500/20 text-cyan-300' },
                    { title: 'Not Started', count: trainingStats.notStarted, stat: `${trainingStats.totalCadres > 0 ? ((trainingStats.notStarted / trainingStats.totalCadres) * 100).toFixed(1) : '0.0'}%`, bg: 'bg-rose-500/10 border-rose-500/30', countColor: 'text-rose-400 text-2xl', badgeColor: 'bg-rose-500/20 text-rose-300' }
                  ].map(stat => (
                    <div key={stat.title} className={`${stat.bg} border rounded-2xl p-4 text-center flex flex-col justify-between space-y-1 shadow-md`}>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">{stat.title}</span>
                      <span className={`${stat.countColor} font-black mt-1 block tracking-tight`}>{stat.count}</span>
                      <span className={`text-[11px] font-mono font-black mt-1 inline-block mx-auto px-2 py-0.5 rounded-full ${stat.badgeColor}`}>{stat.stat}</span>
                    </div>
                  ))}
                </div>

                {/* Progress breakdown of modules */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-3 border-t border-slate-800 text-xs font-bold text-slate-300">
                  <div className="space-y-4 bg-[#0B1120] border border-slate-800 rounded-2xl p-5">
                    <h4 className="text-[11px] font-black text-white uppercase mb-2">Campaign Operational Modules Progress</h4>
                    
                    {(() => {
                      const moduleMap = new Map<string, { total: number; completed: number }>();
                      trainingProgressItems.forEach((item) => {
                        const title = item.video?.title || 'Operational Module';
                        const cur = moduleMap.get(title) || { total: 0, completed: 0 };
                        cur.total += 1;
                        if (item.status === 'COMPLETED') cur.completed += 1;
                        moduleMap.set(title, cur);
                      });

                      if (moduleMap.size === 0) {
                        return (
                          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl text-center text-slate-400 text-xs">
                            <p className="font-bold text-slate-300">0 Course Modules Recorded</p>
                            <p className="text-[11px] text-slate-500 mt-1">Live progress will appear here as cadre members complete their training videos.</p>
                          </div>
                        );
                      }

                      return Array.from(moduleMap.entries()).map(([module, stats]) => {
                        const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
                        return (
                          <div key={module} className="space-y-1">
                            <div className="flex justify-between">
                              <span className="truncate max-w-[200px] text-slate-300" title={module}>{module}</span>
                              <span className="text-cyan-400 font-extrabold">{pct}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  <div className="bg-[#0B1120] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-3">
                    <h5 className="text-[11px] font-black text-white uppercase border-b border-slate-800 pb-1.5">Cadre Layer Performance</h5>
                    
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Mandal Incharges Trained:</span>
                        <span className="text-white font-extrabold">{cadreItems.filter((item) => item.role === 'MANDAL_INCHARGE').length > 0 ? `${cadreItems.filter((item) => item.role === 'MANDAL_INCHARGE' && item.completedTraining > 0).length}/${cadreItems.filter((item) => item.role === 'MANDAL_INCHARGE').length}` : '0/0'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Village Incharges Trained:</span>
                        <span className="text-white font-extrabold">{cadreItems.filter((item) => item.role === 'VILLAGE_INCHARGE').length > 0 ? `${cadreItems.filter((item) => item.role === 'VILLAGE_INCHARGE' && item.completedTraining > 0).length}/${cadreItems.filter((item) => item.role === 'VILLAGE_INCHARGE').length}` : '0/0'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Booth Incharges Trained:</span>
                        <span className="text-white font-extrabold">{cadreItems.filter((item) => item.role === 'BOOTH_PRESIDENT').length > 0 ? `${cadreItems.filter((item) => item.role === 'BOOTH_PRESIDENT' && item.completedTraining > 0).length}/${cadreItems.filter((item) => item.role === 'BOOTH_PRESIDENT').length}` : '0/0'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">100-Voter Leaders Trained:</span>
                        <span className="text-white font-extrabold">{cadreItems.filter((item) => item.role === 'VOTER_100_INCHARGE').length > 0 ? `${cadreItems.filter((item) => item.role === 'VOTER_100_INCHARGE' && item.completedTraining > 0).length}/${cadreItems.filter((item) => item.role === 'VOTER_100_INCHARGE').length}` : '0/0'}</span>
                      </div>
                    </div>

                    <div className="bg-[#131E33] border border-slate-800 rounded-xl p-3 text-[10px] text-slate-400 leading-relaxed font-semibold">
                      <span className="text-cyan-400 uppercase font-black block mb-0.5">Campaign Coordinator Note:</span>
                      Continuous review classes are conducted weekly for new booth workers to ensure 100% procedural consistency on election day.
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* --------------------------------------------------------
              TAB: LIVE VOTER TRACKING
             -------------------------------------------------------- */}
          {activeTab === 'live_voter_tracking' && (() => {
            const totalAssigned = liveTurnoutSummary?.totalAssigned ?? 0;
            const totalVotesPolled = liveTurnoutSummary?.totalVotesPolled ?? 0;
            const pendingVotes = liveTurnoutSummary?.pendingVotes ?? 0;
            const partyAggregates = liveTurnoutSummary?.partyAggregates ?? { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Others: 0 };
            const liveMandalStats = liveTurnoutSummary?.mandalStats ?? [];
            const pollingReports = liveTurnoutSummary?.pollingReports ?? [];

            return (
              <div className="space-y-6 animate-fade-in" id="const-live-voter-tracking-tab">
                {/* Header card with simulation controls */}
                <div className="bg-[#0F172A]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400">Live Voter Turnout Tracking</h3>
                      <p className="text-xs text-slate-400">Track real-time verified voting speed, queue sizes, and polling station aggregate reports submitted by authorized field agents.</p>
                    </div>
                    
                    {/* Simulation toggle button */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => { void refreshLiveTurnoutSummary(); }}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border cursor-pointer ${
                          isRefreshingLiveTurnout
                            ? 'bg-cyan-500 border-cyan-500 text-slate-950 font-black animate-pulse'
                            : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black border-cyan-400 shadow-md shadow-cyan-500/20'
                        }`}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingLiveTurnout ? 'animate-spin' : ''}`} />
                        {isRefreshingLiveTurnout ? 'Refreshing Stream' : 'Refresh Live Stream'}
                      </button>
                    </div>
                  </div>

                  {/* Flow View: Total Assigned → Total Polled → Party-wise Aggregate Count → Pending */}
                  <div className="space-y-3">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Aggregate Polling Flow</span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-7 gap-3 sm:gap-4 items-center">
                      
                      {/* Step 1: Total Assigned */}
                      <div className="md:col-span-2 bg-[#0B1120] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-slate-500"></div>
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Total Voters Assigned</span>
                        <span className="text-2xl font-black text-white mt-1">
                          {totalAssigned.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                          100% of Constituency
                        </span>
                      </div>

                      {/* Flow Arrow */}
                      <div className="hidden md:flex justify-center text-slate-600">
                        <ChevronRight className="w-5 h-5 animate-pulse text-cyan-400" />
                      </div>

                      {/* Step 2: Total Polled */}
                      <div className="md:col-span-2 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400"></div>
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Total Votes Polled</span>
                        <span className="text-2xl font-black text-emerald-400 mt-1">
                          {totalVotesPolled.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-black uppercase mt-1">
                          {totalAssigned > 0 ? ((totalVotesPolled / totalAssigned) * 100).toFixed(2) : '0.00'}% Turnout Rate
                        </span>
                      </div>

                      {/* Flow Arrow */}
                      <div className="hidden md:flex justify-center text-slate-600">
                        <ChevronRight className="w-5 h-5 animate-pulse text-cyan-400" />
                      </div>

                      {/* Step 3: Pending */}
                      <div className="md:col-span-2 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400"></div>
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Pending / Not Yet Updated</span>
                        <span className="text-2xl font-black text-cyan-400 mt-1">
                          {pendingVotes.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-cyan-400 font-black uppercase mt-1">
                          {totalAssigned > 0 ? ((pendingVotes / totalAssigned) * 100).toFixed(2) : '0.00'}% Outstanding
                        </span>
                      </div>

                    </div>
                  </div>
                </div>

                {/* Party-wise Aggregate Count (Polled Vote Share) */}
                <div className="bg-[#0F172A]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
                  <div className="border-b border-slate-800 pb-3">
                    <h4 className="text-xs font-black text-white uppercase tracking-tight">Party-wise Aggregate Count</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Calculated dynamically from real-time field-level aggregate updates. Strictly confidential and secure, no individual preferences are stored.</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {/* TDP */}
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-3.5 space-y-2 relative overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 border border-yellow-500" />
                        <span className="text-[10px] text-slate-300 font-extrabold uppercase tracking-wide">TDP (Our Party)</span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xl font-black text-white">{partyAggregates.TDP.toLocaleString()}</p>
                        <p className="text-[10px] text-yellow-400 font-extrabold">{totalVotesPolled > 0 ? ((partyAggregates.TDP / totalVotesPolled) * 100).toFixed(1) : '0.0'}% Share</p>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${totalVotesPolled > 0 ? (partyAggregates.TDP / totalVotesPolled) * 100 : 0}%` }} />
                      </div>
                    </div>

                    {/* YSRCP */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-3.5 space-y-2 relative overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-blue-600" />
                        <span className="text-[10px] text-slate-300 font-extrabold uppercase tracking-wide">YSRCP</span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xl font-black text-white">{partyAggregates.YSRCP.toLocaleString()}</p>
                        <p className="text-[10px] text-blue-400 font-extrabold">{totalVotesPolled > 0 ? ((partyAggregates.YSRCP / totalVotesPolled) * 100).toFixed(1) : '0.0'}% Share</p>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${totalVotesPolled > 0 ? (partyAggregates.YSRCP / totalVotesPolled) * 100 : 0}%` }} />
                      </div>
                    </div>

                    {/* JSP */}
                    <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3.5 space-y-2 relative overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-rose-600" />
                        <span className="text-[10px] text-slate-300 font-extrabold uppercase tracking-wide">JSP</span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xl font-black text-white">{partyAggregates.JSP.toLocaleString()}</p>
                        <p className="text-[10px] text-rose-400 font-extrabold">{totalVotesPolled > 0 ? ((partyAggregates.JSP / totalVotesPolled) * 100).toFixed(1) : '0.0'}% Share</p>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-rose-500 rounded-full" style={{ width: `${totalVotesPolled > 0 ? (partyAggregates.JSP / totalVotesPolled) * 100 : 0}%` }} />
                      </div>
                    </div>

                    {/* BJP */}
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-3.5 space-y-2 relative overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-orange-500 border border-orange-600" />
                        <span className="text-[10px] text-slate-300 font-extrabold uppercase tracking-wide">BJP</span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xl font-black text-white">{partyAggregates.BJP.toLocaleString()}</p>
                        <p className="text-[10px] text-orange-400 font-extrabold">{totalVotesPolled > 0 ? ((partyAggregates.BJP / totalVotesPolled) * 100).toFixed(1) : '0.0'}% Share</p>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full" style={{ width: `${totalVotesPolled > 0 ? (partyAggregates.BJP / totalVotesPolled) * 100 : 0}%` }} />
                      </div>
                    </div>

                    {/* INC */}
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 space-y-2 relative overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-600" />
                        <span className="text-[10px] text-slate-300 font-extrabold uppercase tracking-wide">INC</span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xl font-black text-white">{partyAggregates.INC.toLocaleString()}</p>
                        <p className="text-[10px] text-emerald-400 font-extrabold">{totalVotesPolled > 0 ? ((partyAggregates.INC / totalVotesPolled) * 100).toFixed(1) : '0.0'}% Share</p>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${totalVotesPolled > 0 ? (partyAggregates.INC / totalVotesPolled) * 100 : 0}%` }} />
                      </div>
                    </div>

                    {/* Others */}
                    <div className="bg-[#0B1120] border border-slate-800 rounded-2xl p-3.5 space-y-2 relative overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-500 border border-slate-600" />
                        <span className="text-[10px] text-slate-300 font-extrabold uppercase tracking-wide">Others</span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xl font-black text-white">{partyAggregates.Others.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{totalVotesPolled > 0 ? ((partyAggregates.Others / totalVotesPolled) * 100).toFixed(1) : '0.0'}% Share</p>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-500 rounded-full" style={{ width: `${totalVotesPolled > 0 ? (partyAggregates.Others / totalVotesPolled) * 100 : 0}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Stacked Proportional Bar chart */}
                  <div className="pt-2 space-y-1">
                    <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                      <span>Proportional Polled Vote Composition</span>
                      <span>Total Votes Polled: {totalVotesPolled.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-5 rounded-xl overflow-hidden flex shadow-lg border border-slate-800">
                      <div className="bg-yellow-400 h-full transition-all duration-300 relative group" style={{ width: `${totalVotesPolled > 0 ? (partyAggregates.TDP / totalVotesPolled) * 100 : 0}%` }}>
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-slate-900 truncate px-1">TDP</span>
                      </div>
                      <div className="bg-blue-500 h-full transition-all duration-300 relative group" style={{ width: `${totalVotesPolled > 0 ? (partyAggregates.YSRCP / totalVotesPolled) * 100 : 0}%` }}>
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white truncate px-1">YSRCP</span>
                      </div>
                      <div className="bg-rose-500 h-full transition-all duration-300 relative group" style={{ width: `${totalVotesPolled > 0 ? (partyAggregates.JSP / totalVotesPolled) * 100 : 0}%` }}>
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white truncate px-1">JSP</span>
                      </div>
                      <div className="bg-orange-500 h-full transition-all duration-300 relative group" style={{ width: `${totalVotesPolled > 0 ? (partyAggregates.BJP / totalVotesPolled) * 100 : 0}%` }}>
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white truncate px-1">BJP</span>
                      </div>
                      <div className="bg-emerald-500 h-full transition-all duration-300 relative group" style={{ width: `${totalVotesPolled > 0 ? (partyAggregates.INC / totalVotesPolled) * 100 : 0}%` }}>
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white truncate px-1">INC</span>
                      </div>
                      <div className="bg-slate-600 h-full transition-all duration-300 relative group" style={{ width: `${totalVotesPolled > 0 ? (partyAggregates.Others / totalVotesPolled) * 100 : 0}%` }}>
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white truncate px-1">OTH</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Two columns layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
                  
                  {/* Left side: Mandal-wise Turnout stats (Lg: col-span-5) */}
                  <div className="lg:col-span-5 bg-[#0F172A]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                      <h4 className="text-xs font-black text-white uppercase tracking-tight">Mandal Turnout Summary</h4>
                      <span className="text-[10px] bg-slate-900 border border-slate-800 text-cyan-400 font-mono px-2 py-0.5 rounded-full font-black">Turnout Rate</span>
                    </div>

                    <div className="space-y-3.5">
                      {liveMandalStats.map((mandal) => {
                        const speedColor = 
                          mandal.status === 'HIGH SPEED' ? 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30' :
                          mandal.status === 'CROWDED' ? 'text-rose-400 bg-rose-500/20 border-rose-500/30' :
                          mandal.status === 'SLOW' ? 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30' :
                          'text-slate-400 bg-slate-800 border-slate-700';

                        return (
                          <div key={mandal.name} className="border border-slate-800 rounded-2xl p-3.5 space-y-2 bg-[#0B1120]">
                            <div className="flex justify-between items-start">
                              <div>
                                <h5 className="font-extrabold text-white uppercase text-xs">{mandal.name}</h5>
                                <span className="text-[10px] text-slate-400 font-bold">
                                  {mandal.cast.toLocaleString()} / {mandal.total.toLocaleString()} votes
                                </span>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${speedColor}`}>
                                {mandal.status}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] font-black">
                                <span className="text-slate-400">Progress</span>
                                <span className="text-white">{mandal.turnout}%</span>
                              </div>
                              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-yellow-400 transition-all duration-300" 
                                  style={{ width: `${mandal.turnout}%` }} 
                                />
                              </div>
                            </div>

                            <div className="flex justify-between text-[10px] font-bold text-slate-400 pt-1">
                              <span>Queue: <strong className="text-slate-200">{mandal.avgQueue} in line</strong></span>
                              <span className="text-emerald-400">Sync OK</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right side: Manual voter cast entry Form (Lg: col-span-7) */}
                  <div className="lg:col-span-7 space-y-6">
                    
                    {/* Authorized Field-level Polling Figures Update Form */}
                    <form onSubmit={handleRegisterManualReport} className="bg-[#0F172A]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                        <Plus className="w-4 h-4 text-cyan-400" />
                        <h4 className="text-xs font-black text-white uppercase tracking-tight">Submit Booth-Level Polling Report</h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-bold text-slate-300">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400 uppercase">Mandal Location</label>
                          <select
                            value={newManualReport.mandal}
                            onChange={(e) => setNewManualReport({ ...newManualReport, mandal: e.target.value })}
                            className="w-full p-2 bg-[#0B1120] border border-slate-700/80 rounded-xl font-bold text-white focus:outline-none focus:border-cyan-400"
                          >
                            {liveMandalStats.map(m => (
                              <option key={m.name} value={m.name}>{m.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400 uppercase">Booth Identification</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Booth 224"
                            value={newManualReport.booth}
                            onChange={(e) => setNewManualReport({ ...newManualReport, booth: e.target.value })}
                            className="w-full p-2 bg-[#0B1120] border border-slate-700/80 rounded-xl font-bold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400 uppercase">Reported By (Agent)</label>
                          <input
                            type="text"
                            placeholder="e.g. M. Srinivasa Rao"
                            value={newManualReport.submittedBy}
                            onChange={(e) => setNewManualReport({ ...newManualReport, submittedBy: e.target.value })}
                            className="w-full p-2 bg-[#0B1120] border border-slate-700/80 rounded-xl font-bold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                      </div>

                      {/* Party-wise entry fields */}
                      <div className="space-y-2">
                        <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Polled Vote Count Breakdown (Incremental Batch)</span>
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                          <div className="flex flex-col gap-1 bg-yellow-500/10 p-2 border border-yellow-500/30 rounded-xl">
                            <label className="text-[9px] text-yellow-400 uppercase font-extrabold">TDP</label>
                            <input
                              type="number"
                              min="0"
                              value={newManualReport.TDP || ''}
                              onChange={(e) => setNewManualReport({ ...newManualReport, TDP: Math.max(0, parseInt(e.target.value) || 0) })}
                              className="w-full p-1.5 bg-[#0B1120] border border-slate-700 rounded-lg text-xs font-mono font-black text-white focus:outline-none focus:ring-1 focus:ring-yellow-400"
                              placeholder="0"
                            />
                          </div>

                          <div className="flex flex-col gap-1 bg-blue-500/10 p-2 border border-blue-500/30 rounded-xl">
                            <label className="text-[9px] text-blue-400 uppercase font-extrabold">YSRCP</label>
                            <input
                              type="number"
                              min="0"
                              value={newManualReport.YSRCP || ''}
                              onChange={(e) => setNewManualReport({ ...newManualReport, YSRCP: Math.max(0, parseInt(e.target.value) || 0) })}
                              className="w-full p-1.5 bg-[#0B1120] border border-slate-700 rounded-lg text-xs font-mono font-black text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                              placeholder="0"
                            />
                          </div>

                          <div className="flex flex-col gap-1 bg-rose-500/10 p-2 border border-rose-500/30 rounded-xl">
                            <label className="text-[9px] text-rose-400 uppercase font-extrabold">JSP</label>
                            <input
                              type="number"
                              min="0"
                              value={newManualReport.JSP || ''}
                              onChange={(e) => setNewManualReport({ ...newManualReport, JSP: Math.max(0, parseInt(e.target.value) || 0) })}
                              className="w-full p-1.5 bg-[#0B1120] border border-slate-700 rounded-lg text-xs font-mono font-black text-white focus:outline-none focus:ring-1 focus:ring-rose-400"
                              placeholder="0"
                            />
                          </div>

                          <div className="flex flex-col gap-1 bg-orange-500/10 p-2 border border-orange-500/30 rounded-xl">
                            <label className="text-[9px] text-orange-400 uppercase font-extrabold">BJP</label>
                            <input
                              type="number"
                              min="0"
                              value={newManualReport.BJP || ''}
                              onChange={(e) => setNewManualReport({ ...newManualReport, BJP: Math.max(0, parseInt(e.target.value) || 0) })}
                              className="w-full p-1.5 bg-[#0B1120] border border-slate-700 rounded-lg text-xs font-mono font-black text-white focus:outline-none focus:ring-1 focus:ring-orange-400"
                              placeholder="0"
                            />
                          </div>

                          <div className="flex flex-col gap-1 bg-emerald-500/10 p-2 border border-emerald-500/30 rounded-xl">
                            <label className="text-[9px] text-emerald-400 uppercase font-extrabold">INC</label>
                            <input
                              type="number"
                              min="0"
                              value={newManualReport.INC || ''}
                              onChange={(e) => setNewManualReport({ ...newManualReport, INC: Math.max(0, parseInt(e.target.value) || 0) })}
                              className="w-full p-1.5 bg-[#0B1120] border border-slate-700 rounded-lg text-xs font-mono font-black text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                              placeholder="0"
                            />
                          </div>

                          <div className="flex flex-col gap-1 bg-[#0B1120] p-2 border border-slate-700 rounded-xl">
                            <label className="text-[9px] text-slate-400 uppercase font-extrabold">Others</label>
                            <input
                              type="number"
                              min="0"
                              value={newManualReport.Others || ''}
                              onChange={(e) => setNewManualReport({ ...newManualReport, Others: Math.max(0, parseInt(e.target.value) || 0) })}
                              className="w-full p-1.5 bg-[#131E33] border border-slate-700 rounded-lg text-xs font-mono font-black text-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center border-t border-slate-800 pt-3">
                        <span className="text-[10px] text-slate-400 font-bold">
                          Total in this report: <strong className="text-yellow-400 font-black">{(Number(newManualReport.TDP) || 0) + (Number(newManualReport.YSRCP) || 0) + (Number(newManualReport.JSP) || 0) + (Number(newManualReport.BJP) || 0) + (Number(newManualReport.INC) || 0) + (Number(newManualReport.Others) || 0)} votes</strong>
                        </span>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black rounded-xl text-[10px] uppercase tracking-wider cursor-pointer shadow-md shadow-cyan-500/20"
                        >
                          Submit Polling Figures
                        </button>
                      </div>
                    </form>

                    {/* Authorized Polling Reports Feed */}
                    <div className="bg-[#0F172A]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-cyan-400" />
                          <h4 className="text-xs font-black text-white uppercase tracking-tight">Authorized Polling Reports Feed</h4>
                        </div>
                        <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                          Live Streaming
                        </span>
                      </div>

                      {/* Filter bar */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search polling reports (mandal, booth, agent)..."
                          value={liveSearchQuery}
                          onChange={(e) => setLiveSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-[#0B1120] border border-slate-700/80 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      {/* Logs Container list */}
                      <div className="divide-y divide-slate-800/80 overflow-y-auto max-h-[350px] pr-2 space-y-2">
                        {pollingReports
                          .filter(r => 
                            (r.mandal || '').toLowerCase().includes((liveSearchQuery || '').toLowerCase()) ||
                            (r.booth || '').toLowerCase().includes((liveSearchQuery || '').toLowerCase()) ||
                            (r.submittedBy || '').toLowerCase().includes((liveSearchQuery || '').toLowerCase())
                          )
                          .map((report) => (
                            <div key={report.id} className="pt-2.5 pb-2.5 flex flex-col justify-between text-xs hover:bg-slate-800/40 p-2.5 rounded-xl transition-colors border border-slate-800 mb-2 bg-[#0B1120]">
                              <div className="flex justify-between items-start">
                                <div className="space-y-0.5">
                                  <p className="font-extrabold text-white uppercase text-[11px] flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                                    {report.mandal} &bull; <span className="text-slate-400 font-bold">{report.booth}</span>
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-bold">Reported by: {report.submittedBy}</p>
                                </div>
                                <div className="text-right">
                                  <span className="text-[9px] text-slate-500 font-mono block font-bold">{report.time}</span>
                                  <span className="inline-block bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-black uppercase mt-1">
                                    +{report.totalVotes} votes
                                  </span>
                                </div>
                              </div>
                              
                              <div className="mt-2.5 pt-2 border-t border-slate-800 grid grid-cols-6 gap-1 text-[10px] text-center font-bold text-slate-300">
                                <div className="bg-yellow-500/10 rounded-lg py-1 border border-yellow-500/30">
                                  <span className="block text-[8px] text-yellow-400 uppercase font-black">TDP</span>
                                  <span className="font-mono text-white">{report.breakdown.TDP}</span>
                                </div>
                                <div className="bg-blue-500/10 rounded-lg py-1 border border-blue-500/30">
                                  <span className="block text-[8px] text-blue-400 uppercase font-black">YSR</span>
                                  <span className="font-mono text-white">{report.breakdown.YSRCP}</span>
                                </div>
                                <div className="bg-rose-500/10 rounded-lg py-1 border border-rose-500/30">
                                  <span className="block text-[8px] text-rose-400 uppercase font-black">JSP</span>
                                  <span className="font-mono text-white">{report.breakdown.JSP}</span>
                                </div>
                                <div className="bg-orange-500/10 rounded-lg py-1 border border-orange-500/30">
                                  <span className="block text-[8px] text-orange-400 uppercase font-black">BJP</span>
                                  <span className="font-mono text-white">{report.breakdown.BJP}</span>
                                </div>
                                <div className="bg-emerald-500/10 rounded-lg py-1 border border-emerald-500/30">
                                  <span className="block text-[8px] text-emerald-400 uppercase font-black">INC</span>
                                  <span className="font-mono text-white">{report.breakdown.INC}</span>
                                </div>
                                <div className="bg-slate-800 rounded-lg py-1 border border-slate-700">
                                  <span className="block text-[8px] text-slate-400 uppercase font-black">OTH</span>
                                  <span className="font-mono text-white">{report.breakdown.Others}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                  </div>

                </div>
              </div>
            );
          })()}

          {/* --------------------------------------------------------
              TAB: MIGRATED VOTERS
             -------------------------------------------------------- */}
          {activeTab === 'migrated_voters' && (
            <div className="space-y-6 animate-fade-in" id="const-migrated-voters-tab">
              {/* Header card with metrics */}
              <div className="bg-[#0F172A]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400">Migrated Voters Coordination Center</h3>
                    <p className="text-xs text-slate-400">Track and facilitate return travel, postal ballots, or logistical coordination for out-of-station constituency voters.</p>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-300 font-extrabold px-2.5 py-1 rounded-lg">
                      Total Tracked: {migratedVotersList.length}
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-extrabold px-2.5 py-1 rounded-lg">
                      Travel Booked: {migratedVotersList.filter(v => v.travelStatus === 'TRAVEL_BOOKED').length}
                    </span>
                    <span className="text-[10px] bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-extrabold px-2.5 py-1 rounded-lg">
                      Pending confirmation: {migratedVotersList.filter(v => v.travelStatus === 'PENDING_CONFIRMATION').length}
                    </span>
                  </div>
                </div>

                {/* Summary boxes */}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-[#0B1120] border border-slate-800 rounded-2xl p-4 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Confirmed Arrivals</span>
                      <span className="text-xl font-black text-white block mt-1">
                        {migratedVotersList.filter(v => v.travelStatus === 'CONFIRMED' || v.travelStatus === 'TRAVEL_BOOKED' || v.travelStatus === 'SELF_ARRANGEMENT').length}
                      </span>
                    </div>
                    <span className="text-xs font-black text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 rounded-full">Active Assist</span>
                  </div>

                  <div className="bg-[#0B1120] border border-slate-800 rounded-2xl p-4 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Assistance Booked</span>
                      <span className="text-xl font-black text-sky-400 block mt-1">
                        {migratedVotersList.filter(v => v.assistanceRequired === 'TRANSPORT').length}
                      </span>
                    </div>
                    <span className="text-xs font-black text-sky-400 bg-sky-500/20 border border-sky-500/30 px-2.5 py-1 rounded-full">Bus / Train</span>
                  </div>

                  <div className="bg-[#0B1120] border border-slate-800 rounded-2xl p-4 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Pending Reach Out</span>
                      <span className="text-xl font-black text-cyan-400 block mt-1">
                        {migratedVotersList.filter(v => v.travelStatus === 'PENDING_CONFIRMATION').length}
                      </span>
                    </div>
                    <span className="text-xs font-black text-cyan-400 bg-cyan-500/20 border border-cyan-500/30 px-2.5 py-1 rounded-full">Follow-up</span>
                  </div>

                  <div className="bg-[#0B1120] border border-slate-800 rounded-2xl p-4 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Lost Contact</span>
                      <span className="text-xl font-black text-rose-400 block mt-1">
                        {migratedVotersList.filter(v => v.travelStatus === 'UNREACHABLE').length}
                      </span>
                    </div>
                    <span className="text-xs font-black text-rose-400 bg-rose-500/20 border border-rose-500/30 px-2.5 py-1 rounded-full">Retry</span>
                  </div>
                </div>
              </div>

              {/* Main Directory Table and Add form */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
                
                {/* Left Side: Filter and Add Form (Lg: col-span-4) */}
                <div className="lg:col-span-4 space-y-6">
                  
                  {/* Search and Filter card */}
                  <div className="bg-[#0F172A]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3.5">
                    <h4 className="text-xs font-black text-white uppercase tracking-tight border-b border-slate-800 pb-2">Filter Directory</h4>
                    
                    <div className="space-y-3 font-bold text-xs text-slate-300">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-slate-400 uppercase">Mandal Area</label>
                        <select
                          value={migratedMandalFilter}
                          onChange={(e) => setMigratedMandalFilter(e.target.value)}
                          className="w-full p-2 bg-[#0B1120] border border-slate-700/80 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-cyan-400"
                        >
                          <option value="ALL">ALL MANDALS</option>
                          <option value="Singarayakonda">Singarayakonda</option>
                          <option value="Kondapi">Kondapi</option>
                          <option value="Tangutur">Tangutur</option>
                          <option value="Marripudi">Marripudi</option>
                          <option value="Ponnaluru">Ponnaluru</option>
                          <option value="Zarugumalli">Zarugumalli</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-slate-400 uppercase">Travel Status</label>
                        <select
                          value={migratedStatusFilter}
                          onChange={(e) => setMigratedStatusFilter(e.target.value)}
                          className="w-full p-2 bg-[#0B1120] border border-slate-700/80 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-cyan-400"
                        >
                          <option value="ALL">ALL STATUSES</option>
                          <option value="CONFIRMED">CONFIRMED</option>
                          <option value="TRAVEL_BOOKED">TRAVEL BOOKED</option>
                          <option value="SELF_ARRANGEMENT">SELF ARRANGEMENT</option>
                          <option value="PENDING_CONFIRMATION">PENDING CONFIRMATION</option>
                          <option value="UNREACHABLE">UNREACHABLE</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Add Migrated Voter Card */}
                  <div className="bg-[#0F172A]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3.5">
                    <h4 className="text-xs font-black text-white uppercase tracking-tight border-b border-slate-800 pb-2">Register Migrated Voter</h4>
                    
                    <form onSubmit={handleAddMigratedVoter} className="space-y-3 text-xs font-bold text-slate-300">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-400 uppercase">Voter Full Name</label>
                        <input
                          type="text"
                          required
                          placeholder="Enter voter name..."
                          value={newMigratedVoter.name}
                          onChange={(e) => setNewMigratedVoter({ ...newMigratedVoter, name: e.target.value })}
                          className="w-full p-2 bg-[#0B1120] border border-slate-700/80 rounded-xl font-bold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-400 uppercase">EPIC Card ID</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. KDP9482341"
                          value={newMigratedVoter.epic}
                          onChange={(e) => setNewMigratedVoter({ ...newMigratedVoter, epic: e.target.value })}
                          className="w-full p-2 bg-[#0B1120] border border-slate-700/80 rounded-xl font-bold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400 uppercase">Mandal</label>
                          <select
                            value={newMigratedVoter.mandal}
                            onChange={(e) => setNewMigratedVoter({ ...newMigratedVoter, mandal: e.target.value })}
                            className="w-full p-1.5 bg-[#0B1120] border border-slate-700 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-cyan-400"
                          >
                            <option value="Singarayakonda">Singarayakonda</option>
                            <option value="Kondapi">Kondapi</option>
                            <option value="Tangutur">Tangutur</option>
                            <option value="Marripudi">Marripudi</option>
                            <option value="Ponnaluru">Ponnaluru</option>
                            <option value="Zarugumalli">Zarugumalli</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400 uppercase">Village</label>
                          <input
                            type="text"
                            required
                            placeholder="Village name..."
                            value={newMigratedVoter.village}
                            onChange={(e) => setNewMigratedVoter({ ...newMigratedVoter, village: e.target.value })}
                            className="w-full p-1.5 bg-[#0B1120] border border-slate-700 rounded-lg font-bold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-400 uppercase">Current Residence Location</label>
                        <input
                          type="text"
                          placeholder="e.g. Hyderabad, Bangalore"
                          value={newMigratedVoter.currentLocation}
                          onChange={(e) => setNewMigratedVoter({ ...newMigratedVoter, currentLocation: e.target.value })}
                          className="w-full p-2 bg-[#0B1120] border border-slate-700/80 rounded-xl font-bold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-400 uppercase">Contact Number</label>
                        <input
                          type="text"
                          placeholder="Mobile number..."
                          value={newMigratedVoter.contactNumber}
                          onChange={(e) => setNewMigratedVoter({ ...newMigratedVoter, contactNumber: e.target.value })}
                          className="w-full p-2 bg-[#0B1120] border border-slate-700/80 rounded-xl font-bold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-400 uppercase">Assigned Incharge / Volunteer</label>
                        <input
                          type="text"
                          placeholder="Volunteer name..."
                          value={newMigratedVoter.assignedVolunteer}
                          onChange={(e) => setNewMigratedVoter({ ...newMigratedVoter, assignedVolunteer: e.target.value })}
                          className="w-full p-2 bg-[#0B1120] border border-slate-700/80 rounded-xl font-bold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black rounded-xl text-[10px] uppercase tracking-wider cursor-pointer shadow-md shadow-cyan-500/20"
                      >
                        Register Migrated Voter
                      </button>
                    </form>
                  </div>

                </div>

                {/* Right Side: Search and directory Table (Lg: col-span-8) */}
                <div className="lg:col-span-8 bg-[#0F172A]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h4 className="text-xs font-black text-white uppercase tracking-tight">Voters Directory</h4>
                    <span className="text-[10px] bg-slate-900 border border-slate-800 text-cyan-400 px-2 py-0.5 rounded-full font-black">
                      Matches: {migratedTotal}
                    </span>
                  </div>

                  {/* Search input bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search Migrated Voters by name, EPIC ID, current location, or volunteer..."
                      value={migratedSearch}
                      onChange={(e) => setMigratedSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-[#0B1120] border border-slate-700/80 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  {/* Directory Table */}
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0B1120]">
                    <table className="w-full min-w-[750px] text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#131E33] border-b border-slate-800 text-slate-300 font-black uppercase text-[9px] tracking-wider">
                          <th className="py-3 px-4 text-center">S.No</th>
                          <th className="py-3 px-4">Voter Name</th>
                          <th className="py-3 px-4">EPIC</th>
                          <th className="py-3 px-4">Constituency Origin</th>
                          <th className="py-3 px-4">Current location</th>
                          <th className="py-3 px-4">Travel Status</th>
                          <th className="py-3 px-4">Assistance</th>
                          <th className="py-3 px-4">Assigned Coordination</th>
                          <th className="py-3 px-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 font-bold text-slate-200">
                        {paginatedMigratedVoters.map((item, idx) => {
                          const statusColor = 
                            item.travelStatus === 'CONFIRMED' ? 'bg-emerald-500/20 text-emerald-400' :
                            item.travelStatus === 'TRAVEL_BOOKED' ? 'bg-green-500/20 text-green-400' :
                            item.travelStatus === 'SELF_ARRANGEMENT' ? 'bg-blue-500/20 text-blue-400' :
                            item.travelStatus === 'UNREACHABLE' ? 'bg-red-500/20 text-red-400 font-bold' :
                            'bg-cyan-500/20 text-cyan-400';

                          const assistBadge = 
                            item.assistanceRequired === 'TRANSPORT' ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-black' :
                            item.assistanceRequired === 'POSTAL_BALLOT' ? 'bg-purple-500/20 border border-purple-500/30 text-purple-300 font-black' :
                            'bg-slate-800 border border-slate-700 text-slate-400 font-bold';

                          return (
                            <tr key={item.id} className="hover:bg-slate-800/40">
                              <td className="py-3 px-4 text-center text-slate-500">{(migratedPage - 1) * migratedPageSize + idx + 1}</td>
                              <td className="py-3 px-4">
                                <span className="block font-black text-white uppercase">{item.name}</span>
                                <span className="text-[10px] text-slate-400 block font-mono">{item.contactNumber}</span>
                              </td>
                              <td className="py-3 px-4 font-mono text-cyan-400">{item.epic}</td>
                              <td className="py-3 px-4 text-slate-400 uppercase">
                                {item.mandal} &bull; {item.village}
                              </td>
                              <td className="py-3 px-4 text-white font-black uppercase text-[11px]">{item.currentLocation}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase block text-center ${statusColor}`}>
                                  {item.travelStatus.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] tracking-wider uppercase block text-center ${assistBadge}`}>
                                  {item.assistanceRequired}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-300 text-[11px]">{item.assignedVolunteer || 'Unassigned'}</td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => setEditingMigratedVoter(item)}
                                  className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer"
                                >
                                  Update
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <Pagination
                    currentPage={migratedPage}
                    pageSize={migratedPageSize}
                    totalItems={migratedTotal}
                    onPageChange={setMigratedPage}
                    onPageSizeChange={(newSize) => {
                      setMigratedPageSize(newSize);
                      setMigratedPage(1);
                    }}
                    pageSizeOptions={[10, 15, 25, 50]}
                    itemName="migrated voters"
                    accentColor="blue"
                  />
                </div>

              </div>

              {/* Editing Migrated Voter Status Modal */}
              {editingMigratedVoter && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                  <form onSubmit={handleUpdateMigratedVoter} className="bg-[#0F172A] rounded-2xl border border-slate-700 max-w-md w-full p-6 space-y-4 shadow-2xl">
                    <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                      <div>
                        <h4 className="text-base font-black text-white uppercase">Update Coordination Status</h4>
                        <p className="text-[10px] text-cyan-400 font-semibold mt-0.5">Voter EPIC: {editingMigratedVoter.epic}</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setEditingMigratedVoter(null)}
                        className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-3 text-xs font-bold text-slate-300">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase">Voter profile:</p>
                        <p className="text-white text-sm font-black mt-0.5">{editingMigratedVoter.name}</p>
                        <p className="text-slate-400 text-[11px] uppercase mt-0.5">Location: {editingMigratedVoter.mandal} &bull; {editingMigratedVoter.village}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-slate-400 uppercase">Travel status</label>
                          <select
                            value={editingMigratedVoter.travelStatus}
                            onChange={(e) => setEditingMigratedVoter({ ...editingMigratedVoter, travelStatus: e.target.value as any })}
                            className="w-full bg-[#0B1120] border border-slate-700 rounded-xl p-2 text-white font-extrabold focus:outline-none focus:border-cyan-400"
                          >
                            <option value="PENDING_CONFIRMATION">PENDING CONFIRMATION</option>
                            <option value="CONFIRMED">CONFIRMED ARRIVAL</option>
                            <option value="TRAVEL_BOOKED">TRAVEL BOOKED</option>
                            <option value="SELF_ARRANGEMENT">SELF ARRANGEMENT</option>
                            <option value="UNREACHABLE">UNREACHABLE / NO ANSWER</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-slate-400 uppercase">Required Assistance</label>
                          <select
                            value={editingMigratedVoter.assistanceRequired}
                            onChange={(e) => setEditingMigratedVoter({ ...editingMigratedVoter, assistanceRequired: e.target.value as any })}
                            className="w-full bg-[#0B1120] border border-slate-700 rounded-xl p-2 text-white font-extrabold focus:outline-none focus:border-cyan-400"
                          >
                            <option value="NONE">NONE / SELF SUFFICIENT</option>
                            <option value="TRANSPORT">TRANSPORT ASSISTANCE</option>
                            <option value="POSTAL_BALLOT">POSTAL BALLOT</option>
                            <option value="ACCOMMODATION">ACCOMMODATION</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-slate-400 uppercase">Assigned Coordinator Volunteer</label>
                        <input
                          type="text"
                          value={editingMigratedVoter.assignedVolunteer}
                          onChange={(e) => setEditingMigratedVoter({ ...editingMigratedVoter, assignedVolunteer: e.target.value })}
                          className="w-full bg-[#0B1120] border border-slate-700 rounded-xl p-2 text-white font-bold placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-slate-400 uppercase">Coordination Notes</label>
                        <textarea
                          rows={2}
                          value={editingMigratedVoter.notes}
                          onChange={(e) => setEditingMigratedVoter({ ...editingMigratedVoter, notes: e.target.value })}
                          className="w-full bg-[#0B1120] border border-slate-700 rounded-xl p-2 text-white font-medium placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setEditingMigratedVoter(null)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black rounded-xl text-[10px] uppercase cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black rounded-xl text-[10px] uppercase cursor-pointer shadow-md shadow-cyan-500/20"
                      >
                        Save updates
                      </button>
                    </div>
                  </form>
                </div>
              )}

            </div>
          )}



          </div>

          {/* Pinned Mobile App Bottom Navigation Bar */}
          <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#0C0E17]/95 backdrop-blur-xl border-t border-white/[0.08] px-3 py-2 flex items-center justify-around shadow-2xl max-w-3xl xl:max-w-4xl mx-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition cursor-pointer ${
                activeTab === 'dashboard' ? 'text-cyan-400 font-black' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px] tracking-tight">Overview</span>
              {activeTab === 'dashboard' && <span className="w-1 h-1 rounded-full bg-cyan-400 shadow-xs shadow-cyan-400" />}
            </button>
            <button
              onClick={() => setActiveTab('electoral_roll')}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition cursor-pointer ${
                activeTab === 'electoral_roll' ? 'text-cyan-400 font-black' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-5 h-5" />
              <span className="text-[10px] tracking-tight">Voters</span>
              {activeTab === 'electoral_roll' && <span className="w-1 h-1 rounded-full bg-cyan-400 shadow-xs shadow-cyan-400" />}
            </button>
            <button
              onClick={() => setActiveTab('mandal_list')}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition cursor-pointer ${
                activeTab === 'mandal_list' || activeTab === 'village_list' ? 'text-cyan-400 font-black' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-5 h-5" />
              <span className="text-[10px] tracking-tight">Mandals</span>
              {(activeTab === 'mandal_list' || activeTab === 'village_list') && <span className="w-1 h-1 rounded-full bg-cyan-400 shadow-xs shadow-cyan-400" />}
            </button>
            <button
              onClick={() => setActiveTab('live_voter_tracking')}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition cursor-pointer ${
                activeTab === 'live_voter_tracking' || activeTab === 'caste_analytics' ? 'text-cyan-400 font-black' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-5 h-5" />
              <span className="text-[10px] tracking-tight">Turnout</span>
              {(activeTab === 'live_voter_tracking' || activeTab === 'caste_analytics') && <span className="w-1 h-1 rounded-full bg-cyan-400 shadow-xs shadow-cyan-400" />}
            </button>
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition cursor-pointer text-slate-400 hover:text-cyan-400"
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] tracking-tight">All Tabs</span>
            </button>
          </nav>
        </div>
      </main>

      <ActiveSessionsModal
        isOpen={isSessionsOpen}
        onClose={() => setIsSessionsOpen(false)}
      />
    </div>
  );
}
