import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  TRAINING_VIDEOS,
  INITIAL_BOOTH_TASKS
} from '../utils/boothHelpers';
import { 
  SINGARAYAKONDA_VILLAGES, 
  MandalVillage,
  getMandalCadreNetwork, 
  generateVotersForMandalVillage, 
  saveMandalVoterRecord 
} from '../utils/mandalHelpers';
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
  Clock,
  Phone
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
  syncVoter,
  type HierarchySummaryPayload,
  type TrainingProgressItem,
  updateTrainingProgress,
} from '../lib/api';
import { createRealtimeSocket, RealtimeVoteEvent } from '../lib/realtime';
import Pagination from './common/Pagination';

interface MandalInchargeDashboardProps {
  session: UserSession;
  onLogout: () => void;
}

type TabType = 
  | 'dashboard'
  | 'village_list'
  | 'booth_incharge_list'
  | 'voters' 
  | 'live_track' 
  | 'fake_votes' 
  | 'tasks' 
  | 'caste_analytics' 
  | 'cadre_network' 
  | 'training'
  | 'training_analytics';

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
  INC: 'Congress',
  Neutral: 'Neutral',
  OTH: 'Undecided'
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

interface VillageDataInfo {
  totalVoters: number;
  tdp: number;
  ysrcp: number;
  neutral: number;
  status: 'WINNING' | 'TRAILING';
  margin: number;
}

const VILLAGE_PROJECTED_DATA: Record<string, VillageDataInfo> = {
  "BINGINAPALLI": { totalVoters: 2398, tdp: 1100, ysrcp: 1180, neutral: 118, status: 'TRAILING', margin: 80 },
  "BINGINI PALLI": { totalVoters: 2398, tdp: 1100, ysrcp: 1180, neutral: 118, status: 'TRAILING', margin: 80 },
  "KALIKIVAYA": { totalVoters: 2443, tdp: 1462, ysrcp: 862, neutral: 119, status: 'WINNING', margin: 600 },
  "KANUMALA": { totalVoters: 2183, tdp: 1388, ysrcp: 688, neutral: 107, status: 'WINNING', margin: 700 },
  "MULAGUNTAPADU": { totalVoters: 4300, tdp: 2944, ysrcp: 1144, neutral: 212, status: 'WINNING', margin: 1800 },
  "MULAGUNTA PADU": { totalVoters: 4300, tdp: 2944, ysrcp: 1144, neutral: 212, status: 'WINNING', margin: 1800 },
  "PAKALA": { totalVoters: 7530, tdp: 3231, ysrcp: 3931, neutral: 368, status: 'TRAILING', margin: 700 },
  "PATHA SINGARAYAKONDA": { totalVoters: 2061, tdp: 1130, ysrcp: 830, neutral: 101, status: 'WINNING', margin: 300 },
  "SANAMPUDI": { totalVoters: 4624, tdp: 3049, ysrcp: 1349, neutral: 226, status: 'WINNING', margin: 1700 },
  "SINGARAYAKONDA": { totalVoters: 17200, tdp: 8029, ysrcp: 8329, neutral: 842, status: 'TRAILING', margin: 300 },
  "SOMARAJU PALLI": { totalVoters: 5159, tdp: 3053, ysrcp: 1853, neutral: 253, status: 'WINNING', margin: 1200 },
  "SOMARAJUPALLI": { totalVoters: 5159, tdp: 3053, ysrcp: 1853, neutral: 253, status: 'WINNING', margin: 1200 },
  "SOMARAJPALLI": { totalVoters: 5159, tdp: 3053, ysrcp: 1853, neutral: 253, status: 'WINNING', margin: 1200 },
  "WOOLLAPALEM": { totalVoters: 4349, tdp: 2668, ysrcp: 1468, neutral: 213, status: 'WINNING', margin: 1200 },
};

const VILLAGE_PROJECTED_MARGINS: Record<string, { status: 'WINNING' | 'TRAILING'; margin: number }> = VILLAGE_PROJECTED_DATA;

export default function MandalInchargeDashboard({ session, onLogout }: MandalInchargeDashboardProps) {

  const { villageIncharges, boothIncharges, voter100Incharges } = useMemo(() => getMandalCadreNetwork(), []);
  const ALL_CADRES = useMemo(() => {
    return [
      ...villageIncharges.map((v, i) => ({ id: 'VIL-'+i, name: v.name, group: v.village, role: 'VILLAGE_INCHARGE' })),
      ...boothIncharges.map((b, i) => ({ id: 'BOO-'+i, name: b.name, group: b.booth, role: 'BOOTH_PRESIDENT' })),
      ...voter100Incharges.map((v, i) => ({ id: 'V100-'+i, name: v.name, group: v.booth, role: 'VOTER_100_INCHARGE' }))
    ];
  }, [villageIncharges, boothIncharges, voter100Incharges]);

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [cadreActiveTab, setCadreActiveTab] = useState<'village' | 'booth' | 'voter'>('village');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [voters, setVoters] = useState<Voter[]>([]);
  
  // Caste Analytics Redesign States
  const [casteFilterVillage, setCasteFilterVillage] = useState<string>('all');
  const [casteFilterCaste, setCasteFilterCaste] = useState<string>('all');
  const [casteFilterGender, setCasteFilterGender] = useState<string>('all');
  const [casteFilterAgeGroup, setCasteFilterAgeGroup] = useState<string>('all');
  const [casteFilterProfession, setCasteFilterProfession] = useState<string>('all');
  const [activeCasteDetail, setActiveCasteDetail] = useState<string | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<{
    type: string;
    category: string;
    party: VoterPreference;
    count: number;
    pct: number;
    total: number;
    x: number;
    y: number;
  } | null>(null);
  
  // Drilldown selection states for Village List Integration
  const [selectedVillageName, setSelectedVillageName] = useState<string | null>(null);
  const [villageSubTab, setVillageSubTab] = useState<'overview' | 'voters' | 'booths' | 'live_track' | 'fake_votes' | 'caste' | 'cadre'>('overview');
  
  // Redesigned Village List States
  const [villageSearchQuery, setVillageSearchQuery] = useState('');
  const [villageListFilter, setVillageListFilter] = useState('All');
  const [villageSortField, setVillageSortField] = useState<string>('name');
  const [villageSortDirection, setVillageSortDirection] = useState<'asc' | 'desc'>('asc');

  // Redesigned Booth List & Analysis States
  const [boothSearchQuery, setBoothSearchQuery] = useState('');
  const [boothListActiveTab, setBoothListActiveTab] = useState<'all' | 'winning' | 'trailing'>('all');
  
  // States for user interaction
  const [searchQuery, setSearchQuery] = useState('');
  const [villageFilter, setVillageFilter] = useState('All');
  const [boothFilter, setBoothFilter] = useState('All');
  const [preferenceFilter, setPreferenceFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All'); // Local vs Migrated
  
  // Pagination states
  const [villageVotersPage, setVillageVotersPage] = useState(1);
  const [villageVotersPageSize, setVillageVotersPageSize] = useState(25);
  const [boothsPage, setBoothsPage] = useState(1);
  const [boothsPageSize, setBoothsPageSize] = useState(12);
  const [fakeVotersPage, setFakeVotersPage] = useState(1);
  const [fakeVotersPageSize, setFakeVotersPageSize] = useState(15);

  // Auto reset page on filter changes
  useEffect(() => {
    setVillageVotersPage(1);
  }, [boothFilter, selectedVillageName]);

  useEffect(() => {
    setBoothsPage(1);
  }, [boothSearchQuery, boothListActiveTab]);
  
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
  const [trainingVideos, setTrainingVideos] = useState<TrainingVideo[]>(TRAINING_VIDEOS);
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
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('2026-08-05');

  // Video watching modal
  const [watchingVideo, setWatchingVideo] = useState<TrainingVideo | null>(null);

  // REDESIGNED CADRE NETWORK CONSTANTS & STATES
  const VERIFIED_BOOTHS_DATA = useMemo(() => [
    { boothNumber: 224, totalVoters: 950, v100InchargesCount: 9 },
    { boothNumber: 225, totalVoters: 709, v100InchargesCount: 7 },
    { boothNumber: 226, totalVoters: 784, v100InchargesCount: 8 },
    { boothNumber: 227, totalVoters: 1207, v100InchargesCount: 12 },
    { boothNumber: 228, totalVoters: 1088, v100InchargesCount: 11 },
    { boothNumber: 229, totalVoters: 977, v100InchargesCount: 10 },
    { boothNumber: 230, totalVoters: 880, v100InchargesCount: 9 },
    { boothNumber: 231, totalVoters: 672, v100InchargesCount: 7 },
    { boothNumber: 232, totalVoters: 645, v100InchargesCount: 6 },
    { boothNumber: 233, totalVoters: 1057, v100InchargesCount: 11 },
    { boothNumber: 234, totalVoters: 1126, v100InchargesCount: 11 },
    { boothNumber: 235, totalVoters: 689, v100InchargesCount: 7 },
    { boothNumber: 236, totalVoters: 739, v100InchargesCount: 7 },
    { boothNumber: 237, totalVoters: 1004, v100InchargesCount: 10 },
    { boothNumber: 238, totalVoters: 1074, v100InchargesCount: 11 },
    { boothNumber: 239, totalVoters: 977, v100InchargesCount: 10 },
    { boothNumber: 240, totalVoters: 1118, v100InchargesCount: 11 },
    { boothNumber: 241, totalVoters: 1085, v100InchargesCount: 11 },
    { boothNumber: 242, totalVoters: 798, v100InchargesCount: 8 },
    { boothNumber: 243, totalVoters: 818, v100InchargesCount: 8 },
    { boothNumber: 244, totalVoters: 760, v100InchargesCount: 8 },
    { boothNumber: 245, totalVoters: 972, v100InchargesCount: 10 },
    { boothNumber: 246, totalVoters: 705, v100InchargesCount: 7 },
    { boothNumber: 247, totalVoters: 1061, v100InchargesCount: 11 },
    { boothNumber: 248, totalVoters: 843, v100InchargesCount: 8 },
    { boothNumber: 249, totalVoters: 806, v100InchargesCount: 8 },
    { boothNumber: 250, totalVoters: 815, v100InchargesCount: 8 },
    { boothNumber: 251, totalVoters: 698, v100InchargesCount: 7 },
    { boothNumber: 252, totalVoters: 747, v100InchargesCount: 7 },
    { boothNumber: 253, totalVoters: 698, v100InchargesCount: 7 },
    { boothNumber: 254, totalVoters: 819, v100InchargesCount: 8 },
    { boothNumber: 255, totalVoters: 755, v100InchargesCount: 8 },
    { boothNumber: 256, totalVoters: 780, v100InchargesCount: 8 },
    { boothNumber: 257, totalVoters: 659, v100InchargesCount: 7 },
    { boothNumber: 258, totalVoters: 520, v100InchargesCount: 5 },
    { boothNumber: 259, totalVoters: 1025, v100InchargesCount: 10 },
    { boothNumber: 260, totalVoters: 754, v100InchargesCount: 8 },
    { boothNumber: 261, totalVoters: 780, v100InchargesCount: 8 },
    { boothNumber: 262, totalVoters: 1023, v100InchargesCount: 10 },
    { boothNumber: 263, totalVoters: 996, v100InchargesCount: 10 },
    { boothNumber: 264, totalVoters: 807, v100InchargesCount: 8 },
    { boothNumber: 265, totalVoters: 918, v100InchargesCount: 9 },
    { boothNumber: 266, totalVoters: 786, v100InchargesCount: 8 },
    { boothNumber: 267, totalVoters: 846, v100InchargesCount: 8 },
    { boothNumber: 268, totalVoters: 789, v100InchargesCount: 8 },
    { boothNumber: 269, totalVoters: 750, v100InchargesCount: 8 },
    { boothNumber: 270, totalVoters: 919, v100InchargesCount: 9 },
    { boothNumber: 271, totalVoters: 1146, v100InchargesCount: 11 },
    { boothNumber: 272, totalVoters: 769, v100InchargesCount: 8 },
    { boothNumber: 273, totalVoters: 1052, v100InchargesCount: 11 },
    { boothNumber: 274, totalVoters: 992, v100InchargesCount: 10 },
    { boothNumber: 275, totalVoters: 1113, v100InchargesCount: 11 },
    { boothNumber: 276, totalVoters: 1090, v100InchargesCount: 11 },
    { boothNumber: 277, totalVoters: 829, v100InchargesCount: 8 },
    { boothNumber: 278, totalVoters: 1142, v100InchargesCount: 11 },
    { boothNumber: 279, totalVoters: 738, v100InchargesCount: 7 },
    { boothNumber: 280, totalVoters: 550, v100InchargesCount: 6 },
    { boothNumber: 281, totalVoters: 400, v100InchargesCount: 4 },
    { boothNumber: 282, totalVoters: 996, v100InchargesCount: 10 },
    { boothNumber: 283, totalVoters: 1002, v100InchargesCount: 10 }
  ], []);

  const [cadreSearchQuery, setCadreSearchQuery] = useState('');
  const [cadreFilter, setCadreFilter] = useState<'all' | 'fully' | 'partially' | 'not_assigned'>('all');
  const [selectedBoothCadreNum, setSelectedBoothCadreNum] = useState<number | null>(null);

  const [cadreAssignments, setCadreAssignments] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    const seedNames = [
      "K. Srinivasa Rao", "Ch. Rama Devi", "S. Anusha", "V. Koteswara Rao",
      "D. Prasada Rao", "R. Siva Prasad", "K. Venkata Ramana", "G. Subba Rao",
      "M. Lakshmi", "P. Raghavulu", "S. Chenchuramaiah", "T. Mastan Rao"
    ];
    
    // Seed Booths 224 to 230 as fully assigned
    // Seed Booths 231 to 255 as partially assigned
    // Booths 256 to 283 as unassigned
    [
      { boothNumber: 224, totalVoters: 950, v100InchargesCount: 9 },
      { boothNumber: 225, totalVoters: 709, v100InchargesCount: 7 },
      { boothNumber: 226, totalVoters: 784, v100InchargesCount: 8 },
      { boothNumber: 227, totalVoters: 1207, v100InchargesCount: 12 },
      { boothNumber: 228, totalVoters: 1088, v100InchargesCount: 11 },
      { boothNumber: 229, totalVoters: 977, v100InchargesCount: 10 },
      { boothNumber: 230, totalVoters: 880, v100InchargesCount: 9 },
      { boothNumber: 231, totalVoters: 672, v100InchargesCount: 7 },
      { boothNumber: 232, totalVoters: 645, v100InchargesCount: 6 },
      { boothNumber: 233, totalVoters: 1057, v100InchargesCount: 11 },
      { boothNumber: 234, totalVoters: 1126, v100InchargesCount: 11 },
      { boothNumber: 235, totalVoters: 689, v100InchargesCount: 7 },
      { boothNumber: 236, totalVoters: 739, v100InchargesCount: 7 },
      { boothNumber: 237, totalVoters: 1004, v100InchargesCount: 10 },
      { boothNumber: 238, totalVoters: 1074, v100InchargesCount: 11 },
      { boothNumber: 239, totalVoters: 977, v100InchargesCount: 10 },
      { boothNumber: 240, totalVoters: 1118, v100InchargesCount: 11 },
      { boothNumber: 241, totalVoters: 1085, v100InchargesCount: 11 },
      { boothNumber: 242, totalVoters: 798, v100InchargesCount: 8 },
      { boothNumber: 243, totalVoters: 818, v100InchargesCount: 8 },
      { boothNumber: 244, totalVoters: 760, v100InchargesCount: 8 },
      { boothNumber: 245, totalVoters: 972, v100InchargesCount: 10 },
      { boothNumber: 246, totalVoters: 705, v100InchargesCount: 7 },
      { boothNumber: 247, totalVoters: 1061, v100InchargesCount: 11 },
      { boothNumber: 248, totalVoters: 843, v100InchargesCount: 8 },
      { boothNumber: 249, totalVoters: 806, v100InchargesCount: 8 },
      { boothNumber: 250, totalVoters: 815, v100InchargesCount: 8 },
      { boothNumber: 251, totalVoters: 698, v100InchargesCount: 7 },
      { boothNumber: 252, totalVoters: 747, v100InchargesCount: 7 },
      { boothNumber: 253, totalVoters: 698, v100InchargesCount: 7 },
      { boothNumber: 254, totalVoters: 819, v100InchargesCount: 8 },
      { boothNumber: 255, totalVoters: 755, v100InchargesCount: 8 }
    ].forEach(booth => {
      const bNum = booth.boothNumber;
      if (bNum <= 230) {
        for (let s = 0; s < booth.v100InchargesCount; s++) {
          initial[`${bNum}-${s}`] = seedNames[s % seedNames.length];
        }
      } else {
        const assignedCount = Math.floor(booth.v100InchargesCount / 2);
        for (let s = 0; s < assignedCount; s++) {
          initial[`${bNum}-${s}`] = seedNames[(s + bNum) % seedNames.length];
        }
      }
    });
    return initial;
  });

  const [boothInchargeOverrides, setBoothInchargeOverrides] = useState<Record<number, { name: string; mobile: string }>>(() => ({}));

  // Editing UI States
  const [editingSlotKey, setEditingSlotKey] = useState<string | null>(null);
  const [editingSlotName, setEditingSlotName] = useState('');
  const [editingInchargeBooth, setEditingInchargeBooth] = useState<number | null>(null);
  const [editingInchargeName, setEditingInchargeName] = useState('');
  const [editingInchargeMobile, setEditingInchargeMobile] = useState('');

  const handleSaveSlot = (key: string, name: string) => {
    const updated = { ...cadreAssignments };
    if (name.trim() === '') {
      delete updated[key];
    } else {
      updated[key] = name.trim();
    }
    setCadreAssignments(updated);
    setEditingSlotKey(null);
  };

  const handleSaveBoothIncharge = (boothNum: number, name: string, mobile: string) => {
    const updated = { ...boothInchargeOverrides };
    updated[boothNum] = { name: name.trim(), mobile: mobile.trim() };
    setBoothInchargeOverrides(updated);
    setEditingInchargeBooth(null);
  };

  const totalAssignedV100 = useMemo(() => {
    return Object.keys(cadreAssignments).filter(k => cadreAssignments[k] && cadreAssignments[k].trim() !== '').length;
  }, [cadreAssignments]);

  const getBoothAssignedSlotsCount = useCallback((boothNum: number, v100Count: number) => {
    let count = 0;
    for (let s = 0; s < v100Count; s++) {
      if (cadreAssignments[`${boothNum}-${s}`]) {
        count++;
      }
    }
    return count;
  }, [cadreAssignments]);

  const getBoothInchargeDetails = useCallback((boothNum: number, index: number) => {
    if (boothInchargeOverrides[boothNum]) {
      return boothInchargeOverrides[boothNum];
    }
    const fallback = boothIncharges[index] || { name: "UNASSIGNED", mobile: "N/A" };
    return {
      name: fallback.name || "UNASSIGNED",
      mobile: fallback.mobile || "N/A"
    };
  }, [boothInchargeOverrides, boothIncharges]);

  // Redesigned Booth List & Analysis Calculated Memos
  const analyzedBooths = useMemo(() => {
    return boothIncharges.map((b, idx) => {
      // Find voters in this booth
      const bVoters = voters.filter(v => v.boothNumber === b.booth);
      
      const tdp = bVoters.filter(v => v.politicalPreference === 'TDP').length;
      const ysrcp = bVoters.filter(v => v.politicalPreference === 'YSRCP').length;
      const neutral = bVoters.filter(v => v.politicalPreference === 'Neutral').length;
      
      const totalVoters = b.votersCount || 1200; // registered voters count
      const classifiedVoters = tdp + ysrcp + neutral; // surveyed voters
      
      const margin = tdp - ysrcp;
      const status = margin > 0 ? 'WINNING' : (margin < 0 ? 'TRAILING' : 'TIE');
      
      return {
        ...b,
        displayNum: String(idx + 1).padStart(2, '0'),
        tdp,
        ysrcp,
        neutral,
        classifiedVoters,
        totalVoters,
        margin,
        status
      };
    });
  }, [boothIncharges, voters]);

  // Compute winning/trailing counts for the filter tabs
  const { winningCount, trailingCount } = useMemo(() => {
    let win = 0;
    let trail = 0;
    analyzedBooths.forEach(b => {
      if (b.status === 'WINNING') win++;
      else if (b.status === 'TRAILING') trail++;
    });
    return { winningCount: win, trailingCount: trail };
  }, [analyzedBooths]);

  // Now apply the active tab filter and search query
  const filteredBooths = useMemo(() => {
    return analyzedBooths.filter(b => {
      // 1. Tab filter
      if (boothListActiveTab === 'winning' && b.status !== 'WINNING') return false;
      if (boothListActiveTab === 'trailing' && b.status !== 'TRAILING') return false;
      
      // 2. Search filter
      if (boothSearchQuery.trim() !== '') {
        const query = boothSearchQuery.toLowerCase();
        const bNum = (b.displayNum || '').toString();
        const matchesNum = bNum.includes(query) || `booth ${bNum}`.toLowerCase().includes(query) || (b.booth || '').toLowerCase().includes(query);
        const matchesVillage = (b.village || '').toLowerCase().includes(query);
        const matchesIncharge = (b.name || '').toLowerCase().includes(query);
        return matchesNum || matchesVillage || matchesIncharge;
      }
      
      return true;
    });
  }, [analyzedBooths, boothListActiveTab, boothSearchQuery]);

  const paginatedBooths = useMemo(() => {
    const start = (boothsPage - 1) * boothsPageSize;
    return filteredBooths.slice(start, start + boothsPageSize);
  }, [filteredBooths, boothsPage, boothsPageSize]);

  useEffect(() => {
    let active = true;

    const hydrateLiveScope = async () => {
      try {
        const [summaryPayload, eventItems, reports, tasks, videos, progressItems, voterItems] = await Promise.all([
          fetchHierarchySummaryByUser(session.userId),
          fetchLiveVoteEventsByUser(session.userId, 8),
          fetchReportsForUnit(session.unitId).catch(() => null),
          fetchTasksForUnit(session.unitId).catch(() => null),
          fetchTrainingVideos(session.unitId).catch(() => null),
          fetchTrainingProgress(session.userId).catch(() => null),
          fetchVotersForUnit(session.unitId).catch(() => null),
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
  const isDemoMode = typeof window !== 'undefined' && localStorage.getItem('DEMO_MODE') === 'true';
  const TOTAL_MANDAL_REGISTERED_VOTERS = isDemoMode ? 52247 : (voters.length > 0 ? voters.length : 0);
  const surveyedVotersCount = voters.length;
  const pendingSurveyCount = Math.max(0, TOTAL_MANDAL_REGISTERED_VOTERS - surveyedVotersCount);
  const surveyCompletionPct = TOTAL_MANDAL_REGISTERED_VOTERS > 0 && surveyedVotersCount > 0 ? ((surveyedVotersCount / TOTAL_MANDAL_REGISTERED_VOTERS) * 100).toFixed(1) : '0.0';

  const totalVotersCount = TOTAL_MANDAL_REGISTERED_VOTERS;

  const villagesSource = useMemo(() => {
    const isDemo = typeof window !== 'undefined' && localStorage.getItem('DEMO_MODE') === 'true';
    if (isDemo) return SINGARAYAKONDA_VILLAGES;
    const distinctNames = Array.from(new Set(voters.map(v => v.village).filter(Boolean)));
    if (distinctNames.length === 0) return [];
    return distinctNames.map((name, idx) => ({
      sNo: `#${String(idx + 1).padStart(2, '0')}`,
      name: name as string,
      totalVoters: voters.filter(v => v.village === name).length,
      totalBooths: 0,
      localVoters: 0,
      migratedVoters: 0,
      pStats: { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 },
      leadingParty: 'Neutral' as const,
      lead: 0,
    }));
  }, [voters]);

  const liveMandalStats = useMemo(() => {
    const isDemo = typeof window !== 'undefined' && localStorage.getItem('DEMO_MODE') === 'true';
    const snapshot = backendSummary?.snapshot;
    const fallbackWinning = isDemo ? SINGARAYAKONDA_VILLAGES.filter((v) => {
      const info = VILLAGE_PROJECTED_MARGINS[v.name.toUpperCase().trim()] || { status: 'WINNING', margin: 0 };
      return info.status === 'WINNING';
    }).length : 0;
    const fallbackTrailing = isDemo ? (SINGARAYAKONDA_VILLAGES.length - fallbackWinning) : 0;

    return {
      totalVoters: snapshot?.summary.totalVoters ?? (isDemo ? 52247 : voters.length),
      totalVillages: snapshot?.hierarchyCounts.VILLAGE ?? villagesSource.length,
      totalBooths: snapshot?.hierarchyCounts.BOOTH ?? boothIncharges.length,
      voted: snapshot?.summary.voted ?? 0,
      remaining: snapshot?.summary.remaining ?? 0,
      winning: snapshot?.performance.winningChildren ?? fallbackWinning,
      trailing: snapshot?.performance.trailingChildren ?? fallbackTrailing,
    };
  }, [backendSummary, boothIncharges.length, SINGARAYAKONDA_VILLAGES, villagesSource.length, voters.length]);

  // Voters filtered by active (excluding deceased)
  const activeVoters = useMemo(() => voters.filter(v => !v.voterStatus || v.voterStatus === 'Active' || v.voterStatus === 'Shifted'), [voters]);

  // Voters filtered by active and page filters
  const filteredVotersForCasteAnalytics = useMemo(() => {
    return activeVoters.filter(v => {
      // Village filter
      if (casteFilterVillage !== 'all' && v.village !== casteFilterVillage) return false;
      
      // Caste filter
      if (casteFilterCaste !== 'all' && v.caste !== casteFilterCaste) return false;
      
      // Gender filter
      if (casteFilterGender !== 'all' && v.gender !== casteFilterGender) return false;
      
      // Age Group filter
      if (casteFilterAgeGroup !== 'all') {
        const age = v.age;
        if (casteFilterAgeGroup === '18-25' && (age < 18 || age > 25)) return false;
        if (casteFilterAgeGroup === '26-40' && (age < 26 || age > 40)) return false;
        if (casteFilterAgeGroup === '41-60' && (age < 41 || age > 60)) return false;
        if (casteFilterAgeGroup === '60+' && age <= 60) return false;
      }
      
      // Profession filter
      if (casteFilterProfession !== 'all' && v.profession !== casteFilterProfession) return false;
      
      return true;
    });
  }, [activeVoters, casteFilterVillage, casteFilterCaste, casteFilterGender, casteFilterAgeGroup, casteFilterProfession]);

  const availableVillages = useMemo(() => {
    return Array.from(new Set(activeVoters.map(v => v.village))).filter(Boolean).sort();
  }, [activeVoters]);

  const availableCastes = useMemo(() => {
    return Array.from(new Set(activeVoters.map(v => v.caste))).filter(Boolean).sort();
  }, [activeVoters]);

  const availableProfessions = useMemo(() => {
    return Array.from(new Set(activeVoters.map(v => v.profession))).filter(Boolean).sort();
  }, [activeVoters]);

  const casteDetailData = useMemo(() => {
    if (!activeCasteDetail) return null;
    
    // Filter active voters of this caste in Singarayakonda Mandal
    const casteVoters = activeVoters.filter(v => (v.caste || '').toUpperCase() === activeCasteDetail.toUpperCase());
    
    const totalVoters = casteVoters.length;
    
    // Gender
    const male = casteVoters.filter(v => v.gender === 'Male').length;
    const female = casteVoters.filter(v => v.gender === 'Female').length;
    const otherGender = casteVoters.filter(v => v.gender === 'Other').length;
    
    // Age Groups
    const age18_25 = casteVoters.filter(v => v.age >= 18 && v.age <= 25).length;
    const age26_40 = casteVoters.filter(v => v.age >= 26 && v.age <= 40).length;
    const age41_60 = casteVoters.filter(v => v.age >= 41 && v.age <= 60).length;
    const age60Plus = casteVoters.filter(v => v.age > 60).length;
    
    // Profession
    const professionCounts: Record<string, number> = {};
    casteVoters.forEach(v => {
      const prof = v.profession || 'Others';
      professionCounts[prof] = (professionCounts[prof] || 0) + 1;
    });
    
    // Party Support
    const partyCounts: Record<VoterPreference, number> = {
      TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0
    };
    casteVoters.forEach(v => {
      const p = v.politicalPreference || 'Neutral';
      partyCounts[p]++;
    });
    
    // Village-wise Breakdown
    const villageBreakdown = villagesSource.map(village => {
      const vVoters = casteVoters.filter(v => v.village === village.name);
      const vTdp = vVoters.filter(v => v.politicalPreference === 'TDP').length;
      const vYsrcp = vVoters.filter(v => v.politicalPreference === 'YSRCP').length;
      const vNeutral = vVoters.filter(v => v.politicalPreference === 'Neutral').length;
      
      let leadingParty: 'TDP' | 'YSRCP' | 'TIE' | 'Neutral' = 'Neutral';
      if (vTdp > vYsrcp) leadingParty = 'TDP';
      else if (vYsrcp > vTdp) leadingParty = 'YSRCP';
      else if (vTdp === vYsrcp && vTdp > 0) leadingParty = 'TIE';
      
      return {
        villageName: village.name,
        total: vVoters.length,
        tdp: vTdp,
        ysrcp: vYsrcp,
        neutral: vNeutral,
        leadingParty
      };
    }).sort((a, b) => b.total - a.total); // highest count first
    
    return {
      casteName: activeCasteDetail,
      totalVoters,
      gender: { male, female, other: otherGender },
      age: { age18_25, age26_40, age41_60, age60Plus },
      professions: Object.entries(professionCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      party: partyCounts,
      villages: villageBreakdown
    };
  }, [activeVoters, activeCasteDetail]);


  // Party support breakdown
  const partyStats = useMemo(() => {
    return {
      TDP: 28054,
      YSRCP: 21634,
      JSP: 0,
      BJP: 0,
      INC: 0,
      Neutral: 2559,
      OTH: 0
    };
  }, []);

  // Fake votes count (Fake, Duplicate, Doubtful)
  const fakeVotesCount = useMemo(() => {
    return voters.filter(v => v.voterStatus === 'Fake' || v.voterStatus === 'Duplicate' || v.voterStatus === 'Doubtful').length;
  }, [voters]);

  // Dynamic Election Forecast computation
  const forecastData = useMemo(() => {
    return {
      leadingParty: 'TDP' as VoterPreference,
      secondParty: 'YSRCP' as VoterPreference,
      leadCount: 6420,
      leadCountStr: '6,420',
      leaderCount: 28054,
      runnerUpParty: 'YSRCP' as VoterPreference,
      runnerUpCount: 21634,
      leadPercentage: '12.3',
      isFullSurveyAvailable: false
    };
  }, []);

  // Donut chart calculations
  const donutChartData = useMemo(() => {
    const activeParties: VoterPreference[] = ['TDP', 'YSRCP', 'JSP', 'BJP', 'INC', 'Neutral'];
    return activeParties.map(key => {
      const value = partyStats[key];
      const percentage = (value / 52247) * 100;
      return {
        key,
        value,
        percentage,
        color: PARTY_COLORS[key]
      };
    });
  }, [partyStats]);

  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

  // Redesigned Village List computed metrics and helpers
  const totalVotersSum = useMemo(() => {
    return villagesSource.reduce((acc, v) => acc + v.totalVoters, 0);
  }, [villagesSource]);

  const getVillageInchargeName = useCallback((vName: string) => {
    if (!vName) return "Ch. Venkaiah";
    const inchargeMap: Record<string, string> = {
      "SINGARAYAKONDA": "Ch. Venkaiah",
      "PATHA SINGARAYAKONDA": "T. Ramanamma",
      "MULAGUNTA PADU": "B. Koteswara Rao",
      "SOMARAJU PALLI": "Y. Satyanarayana",
      "KALIKIVAYA": "D. Hari Babu",
      "KANUMALA": "R. Vasudeva Rao",
      "PAKALA": "S. Yedukondalu",
      "BINGINI PALLI": "V. Ramanaiah",
      "WOOLLAPALEM": "T. Ramana Rao",
      "SANAMPUDI": "G. Satyanarayana",
      // Compatibility fallback
      "SINGARAYA KONDA": "Ch. Venkaiah",
      "KANUMALLA": "R. Vasudeva Rao",
      "BINGINIPALLI": "V. Ramanaiah",
      "BINGINAPALLI": "V. Ramanaiah",
      "MULAGUNTAPADU": "B. Koteswara Rao",
      "SOMARAJUPALLI": "Y. Satyanarayana"
    };
    return inchargeMap[vName.toUpperCase()] || "Ch. Venkaiah";
  }, []);

  const getInchargePhone = useCallback((vName: string) => {
    const phones: Record<string, string> = {
      "KALIKIVAYA": "+919440234501",
      "PATHA SINGARAYAKONDA": "+919440234502",
      "SANAMPUDI": "+919440234503",
      "SINGARAYAKONDA": "+919440234504",
      "KANUMALA": "+919440234505",
      "PAKALA": "+919440234506",
      "WOOLLAPALEM": "+919440234507",
      "BINGINAPALLI": "+919440234508",
      "BINGINI PALLI": "+919440234508",
      "MULAGUNTA PADU": "+919440234509",
      "SOMARAJU PALLI": "+919440234510"
    };
    return phones[vName.toUpperCase()] || "+919440234500";
  }, []);

  const getVillageMetrics = useCallback((vName: string, totalVoters: number) => {
    const vKey = vName.toUpperCase().trim();
    const info = VILLAGE_PROJECTED_DATA[vKey];
    if (info) {
      return {
        surveyed: info.totalVoters,
        surveyProgressPct: '100.0',
        tdp: info.tdp,
        ysrcp: info.ysrcp,
        jsp: 0,
        bjp: 0,
        congress: 0,
        neutral: info.neutral,
        undecided: 0,
        fake: 0,
        leadingParty: info.status === 'WINNING' ? ('TDP' as VoterPreference) : ('YSRCP' as VoterPreference),
        lead: info.margin,
        isCloseContest: false
      };
    }

    return {
      surveyed: 0,
      surveyProgressPct: '0.0',
      tdp: 0,
      ysrcp: 0,
      jsp: 0,
      bjp: 0,
      congress: 0,
      neutral: 0,
      undecided: 0,
      fake: 0,
      leadingParty: 'TDP' as VoterPreference,
      lead: 0,
      isCloseContest: false
    };
  }, []);

  const villageCounts = useMemo(() => {
    let winning = 0;
    let trailing = 0;
    villagesSource.forEach(v => {
      const vKey = v.name.toUpperCase().trim();
      const info = VILLAGE_PROJECTED_MARGINS[vKey] || { status: 'WINNING', margin: 0 };
      if (info.status === 'WINNING') {
        winning++;
      } else {
        trailing++;
      }
    });
    return {
      all: villagesSource.length,
      winning,
      trailing
    };
  }, [villagesSource]);

  const filteredVillages = useMemo(() => {
    return villagesSource.filter(v => {
      const vKey = v.name.toUpperCase().trim();
      const info = VILLAGE_PROJECTED_MARGINS[vKey] || { status: 'WINNING', margin: 0 };
      const isWinning = info.status === 'WINNING';
      
      if (villageSearchQuery && !(v.name || '').toLowerCase().includes(villageSearchQuery.toLowerCase())) {
        return false;
      }

      if (villageListFilter === 'All') return true;
      if (villageListFilter === 'Winning') return isWinning;
      if (villageListFilter === 'Trailing') return !isWinning;
      return true;
    });
  }, [villageSearchQuery, villageListFilter]);

  const sortedVillages = useMemo(() => {
    const list = [...filteredVillages];
    list.sort((a, b) => {
      const aMetrics = getVillageMetrics(a.name, a.totalVoters);
      const bMetrics = getVillageMetrics(b.name, b.totalVoters);

      const aKey = a.name.toUpperCase().trim();
      const bKey = b.name.toUpperCase().trim();
      const aInfo = VILLAGE_PROJECTED_MARGINS[aKey] || { status: 'WINNING', margin: 0 };
      const bInfo = VILLAGE_PROJECTED_MARGINS[bKey] || { status: 'WINNING', margin: 0 };

      let valA: any = 0;
      let valB: any = 0;

      switch (villageSortField) {
        case 'name':
          valA = a.name;
          valB = b.name;
          break;
        case 'totalVoters':
          valA = a.totalVoters;
          valB = b.totalVoters;
          break;
        case 'surveyed':
          valA = aMetrics.surveyed;
          valB = bMetrics.surveyed;
          break;
        case 'surveyPct':
          valA = parseFloat(aMetrics.surveyProgressPct);
          valB = parseFloat(bMetrics.surveyProgressPct);
          break;
        case 'TDP':
          valA = aMetrics.tdp;
          valB = bMetrics.tdp;
          break;
        case 'YSRCP':
          valA = aMetrics.ysrcp;
          valB = bMetrics.ysrcp;
          break;
        case 'leadingParty':
          valA = aInfo.status === 'WINNING' ? 'TDP' : 'YSRCP';
          valB = bInfo.status === 'WINNING' ? 'TDP' : 'YSRCP';
          break;
        case 'lead':
          valA = aInfo.margin;
          valB = bInfo.margin;
          break;
        case 'fake':
          valA = aMetrics.fake;
          valB = bMetrics.fake;
          break;
        default:
          valA = a.name;
          valB = b.name;
      }

      if (valA < valB) return villageSortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return villageSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredVillages, villageSortField, villageSortDirection, getVillageMetrics]);

  const handleSort = useCallback((field: string) => {
    if (villageSortField === field) {
      setVillageSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setVillageSortField(field);
      setVillageSortDirection('desc');
    }
  }, [villageSortField]);

  // Unique Booths list
  const uniqueVillages = useMemo(() => Array.from(new Set(voters.map(v => v.village))), [voters]);
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
      saveMandalVoterRecord(editingVoter.village, updated);
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
    }).then((savedReport) => {
      setReportsList((prev) => [savedReport, ...prev.filter((item) => item.id !== newReport.id)]);
    }).catch(() => {
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
    }).then((savedReport) => {
      setReportsList((prev) => [savedReport, ...prev.filter((item) => item.id !== newReport.id)]);
    }).catch(() => {
    });
  };

  // Create new task
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !newTaskInstructions.trim()) return;

    const assigneeObj = ALL_CADRES.find(i => i.id === newTaskAssignee);
    const assigneeName = assigneeObj ? assigneeObj.name : 'All Cadres';

    const newTask: VoterTask = {
      id: `task-${Date.now()}`,
      title: newTaskTitle,
      instructions: newTaskInstructions,
      assignedBy: 'Mandal Incharge',
      priority: newTaskPriority,
      assignedDate: new Date().toISOString().split('T')[0],
      dueDate: newTaskDueDate,
      status: 'Pending',
      assignedTo: newTaskAssignee
    };

    const updated = [newTask, ...tasksList];
    setTasksList(updated);
    setNewTaskTitle('');
    setNewTaskInstructions('');
    void createTask({
      title: newTask.title,
      instructions: newTask.instructions,
      assignedBy: 'Mandal Incharge',
      priority: newTask.priority,
      dueDate: newTask.dueDate,
      sourceUnitId: session.unitId,
      assigneeId: newTaskAssignee,
    }).then((savedTask) => {
      setTasksList((prev) => [savedTask, ...prev.filter((item) => item.id !== newTask.id)]);
    }).catch(() => {
    });
  };

  const handleWatchTraining = (video: TrainingVideo) => {
    setWatchingVideo(video);

    const existing = trainingProgress[video.id];
    if (existing) {
      if (existing.status === 'WATCHED' || existing.status === 'COMPLETED') {
        return;
      }

      void updateTrainingProgress(existing.id, 'WATCHED').then(() => {
        setTrainingProgress((prev) => ({
          ...prev,
          [video.id]: { ...existing, status: 'WATCHED', watchedAt: new Date().toISOString() },
        }));
      }).catch(() => {
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
      }).catch(() => {
      });
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
      const matchesVillage = villageFilter === 'All' || v.village === villageFilter;
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

      return matchesSearch && matchesVillage && matchesBooth && matchesPref && matchesStatus && matchesLocation;
    });
  }, [voters, searchQuery, villageFilter, boothFilter, preferenceFilter, statusFilter, locationFilter]);

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
      '18–25': { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 },
      '26–40': { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 },
      '41–60': { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 },
      '60+': { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 }
    };
    const genderSupport: Record<string, Record<VoterPreference, number>> = {
      'Male': { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 },
      'Female': { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 },
      'Other': { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 }
    };

    filteredVotersForCasteAnalytics.forEach(v => {
      const p = v.politicalPreference || 'Neutral';
      
      // Caste
      const casteKey = v.caste || 'Other Caste';
      if (!casteSupport[casteKey]) {
        casteSupport[casteKey] = { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 };
      }
      casteSupport[casteKey][p]++;

      // Profession
      const profKey = v.profession || 'Others';
      if (!professionSupport[profKey]) {
        professionSupport[profKey] = { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 };
      }
      professionSupport[profKey][p]++;

      // Age Group: 18–25, 26–40, 41–60, 60+
      let ageKey = '41–60';
      if (v.age >= 18 && v.age <= 25) ageKey = '18–25';
      else if (v.age >= 26 && v.age <= 40) ageKey = '26–40';
      else if (v.age >= 41 && v.age <= 60) ageKey = '41–60';
      else if (v.age > 60) ageKey = '60+';
      
      if (ageSupport[ageKey]) {
        ageSupport[ageKey][p]++;
      }

      // Gender: Male, Female, Other
      const genderKey = v.gender === 'Female' ? 'Female' : (v.gender === 'Male' ? 'Male' : 'Other');
      if (genderSupport[genderKey]) {
        genderSupport[genderKey][p]++;
      }
    });

    const formatChartData = (rawObj: Record<string, Record<VoterPreference, number>>, maxRows = 20) => {
      return Object.entries(rawObj).map(([name, prefs]) => {
        const total = Object.values(prefs).reduce((a, b) => a + b, 0);
        return {
          name,
          total,
          prefs
        };
      })
      .filter(item => item.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, maxRows);
    };

    return {
      caste: formatChartData(casteSupport, 20),
      profession: formatChartData(professionSupport, 12),
      age: formatChartData(ageSupport, 4),
      gender: formatChartData(genderSupport, 3)
    };
  }, [filteredVotersForCasteAnalytics]);

  // Cadre Network computations
  const cadreNetworkList = useMemo(() => {
    return ALL_CADRES.map(inc => {
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
        ...inc,
        boothNumber: inc.group,
        votersCount: incVoters.length,
        counts,
        majorityParty: leaderParty,
        majorityCount: counts[leaderParty] || 0,
        majorityLead: majorityLead
      };
    });
  }, [voters]);

  // Booth Incharges Computations (3 prominent leaders)
  const boothInchargesData = useMemo(() => {
    const booths = ["Booth 145", "Booth 146", "Booth 147"];
    const names = ["M. Venkaiah Chowdary", "K. Prasada Reddy", "P. Srinivasa Naidu"];
    const mobiles = ["9848022145", "9848522146", "9848922147"];
    
    return booths.map((bName, idx) => {
      const boothVoters = voters.filter(v => v.boothNumber === bName && v.voterStatus !== 'Deceased');
      
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
        serial: `#0${idx + 1}`,
        name: names[idx],
        mobile: mobiles[idx],
        booth: bName,
        totalVoters: boothVoters.length,
        counts,
        majorityParty: leaderParty,
        majorityLead: lead
      };
    });
  }, [voters]);

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
                <p className="text-[9px] font-black tracking-widest uppercase text-slate-400">Mandal Command</p>
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
            <div className="w-10 h-10 rounded-lg bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-yellow-400 font-extrabold shrink-0 text-xs">
              VI
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-black text-slate-100 truncate uppercase">{session.userName}</h4>
              <p className="text-[9px] text-slate-400 font-bold truncate">MANDAL INCHARGE</p>
              <div className="text-[8px] text-slate-300 font-semibold mt-1 uppercase space-y-0.5">
                <p className="truncate">AC: {session.assignedConstituency}</p>
                <p className="truncate">Mandal: {session.assignedMandal}</p>
              </div>
              <div className="flex items-center gap-1 mt-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-[8px] text-slate-400 font-black tracking-widest uppercase font-mono" title={session.userId}>ID: {session.userId?.slice(-8).toUpperCase() || 'MANDAL'}</span>
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
              { id: 'village_list', name: 'Village List', icon: MapPin },
              { id: 'booth_incharge_list', name: 'Booth List & Analysis', icon: User },
              { id: 'fake_votes', name: 'Fake Votes', icon: AlertTriangle },
              { id: 'caste_analytics', name: 'Caste Analytics', icon: BarChart3 },
              { id: 'tasks', name: 'High Command Tasks', icon: Calendar },
              { id: 'cadre_network', name: 'Cadre Network', icon: Users },
              { id: 'training', name: 'Training Videos', icon: Video },
              { id: 'training_analytics', name: 'Training Analytics', icon: BarChart3 }
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
            
            {/* Mandal Header */}
            <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm" id="mandal-header-bar">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] bg-yellow-400 text-slate-950 px-2 py-0.5 rounded font-black uppercase tracking-widest">
                    Mandal Dashboard
                  </span>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight" id="mandal-overview-title">
                    Singarayakonda Mandal Dashboard
                  </h2>
                  <p className="text-sm text-slate-500 font-medium">Kondapi Assembly Constituency • Singarayakonda Mandal</p>
                </div>
                <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg border border-green-200">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-xs font-bold uppercase tracking-wider">Live Data: {backendSummary ? 'Connected' : 'Fallback'}</span>
                </div>
              </div>
            </div>

            {/* Top 4 Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" id="mandal-metrics-grid">
              {/* Card 1: Total Voters */}
              <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex flex-col justify-between" id="metric-total-voters">
                <div className="flex items-center justify-between mb-2">
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Total Voters</p>
                    <h3 className="text-2xl font-black text-slate-950 leading-none">{liveMandalStats.totalVoters.toLocaleString()}</h3>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg text-slate-500">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-2">
                  <p className="text-[10px] text-slate-500 font-bold">
                    Aggregated from backend hierarchy scope
                  </p>
                </div>
              </div>

              {/* Card 2: Total Villages */}
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex items-center justify-between" id="metric-total-villages">
                <div className="space-y-1.5">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Total Villages</p>
                  <h3 className="text-2xl font-black text-blue-600 leading-none">{liveMandalStats.totalVillages}</h3>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl text-slate-500">
                  <MapPin className="w-5 h-5" />
                </div>
              </div>

              {/* Card 3: Total Booths */}
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex items-center justify-between" id="metric-total-booths">
                <div className="space-y-1.5">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Total Booths</p>
                  <h3 className="text-2xl font-black text-purple-600 leading-none">{liveMandalStats.totalBooths}</h3>
                  <p className="text-[9px] text-slate-500 font-black">Booth Incharges: <span className="text-purple-600 font-black">{liveMandalStats.totalBooths}</span></p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl text-slate-500">
                  <FileText className="w-5 h-5" />
                </div>
              </div>               {/* Card 4: Projected Result */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm flex items-center justify-between" id="metric-projected-result">
                <div className="space-y-1 text-slate-950">
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">VOTES COMPLETED</p>
                  <h3 className="text-2xl font-black leading-none uppercase text-amber-600">{liveMandalStats.voted.toLocaleString()}</h3>
                  <div className="mt-1">
                    <p className="text-base font-black leading-none text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded w-fit">Remaining: {liveMandalStats.remaining.toLocaleString()}</p>
                    <p className="text-[9px] font-black text-slate-500 tracking-tight mt-1">
                      Real backend vote-status aggregation
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-amber-100 rounded-xl text-amber-600">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Voter Sentiment Share & Ground Report Breakdown Section */}
            
            {/* Projected Majority & Breakdown Cards */}
            <div className="space-y-6">
              
              {/* Projected Majority Card (Larger) */}
              <div className="bg-white border-2 border-yellow-400 rounded-2xl p-6 shadow-md" id="mandal-projected-majority">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-100 border border-yellow-200 text-yellow-800">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-black uppercase tracking-wider">PROJECTED RESULT</span>
                    </div>
                    
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mandal Political Position</h4>
                      <h3 className="text-2xl md:text-3xl font-black text-slate-900 leading-none tracking-tight uppercase">
                        TDP LEAD: <span className="text-yellow-600 font-extrabold">{forecastData.leadCountStr}</span>
                      </h3>
                      <p className="text-xs font-bold text-slate-500">
                        Label: <span className="text-yellow-600 font-black uppercase underline">Current Projection</span> (Not Official Result / Not Verified Survey Result)
                      </p>
                    </div>
                  </div>

                  {/* Village Winning/Trailing Counts and Stats */}
                  <div className="flex flex-wrap items-center gap-4 bg-slate-50 border border-slate-100 rounded-xl p-4 lg:min-w-[400px] justify-between">
                    <div className="space-y-1">
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Village-level Standing</span>
                      <div className="space-y-1">
                        <p className="text-xs font-black text-emerald-700 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          TDP Winning Villages: <span className="text-sm font-black underline">{liveMandalStats.winning}</span>
                        </p>
                        <p className="text-xs font-black text-orange-700 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                          YSRCP Winning Villages: <span className="text-sm font-black underline">{liveMandalStats.trailing}</span>
                        </p>
                      </div>
                    </div>
                    
                    <div className="border-l border-slate-200 pl-4 space-y-1">
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Total Voters</span>
                      <span className="block text-xl font-black text-slate-900 leading-none">{liveMandalStats.totalVoters.toLocaleString()}</span>
                      <span className="block text-[9px] text-slate-400 font-bold">Across {liveMandalStats.totalVillages} villages</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mandal Political Preference Breakdown Cards */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Mandal Political Preference Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {(() => {
                    const activeParties: VoterPreference[] = ['TDP', 'YSRCP', 'JSP', 'BJP', 'INC', 'Neutral'];
                    return activeParties.map((p) => {
                      const count = partyStats[p];
                      const pct = ((count / 52247) * 100).toFixed(1);
                      return (
                        <div key={p} className={"rounded-xl p-3 border " + PARTY_BG_COLORS[p]}>
                          <h4 className="text-[10px] font-black tracking-wider uppercase mb-1">{PARTY_NAMES[p]}</h4>
                          <div className="flex flex-col">
                            <span className="text-lg font-black leading-none">{count.toLocaleString()}</span>
                            <span className="text-[10px] font-bold opacity-80 mt-1">{pct}%</span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="sentiment-split-section">
              
              {/* Left 2 Columns: Donut Chart + Party List */}
              <div className="lg:col-span-2 bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-5">
                <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-slate-900 uppercase">MANDAL POLITICAL PREFERENCE BREAKDOWN</h3>
                    <p className="text-xs text-slate-400 font-semibold">Dynamic preference distribution of voters across Singarayakonda Mandal</p>
                  </div>
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
                          <span className="text-[10px] font-black uppercase text-slate-400">{PARTY_NAMES[hoveredSlice as VoterPreference]}</span>
                          <span className="text-base font-black text-slate-950">{partyStats[hoveredSlice as VoterPreference].toLocaleString()}</span>
                          <span className="text-[9px] font-bold text-slate-500">
                            {((partyStats[hoveredSlice as VoterPreference] / 52247) * 100).toFixed(1)}% Share
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[9px] font-bold uppercase text-slate-400">TOTAL</span>
                          <span className="text-lg font-black text-slate-950">52,247</span>
                          <span className="text-[9px] font-bold text-green-600 uppercase">VOTERS</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Ground Report Breakdown table list */}
                  <div className="flex-1 w-full space-y-2">
                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Mandal Political Preference Counts</h4>
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
                              <span className="text-slate-900">{slice.value.toLocaleString()} Votes</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${labelBg}`}>
                                {slice.percentage.toFixed(1)}%
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
                  <h3 className="font-bold text-base text-slate-900">SEND REPORT TO CONSTITUENCY INCHARGE</h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Report directly to Constituency Incharge</p>
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
            TAB: VILLAGE LIST VIEW & DRILLDOWN
           -------------------------------------------------------- */}
        {activeTab === 'village_list' && (
          <div className="space-y-6 animate-fade-in" id="mandal-village-list-view">
            
            {/* Database sum validation alert */}
            {totalVotersSum !== 52247 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 text-red-800 shadow-sm">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                <div className="text-xs font-bold">
                  <span className="font-black">DATABASE WARNING:</span> Singarayakonda Mandal total registered voters sum mismatch. Combined sum of villages is <span className="font-black underline">{totalVotersSum.toLocaleString()}</span> instead of expected <span className="font-black underline">52,247</span>. Please verify database integrity.
                </div>
              </div>
            )}

            {!selectedVillageName ? (
              <div className="space-y-6">
                
                {/* Redesigned TOP SUMMARY & FILTER BAR */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-xl font-black text-slate-950 uppercase tracking-tight">
                        SINGARAYAKONDA VILLAGE LIST
                      </h2>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">
                        Kondapi Assembly Constituency • Singarayakonda Mandal
                      </p>
                    </div>

                    {/* Search Box on Right */}
                    <div className="relative shrink-0 w-full sm:w-80">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search Village..."
                        value={villageSearchQuery}
                        onChange={(e) => setVillageSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 hover:bg-slate-100/75 focus:bg-white text-xs font-bold text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 transition-all"
                      />
                    </div>
                  </div>

                  {/* Dynamic Party Filter Tabs */}
                  <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-4">
                    {[
                      { id: 'All', label: `ALL (${villageCounts.all})` },
                      { id: 'Winning', label: `WINNING VILLAGES (${villageCounts.winning})` },
                      { id: 'Trailing', label: `TRAILING VILLAGES (${villageCounts.trailing})` }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setVillageListFilter(tab.id)}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer border ${
                          villageListFilter === tab.id
                            ? 'bg-yellow-400 text-slate-950 border-yellow-500 font-black shadow-md shadow-yellow-400/20'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Desktop and Tablet Table View */}
                <div className="hidden lg:block bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden" id="village-list-table-container">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                        <th className="py-4 px-4 text-center w-12">S.No</th>
                        <th className="py-4 px-4">Village Name</th>
                        <th className="py-4 px-4 text-right">Total Voters</th>
                        <th className="py-4 px-4 text-center">TDP</th>
                        <th className="py-4 px-4 text-center">YSRCP</th>
                        <th className="py-4 px-4 text-center">Neutral</th>
                        <th className="py-4 px-4 text-center">Status</th>
                        <th className="py-4 px-4 text-right">Lead</th>
                        <th className="py-4 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sortedVillages.map((v, index) => {
                        const metrics = getVillageMetrics(v.name, v.totalVoters);
                        const inchargeName = getVillageInchargeName(v.name);
                        
                        // TDP vs YSRCP based Status and Lead using VILLAGE_PROJECTED_MARGINS
                        const vKey = v.name.toUpperCase().trim();
                        const info = VILLAGE_PROJECTED_MARGINS[vKey] || { status: 'WINNING', margin: 0 };
                        const isWinning = info.status === 'WINNING';
                        const status = info.status;
                        const leadVal = info.margin;
                        const leadStr = leadVal.toLocaleString();

                        return (
                          <tr
                            key={v.name}
                            onClick={() => { setSelectedVillageName(v.name); setVillageSubTab('overview'); }}
                            className="hover:bg-slate-50/50 transition-colors cursor-pointer font-bold text-slate-700"
                          >
                            <td className="py-4 px-4 text-center text-slate-400 font-mono text-xs">
                              {String(index + 1).padStart(2, '0')}
                            </td>
                            <td className="py-4 px-4">
                              <span className="font-black text-slate-900 uppercase tracking-tight text-sm hover:text-yellow-600 transition-colors">
                                {v.name}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right font-black text-slate-950 text-sm">
                              {v.totalVoters.toLocaleString()}
                            </td>
                            
                            {/* Party Values Design */}
                            <td className="py-4 px-4 text-center">
                              <span className="bg-amber-50 text-amber-500 border border-amber-200 rounded-md px-2.5 py-1 font-mono text-sm font-black">
                                {metrics.tdp}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className="bg-blue-50 text-blue-600 border border-blue-200 rounded-md px-2.5 py-1 font-mono text-sm font-black">
                                {metrics.ysrcp}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className="bg-slate-50 text-slate-500 border border-slate-250 rounded-md px-2.5 py-1 font-mono text-sm font-black">
                                {metrics.neutral}
                              </span>
                            </td>

                            {/* Status Badge */}
                            <td className="py-4 px-4 text-center">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                status === 'WINNING' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                {status}
                              </span>
                            </td>

                            {/* Lead Column */}
                            <td className="py-4 px-4 text-right">
                              <span className={`inline-block font-mono text-xs font-black px-2 py-0.5 rounded ${
                                isWinning 
                                  ? 'text-emerald-600 bg-emerald-50 border border-emerald-150' 
                                  : 'text-rose-600 bg-rose-50 border border-rose-150'
                              }`}>
                                {isWinning ? '+' : '-'}{leadStr}
                              </span>
                            </td>

                            {/* Action Column - Call Incharge Icon */}
                            <td className="py-4 px-4 text-center">
                              <a
                                href={`tel:${getInchargePhone(v.name)}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 border border-emerald-100 transition-all shadow-sm cursor-pointer"
                                title={`Call Incharge ${inchargeName} (${getInchargePhone(v.name)})`}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile & Tablet Responsive Card Layout */}
                <div className="block lg:hidden space-y-4" id="village-list-mobile-cards">
                  {sortedVillages.map((v, index) => {
                    const metrics = getVillageMetrics(v.name, v.totalVoters);
                    const inchargeName = getVillageInchargeName(v.name);

                    // Calculating customized Status and Lead using VILLAGE_PROJECTED_MARGINS
                    const vKey = v.name.toUpperCase().trim();
                    const info = VILLAGE_PROJECTED_MARGINS[vKey] || { status: 'WINNING', margin: 0 };
                    const isWinning = info.status === 'WINNING';
                    const status = info.status;
                    const leadVal = info.margin;
                    const leadStr = leadVal.toLocaleString();

                    return (
                      <div
                        key={v.name}
                        onClick={() => { setSelectedVillageName(v.name); setVillageSubTab('overview'); }}
                        className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4 cursor-pointer hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-400 font-mono">#{String(index + 1).padStart(2, '0')}</span>
                              <span className="font-black text-slate-900 uppercase text-sm">{v.name}</span>
                            </div>
                            <p className="text-xs text-slate-500 font-bold">Incharge: {inchargeName}</p>
                          </div>
                          <div>
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${
                              isWinning 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                : 'bg-orange-50 text-orange-700 border-orange-100'
                            }`}>
                              {status}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-3">
                          <div>
                            <p className="text-[9px] text-slate-400 font-black uppercase">Total Voters</p>
                            <p className="text-xs font-black text-slate-900 mt-0.5">{v.totalVoters.toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] text-slate-400 font-black uppercase">Lead</p>
                            <span className={`font-mono text-xs font-black ${
                              isWinning ? 'text-emerald-600' : 'text-orange-600'
                            }`}>
                              {leadStr}
                            </span>
                          </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 grid grid-cols-3 gap-2 text-center text-[10px]">
                          <div>
                            <p className="text-slate-400 font-bold text-[8px] uppercase">TDP</p>
                            <span className="text-yellow-600 font-black">{metrics.tdp}</span>
                          </div>
                          <div>
                            <p className="text-slate-400 font-bold text-[8px] uppercase">YSRCP</p>
                            <span className="text-blue-600 font-black">{metrics.ysrcp}</span>
                          </div>
                          <div>
                            <p className="text-slate-400 font-bold text-[8px] uppercase">Neutral</p>
                            <span className="text-slate-500 font-black">{metrics.neutral}</span>
                          </div>
                        </div>

                        <div className="flex justify-end pt-1">
                          <a
                            href={`tel:${getInchargePhone(v.name)}`}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Call Incharge</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            ) : (
              // DRILLDOWN VIEW: Detailed command center of selected village
              (() => {
                const villageVoters = voters.filter(v => v.village.toUpperCase() === selectedVillageName.toUpperCase());
                const villageActiveVoters = villageVoters.filter(v => !v.voterStatus || v.voterStatus === 'Active' || v.voterStatus === 'Shifted');
                
                // Village level support breakdown
                const vStats: Record<VoterPreference, number> = { TDP: 0, YSRCP: 0, JSP: 0, BJP: 0, INC: 0, Neutral: 0, OTH: 0 };
                villageActiveVoters.forEach(v => {
                  const p = v.politicalPreference || 'Neutral';
                  if (vStats[p] !== undefined) vStats[p]++;
                });

                // Village level unique booths
                const vBooths = Array.from(new Set(villageVoters.map(v => v.boothNumber))).sort();

                // Village level fake count
                const vFakeCount = villageVoters.filter(v => v.voterStatus === 'Fake' || v.voterStatus === 'Duplicate' || v.voterStatus === 'Doubtful').length;

                // Village local vs migrated
                const vLocalCount = villageVoters.filter(v => v.voterLocationStatus === 'Local' || !v.voterLocationStatus).length;
                const vMigratedCount = villageVoters.length - vLocalCount;

                // Leading Party for specific village using VILLAGE_PROJECTED_MARGINS
                const vKey = selectedVillageName.toUpperCase().trim();
                const info = VILLAGE_PROJECTED_MARGINS[vKey] || { status: 'WINNING', margin: 0 };
                const leadingP = info.status === 'WINNING' ? 'TDP' : 'YSRCP';
                const leadingLead = info.margin;

                const selectedVillageSpec: MandalVillage = villagesSource.find(v => v.name.toUpperCase() === selectedVillageName.toUpperCase()) || villagesSource[0] || ({
                  sNo: '#01',
                  name: selectedVillageName,
                  totalVoters: villageVoters.length,
                  totalBooths: vBooths.length,
                  localVoters: vLocalCount,
                  migratedVoters: vMigratedCount,
                  pStats: vStats,
                  leadingParty: leadingP,
                  lead: leadingLead,
                } as MandalVillage);
                const vSpecTotal = selectedVillageSpec?.totalVoters ?? villageVoters.length;
                const villagePendingSurvey = Math.max(0, vSpecTotal - villageVoters.length);
                const villageSurveyPct = vSpecTotal > 0 ? ((villageVoters.length / vSpecTotal) * 100).toFixed(1) : '0.0';

                return (
                  <div className="space-y-6 animate-fade-in" id="village-drilldown-panel">
                    {/* Drilldown Header */}
                    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <button 
                          onClick={() => setSelectedVillageName(null)}
                          className="text-xs font-black text-yellow-600 hover:text-yellow-700 flex items-center gap-1.5 cursor-pointer uppercase transition-all mb-1 bg-yellow-50 px-2.5 py-1 rounded border border-yellow-200 w-fit"
                        >
                          ← Back to Villages Directory
                        </button>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                          {selectedVillageName} Command Center
                        </h2>
                        <p className="text-xs text-slate-500 font-bold">Kondapi Assembly Constituency • Singarayakonda Mandal • {selectedVillageName}</p>
                      </div>
                      <div className="flex items-center gap-2 bg-yellow-50 text-yellow-800 px-3 py-1.5 rounded-lg border border-yellow-200 h-fit shrink-0">
                        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                        <span className="text-[10px] font-black uppercase tracking-wider">Assigned Village Command Active</span>
                      </div>
                    </div>

                    {/* Drilled-down village sub-navigation tabs */}
                    <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                      {[
                        { id: 'overview', name: 'Overview', icon: Home },
                        { id: 'voters', name: 'Voter Directory', icon: Search },
                        { id: 'booths', name: 'Booths & Incharges', icon: User },
                        { id: 'live_track', name: 'Live Track', icon: RefreshCw },
                        { id: 'fake_votes', name: 'Fake Votes', icon: AlertTriangle },
                        { id: 'caste', name: 'Caste Analytics', icon: BarChart3 },
                        { id: 'cadre', name: 'Village Cadres', icon: Users }
                      ].map(t => (
                        <button
                          key={t.id}
                          onClick={() => setVillageSubTab(t.id as any)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer uppercase ${villageSubTab === t.id ? 'bg-yellow-400 text-slate-950 shadow' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
                        >
                          <t.icon className="w-3.5 h-3.5" />
                          <span>{t.name}</span>
                        </button>
                      ))}
                    </div>

                    {/* Sub Tab: Overview */}
                    {villageSubTab === 'overview' && (
                      <div className="space-y-6 animate-fade-in">
                        {/* REDESIGNED Summary Cards with separate Total, Reached, Pending, and Coverage metrics */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                            <span className="text-[9px] font-black uppercase text-slate-400">Total Voters</span>
                            <h3 className="text-xl font-black text-slate-900 leading-none mt-1">{selectedVillageSpec.totalVoters.toLocaleString()}</h3>
                            <p className="text-[8px] text-slate-400 font-bold mt-1 uppercase">Mandal Registry</p>
                          </div>
                          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                            <span className="text-[9px] font-black uppercase text-slate-400">Verified Voters</span>
                            <h3 className="text-xl font-black text-slate-900 leading-none mt-1">{villageVoters.length.toLocaleString()}</h3>
                            <p className="text-[8px] text-emerald-600 font-bold mt-1 uppercase">Active Mappings ({villageSurveyPct}%)</p>
                          </div>
                          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                            <span className="text-[9px] font-black uppercase text-slate-400">Pending Verification</span>
                            <h3 className="text-xl font-black text-slate-500 leading-none mt-1">{villagePendingSurvey.toLocaleString()}</h3>
                            <p className="text-[8px] text-slate-400 font-bold mt-1 uppercase">Unvisited Households</p>
                          </div>
                          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                            <span className="text-[9px] font-black uppercase text-slate-400">Coverage Progress</span>
                            <h3 className="text-xl font-black text-emerald-600 leading-none mt-1">{villageSurveyPct}%</h3>
                            <div className="w-full bg-slate-100 h-1 rounded-full mt-1.5 overflow-hidden">
                              <div className="bg-emerald-500 h-full" style={{ width: `${villageSurveyPct}%` }}></div>
                            </div>
                          </div>
                          <div className="bg-yellow-400 border border-yellow-500 rounded-xl p-4 shadow-sm">
                            <span className="text-[9px] font-black uppercase text-slate-950">Projected Winner</span>
                            <h3 className="text-base font-black text-slate-950 uppercase mt-1 truncate">{leadingP} LEADS</h3>
                            <p className="text-[8px] text-slate-950 font-bold mt-1 uppercase">Lead: {leadingLead.toLocaleString()} votes</p>
                          </div>
                        </div>

                        {/* Preference Support breakdown cards */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Village Preference Split</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                            {(Object.keys(vStats) as VoterPreference[]).map(key => {
                              const vCount = vStats[key];
                              const vPct = villageVoters.length > 0 ? ((vCount / villageVoters.length) * 100).toFixed(1) : '0.0';
                              return (
                                <div key={key} className={`rounded-xl p-3 border ${PARTY_BG_COLORS[key]}`}>
                                  <h5 className="text-[9px] font-black uppercase tracking-wider mb-0.5">{PARTY_NAMES[key]}</h5>
                                  <div className="flex flex-col">
                                    <span className="text-lg font-black leading-none">{vCount}</span>
                                    <span className="text-[10px] font-bold opacity-80 mt-1">{vPct}%</span>
                                  </div>
                                </div>
                              );
                            })}
                            <div className="rounded-xl p-3 border bg-slate-50 border-slate-200 text-slate-600">
                              <h5 className="text-[9px] font-black uppercase tracking-wider mb-0.5">Fake Votes</h5>
                              <div className="flex flex-col">
                                <span className="text-lg font-black leading-none">{vFakeCount}</span>
                                <span className="text-[10px] font-bold opacity-80 mt-1">
                                  {villageVoters.length > 0 ? ((vFakeCount / villageVoters.length) * 100).toFixed(1) : '0.0'}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Row 3: Village Incharge & Outreach Team Performance */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {/* Village Incharge Details */}
                          <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-4">
                            <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Village Incharge Details</h4>
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                                Active Duty
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-yellow-500 text-lg font-black shrink-0">
                                {getVillageInchargeName(selectedVillageName).split(' ').map(n => n[0]).join('')}
                              </div>
                              <div className="space-y-0.5">
                                <h5 className="font-black text-slate-900 text-sm uppercase">{getVillageInchargeName(selectedVillageName)}</h5>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Mandal Appointed Village Incharge</p>
                                <p className="text-xs font-mono text-slate-500 font-bold mt-1">📞 9123410001 (Dummy Contact)</p>
                              </div>
                            </div>
                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs space-y-1">
                              <p className="font-bold text-slate-700 uppercase">Assigned Mandate:</p>
                              <p className="text-slate-500 font-semibold leading-relaxed">
                                To coordinate polling booth agents across all {selectedVillageSpec.totalBooths} booths, conduct weekly voter outreach drives, and verify outreach data authenticity.
                              </p>
                            </div>
                          </div>

                          {/* Outreach Team Performance */}
                          <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-4">
                            <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Outreach Team Performance</h4>
                              <span className="text-yellow-600 bg-yellow-50 border border-yellow-100 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                                Phase 1 Complete
                              </span>
                            </div>
                            <div className="space-y-3">
                              {[
                                { name: "Team North Alpha", lead: "Ch. Rama Devi", target: 200, completed: 185 },
                                { name: "Team South Beta", lead: "K. Srinivasa Rao", target: 200, completed: 195 },
                                { name: "Team Central Delta", lead: "S. Anusha", target: 100, completed: 120 }
                              ].map((team, idx) => {
                                const pct = Math.round((team.completed / team.target) * 100);
                                return (
                                  <div key={idx} className="space-y-1 text-xs">
                                    <div className="flex justify-between font-bold text-slate-700">
                                      <span className="uppercase">{team.name} ({team.lead})</span>
                                      <span>{team.completed} / {team.target} ({pct}%)</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                      <div className="bg-yellow-400 h-full rounded-full" style={{ width: `${Math.min(100, pct)}%` }}></div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Row 4: Gender & Age Demographics */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {/* Gender Analysis */}
                          <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">Gender Demographics Analysis</h4>
                            {(() => {
                              const males = villageVoters.filter(v => v.gender === 'Male').length;
                              const females = villageVoters.filter(v => v.gender === 'Female').length;
                              const total = males + females;
                              const malePct = total > 0 ? Math.round((males / total) * 100) : 50;
                              const femalePct = total > 0 ? Math.round((females / total) * 100) : 50;

                              return (
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-blue-500"></span> MALE: {males} ({malePct}%)</span>
                                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-pink-500"></span> FEMALE: {females} ({femalePct}%)</span>
                                  </div>
                                  <div className="w-full flex h-4 rounded-full overflow-hidden text-center text-[10px] font-black text-white">
                                    <div className="bg-blue-500 h-full flex items-center justify-center" style={{ width: `${malePct}%` }}>MALE {malePct}%</div>
                                    <div className="bg-pink-500 h-full flex items-center justify-center" style={{ width: `${femalePct}%` }}>FEMALE {femalePct}%</div>
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed text-center">
                                    Balanced gender ratio observed across registered voters. Out-of-station male migration currently monitored.
                                  </p>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Age Group Analysis */}
                          <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">Age Cohort Distribution</h4>
                            {(() => {
                              const g1 = villageVoters.filter(v => v.age >= 18 && v.age <= 30).length;
                              const g2 = villageVoters.filter(v => v.age >= 31 && v.age <= 45).length;
                              const g3 = villageVoters.filter(v => v.age >= 46 && v.age <= 60).length;
                              const g4 = villageVoters.filter(v => v.age > 60).length;
                              const total = villageVoters.length;

                              return (
                                <div className="grid grid-cols-2 gap-4 text-center">
                                  {[
                                    { label: "Youth (18-30)", count: g1, color: "bg-emerald-500" },
                                    { label: "Middle Age (31-45)", count: g2, color: "bg-yellow-400" },
                                    { label: "Senior Cohort (46-60)", count: g3, color: "bg-blue-500" },
                                    { label: "Elderly (60+)", count: g4, color: "bg-purple-500" }
                                  ].map((g, idx) => {
                                    const pct = total > 0 ? ((g.count / total) * 100).toFixed(1) : '0';
                                    return (
                                      <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">{g.label}</span>
                                        <span className="text-sm font-black text-slate-800 block">{g.count} Voters</span>
                                        <div className="flex items-center justify-center gap-1">
                                          <div className={`w-1.5 h-1.5 rounded-full ${g.color}`} />
                                          <span className="text-[9px] text-slate-500 font-bold">{pct}% share</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                      </div>
                    )}

                    {/* Sub Tab: Voters Directory */}
                    {villageSubTab === 'voters' && (() => {
                      const filteredVillageVoters = villageVoters.filter(v => boothFilter === 'All' || v.boothNumber === boothFilter);
                      const start = (villageVotersPage - 1) * villageVotersPageSize;
                      const paginatedVillageVoters = filteredVillageVoters.slice(start, start + villageVotersPageSize);
                      return (
                        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-4 animate-fade-in">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                            <div>
                              <h4 className="text-sm font-black text-slate-900 uppercase">Voter Database - {selectedVillageName}</h4>
                              {boothFilter !== 'All' && (
                                <p className="text-[10px] font-black text-yellow-600 uppercase mt-0.5">Filtered by: {boothFilter}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold text-slate-500">Matches: {filteredVillageVoters.length} Voters</span>
                              {boothFilter !== 'All' && (
                                <button
                                  onClick={() => setBoothFilter('All')}
                                  className="text-[10px] font-black uppercase text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded border border-red-200 cursor-pointer"
                                >
                                  Clear Filter
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Table list of voters inside selected village */}
                          <div className="overflow-x-auto max-h-[450px]">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                                  <th className="py-2.5 px-3">EPIC ID</th>
                                  <th className="py-2.5 px-3">Voter Name</th>
                                  <th className="py-2.5 px-3">Age/Gender</th>
                                  <th className="py-2.5 px-3">Booth</th>
                                  <th className="py-2.5 px-3">Political Support</th>
                                  <th className="py-2.5 px-3">Caste / Community</th>
                                  <th className="py-2.5 px-3">Location</th>
                                  <th className="py-2.5 px-3">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {paginatedVillageVoters.map((v) => (
                                <tr key={v.epicNumber} className="hover:bg-slate-50 font-bold text-slate-700">
                                  <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">{v.epicNumber}</td>
                                  <td className="py-2.5 px-3 font-black text-slate-900">{v.name}</td>
                                  <td className="py-2.5 px-3">{v.age} / {v.gender}</td>
                                  <td className="py-2.5 px-3 truncate max-w-[120px]">{v.boothNumber}</td>
                                  <td className="py-2.5 px-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${PARTY_BG_COLORS[v.politicalPreference || 'Neutral']}`}>
                                      {v.politicalPreference}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3">{v.caste || 'Unspecified'}</td>
                                  <td className="py-2.5 px-3">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${v.voterLocationStatus === 'Migrated' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                                      {v.voterLocationStatus || 'Local'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <button 
                                      onClick={() => handleOpenEditModal(v)}
                                      className="p-1 text-slate-400 hover:text-yellow-600 rounded hover:bg-slate-100 cursor-pointer"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <Pagination
                          currentPage={villageVotersPage}
                          pageSize={villageVotersPageSize}
                          totalItems={filteredVillageVoters.length}
                          onPageChange={setVillageVotersPage}
                          onPageSizeChange={(newSize) => {
                            setVillageVotersPageSize(newSize);
                            setVillageVotersPage(1);
                          }}
                          pageSizeOptions={[10, 25, 50, 100]}
                          itemName="voters"
                          accentColor="amber"
                        />
                      </div>
                    );
                    })()}

                    {/* Sub Tab: Booths */}
                    {villageSubTab === 'booths' && (
                      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-4 animate-fade-in">
                        <h4 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2 uppercase">Polling Booths of {selectedVillageName}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {vBooths.map((bName) => {
                            const bVoters = villageVoters.filter(v => v.boothNumber === bName);
                            const bPresident = boothIncharges.find(b => b.booth === bName);
                            return (
                              <div key={bName} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                                <div className="flex justify-between items-start border-b border-slate-100 pb-1.5">
                                  <h5 className="font-black text-slate-900 text-xs uppercase">{bName}</h5>
                                  <span className="px-2 py-0.5 bg-yellow-400/10 text-yellow-800 rounded text-[9px] font-black uppercase">
                                    {bVoters.length} Voters
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] text-slate-400 font-bold uppercase">Booth President</p>
                                  <p className="text-xs font-black text-slate-800">{bPresident?.name || 'Assigned Cadre'}</p>
                                  <p className="text-[10px] text-slate-500 font-mono">{bPresident?.mobile || '98480xxxxx'}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Sub Tab: Live Track */}
                    {villageSubTab === 'live_track' && (
                      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-4 animate-fade-in">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <h4 className="text-sm font-black text-slate-900 uppercase">Live Voter Track - {selectedVillageName}</h4>
                          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold">Real-time Tracker</span>
                        </div>
                        {/* Simulation for live voter tracking */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {vBooths.map((bName) => {
                            const bVoters = villageVoters.filter(v => v.boothNumber === bName);
                            const bVoted = bVoters.filter(v => v.voteStatus === 'VOTE DONE').length;
                            const bVotedPct = bVoters.length > 0 ? Math.round((bVoted / bVoters.length) * 100) : 0;
                            return (
                              <div key={bName} className="p-4 rounded-xl border border-slate-100 bg-white shadow-sm space-y-3">
                                <h5 className="font-black text-slate-900 text-xs truncate uppercase">{bName}</h5>
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                    <span>Voting Progress</span>
                                    <span>{bVoted} / {bVoters.length} ({bVotedPct}%)</span>
                                  </div>
                                  <div className="w-full bg-slate-100 rounded-full h-2">
                                    <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${bVotedPct}%` }}></div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Sub Tab: Fake Votes */}
                    {villageSubTab === 'fake_votes' && (
                      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-4 animate-fade-in">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <h4 className="text-sm font-black text-slate-900 uppercase">Fake / Duplicate Detection - {selectedVillageName}</h4>
                          <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded font-black border border-red-100">
                            Total Detected: {vFakeCount} Records
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                                <th className="py-2.5 px-3">EPIC ID</th>
                                <th className="py-2.5 px-3">Voter Name</th>
                                <th className="py-2.5 px-3">Age/Gender</th>
                                <th className="py-2.5 px-3">Booth</th>
                                <th className="py-2.5 px-3">Status</th>
                                <th className="py-2.5 px-3">Caste</th>
                                <th className="py-2.5 px-3">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {villageVoters.filter(v => v.voterStatus === 'Fake' || v.voterStatus === 'Duplicate' || v.voterStatus === 'Doubtful').map((v) => (
                                <tr key={v.epicNumber} className="hover:bg-red-50/20 font-bold text-slate-700">
                                  <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">{v.epicNumber}</td>
                                  <td className="py-2.5 px-3 font-black text-slate-900">{v.name}</td>
                                  <td className="py-2.5 px-3">{v.age} / {v.gender}</td>
                                  <td className="py-2.5 px-3">{v.boothNumber}</td>
                                  <td className="py-2.5 px-3">
                                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-red-100 text-red-800">
                                      {v.voterStatus}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3">{v.caste || 'Unspecified'}</td>
                                  <td className="py-2.5 px-3">
                                    <button 
                                      onClick={() => handleOpenEditModal(v)}
                                      className="p-1 text-slate-400 hover:text-yellow-600 rounded hover:bg-slate-100 cursor-pointer"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              {vFakeCount === 0 && (
                                <tr>
                                  <td colSpan={7} className="text-center py-6 text-slate-400 font-medium">
                                    No fake, duplicate, or doubtful voter records identified in {selectedVillageName}.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Sub Tab: Caste Analytics */}
                    {villageSubTab === 'caste' && (
                      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-4 animate-fade-in">
                        <h4 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2 uppercase">Community & Caste Analytics - {selectedVillageName}</h4>
                        {/* Strictly manual caste/community counts of selected village */}
                        {(() => {
                          const casteCounts: Record<string, number> = {};
                          villageVoters.forEach(v => {
                            const c = v.caste || 'Unspecified';
                            casteCounts[c] = (casteCounts[c] || 0) + 1;
                          });

                          return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                              {Object.entries(casteCounts).map(([cName, count]) => {
                                const pct = villageVoters.length > 0 ? ((count / villageVoters.length) * 100).toFixed(1) : '0';
                                return (
                                  <div key={cName} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                                    <span className="text-[10px] font-black uppercase text-slate-400">{cName}</span>
                                    <h4 className="text-xl font-black text-slate-800 mt-1">{count}</h4>
                                    <p className="text-[9px] text-slate-500 font-bold mt-1">{pct}% of Village Sample</p>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Sub Tab: Village Cadre Network */}
                    {villageSubTab === 'cadre' && (
                      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-4 animate-fade-in">
                        <h4 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2 uppercase">Cadre Network - {selectedVillageName}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {ALL_CADRES.filter(c => (c.group || '').toUpperCase().includes((selectedVillageName || '').toUpperCase()) || (c.group || '').toUpperCase() === (selectedVillageName || '').toUpperCase()).map((c) => (
                            <div key={c.id} className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-600 font-black text-xs">
                                  {c.role.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-xs font-black text-slate-800">{c.name}</p>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase">{c.role.replace(/_/g, ' ')}</p>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono text-slate-400">{c.group}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* --------------------------------------------------------
            TAB: BOOTH LIST & ANALYSIS VIEW (REDESIGNED)
           -------------------------------------------------------- */}
        {activeTab === 'booth_incharge_list' && (
          <div className="space-y-6 animate-fade-in" id="mandal-booth-list-analysis-view">
            {/* Header & Controls Area */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Title block */}
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                    SINGARAYAKONDA BOOTH LIST & ANALYSIS (60)
                  </h2>
                  <p className="text-xs text-slate-400 font-bold mt-1">
                    “Booth-wise voter survey and political performance analysis”
                  </p>
                </div>

                {/* Right controls: Filter tabs & Search box */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Filter Tabs */}
                  <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      onClick={() => setBoothListActiveTab('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        boothListActiveTab === 'all'
                          ? 'bg-white text-slate-950 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      ALL (60)
                    </button>
                    <button
                      onClick={() => setBoothListActiveTab('winning')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                        boothListActiveTab === 'winning'
                          ? 'bg-yellow-400 text-slate-950 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      WINNING ({winningCount})
                    </button>
                    <button
                      onClick={() => setBoothListActiveTab('trailing')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                        boothListActiveTab === 'trailing'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      TRAILING ({trailingCount})
                    </button>
                  </div>

                  {/* Search Input */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={boothSearchQuery}
                      onChange={(e) => setBoothSearchQuery(e.target.value)}
                      placeholder="Search Booth/Village..."
                      className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-yellow-400 w-full sm:w-[220px] transition-all"
                    />
                    {boothSearchQuery && (
                      <button
                        onClick={() => setBoothSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[9px] font-black"
                      >
                        CLEAR
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Booth Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedBooths.map((b) => {
                let tdpPct = 0;
                let ysrcpPct = 0;
                let neutralPct = 0;
                if (b.classifiedVoters > 0) {
                  tdpPct = Math.round((b.tdp / b.classifiedVoters) * 100);
                  ysrcpPct = Math.round((b.ysrcp / b.classifiedVoters) * 100);
                  neutralPct = Math.max(0, 100 - tdpPct - ysrcpPct);
                }

                let statusText = "CLOSE CONTEST";
                let badgeStyle = "bg-amber-50 text-amber-700 border-amber-200";
                if (b.status === 'WINNING') {
                  statusText = "WINNING";
                  badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
                } else if (b.status === 'TRAILING') {
                  statusText = "TRAILING";
                  badgeStyle = "bg-rose-50 text-rose-700 border-rose-200";
                }

                const inchargeName = b.name && b.name.trim() !== '' ? b.name : 'Not Assigned';
                
                // Extract station name (parenthesis content)
                const locMatch = b.booth.match(/\(([^)]+)\)/);
                const stationName = locMatch ? locMatch[1] : 'Polling Station';
                const cleanBoothName = b.booth.split('(')[0].trim().toUpperCase();

                return (
                  <div
                    key={`${b.village}-${b.booth}`}
                    className="bg-white border border-slate-200 hover:border-amber-400 hover:shadow-md rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between space-y-4"
                    id={`booth-card-${b.displayNum}`}
                  >
                    {/* Card Header */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1">
                        <span className="inline-block text-[10px] font-black tracking-wider text-slate-400 uppercase">
                          {cleanBoothName}
                        </span>
                        <h3 className="text-base font-black text-slate-900 leading-tight uppercase">
                          {inchargeName}
                        </h3>
                        <p className="text-xs text-slate-500 font-bold flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{b.village}</span>
                          <span className="text-slate-300">•</span>
                          <span className="truncate max-w-[120px]" title={stationName}>{stationName}</span>
                        </p>
                      </div>
                      
                      {/* Status Badge */}
                      <span className={`px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${badgeStyle} shrink-0`}>
                        {statusText}
                      </span>
                    </div>

                    {/* Support Bar Chart Area */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      {/* Counts Grid */}
                      <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-black uppercase">
                        <div className="bg-amber-50/50 p-1.5 rounded-lg border border-amber-200">
                          <span className="block text-[8px] text-amber-600 font-black tracking-wider">TDP</span>
                          <span className="text-xs font-black text-amber-500">{b.tdp}</span>
                        </div>
                        <div className="bg-blue-50/50 p-1.5 rounded-lg border border-blue-200">
                          <span className="block text-[8px] text-blue-600 font-black tracking-wider">YSRCP</span>
                          <span className="text-xs font-black text-blue-600">{b.ysrcp}</span>
                        </div>
                        <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                          <span className="block text-[8px] text-slate-500 font-black tracking-wider">NEUTRAL</span>
                          <span className="text-xs font-black text-slate-600">{b.neutral}</span>
                        </div>
                      </div>

                      {/* 3-Color Support Bar */}
                      <div className="h-2 w-full rounded-full bg-slate-100 flex overflow-hidden">
                        <div style={{ width: `${tdpPct}%` }} className="bg-amber-400 transition-all duration-300" title={`TDP: ${tdpPct}%`} />
                        <div style={{ width: `${ysrcpPct}%` }} className="bg-blue-500 transition-all duration-300" title={`YSRCP: ${ysrcpPct}%`} />
                        <div style={{ width: `${neutralPct}%` }} className="bg-slate-400 transition-all duration-300" title={`Neutral: ${neutralPct}%`} />
                      </div>

                      {/* Percentages Text Row */}
                      <div className="flex justify-between items-center text-[10px] font-black text-slate-500 px-0.5">
                        <span className="text-amber-500">TDP {tdpPct}%</span>
                        <span className="text-blue-600">YSRCP {ysrcpPct}%</span>
                        <span className="text-slate-500">Neutral {neutralPct}%</span>
                      </div>
                    </div>

                    {/* Card Footer: Registered Voters & Margin */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">
                          Total Voters
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm font-black text-slate-950">
                            {b.totalVoters.toLocaleString()}
                          </span>
                          <span className="text-[9px] text-slate-500 font-black">
                            (Surveyed: {b.classifiedVoters})
                          </span>
                        </div>
                      </div>

                      <div className="space-y-0.5 text-right">
                        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">
                          Margin
                        </span>
                        <span className={`text-xs font-black px-2 py-0.5 border rounded-md ${
                          b.margin > 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : b.margin < 0 ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-slate-600 bg-slate-50 border-slate-200'
                        }`}>
                          {b.margin > 0 ? `+${b.margin}` : b.margin === 0 ? '0' : b.margin}
                        </span>
                      </div>
                    </div>

                    {/* Action button: View Booth */}
                    <div className="pt-1 flex justify-end">
                      <button
                        onClick={() => {
                          setSelectedVillageName(b.village);
                          setBoothFilter(b.booth);
                          setVillageSubTab('voters');
                          setActiveTab('village_list');
                        }}
                        className="text-[10px] font-black text-yellow-600 hover:text-yellow-700 uppercase tracking-wider inline-flex items-center gap-0.5 hover:underline cursor-pointer"
                      >
                        <span>View Booth</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <Pagination
              currentPage={boothsPage}
              pageSize={boothsPageSize}
              totalItems={filteredBooths.length}
              onPageChange={setBoothsPage}
              onPageSizeChange={(newSize) => {
                setBoothsPageSize(newSize);
                setBoothsPage(1);
              }}
              pageSizeOptions={[6, 12, 24, 48]}
              itemName="booths"
              accentColor="amber"
            />

            {/* Empty State */}
            {filteredBooths.length === 0 && (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-10 text-center space-y-2">
                <p className="text-sm text-slate-500 font-black uppercase">No Booths Found</p>
                <p className="text-xs text-slate-400 font-semibold">Try modifying your search or filters to find booths</p>
              </div>
            )}
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
                <h3 className="text-2xl font-black text-slate-950 mt-1">{Array.from(new Set(fakeVotersList.map(v => v.boothNumber))).length} Polling Locations</h3>
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
                  const assignedToIncharge = ALL_CADRES.find(i => i.id === task.assignedTo);
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
                    {ALL_CADRES.map(i => (
                      <option key={i.id} value={i.id}>{i.name} ({i.group})</option>
                    ))}
                    <option value="All">All Incharges / Cadres</option>
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
          <div className="space-y-6 animate-fade-in pb-12" id="village-analytics-view">
            
            {/* Redesigned Header Block */}
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6" id="analytics-header">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[10px] font-black text-yellow-600 uppercase tracking-widest">
                  <span>Kondapi Assembly Constituency</span>
                  <span className="text-slate-350">•</span>
                  <span>Singarayakonda Mandal</span>
                  <span className="text-slate-350">•</span>
                  <span>Mandal Incharge</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Caste Analytics</h2>
                <p className="text-xs text-slate-500 font-bold">Detailed political and demographic analysis of Singarayakonda Mandal</p>
              </div>
              
              <div className="flex items-center gap-4 shrink-0">
                <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 text-right min-w-[180px] shadow-sm">
                  <span className="block text-[9px] font-black uppercase text-yellow-400 tracking-widest">TOTAL MANDAL VOTERS</span>
                  <span className="text-2xl font-black tracking-tight block mt-0.5">52,247</span>
                </div>
                <div className="bg-yellow-50/50 border border-yellow-100 rounded-2xl p-4 text-right min-w-[180px]">
                  <span className="block text-[9px] font-black uppercase text-yellow-700 tracking-widest">ANALYZED RECORDS</span>
                  <span className="text-2xl font-black text-yellow-800 block mt-0.5">
                    {filteredVotersForCasteAnalytics.length.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Support Legend */}
            <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                <span className="text-slate-400 font-black">Support Legend:</span>
                {(Object.keys(PARTY_COLORS) as VoterPreference[]).map(p => (
                  <span key={p} className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PARTY_COLORS[p] }}></span>
                    {PARTY_NAMES[p]}
                  </span>
                ))}
              </div>
              
              {(casteFilterVillage !== 'all' || casteFilterCaste !== 'all' || casteFilterGender !== 'all' || casteFilterAgeGroup !== 'all' || casteFilterProfession !== 'all') && (
                <button 
                  onClick={() => {
                    setCasteFilterVillage('all');
                    setCasteFilterCaste('all');
                    setCasteFilterGender('all');
                    setCasteFilterAgeGroup('all');
                    setCasteFilterProfession('all');
                  }}
                  className="text-xs font-black text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 cursor-pointer bg-red-50 px-3 py-1.5 rounded-xl border border-red-100"
                >
                  Clear All Filters
                </button>
              )}
            </div>

            {/* Custom Interactive Filters Panel */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3" id="caste-analytics-filters">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Interactive Analytics Filters</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Village</label>
                  <select
                    value={casteFilterVillage}
                    onChange={(e) => setCasteFilterVillage(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-yellow-400"
                  >
                    <option value="all">All Villages</option>
                    {availableVillages.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Caste Group</label>
                  <select
                    value={casteFilterCaste}
                    onChange={(e) => setCasteFilterCaste(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-yellow-400"
                  >
                    <option value="all">All Castes</option>
                    {availableCastes.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Gender</label>
                  <select
                    value={casteFilterGender}
                    onChange={(e) => setCasteFilterGender(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-yellow-400"
                  >
                    <option value="all">All Genders</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Age Group</label>
                  <select
                    value={casteFilterAgeGroup}
                    onChange={(e) => setCasteFilterAgeGroup(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-yellow-400"
                  >
                    <option value="all">All Age Groups</option>
                    <option value="18-25">18–25</option>
                    <option value="26-40">26–40</option>
                    <option value="41-60">41–60</option>
                    <option value="60+">60+</option>
                  </select>
                </div>
                <div className="space-y-1 col-span-2 md:col-span-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Profession</label>
                  <select
                    value={casteFilterProfession}
                    onChange={(e) => setCasteFilterProfession(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-yellow-400"
                  >
                    <option value="all">All Professions</option>
                    {availableProfessions.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Caste Verification Security Mandate Banner */}
            <div className="bg-rose-50/75 border-l-4 border-rose-500 p-4 rounded-r-2xl shadow-xs flex gap-3.5" id="caste-verification-warning-banner">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-black text-rose-800 uppercase tracking-wide">CASTE AUDIT SECURITY MANDATE</h4>
                <p className="text-xs text-rose-700 font-bold leading-relaxed mt-0.5">
                  WARNING: Never automatically infer caste from Name, Religion, Village, or Family Name. Caste must ONLY be recorded based on physical ground-verified rolls.
                </p>
              </div>
            </div>

            {/* Bento Grid layout matching the requested Political & Demographic Redesign */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="analytics-grid">
              
              {/* Box 1: Caste-wise Political Analysis (Left) */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">Caste-wise Political Analysis</h3>
                    <p className="text-[11px] text-slate-400 font-bold mt-0.5">Click any caste row for complete demographic audit</p>
                  </div>
                  <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                    {casteChartsData.caste.length} Categories
                  </span>
                </div>
                
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 flex-1">
                  {casteChartsData.caste.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs font-bold">
                      No Records Found For Current Filters
                    </div>
                  ) : (
                    casteChartsData.caste.map((item) => (
                      <div 
                        key={item.name} 
                        onClick={() => setActiveCasteDetail(item.name)}
                        className="space-y-2 cursor-pointer hover:bg-slate-50 p-2 rounded-xl transition-all border border-transparent hover:border-slate-100"
                        title="Click to view detailed profiling"
                      >
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-900 font-extrabold hover:text-yellow-600 transition-colors flex items-center gap-1.5">
                            {item.name}
                            <span className="text-[10px] text-slate-400 font-black bg-slate-100 px-2 py-0.5 rounded-md">
                              {item.total.toLocaleString()} Voters
                            </span>
                          </span>
                          <span className="text-[11px] text-slate-500 font-extrabold">
                            TDP: {item.prefs.TDP.toLocaleString()} • YSRCP: {item.prefs.YSRCP.toLocaleString()}
                          </span>
                        </div>
                        
                        {/* Horizontal Stacked Bar */}
                        <div className="w-full bg-slate-100 h-5 rounded-md border border-slate-150 overflow-hidden flex shadow-inner">
                          {(Object.keys(PARTY_COLORS) as VoterPreference[]).map((p) => {
                            const count = item.prefs[p] || 0;
                            const pct = item.total > 0 ? (count / item.total) * 100 : 0;
                            if (pct <= 0) return null;
                            return (
                              <div
                                key={p}
                                className="h-full transition-all duration-300 relative hover:brightness-95 hover:scale-y-110"
                                style={{ 
                                  width: `${pct}%`, 
                                  backgroundColor: PARTY_COLORS[p] 
                                }}
                                onMouseMove={(e) => {
                                  setHoveredSegment({
                                    type: 'caste',
                                    category: item.name,
                                    party: p,
                                    count,
                                    pct,
                                    total: item.total,
                                    x: e.clientX,
                                    y: e.clientY
                                  });
                                }}
                                onMouseLeave={() => setHoveredSegment(null)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Box 2: Profession & Demographics Panel (Right) */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-6">
                
                {/* 2A. Profession Analysis */}
                <div className="space-y-3">
                  <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Profession Analysis</h4>
                      <p className="text-[10px] text-slate-400 font-bold">Political preference across occupational brackets</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                      {casteChartsData.profession.length} Cohorts
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[190px] overflow-y-auto pr-1">
                    {casteChartsData.profession.length === 0 ? (
                      <p className="text-center py-6 text-slate-400 text-xs font-bold">No Profession Data</p>
                    ) : (
                      casteChartsData.profession.map((item) => (
                        <div key={item.name} className="space-y-1.5 p-1 rounded-lg hover:bg-slate-50/50 transition-all">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-slate-800 font-extrabold flex items-center gap-1">
                              {item.name}
                              <span className="text-[10px] text-slate-450 font-bold">({item.total})</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">
                              TDP: {item.prefs.TDP} • YSRCP: {item.prefs.YSRCP}
                            </span>
                          </div>
                          
                          <div className="w-full bg-slate-100 h-3 rounded overflow-hidden flex shadow-inner">
                            {(Object.keys(PARTY_COLORS) as VoterPreference[]).map((p) => {
                              const count = item.prefs[p] || 0;
                              const pct = item.total > 0 ? (count / item.total) * 100 : 0;
                              if (pct <= 0) return null;
                              return (
                                <div
                                  key={p}
                                  className="h-full transition-all duration-300 relative hover:brightness-95"
                                  style={{ 
                                    width: `${pct}%`, 
                                    backgroundColor: PARTY_COLORS[p] 
                                  }}
                                  onMouseMove={(e) => {
                                    setHoveredSegment({
                                      type: 'profession',
                                      category: item.name,
                                      party: p,
                                      count,
                                      pct,
                                      total: item.total,
                                      x: e.clientX,
                                      y: e.clientY
                                    });
                                  }}
                                  onMouseLeave={() => setHoveredSegment(null)}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 2B. Age Group Analysis */}
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Age Group Analysis</h4>
                      <p className="text-[10px] text-slate-400 font-bold">Voter preferences segmented by age cohort</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-450">4 Ranges</span>
                  </div>

                  <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                    {casteChartsData.age.map((item) => (
                      <div key={item.name} className="space-y-1.5 p-1 rounded-lg hover:bg-slate-50/50 transition-all">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-800 font-extrabold">
                            Age {item.name} <span className="text-[10px] text-slate-450 font-bold">({item.total})</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            TDP: {item.prefs.TDP} • YSRCP: {item.prefs.YSRCP}
                          </span>
                        </div>
                        
                        <div className="w-full bg-slate-100 h-3 rounded overflow-hidden flex shadow-inner">
                          {(Object.keys(PARTY_COLORS) as VoterPreference[]).map((p) => {
                            const count = item.prefs[p] || 0;
                            const pct = item.total > 0 ? (count / item.total) * 100 : 0;
                            if (pct <= 0) return null;
                            return (
                              <div
                                key={p}
                                className="h-full transition-all duration-300 relative hover:brightness-95"
                                style={{ 
                                  width: `${pct}%`, 
                                  backgroundColor: PARTY_COLORS[p] 
                                }}
                                onMouseMove={(e) => {
                                  setHoveredSegment({
                                    type: 'age',
                                    category: item.name,
                                    party: p,
                                    count,
                                    pct,
                                    total: item.total,
                                    x: e.clientX,
                                    y: e.clientY
                                  });
                                }}
                                onMouseLeave={() => setHoveredSegment(null)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2C. Gender Support Analysis */}
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Gender Support Analysis</h4>
                      <p className="text-[10px] text-slate-400 font-bold">Demographic preference split by gender</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {casteChartsData.gender.map((item) => (
                      <div key={item.name} className="space-y-1.5 p-1 rounded-lg hover:bg-slate-50/50 transition-all">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-800 font-extrabold">
                            {item.name} <span className="text-[10px] text-slate-450 font-bold">({item.total})</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            TDP: {item.prefs.TDP} • YSRCP: {item.prefs.YSRCP}
                          </span>
                        </div>
                        
                        <div className="w-full bg-slate-100 h-3 rounded overflow-hidden flex shadow-inner">
                          {(Object.keys(PARTY_COLORS) as VoterPreference[]).map((p) => {
                            const count = item.prefs[p] || 0;
                            const pct = item.total > 0 ? (count / item.total) * 100 : 0;
                            if (pct <= 0) return null;
                            return (
                              <div
                                key={p}
                                className="h-full transition-all duration-300 relative hover:brightness-95"
                                style={{ 
                                  width: `${pct}%`, 
                                  backgroundColor: PARTY_COLORS[p] 
                                }}
                                onMouseMove={(e) => {
                                  setHoveredSegment({
                                    type: 'gender',
                                    category: item.name,
                                    party: p,
                                    count,
                                    pct,
                                    total: item.total,
                                    x: e.clientX,
                                    y: e.clientY
                                  });
                                }}
                                onMouseLeave={() => setHoveredSegment(null)}
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

            {/* Interactive Tooltip Component */}
            {hoveredSegment && (
              <div 
                className="fixed z-50 bg-slate-900 text-white text-xs rounded-xl p-3 shadow-xl border border-slate-800 space-y-1.5 pointer-events-none transition-all duration-75 min-w-[200px]"
                style={{ left: hoveredSegment.x + 15, top: hoveredSegment.y + 15 }}
              >
                <div className="font-extrabold border-b border-slate-800 pb-1 text-slate-200">
                  {hoveredSegment.category} ({hoveredSegment.type.toUpperCase()})
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Party Preference:</span>
                  <span className="font-black" style={{ color: PARTY_COLORS[hoveredSegment.party] }}>
                    {PARTY_NAMES[hoveredSegment.party]}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Voters Count:</span>
                  <span className="font-bold text-white">
                    {hoveredSegment.count.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Share of Category:</span>
                  <span className="font-bold text-white">
                    {hoveredSegment.pct.toFixed(1)}%
                  </span>
                </div>
                <div className="text-[9px] text-slate-500 pt-1 text-right">
                  Category Total: {hoveredSegment.total.toLocaleString()}
                </div>
              </div>
            )}

            {/* Caste Detail Modal View */}
            {activeCasteDetail && casteDetailData && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-scale-up">
                  {/* Modal Header */}
                  <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase text-yellow-400 tracking-widest block">Detailed Caste Audit</span>
                      <h3 className="text-lg font-black tracking-tight">Caste Profile: {casteDetailData.casteName}</h3>
                    </div>
                    <button 
                      onClick={() => setActiveCasteDetail(null)}
                      className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {/* Modal Body */}
                  <div className="p-6 overflow-y-auto space-y-6">
                    {/* Top summary cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide block">Total Caste Voters</span>
                        <span className="text-2xl font-black text-slate-800">{casteDetailData.totalVoters.toLocaleString()}</span>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide block">Gender Breakdown</span>
                        <div className="mt-1 text-xs text-slate-600 font-bold space-y-0.5">
                          <div className="flex justify-between">
                            <span>Male:</span>
                            <span className="text-slate-800">{casteDetailData.gender.male} ({Math.round((casteDetailData.gender.male / casteDetailData.totalVoters) * 100) || 0}%)</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Female:</span>
                            <span className="text-slate-800">{casteDetailData.gender.female} ({Math.round((casteDetailData.gender.female / casteDetailData.totalVoters) * 100) || 0}%)</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide block">Age Group Split</span>
                        <div className="mt-1 text-xs text-slate-600 font-bold space-y-0.5">
                          <div className="flex justify-between">
                            <span>18–25:</span>
                            <span className="text-slate-800">{casteDetailData.age.age18_25}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>26–40:</span>
                            <span className="text-slate-800">{casteDetailData.age.age26_40}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide block">Top Profession</span>
                        <span className="text-sm font-black text-slate-800 block truncate mt-1">
                          {casteDetailData.professions[0] ? `${casteDetailData.professions[0].name} (${casteDetailData.professions[0].count})` : 'Others'}
                        </span>
                      </div>
                    </div>

                    {/* Support Breakdown Section */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Political Sentiment for {casteDetailData.casteName}</h4>
                      <div className="w-full bg-slate-200 h-6 rounded overflow-hidden flex shadow-inner">
                        {(Object.keys(PARTY_COLORS) as VoterPreference[]).map((p) => {
                          const count = casteDetailData.party[p] || 0;
                          const pct = casteDetailData.totalVoters > 0 ? (count / casteDetailData.totalVoters) * 100 : 0;
                          if (pct <= 0) return null;
                          return (
                            <div
                              key={p}
                              className="h-full transition-all duration-300 relative hover:brightness-95 flex items-center justify-center text-[10px] font-black text-white"
                              style={{ 
                                width: `${pct}%`, 
                                backgroundColor: PARTY_COLORS[p] 
                              }}
                              title={`${p}: ${count} (${Math.round(pct)}%)`}
                            >
                              {pct > 8 && `${PARTY_NAMES[p]} (${Math.round(pct)}%)`}
                            </div>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 text-center text-[10px] font-bold">
                        {(Object.keys(PARTY_COLORS) as VoterPreference[]).map(p => {
                          const count = casteDetailData.party[p] || 0;
                          return (
                            <div key={p} className="bg-white border border-slate-200 rounded p-1.5">
                              <span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ backgroundColor: PARTY_COLORS[p] }}></span>
                              <span className="text-slate-500">{PARTY_NAMES[p]}:</span> <span className="text-slate-800 font-black">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Village-wise Breakdown Table */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Village-wise Distribution</h4>
                        <span className="text-[10px] text-slate-400 font-semibold">Ordered by highest caste concentration</span>
                      </div>
                      
                      <div className="border border-slate-150 rounded-xl overflow-hidden bg-white shadow-sm">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              <th className="p-3">Village Name</th>
                              <th className="p-3 text-center">Caste Voters</th>
                              <th className="p-3 text-center">TDP Support</th>
                              <th className="p-3 text-center">YSRCP Support</th>
                              <th className="p-3 text-center">Neutral Support</th>
                              <th className="p-3 text-center">Leading Party</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {casteDetailData.villages.map(v => {
                              if (v.total === 0) return null;
                              return (
                                <tr key={v.villageName} className="hover:bg-slate-50/50 font-semibold">
                                  <td className="p-3 font-extrabold text-slate-900">{v.villageName}</td>
                                  <td className="p-3 text-center font-bold text-slate-700">{v.total.toLocaleString()}</td>
                                  <td className="p-3 text-center text-yellow-600 font-extrabold">{v.tdp}</td>
                                  <td className="p-3 text-center text-blue-600 font-extrabold">{v.ysrcp}</td>
                                  <td className="p-3 text-center text-slate-500 font-bold">{v.neutral}</td>
                                  <td className="p-3 text-center">
                                    {v.leadingParty === 'TDP' && (
                                      <span className="px-2 py-0.5 rounded bg-yellow-50 text-yellow-700 border border-yellow-100 text-[10px] font-black">
                                        TDP LEADING
                                      </span>
                                    )}
                                    {v.leadingParty === 'YSRCP' && (
                                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-black">
                                        YSRCP LEADING
                                      </span>
                                    )}
                                    {v.leadingParty === 'TIE' && (
                                      <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100 text-[10px] font-black">
                                        TIE
                                      </span>
                                    )}
                                    {v.leadingParty === 'Neutral' && (
                                      <span className="px-2 py-0.5 rounded bg-slate-50 text-slate-700 border border-slate-200 text-[10px] font-black">
                                        NEUTRAL
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  
                  {/* Modal Footer */}
                  <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex justify-end">
                    <button 
                      onClick={() => setActiveCasteDetail(null)}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-lg active:scale-95 transition-all shadow cursor-pointer"
                    >
                      Close Profile
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* --------------------------------------------------------
            TAB 8: CADRE NETWORK VIEW
           -------------------------------------------------------- */}
        {activeTab === 'cadre_network' && (
          <div className="space-y-6 animate-fade-in" id="village-cadre-network-view">
            
            {/* 1. Page Header */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-2">
              <span className="text-[10px] font-black tracking-widest text-yellow-600 uppercase">Kondapi Assembly Constituency</span>
              <h2 className="text-xl font-black text-slate-950 uppercase tracking-tight">Singarayakonda Mandal Cadre Network</h2>
              <p className="text-xs text-slate-500 font-bold">Organizational hierarchy, team coverage, and booth cadre assignments</p>
            </div>

            {/* 2. Top Summary Cards (Grid) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="cadre-summary-grid">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Total Voters</span>
                  <span className="text-xl font-black text-slate-950">52,247</span>
                </div>
              </div>

              <div className="bg-blue-50/40 border border-blue-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider block">Total Booths</span>
                  <span className="text-xl font-black text-blue-800">60 Booths</span>
                </div>
              </div>

              <div className="bg-purple-50/40 border border-purple-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-purple-700 uppercase tracking-wider block">Booth Incharges</span>
                  <span className="text-xl font-black text-purple-800">60 Positions</span>
                </div>
              </div>

              <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-500 shrink-0">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider block">100-Voter Incharges</span>
                  <span className="text-xl font-black text-amber-600">523 Slots</span>
                </div>
              </div>
            </div>

            {/* 3. Team Strength Summary & Breakdown Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="team-strength-breakdown">
              <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-5 shadow-sm space-y-4">
                <div className="border-b border-amber-200/60 pb-2">
                  <h3 className="text-xs font-black text-amber-800 uppercase tracking-widest">Field Team Strength</h3>
                  <p className="text-[11px] text-amber-700/80 mt-0.5">Grassroots field cadre operations team</p>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-4xl font-black text-amber-500">583</span>
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-wide">Active Field Members</span>
                </div>
                <div className="bg-white/80 rounded-xl p-3 border border-amber-200 space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-500">Booth Incharges:</span>
                    <span className="text-amber-600 font-black text-sm">60</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-500">100-Voter Incharges:</span>
                    <span className="text-amber-600 font-black text-sm">523</span>
                  </div>
                  <div className="pt-2 border-t border-amber-200 flex justify-between text-xs font-black text-slate-700">
                    <span>Calculation:</span>
                    <span className="text-amber-600 font-black">60 + 523 = 583</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <div className="border-b border-slate-200/60 pb-2">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Total Mandal Team Strength</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">End-to-end constituency hierarchy team size</p>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-4xl font-black text-slate-900">584</span>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Total Mandal Team</span>
                </div>
                <div className="bg-white/80 rounded-xl p-3 border border-slate-200 space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-500">Mandal Incharge:</span>
                    <span className="text-slate-900 font-black text-sm">1</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-500">Booth Incharges:</span>
                    <span className="text-slate-900 font-black text-sm">60</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-500">100-Voter Incharges:</span>
                    <span className="text-slate-900 font-black text-sm">523</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between text-xs font-black text-slate-700">
                    <span>Calculation:</span>
                    <span className="text-slate-900 font-black">1 + 60 + 523 = 584</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Organization Tree Hierarchy */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-5">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-950 uppercase tracking-wider">Mandal Command Structure</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Strict hierarchical visualization of Singarayakonda command flow</p>
              </div>

              <div className="flex flex-col items-center justify-center space-y-4 max-w-2xl mx-auto py-2">
                {/* Level 1: Mandal Incharge */}
                <div className="bg-slate-900 text-white rounded-xl p-4 w-full max-w-sm text-center border-2 border-yellow-400 shadow relative">
                  <span className="text-[8px] tracking-wider uppercase font-black bg-yellow-400 text-slate-950 px-2 py-0.5 rounded absolute -top-2.5 left-1/2 -translate-x-1/2">Level 1</span>
                  <h4 className="text-xs font-black uppercase tracking-wider text-yellow-400">Mandal Incharge</h4>
                  <p className="text-sm font-black mt-1">Singarayakonda Mandal Head</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">Coverage: 60 Booths | 52,247 Voters</p>
                </div>

                {/* Arrow */}
                <div className="flex flex-col items-center">
                  <div className="w-0.5 h-6 bg-slate-300"></div>
                  <div className="w-2 h-2 rounded-full bg-yellow-500 -mt-1"></div>
                </div>

                {/* Level 2: Booth Incharges */}
                <div className="bg-white border-2 border-slate-900 rounded-xl p-4 w-full max-w-sm text-center shadow relative">
                  <span className="text-[8px] tracking-wider uppercase font-black bg-slate-900 text-white px-2 py-0.5 rounded absolute -top-2.5 left-1/2 -translate-x-1/2">Level 2</span>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">Booth Incharges</h4>
                  <p className="text-sm font-black mt-1">60 Polling Station Leaders</p>
                  <p className="text-[10px] text-slate-500 font-bold mt-1">1 Assigned per Booth | Direct Field Management</p>
                </div>

                {/* Arrow */}
                <div className="flex flex-col items-center">
                  <div className="w-0.5 h-6 bg-slate-300"></div>
                  <div className="w-2 h-2 rounded-full bg-yellow-500 -mt-1"></div>
                </div>

                {/* Level 3: 100-Voter Incharges */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 w-full max-w-sm text-center shadow-sm relative">
                  <span className="text-[8px] tracking-wider uppercase font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded absolute -top-2.5 left-1/2 -translate-x-1/2">Level 3</span>
                  <h4 className="text-xs font-black uppercase tracking-wider text-yellow-600">100-Voter Incharges</h4>
                  <p className="text-sm font-black mt-1">523 Cluster Leaders</p>
                  <p className="text-[10px] text-slate-500 font-bold mt-1">
                    {totalAssignedV100} / 523 Slots Filled ({Math.round((totalAssignedV100 / 523) * 100)}%)
                  </p>
                </div>

                {/* Arrow */}
                <div className="flex flex-col items-center">
                  <div className="w-0.5 h-6 bg-slate-300"></div>
                  <div className="w-2 h-2 rounded-full bg-yellow-500 -mt-1"></div>
                </div>

                {/* Level 4: Registered Voters */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 w-full max-w-sm text-center relative">
                  <span className="text-[8px] tracking-wider uppercase font-black bg-slate-200 text-slate-600 px-2 py-0.5 rounded absolute -top-2.5 left-1/2 -translate-x-1/2">Level 4</span>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Registered Voters</h4>
                  <p className="text-sm font-black text-slate-800">52,247 Voters</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">Strict Electoral Roll Reconciliation</p>
                </div>
              </div>
            </div>

            {/* 5. Search, Filter & Booth Directory Table */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black text-slate-950 uppercase tracking-wider">Booth Cadre Directory</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Search and filter assignment statuses across all 60 booths</p>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={cadreSearchQuery}
                      onChange={(e) => setCadreSearchQuery(e.target.value)}
                      placeholder="Search Booth Number..."
                      className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-yellow-400 w-full sm:w-[200px]"
                    />
                    {cadreSearchQuery && (
                      <button 
                        onClick={() => setCadreSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 hover:text-slate-600"
                      >
                        CLEAR
                      </button>
                    )}
                  </div>

                  {/* Filters */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      onClick={() => setCadreFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                        cadreFilter === 'all' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      ALL (60)
                    </button>
                    <button
                      onClick={() => setCadreFilter('fully')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                        cadreFilter === 'fully' ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      FULLY
                    </button>
                    <button
                      onClick={() => setCadreFilter('partially')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                        cadreFilter === 'partially' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      PARTIAL
                    </button>
                    <button
                      onClick={() => setCadreFilter('not_assigned')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                        cadreFilter === 'not_assigned' ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      EMPTY
                    </button>
                  </div>
                </div>
              </div>

              {/* Directory Table */}
              <div className="border border-slate-150 rounded-xl overflow-hidden shadow-xs bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <th className="p-3">Booth No.</th>
                      <th className="p-3 text-center">Total Voters</th>
                      <th className="p-3">Booth Incharge</th>
                      <th className="p-3">Mobile</th>
                      <th className="p-3 text-center">100-Voter Incharges</th>
                      <th className="p-3 text-center">Assignment Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                    {VERIFIED_BOOTHS_DATA.filter((b, idx) => {
                      // Apply search
                      if (cadreSearchQuery.trim() !== '') {
                        const q = cadreSearchQuery.toLowerCase();
                        const numMatch = b.boothNumber.toString().includes(q) || `booth ${b.boothNumber}`.includes(q);
                        const incMatch = (boothInchargeOverrides[b.boothNumber]?.name || boothIncharges[idx]?.name || '').toLowerCase().includes(q);
                        if (!numMatch && !incMatch) return false;
                      }
                      
                      // Apply filter
                      const assignedCount = getBoothAssignedSlotsCount(b.boothNumber, b.v100InchargesCount);
                      const isFully = assignedCount === b.v100InchargesCount;
                      const isPart = assignedCount > 0 && assignedCount < b.v100InchargesCount;
                      const isNone = assignedCount === 0;

                      if (cadreFilter === 'fully' && !isFully) return false;
                      if (cadreFilter === 'partially' && !isPart) return false;
                      if (cadreFilter === 'not_assigned' && !isNone) return false;

                      return true;
                    }).map((b) => {
                      const idx = b.boothNumber - 224;
                      const inc = getBoothInchargeDetails(b.boothNumber, idx);
                      const assignedSlots = getBoothAssignedSlotsCount(b.boothNumber, b.v100InchargesCount);
                      
                      let statusBadge = "bg-rose-50 text-rose-700 border-rose-100";
                      let statusText = "NOT ASSIGNED";
                      if (assignedSlots === b.v100InchargesCount) {
                        statusBadge = "bg-emerald-50 text-emerald-700 border-emerald-100";
                        statusText = "FULLY ASSIGNED";
                      } else if (assignedSlots > 0) {
                        statusBadge = "bg-amber-50 text-amber-700 border-amber-100";
                        statusText = "PARTIALLY ASSIGNED";
                      }

                      return (
                        <tr key={b.boothNumber} className="hover:bg-slate-50/50">
                          <td className="p-3 font-extrabold text-slate-900">Booth {b.boothNumber}</td>
                          <td className="p-3 text-center text-slate-600 font-bold">{b.totalVoters.toLocaleString()}</td>
                          <td className="p-3 font-extrabold text-slate-800 uppercase">{inc.name}</td>
                          <td className="p-3 text-slate-500 font-medium">{inc.mobile}</td>
                          <td className="p-3 text-center text-slate-700 font-bold">
                            {assignedSlots} / {b.v100InchargesCount}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black border uppercase tracking-wider ${statusBadge}`}>
                              {statusText}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => setSelectedBoothCadreNum(b.boothNumber)}
                              className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black rounded-lg transition-all"
                            >
                              View Cadre
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 6. Interactive BOOTH CADRE DETAIL Overlay Modal */}
            {selectedBoothCadreNum !== null && (() => {
              const b = VERIFIED_BOOTHS_DATA.find(x => x.boothNumber === selectedBoothCadreNum)!;
              const idx = b.boothNumber - 224;
              const inc = getBoothInchargeDetails(b.boothNumber, idx);
              const assignedSlots = getBoothAssignedSlotsCount(b.boothNumber, b.v100InchargesCount);
              const progressPct = Math.round((assignedSlots / b.v100InchargesCount) * 100);

              return (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
                  <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-scale-up">
                    {/* Header */}
                    <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-black uppercase text-yellow-400 tracking-widest block">Booth Cadre Management</span>
                        <h3 className="text-lg font-black tracking-tight">BOOTH {b.boothNumber} CADRE DETAIL</h3>
                      </div>
                      <button 
                        onClick={() => {
                          setSelectedBoothCadreNum(null);
                          setEditingSlotKey(null);
                          setEditingInchargeBooth(null);
                        }}
                        className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 overflow-y-auto space-y-6">
                      
                      {/* Booth Head Profile */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Booth Incharge profile</h4>
                          {editingInchargeBooth !== b.boothNumber ? (
                            <button
                              onClick={() => {
                                setEditingInchargeBooth(b.boothNumber);
                                setEditingInchargeName(inc.name === 'NOT ASSIGNED' ? '' : inc.name);
                                setEditingInchargeMobile(inc.mobile === 'NOT ASSIGNED' ? '' : inc.mobile);
                              }}
                              className="text-[10px] font-black text-yellow-600 hover:text-yellow-700 uppercase flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" /> Edit Incharge
                            </button>
                          ) : null}
                        </div>

                        {editingInchargeBooth === b.boothNumber ? (
                          <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Edit Booth Incharge Details</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <input
                                type="text"
                                value={editingInchargeName}
                                onChange={(e) => setEditingInchargeName(e.target.value)}
                                placeholder="Incharge Full Name"
                                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-yellow-400 w-full"
                              />
                              <input
                                type="text"
                                value={editingInchargeMobile}
                                onChange={(e) => setEditingInchargeMobile(e.target.value)}
                                placeholder="Mobile Number"
                                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-yellow-400 w-full"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setEditingInchargeBooth(null)}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs font-black uppercase"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveBoothIncharge(b.boothNumber, editingInchargeName, editingInchargeMobile)}
                                className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-black uppercase"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-1">
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Booth Leader Name:</span>
                              <span className="font-extrabold text-slate-900 uppercase">{inc.name}</span>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Mobile Contact:</span>
                              <span className="font-extrabold text-slate-700">{inc.mobile}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Stat summary */}
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <span className="text-[9px] text-slate-400 font-bold uppercase block">Registered Voters</span>
                          <span className="text-base font-black text-slate-800">{b.totalVoters.toLocaleString()}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <span className="text-[9px] text-slate-400 font-bold uppercase block">Allocated Clusters</span>
                          <span className="text-base font-black text-slate-800">{b.v100InchargesCount}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <span className="text-[9px] text-slate-400 font-bold uppercase block">Filled Clusters</span>
                          <span className="text-base font-black text-yellow-600">{assignedSlots}</span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                          <span>Cadre Assignment Progress</span>
                          <span>{progressPct}% ({assignedSlots} / {b.v100InchargesCount} Filled)</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                          <div 
                            className="h-full bg-yellow-400 rounded-full transition-all duration-300" 
                            style={{ width: `${progressPct}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* 100-Voter Positions Directory */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-1">
                          100-Voter Incharge Positions Directory
                        </h4>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          {Array.from({ length: b.v100InchargesCount }).map((_, sIdx) => {
                            const slotKey = `${b.boothNumber}-${sIdx}`;
                            const assignedName = cadreAssignments[slotKey];
                            const isEditingThis = editingSlotKey === slotKey;

                            return (
                              <div 
                                key={slotKey} 
                                className="p-3 bg-white border border-slate-100 rounded-xl hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs"
                              >
                                <div className="space-y-0.5">
                                  <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                                    Cluster Incharge Position #{sIdx + 1}
                                  </span>
                                  {isEditingThis ? (
                                    <div className="flex items-center gap-2 mt-2">
                                      <input
                                        type="text"
                                        value={editingSlotName}
                                        onChange={(e) => setEditingSlotName(e.target.value)}
                                        placeholder="Full Name of Incharge"
                                        className="px-2 py-1 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-yellow-400 w-full sm:w-[220px]"
                                      />
                                      <button
                                        onClick={() => handleSaveSlot(slotKey, editingSlotName)}
                                        className="p-1 bg-slate-950 text-white rounded hover:bg-slate-800 transition-all cursor-pointer"
                                        title="Save"
                                      >
                                        <Check className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => setEditingSlotKey(null)}
                                        className="p-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-all cursor-pointer"
                                        title="Cancel"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <p className={`text-xs font-extrabold mt-1 ${assignedName ? 'text-slate-900 uppercase' : 'text-slate-400 italic'}`}>
                                      {assignedName || 'NOT ASSIGNED'}
                                    </p>
                                  )}
                                </div>

                                {!isEditingThis && (
                                  <button
                                    onClick={() => {
                                      setEditingSlotKey(slotKey);
                                      setEditingSlotName(assignedName || '');
                                    }}
                                    className="px-2.5 py-1 text-[10px] font-black border border-slate-200 hover:border-yellow-400 text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-white rounded-lg transition-all text-center self-start sm:self-center"
                                  >
                                    {assignedName ? 'Edit Name' : 'Assign Position'}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>

                    {/* Footer */}
                    <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex justify-end">
                      <button 
                        onClick={() => {
                          setSelectedBoothCadreNum(null);
                          setEditingSlotKey(null);
                          setEditingInchargeBooth(null);
                        }}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-lg active:scale-95 transition-all shadow"
                      >
                        Close Detail View
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

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

        {/* --------------------------------------------------------
            TAB 10: TRAINING ANALYTICS PANEL
           -------------------------------------------------------- */}
        {activeTab === 'training_analytics' && (
          <div className="space-y-6 animate-fade-in" id="mandal-training-analytics">
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-900 uppercase">Cadre Training & Analytics Dashboard</h2>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">Real-time completion metrics, performance indices, and village-wise status for Singarayakonda Mandal</p>
            </div>

            {/* 4 Cards with metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
                <p className="text-[9px] text-slate-400 font-black uppercase">Total Trained Cadre</p>
                <p className="text-xl font-black text-slate-900 mt-1">412 / 450</p>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-yellow-400 h-full rounded-full" style={{ width: '91.5%' }}></div>
                </div>
                <p className="text-[10px] text-yellow-600 font-bold mt-2">91.5% Completion Rate</p>
              </div>

              <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
                <p className="text-[9px] text-slate-400 font-black uppercase">Total Video Brief Views</p>
                <p className="text-xl font-black text-slate-900 mt-1">1,840 Views</p>
                <p className="text-[10px] text-emerald-600 font-bold mt-2">▲ 14% this week</p>
              </div>

              <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
                <p className="text-[9px] text-slate-400 font-black uppercase">Compliance Rating</p>
                <p className="text-xl font-black text-slate-900 mt-1">94.8%</p>
                <p className="text-[10px] text-slate-400 font-bold mt-2">Based on mock drills & tests</p>
              </div>

              <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
                <p className="text-[9px] text-slate-400 font-black uppercase">Next In-Person Drill</p>
                <p className="text-xs font-black text-slate-900 mt-1.5 uppercase">Tomorrow 10:00 AM</p>
                <p className="text-[10px] text-red-500 font-bold mt-2">Mandal Revenue Office Hall</p>
              </div>
            </div>

            {/* Two-Column Detail Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Progress Chart (Left 2 cols) */}
              <div className="lg:col-span-2 bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Village-wise Cadre Training Coverage</h3>
                <div className="space-y-3.5">
                  {[
                    { name: "Singarayakonda", trained: 94, total: 100 },
                    { name: "Patha Singarayakonda", trained: 58, total: 60 },
                    { name: "Mulagunta Padu", trained: 65, total: 70 },
                    { name: "Pakala", trained: 47, total: 50 },
                    { name: "Sanampudi", trained: 38, total: 40 },
                    { name: "Kanumala", trained: 28, total: 30 },
                    { name: "Binginapalli", trained: 23, total: 25 },
                    { name: "Kalikivaya", trained: 18, total: 20 },
                    { name: "Somaraju Palli", trained: 25, total: 30 },
                    { name: "Woollapalem", trained: 16, total: 25 }
                  ].map((v) => {
                    const pct = Math.round((v.trained / v.total) * 100);
                    return (
                      <div key={v.name} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span className="uppercase">{v.name}</span>
                          <span>{v.trained} / {v.total} Incharges ({pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-yellow-400 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status / Quick guidelines (Right 1 col) */}
              <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Operations Checklist</h3>
                <div className="space-y-3">
                  {[
                    { title: "Voter Slip Distribution Flow", status: "Completed", desc: "Briefing on QR-coded slips scanning." },
                    { title: "EVM Agent Challenge Protocols", status: "In Progress", desc: "Mock polls challenge form filling." },
                    { title: "Voter Turnout Tracking", status: "Scheduled", desc: "Using live connect app to record 'VOTE DONE' stamps." },
                    { title: "Fake Voter Objections Procedure", status: "Completed", desc: "Submitting Form-7 deletion requests." }
                  ].map((item, i) => (
                    <div key={i} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 leading-tight">{item.title}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${item.status === 'Completed' ? 'bg-green-50 text-green-700 border border-green-200' : item.status === 'In Progress' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>{item.status}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-semibold">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

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
