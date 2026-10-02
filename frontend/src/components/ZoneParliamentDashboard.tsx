/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  LayoutDashboard,
  Building2,
  Layers,
  MapPin,
  Calendar,
  Network,
  AlertTriangle,
  Bot,
  GraduationCap,
  LogOut,
  Search,
  CheckCircle2,
  Radio,
  Phone,
  MessageSquare,
  Trophy,
  BarChart3,
  Users,
  ChevronRight,
  Flame,
  CheckSquare,
  Award
} from 'lucide-react';
import { UserSession } from '../types';
import { useCms } from '../context/CmsContext';
import { fetchHierarchySummaryByUser, fetchStateAnalytics } from '../lib/api';
import AIStrategicIntelligenceCenter from './AIStrategicIntelligenceCenter';

interface ZoneParliamentDashboardProps {
  session: UserSession;
  onLogout: () => void;
}

type ZoneTabType =
  | 'dashboard'
  | 'parliament_list'
  | 'constituency_list'
  | 'highcommand_tasks'
  | 'cadre_network'
  | 'fake_votes'
  | 'strategic_intelligence'
  | 'training_analytics';

type ParliamentTabType =
  | 'dashboard'
  | 'constituency_list'
  | 'mandal_list'
  | 'highcommand_tasks'
  | 'cadre_network'
  | 'fake_votes'
  | 'strategic_intelligence'
  | 'training_analytics';

// Zonal Parliaments dataset
const ZONAL_PARLIAMENTS_DATA = [
  { id: 1, name: 'Mahabubnagar', candidate: 'Challa Vamshi Chand Reddy', margin: '+9.4%', incVotes: 512000, brsVotes: 418000, bjpVotes: 234000, voters: 1590000, status: 'WINNING' as const, assemblies: 7, incharge: 'V. Damodar Reddy', phone: '+91 98480 20011' },
  { id: 2, name: 'Nagarkurnool (SC)', candidate: 'Mallu Ravi', margin: '+12.7%', incVotes: 538000, brsVotes: 392000, bjpVotes: 184000, voters: 1530000, status: 'WINNING' as const, assemblies: 7, incharge: 'D. Rajesh', phone: '+91 98480 20012' },
  { id: 3, name: 'Chevella', candidate: 'G. Ranjith Reddy', margin: '+8.1%', incVotes: 615000, brsVotes: 512000, bjpVotes: 442000, voters: 2540000, status: 'WINNING' as const, assemblies: 7, incharge: 'K. Pratap', phone: '+91 98480 20010' }
];

// 21 Assembly Segments in South Zone
const ZONAL_ASSEMBLIES_DATA = [
  { id: 1, name: 'Kodangal', parliament: 'Mahabubnagar', incharge: 'A. Revanth Reddy', voters: 236500, incVotes: 108400, brsVotes: 76200, bjpVotes: 21400, mimVotes: 1100, status: 'WINNING' as const, margin: '32,200', phone: '+91 98480 40001' },
  { id: 2, name: 'Narayanpet', parliament: 'Mahabubnagar', incharge: 'Chittem Parnika Reddy', voters: 228100, incVotes: 94200, brsVotes: 68100, bjpVotes: 31200, mimVotes: 900, status: 'WINNING' as const, margin: '26,100', phone: '+91 98480 40002' },
  { id: 3, name: 'Mahabubnagar', parliament: 'Mahabubnagar', incharge: 'Yennam Srinivas Reddy', voters: 254200, incVotes: 101200, brsVotes: 78400, bjpVotes: 38200, mimVotes: 1400, status: 'WINNING' as const, margin: '22,800', phone: '+91 98480 40003' },
  { id: 4, name: 'Jadcherla', parliament: 'Mahabubnagar', incharge: 'J. Anirudh Reddy', voters: 221900, incVotes: 96400, brsVotes: 69200, bjpVotes: 24100, mimVotes: 800, status: 'WINNING' as const, margin: '27,200', phone: '+91 98480 40004' },
  { id: 5, name: 'Devarakadra', parliament: 'Mahabubnagar', incharge: 'G. Madhusudhan Reddy', voters: 238400, incVotes: 98100, brsVotes: 74200, bjpVotes: 28400, mimVotes: 900, status: 'WINNING' as const, margin: '23,900', phone: '+91 98480 40005' },
  { id: 6, name: 'Makthal', parliament: 'Mahabubnagar', incharge: 'Vakiti Srihari', voters: 229600, incVotes: 92400, brsVotes: 72100, bjpVotes: 31200, mimVotes: 800, status: 'WINNING' as const, margin: '20,300', phone: '+91 98480 40006' },
  { id: 7, name: 'Shadnagar', parliament: 'Mahabubnagar', incharge: 'K. Shankaraiah', voters: 247100, incVotes: 104200, brsVotes: 79100, bjpVotes: 28400, mimVotes: 1200, status: 'WINNING' as const, margin: '25,100', phone: '+91 98480 40007' },
  { id: 8, name: 'Nagarkurnool', parliament: 'Nagarkurnool', incharge: 'Dr. Kuchkulla Rajesh Reddy', voters: 224800, incVotes: 96400, brsVotes: 68100, bjpVotes: 22100, mimVotes: 800, status: 'WINNING' as const, margin: '28,300', phone: '+91 98480 40008' },
  { id: 9, name: 'Achampet (SC)', parliament: 'Nagarkurnool', incharge: 'Chikkudu Vamshi Krishna', voters: 228900, incVotes: 102400, brsVotes: 64100, bjpVotes: 21200, mimVotes: 600, status: 'WINNING' as const, margin: '38,300', phone: '+91 98480 40009' },
  { id: 10, name: 'Kalwakurthy', parliament: 'Nagarkurnool', incharge: 'Kasireddy Narayan Reddy', voters: 235400, incVotes: 94100, brsVotes: 74200, bjpVotes: 31200, mimVotes: 900, status: 'WINNING' as const, margin: '19,900', phone: '+91 98480 40010' },
  { id: 11, name: 'Kollapur', parliament: 'Nagarkurnool', incharge: 'Jupally Krishna Rao', voters: 227500, incVotes: 101400, brsVotes: 71200, bjpVotes: 18400, mimVotes: 700, status: 'WINNING' as const, margin: '30,200', phone: '+91 98480 40011' },
  { id: 12, name: 'Wanaparthy', parliament: 'Nagarkurnool', incharge: 'Thudi Megha Reddy', voters: 248900, incVotes: 106400, brsVotes: 79100, bjpVotes: 26400, mimVotes: 1100, status: 'WINNING' as const, margin: '27,300', phone: '+91 98480 40012' },
  { id: 13, name: 'Gadwal', parliament: 'Nagarkurnool', incharge: 'Bandla Krishna Mohan Reddy', voters: 251200, incVotes: 99400, brsVotes: 82100, bjpVotes: 28400, mimVotes: 1200, status: 'WINNING' as const, margin: '17,300', phone: '+91 98480 40013' },
  { id: 14, name: 'Alampur (SC)', parliament: 'Nagarkurnool', incharge: 'S. A. Sampath Kumar', voters: 229100, incVotes: 98400, brsVotes: 74100, bjpVotes: 22100, mimVotes: 800, status: 'WINNING' as const, margin: '24,300', phone: '+91 98480 40014' },
  { id: 15, name: 'Chevella (SC)', parliament: 'Chevella', incharge: 'Pamena Bheembharat', voters: 248300, incVotes: 98100, brsVotes: 78400, bjpVotes: 34100, mimVotes: 1200, status: 'WINNING' as const, margin: '19,700', phone: '+91 98480 40015' },
  { id: 16, name: 'Pargi', parliament: 'Chevella', incharge: 'T. Ram Mohan Reddy', voters: 241600, incVotes: 104200, brsVotes: 72100, bjpVotes: 29400, mimVotes: 1100, status: 'WINNING' as const, margin: '32,100', phone: '+91 98480 40016' },
  { id: 17, name: 'Vikarabad (SC)', parliament: 'Chevella', incharge: 'G. Prasad Kumar', voters: 232100, incVotes: 99400, brsVotes: 71200, bjpVotes: 26400, mimVotes: 900, status: 'WINNING' as const, margin: '28,200', phone: '+91 98480 40017' },
  { id: 18, name: 'Tandur', parliament: 'Chevella', incharge: 'B. Manohar Reddy', voters: 228400, incVotes: 94100, brsVotes: 74200, bjpVotes: 28100, mimVotes: 1200, status: 'WINNING' as const, margin: '19,900', phone: '+91 98480 40018' },
  { id: 19, name: 'Maheshwaram', parliament: 'Chevella', incharge: 'K. Laxma Reddy', voters: 512000, incVotes: 178200, brsVotes: 154100, bjpVotes: 98200, mimVotes: 12400, status: 'WINNING' as const, margin: '24,100', phone: '+91 98480 40019' },
  { id: 20, name: 'Rajendranagar', parliament: 'Chevella', incharge: 'Kasturi Narender', voters: 578000, incVotes: 194100, brsVotes: 172400, bjpVotes: 118400, mimVotes: 14200, status: 'WINNING' as const, margin: '21,700', phone: '+91 98480 40020' },
  { id: 21, name: 'Serilingampally', parliament: 'Chevella', incharge: 'V. Jagadeeshwar Goud', voters: 712000, incVotes: 224100, brsVotes: 208400, bjpVotes: 158100, mimVotes: 12100, status: 'WINNING' as const, margin: '15,700', phone: '+91 98480 40021' }
];

// Mandals under Parliament Segment
const PARLIAMENT_MANDALS_DATA = [
  { id: 1, name: 'Kodangal Rural', assembly: 'Kodangal', voters: 42100, booths: 48, status: 'WINNING', margin: '+24.1%' },
  { id: 2, name: 'Bomraspet', assembly: 'Kodangal', voters: 39500, booths: 44, status: 'WINNING', margin: '+19.8%' },
  { id: 3, name: 'Kosgi', assembly: 'Kodangal', voters: 45800, booths: 52, status: 'WINNING', margin: '+22.4%' },
  { id: 4, name: 'Maddur', assembly: 'Kodangal', voters: 41200, booths: 46, status: 'WINNING', margin: '+18.9%' },
  { id: 5, name: 'Doulathabad', assembly: 'Kodangal', voters: 36200, booths: 40, status: 'WINNING', margin: '+16.5%' },
  { id: 6, name: 'Narayanpet Town', assembly: 'Narayanpet', voters: 48200, booths: 54, status: 'WINNING', margin: '+15.2%' },
  { id: 7, name: 'Damaragidda', assembly: 'Narayanpet', voters: 38400, booths: 42, status: 'WINNING', margin: '+12.8%' },
  { id: 8, name: 'Dhanwada', assembly: 'Narayanpet', voters: 37900, booths: 41, status: 'WINNING', margin: '+14.1%' },
  { id: 9, name: 'Mahabubnagar Urban', assembly: 'Mahabubnagar', voters: 88400, booths: 92, status: 'WINNING', margin: '+13.5%' },
  { id: 10, name: 'Mahabubnagar Rural', assembly: 'Mahabubnagar', voters: 54200, booths: 58, status: 'WINNING', margin: '+12.4%' },
  { id: 11, name: 'Jadcherla Town', assembly: 'Jadcherla', voters: 52100, booths: 56, status: 'WINNING', margin: '+18.1%' },
  { id: 12, name: 'Devarakadra', assembly: 'Devarakadra', voters: 43900, booths: 48, status: 'WINNING', margin: '+11.2%' },
  { id: 13, name: 'Makthal Town', assembly: 'Makthal', voters: 46200, booths: 50, status: 'WINNING', margin: '+9.1%' },
  { id: 14, name: 'Shadnagar Town', assembly: 'Shadnagar', voters: 64100, booths: 68, status: 'WINNING', margin: '+13.2%' }
];

// High Command Tasks
const HIGH_COMMAND_TASKS_DATA = [
  { id: 1, title: 'Verify Voter List Anomalies', desc: 'Check for duplicate entries in Booth 112A. 5 entries flagged as potentially fake.', priority: 'High', due: 'Today, 5:00 PM', status: 'Pending' },
  { id: 2, title: 'Distribute "Haath Se Haath" Pamphlets', desc: 'Complete door-to-door distribution in Street No. 4 and 5.', priority: 'Medium', due: 'Tomorrow', status: 'In Progress' },
  { id: 3, title: 'Organize Street Corner Meeting', desc: 'Arrange logistics (mic, chairs) for MLA candidate visit on Saturday.', priority: 'High', due: 'in 2 days', status: 'Pending' },
  { id: 4, title: 'Update Voter Phone Numbers', desc: 'Collect missing mobile numbers for 50 households.', priority: 'Low', due: 'Next Week', status: 'Pending' }
];

// Fake Votes
const FAKE_VOTES_LIST = [
  { id: 1, name: 'G. Venkateshwarlu', epic: 'TS91823101', booth: 'Booth 45 (ZPHS)', ac: 'Kodangal', reason: 'Deceased Record', status: 'FLAGGED' },
  { id: 2, name: 'M. Padmamma', epic: 'TS72635102', booth: 'Booth 12', ac: 'Narayanpet', reason: 'Shifted Residence', status: 'UNDER VERIFICATION' },
  { id: 3, name: 'K. Ramesh Goud', epic: 'TS18294103', booth: 'Booth 108A', ac: 'Mahabubnagar', reason: 'Duplicate Entry across AC', status: 'VERIFIED ISSUE' },
  { id: 4, name: 'Ch. Anjamma', epic: 'TS82910104', booth: 'Booth 74', ac: 'Jadcherla', reason: 'Underage at Registration', status: 'FLAGGED' },
  { id: 5, name: 'B. Sreenivasulu', epic: 'TS49102105', booth: 'Booth 82', ac: 'Shadnagar', reason: 'Photo Mismatch / Blank', status: 'RESOLVED' }
];

export default function ZoneParliamentDashboard({ session, onLogout }: ZoneParliamentDashboardProps) {
  const { config } = useCms();
  const isZone = session.role === 'ZONE_INCHARGE';

  const [zoneTab, setZoneTab] = useState<ZoneTabType>('dashboard');
  const [parliamentTab, setParliamentTab] = useState<ParliamentTabType>('dashboard');
  const [searchFilter, setSearchFilter] = useState('');
  const [viewingMandalsModal, setViewingMandalsModal] = useState<string | null>(null);

  const [totalVotersCount, setTotalVotersCount] = useState<number>(0);
  const [fakeVotersCount, setFakeVotersCount] = useState<number>(0);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadMetrics() {
      try {
        const summary = await fetchHierarchySummaryByUser(session.userId);
        if (!isMounted) return;
        setTotalVotersCount(summary.snapshot.summary.totalVoters ?? 0);
        setFakeVotersCount(summary.snapshot.summary.fakeVoters ?? 0);
      } catch {
        try {
          const state = await fetchStateAnalytics();
          if (!isMounted) return;
          setTotalVotersCount(state.summary?.totalVoters ?? 0);
          setFakeVotersCount(state.summary?.fakeVoters ?? 0);
        } catch {
          if (!isMounted) return;
          setTotalVotersCount(0);
          setFakeVotersCount(0);
        }
      } finally {
        if (isMounted) setIsLoadingAnalytics(false);
      }
    }
    loadMetrics();
    return () => { isMounted = false; };
  }, [session.userId]);

  const activeRoleLabel = isZone ? 'ZONE COORDINATOR' : 'PARLIAMENT INCHARGE';

  const relevantAssemblies = useMemo(() => {
    if (config.constituencies && config.constituencies.length > 0) {
      return config.constituencies.map((c, idx) => ({
        id: idx + 1,
        name: c.name,
        parliament: c.parliamentName || config.parliamentName || (isZone ? 'Zone Command' : 'Parliament Segment'),
        incharge: c.mlaName || c.candidateName || 'Assigned Incharge',
        voters: totalVotersCount > 0 ? (c.totalVoters || c._count?.voters || 0) : 0,
        incVotes: 0,
        brsVotes: 0,
        bjpVotes: 0,
        mimVotes: 0,
        status: totalVotersCount > 0 ? ('WINNING' as const) : ('AWAITING_INGESTION' as const),
        margin: totalVotersCount > 0 ? '+12.4%' : '0',
        phone: '+91 00000 00000'
      }));
    }
    return [];
  }, [config.constituencies, config.parliamentName, isZone, totalVotersCount]);

  const parliamentsList = useMemo(() => {
    if (config.parliamentName) {
      return [{
        id: 1,
        name: config.parliamentName,
        candidate: config.candidateName || 'Active Candidate',
        margin: '0',
        voters: totalVotersCount,
        status: totalVotersCount > 0 ? ('WINNING' as const) : ('AWAITING_INGESTION' as const),
        assemblies: relevantAssemblies.length,
        incharge: session.userName || 'Assigned Incharge',
        phone: session.mobileNumber || '+91 00000 00000'
      }];
    }
    const distinct = Array.from(new Set(relevantAssemblies.map(a => a.parliament).filter(Boolean)));
    if (distinct.length > 0) {
      return distinct.map((pName, idx) => ({
        id: idx + 1,
        name: pName,
        candidate: 'Assigned Candidate',
        margin: '0',
        voters: relevantAssemblies.filter(a => a.parliament === pName).reduce((sum, a) => sum + a.voters, 0),
        status: totalVotersCount > 0 ? ('WINNING' as const) : ('AWAITING_INGESTION' as const),
        assemblies: relevantAssemblies.filter(a => a.parliament === pName).length,
        incharge: session.userName || 'Assigned Incharge',
        phone: session.mobileNumber || '+91 00000 00000'
      }));
    }
    return [];
  }, [config.parliamentName, config.candidateName, totalVotersCount, relevantAssemblies, session]);

  const hasVoters = totalVotersCount > 0;
  const totalVotersFormatted = totalVotersCount.toLocaleString();
  const coverageLabel = hasVoters ? (isZone ? 'Zone Coverage 100%' : 'Parliament Coverage 100%') : 'Coverage 0% (Awaiting Ingestion)';
  const totalSeats = relevantAssemblies.length;
  const projectedWins = hasVoters ? totalSeats : 0;
  const magicFigure = Math.ceil((totalSeats || 1) / 2);
  const voteShare = hasVoters ? '48.5%' : '0.0%';
  const voteTrend = hasVoters ? '+1.8% vs Last Election' : 'Awaiting Data';
  const fakeVotesFormatted = fakeVotersCount.toLocaleString();

  return (
    <div className="w-full h-screen overflow-hidden flex flex-col md:flex-row bg-[#F8FAFC] text-slate-900 font-sans antialiased" id="zone-dashboard-container">
      {/* Sidebar Navigation: Fixed Full-Height matching Mandal / Booth benchmark */}
      <aside className="fixed inset-y-0 left-0 z-40 w-64 h-screen bg-slate-950 text-white flex flex-col justify-between border-r border-slate-900 p-5 shrink-0 select-none md:fixed" id="zone-sidebar">
        <div className="space-y-5">
          {/* Brand header */}
          <div className="flex items-center gap-3 border-b border-slate-800/80 pb-4">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-slate-950 font-black text-base shadow-md shrink-0"
              style={{ backgroundColor: config.primaryColor || '#fbbf24' }}
            >
              {config.activePartyCode || 'APP'}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black tracking-tight text-white truncate">
                {config.organisationName || 'Command Center'}
              </h2>
              <span className="text-[10px] bg-slate-900 text-amber-300 font-extrabold uppercase px-2 py-0.5 rounded tracking-wide border border-amber-400/20">
                {activeRoleLabel}
              </span>
            </div>
          </div>

          {/* Assigned Jurisdiction Card */}
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 space-y-1">
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Assigned Jurisdiction</p>
            <h4 className="text-xs font-bold text-slate-100 truncate">
              {isZone ? (config.organisationName ? `${config.organisationName} Zone Command` : 'Zonal Command Center') : (config.parliamentName ? `${config.parliamentName} Parliament` : 'Parliamentary War Room')}
            </h4>
            <div className="text-[10px] text-slate-400 flex flex-col gap-0.5 font-mono">
              <span>Scope: {isZone ? `${relevantAssemblies.length} Assemblies • Zone Command` : `${relevantAssemblies.length} Assemblies • ${config.parliamentName || 'Parliament'}`}</span>
              <span>Assemblies: {relevantAssemblies.length} Segments</span>
              <span>Incharge: {session.userName}</span>
            </div>
          </div>

          {/* Sidebar Nav Items */}
          <nav className="space-y-1 text-xs" id="zone-sidebar-nav">
            {isZone ? (
              // Zone Coordinator Tabs (8)
              [
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { id: 'parliament_list', label: `Parliament List (${parliamentsList.length})`, icon: Building2 },
                { id: 'constituency_list', label: `Assembly List (${relevantAssemblies.length})`, icon: Layers },
                { id: 'highcommand_tasks', label: 'Highcommand Tasks', icon: Calendar },
                { id: 'cadre_network', label: 'Cadre Network', icon: Network },
                { id: 'fake_votes', label: 'Fake Votes', icon: AlertTriangle },
                { id: 'strategic_intelligence', label: 'Strategic Intelligence', icon: Bot },
                { id: 'training_analytics', label: 'Training Analytics', icon: GraduationCap },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = zoneTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setZoneTab(item.id as ZoneTabType)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all text-left cursor-pointer ${
                      isActive
                        ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                        : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })
            ) : (
              // Parliament Incharge Tabs (8)
              [
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { id: 'constituency_list', label: `Constituency List (${relevantAssemblies.length})`, icon: Layers },
                { id: 'mandal_list', label: 'Mandal List', icon: MapPin },
                { id: 'highcommand_tasks', label: 'Highcommand Tasks', icon: Calendar },
                { id: 'cadre_network', label: 'Cadre Network', icon: Network },
                { id: 'fake_votes', label: 'Fake Votes', icon: AlertTriangle },
                { id: 'strategic_intelligence', label: 'Strategic Intelligence', icon: Bot },
                { id: 'training_analytics', label: 'Training Analytics', icon: GraduationCap },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = parliamentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setParliamentTab(item.id as ParliamentTabType)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all text-left cursor-pointer ${
                      isActive
                        ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                        : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })
            )}
          </nav>
        </div>

        {/* Bottom Sign Out */}
        <div className="pt-4 border-t border-slate-900 mt-auto">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold text-red-400 hover:bg-red-950/20 hover:text-red-300 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace with native scroll */}
      <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden bg-[#F8FAFC] relative md:pl-64" id="main-workspace-section">
        {/* Container */}
        <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full pb-28">
          {/* In-page Header Banner (White Card matching Mandal / Booth standard) */}
          <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm" id="zone-header-bar">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] bg-yellow-400 text-slate-950 px-2 py-0.5 rounded font-black uppercase tracking-widest">
                  {activeRoleLabel}
                </span>
                <h1 className="text-2xl font-black tracking-tight text-slate-900" id="zone-title">
                  {isZone ? (config.organisationName ? `${config.organisationName} Command Center` : 'Zonal Command Center') : (config.parliamentName ? `${config.parliamentName} Parliamentary War Room` : 'Parliamentary War Room')}
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-semibold">
                  <span className="text-slate-900">Jurisdiction: <strong className="font-extrabold">{isZone ? `${config.stateName || 'State'} (Zonal Oversight)` : `${config.parliamentName || 'Parliament'} (${relevantAssemblies.length} Segments)`}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-900">Total Voters: <strong className="font-extrabold text-slate-950">{totalVotersFormatted}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>Assemblies: <strong className="font-extrabold text-slate-950">{relevantAssemblies.length} Segments</strong></span>
                </div>
              </div>

              <div className="flex flex-col items-end shrink-0 bg-slate-50 border border-slate-100 p-3 rounded-lg text-right">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Zone Network Active
                </div>
                <p className="text-[10px] text-gray-500 font-semibold uppercase mt-1">
                  Aggregated Assemblies: {relevantAssemblies.length}
                </p>
              </div>
            </div>
          </div>

          {/* ================= DASHBOARD (ZONE OR PARLIAMENT) ================= */}
          {((isZone && zoneTab === 'dashboard') || (!isZone && parliamentTab === 'dashboard')) && (
            <div className="space-y-6 animate-fade-in" id="zone-dashboard-view">
              {/* ELECTION FORECAST HERO BANNER */}
              <div className="relative bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white rounded-2xl p-6 md:p-8 shadow-md border border-slate-800" id="zone-forecast-banner">
                <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] from-yellow-400 via-transparent to-transparent"></div>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                  <div className="space-y-2">
                    <span className="px-2 py-0.5 bg-yellow-400/20 text-yellow-400 text-[10px] font-black uppercase tracking-widest rounded border border-yellow-400/20">
                      {hasVoters ? 'ELECTION FORECAST / PROJECTION' : 'AWAITING VOTER ROLL INGESTION'}
                    </span>
                    
                    <h2 className="text-3xl font-black tracking-tight" id="zone-forecast-winner">
                      <span style={{ color: config.primaryColor || '#fbbf24' }}>{config.activePartyCode || 'ACTIVE'}</span>{' '}
                      <span className="text-white">{hasVoters ? 'PROJECTED MAJORITY' : 'AWAITING VOTER ROLL INGESTION'}</span>
                    </h2>
                    
                    {hasVoters ? (
                      <p className="text-lg font-bold text-gray-300">
                        Leading in <span className="text-yellow-400 text-xl font-extrabold">{projectedWins} / {totalSeats}</span> Assembly Seats • Vote Share <span className="text-emerald-400 font-black">{voteShare}</span>
                      </p>
                    ) : (
                      <p className="text-base font-semibold text-gray-300">
                        0 voter records ingested for this jurisdiction. Ingest voter rolls in CMS Studio to activate predictive telemetry.
                      </p>
                    )}
                    
                    <p className="text-xs text-gray-400 font-medium">
                      {hasVoters
                        ? `Based on ground reports & telemetry across ${relevantAssemblies.length} Assembly Segments. Magic Figure: ${magicFigure}`
                        : `Awaiting voter list ingestion across ${relevantAssemblies.length} Assembly Segments. Magic Figure: ${magicFigure}`
                      }
                    </p>
                  </div>
                  
                  {/* Trophy Accent Graphic */}
                  <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-center shrink-0 shadow">
                    <Award className="w-12 h-12 text-yellow-400" />
                  </div>
                </div>
              </div>

              {/* TOP 4 TINTED KPI CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="zone-top-cards">
                {/* Card 1: Total Voters */}
                <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Total Voters</p>
                  <h3 className="text-3xl font-black text-slate-950">{totalVotersFormatted}</h3>
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>Coverage</span>
                    <span className={`font-extrabold flex items-center gap-1 ${hasVoters ? 'text-emerald-600' : 'text-slate-500'}`}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> {coverageLabel}
                    </span>
                  </div>
                </div>

                {/* Card 2: Projected Wins */}
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                  <p className="text-xs font-black text-amber-700 uppercase tracking-wider">Projected Wins (Seats)</p>
                  <h3 className="text-3xl font-black text-amber-600">
                    {projectedWins} <span className="text-amber-800/60 text-lg font-bold">/ {totalSeats}</span>
                  </h3>
                  <div className="pt-2 border-t border-amber-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>Magic Figure</span>
                    <span className="font-black text-amber-700">{magicFigure} Seats</span>
                  </div>
                </div>

                {/* Card 3: Vote Share */}
                <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                  <p className="text-xs font-black text-purple-700 uppercase tracking-wider">Vote Share</p>
                  <h3 className="text-3xl font-black text-purple-600">{voteShare}</h3>
                  <div className="pt-2 border-t border-purple-200/60 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>Trend</span>
                    <span className="font-black text-purple-700">{voteTrend}</span>
                  </div>
                </div>

                {/* Card 4: Fake Votes */}
                <div className="bg-rose-50/50 border-2 border-rose-200 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-3">
                  <p className="text-xs font-black text-rose-700 uppercase tracking-wider">Fake Votes Identified</p>
                  <h3 className="text-3xl font-black text-rose-600 flex items-center gap-2">
                    {fakeVotesFormatted}
                    <AlertTriangle className="text-rose-500 w-5 h-5" />
                  </h3>
                  <div className="pt-2 border-t border-rose-200/60 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>EC Complaint</span>
                    <span className="font-black text-rose-700">{hasVoters && fakeVotersCount > 0 ? 'Flagged For Action' : 'No Anomalies'}</span>
                  </div>
                </div>
              </div>

              {/* Row 2: Election Forecast & Party Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Election Forecast Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80 space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Trophy className="text-amber-500 w-5 h-5" />
                      <span>Election Forecast Breakdown</span>
                    </h3>
                    <span className="text-[11px] font-extrabold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                      {projectedWins}/{totalSeats} Leading
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-slate-700">
                          {isZone ? 'Assembly Seats in Zone' : 'Assembly Seats in Parliament'} (Magic Figure: {magicFigure})
                        </span>
                        <span className="text-blue-600 font-extrabold">{projectedWins}/{totalSeats}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200/60">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: totalSeats > 0 && hasVoters ? `${(projectedWins / totalSeats) * 100}%` : '0%',
                            backgroundColor: config.primaryColor || '#2563eb'
                          }}
                        />
                      </div>
                    </div>

                    {isZone && (
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1.5">
                          <span className="text-slate-700">Parliament Seats</span>
                          <span className="text-emerald-600 font-extrabold">{hasVoters ? `${parliamentsList.length}/${parliamentsList.length}` : `0/${parliamentsList.length}`}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200/60">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-500"
                            style={{ width: hasVoters ? '100%' : '0%' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-blue-50/70 rounded-xl border border-blue-200/60">
                      <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1">
                        {isZone ? 'PROJECTED LEAD' : 'PROJECTED MP'}
                      </p>
                      <p className="text-lg font-black text-blue-950">
                        {hasVoters ? `${config.activePartyCode || 'Active'} Candidate` : 'Awaiting Data'}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-emerald-50/70 rounded-xl border border-emerald-200/60">
                      <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">VOTE SHARE</p>
                      <p className="text-lg font-black text-emerald-950">{voteShare}</p>
                    </div>
                  </div>
                </div>

                {/* Party-wise Breakdown Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80 space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <BarChart3 className="text-slate-600 w-5 h-5" />
                      <span>Party-wise Breakdown</span>
                    </h3>
                    <span className="text-[11px] font-bold text-slate-400">Total: {totalSeats} Seats</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="p-4 rounded-xl bg-blue-50/80 border-2 border-blue-200 relative overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs font-black text-blue-800 uppercase tracking-wide">{config.activePartyCode || 'ACTIVE'}</p>
                        <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-full">
                          {hasVoters ? '100%' : '0%'}
                        </span>
                      </div>
                      <p className="text-3xl font-black text-blue-950 mb-0.5">{hasVoters ? projectedWins : 0}</p>
                      <p className="text-[11px] text-blue-700 font-bold uppercase tracking-wider">Leading</p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50/70 border-2 border-slate-200 relative overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs font-black text-slate-800 uppercase tracking-wide">Opposition</p>
                        <span className="text-[10px] font-bold bg-white text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full">
                          0%
                        </span>
                      </div>
                      <p className="text-3xl font-black text-slate-950 mb-0.5">0</p>
                      <p className="text-[11px] text-slate-700 font-bold uppercase tracking-wider">Opposition</p>
                    </div>

                    <div className="p-4 rounded-xl bg-orange-50/70 border-2 border-orange-200 relative overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs font-black text-orange-800 uppercase tracking-wide">Trailing</p>
                        <span className="text-[10px] font-bold bg-white text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">
                          0%
                        </span>
                      </div>
                      <p className="text-3xl font-black text-orange-950 mb-0.5">0</p>
                      <p className="text-[11px] text-orange-700 font-bold uppercase tracking-wider">Trailing</p>
                    </div>

                    <div className="p-4 rounded-xl bg-emerald-50/70 border-2 border-emerald-200 relative overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs font-black text-emerald-800 uppercase tracking-wide">Others</p>
                        <span className="text-[10px] font-bold bg-white text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                          0%
                        </span>
                      </div>
                      <p className="text-3xl font-black text-emerald-950 mb-0.5">0</p>
                      <p className="text-[11px] text-emerald-700 font-bold uppercase tracking-wider">Stable</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: Vote Share Donut & HQ Command Center */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-xs border border-slate-200 flex flex-col justify-between">
                  <h3 className="text-lg font-bold mb-4 text-slate-900">
                    {isZone ? 'Zone Vote Share' : 'Parliament Vote Share'}
                  </h3>
                  <div className="h-64 flex flex-col sm:flex-row items-center justify-center gap-8">
                    <div className="relative w-48 h-48 flex items-center justify-center">
                      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        {hasVoters ? (
                          <>
                            <circle cx="18" cy="18" r="14" fill="transparent" stroke="#2563eb" strokeWidth="4.5" strokeDasharray="49 51" strokeDashoffset="0" />
                            <circle cx="18" cy="18" r="14" fill="transparent" stroke="#ec4899" strokeWidth="4.5" strokeDasharray="31 69" strokeDashoffset="-49" />
                            <circle cx="18" cy="18" r="14" fill="transparent" stroke="#f97316" strokeWidth="4.5" strokeDasharray="14 86" strokeDashoffset="-80" />
                            <circle cx="18" cy="18" r="14" fill="transparent" stroke="#94a3b8" strokeWidth="4.5" strokeDasharray="6 94" strokeDashoffset="-94" />
                          </>
                        ) : (
                          <circle cx="18" cy="18" r="14" fill="transparent" stroke="#e2e8f0" strokeWidth="4.5" strokeDasharray="100 0" strokeDashoffset="0" />
                        )}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black text-slate-900">{voteShare}</span>
                        <span className="text-[10px] font-bold text-blue-600 uppercase">
                          {hasVoters ? `${config.activePartyCode || 'ACTIVE'} Lead` : 'Awaiting Ingestion'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-semibold text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: config.primaryColor || '#2563eb' }} />
                        <span>{config.activePartyCode || 'ACTIVE'} ({voteShare})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-slate-300" />
                        <span>Opposition ({hasVoters ? '31.2%' : '0.0%'})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-slate-300" />
                        <span>Trailing ({hasVoters ? '14.0%' : '0.0%'})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-slate-300" />
                        <span>Neutral ({hasVoters ? '5.8%' : '0.0%'})</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg border border-slate-800 overflow-hidden flex flex-col">
                  <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Radio className="text-green-500 animate-pulse w-5 h-5" />
                      <span>HQ Command Center</span>
                    </h3>
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto">
                    {fakeVotersCount > 0 ? (
                      <div className="flex items-start gap-3 text-sm bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                        <div className="mt-1 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        <div>
                          <p className="font-bold text-red-400">Fake Vote Alert</p>
                          <p className="text-xs text-slate-300">{fakeVotersCount} flagged entries require verification.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 text-sm bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                        <div className="mt-1 w-2 h-2 rounded-full bg-emerald-500" />
                        <div>
                          <p className="font-bold text-emerald-400">Network Operational</p>
                          <p className="text-xs text-slate-300">No security or voter roll anomalies reported.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 4: Assembly Seats Performance */}
              <div className="mt-8 space-y-6 border-t border-slate-200 pt-8">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Assembly Seats Performance</h3>
                    <p className="text-sm text-slate-500">
                      Track and filter active assembly seats under your oversight ({relevantAssemblies.length} Segments).
                    </p>
                  </div>
                </div>

                {relevantAssemblies.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                    <p className="font-bold">No Assembly Segments Configured</p>
                    <p className="text-xs text-slate-400 mt-1">Configure constituencies in CMS Studio to populate this dashboard.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {relevantAssemblies.map((c, idx) => (
                      <div
                        key={c.id}
                        className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden hover:shadow-md transition-all relative"
                      >
                        <div className="absolute top-0 left-0 bg-slate-100 text-slate-500 text-[10px] font-bold px-3 py-1.5 border-b border-r border-slate-200 rounded-br-lg z-10">
                          #{idx + 1}
                        </div>

                        <div className="p-6 pb-4 pt-8">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-xl font-bold text-slate-900">{c.name}</h3>
                              <div className="text-slate-500 text-sm mt-0.5">Incharge: {c.incharge}</div>
                            </div>
                            <div className={`text-right border rounded-lg px-3 py-1.5 ${hasVoters ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-200'}`}>
                              <p className={`text-[10px] font-bold uppercase tracking-wide ${hasVoters ? 'text-green-600' : 'text-slate-500'}`}>
                                {hasVoters ? 'LEADING' : 'AWAITING'}
                              </p>
                              <p className={`text-lg font-bold ${hasVoters ? 'text-green-700' : 'text-slate-700'}`}>
                                {c.margin}
                              </p>
                            </div>
                          </div>

                          <div className="flex justify-between items-center mb-5">
                            <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                              <Users size={16} />
                              <span>TOTAL VOTERS</span>
                            </div>
                            <div className="text-xl font-bold text-slate-900">
                              {c.voters.toLocaleString()}
                            </div>
                          </div>

                          <div className="mb-2">
                            <p className="text-xs text-slate-500 font-medium mb-1.5">Vote Share</p>
                            <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-slate-100">
                              {hasVoters ? (
                                <div style={{ width: '100%', backgroundColor: config.primaryColor || '#2563eb' }} />
                              ) : (
                                <div style={{ width: '0%' }} />
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-50">
                            <div className="text-center p-1.5 rounded bg-blue-50">
                              <p className="text-[10px] font-bold text-blue-600">{config.activePartyCode || 'ACTIVE'}</p>
                              <p className="text-sm font-bold text-blue-700">0k</p>
                            </div>
                            <div className="text-center p-1.5 rounded bg-slate-50">
                              <p className="text-[10px] font-bold text-slate-600">OPP</p>
                              <p className="text-sm font-bold text-slate-700">0k</p>
                            </div>
                            <div className="text-center p-1.5 rounded bg-slate-50">
                              <p className="text-[10px] font-bold text-slate-600">TRL</p>
                              <p className="text-sm font-bold text-slate-700">0k</p>
                            </div>
                            <div className="text-center p-1.5 rounded bg-slate-50">
                              <p className="text-[10px] font-bold text-slate-600">OTH</p>
                              <p className="text-sm font-bold text-slate-700">0k</p>
                            </div>
                          </div>
                        </div>

                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                            <CheckCircle2 size={14} className={hasVoters ? 'text-blue-500' : 'text-slate-400'} />
                            <span>{hasVoters ? '100% Verified' : 'Awaiting Rolls'}</span>
                          </div>
                          <button
                            onClick={() => setViewingMandalsModal(c.name)}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <span>View Mandals</span>
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= ZONE: PARLIAMENT LIST ================= */}
          {isZone && zoneTab === 'parliament_list' && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Parliament List ({parliamentsList.length})</h2>
                <p className="text-slate-500 text-sm">Lok Sabha seats supervised under {config.organisationName || 'Zone Command'}</p>
              </div>

              {parliamentsList.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                  <p className="font-bold">No Parliamentary Seats Configured</p>
                  <p className="text-xs text-slate-400 mt-1">Configure constituencies and parliaments in CMS Studio to populate this list.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {parliamentsList.map((p) => (
                    <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-mono text-slate-400">Seat #{p.id}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          p.status === 'WINNING' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {p.status === 'WINNING' ? 'WINNING' : 'AWAITING ROLLS'}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{p.name}</h3>
                        <p className="text-xs text-blue-600 font-bold">Candidate: {p.candidate}</p>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1">
                        <div className="flex justify-between text-slate-600">
                          <span>Voters:</span> <strong className="text-slate-900">{p.voters.toLocaleString()}</strong>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Assemblies:</span> <strong className="text-slate-900">{p.assemblies}</strong>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Incharge:</span> <span className="text-slate-800 font-semibold">{p.incharge}</span>
                        </div>
                      </div>

                      <a
                        href={`tel:${p.phone}`}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call Incharge</span>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= ZONE: ASSEMBLY LIST OR PARLIAMENT: CONSTITUENCY LIST ================= */}
          {((isZone && zoneTab === 'constituency_list') || (!isZone && parliamentTab === 'constituency_list')) && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {isZone ? `Assembly List (${relevantAssemblies.length})` : `Constituency List (${relevantAssemblies.length})`}
                  </h2>
                  <p className="text-slate-500 text-sm">MLA constituency directory with contacts and margins</p>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search assembly segment..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 w-56 shadow-xs"
                  />
                </div>
              </div>

              {relevantAssemblies.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                  <p className="font-bold">No Assembly Segments Configured</p>
                  <p className="text-xs text-slate-400 mt-1">Configure constituencies in CMS Studio to populate this list.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase font-mono text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="p-3.5">#</th>
                        <th className="p-3.5">Constituency</th>
                        <th className="p-3.5">Parliament</th>
                        <th className="p-3.5">MLA Incharge</th>
                        <th className="p-3.5 text-right">Voters</th>
                        <th className="p-3.5 text-center">Status</th>
                        <th className="p-3.5 text-right">Margin</th>
                        <th className="p-3.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {relevantAssemblies.filter((a) =>
                        a.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                        a.incharge.toLowerCase().includes(searchFilter.toLowerCase())
                      ).map((a) => (
                        <tr key={a.id} className="hover:bg-slate-50">
                          <td className="p-3.5 font-mono text-slate-400">{a.id}</td>
                          <td className="p-3.5 font-extrabold text-slate-900">{a.name}</td>
                          <td className="p-3.5 text-slate-500">{a.parliament}</td>
                          <td className="p-3.5 text-slate-700">{a.incharge}</td>
                          <td className="p-3.5 text-right font-mono text-slate-800">{a.voters.toLocaleString()}</td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              a.status === 'WINNING' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {a.status === 'WINNING' ? 'WINNING' : 'AWAITING ROLLS'}
                            </span>
                          </td>
                          <td className="p-3.5 text-right font-black text-slate-900">{a.margin}</td>
                          <td className="p-3.5 text-center">
                            <a href={`tel:${a.phone}`} className="text-blue-600 font-bold hover:underline">
                              Call
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ================= PARLIAMENT: MANDAL LIST ================= */}
          {!isZone && parliamentTab === 'mandal_list' && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Mandal List</h2>
                <p className="text-slate-500 text-sm">Mandals breakdown across Parliamentary segments</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-mono text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">#</th>
                      <th className="p-3.5">Mandal Name</th>
                      <th className="p-3.5">Assembly Segment</th>
                      <th className="p-3.5 text-right">Voters</th>
                      <th className="p-3.5 text-center">Booths</th>
                      <th className="p-3.5 text-center">Status</th>
                      <th className="p-3.5 text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {hasVoters ? (
                      PARLIAMENT_MANDALS_DATA.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="p-3.5 font-mono text-slate-400">{m.id}</td>
                          <td className="p-3.5 font-extrabold text-slate-900">{m.name}</td>
                          <td className="p-3.5 text-slate-500">{m.assembly}</td>
                          <td className="p-3.5 text-right font-mono text-slate-800">{m.voters.toLocaleString()}</td>
                          <td className="p-3.5 text-center font-mono text-slate-600">{m.booths}</td>
                          <td className="p-3.5 text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                              {m.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-right font-bold text-slate-900">{m.margin}</td>
                        </tr>
                      ))
                    ) : (
                      relevantAssemblies.map((a, idx) => (
                        <tr key={a.id} className="hover:bg-slate-50">
                          <td className="p-3.5 font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-3.5 font-extrabold text-slate-900">{a.name} Mandal</td>
                          <td className="p-3.5 text-slate-500">{a.name}</td>
                          <td className="p-3.5 text-right font-mono text-slate-800">0</td>
                          <td className="p-3.5 text-center font-mono text-slate-600">0</td>
                          <td className="p-3.5 text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              AWAITING ROLLS
                            </span>
                          </td>
                          <td className="p-3.5 text-right font-bold text-slate-900">0</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= HIGHCOMMAND TASKS ================= */}
          {((isZone && zoneTab === 'highcommand_tasks') || (!isZone && parliamentTab === 'highcommand_tasks')) && (
            <div className="space-y-6 animate-fade-in pb-10">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">High Command Tasks</h2>
                  <p className="text-slate-500 text-sm">Priority actions assigned by War Room.</p>
                </div>
                <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium border border-blue-200">
                  {HIGH_COMMAND_TASKS_DATA.filter(t => t.status === 'Pending').length} Pending
                </div>
              </div>

              <div className="space-y-3">
                {HIGH_COMMAND_TASKS_DATA.map((t) => (
                  <div key={t.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          t.priority === 'High' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                        }`}>
                          {t.priority}
                        </span>
                        <span className="text-xs font-mono text-slate-400">Due: {t.due}</span>
                      </div>
                      <h4 className="text-base font-bold text-slate-900 mt-1">{t.title}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{t.desc}</p>
                    </div>

                    <span className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                      t.status === 'In Progress' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= CADRE NETWORK ================= */}
          {((isZone && zoneTab === 'cadre_network') || (!isZone && parliamentTab === 'cadre_network')) && (
            <div className="space-y-6 animate-fade-in pb-10">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Cadre Network</h2>
                <p className="text-slate-500 text-sm">
                  {isZone ? `Zonal deployment strength across ${relevantAssemblies.length} Assembly Segments` : `Parliamentary cadre deployment across ${relevantAssemblies.length} Assembly Segments`}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs text-center">
                  <p className="text-xs font-bold text-slate-500 uppercase">Assembly Incharges</p>
                  <p className="text-3xl font-black text-slate-900 mt-1">{relevantAssemblies.length} / {relevantAssemblies.length}</p>
                  <p className="text-xs text-green-600 font-bold mt-1">100% Active</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs text-center">
                  <p className="text-xs font-bold text-slate-500 uppercase">Mandal Presidents</p>
                  <p className="text-3xl font-black text-slate-900 mt-1">{hasVoters ? (isZone ? '114 / 114' : '45 / 45') : '0 / 0'}</p>
                  <p className={`text-xs font-bold mt-1 ${hasVoters ? 'text-green-600' : 'text-slate-400'}`}>
                    {hasVoters ? '100% Deployed' : 'Awaiting Ingestion'}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs text-center">
                  <p className="text-xs font-bold text-slate-500 uppercase">Booth Committees</p>
                  <p className="text-3xl font-black text-slate-900 mt-1">{hasVoters ? (isZone ? '5,820' : '1,920') : '0'}</p>
                  <p className={`text-xs font-bold mt-1 ${hasVoters ? 'text-green-600' : 'text-slate-400'}`}>
                    {hasVoters ? 'Operational' : 'Awaiting Ingestion'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= FAKE VOTES ================= */}
          {((isZone && zoneTab === 'fake_votes') || (!isZone && parliamentTab === 'fake_votes')) && (
            <div className="space-y-6 animate-fade-in pb-10">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Fake Votes</h2>
                <p className="text-slate-500 text-sm">Flagged fraudulent &amp; duplicate voter audit records</p>
              </div>

              {fakeVotersCount === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 shadow-xs space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-bold text-slate-800">0 Flagged Voter Records</p>
                  <p className="text-xs text-slate-400">All database voter rolls are clean or awaiting voter roll ingestion.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase font-mono text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="p-3.5">#</th>
                        <th className="p-3.5">Voter Name</th>
                        <th className="p-3.5">EPIC ID</th>
                        <th className="p-3.5">Assembly &bull; Booth</th>
                        <th className="p-3.5">Audit Reason</th>
                        <th className="p-3.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {FAKE_VOTES_LIST.map((f) => (
                        <tr key={f.id} className="hover:bg-slate-50">
                          <td className="p-3.5 font-mono text-slate-400">{f.id}</td>
                          <td className="p-3.5 font-bold text-slate-900">{f.name}</td>
                          <td className="p-3.5 font-mono text-blue-600">{f.epic}</td>
                          <td className="p-3.5 text-slate-600">{f.ac} &bull; {f.booth}</td>
                          <td className="p-3.5 text-red-600 font-semibold">{f.reason}</td>
                          <td className="p-3.5 text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              {f.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ================= STRATEGIC INTELLIGENCE ================= */}
          {((isZone && zoneTab === 'strategic_intelligence') || (!isZone && parliamentTab === 'strategic_intelligence')) && (
            <div className="p-2 animate-fade-in">
              <AIStrategicIntelligenceCenter session={session} />
            </div>
          )}

          {/* ================= TRAINING ANALYTICS ================= */}
          {((isZone && zoneTab === 'training_analytics') || (!isZone && parliamentTab === 'training_analytics')) && (
            <div className="space-y-6 animate-fade-in pb-10">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Training Completion Analytics</h2>
                  <p className="text-slate-500 text-sm">Track learning progress of your ground force (Village &amp; Booth Incharges).</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 shadow-xs">
                  Completion Rate: <span className="text-green-600 font-extrabold">78.4%</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
                <div>
                  <div className="flex justify-between text-sm font-bold mb-1">
                    <span className="text-slate-700">Overall Modules Completion</span>
                    <span className="text-green-600">210 / 350 Fully Trained</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: '78.4%' }} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {[
                    { id: 1, title: 'Door-to-Door Campaigns', completed: 290, total: 350, color: 'bg-green-500' },
                    { id: 2, title: 'Voter Sentiment Analysis', completed: 245, total: 350, color: 'bg-blue-500' },
                    { id: 3, title: 'App Usage Guidelines', completed: 310, total: 350, color: 'bg-purple-500' },
                    { id: 4, title: 'Booth Mgmt Protocols', completed: 180, total: 350, color: 'bg-orange-500' },
                    { id: 5, title: 'Party Ideology', completed: 150, total: 350, color: 'bg-yellow-500' },
                    { id: 6, title: 'Social Media Guidelines', completed: 200, total: 350, color: 'bg-pink-500' }
                  ].map((m) => (
                    <div key={m.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-800">{m.title}</span>
                        <span className="text-slate-600">{Math.round((m.completed / m.total) * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div className={`h-full ${m.color} rounded-full`} style={{ width: `${(m.completed / m.total) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mandals Modal */}
        {viewingMandalsModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-base">{viewingMandalsModal} &bull; Mandals Breakdown</h3>
                <button
                  onClick={() => setViewingMandalsModal(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                >
                  &times;
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Mandals reporting active telemetry under {viewingMandalsModal} Assembly segment.
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {['Mandal 1 (Urban)', 'Mandal 2 (Rural East)', 'Mandal 3 (South)', 'Mandal 4 (Central)'].map((m, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">{m}</span>
                    <span className="text-green-600 font-bold">Leading (+19.4%)</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 text-right">
                <button
                  onClick={() => setViewingMandalsModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
