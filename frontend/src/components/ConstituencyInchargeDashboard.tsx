import React, { useEffect, useMemo, useState } from 'react';
import { UserSession, Voter, VoterPreference, VoterStatus } from '../types';
import {
  createPollingReport,
  fetchCadreNetwork,
  fetchChildrenAnalytics,
  fetchHierarchySummaryByUser,
  fetchLiveTurnoutSummaryByUser,
  fetchTasksForUnit,
  fetchTrainingProgressForUnit,
  fetchVotersForUnit,
  type CadreNetworkItem,
  type ChildAnalyticsItem,
  type HierarchySummaryPayload,
  type LiveTurnoutSummaryPayload,
  type TrainingProgressItem,
  updateTaskStatus,
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
  Crown
} from 'lucide-react';
import MandalInchargeDashboard from './MandalInchargeDashboard';
import AIStrategicIntelligenceCenter from './AIStrategicIntelligenceCenter';
import Pagination from './common/Pagination';

function mapMandalRollup(item: ChildAnalyticsItem) {
  const prefs = item?.snapshot?.politicalPreference ?? {};
  const tdp = prefs.TDP ?? 0;
  const ysrcp = prefs.YSRCP ?? 0;
  const neutral = prefs.NEUTRAL ?? 0;
  const voters = item?.snapshot?.summary?.totalVoters ?? 0;
  const lead = Math.abs(tdp - ysrcp);
  const leading = tdp > ysrcp ? ('TDP' as VoterPreference) : ('YSRCP' as VoterPreference);
  const diffPct = voters > 0 ? (lead / voters) * 100 : 0;
  const status = diffPct < 4
    ? ('CLOSE CONTEST' as const)
    : (tdp > ysrcp ? ('WINNING' as const) : ('TRAILING' as const));

  return {
    name: item.name,
    voters,
    villages: item?.snapshot?.hierarchyCounts?.VILLAGE ?? 0,
    booths: item?.snapshot?.hierarchyCounts?.BOOTH ?? 0,
    tdp,
    ysrcp,
    neutral,
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
  const [activeTab, setActiveTab] = useState<ConstTabType>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [drilledMandal, setDrilledMandal] = useState<string | null>(null);
  const [selectedMandalInVillageList, setSelectedMandalInVillageList] = useState<string | null>(null);
  const [backendSummary, setBackendSummary] = useState<HierarchySummaryPayload | null>(null);
  const [cadreItems, setCadreItems] = useState<CadreNetworkItem[]>([]);
  const [trainingProgressItems, setTrainingProgressItems] = useState<TrainingProgressItem[]>([]);
  const [liveTurnoutSummary, setLiveTurnoutSummary] = useState<LiveTurnoutSummaryPayload | null>(null);
  const [scopedVoters, setScopedVoters] = useState<Voter[]>([]);
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
      const payload = await fetchLiveTurnoutSummaryByUser(session.userId);
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
    ])
      .then(([payload, tasks, cadre, training, voters]) => {
        if (!active) {
          return;
        }

        setBackendSummary(payload);

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

  useEffect(() => {
    if (scopedVoters && scopedVoters.length > 0) {
      const flagged = scopedVoters
        .filter(v => v.voterStatus === 'Doubtful' || v.voterStatus === 'Fake' || v.voterStatus === 'Shifted' || v.voterStatus === 'Deceased')
        .map((v, index) => ({
          sNo: index + 1,
          name: v.name,
          epic: v.epicNumber,
          age: v.age,
          gender: v.gender,
          village: v.village,
          mandal: v.mandal,
          booth: v.boothNumber,
          reason: v.notes || `${v.voterStatus} Record`,
          status: (v.voterStatus === 'Fake' ? 'FLAGGED' : 'UNDER VERIFICATION') as FlaggedVoter['status'],
        }));
      setFlaggedVoters(flagged);
    } else {
      setFlaggedVoters([]);
    }
  }, [scopedVoters]);

  const [auditingVoter, setAuditingVoter] = useState<FlaggedVoter | null>(null);

  const filteredFlaggedVoters = useMemo(() => {
    return flaggedVoters.filter(v => {
      const matchSearch = 
        (v.name || '').toLowerCase().includes((fakeSearch || '').toLowerCase()) ||
        (v.epic || '').toLowerCase().includes((fakeSearch || '').toLowerCase()) ||
        (v.village || '').toLowerCase().includes((fakeSearch || '').toLowerCase()) ||
        (v.mandal || '').toLowerCase().includes((fakeSearch || '').toLowerCase());

      const matchStatus = fakeFilterStatus === 'ALL' || v.status === fakeFilterStatus;
      return matchSearch && matchStatus;
    });
  }, [flaggedVoters, fakeSearch, fakeFilterStatus]);

  // Pagination states
  const [villagesPage, setVillagesPage] = useState(1);
  const [villagesPageSize, setVillagesPageSize] = useState(15);
  const [flaggedPage, setFlaggedPage] = useState(1);
  const [flaggedPageSize, setFlaggedPageSize] = useState(15);
  const [migratedPage, setMigratedPage] = useState(1);
  const [migratedPageSize, setMigratedPageSize] = useState(15);

  useEffect(() => {
    setFlaggedPage(1);
  }, [fakeSearch, fakeFilterStatus]);

  const paginatedFlaggedVoters = useMemo(() => {
    const start = (flaggedPage - 1) * flaggedPageSize;
    return filteredFlaggedVoters.slice(start, start + flaggedPageSize);
  }, [filteredFlaggedVoters, flaggedPage, flaggedPageSize]);

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

  useEffect(() => {
    const derivedMigrated = scopedVoters
      .filter((voter) => voter.voterLocationStatus === 'Migrated')
      .map((voter) => ({
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

    setMigratedVotersList((prev) => {
      const manualOnly = prev.filter((item) => item.id.startsWith('M-'));
      return [...derivedMigrated, ...manualOnly];
    });
  }, [scopedVoters]);

  const filteredMigratedVoters = useMemo(() => {
    return migratedVotersList.filter(v => {
      const matchSearch = 
        (v.name || '').toLowerCase().includes((migratedSearch || '').toLowerCase()) ||
        (v.epic || '').toLowerCase().includes((migratedSearch || '').toLowerCase()) ||
        (v.currentLocation || '').toLowerCase().includes((migratedSearch || '').toLowerCase()) ||
        (v.assignedVolunteer || '').toLowerCase().includes((migratedSearch || '').toLowerCase());
      
      const matchMandal = migratedMandalFilter === 'ALL' || v.mandal === migratedMandalFilter;
      const matchStatus = migratedStatusFilter === 'ALL' || v.travelStatus === migratedStatusFilter;

      return matchSearch && matchMandal && matchStatus;
    });
  }, [migratedVotersList, migratedSearch, migratedMandalFilter, migratedStatusFilter]);

  const paginatedMigratedVoters = useMemo(() => {
    const start = (migratedPage - 1) * migratedPageSize;
    return filteredMigratedVoters.slice(start, start + migratedPageSize);
  }, [filteredMigratedVoters, migratedPage, migratedPageSize]);

  const handleUpdateMigratedVoter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMigratedVoter) return;
    setMigratedVotersList(prev => prev.map(v => v.id === editingMigratedVoter.id ? editingMigratedVoter : v));
    setEditingMigratedVoter(null);
  };

  const handleAddMigratedVoter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMigratedVoter.name || !newMigratedVoter.epic) return;

    const newRec: MigratedVoter = {
      id: 'M-' + Date.now(),
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

    setMigratedVotersList(prev => [...prev, newRec]);
    setNewMigratedVoter({
      name: '', epic: '', mandal: 'Singarayakonda', village: 'Kalikivaya', booth: 'Booth 224',
      currentLocation: '', contactNumber: '', travelStatus: 'PENDING_CONFIRMATION',
      assistanceRequired: 'NONE', assignedVolunteer: '', notes: ''
    });
  };

  // Handle drilldown to Mandal
  if (drilledMandal) {
    return (
      <MandalInchargeDashboard 
        session={{
          userName: "Chundi Ramesh Naidu",
          mobileNumber: "9848022334",
          role: "MANDAL_INCHARGE",
          unitId: session.unitId,
          assignedConstituency: "Kondapi Assembly Constituency",
          assignedMandal: drilledMandal,
          userId: "KDP-CON-01",
          accountStatus: "Active"
        }}
        onLogout={() => setDrilledMandal(null)} // Click return triggers close drilldown!
      />
    );
  }



  const handleGenerateAnalysis = () => {
    setIsGeneratingAnalysis(true);
    setTimeout(() => {
      setIsGeneratingAnalysis(false);
      setAnalysisResult(true);
    }, 2000);
  };

  const handleUpdateVoterStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditingVoter) return;
    setFlaggedVoters(prev => prev.map(v => v.sNo === auditingVoter.sNo ? auditingVoter : v));
    setAuditingVoter(null);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800" id="constituency-dashboard-root">
      
      {/* --------------------------------------------------------
          MOBILE SIDEBAR MENU BAR
         -------------------------------------------------------- */}
      <div className="md:hidden fixed top-3 left-4 z-50">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 bg-slate-900 text-white rounded-lg shadow-md cursor-pointer"
        >
          {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* --------------------------------------------------------
          SIDEBAR: DARK NAVY WITH YELLOW HIGH LIGHT
         -------------------------------------------------------- */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 h-screen bg-slate-950 text-slate-300 flex flex-col justify-between border-r border-slate-900 transition-transform duration-200 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} md:fixed shrink-0 select-none
      `}>
        {/* Brand Block */}
        <div className="p-5 border-b border-slate-900/90 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-slate-950 shrink-0 font-black text-sm shadow-md shadow-amber-400/20">
              <Crown className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h1 className="text-sm font-black text-white tracking-tight">Kondapi Connect</h1>
              <p className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest">Constituency Command</p>
            </div>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-[10px] font-mono text-slate-300 font-bold uppercase tracking-wider truncate">
              {session?.userName || 'Chundi Ramesh Naidu'}
            </span>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 no-scrollbar">
          {[
            { id: 'dashboard', name: 'Dashboard', icon: Home },
            { id: 'mandal_list', name: 'Mandal List', icon: Layers },
            { id: 'village_list', name: 'Village List', icon: MapPin },
            { id: 'tasks', name: 'High Command Tasks', icon: Calendar },
            { id: 'caste_analytics', name: 'Caste Analytics', icon: BarChart3 },
            { id: 'cadre_network', name: 'Cadre Network', icon: Users },
            { id: 'fake_votes', name: 'Fake Votes', icon: AlertTriangle },
            { id: 'strategic_intelligence', name: 'Strategic Intelligence', icon: Compass },
            { id: 'training_analytics', name: 'Training Analytics', icon: GraduationCap },
            { id: 'live_voter_tracking', name: 'Live Voter Tracking', icon: Activity },
            { id: 'migrated_voters', name: 'Migrated Voters', icon: Globe }
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
                  w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer tracking-wide
                  ${isActive 
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-md shadow-amber-400/20' 
                    : 'hover:bg-slate-900/80 hover:text-white text-slate-400'
                  }
                `}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                <span className="truncate">{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Lock / Exit Controls */}
        <div className="p-4 border-t border-slate-900 space-y-2">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2 bg-slate-900 hover:bg-red-950 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all uppercase tracking-wider cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Disconnect Portal
          </button>
        </div>
      </aside>

      {/* --------------------------------------------------------
          MAIN DISPLAY VIEW AREA
         -------------------------------------------------------- */}
      <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden md:pl-64" id="main-workspace-section">
        <div className="p-6 md:p-8 space-y-6 max-w-7xl w-full mx-auto" id="constituency-main-container">
          
          {/* Header Title block */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200/80 pb-5 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-wider">
                  <Crown className="w-3 h-3 text-amber-600" />
                  Assembly Constituency Command
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  AP State • Kondapi
                </span>
              </div>
              <h2 className="text-2xl font-black text-slate-950 tracking-tight">
                Kondapi Constituency Dashboard
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Live political telemetry, booth infrastructure, and cadre performance across all Mandals.
              </p>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-700">Constituency Incharge</span>
              </div>
            </div>
          </div>

          {/* --------------------------------------------------------
              TAB: DASHBOARD
             -------------------------------------------------------- */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in" id="const-dashboard-tab">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                
                <div className="bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Total Voters</span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <span className="text-2xl font-black text-slate-950 tracking-tight">{liveConstituencyStats.totalVoters.toLocaleString()}</span>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Aggregated from scoped hierarchy</p>
                  </div>
                </div>

                <div className="bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Total Mandals</span>
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Layers className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <span className="text-2xl font-black text-slate-950 tracking-tight">{liveConstituencyStats.totalMandals}</span>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Current operational mandals</p>
                  </div>
                </div>

                <div className="bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Total Villages</span>
                    <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                      <MapPin className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <span className="text-2xl font-black text-slate-950 tracking-tight">{liveConstituencyStats.totalVillages}</span>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Resolved from child units</p>
                  </div>
                </div>

                <div className="bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Total Booths</span>
                    <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Vote className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <span className="text-2xl font-black text-slate-950 tracking-tight">{liveConstituencyStats.totalBooths}</span>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Active polling stations</p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-amber-100/70 border border-amber-300/80 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-amber-800 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      Live Turnout
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-amber-200/80 text-amber-800 flex items-center justify-center">
                      <Activity className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <span className="text-xl font-black text-amber-900 tracking-tight">{liveConstituencyStats.voted.toLocaleString()} Done</span>
                    <div className="text-[10px] font-bold text-amber-800 bg-white/80 px-2 py-0.5 rounded-lg border border-amber-200/70 w-fit mt-1">
                      Remaining: {liveConstituencyStats.remaining.toLocaleString()}
                    </div>
                  </div>
                </div>

              </div>

              {/* Constituency Political Position Chart Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Kondapi Political Position</h3>
                  <p className="text-xs text-slate-500">Overall support share of ECI registered parties based on latest ground surveys.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left Column: Legend List */}
                  <div className="space-y-3">
                    {[
                      { party: 'TDP', votes: constituencyStats.tdp, pct: 50.39, color: 'bg-yellow-400 border-yellow-500' },
                      { party: 'YSRCP', votes: constituencyStats.ysrcp, pct: 43.24, color: 'bg-blue-600 border-blue-700' },
                      { party: 'Neutral', votes: constituencyStats.neutral, pct: 6.37, color: 'bg-slate-400 border-slate-500' },
                      { party: 'JSP', votes: 0, pct: 0, color: 'bg-red-600' },
                      { party: 'BJP', votes: 0, pct: 0, color: 'bg-orange-500' },
                      { party: 'CONGRESS', votes: 0, pct: 0, color: 'bg-sky-400' }
                    ].map((item) => (
                      <div key={item.party} className="flex items-center justify-between border-b border-slate-100 pb-1.5 last:border-b-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${item.color} shrink-0`} />
                          <span className="text-xs font-black text-slate-900">{item.party}</span>
                        </div>
                        <div className="text-right text-xs">
                          <span className="font-extrabold text-slate-900">{item.pct}%</span>
                          <span className="text-[10px] text-slate-400 ml-1.5 font-bold">({item.votes.toLocaleString()} votes)</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Middle Column: Interactive Progress Bars */}
                  <div className="md:col-span-2 flex flex-col justify-center space-y-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-extrabold text-slate-900">
                        <span>TDP Command share</span>
                        <span>50.39%</span>
                      </div>
                      <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400" style={{ width: '50.39%' }} />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-extrabold text-slate-900">
                        <span>YSRCP Support share</span>
                        <span>43.24%</span>
                      </div>
                      <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600" style={{ width: '43.24%' }} />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-extrabold text-slate-900">
                        <span>Neutral / Deciding voters</span>
                        <span>6.37%</span>
                      </div>
                      <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-400" style={{ width: '6.37%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Brief Quick Links Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Campaign Operations Summary</h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    The overall constituency position stands at a steady <span className="text-yellow-600 font-extrabold">TDP Advantage (+17,920 voters)</span>. Out of 6 mandals, TDP maintains decisive leads in 3, close contests in 1, and trailing positions in 2 mandals. Strong operational focus is directed at neutral swing households.
                  </p>
                  <button 
                    onClick={() => setActiveTab('mandal_list')}
                    className="text-xs font-black text-yellow-600 hover:text-yellow-700 flex items-center gap-1 cursor-pointer uppercase"
                  >
                    Go to Mandal Analysis <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Command Center Status</h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    Voter database sync with all 283 polling booth agents is <span className="text-emerald-600 font-extrabold">100% active</span>. Flagged duplication verification reports are undergoing manual audits on the ground. Live updates from Singarayakonda Mandal are fully synced.
                  </p>
                  <button 
                    onClick={() => setActiveTab('cadre_network')}
                    className="text-xs font-black text-yellow-600 hover:text-yellow-700 flex items-center gap-1 cursor-pointer uppercase"
                  >
                    Inspect Cadre Network <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* --------------------------------------------------------
              TAB: MANDAL LIST
             -------------------------------------------------------- */}
          {activeTab === 'mandal_list' && (
            <div className="space-y-6 animate-fade-in" id="const-mandal-tab">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                
                {/* Header with quick stats */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Mandal Analysis</h3>
                    <p className="text-xs text-slate-500">View detailed performance, leadership margins, and drill-down into polling villages.</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-[10px] bg-slate-50 border border-slate-200 text-slate-600 font-extrabold px-2.5 py-1 rounded">
                      Total: 6
                    </span>
                    <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold px-2.5 py-1 rounded">
                      TDP Leading: 4
                    </span>
                    <span className="text-[10px] bg-red-50 border border-red-200 text-red-700 font-extrabold px-2.5 py-1 rounded">
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
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                    />
                  </div>

                  {/* Filter pills */}
                  <div className="flex gap-2.5 flex-wrap">
                    {(['ALL', 'TDP LEADING', 'YSRCP LEADING', 'CLOSE CONTEST'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setMandalFilter(tab)}
                        className={`
                          px-3.5 py-1.5 rounded-lg text-xs font-extrabold uppercase transition-all cursor-pointer border
                          ${mandalFilter === tab 
                            ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                          }
                        `}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mandals Grid list */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
                  {filteredMandals.map((mandal) => {
                    const isPending = false;
                    const statusColors = 
                      isPending ? 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse' :
                      mandal.status === 'WINNING' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                      mandal.status === 'TRAILING' ? 'bg-red-50 text-red-800 border-red-200' :
                      'bg-amber-50 text-amber-800 border-amber-200';

                    const marginColor = 
                      mandal.status === 'WINNING' ? 'text-emerald-600' :
                      mandal.status === 'TRAILING' ? 'text-rose-600' :
                      mandal.status === 'CLOSE CONTEST' ? 'text-orange-500' : 'text-slate-600';

                    return (
                      <div 
                        key={mandal.name} 
                        className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 hover:shadow-md transition-shadow flex flex-col justify-between"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">{mandal.name}</h4>
                            <span className={`px-2.5 py-0.5 border rounded text-[9px] font-black tracking-widest uppercase ${statusColors}`}>
                              {mandal.status}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 py-2 text-center text-[10px] font-bold text-slate-500">
                            <div>
                              <span className="block text-slate-400 text-[9px] uppercase font-black">Voters</span>
                              <span className="text-slate-950 font-black text-sm">{isPending ? 'PENDING' : mandal.voters.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="block text-slate-400 text-[9px] uppercase font-black">Villages</span>
                              <span className="text-blue-600 font-black text-sm">{mandal.villages}</span>
                            </div>
                            <div>
                              <span className="block text-slate-400 text-[9px] uppercase font-black">Booths</span>
                              <span className="text-purple-600 font-black text-sm">{isPending ? 'PENDING' : mandal.booths}</span>
                            </div>
                          </div>

                          {/* Party share bar visual */}
                          {isPending ? (
                            <div className="space-y-1 pt-1.5 border-t border-slate-200/60 text-center py-1">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">AWAITING SYSTEM SYNC</span>
                              <div className="w-full h-2 bg-slate-200 rounded-full" />
                            </div>
                          ) : (
                            <div className="space-y-1 pt-1.5 border-t border-slate-200/60">
                              <div className="flex justify-between text-xs font-black">
                                <span className="text-amber-600">TDP: {mandal.voters > 0 ? Math.round(mandal.tdp / mandal.voters * 100) : 0}%</span>
                                <span className="text-blue-600">YSRCP: {mandal.voters > 0 ? Math.round(mandal.ysrcp / mandal.voters * 100) : 0}%</span>
                              </div>
                              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex">
                                <div className="h-full bg-yellow-400" style={{ width: `${mandal.voters > 0 ? (mandal.tdp / mandal.voters * 100) : 0}%` }} />
                                <div className="h-full bg-blue-600" style={{ width: `${mandal.voters > 0 ? (mandal.ysrcp / mandal.voters * 100) : 0}%` }} />
                                <div className="h-full bg-slate-400" style={{ width: `${mandal.voters > 0 ? (mandal.neutral / mandal.voters * 100) : 0}%` }} />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-200/60">
                          <div className="text-[10px] font-bold text-slate-500">
                            {isPending ? (
                              <span className="text-[9px] text-slate-400 font-bold uppercase block">NO ACTIVE SURVEY DATA</span>
                            ) : (
                              <>
                                <span className="text-[11px] font-black text-slate-500 uppercase">Leading: </span>
                                <span className={`text-[13px] md:text-sm font-black uppercase tracking-wide ${
                                  mandal.leading === 'TDP' ? 'text-amber-500' : 'text-blue-600'
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
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black rounded-lg uppercase tracking-wider cursor-pointer"
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
                  <div className="bg-slate-900 text-white rounded-xl p-6 shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <p className="text-[10px] text-yellow-400 font-extrabold uppercase tracking-widest">KONDAPI CONSTITUENCY</p>
                      <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight mt-1">MANDAL DIRECTORY</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Select a mandal to explore real-time booth intelligence and village polling statistics.</p>
                    </div>
                    <div className="bg-slate-850 px-4 py-2.5 rounded-lg border border-slate-800 text-right shrink-0">
                      <span className="block text-[10px] text-yellow-400 font-extrabold uppercase tracking-widest">6 MANDALS • 112 GRAM PANCHAYATS</span>
                      <span className="text-sm font-black text-white">{constituencyStats.voters.toLocaleString()} TOTAL VOTERS</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {mandalsData.map(m => {
                      const statusColors = 
                        m.status === 'WINNING' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                        m.status === 'TRAILING' ? 'bg-red-50 text-red-800 border-red-200' :
                        'bg-amber-50 text-amber-800 border-amber-200';

                      const marginColor = 
                        m.status === 'WINNING' ? 'text-emerald-600' :
                        m.status === 'TRAILING' ? 'text-rose-600' :
                        m.status === 'CLOSE CONTEST' ? 'text-orange-500' : 'text-slate-600';

                      return (
                        <button
                          key={m.name}
                          onClick={() => setSelectedMandalInVillageList(m.name)}
                          className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-yellow-400 hover:shadow-md transition-all flex flex-col justify-between space-y-4 group cursor-pointer"
                        >
                          <div className="w-full space-y-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="text-base font-black text-slate-900 group-hover:text-yellow-600 transition-colors uppercase tracking-tight">{m.name}</h4>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                  <span className="text-blue-600 font-black text-xs">{m.villages}</span> Gram Panchayats
                                </span>
                              </div>
                              <span className={`px-2 py-0.5 border rounded text-[9px] font-black tracking-widest uppercase shrink-0 ${statusColors}`}>
                                {m.status}
                              </span>
                            </div>

                            <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-xs">
                              <div>
                                <span className="block text-[9px] text-slate-400 font-bold uppercase">Total Voters</span>
                                <span className="font-black text-sm text-slate-950">{m.voters.toLocaleString()}</span>
                              </div>
                              <div className="text-right">
                                <span className="block text-[9px] text-slate-400 font-bold uppercase">Booths</span>
                                <span className="font-black text-sm text-purple-600">{m.booths}</span>
                              </div>
                            </div>

                            {/* Progress bars */}
                            <div className="space-y-1 pt-1.5 border-t border-slate-100">
                              <div className="flex justify-between text-xs font-black">
                                <span className="text-amber-600">TDP: {m.voters > 0 ? Math.round(m.tdp / m.voters * 100) : 0}%</span>
                                <span className="text-blue-600">YSRCP: {m.voters > 0 ? Math.round(m.ysrcp / m.voters * 100) : 0}%</span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                                <div className="h-full bg-yellow-400" style={{ width: `${m.voters > 0 ? (m.tdp / m.voters * 100) : 0}%` }} />
                                <div className="h-full bg-blue-600" style={{ width: `${m.voters > 0 ? (m.ysrcp / m.voters * 100) : 0}%` }} />
                                <div className="h-full bg-slate-300" style={{ width: `${m.voters > 0 ? (m.neutral / m.voters * 100) : 0}%` }} />
                              </div>
                            </div>
                          </div>

                          <div className="w-full pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-500">
                            <div>
                              <span className="text-[11px] font-black text-slate-500 uppercase">Leading: </span>
                              <span className={`text-[13px] md:text-sm font-black uppercase tracking-wide ${
                                m.leading === 'TDP' ? 'text-amber-500' : 'text-blue-600'
                              }`}>
                                {m.leading}
                              </span>
                              <span className={`block text-[11px] font-black ${marginColor} mt-0.5`}>
                                Margin: +{m.lead.toLocaleString()} votes
                              </span>
                            </div>
                            <span className="text-yellow-600 font-black uppercase tracking-wider group-hover:translate-x-1 transition-transform flex items-center gap-1">
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
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-100 pb-4 gap-3">
                    <div className="space-y-1">
                      <button
                        onClick={() => setSelectedMandalInVillageList(null)}
                        className="flex items-center gap-2 text-xs font-black text-slate-500 hover:text-slate-950 uppercase tracking-wider cursor-pointer mb-1 transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" /> Back to Mandal Directory
                      </button>
                      <h3 className="text-base font-black uppercase tracking-tight text-slate-950">
                        {selectedMandalInVillageList} Mandal — Village List ({filteredVillages.length})
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Reviewing dynamic polling data and political leanings for all active Gram Panchayats in {selectedMandalInVillageList} Mandal.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 self-start md:self-auto">
                      <span className="px-3 py-1.5 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-lg text-xs font-extrabold uppercase">
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
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                      />
                    </div>

                    {/* Filter pills */}
                    <div className="flex gap-2 flex-wrap">
                      {(['ALL', 'TDP WINNING', 'YSRCP WINNING', 'CLOSE CONTEST'] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setVillageFilter(tab)}
                          className={`
                            px-3.5 py-1.5 rounded-lg text-xs font-extrabold uppercase transition-all cursor-pointer border
                            ${villageFilter === tab 
                              ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                            }
                          `}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Villages Table */}
                  <div className="overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-black uppercase text-[9px] tracking-wider">
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
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {paginatedVillages.map((v, idx) => {
                          const statusColors = 
                            v.status === 'WINNING' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            v.status === 'TRAILING' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            'bg-orange-50 text-orange-700 border-orange-200';

                          return (
                            <tr key={v.name} className="hover:bg-slate-50 font-bold text-slate-700">
                              <td className="py-3 px-4 text-center text-slate-400">{(villagesPage - 1) * villagesPageSize + idx + 1}</td>
                              <td className="py-3 px-4 font-black text-slate-900 uppercase">{v.name}</td>
                              <td className="py-3 px-4 uppercase text-slate-500">{v.mandal}</td>
                              <td className="py-3 px-4 text-right text-slate-900 font-extrabold text-sm">{v.voters.toLocaleString()}</td>
                              <td className="py-3 px-4 text-right">
                                <span className="text-amber-500 font-black text-sm">{v.tdp.toLocaleString()}</span>
                                <span className="block text-[10px] text-amber-500 font-black">({Math.round(v.tdp / v.voters * 100)}%)</span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="text-blue-600 font-black text-sm">{v.ysrcp.toLocaleString()}</span>
                                <span className="block text-[10px] text-blue-600 font-black">({Math.round(v.ysrcp / v.voters * 100)}%)</span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="text-slate-600 font-black text-sm">{v.neutral.toLocaleString()}</span>
                                <span className="block text-[10px] text-slate-500 font-black">({Math.round(v.neutral / v.voters * 100)}%)</span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className={`inline-block font-black text-sm px-2 py-0.5 rounded ${v.leading === 'TDP' ? 'text-amber-600 bg-amber-50 border border-amber-200' : 'text-blue-600 bg-blue-50 border border-blue-200'}`}>
                                  {v.leading} +{v.lead.toLocaleString()}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={`px-2.5 py-1 border rounded text-[9px] font-black uppercase tracking-wider ${statusColors}`}>
                                  {v.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  onClick={() => setDrilledMandal(v.mandal)}
                                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white border border-slate-850 rounded text-[9px] font-black uppercase tracking-wider cursor-pointer transition-colors"
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
                    accentColor="amber"
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
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">High Command Tasks</h3>
                  <p className="text-xs text-slate-500">Priority strategic actions assigned to the Constituency Incharge by the Central TDP Office.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                  {tasksList.map(task => {
                    const priorityColor = 
                      task.priority === 'HIGH PRIORITY' ? 'bg-red-50 text-red-800 border-red-200' :
                      task.priority === 'MEDIUM PRIORITY' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                      'bg-slate-50 text-slate-800 border-slate-200';

                    const statusColor = 
                      task.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                      task.status === 'IN PROGRESS' ? 'bg-blue-100 text-blue-800' :
                      'bg-slate-100 text-slate-800';

                    return (
                      <div 
                        key={task.id} 
                        className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className={`px-2.5 py-0.5 border rounded text-[9px] font-black uppercase tracking-widest ${priorityColor}`}>
                              {task.priority}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${statusColor}`}>
                              {task.status}
                            </span>
                          </div>
                          
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{task.title}</h4>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed">{task.description}</p>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-200/60 pt-3 mt-1.5">
                          <span className="text-[10px] text-slate-400 font-bold">DUE DATE: {task.dueDate}</span>
                          <button
                            onClick={() => setSelectedTask(task)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black rounded-lg uppercase tracking-wider cursor-pointer"
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
                <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[9px] font-black text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded uppercase tracking-widest">
                          {selectedTask.priority}
                        </span>
                        <h4 className="text-base font-black text-slate-950 uppercase mt-1.5">{selectedTask.title}</h4>
                      </div>
                      <button 
                        onClick={() => setSelectedTask(null)}
                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-2 border-y border-slate-100 py-3 text-xs leading-relaxed text-slate-600 font-medium">
                      <p>{selectedTask.description}</p>
                      
                      <div className="bg-slate-50 border border-slate-150 rounded-lg p-3 space-y-1.5 font-bold mt-3">
                        <p className="text-[10px] text-slate-400 font-black uppercase">Action Progress Checklist:</p>
                        <div className="flex items-center gap-2 text-slate-800">
                          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span>Assign task coordinators in each mandal</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-800">
                          {selectedTask.status === 'COMPLETED' ? (
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <span className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                          )}
                          <span>Consolidate field visit tracking logs</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-800">
                          <span className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
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
                              void updateTaskStatus(selectedTask.id, 'Completed').catch(() => {
                              });
                              setSelectedTask(null);
                            }}
                            className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black rounded-lg text-[10px] uppercase cursor-pointer"
                          >
                            Mark Complete
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedTask(null)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-lg text-[10px] uppercase cursor-pointer"
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 bg-yellow-50 text-yellow-600 rounded-xl border border-yellow-100 shadow-sm shrink-0">
                      <FileText className="w-5.5 h-5.5" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Caste & Demographic Analytics</h2>
                      <p className="text-[11px] text-slate-500 font-bold uppercase mt-0.5">
                        Detailed breakdown of {demoLevel === 'constituency' ? 'Constituency' : demoLevel === 'mandal' ? `${demoMandal} Mandal` : `${demoVillage} Village`}: {formattedActiveVoters} Voters
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-right shadow-sm shrink-0 min-w-[140px]">
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider">ACTIVE VIEW VOTERS</p>
                    <p className="text-base font-black text-slate-900 tracking-tight mt-0.5">{formattedActiveVoters}</p>
                  </div>
                </div>

                {/* TABS CONTAINER */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-wrap border-b border-slate-200 gap-6 md:gap-8 text-[11px] font-black uppercase tracking-wider pb-px">
                    <button
                      onClick={() => setDemoLevel('constituency')}
                      className={`flex items-center gap-2 pb-3 transition-all cursor-pointer border-b-2 ${
                        demoLevel === 'constituency'
                          ? 'border-slate-900 text-slate-900 font-black'
                          : 'border-transparent text-slate-400 hover:text-slate-800'
                      }`}
                    >
                      <Home className={`w-4 h-4 ${demoLevel === 'constituency' ? 'text-slate-800' : 'text-slate-400'}`} />
                      Constituency Level
                    </button>
                    <button
                      onClick={() => setDemoLevel('mandal')}
                      className={`flex items-center gap-2 pb-3 transition-all cursor-pointer border-b-2 ${
                        demoLevel === 'mandal'
                          ? 'border-slate-900 text-slate-900 font-black'
                          : 'border-transparent text-slate-400 hover:text-slate-800'
                      }`}
                    >
                      <Compass className={`w-4 h-4 ${demoLevel === 'mandal' ? 'text-slate-800' : 'text-slate-400'}`} />
                      Mandal Level Analytics
                    </button>
                    <button
                      onClick={() => setDemoLevel('village')}
                      className={`flex items-center gap-2 pb-3 transition-all cursor-pointer border-b-2 ${
                        demoLevel === 'village'
                          ? 'border-slate-900 text-slate-900 font-black'
                          : 'border-transparent text-slate-400 hover:text-slate-800'
                      }`}
                    >
                      <MapPin className={`w-4 h-4 ${demoLevel === 'village' ? 'text-slate-800' : 'text-slate-400'}`} />
                      Village Level Analytics
                    </button>
                  </div>

                  {/* Granular Drill Down Selectors */}
                  {demoLevel !== 'constituency' && (
                    <div className="flex flex-wrap gap-4 bg-slate-50 border border-slate-150 p-4 rounded-xl">
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
                          className="bg-white border border-slate-200 rounded px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-yellow-400"
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
                            className="bg-white border border-slate-200 rounded px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-yellow-400"
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* 1. SUB-CASTE ANALYSIS */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-500" />
                          <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight">Sub-Caste Analysis</h3>
                        </div>
                        <span className="bg-slate-100 border border-slate-200 text-slate-500 font-mono text-[9px] font-black px-2 py-0.5 rounded uppercase">
                          N={formattedActiveVoters}
                        </span>
                      </div>

                      {/* Chart Container */}
                      <div className="relative pt-1">
                        {/* Gridlines Background */}
                        <div className="absolute inset-y-0 left-[120px] right-0 flex justify-between pointer-events-none pl-3 pr-1">
                          <div className="w-px h-full border-l border-dashed border-slate-100"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-150"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-150"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-150"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-150"></div>
                        </div>

                        {/* Bar Rows */}
                        <div className="relative space-y-3.5 z-10">
                          {demoCasteData.map((item, idx) => {
                            const barWidthPercent = (item.voters / maxCasteVoters) * 100;
                            const formattedVoters = (item.voters / 1000).toFixed(1) + ' k';
                            return (
                              <div key={idx} className="flex items-center min-h-[22px]">
                                {/* Label */}
                                <div className="w-[120px] text-right pr-3 text-[10px] font-bold text-slate-500 truncate uppercase">
                                  {item.name} ({formattedVoters})
                                </div>
                                {/* Axis Line */}
                                <div className="w-px h-5.5 bg-slate-300 self-stretch"></div>
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
                                      <div className="h-full bg-slate-300" style={{ width: `${item.neutralPref}%` }} />
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
                    <div className="flex justify-center gap-5 pt-3.5 border-t border-slate-100 text-[9px] font-black uppercase tracking-wider text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-yellow-400 rounded-sm"></div>
                        <span>TDP Support</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-blue-600 rounded-sm"></div>
                        <span>YSRCP Support</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-slate-300 rounded-sm"></div>
                        <span>Neutral</span>
                      </div>
                    </div>
                  </div>

                  {/* 2. PROFESSION ANALYSIS */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-slate-500" />
                          <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight">Profession Analysis</h3>
                        </div>
                        <span className="bg-slate-100 border border-slate-200 text-slate-500 font-mono text-[9px] font-black px-2 py-0.5 rounded uppercase">
                          N={formattedActiveVoters}
                        </span>
                      </div>

                      {/* Chart Container */}
                      <div className="relative pt-1">
                        {/* Gridlines Background */}
                        <div className="absolute inset-y-0 left-[140px] right-0 flex justify-between pointer-events-none pl-3 pr-1">
                          <div className="w-px h-full border-l border-dashed border-slate-100"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-150"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-150"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-150"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-150"></div>
                        </div>

                        {/* Bar Rows */}
                        <div className="relative space-y-3.5 z-10">
                          {demoProfessionData.map((item, idx) => {
                            const barWidthPercent = (item.voters / maxProfessionVoters) * 100;
                            const formattedVoters = (item.voters / 1000).toFixed(1) + ' k';
                            return (
                              <div key={idx} className="flex items-center min-h-[22px]">
                                {/* Label */}
                                <div className="w-[140px] text-right pr-3 text-[10px] font-bold text-slate-500 truncate uppercase">
                                  {item.name.replace("Farmers / Agri Workers", "Farmer").replace("Private Employee", "Private Job").replace("Homemakers", "Homemaker").replace("Students / Youth", "Student").replace("Business Owners", "Business")} ({formattedVoters})
                                </div>
                                {/* Axis Line */}
                                <div className="w-px h-5.5 bg-slate-300 self-stretch"></div>
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
                                      <div className="h-full bg-slate-300" style={{ width: `${item.neutralPref}%` }} />
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
                    <div className="flex justify-center gap-5 pt-3.5 border-t border-slate-100 text-[9px] font-black uppercase tracking-wider text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-yellow-400 rounded-sm"></div>
                        <span>TDP Support</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-blue-600 rounded-sm"></div>
                        <span>YSRCP Support</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-slate-300 rounded-sm"></div>
                        <span>Neutral</span>
                      </div>
                    </div>
                  </div>

                  {/* 3. AGE GROUP ANALYSIS */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-500" />
                          <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight">Age Group Analysis</h3>
                        </div>
                        <span className="bg-slate-100 border border-slate-200 text-slate-500 font-mono text-[9px] font-black px-2 py-0.5 rounded uppercase">
                          N={formattedActiveVoters}
                        </span>
                      </div>

                      {/* Chart Container */}
                      <div className="relative pt-1">
                        {/* Gridlines Background */}
                        <div className="absolute inset-y-0 left-[120px] right-0 flex justify-between pointer-events-none pl-3 pr-1">
                          <div className="w-px h-full border-l border-dashed border-slate-100"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-150"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-150"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-150"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-150"></div>
                        </div>

                        {/* Bar Rows */}
                        <div className="relative space-y-3.5 z-10">
                          {demoAgeData.map((item, idx) => {
                            const barWidthPercent = (item.voters / maxAgeVoters) * 100;
                            const formattedVoters = (item.voters / 1000).toFixed(1) + ' k';
                            return (
                              <div key={idx} className="flex items-center min-h-[22px]">
                                {/* Label */}
                                <div className="w-[120px] text-right pr-3 text-[10px] font-bold text-slate-500 truncate uppercase">
                                  {item.group.replace(" (Youth)", "").replace(" (Middle)", "").replace(" (Senior)", "").replace(" (Elders)", "")} ({formattedVoters})
                                </div>
                                {/* Axis Line */}
                                <div className="w-px h-5.5 bg-slate-300 self-stretch"></div>
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
                                      <div className="h-full bg-slate-300" style={{ width: `${item.neutralPref}%` }} />
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
                    <div className="flex justify-center gap-5 pt-3.5 border-t border-slate-100 text-[9px] font-black uppercase tracking-wider text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-yellow-400 rounded-sm"></div>
                        <span>TDP Support</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-blue-600 rounded-sm"></div>
                        <span>YSRCP Support</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-slate-300 rounded-sm"></div>
                        <span>Neutral</span>
                      </div>
                    </div>
                  </div>

                  {/* 4. GENDER ANALYSIS */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-500" />
                          <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight">Gender Analysis</h3>
                        </div>
                        <span className="bg-slate-100 border border-slate-200 text-slate-500 font-mono text-[9px] font-black px-2 py-0.5 rounded uppercase">
                          N={formattedActiveVoters}
                        </span>
                      </div>

                      {/* Chart Container */}
                      <div className="relative pt-1">
                        {/* Gridlines Background */}
                        <div className="absolute inset-y-0 left-[120px] right-0 flex justify-between pointer-events-none pl-3 pr-1">
                          <div className="w-px h-full border-l border-dashed border-slate-100"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-150"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-150"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-150"></div>
                          <div className="w-px h-full border-l border-dashed border-slate-150"></div>
                        </div>

                        {/* Bar Rows */}
                        <div className="relative space-y-3.5 z-10">
                          {demoGenderData.map((item, idx) => {
                            const barWidthPercent = (item.voters / maxGenderVoters) * 100;
                            const formattedVoters = (item.voters / 1000).toFixed(1) + ' k';
                            return (
                              <div key={idx} className="flex items-center min-h-[22px]">
                                {/* Label */}
                                <div className="w-[120px] text-right pr-3 text-[10px] font-bold text-slate-500 truncate uppercase">
                                  {item.name} ({formattedVoters})
                                </div>
                                {/* Axis Line */}
                                <div className="w-px h-5.5 bg-slate-300 self-stretch"></div>
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
                                      <div className="h-full bg-slate-300" style={{ width: `${item.neutralPref}%` }} />
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
                    <div className="flex justify-center gap-5 pt-3.5 border-t border-slate-100 text-[9px] font-black uppercase tracking-wider text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-yellow-400 rounded-sm"></div>
                        <span>TDP Support</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-blue-600 rounded-sm"></div>
                        <span>YSRCP Support</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-slate-300 rounded-sm"></div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
                {[
                  { title: 'Constituency', count: 1, color: 'text-slate-950 bg-slate-50 border-slate-200' },
                  { title: 'Mandals Covered', count: liveConstituencyStats.totalMandals, color: 'text-slate-950 bg-slate-50 border-slate-200' },
                  { title: 'Villages Covered', count: cadreStats.villages || liveConstituencyStats.totalVillages, color: 'text-blue-600 bg-blue-50/30 border-blue-200' },
                  { title: 'Booths Covered', count: cadreStats.booths || liveConstituencyStats.totalBooths, color: 'text-purple-600 bg-purple-50/30 border-purple-200' },
                  { title: '100-Voter Incharges', count: cadreStats.voterIncharges, color: 'text-amber-500 bg-amber-50/50 border-amber-300' }
                ].map(card => (
                  <div key={card.title} className={`${card.color} border-2 rounded-xl p-4 shadow-sm text-center flex flex-col justify-between`}>
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">{card.title}</span>
                    <span className="text-2xl font-black mt-1 block tracking-tight">{card.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Strength & Health Report */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Network Strength & Health Report</h3>
                  <p className="text-xs text-slate-500">Verification counts, active member ratios, and directory of working leaders.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Performance Indicators */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5 flex flex-col justify-center">
                    <div className="flex justify-between items-center text-xs font-bold border-b border-slate-200/60 pb-2">
                      <span className="text-slate-500">Active Members:</span>
                      <span className="text-emerald-600 font-black text-sm">{cadreStats.activeMembers} ({cadreStats.totalCadres > 0 ? ((cadreStats.activeMembers / cadreStats.totalCadres) * 100).toFixed(1) : '0.0'}%)</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold border-b border-slate-200/60 pb-2">
                      <span className="text-slate-500">Inactive Members:</span>
                      <span className="text-rose-600 font-black text-sm">{cadreStats.inactiveMembers} ({cadreStats.totalCadres > 0 ? ((cadreStats.inactiveMembers / cadreStats.totalCadres) * 100).toFixed(1) : '0.0'}%)</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold pb-1">
                      <span className="text-slate-500">Network Coverage:</span>
                      <span className="text-emerald-600 font-black text-sm bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-100">{liveConstituencyStats.totalBooths > 0 && cadreStats.booths > 0 ? Math.round((cadreStats.booths / liveConstituencyStats.totalBooths) * 100) : 0}% of Booths</span>
                    </div>
                  </div>

                  {/* Interactive Cadre Drill-Down selectors */}
                  <div className="md:col-span-2 space-y-4">
                    <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                      <Sparkles className="w-4 h-4 text-yellow-500" />
                      <h4 className="text-[11px] font-black text-slate-900 uppercase">Interactive Cadre Directory</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase">Mandal</label>
                        <select 
                          value={cadreSelectMandal}
                          onChange={(e) => setCadreSelectMandal(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none"
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
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none"
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
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none"
                        >
                          {cadreBoothOptions.map((booth) => (
                            <option key={booth} value={booth}>{booth}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Hierarchy Flow Chart List */}
                    <div className="space-y-3.5 bg-slate-50 border border-slate-150 rounded-xl p-4 text-xs font-bold">
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded bg-slate-900 text-yellow-400 text-[10px] font-black flex items-center justify-center shrink-0">M</span>
                        <div>
                          <p className="text-[9px] text-slate-400 font-black uppercase">Mandal President</p>
                          <p className="text-slate-900 font-extrabold">{derivedCadreDirectory.mandalIncharge?.name || 'Unavailable'} ({derivedCadreDirectory.mandalIncharge?.mobileNumber || 'N/A'})</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded bg-slate-800 text-white text-[10px] font-black flex items-center justify-center shrink-0">V</span>
                        <div>
                          <p className="text-[9px] text-slate-400 font-black uppercase">Village Coordinator</p>
                          <p className="text-slate-900 font-extrabold">{derivedCadreDirectory.villageIncharge?.name || 'Unavailable'} ({derivedCadreDirectory.villageIncharge?.mobileNumber || 'N/A'})</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded bg-yellow-400 text-slate-950 text-[10px] font-black flex items-center justify-center shrink-0">B</span>
                        <div>
                          <p className="text-[9px] text-slate-400 font-black uppercase">Booth Incharge ({derivedCadreDirectory.boothIncharge?.unitName || cadreSelectBooth})</p>
                          <p className="text-slate-900 font-extrabold">{derivedCadreDirectory.boothIncharge?.name || 'Unavailable'} ({derivedCadreDirectory.boothIncharge?.mobileNumber || 'N/A'})</p>
                        </div>
                      </div>

                      <div className="border-t border-slate-200/60 pt-2.5">
                        <p className="text-[9px] text-slate-400 font-black uppercase mb-1.5">100-Voter Ground Incharges assigned to this booth:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          {derivedCadreDirectory.voter100List.map((item, idx) => (
                            <div key={idx} className="bg-white border border-slate-200 rounded p-2 flex items-center justify-between">
                              <div>
                                <p className="text-slate-900 font-extrabold uppercase text-[10px]">{item.name}</p>
                                <p className="text-[9px] text-slate-400 font-mono mt-0.5">{item.mobile}</p>
                              </div>
                              <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-md font-black">{item.votersCount} Voters</span>
                            </div>
                          ))}
                          {derivedCadreDirectory.voter100List.length === 0 && (
                            <div className="bg-white border border-slate-200 rounded p-2 text-slate-400 font-semibold col-span-full">
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
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Identified / Flagged Voter Records</h3>
                  <p className="text-xs text-slate-500">Monitor and audit potential duplicates, shifted residences, or address discrepancies undergoing investigation.</p>
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
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                    />
                  </div>

                  {/* Filter pills */}
                  <div className="flex gap-2 flex-wrap">
                    {['ALL', 'FLAGGED', 'UNDER VERIFICATION', 'VERIFIED ISSUE', 'RESOLVED'].map(tab => (
                      <button
                        key={tab}
                        onClick={() => setFakeFilterStatus(tab)}
                        className={`
                          px-3.5 py-1.5 rounded-lg text-xs font-extrabold uppercase transition-all cursor-pointer border
                          ${fakeFilterStatus === tab 
                            ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                          }
                        `}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Flagged table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-black uppercase text-[9px] tracking-wider">
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
                    <tbody className="divide-y divide-slate-100">
                      {paginatedFlaggedVoters.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                            No flagged or doubtful voters found in records.
                          </td>
                        </tr>
                      ) : paginatedFlaggedVoters.map((item, idx) => {
                        const statusColors = 
                          item.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' :
                          item.status === 'VERIFIED ISSUE' ? 'bg-red-100 text-red-800' :
                          item.status === 'UNDER VERIFICATION' ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-100 text-slate-800';

                        return (
                          <tr key={item.sNo} className="hover:bg-slate-50 font-bold text-slate-700">
                            <td className="py-3 px-4 text-center text-slate-400">{(flaggedPage - 1) * flaggedPageSize + idx + 1}</td>
                            <td className="py-3 px-4 font-black text-slate-900 uppercase">{item.name}</td>
                            <td className="py-3 px-4 font-mono text-slate-500">{item.epic}</td>
                            <td className="py-3 px-4 text-center text-slate-600">{item.age} / {item.gender[0]}</td>
                            <td className="py-3 px-4 uppercase text-slate-900">{item.village}</td>
                            <td className="py-3 px-4 uppercase text-slate-500">{item.booth}</td>
                            <td className="py-3 px-4 text-slate-600">{item.reason}</td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${statusColors}`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => setAuditingVoter(item)}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white border border-slate-900 rounded text-[9px] font-black uppercase tracking-wider cursor-pointer"
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

                <Pagination
                  currentPage={flaggedPage}
                  pageSize={flaggedPageSize}
                  totalItems={filteredFlaggedVoters.length}
                  onPageChange={setFlaggedPage}
                  onPageSizeChange={(newSize) => {
                    setFlaggedPageSize(newSize);
                    setFlaggedPage(1);
                  }}
                  pageSizeOptions={[10, 15, 25, 50]}
                  itemName="flagged voters"
                  accentColor="amber"
                />

              </div>

              {/* Audit/Verification Status Update Modal */}
              {auditingVoter && (
                <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-fade-in">
                  <form onSubmit={handleUpdateVoterStatus} className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
                    <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="text-base font-black text-slate-950 uppercase">Update Verification Status</h4>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Voter EPIC: {auditingVoter.epic}</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setAuditingVoter(null)}
                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-4 text-xs font-bold text-slate-700">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase">Voter Profile:</p>
                        <p className="text-slate-950 text-sm font-black mt-0.5">{auditingVoter.name} ({auditingVoter.age} / {auditingVoter.gender})</p>
                        <p className="text-slate-500 text-[11px] uppercase mt-0.5">Location: {auditingVoter.village} &bull; {auditingVoter.booth}</p>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-slate-400 uppercase">Verification Reason Flagged</label>
                        <input 
                          type="text" 
                          value={auditingVoter.reason}
                          onChange={(e) => setAuditingVoter({ ...auditingVoter, reason: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-slate-400 uppercase">Audit Status Decision</label>
                        <select
                          value={auditingVoter.status}
                          onChange={(e) => setAuditingVoter({ ...auditingVoter, status: e.target.value as any })}
                          className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 font-extrabold focus:outline-none"
                        >
                          <option value="FLAGGED">FLAGGED (NOT VERIFIED)</option>
                          <option value="UNDER VERIFICATION">UNDER VERIFICATION</option>
                          <option value="VERIFIED ISSUE">VERIFIED ISSUE</option>
                          <option value="RESOLVED">RESOLVED / VERIFIED OK</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setAuditingVoter(null)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-lg text-[10px] uppercase cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-lg text-[10px] uppercase cursor-pointer"
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
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Training Completion Analytics</h3>
                  <p className="text-xs text-slate-500">Track and assess completion statistics of crucial operational modules across all cadre network layers.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { title: 'Total Cadre', count: trainingStats.totalCadres, stat: '100%', bg: 'bg-slate-50 border-slate-200', countColor: 'text-slate-950 text-2xl', badgeColor: 'bg-slate-100 text-slate-700' },
                    { title: 'Fully Trained', count: trainingStats.completed, stat: `${trainingStats.totalCadres > 0 ? ((trainingStats.completed / trainingStats.totalCadres) * 100).toFixed(1) : '0.0'}%`, bg: 'bg-emerald-50 border-emerald-200', countColor: 'text-emerald-700 text-2xl', badgeColor: 'bg-emerald-100 text-emerald-800' },
                    { title: 'In Progress', count: trainingStats.watched + trainingStats.assigned, stat: `${trainingStats.totalCadres > 0 ? (((trainingStats.watched + trainingStats.assigned) / trainingStats.totalCadres) * 100).toFixed(1) : '0.0'}%`, bg: 'bg-amber-50 border-amber-200', countColor: 'text-amber-700 text-2xl', badgeColor: 'bg-amber-100 text-amber-800' },
                    { title: 'Not Started', count: trainingStats.notStarted, stat: `${trainingStats.totalCadres > 0 ? ((trainingStats.notStarted / trainingStats.totalCadres) * 100).toFixed(1) : '0.0'}%`, bg: 'bg-rose-50 border-rose-200', countColor: 'text-rose-700 text-2xl', badgeColor: 'bg-rose-100 text-rose-800' }
                  ].map(stat => (
                    <div key={stat.title} className={`${stat.bg} border-2 rounded-xl p-4 text-center flex flex-col justify-between space-y-1`}>
                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">{stat.title}</span>
                      <span className={`${stat.countColor} font-black mt-1 block`}>{stat.count}</span>
                      <span className={`text-[11px] font-mono font-black mt-1 inline-block mx-auto px-2 py-0.5 rounded ${stat.badgeColor}`}>{stat.stat}</span>
                    </div>
                  ))}
                </div>

                {/* Progress breakdown of modules */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-slate-100 text-xs font-bold text-slate-700">
                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-slate-950 uppercase mb-2">Campaign Operational Modules Progress</h4>
                    
                    {[
                      { module: 'Door-to-Door Campaign Training', completion: 94 },
                      { module: 'Voter Data Collection Guidelines', completion: 91 },
                      { module: 'Command App Usage Instructions', completion: 88 },
                      { module: 'Polling Booth Management', completion: 82 },
                      { module: 'Ground Incident Reporting', completion: 78 }
                    ].map(mod => (
                      <div key={mod.module} className="space-y-1">
                        <div className="flex justify-between">
                          <span>{mod.module}</span>
                          <span className="text-slate-900 font-extrabold">{mod.completion}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-400" style={{ width: `${mod.completion}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-3">
                    <h5 className="text-[11px] font-black text-slate-950 uppercase border-b border-slate-200 pb-1.5">Cadre Layer Performance</h5>
                    
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Mandal Incharges Trained:</span>
                        <span className="text-slate-900 font-extrabold">{cadreItems.filter((item) => item.role === 'MANDAL_INCHARGE').length > 0 ? `${cadreItems.filter((item) => item.role === 'MANDAL_INCHARGE' && item.completedTraining > 0).length}/${cadreItems.filter((item) => item.role === 'MANDAL_INCHARGE').length}` : '0/0'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Village Incharges Trained:</span>
                        <span className="text-slate-900 font-extrabold">{cadreItems.filter((item) => item.role === 'VILLAGE_INCHARGE').length > 0 ? `${cadreItems.filter((item) => item.role === 'VILLAGE_INCHARGE' && item.completedTraining > 0).length}/${cadreItems.filter((item) => item.role === 'VILLAGE_INCHARGE').length}` : '0/0'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Booth Incharges Trained:</span>
                        <span className="text-slate-900 font-extrabold">{cadreItems.filter((item) => item.role === 'BOOTH_PRESIDENT').length > 0 ? `${cadreItems.filter((item) => item.role === 'BOOTH_PRESIDENT' && item.completedTraining > 0).length}/${cadreItems.filter((item) => item.role === 'BOOTH_PRESIDENT').length}` : '0/0'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">100-Voter Leaders Trained:</span>
                        <span className="text-slate-900 font-extrabold">{cadreItems.filter((item) => item.role === 'VOTER_100_INCHARGE').length > 0 ? `${cadreItems.filter((item) => item.role === 'VOTER_100_INCHARGE' && item.completedTraining > 0).length}/${cadreItems.filter((item) => item.role === 'VOTER_100_INCHARGE').length}` : '0/0'}</span>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-150 rounded p-3 text-[10px] text-slate-500 leading-relaxed font-semibold">
                      <span className="text-slate-900 uppercase font-black block mb-0.5">Campaign Coordinator Note:</span>
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
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Live Voter Turnout Tracking</h3>
                      <p className="text-xs text-slate-500">Track real-time verified voting speed, queue sizes, and polling station aggregate reports submitted by authorized field agents.</p>
                    </div>
                    
                    {/* Simulation toggle button */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => { void refreshLiveTurnoutSummary(); }}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border cursor-pointer ${
                          isRefreshingLiveTurnout
                            ? 'bg-amber-500 border-amber-600 text-white animate-pulse'
                            : 'bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-white'
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-center">
                      
                      {/* Step 1: Total Assigned */}
                      <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-slate-400"></div>
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Total Voters Assigned</span>
                        <span className="text-2xl font-black text-slate-900 mt-1">
                          {totalAssigned.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                          100% of Constituency
                        </span>
                      </div>

                      {/* Flow Arrow */}
                      <div className="hidden md:flex justify-center text-slate-300">
                        <ChevronRight className="w-5 h-5 animate-pulse" />
                      </div>

                      {/* Step 2: Total Polled */}
                      <div className="md:col-span-2 bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Total Votes Polled</span>
                        <span className="text-2xl font-black text-emerald-600 mt-1">
                          {totalVotesPolled.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-black uppercase mt-1">
                          {totalAssigned > 0 ? ((totalVotesPolled / totalAssigned) * 100).toFixed(2) : '0.00'}% Turnout Rate
                        </span>
                      </div>

                      {/* Flow Arrow */}
                      <div className="hidden md:flex justify-center text-slate-300">
                        <ChevronRight className="w-5 h-5 animate-pulse" />
                      </div>

                      {/* Step 3: Pending */}
                      <div className="md:col-span-2 bg-amber-50/50 border border-amber-200 rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Pending / Not Yet Updated</span>
                        <span className="text-2xl font-black text-amber-600 mt-1">
                          {pendingVotes.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-amber-600 font-black uppercase mt-1">
                          {totalAssigned > 0 ? ((pendingVotes / totalAssigned) * 100).toFixed(2) : '0.00'}% Outstanding
                        </span>
                      </div>

                    </div>
                  </div>
                </div>

                {/* Party-wise Aggregate Count (Polled Vote Share) */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h4 className="text-xs font-black text-slate-950 uppercase tracking-tight">Party-wise Aggregate Count</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Calculated dynamically from real-time field-level aggregate updates. Strictly confidential and secure, no individual preferences are stored.</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {/* TDP */}
                    <div className="bg-yellow-50/50 border border-yellow-200 rounded-xl p-3.5 space-y-2 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-12 h-12 bg-yellow-400/5 rounded-full -mr-4 -mt-4" />
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 border border-yellow-500" />
                        <span className="text-[10px] text-slate-600 font-extrabold uppercase tracking-wide">TDP (Our Party)</span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xl font-black text-slate-900">{partyAggregates.TDP.toLocaleString()}</p>
                        <p className="text-[10px] text-yellow-700 font-extrabold">{totalVotesPolled > 0 ? ((partyAggregates.TDP / totalVotesPolled) * 100).toFixed(1) : '0.0'}% Share</p>
                      </div>
                      <div className="w-full h-1.5 bg-yellow-100 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${totalVotesPolled > 0 ? (partyAggregates.TDP / totalVotesPolled) * 100 : 0}%` }} />
                      </div>
                    </div>

                    {/* YSRCP */}
                    <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-3.5 space-y-2 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-12 h-12 bg-blue-400/5 rounded-full -mr-4 -mt-4" />
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-blue-600" />
                        <span className="text-[10px] text-slate-600 font-extrabold uppercase tracking-wide">YSRCP</span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xl font-black text-slate-900">{partyAggregates.YSRCP.toLocaleString()}</p>
                        <p className="text-[10px] text-blue-700 font-extrabold">{totalVotesPolled > 0 ? ((partyAggregates.YSRCP / totalVotesPolled) * 100).toFixed(1) : '0.0'}% Share</p>
                      </div>
                      <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${totalVotesPolled > 0 ? (partyAggregates.YSRCP / totalVotesPolled) * 100 : 0}%` }} />
                      </div>
                    </div>

                    {/* JSP */}
                    <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-3.5 space-y-2 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-12 h-12 bg-rose-400/5 rounded-full -mr-4 -mt-4" />
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-rose-600" />
                        <span className="text-[10px] text-slate-600 font-extrabold uppercase tracking-wide">JSP</span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xl font-black text-slate-900">{partyAggregates.JSP.toLocaleString()}</p>
                        <p className="text-[10px] text-rose-700 font-extrabold">{totalVotesPolled > 0 ? ((partyAggregates.JSP / totalVotesPolled) * 100).toFixed(1) : '0.0'}% Share</p>
                      </div>
                      <div className="w-full h-1.5 bg-rose-100 rounded-full overflow-hidden">
                        <div className="h-full bg-rose-500 rounded-full" style={{ width: `${totalVotesPolled > 0 ? (partyAggregates.JSP / totalVotesPolled) * 100 : 0}%` }} />
                      </div>
                    </div>

                    {/* BJP */}
                    <div className="bg-orange-50/50 border border-orange-200 rounded-xl p-3.5 space-y-2 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-12 h-12 bg-orange-400/5 rounded-full -mr-4 -mt-4" />
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-orange-500 border border-orange-600" />
                        <span className="text-[10px] text-slate-600 font-extrabold uppercase tracking-wide">BJP</span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xl font-black text-slate-900">{partyAggregates.BJP.toLocaleString()}</p>
                        <p className="text-[10px] text-orange-700 font-extrabold">{totalVotesPolled > 0 ? ((partyAggregates.BJP / totalVotesPolled) * 100).toFixed(1) : '0.0'}% Share</p>
                      </div>
                      <div className="w-full h-1.5 bg-orange-100 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full" style={{ width: `${totalVotesPolled > 0 ? (partyAggregates.BJP / totalVotesPolled) * 100 : 0}%` }} />
                      </div>
                    </div>

                    {/* INC */}
                    <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3.5 space-y-2 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-400/5 rounded-full -mr-4 -mt-4" />
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-600" />
                        <span className="text-[10px] text-slate-600 font-extrabold uppercase tracking-wide">INC</span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xl font-black text-slate-900">{partyAggregates.INC.toLocaleString()}</p>
                        <p className="text-[10px] text-emerald-700 font-extrabold">{totalVotesPolled > 0 ? ((partyAggregates.INC / totalVotesPolled) * 100).toFixed(1) : '0.0'}% Share</p>
                      </div>
                      <div className="w-full h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${totalVotesPolled > 0 ? (partyAggregates.INC / totalVotesPolled) * 100 : 0}%` }} />
                      </div>
                    </div>

                    {/* Others */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-12 h-12 bg-slate-400/5 rounded-full -mr-4 -mt-4" />
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-slate-500" />
                        <span className="text-[10px] text-slate-600 font-extrabold uppercase tracking-wide">Others</span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xl font-black text-slate-900">{partyAggregates.Others.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-500 font-bold">{totalVotesPolled > 0 ? ((partyAggregates.Others / totalVotesPolled) * 100).toFixed(1) : '0.0'}% Share</p>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-400 rounded-full" style={{ width: `${totalVotesPolled > 0 ? (partyAggregates.Others / totalVotesPolled) * 100 : 0}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Stacked Proportional Bar chart */}
                  <div className="pt-2 space-y-1">
                    <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                      <span>Proportional Polled Vote Composition</span>
                      <span>Total Votes Polled: {totalVotesPolled.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-5 rounded-lg overflow-hidden flex shadow-sm border border-slate-100">
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
                      <div className="bg-slate-400 h-full transition-all duration-300 relative group" style={{ width: `${totalVotesPolled > 0 ? (partyAggregates.Others / totalVotesPolled) * 100 : 0}%` }}>
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white truncate px-1">OTH</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Two columns layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left side: Mandal-wise Turnout stats (Lg: col-span-5) */}
                  <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <h4 className="text-xs font-black text-slate-950 uppercase tracking-tight">Mandal Turnout Summary</h4>
                      <span className="text-[10px] bg-slate-100 text-slate-500 font-mono px-2 py-0.5 rounded font-black">Turnout Rate</span>
                    </div>

                    <div className="space-y-4">
                      {liveMandalStats.map((mandal) => {
                        const speedColor = 
                          mandal.status === 'HIGH SPEED' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
                          mandal.status === 'CROWDED' ? 'text-rose-600 bg-rose-50 border-rose-200' :
                          mandal.status === 'SLOW' ? 'text-amber-600 bg-amber-50 border-amber-200' :
                          'text-slate-600 bg-slate-50 border-slate-200';

                        return (
                          <div key={mandal.name} className="border border-slate-100 rounded-xl p-3.5 space-y-2 bg-slate-50/50">
                            <div className="flex justify-between items-start">
                              <div>
                                <h5 className="font-extrabold text-slate-900 uppercase text-xs">{mandal.name}</h5>
                                <span className="text-[10px] text-slate-400 font-bold">
                                  {mandal.cast.toLocaleString()} / {mandal.total.toLocaleString()} votes
                                </span>
                              </div>
                              <span className={`px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider ${speedColor}`}>
                                {mandal.status}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] font-black">
                                <span className="text-slate-500">Progress</span>
                                <span className="text-slate-900">{mandal.turnout}%</span>
                              </div>
                              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-yellow-400 transition-all duration-300" 
                                  style={{ width: `${mandal.turnout}%` }} 
                                />
                              </div>
                            </div>

                            <div className="flex justify-between text-[10px] font-bold text-slate-400 pt-1">
                              <span>Queue: <strong className="text-slate-700">{mandal.avgQueue} in line</strong></span>
                              <span>Sync OK</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right side: Manual voter cast entry Form (Lg: col-span-7) */}
                  <div className="lg:col-span-7 space-y-6">
                    
                    {/* Authorized Field-level Polling Figures Update Form */}
                    <form onSubmit={handleRegisterManualReport} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <Plus className="w-4 h-4 text-slate-500" />
                        <h4 className="text-xs font-black text-slate-950 uppercase tracking-tight">Submit Booth-Level Polling Report</h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-bold text-slate-700">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400 uppercase">Mandal Location</label>
                          <select
                            value={newManualReport.mandal}
                            onChange={(e) => setNewManualReport({ ...newManualReport, mandal: e.target.value })}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded font-bold text-slate-800 focus:outline-none"
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
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded font-bold text-slate-800 placeholder-slate-400 focus:outline-none"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400 uppercase">Reported By (Agent)</label>
                          <input
                            type="text"
                            placeholder="e.g. M. Srinivasa Rao"
                            value={newManualReport.submittedBy}
                            onChange={(e) => setNewManualReport({ ...newManualReport, submittedBy: e.target.value })}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded font-bold text-slate-800 placeholder-slate-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Party-wise entry fields */}
                      <div className="space-y-2">
                        <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Polled Vote Count Breakdown (Incremental Batch)</span>
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                          <div className="flex flex-col gap-1 bg-yellow-50/30 p-2 border border-yellow-200/50 rounded-lg">
                            <label className="text-[9px] text-yellow-800 uppercase font-extrabold">TDP</label>
                            <input
                              type="number"
                              min="0"
                              value={newManualReport.TDP || ''}
                              onChange={(e) => setNewManualReport({ ...newManualReport, TDP: Math.max(0, parseInt(e.target.value) || 0) })}
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs font-mono font-black focus:outline-none focus:ring-1 focus:ring-yellow-400"
                              placeholder="0"
                            />
                          </div>

                          <div className="flex flex-col gap-1 bg-blue-50/30 p-2 border border-blue-200/50 rounded-lg">
                            <label className="text-[9px] text-blue-700 uppercase font-extrabold">YSRCP</label>
                            <input
                              type="number"
                              min="0"
                              value={newManualReport.YSRCP || ''}
                              onChange={(e) => setNewManualReport({ ...newManualReport, YSRCP: Math.max(0, parseInt(e.target.value) || 0) })}
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs font-mono font-black focus:outline-none focus:ring-1 focus:ring-blue-400"
                              placeholder="0"
                            />
                          </div>

                          <div className="flex flex-col gap-1 bg-rose-50/30 p-2 border border-rose-200/50 rounded-lg">
                            <label className="text-[9px] text-rose-700 uppercase font-extrabold">JSP</label>
                            <input
                              type="number"
                              min="0"
                              value={newManualReport.JSP || ''}
                              onChange={(e) => setNewManualReport({ ...newManualReport, JSP: Math.max(0, parseInt(e.target.value) || 0) })}
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs font-mono font-black focus:outline-none focus:ring-1 focus:ring-rose-400"
                              placeholder="0"
                            />
                          </div>

                          <div className="flex flex-col gap-1 bg-orange-50/30 p-2 border border-orange-200/50 rounded-lg">
                            <label className="text-[9px] text-orange-700 uppercase font-extrabold">BJP</label>
                            <input
                              type="number"
                              min="0"
                              value={newManualReport.BJP || ''}
                              onChange={(e) => setNewManualReport({ ...newManualReport, BJP: Math.max(0, parseInt(e.target.value) || 0) })}
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs font-mono font-black focus:outline-none focus:ring-1 focus:ring-orange-400"
                              placeholder="0"
                            />
                          </div>

                          <div className="flex flex-col gap-1 bg-emerald-50/30 p-2 border border-emerald-200/50 rounded-lg">
                            <label className="text-[9px] text-emerald-700 uppercase font-extrabold">INC</label>
                            <input
                              type="number"
                              min="0"
                              value={newManualReport.INC || ''}
                              onChange={(e) => setNewManualReport({ ...newManualReport, INC: Math.max(0, parseInt(e.target.value) || 0) })}
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs font-mono font-black focus:outline-none focus:ring-1 focus:ring-emerald-400"
                              placeholder="0"
                            />
                          </div>

                          <div className="flex flex-col gap-1 bg-slate-50 p-2 border border-slate-200 rounded-lg">
                            <label className="text-[9px] text-slate-500 uppercase font-extrabold">Others</label>
                            <input
                              type="number"
                              min="0"
                              value={newManualReport.Others || ''}
                              onChange={(e) => setNewManualReport({ ...newManualReport, Others: Math.max(0, parseInt(e.target.value) || 0) })}
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs font-mono font-black focus:outline-none focus:ring-1 focus:ring-slate-400"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                        <span className="text-[10px] text-slate-400 font-bold">
                          Total in this report: <strong className="text-slate-700 font-black">{(Number(newManualReport.TDP) || 0) + (Number(newManualReport.YSRCP) || 0) + (Number(newManualReport.JSP) || 0) + (Number(newManualReport.BJP) || 0) + (Number(newManualReport.INC) || 0) + (Number(newManualReport.Others) || 0)} votes</strong>
                        </span>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer"
                        >
                          Submit Polling Figures
                        </button>
                      </div>
                    </form>

                    {/* Authorized Polling Reports Feed */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-slate-500" />
                          <h4 className="text-xs font-black text-slate-950 uppercase tracking-tight">Authorized Polling Reports Feed</h4>
                        </div>
                        <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-800 font-black px-2.5 py-0.5 rounded uppercase tracking-wider animate-pulse flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
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
                          className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none"
                        />
                      </div>

                      {/* Logs Container list */}
                      <div className="divide-y divide-slate-100 overflow-y-auto max-h-[350px] pr-2 space-y-2">
                        {pollingReports
                          .filter(r => 
                            (r.mandal || '').toLowerCase().includes((liveSearchQuery || '').toLowerCase()) ||
                            (r.booth || '').toLowerCase().includes((liveSearchQuery || '').toLowerCase()) ||
                            (r.submittedBy || '').toLowerCase().includes((liveSearchQuery || '').toLowerCase())
                          )
                          .map((report) => (
                            <div key={report.id} className="pt-2.5 pb-2.5 flex flex-col justify-between text-xs hover:bg-slate-50/50 p-2 rounded transition-colors border border-slate-100 mb-2">
                              <div className="flex justify-between items-start">
                                <div className="space-y-0.5">
                                  <p className="font-extrabold text-slate-900 uppercase text-[11px] flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
                                    {report.mandal} &bull; <span className="text-slate-500 font-bold">{report.booth}</span>
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-bold">Reported by: {report.submittedBy}</p>
                                </div>
                                <div className="text-right">
                                  <span className="text-[9px] text-slate-400 font-mono block font-bold">{report.time}</span>
                                  <span className="inline-block bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-black uppercase mt-1">
                                    +{report.totalVotes} votes
                                  </span>
                                </div>
                              </div>
                              
                              <div className="mt-2.5 pt-2 border-t border-slate-100/60 grid grid-cols-6 gap-1 text-[10px] text-center font-bold text-slate-600">
                                <div className="bg-yellow-50/50 rounded py-0.5 border border-yellow-100/50">
                                  <span className="block text-[8px] text-yellow-800 uppercase font-black">TDP</span>
                                  <span className="font-mono text-slate-900">{report.breakdown.TDP}</span>
                                </div>
                                <div className="bg-blue-50/50 rounded py-0.5 border border-blue-100/50">
                                  <span className="block text-[8px] text-blue-800 uppercase font-black">YSR</span>
                                  <span className="font-mono text-slate-900">{report.breakdown.YSRCP}</span>
                                </div>
                                <div className="bg-rose-50/50 rounded py-0.5 border border-rose-100/50">
                                  <span className="block text-[8px] text-rose-800 uppercase font-black">JSP</span>
                                  <span className="font-mono text-slate-900">{report.breakdown.JSP}</span>
                                </div>
                                <div className="bg-orange-50/50 rounded py-0.5 border border-orange-100/50">
                                  <span className="block text-[8px] text-orange-800 uppercase font-black">BJP</span>
                                  <span className="font-mono text-slate-900">{report.breakdown.BJP}</span>
                                </div>
                                <div className="bg-emerald-50/50 rounded py-0.5 border border-emerald-100/50">
                                  <span className="block text-[8px] text-emerald-800 uppercase font-black">INC</span>
                                  <span className="font-mono text-slate-900">{report.breakdown.INC}</span>
                                </div>
                                <div className="bg-slate-50 rounded py-0.5 border border-slate-200/50">
                                  <span className="block text-[8px] text-slate-500 uppercase font-black">OTH</span>
                                  <span className="font-mono text-slate-900">{report.breakdown.Others}</span>
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
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Migrated Voters Coordination Center</h3>
                    <p className="text-xs text-slate-500">Track and facilitate return travel, postal ballots, or logistical coordination for out-of-station constituency voters.</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <span className="text-[10px] bg-slate-50 border border-slate-200 text-slate-600 font-extrabold px-2.5 py-1 rounded">
                      Total Tracked: {migratedVotersList.length}
                    </span>
                    <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold px-2.5 py-1 rounded">
                      Travel Booked: {migratedVotersList.filter(v => v.travelStatus === 'TRAVEL_BOOKED').length}
                    </span>
                    <span className="text-[10px] bg-yellow-50 border border-yellow-200 text-yellow-700 font-extrabold px-2.5 py-1 rounded">
                      Pending confirmation: {migratedVotersList.filter(v => v.travelStatus === 'PENDING_CONFIRMATION').length}
                    </span>
                  </div>
                </div>

                {/* Summary boxes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Confirmed Arrivals</span>
                      <span className="text-xl font-black text-slate-950 block mt-1">
                        {migratedVotersList.filter(v => v.travelStatus === 'CONFIRMED' || v.travelStatus === 'TRAVEL_BOOKED' || v.travelStatus === 'SELF_ARRANGEMENT').length}
                      </span>
                    </div>
                    <span className="text-xs font-black text-emerald-600 bg-emerald-100/50 border border-emerald-200 px-2.5 py-1 rounded">Active Assist</span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Assistance Booked</span>
                      <span className="text-xl font-black text-blue-600 block mt-1">
                        {migratedVotersList.filter(v => v.assistanceRequired === 'TRANSPORT').length}
                      </span>
                    </div>
                    <span className="text-xs font-black text-blue-600 bg-blue-100/50 border border-blue-200 px-2.5 py-1 rounded">Bus / Train booked</span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Pending Reach Out</span>
                      <span className="text-xl font-black text-amber-600 block mt-1">
                        {migratedVotersList.filter(v => v.travelStatus === 'PENDING_CONFIRMATION').length}
                      </span>
                    </div>
                    <span className="text-xs font-black text-amber-600 bg-amber-100/50 border border-amber-200 px-2.5 py-1 rounded">Follow-up needed</span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Lost Contact</span>
                      <span className="text-xl font-black text-rose-600 block mt-1">
                        {migratedVotersList.filter(v => v.travelStatus === 'UNREACHABLE').length}
                      </span>
                    </div>
                    <span className="text-xs font-black text-rose-600 bg-rose-100/50 border border-rose-200 px-2.5 py-1 rounded">Retry contact</span>
                  </div>
                </div>
              </div>

              {/* Main Directory Table and Add form */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Side: Filter and Add Form (Lg: col-span-4) */}
                <div className="lg:col-span-4 space-y-6">
                  
                  {/* Search and Filter card */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3.5">
                    <h4 className="text-xs font-black text-slate-950 uppercase tracking-tight border-b border-slate-100 pb-2">Filter Directory</h4>
                    
                    <div className="space-y-3 font-bold text-xs text-slate-700">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-slate-400 uppercase">Mandal Area</label>
                        <select
                          value={migratedMandalFilter}
                          onChange={(e) => setMigratedMandalFilter(e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-800 focus:outline-none"
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
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-800 focus:outline-none"
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
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3.5">
                    <h4 className="text-xs font-black text-slate-950 uppercase tracking-tight border-b border-slate-100 pb-2">Register Migrated Voter</h4>
                    
                    <form onSubmit={handleAddMigratedVoter} className="space-y-3 text-xs font-bold text-slate-700">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-400 uppercase">Voter Full Name</label>
                        <input
                          type="text"
                          required
                          placeholder="Enter voter name..."
                          value={newMigratedVoter.name}
                          onChange={(e) => setNewMigratedVoter({ ...newMigratedVoter, name: e.target.value })}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded font-bold text-slate-800 focus:outline-none"
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
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded font-bold text-slate-800 focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400 uppercase">Mandal</label>
                          <select
                            value={newMigratedVoter.mandal}
                            onChange={(e) => setNewMigratedVoter({ ...newMigratedVoter, mandal: e.target.value })}
                            className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold focus:outline-none"
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
                            className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded font-bold text-slate-800 focus:outline-none"
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
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded font-bold text-slate-800 focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-400 uppercase">Contact Number</label>
                        <input
                          type="text"
                          placeholder="Mobile number..."
                          value={newMigratedVoter.contactNumber}
                          onChange={(e) => setNewMigratedVoter({ ...newMigratedVoter, contactNumber: e.target.value })}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded font-bold text-slate-800 focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-400 uppercase">Assigned Incharge / Volunteer</label>
                        <input
                          type="text"
                          placeholder="Volunteer name..."
                          value={newMigratedVoter.assignedVolunteer}
                          onChange={(e) => setNewMigratedVoter({ ...newMigratedVoter, assignedVolunteer: e.target.value })}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded font-bold text-slate-800 focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-[10px] font-black uppercase tracking-wider cursor-pointer"
                      >
                        Register Migrated Voter
                      </button>
                    </form>
                  </div>

                </div>

                {/* Right Side: Search and directory Table (Lg: col-span-8) */}
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h4 className="text-xs font-black text-slate-950 uppercase tracking-tight">Voters Directory</h4>
                    <span className="text-[10px] bg-slate-50 border border-slate-200 text-slate-500 px-2 py-0.5 rounded font-black">
                      Matches: {filteredMigratedVoters.length}
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
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none"
                    />
                  </div>

                  {/* Directory Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-black uppercase text-[9px] tracking-wider">
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
                      <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                        {paginatedMigratedVoters.map((item, idx) => {
                          const statusColor = 
                            item.travelStatus === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800' :
                            item.travelStatus === 'TRAVEL_BOOKED' ? 'bg-green-100 text-green-800' :
                            item.travelStatus === 'SELF_ARRANGEMENT' ? 'bg-blue-100 text-blue-800' :
                            item.travelStatus === 'UNREACHABLE' ? 'bg-red-100 text-red-800 font-bold' :
                            'bg-amber-100 text-amber-800';

                          const assistBadge = 
                            item.assistanceRequired === 'TRANSPORT' ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 font-black' :
                            item.assistanceRequired === 'POSTAL_BALLOT' ? 'bg-purple-50 border border-purple-200 text-purple-700 font-black' :
                            'bg-slate-50 border border-slate-100 text-slate-400 font-bold';

                          return (
                            <tr key={item.id} className="hover:bg-slate-50">
                              <td className="py-3 px-4 text-center text-slate-400">{(migratedPage - 1) * migratedPageSize + idx + 1}</td>
                              <td className="py-3 px-4">
                                <span className="block font-black text-slate-950 uppercase">{item.name}</span>
                                <span className="text-[10px] text-slate-400 block font-mono">{item.contactNumber}</span>
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-500">{item.epic}</td>
                              <td className="py-3 px-4 text-slate-500 uppercase">
                                {item.mandal} &bull; {item.village}
                              </td>
                              <td className="py-3 px-4 text-slate-900 font-black uppercase text-[11px]">{item.currentLocation}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase block text-center ${statusColor}`}>
                                  {item.travelStatus.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] tracking-wider uppercase block text-center ${assistBadge}`}>
                                  {item.assistanceRequired}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-800 text-[11px]">{item.assignedVolunteer || 'Unassigned'}</td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => setEditingMigratedVoter(item)}
                                  className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[9px] font-black uppercase tracking-wider cursor-pointer"
                                >
                                  Update Coordinator
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
                    totalItems={filteredMigratedVoters.length}
                    onPageChange={setMigratedPage}
                    onPageSizeChange={(newSize) => {
                      setMigratedPageSize(newSize);
                      setMigratedPage(1);
                    }}
                    pageSizeOptions={[10, 15, 25, 50]}
                    itemName="migrated voters"
                    accentColor="amber"
                  />
                </div>

              </div>

              {/* Editing Migrated Voter Status Modal */}
              {editingMigratedVoter && (
                <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-fade-in">
                  <form onSubmit={handleUpdateMigratedVoter} className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
                    <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="text-base font-black text-slate-950 uppercase">Update Coordination Status</h4>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Voter EPIC: {editingMigratedVoter.epic}</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setEditingMigratedVoter(null)}
                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-3 text-xs font-bold text-slate-700">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase">Voter profile:</p>
                        <p className="text-slate-950 text-sm font-black mt-0.5">{editingMigratedVoter.name}</p>
                        <p className="text-slate-500 text-[11px] uppercase mt-0.5">Location: {editingMigratedVoter.mandal} &bull; {editingMigratedVoter.village}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-slate-400 uppercase">Travel status</label>
                          <select
                            value={editingMigratedVoter.travelStatus}
                            onChange={(e) => setEditingMigratedVoter({ ...editingMigratedVoter, travelStatus: e.target.value as any })}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 font-extrabold focus:outline-none"
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
                            className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 font-extrabold focus:outline-none"
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
                          className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 font-bold"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-slate-400 uppercase">Coordination Notes</label>
                        <textarea
                          rows={2}
                          value={editingMigratedVoter.notes}
                          onChange={(e) => setEditingMigratedVoter({ ...editingMigratedVoter, notes: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 font-medium"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setEditingMigratedVoter(null)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-lg text-[10px] uppercase cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-lg text-[10px] uppercase cursor-pointer"
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
      </main>

    </div>
  );
}
