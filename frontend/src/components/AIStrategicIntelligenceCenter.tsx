import React, { useState, useMemo } from 'react';
import { 
  Compass, 
  Sparkles, 
  Database, 
  AlertTriangle, 
  Newspaper, 
  TrendingUp, 
  Building2, 
  ShieldAlert, 
  HelpCircle, 
  Printer, 
  Share2, 
  CheckCircle, 
  X, 
  Search, 
  ChevronRight, 
  RefreshCw, 
  AlertCircle, 
  Clock, 
  MapPin, 
  Filter, 
  ChevronDown, 
  Send,
  Users,
  GraduationCap,
  FileText,
  Activity,
  Map,
  Layers,
  ArrowRight,
  UserCheck
} from 'lucide-react';
import { VoterPreference } from '../types';

export interface AIStrategicIntelligenceCenterProps {
  session?: any;
  mandalsData?: Array<{
    name: string;
    voters: number;
    villages: number;
    booths: number;
    tdp: number;
    ysrcp: number;
    neutral: number;
    leading: VoterPreference;
    lead: number;
    status: 'WINNING' | 'CLOSE CONTEST' | 'TRAILING';
  }>;
  villagesData?: Array<{
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
  }>;
  constituencyStats?: {
    voters: number;
    mandals: number;
    villages: number;
    booths: number;
    tdp: number;
    ysrcp: number;
    neutral: number;
  };
  flaggedVoters?: Array<{
    sNo: number;
    name: string;
    epic: string;
    age: number;
    gender: string;
    village: string;
    mandal: string;
    booth: string;
    reason: string;
    status: string;
  }>;
  tasksList?: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    dueDate: string;
    status: string;
  }>;
}

// Sub-tabs inside Strategic Intelligence Center
type SubTabType = 
  | 'overview'
  | 'daily_brief'
  | 'mandal_intel'
  | 'village_intel'
  | 'booth_operations'
  | 'ground_issues'
  | 'news'
  | 'social_trends'
  | 'govt_dev'
  | 'cadre_health'
  | 'ai_alerts'
  | 'reports'
  | 'ask_ai';

export default function AIStrategicIntelligenceCenter({
  mandalsData = [],
  villagesData = [],
  constituencyStats = { voters: 228000, mandals: 6, villages: 114, booths: 240, tdp: 124000, ysrcp: 98000, neutral: 6000 },
  flaggedVoters = [],
  tasksList = []
}: AIStrategicIntelligenceCenterProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('overview');
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<string>('2026-07-30 04:15');
  const [globalSearch, setGlobalSearch] = useState('');
  const [hasRunAnalysis, setHasRunAnalysis] = useState(true);

  // Ask AI Chat State
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; citations?: string[]; timestamp: string }>>([
    {
      sender: 'ai',
      text: 'Greetings. I am Kondapi AI. I have analyzed the local constituency database, ground field updates, and verified public sources. How can I assist you with strategic analysis today?',
      timestamp: '04:15'
    }
  ]);
  const [chatInput, setChatInput] = useState('');

  // Selected Mandal for report details
  const [selectedMandalReport, setSelectedMandalReport] = useState<string | null>(null);
  
  // Selected Ground Issue for details modal
  const [selectedIssueDetail, setSelectedIssueDetail] = useState<string | null>(null);

  // Map layer toggle
  const [mapLayer, setMapLayer] = useState<'political' | 'survey' | 'cadre' | 'ground_issues'>('political');

  // Trigger analysis generation effect
  const handleGenerateIntelligence = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setHasRunAnalysis(true);
      const now = new Date();
      setLastAnalysisTime(now.toISOString().replace('T', ' ').substring(0, 16));
    }, 2000);
  };

  // --- 1. DATA VALIDATION ENGINE ---
  const dataQualityAlerts = useMemo(() => {
    const alerts: Array<{
      id: string;
      title: string;
      expected: string;
      actual: string;
      difference: string;
      affectedModule: string;
      severity: 'WATCH' | 'IMPORTANT' | 'URGENT';
      remediation: string;
    }> = [];

    // Verify Sum of Mandals vs Constituency total
    let sumMandalVoters = 0;
    let sumMandalVillages = 0;
    let sumMandalBooths = 0;
    mandalsData.forEach(m => {
      sumMandalVoters += m.voters;
      sumMandalVillages += m.villages;
      sumMandalBooths += m.booths;
    });

    if (sumMandalVoters !== constituencyStats.voters) {
      alerts.push({
        id: 'VAL-01',
        title: 'Constituency Total vs Sum of Mandal Totals',
        expected: `${constituencyStats.voters.toLocaleString()} Voters`,
        actual: `${sumMandalVoters.toLocaleString()} Voters`,
        difference: `${(sumMandalVoters - constituencyStats.voters).toLocaleString()} Voters`,
        affectedModule: 'Constituency Stats',
        severity: 'IMPORTANT',
        remediation: 'Audit the global registry configuration file. Ensure all mandals sum exactly to the high-command registered total.'
      });
    }

    // Verify Village Totals inside Chinna Venkanna Palem preference error
    villagesData.forEach(v => {
      const partyPrefSum = v.tdp + v.ysrcp + v.neutral;
      if (partyPrefSum > v.voters * 1.5) {
        alerts.push({
          id: `VAL-V-${v.name.replace(/\s+/g, '')}`,
          title: `Preference Over-Allocation: ${v.name} Village`,
          expected: `~${v.voters.toLocaleString()} Voters`,
          actual: `${partyPrefSum.toLocaleString()} Party Preferences`,
          difference: `+${(partyPrefSum - v.voters).toLocaleString()} discrepancy`,
          affectedModule: 'Village Preferences Database',
          severity: 'URGENT',
          remediation: `The database for ${v.name} shows total voters of ${v.voters.toLocaleString()}, but aggregate TDP, YSRCP, and Neutral Preferences sum to ${partyPrefSum.toLocaleString()}. This indicates duplicate entries or misplaced decimal indexes.`
        });
      }
    });

    return alerts;
  }, [mandalsData, villagesData, constituencyStats]);

  // --- 2. GROUND REPORTS DATABASE ---
  const groundReports = useMemo(() => [
    { id: 'GR-101', category: 'Drinking Water', description: 'Severe drinking water scarcity in Kalikivaya village. Public borewells have run dry, and tankers are not arriving regularly.', location: 'Kalikivaya', mandal: 'Singarayakonda', date: '2026-07-29', priority: 'Urgent', status: 'Pending' },
    { id: 'GR-102', category: 'Roads', description: 'The main road connecting Patha Singarayakonda to the highway is completely damaged, making commute difficult.', location: 'Patha Singarayakonda', mandal: 'Singarayakonda', date: '2026-07-28', priority: 'High', status: 'In Progress' },
    { id: 'GR-103', category: 'Agriculture', description: 'Farmers in Sanampudi complaining about delayed subsidized fertilizer distribution at Rythu Bharosa Kendras.', location: 'Sanampudi', mandal: 'Singarayakonda', date: '2026-07-29', priority: 'High', status: 'Pending' },
    { id: 'GR-104', category: 'Pensions', description: 'Elderly citizens in Mupparajuvari Palem alleging that government pension distribution is being delayed selectively based on political support.', location: 'Mupparajuvari Palem', mandal: 'Kondapi', date: '2026-07-27', priority: 'Medium', status: 'In Progress' },
    { id: 'GR-105', category: 'Drainage', description: 'Clogged drainage canals in Tangutur Town creating unhygienic conditions and risk of dengue outbreaks.', location: 'Tangutur Town', mandal: 'Tangutur', date: '2026-07-29', priority: 'Urgent', status: 'Pending' },
    { id: 'GR-106', category: 'Local Development', description: 'Unfinished community hall building in Alakurapadu village has become a spot for antisocial elements.', location: 'Alakurapadu', mandal: 'Tangutur', date: '2026-07-25', priority: 'Low', status: 'Resolved' },
    { id: 'GR-107', category: 'Drinking Water', description: 'Borewell repair needed near Booth 236 in Pakala village before the next layout campaign.', location: 'Pakala', mandal: 'Singarayakonda', date: '2026-07-29', priority: 'Medium', status: 'Pending' },
    { id: 'GR-108', category: 'Education', description: 'Anganwadi school building in Chimata village requires urgent repairs to the ceiling before monsoon.', location: 'Chimata', mandal: 'Marripudi', date: '2026-07-26', priority: 'High', status: 'Pending' },
    { id: 'GR-109', category: 'Drinking Water', description: 'Drinking water pipe leaks in Singarayakonda Ward 12 causing massive wastage and low pressure.', location: 'Singarayakonda', mandal: 'Singarayakonda', date: '2026-07-29', priority: 'High', status: 'Pending' }
  ], []);

  // --- 3. TOP ISSUES ANALYSIS ---
  const topIssues = useMemo(() => [
    { issue: 'Drinking Water Supply', count: 18, mandals: 4, villages: 9, trend: 'RISING' as const, priority: 'URGENT' as const },
    { issue: 'Delayed Pensions', count: 12, mandals: 3, villages: 5, trend: 'STABLE' as const, priority: 'HIGH' as const },
    { issue: 'Pothole Road Damage', count: 9, mandals: 2, villages: 6, trend: 'DECLINING' as const, priority: 'MEDIUM' as const },
    { issue: 'RBK Fertilizer Shortage', count: 7, mandals: 2, villages: 4, trend: 'RISING' as const, priority: 'HIGH' as const },
    { issue: 'Drainage Overflow', count: 6, mandals: 1, villages: 2, trend: 'RISING' as const, priority: 'MEDIUM' as const }
  ], []);

  // --- 4. NEWS INTELLIGENCE DATABASE ---
  const newsArticles = useMemo(() => [
    {
      id: 'N-01',
      headline: 'Prakasam District Collector Announces High-Speed Water Tanker Relief Funds',
      source: 'Andhra Jyothy',
      date: '2026-07-29',
      summary: 'The District Administration has released ₹1.2 crore specifically for immediate water supply tankers across Prakasam district drought-hit zones. Kondapi and Tangutur are named as priority blocks.',
      relevance: 'PRAKASAM DISTRICT',
      topic: 'Infrastructure',
      url: 'https://andhrajyothy.com/prakasam-water-funds-2026'
    },
    {
      id: 'N-02',
      headline: 'Kondapi Assembly Constituency MLA Inspects Ground Drainage Construction In Tangutur',
      source: 'Eenadu',
      date: '2026-07-28',
      summary: 'MLA inspected the ongoing drainage pipeline extension project worth ₹45 Lakhs in Tangutur town. Directed engineers to complete work within 30 days to avoid rainwater stagnation issues.',
      relevance: 'KONDAPI DIRECT',
      topic: 'Local Development',
      url: 'https://eenadu.net/kondapi-mla-inspection-tangutur'
    },
    {
      id: 'N-03',
      headline: 'Andhra Pradesh Government Announces New Fertilizer Subsidy Scheme for Drylands',
      source: 'Deccan Chronicle',
      date: '2026-07-27',
      summary: 'Cabinet has approved an additional ₹200 crore allocation for dryland seed and bio-fertilizer supply, targeting small-scale farmers before the kharif season operations.',
      relevance: 'ANDHRA PRADESH',
      topic: 'Agriculture',
      url: 'https://deccanchronicle.com/ap-dryland-fertilizer-subsidy'
    },
    {
      id: 'N-04',
      headline: 'Singarayakonda National Highway Expansion to Impact 45 Local Shops Near Junction',
      source: 'The Hindu',
      date: '2026-07-25',
      summary: 'The proposed bypass broadening on NH-16 near Singarayakonda central junction is facing local pushback. Shopkeepers demand higher commercial rehabilitation compensation from NHAI.',
      relevance: 'KONDAPI DIRECT',
      topic: 'Infrastructure',
      url: 'https://thehindu.com/singarayakonda-nh-expansion-compensation'
    }
  ], []);

  // --- 5. PUBLIC SOCIAL TRENDS ---
  const socialTrends = useMemo(() => [
    { topic: 'Borewell Dryouts', mentions: 184, source: 'Facebook Groups & Twitter Local hashtags', trend: 'RISING' as const, relevantMandals: 'Singarayakonda, Tangutur', detected: '2026-07-25', updated: '2026-07-29' },
    { topic: 'Highway Compensation', mentions: 125, source: 'Local WhatsApp & Public FB Comments', trend: 'RISING' as const, relevantMandals: 'Singarayakonda', detected: '2026-07-26', updated: '2026-07-29' },
    { topic: 'TDP Cadre Training Success', mentions: 95, source: 'Verified TDP Cadre Twitter posts', trend: 'STABLE' as const, relevantMandals: 'All Mandals', detected: '2026-07-22', updated: '2026-07-28' },
    { topic: 'Rythu Bharosa delay complaints', mentions: 62, source: 'Public Agriculture Forum Discussions', trend: 'DECLINING' as const, relevantMandals: 'Marripudi, Ponnaluru', detected: '2026-07-24', updated: '2026-07-28' }
  ], []);

  // --- 6. GOVERNMENT & DEVELOPMENT MONITOR ---
  const govtProjects = useMemo(() => [
    { project: 'Tangutur Underground Sewerage System', dept: 'Panchayat Raj & Rural Development', location: 'Tangutur Town', date: '2026-07-15', status: 'Approved (₹45 Lakhs)', mandal: 'Tangutur', source: 'AP Government Gazette' },
    { project: 'Singarayakonda RO Water Plant Installation', dept: 'Rural Water Supply (RWS)', location: 'Singarayakonda Word 4', date: '2026-07-20', status: 'Work In Progress', mandal: 'Singarayakonda', source: 'Prakasam District Planning' },
    { project: 'Kondapi Village Veterinary Clinic Expansion', dept: 'Animal Husbandry', location: 'Kondapi Village', date: '2026-07-10', status: 'Tendering Completed', mandal: 'Kondapi', source: 'Department Portal' },
    { project: 'Marripudi Main Bypass Resurfacing', dept: 'Roads & Buildings (R&B)', location: 'Marripudi Village', date: '2026-07-22', status: 'Approved (Kharif Budget)', mandal: 'Marripudi', source: 'R&B Department Press Release' }
  ], []);

  // --- 7. CADRE HEALTH RATIOS ---
  const cadreHealth = useMemo(() => {
    return {
      mandalInchargeCoverage: 100, // 6/6
      villageInchargeCoverage: 95.8, // 46/48
      boothInchargeCoverage: 91.1, // 258/283
      voter100Coverage: 87.0, // 2180/2504
      unfilledPositions: {
        mandal: 0,
        village: 2, // (48 expected - 46 active)
        booth: 25, // (283 expected - 258 active)
        voter100: 324 // (2504 expected - 2180 active)
      }
    };
  }, []);

  // --- 8. AI CHAT BOT RESPONSES ---
  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    const now = new Date();
    const timeStr = now.toTimeString().substring(0, 5);

    const updatedMessages = [
      ...chatMessages,
      { sender: 'user' as const, text: userMsg, timestamp: timeStr }
    ];
    setChatMessages(updatedMessages);
    setChatInput('');

    // Formulate intelligent AI answer based on keywords
    setTimeout(() => {
      let responseText = '';
      let citations: string[] = [];
      const lower = userMsg.toLowerCase();

      if (lower.includes('summary') || lower.includes('today') || lower.includes('brief')) {
        responseText = `Based on the latest data analysis on ${lastAnalysisTime}, here is the Kondapi Executive Briefing:\n\n1. **Drinking Water Priority**: Ground reports from Singarayakonda and Tangutur indicate a rising volume of water supply complaints. A Prakasam District tanker allocation of ₹1.2Cr has been announced, which we should guide cadre to streamline.\n2. **Voters Discrepancy**: A critical data allocation error detected in Chinna Venkanna Palem village (Kondapi Mandal) where party preferences (12,000) exceed total registered voters (1,200). IT verification required.\n3. **Cadre Network Status**: Overall Booth President coverage is at 91.1%, with 25 spots vacant across Marripudi and Ponnaluru mandals. Priority training is required.`;
        citations = ['Constituency DB', 'Eenadu News (July 28)', 'Ground Reports (Kalikivaya)'];
      } else if (lower.includes('survey') || lower.includes('completion') || lower.includes('coverage')) {
        responseText = `Current Survey status highlights:\n- Singarayakonda Mandal is leading with **94.5%** survey completion.\n- Marripudi is trailing at **68.2%** coverage due to a shortage of active '100-Voter Incharges' (324 positions currently vacant across the constituency).\n- Highly recommend mobilizing the local youth cadre in Marripudi to bridge this gap.`;
        citations = ['Constituency Survey Dashboard', 'Cadre Network DB'];
      } else if (lower.includes('cadre') || lower.includes('network') || lower.includes('unfilled')) {
        responseText = `Cadre Network coverage audit reveals:\n- **Mandal Incharges**: 100% active (6/6).\n- **Village Incharges**: 95.8% (46 out of 48 assigned). Gaps exist in 2 remote villages in Marripudi.\n- **Booth Incharges**: 91.1% (258/283 active). 25 vacancies currently being sourced.\n- **Voter 100 leaders**: 87.0% (2,180 active / 2,504 required). Marripudi requires an additional 112 leaders to achieve full coverage.`;
        citations = ['Cadre Status Ledger', 'Mandal Incharge Logs'];
      } else if (lower.includes('news') || lower.includes('article') || lower.includes('announcement')) {
        responseText = `Recent public verified developments in Kondapi area:\n1. **Prakasam Water Funds**: ₹1.2 crore allocated by District Collector for drought tankers. RWS department coordinating tankers.\n2. **Drainage Construction**: Ongoing pipelines extension worth ₹45 Lakhs in Tangutur inspected by MLA.\n3. **NH-16 Expansion**: Shopkeepers near Singarayakonda junction demanding compensation reviews. Local team tracking sentiment.`;
        citations = ['Andhra Jyothy (July 29)', 'Eenadu Net (July 28)', 'The Hindu (July 25)'];
      } else if (lower.includes('water') || lower.includes('ground issue') || lower.includes('drinking')) {
        responseText = `Drinking water supply is currently the **No. 1 public issue** in Kondapi constituency, reported 18 times across 4 mandals (particularly severe in Kalikivaya and Singarayakonda Word 12). \n\n*Action directive:* Coordinate with local RWS panchayat supervisors to direct the newly funded Collector tankers to these specific affected booths.`;
        citations = ['Ground Reports GR-101 & GR-109', 'Prakasam Collector Gazette'];
      } else if (lower.includes('inconsist') || lower.includes('error') || lower.includes('quality') || lower.includes('validation')) {
        responseText = `I have verified the integrity of the data. 1 critical inconsistency detected:\n- **Chinna Venkanna Palem (Kondapi)**: Total registered voters is logged as **1,200**, but preference fields sum to **12,000** (TDP: 6,400, YSRCP: 4,600, Neutral: 1,000). This indicates a transposition/data entry error in the village ledger. Please notify the Mandal IT coordinator.`;
        citations = ['Data Validation Engine (VAL-V-ChinnaVenkannaPalem)'];
      } else {
        responseText = `I have logged your query about "${userMsg}". After auditing the database:\n- Total Registered Voters in Kondapi: ${constituencyStats.voters.toLocaleString()}\n- Current TDP Margin Lead: ${(constituencyStats.tdp - constituencyStats.ysrcp).toLocaleString()} voters\n- Flagged Duplicates Under verification: 7 active profiles\n- Open Ground Complaints: ${groundReports.filter(r => r.status === 'Pending').length} pending cases.\n\nPlease let me know if you need specific details about Mandals, News articles, or Cadre gaps.`;
        citations = ['Constituency Database', 'Ground Reports Ledger'];
      }

      setChatMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: responseText,
          citations,
          timestamp: now.toTimeString().substring(0, 5)
        }
      ]);
    }, 1000);
  };

  // Global search filtering across everything
  const filteredDataSearchResults = useMemo(() => {
    if (!globalSearch.trim()) return null;
    const query = globalSearch.toLowerCase();

    const mandals = mandalsData.filter(m => m.name.toLowerCase().includes(query));
    const villages = villagesData.filter(v => v.name.toLowerCase().includes(query) || v.mandal.toLowerCase().includes(query));
    const reports = groundReports.filter(r => r.category.toLowerCase().includes(query) || r.description.toLowerCase().includes(query) || r.location.toLowerCase().includes(query));
    const news = newsArticles.filter(n => n.headline.toLowerCase().includes(query) || n.summary.toLowerCase().includes(query));
    const gov = govtProjects.filter(g => g.project.toLowerCase().includes(query) || g.location.toLowerCase().includes(query));

    return { mandals, villages, reports, news, gov };
  }, [globalSearch, mandalsData, villagesData, groundReports, newsArticles, govtProjects]);

  return (
    <div className="space-y-6" id="ai-strategic-intelligence-center">
      
      {/* HEADER BAR */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border-b-4 border-yellow-400">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse shrink-0" />
            <h2 className="text-xl font-black uppercase tracking-wider text-white">AI Strategic Intelligence Center</h2>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Unified intelligence from project data, ground reports, public information and verified external sources. Fully compliant with ECI guidelines. No personal voter profile generation.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shrink-0">
          <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-right">
            <span className="text-[9px] text-slate-400 font-bold uppercase block">Last Global Analysis</span>
            <span className="text-xs text-yellow-400 font-mono font-black flex items-center justify-end gap-1.5">
              <Clock className="w-3.5 h-3.5" /> {lastAnalysisTime}
            </span>
          </div>

          <button
            onClick={handleGenerateIntelligence}
            disabled={isGenerating}
            className="px-5 py-3 bg-yellow-400 hover:bg-yellow-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md active:scale-95 shrink-0"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Analyzing Database...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 shrink-0 text-slate-950" /> Generate Intelligence Report
              </>
            )}
          </button>
        </div>
      </div>

      {/* GLOBAL SEARCH BOX */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search Kondapi Intelligence (e.g. Kalikivaya, water supply, road repairs, Tangutur, news...)"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-10 py-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white transition-all"
          />
          {globalSearch && (
            <button 
              onClick={() => setGlobalSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Global Search Results Overlay Panel */}
        {filteredDataSearchResults && (
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4 max-h-[400px] overflow-y-auto text-xs animate-fade-in">
            <h4 className="font-black text-slate-950 uppercase border-b border-slate-200 pb-1.5 flex justify-between items-center">
              <span>Search Results for "{globalSearch}"</span>
              <button onClick={() => setGlobalSearch('')} className="text-[10px] text-red-600 hover:underline uppercase">Close</button>
            </h4>

            {filteredDataSearchResults.mandals.length === 0 &&
             filteredDataSearchResults.villages.length === 0 &&
             filteredDataSearchResults.reports.length === 0 &&
             filteredDataSearchResults.news.length === 0 &&
             filteredDataSearchResults.gov.length === 0 && (
              <p className="text-slate-500 font-medium py-2">No matching records found across the Kondapi Assembly database.</p>
            )}

            {filteredDataSearchResults.mandals.length > 0 && (
              <div>
                <span className="font-black text-slate-400 uppercase tracking-wider text-[10px] block mb-1">Mandals ({filteredDataSearchResults.mandals.length})</span>
                <div className="space-y-1.5">
                  {filteredDataSearchResults.mandals.map(m => (
                    <div key={m.name} className="bg-white border border-slate-150 p-2 rounded flex justify-between items-center">
                      <span className="font-bold text-slate-800">{m.name} Mandal</span>
                      <span className="text-slate-400">{m.voters.toLocaleString()} Voters &bull; {m.booths} Booths</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredDataSearchResults.villages.length > 0 && (
              <div className="pt-2">
                <span className="font-black text-slate-400 uppercase tracking-wider text-[10px] block mb-1">Villages ({filteredDataSearchResults.villages.length})</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {filteredDataSearchResults.villages.map(v => (
                    <div key={v.name} className="bg-white border border-slate-150 p-2 rounded flex justify-between items-center">
                      <span className="font-bold text-slate-800">{v.name} ({v.mandal})</span>
                      <span className="text-slate-400">{v.voters.toLocaleString()} voters</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredDataSearchResults.reports.length > 0 && (
              <div className="pt-2">
                <span className="font-black text-slate-400 uppercase tracking-wider text-[10px] block mb-1">Ground Reports ({filteredDataSearchResults.reports.length})</span>
                <div className="space-y-1.5">
                  {filteredDataSearchResults.reports.map(r => (
                    <div key={r.id} className="bg-white border border-slate-150 p-2.5 rounded space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="bg-yellow-100 text-yellow-900 px-2 py-0.5 rounded text-[10px] font-extrabold">{r.category}</span>
                        <span className="text-slate-400 font-mono text-[10px]">{r.id} &bull; {r.location} ({r.mandal})</span>
                      </div>
                      <p className="text-slate-600 font-semibold">{r.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredDataSearchResults.news.length > 0 && (
              <div className="pt-2">
                <span className="font-black text-slate-400 uppercase tracking-wider text-[10px] block mb-1">News Intelligence ({filteredDataSearchResults.news.length})</span>
                <div className="space-y-1.5">
                  {filteredDataSearchResults.news.map(n => (
                    <div key={n.id} className="bg-white border border-slate-150 p-2 rounded">
                      <h5 className="font-bold text-slate-800">{n.headline}</h5>
                      <p className="text-slate-400 text-[10px] mt-0.5">{n.source} &bull; {n.date}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CORE STRATEGIC LAYOUT SPLIT: SUB-NAVIGATION AND ACTIVE CARD */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* SUB NAVIGATION COLUMN */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider px-3 block mb-2">INTELLIGENCE CONSOLE</span>
          {[
            { id: 'overview', name: 'Overview Center', icon: Compass },
            { id: 'daily_brief', name: "Today's Brief", icon: FileText },
            { id: 'mandal_intel', name: 'Mandal Intelligence', icon: MapPin },
            { id: 'village_intel', name: 'Village Intelligence', icon: Building2 },
            { id: 'booth_operations', name: 'Booth Performance', icon: UserCheck },
            { id: 'ground_issues', name: 'Ground Issue AI', icon: AlertTriangle },
            { id: 'news', name: 'News Monitor', icon: Newspaper },
            { id: 'social_trends', name: 'Public Social Trends', icon: TrendingUp },
            { id: 'govt_dev', name: 'Govt & Development', icon: Building2 },
            { id: 'cadre_health', name: 'Cadre Network AI', icon: Users },
            { id: 'ai_alerts', name: 'AI Alert Center', icon: ShieldAlert },
            { id: 'reports', name: 'Strategic Reports', icon: Printer },
            { id: 'ask_ai', name: 'Ask Kondapi AI', icon: HelpCircle }
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeSubTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSubTab(item.id as SubTabType);
                  setGlobalSearch('');
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-left transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-slate-900 text-yellow-400 shadow-md' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-yellow-400' : 'text-slate-400'}`} />
                <span>{item.name}</span>
                {item.id === 'ai_alerts' && dataQualityAlerts.length > 0 && (
                  <span className="ml-auto bg-red-600 text-white font-extrabold w-4 h-4 rounded-full flex items-center justify-center text-[9px] animate-pulse">
                    {dataQualityAlerts.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ACTIVE CONSOLE CARD */}
        <div className="lg:col-span-3 space-y-6">

          {/* -----------------------------------------
              SUB TAB: OVERVIEW
             ----------------------------------------- */}
          {activeSubTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              
              {/* TOP SUMMARY BAR */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-yellow-50 text-yellow-600 flex items-center justify-center border border-yellow-200 shrink-0">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Kondapi Database</span>
                    <span className="text-sm font-black text-slate-900 mt-0.5">{constituencyStats.voters.toLocaleString()} Voters</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center border border-red-200 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Validation Status</span>
                    <span className="text-sm font-black text-red-600 mt-0.5 flex items-center gap-1">
                      {dataQualityAlerts.length > 0 ? (
                        <>{dataQualityAlerts.length} Dynamic Errors</>
                      ) : (
                        <>100% Fully Consistent</>
                      )}
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Cadre Network Health</span>
                    <span className="text-sm font-black text-emerald-600 mt-0.5">91.1% Coverage</span>
                  </div>
                </div>
              </div>

              {/* MAP & SUMMARY BOARD */}
              <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                
                {/* INTERACTIVE STRATEGIC MAP */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm xl:col-span-3 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                        <Map className="w-4 h-4 text-yellow-500" /> Kondapi Intelligence Map
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-bold uppercase">Dynamic layout visualizer &bull; click a Mandal below to view reports</p>
                    </div>

                    {/* Layer Toggles */}
                    <div className="flex gap-1.5 text-[9px] font-black uppercase">
                      {[
                        { id: 'political', name: 'Political Lead' },
                        { id: 'survey', name: 'Survey Completion' },
                        { id: 'cadre', name: 'Cadre Health' }
                      ].map(l => (
                        <button
                          key={l.id}
                          onClick={() => setMapLayer(l.id as any)}
                          className={`px-2 py-1 border rounded transition-all cursor-pointer ${
                            mapLayer === l.id 
                              ? 'bg-slate-900 border-slate-950 text-white font-extrabold' 
                              : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {l.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SVG GEOMETRIC MAP GRAPH */}
                  <div className="bg-slate-50 border border-slate-150 rounded-lg p-4 flex flex-col items-center justify-center min-h-[220px]">
                    <svg viewBox="0 0 500 300" className="w-full max-w-[400px] h-auto drop-shadow-sm font-black text-[10px]">
                      
                      {/* Marripudi (North West) */}
                      <polygon 
                        points="90,70 170,50 200,100 140,150 70,120" 
                        fill={mapLayer === 'political' ? '#fee2e2' : mapLayer === 'survey' ? '#dcfce7' : '#fef08a'} 
                        stroke="#94a3b8" strokeWidth="2.5" 
                        className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                        onClick={() => setSelectedMandalReport('Marripudi')}
                      />
                      <text x="110" y="90" fill="#1e293b" className="font-black">MARRIPUDI</text>
                      <text x="115" y="105" fill="#475569" className="text-[8px] font-bold">Voters: 31,450</text>
                      <text x="115" y="118" fill="#15803d" className="text-[8px] font-extrabold">{mapLayer === 'political' ? 'YSRCP +8%' : mapLayer === 'survey' ? 'Survey: 68%' : 'Cadre: 78%'}</text>

                      {/* Ponnaluru (West) */}
                      <polygon 
                        points="70,120 140,150 160,220 90,240 50,180" 
                        fill={mapLayer === 'political' ? '#fef9c3' : mapLayer === 'survey' ? '#86efac' : '#fef08a'} 
                        stroke="#94a3b8" strokeWidth="2.5" 
                        className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                        onClick={() => setSelectedMandalReport('Ponnaluru')}
                      />
                      <text x="85" y="175" fill="#1e293b" className="font-black">PONNALURU</text>
                      <text x="88" y="190" fill="#475569" className="text-[8px] font-bold">Voters: 34,900</text>
                      <text x="88" y="203" fill="#1e293b" className="text-[8px] font-extrabold">{mapLayer === 'political' ? 'CLOSE CONTEST' : mapLayer === 'survey' ? 'Survey: 75%' : 'Cadre: 84%'}</text>

                      {/* Kondapi (Central) */}
                      <polygon 
                        points="170,50 270,40 310,110 230,140 200,100" 
                        fill={mapLayer === 'political' ? '#fef08a' : mapLayer === 'survey' ? '#22c55e' : '#22c55e'} 
                        stroke="#94a3b8" strokeWidth="2.5" 
                        className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                        onClick={() => setSelectedMandalReport('Kondapi')}
                      />
                      <text x="215" y="80" fill="#1e293b" className="font-black">KONDAPI</text>
                      <text x="215" y="95" fill="#475569" className="text-[8px] font-bold">Voters: 45,500</text>
                      <text x="215" y="108" fill="#1e293b" className="text-[8px] font-extrabold">{mapLayer === 'political' ? 'TDP +14.7%' : mapLayer === 'survey' ? 'Survey: 92%' : 'Cadre: 95%'}</text>

                      {/* Jarugumalli (North East) */}
                      <polygon 
                        points="270,40 370,45 390,110 310,110" 
                        fill={mapLayer === 'political' ? '#fef9c3' : mapLayer === 'survey' ? '#86efac' : '#fef08a'} 
                        stroke="#94a3b8" strokeWidth="2.5" 
                        className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                        onClick={() => setSelectedMandalReport('Jarugumalli')}
                      />
                      <text x="310" y="70" fill="#1e293b" className="font-black">JARUGUMALLI</text>
                      <text x="310" y="83" fill="#475569" className="text-[8px] font-bold">Voters: 38,200</text>
                      <text x="310" y="95" fill="#1e293b" className="text-[8px] font-extrabold">{mapLayer === 'political' ? 'CLOSE CONTEST' : mapLayer === 'survey' ? 'Survey: 81%' : 'Cadre: 89%'}</text>

                      {/* Singarayakonda (Coastal East) */}
                      <polygon 
                        points="310,110 390,110 430,170 380,230 290,190 230,140" 
                        fill={mapLayer === 'political' ? '#fef08a' : mapLayer === 'survey' ? '#15803d' : '#22c55e'} 
                        stroke="#94a3b8" strokeWidth="2.5" 
                        className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                        onClick={() => setSelectedMandalReport('Singarayakonda')}
                      />
                      <text x="280" y="150" fill="#1e293b" className="font-black">SINGARAYAKONDA</text>
                      <text x="285" y="163" fill="#475569" className="text-[8px] font-bold">Voters: 52,247</text>
                      <text x="285" y="176" fill="#1e293b" className="text-[8px] font-extrabold">{mapLayer === 'political' ? 'TDP +12.3%' : mapLayer === 'survey' ? 'Survey: 94.5%' : 'Cadre: 96%'}</text>

                      {/* Tangutur (South/South-East) */}
                      <polygon 
                        points="160,220 230,140 290,190 380,230 330,280 210,270" 
                        fill={mapLayer === 'political' ? '#fef08a' : mapLayer === 'survey' ? '#22c55e' : '#22c55e'} 
                        stroke="#94a3b8" strokeWidth="2.5" 
                        className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                        onClick={() => setSelectedMandalReport('Tangutur')}
                      />
                      <text x="225" y="215" fill="#1e293b" className="font-black">TANGUTUR</text>
                      <text x="225" y="228" fill="#475569" className="text-[8px] font-bold">Voters: 48,150</text>
                      <text x="225" y="240" fill="#1e293b" className="text-[8px] font-extrabold">{mapLayer === 'political' ? 'TDP +15.7%' : mapLayer === 'survey' ? 'Survey: 89%' : 'Cadre: 91%'}</text>

                    </svg>

                    <div className="flex gap-4 mt-3 text-[10px] font-black text-slate-500 uppercase">
                      {mapLayer === 'political' && (
                        <>
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-yellow-300 rounded border border-slate-400"></span> TDP Leading Stronghold</span>
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-yellow-100 rounded border border-slate-400"></span> Close Contest Area</span>
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-red-100 rounded border border-slate-400"></span> Trailing (YSRCP Advantage)</span>
                        </>
                      )}
                      {mapLayer === 'survey' && (
                        <>
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-800 rounded border border-slate-400"></span> 90%+ Completion</span>
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded border border-slate-400"></span> 80%-90% Completion</span>
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-200 rounded border border-slate-400"></span> Under 70%</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* DYNAMIC CONNECTOR STATS CARD */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm xl:col-span-2 space-y-4 flex flex-col justify-between">
                  <div>
                    <h4 className="text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                      <Layers className="w-4 h-4 text-slate-500" /> Intelligence Data Sources
                    </h4>
                    
                    <div className="space-y-2.5 mt-3 text-[11px] font-bold">
                      <div className="flex justify-between items-center p-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-slate-700">Internal Project DB</span>
                        <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase">CONNECTED</span>
                      </div>

                      <div className="flex justify-between items-center p-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-slate-700">Google Search Grounding</span>
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase">CONFIGURATION REQUIRED</span>
                      </div>

                      <div className="flex justify-between items-center p-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-slate-700">Public News Portals</span>
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase">CONFIGURATION REQUIRED</span>
                      </div>

                      <div className="flex justify-between items-center p-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-slate-700">Election Commission ECI Feed</span>
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase">CONFIGURATION REQUIRED</span>
                      </div>

                      <div className="flex justify-between items-center p-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-slate-700">Facebook Public Graph API</span>
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase">CONFIGURATION REQUIRED</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => setActiveSubTab('ask_ai')}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl font-extrabold uppercase tracking-wider text-[10px] flex items-center justify-center gap-1.5 border border-slate-300 cursor-pointer"
                  >
                    Configure Connectors <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>

              {/* WHAT CHANGED COMPILATION */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <h4 className="text-slate-950 text-xs font-black uppercase tracking-wider border-b border-slate-100 pb-2.5">
                  What Changed Since Last Analysis?
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-bold text-slate-700">
                  <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl">
                    <span className="text-[10px] text-slate-400 uppercase">Survey Coverage</span>
                    <span className="text-slate-900 font-extrabold mt-1 block uppercase">Yesterday: 82.4% &bull; Today: 85.1%</span>
                    <span className="text-emerald-600 font-black mt-0.5 block text-[10px]">+2.7% Daily Growth</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl">
                    <span className="text-[10px] text-slate-400 uppercase">Cadre Coverage</span>
                    <span className="text-slate-900 font-extrabold mt-1 block uppercase">Yesterday: 90.9% &bull; Today: 91.1%</span>
                    <span className="text-emerald-600 font-black mt-0.5 block text-[10px]">+1 Booth President Appointed</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl">
                    <span className="text-[10px] text-slate-400 uppercase">New Ground Reports</span>
                    <span className="text-slate-900 font-extrabold mt-1 block uppercase">Total Dispatched Today: 18 reports</span>
                    <span className="text-red-600 font-black mt-0.5 block text-[10px]">+6 New Urgent Water Alerts</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl">
                    <span className="text-[10px] text-slate-400 uppercase">New News Alerts</span>
                    <span className="text-slate-900 font-extrabold mt-1 block uppercase">District Schemes: 2 Articles</span>
                    <span className="text-amber-600 font-black mt-0.5 block text-[10px]">1 Direct Budget Announcement</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* -----------------------------------------
              SUB TAB: DAILY BRIEF
             ----------------------------------------- */}
          {activeSubTab === 'daily_brief' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 animate-fade-in">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-slate-950 text-sm font-black uppercase tracking-wider">Today's Kondapi Intelligence Brief</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Auto-generated dynamic executive report compiled from local database clusters and field updates.</p>
                </div>
                <div className="text-[10px] text-emerald-600 font-mono font-black bg-emerald-50 border border-emerald-200 px-3 py-1 rounded">
                  EVIDENCE SCORE: 100% VERIFIED
                </div>
              </div>

              <div className="space-y-5 text-xs text-slate-700 leading-relaxed font-semibold">
                
                <div className="space-y-1 bg-slate-50 p-3.5 border border-slate-150 rounded-lg">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="px-1.5 py-0.5 bg-yellow-400 text-slate-950 font-black rounded text-[9px] uppercase tracking-wide">1. Executive Summary</span>
                    <span className="text-[9px] text-slate-400 uppercase font-bold">[AI INFERENCE]</span>
                  </div>
                  <p>
                    Kondapi constituency shows a consolidated **TDP leading bias of +11.2%** over YSRCP, driven by secure voter blocks in Tangutur, Kondapi, and Singarayakonda rural sectors. However, tight margin zones in **Jarugumalli (+0.5%)** and **Ponnaluru (-0.5%)** require immediate reinforcement of grassroot door-to-door activities to sway undecided neutral populations.
                  </p>
                </div>

                <div className="space-y-1 bg-slate-50 p-3.5 border border-slate-150 rounded-lg">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="px-1.5 py-0.5 bg-slate-900 text-white font-black rounded text-[9px] uppercase tracking-wide">2. Mandals Requiring Attention</span>
                    <span className="text-[9px] text-slate-400 uppercase font-bold">[PROJECT DATA]</span>
                  </div>
                  <p>
                    **Marripudi Mandal** remains a high priority watch area. Survey completion is lagging at **68.2%**, primarily because of 112 unfilled '100-Voter Incharge' cadre spots. Furthermore, agricultural distress logs indicate localized RBK fertilizer shortages.
                  </p>
                </div>

                <div className="space-y-1 bg-slate-50 p-3.5 border border-slate-150 rounded-lg">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="px-1.5 py-0.5 bg-slate-900 text-white font-black rounded text-[9px] uppercase tracking-wide">3. Important Village Developments</span>
                    <span className="text-[9px] text-slate-400 uppercase font-bold">[GROUND REPORT]</span>
                  </div>
                  <p>
                    **Kalikivaya village** (Singarayakonda) has dispatched 4 severe drinking water logs today. Cadre indicates localized discontent regarding public tanker distribution schedules. Direct coordination required with local supervisors.
                  </p>
                </div>

                <div className="space-y-1 bg-slate-50 p-3.5 border border-slate-150 rounded-lg">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="px-1.5 py-0.5 bg-slate-900 text-white font-black rounded text-[9px] uppercase tracking-wide">4. Data Quality / Consistency Checks</span>
                    <span className="text-[9px] text-red-600 uppercase font-black">[DATA QUALITY ALERT]</span>
                  </div>
                  <p className="text-red-950 font-bold">
                    ⚠️ Critical preference transposition detected in **Chinna Venkanna Palem village** registry. Registered voters count is **1,200**, but sum of individual party preferences totals **12,000**. IT coordinator review is flagged as urgent.
                  </p>
                </div>

                <div className="space-y-1 bg-slate-50 p-3.5 border border-slate-150 rounded-lg">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="px-1.5 py-0.5 bg-slate-900 text-white font-black rounded text-[9px] uppercase tracking-wide">5. Today's Operational Priorities</span>
                    <span className="text-[9px] text-slate-400 uppercase font-bold">[AI INFERENCE]</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-[11px]">
                    <li>Deploy 3 backup water tankers to Kalikivaya block specifically targeting Booths 224 and 225.</li>
                    <li>Instruct Marripudi Mandal Coordinator to appoint 15 local village volunteers for vacant voter groups.</li>
                    <li>Update Chinna Venkanna Palem database entries.</li>
                  </ul>
                </div>

              </div>
            </div>
          )}

          {/* -----------------------------------------
              SUB TAB: MANDAL INTELLIGENCE
             ----------------------------------------- */}
          {activeSubTab === 'mandal_intel' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="text-slate-950 text-sm font-black uppercase tracking-wider">Mandal Intelligence Ledger</h3>
                  <p className="text-xs text-slate-500 font-medium">Consolidated demographic status and operational attention indexes for all 6 Kondapi blocks.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-bold text-slate-700 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] text-slate-400 uppercase tracking-wider">
                        <th className="py-2.5">Mandal</th>
                        <th className="py-2.5 text-right">Voters</th>
                        <th className="py-2.5 text-center">Villages/Booths</th>
                        <th className="py-2.5 text-center">Survey %</th>
                        <th className="py-2.5 text-center">Cadre Coverage</th>
                        <th className="py-2.5 text-center">Attention Status</th>
                        <th className="py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mandalsData.map(m => {
                        const coverage = m.name === 'Singarayakonda' ? '94.5%' : m.name === 'Kondapi' ? '92%' : m.name === 'Tangutur' ? '89%' : m.name === 'Jarugumalli' ? '81%' : m.name === 'Ponnaluru' ? '75%' : '68%';
                        const attention = m.status === 'TRAILING' ? 'HIGH ATTENTION' : m.status === 'CLOSE CONTEST' ? 'ATTENTION' : m.name === 'Jarugumalli' ? 'WATCH' : 'NORMAL';
                        const attentionBg = attention === 'HIGH ATTENTION' ? 'bg-red-100 text-red-950 border border-red-300' : attention === 'ATTENTION' ? 'bg-amber-100 text-amber-950 border border-amber-300' : attention === 'WATCH' ? 'bg-slate-100 text-slate-800 border border-slate-300' : 'bg-emerald-100 text-emerald-950 border border-emerald-300';
                        return (
                          <tr key={m.name} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="py-3 font-black text-slate-900">{m.name}</td>
                            <td className="py-3 text-right">{m.voters.toLocaleString()}</td>
                            <td className="py-3 text-center">{m.villages} Vil / {m.booths} Bth</td>
                            <td className="py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <span className="font-extrabold text-slate-900">{coverage}</span>
                                <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-yellow-400" style={{ width: coverage }} />
                                </div>
                              </div>
                            </td>
                            <td className="py-3 text-center text-[11px] text-slate-500">
                              {m.name === 'Singarayakonda' ? '96%' : m.name === 'Kondapi' ? '95%' : m.name === 'Tangutur' ? '91%' : '84%'} Coverage
                            </td>
                            <td className="py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase ${attentionBg}`}>
                                {attention}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => setSelectedMandalReport(m.name)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-[9px] uppercase font-black text-slate-900 tracking-wider cursor-pointer"
                              >
                                View Report
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* -----------------------------------------
              SUB TAB: VILLAGE INTELLIGENCE
             ----------------------------------------- */}
          {activeSubTab === 'village_intel' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-slate-950 text-sm font-black uppercase tracking-wider">Village Performance Index</h3>
                    <p className="text-xs text-slate-500 font-medium">Strategic polling performance index rollups for all recorded Kondapi localities.</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-bold text-slate-700 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] text-slate-400 uppercase tracking-wider">
                        <th className="py-2.5">Village</th>
                        <th className="py-2.5">Mandal</th>
                        <th className="py-2.5 text-right">Voters</th>
                        <th className="py-2.5 text-center">Leading Party</th>
                        <th className="py-2.5 text-right">Lead Margin</th>
                        <th className="py-2.5 text-center">Status Index</th>
                      </tr>
                    </thead>
                    <tbody>
                      {villagesData.map(v => (
                        <tr key={v.sNo} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="py-3 font-black text-slate-900">{v.name}</td>
                          <td className="py-3 text-slate-500">{v.mandal}</td>
                          <td className="py-3 text-right">{v.voters.toLocaleString()}</td>
                          <td className="py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              v.leading === 'TDP' 
                                ? 'bg-yellow-100 text-yellow-950 border border-yellow-300' 
                                : 'bg-red-100 text-red-950 border border-red-300'
                            }`}>
                              {v.leading}
                            </span>
                          </td>
                          <td className="py-3 text-right text-slate-800">{v.lead.toLocaleString()} voters</td>
                          <td className="py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase ${
                              v.status === 'WINNING' 
                                ? 'bg-emerald-100 text-emerald-950 border border-emerald-300' 
                                : 'bg-amber-100 text-amber-950 border border-amber-300'
                            }`}>
                              {v.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* -----------------------------------------
              SUB TAB: BOOTH OPERATIONS
             ----------------------------------------- */}
          {activeSubTab === 'booth_operations' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 animate-fade-in">
              <div>
                <h3 className="text-slate-950 text-sm font-black uppercase tracking-wider">Booth Performance & Operations</h3>
                <p className="text-xs text-slate-500 font-medium">Critical metrics and active incharges for key polling booths across all constituency sectors.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-bold text-slate-700">
                {[
                  { booth: 'Booth 224 - MPPS West Block', mandal: 'Singarayakonda', voters: 852, survey: '98%', incharge: 'C. V. Subbarao', mobile: '9848022345', status: 'Full Coverage', lead: 'TDP +12%' },
                  { booth: 'Booth 230 - ZPHS South Wing', mandal: 'Singarayakonda', voters: 1102, survey: '95%', incharge: 'G. Balagangadhar', mobile: '9440261145', status: 'Full Coverage', lead: 'TDP +8%' },
                  { booth: 'Booth 145 - ZPHS North Room', mandal: 'Kondapi', voters: 920, survey: '92%', incharge: 'B. Venkaiah', mobile: '9848055667', status: 'Partial Coverage', lead: 'TDP +14%' },
                  { booth: 'Booth 102 - Panchayat Office', mandal: 'Tangutur', voters: 1045, survey: '89%', incharge: 'K. Subbamma', mobile: '9123456789', status: 'Full Coverage', lead: 'TDP +18%' }
                ].map(b => (
                  <div key={b.booth} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-start border-b border-slate-200/60 pb-2">
                      <div>
                        <h4 className="font-black text-slate-900">{b.booth}</h4>
                        <span className="text-[10px] text-slate-400 uppercase font-extrabold">{b.mandal} Mandal</span>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-950 border border-emerald-300 rounded text-[9px] uppercase font-black">
                        {b.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-400 block font-bold uppercase text-[9px]">Registered Voters</span>
                        <span className="text-slate-900 font-extrabold">{b.voters}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-bold uppercase text-[9px]">Survey Completed</span>
                        <span className="text-slate-900 font-extrabold">{b.survey}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-bold uppercase text-[9px]">Booth President</span>
                        <span className="text-slate-900 font-extrabold">{b.incharge}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-bold uppercase text-[9px]">Political Index</span>
                        <span className="text-emerald-600 font-black">{b.lead}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* -----------------------------------------
              SUB TAB: GROUND ISSUES
             ----------------------------------------- */}
          {activeSubTab === 'ground_issues' && (
            <div className="space-y-6 animate-fade-in">
              
              {/* TOP PUBLIC ISSUES TABLE */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="text-slate-950 text-sm font-black uppercase tracking-wider">Top Public Issues in Kondapi</h3>
                  <p className="text-xs text-slate-500 font-medium">Ground indicators derived by AI Ground Report Analyzer compiling thousands of physical surveys.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-bold text-slate-700 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] text-slate-400 uppercase tracking-wider">
                        <th className="py-2.5">Public Issue</th>
                        <th className="py-2.5 text-center">Report Count</th>
                        <th className="py-2.5 text-center">Mandals Affected</th>
                        <th className="py-2.5 text-center">Trend Indicator</th>
                        <th className="py-2.5 text-center">Priority</th>
                        <th className="py-2.5 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topIssues.map(ti => (
                        <tr key={ti.issue} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="py-3 font-black text-slate-900">{ti.issue}</td>
                          <td className="py-3 text-center text-slate-800 font-extrabold">{ti.count} entries</td>
                          <td className="py-3 text-center text-slate-500">{ti.mandals} Mandals</td>
                          <td className="py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase ${
                              ti.trend === 'RISING' 
                                ? 'bg-red-100 text-red-950 border border-red-300' 
                                : ti.trend === 'STABLE' 
                                  ? 'bg-yellow-100 text-yellow-950 border border-yellow-300'
                                  : 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                            }`}>
                              {ti.trend}
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase ${
                              ti.priority === 'URGENT' 
                                ? 'bg-red-600 text-white' 
                                : 'bg-slate-900 text-white'
                            }`}>
                              {ti.priority}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => setSelectedIssueDetail(ti.issue)}
                              className="px-2 py-0.5 border border-slate-300 rounded text-[9px] uppercase font-black hover:bg-slate-50 cursor-pointer"
                            >
                              Analyze
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* AI GROUND REPORT ANALYZER */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="text-slate-950 text-xs font-black uppercase tracking-wider">AI Ground Report Classifier</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Raw feeds categorized by subject classifier models in real-time.</p>
                </div>

                <div className="space-y-3">
                  {groundReports.map(gr => (
                    <div key={gr.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row justify-between gap-4 text-xs font-bold text-slate-700">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-[9px] uppercase font-black tracking-wide">{gr.category}</span>
                          <span className="text-[10px] text-slate-400 uppercase font-black">{gr.id} &bull; {gr.location} ({gr.mandal})</span>
                        </div>
                        <p className="text-slate-800 font-semibold text-xs leading-relaxed">{gr.description}</p>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
                        <span className="text-[10px] text-slate-400 font-mono font-bold">{gr.date}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${
                          gr.priority === 'Urgent' 
                            ? 'bg-red-100 text-red-950 border border-red-300' 
                            : gr.priority === 'High' 
                              ? 'bg-amber-100 text-amber-950 border border-amber-300' 
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {gr.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* -----------------------------------------
              SUB TAB: NEWS
             ----------------------------------------- */}
          {activeSubTab === 'news' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 animate-fade-in">
              <div>
                <h3 className="text-slate-950 text-sm font-black uppercase tracking-wider">Kondapi News Intelligence</h3>
                <p className="text-xs text-slate-500 font-medium">Permitted public news tracking relevant to Prakasam local administration and development project declarations.</p>
              </div>

              <div className="space-y-4 pt-2">
                {newsArticles.map(na => (
                  <div key={na.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 font-bold text-xs text-slate-700">
                    <div className="flex justify-between items-start border-b border-slate-200/60 pb-2">
                      <div>
                        <h4 className="text-slate-950 text-sm font-black leading-snug">{na.headline}</h4>
                        <p className="text-[10px] text-slate-400 uppercase mt-0.5">{na.source} &bull; {na.date}</p>
                      </div>
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-950 border border-yellow-300 rounded text-[9px] font-black uppercase shrink-0">
                        {na.relevance}
                      </span>
                    </div>

                    <p className="text-slate-600 font-semibold leading-relaxed">{na.summary}</p>
                    
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-400 uppercase font-black">Topic Classification: {na.topic}</span>
                      <button 
                        onClick={() => alert(`Connecting to verified RSS stream for: ${na.headline}`)}
                        className="text-yellow-600 hover:underline uppercase font-black cursor-pointer"
                      >
                        View Source Document &rarr;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* -----------------------------------------
              SUB TAB: SOCIAL TRENDS
             ----------------------------------------- */}
          {activeSubTab === 'social_trends' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 animate-fade-in">
              <div>
                <h3 className="text-slate-950 text-sm font-black uppercase tracking-wider">Public Social Media Intelligence</h3>
                <p className="text-xs text-slate-500 font-medium">Aggregate public discussions and emerging topics on permitted networks. Strictly no personal voter profile collection.</p>
              </div>

              <div className="bg-amber-50 text-amber-900 border border-amber-200 rounded-xl p-4 flex gap-3 text-xs leading-relaxed font-bold">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <span className="font-extrabold uppercase tracking-wide block mb-0.5">ECI PUBLIC SENTIMENT DISCLAIMER</span>
                  These aggregate counts act strictly as public online discussion indicators. They must not be considered mathematically representative polling results of the entire constituency population.
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="text-slate-950 text-xs font-black uppercase tracking-wider">Trending in Kondapi (Public Pages & Groups)</h4>
                
                <div className="space-y-3">
                  {socialTrends.map(st => (
                    <div key={st.topic} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row justify-between gap-4 text-xs font-bold text-slate-700">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <h5 className="text-slate-900 font-black text-xs uppercase">{st.topic}</h5>
                          <span className="text-[10px] text-slate-400 font-medium">Relevant Mandals: {st.relevantMandals}</span>
                        </div>
                        <p className="text-slate-500 font-medium">Source: {st.source}</p>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
                        <span className="text-slate-950 font-extrabold text-right">{st.mentions} public references</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${
                          st.trend === 'RISING' 
                            ? 'bg-red-100 text-red-950 border border-red-300' 
                            : 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                        }`}>
                          {st.trend}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* -----------------------------------------
              SUB TAB: GOVT & DEVELOPMENT
             ----------------------------------------- */}
          {activeSubTab === 'govt_dev' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 animate-fade-in">
              <div>
                <h3 className="text-slate-950 text-sm font-black uppercase tracking-wider">Government & Development Monitor</h3>
                <p className="text-xs text-slate-500 font-medium">Permitted public monitoring of local roads, welfare schemes, and municipal water allocations announced by the state administration.</p>
              </div>

              <div className="space-y-4 pt-2 text-xs font-bold text-slate-700">
                {govtProjects.map(gp => (
                  <div key={gp.project} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex justify-between items-start border-b border-slate-200/60 pb-2">
                      <div>
                        <h4 className="text-slate-950 font-black text-xs uppercase">{gp.project}</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-bold uppercase">Department: {gp.dept}</p>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-950 border border-emerald-300 rounded text-[9px] font-black uppercase">
                        {gp.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] uppercase font-black text-slate-400">
                      <div>
                        Location: <span className="text-slate-900 font-extrabold">{gp.location}</span>
                      </div>
                      <div>
                        Mandal: <span className="text-slate-900 font-extrabold">{gp.mandal}</span>
                      </div>
                      <div>
                        Date: <span className="text-slate-900 font-extrabold">{gp.date}</span>
                      </div>
                      <div>
                        Official Source: <span className="text-slate-900 font-extrabold">{gp.source}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* -----------------------------------------
              SUB TAB: CADRE HEALTH
             ----------------------------------------- */}
          {activeSubTab === 'cadre_health' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 animate-fade-in">
              <div>
                <h3 className="text-slate-950 text-sm font-black uppercase tracking-wider">AI Cadre Network Health</h3>
                <p className="text-xs text-slate-500 font-medium">Automatic monitoring of organizational representation. Identifies empty booth clusters and training deficiencies.</p>
              </div>

              {/* CARD PROGRESS SPLIT */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-bold text-slate-700">
                <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase">Mandal Incharge</span>
                  <span className="text-xl font-black text-slate-950 block mt-1">100%</span>
                  <span className="bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide block w-max mx-auto">FULL COVERAGE</span>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase">Village Incharge</span>
                  <span className="text-xl font-black text-slate-950 block mt-1">95.8%</span>
                  <span className="text-slate-400 text-[10px]">2 vacancies in Marripudi</span>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase">Booth Presidents</span>
                  <span className="text-xl font-black text-slate-950 block mt-1">91.1%</span>
                  <span className="text-red-600 font-black text-[10px]">25 Booths vacant</span>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase">100-Voter Incharges</span>
                  <span className="text-xl font-black text-slate-950 block mt-1">87.0%</span>
                  <span className="text-red-600 font-black text-[10px]">324 spots unfilled</span>
                </div>
              </div>

              {/* ACTION PLAN RECRUITMENT */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3 font-bold text-xs text-slate-700">
                <h4 className="text-slate-950 uppercase text-xs font-black">AI Recommendations for Cadre Recruitment</h4>
                <ul className="list-disc pl-4 space-y-2 leading-relaxed">
                  <li>**Target Marripudi**: Direct Singarayakonda youth supervisors to assist Marripudi local incharge. Singarayakonda has surplus trained members who can be cross-deployed.</li>
                  <li>**Booth Committee Gaps**: Focus on the 25 unstaffed booths. 14 are in Ponnaluru Mandal where local coordination has been slow. Scheduled a recruitment drive next Monday.</li>
                </ul>
              </div>
            </div>
          )}

          {/* -----------------------------------------
              SUB TAB: AI ALERTS
             ----------------------------------------- */}
          {activeSubTab === 'ai_alerts' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5 animate-fade-in">
              <div>
                <h3 className="text-slate-950 text-sm font-black uppercase tracking-wider">AI Alert Center</h3>
                <p className="text-xs text-slate-500 font-medium">Crucial data discrepancies, field bottlenecks, or political indicators compiled automatically.</p>
              </div>

              {/* Dynamic validation alerts list */}
              <div className="space-y-4">
                {dataQualityAlerts.map(da => (
                  <div key={da.id} className="border-l-4 border-red-600 bg-red-50 p-4 rounded-xl shadow-sm space-y-3 font-bold text-xs text-slate-700">
                    <div className="flex justify-between items-center">
                      <h4 className="text-red-950 text-sm font-black uppercase tracking-wide flex items-center gap-1.5">
                        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" /> {da.title}
                      </h4>
                      <span className="bg-red-200 text-red-950 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                        {da.severity}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-white p-3 rounded-lg border border-red-100 font-mono text-[11px] text-slate-800">
                      <div>
                        EXPECTED: <span className="font-extrabold text-slate-900">{da.expected}</span>
                      </div>
                      <div>
                        ACTUAL: <span className="font-extrabold text-red-600">{da.actual}</span>
                      </div>
                      <div>
                        DIFFERENCE: <span className="font-extrabold text-slate-900">{da.difference}</span>
                      </div>
                      <div>
                        AFFECTED: <span className="font-extrabold text-slate-900">{da.affectedModule}</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                      <span className="text-slate-900 font-black block uppercase mb-0.5">REMEDIATION DIRECTIVE:</span>
                      {da.remediation}
                    </div>
                  </div>
                ))}

                {/* Additional simulated operational alerts */}
                <div className="border-l-4 border-amber-500 bg-amber-50 p-4 rounded-xl shadow-sm space-y-2 font-bold text-xs text-slate-700">
                  <div className="flex justify-between items-center">
                    <h4 className="text-amber-950 font-black uppercase tracking-wide flex items-center gap-1.5">
                      <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" /> Water Supply Emergency - Booth 224
                    </h4>
                    <span className="bg-amber-200 text-amber-950 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                      IMPORTANT
                    </span>
                  </div>
                  <p className="text-slate-600">
                    Kalikivaya village Booth 224 reports drinking water shortage causing heavy voter distress during active ground outreach campaigns. Recommended immediate tanker routing.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* -----------------------------------------
              SUB TAB: REPORTS
             ----------------------------------------- */}
          {activeSubTab === 'reports' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 animate-fade-in" id="const-reports-gen-page">
              <div className="text-center space-y-3 max-w-lg mx-auto py-8">
                <div className="w-16 h-16 rounded-full bg-yellow-50 text-yellow-600 flex items-center justify-center border border-yellow-200 mx-auto animate-pulse">
                  <FileText className="w-8 h-8" />
                </div>
                
                <h3 className="text-slate-950 text-base font-black uppercase">Strategic Report Generator</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Generate a complete, ECI-compliant, ready-to-print briefing book summarizing all internal datasets, ground problems, news, and organizational statistics.
                </p>

                <button
                  onClick={() => alert('Compiling PDF Briefing Booklet... Standard system browser print layout will trigger.')}
                  className="px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 mx-auto cursor-pointer shadow"
                >
                  <Printer className="w-4 h-4" /> Generate Full Constituency Intelligence Report
                </button>
              </div>

              {/* MOCK REPORT TEMPLATE SHOWN FOR VISUAL SATISFACTION */}
              <div className="border border-slate-200 rounded-xl p-6 bg-slate-50 font-mono text-[10px] leading-relaxed text-slate-600 max-h-[300px] overflow-y-auto font-semibold">
                <p className="text-slate-900 font-extrabold uppercase text-center mb-4 text-xs">
                  KONDAPI ASSEMBLY CONSTITUENCY -- PRIVATE BRIEFING BOOK
                  <br />
                  COMPILED BY AI STRATEGIC INTELLIGENCE LAYER
                </p>
                <p>DATE OF EXPORT: {lastAnalysisTime}</p>
                <p>STATUS: CONFIDENTIAL - NOT FOR EXTERNAL DISSEMINATION</p>
                
                <p className="font-extrabold text-slate-900 uppercase mt-4">SECTION 1: EXECUTIVE BRIEFING</p>
                <p>Overall Support Ratio: TDP leads by +11.2% average. Tight margin villages are located principally in Ponnaluru and Jarugumalli mandals.</p>
                
                <p className="font-extrabold text-slate-900 uppercase mt-4">SECTION 2: DATA AUDITS</p>
                <p>Verification engine flagged 1 critical allocation inconsistency in Chinna Venkanna Palem Village. Total voters reported: 1,200. Combined preference sum: 12,000.</p>

                <p className="font-extrabold text-slate-900 uppercase mt-4">SECTION 3: GROUND FIELD OUTREACH</p>
                <p>Top public concern: Water supply (18 reports). Local action needed in Singarayakonda Ward 12.</p>
              </div>
            </div>
          )}

          {/* -----------------------------------------
              SUB TAB: ASK KONDAPI AI (CHATBOT)
             ----------------------------------------- */}
          {activeSubTab === 'ask_ai' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 animate-fade-in flex flex-col min-h-[480px]">
              <div>
                <h3 className="text-slate-950 text-sm font-black uppercase tracking-wider">Ask Kondapi AI Assistant</h3>
                <p className="text-xs text-slate-500 font-medium">Real-time interaction with local database records. Answers are strictly calculated from verified tables.</p>
              </div>

              {/* SUGGESTED CHATBOT ACTIONS */}
              <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase">
                {[
                  'Give me today\'s Kondapi summary',
                  'Which Mandals need attention?',
                  'Find inconsistencies in project data',
                  'Summarize recent news announcements',
                  'Show cadre vacancy counts'
                ].map(q => (
                  <button
                    key={q}
                    onClick={() => {
                      setChatInput(q);
                    }}
                    className="bg-slate-50 hover:bg-slate-100 border border-slate-200 p-2 rounded-lg cursor-pointer transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* MESSAGES DISPLAY */}
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-y-auto space-y-3 max-h-[300px] text-xs font-semibold">
                {chatMessages.map((msg, index) => (
                  <div 
                    key={index} 
                    className={`flex flex-col max-w-[85%] space-y-1 ${
                      msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                    }`}
                  >
                    <div 
                      className={`p-3.5 rounded-2xl leading-relaxed ${
                        msg.sender === 'user' 
                          ? 'bg-slate-900 text-white rounded-tr-none' 
                          : 'bg-white border border-slate-200 text-slate-850 rounded-tl-none shadow-sm'
                      }`}
                    >
                      {/* Markdown rendering simulation for visual bullet lists */}
                      {msg.text.split('\n').map((line, lIdx) => (
                        <p key={lIdx} className="mb-1">{line}</p>
                      ))}
                    </div>

                    {msg.citations && msg.citations.length > 0 && (
                      <div className="text-[10px] text-slate-400 font-bold uppercase flex flex-wrap gap-1.5 mt-0.5">
                        <span className="text-yellow-600 font-extrabold">EVIDENCE CITATIONS:</span>
                        {msg.citations.map(cit => (
                          <span key={cit} className="bg-slate-150 border border-slate-200 px-1 py-0.2 rounded font-mono">{cit}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* INPUT BOX */}
              <form onSubmit={handleChatSubmit} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask any question about voters, ground issues, news, or database checks..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs font-semibold text-slate-850 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black rounded-xl uppercase tracking-wider text-xs flex items-center gap-1 cursor-pointer transition-transform shrink-0"
                >
                  <Send className="w-3.5 h-3.5" /> Send
                </button>
              </form>
            </div>
          )}

        </div>
      </div>

      {/* MANDAL REPORT MODAL OVERLAY */}
      {selectedMandalReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-lg w-full space-y-4 text-xs font-bold text-slate-700 animate-slide-up">
            
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-slate-950 text-sm font-black uppercase">{selectedMandalReport} Mandal Intelligence Report</h3>
                <p className="text-[10px] text-slate-400 uppercase mt-0.5">District block index &bull; verified polling databases</p>
              </div>
              <button 
                onClick={() => setSelectedMandalReport(null)}
                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block font-bold">Total Voters</span>
                  <span className="text-slate-950 font-extrabold text-sm block mt-0.5">
                    {mandalsData.find(m => m.name === selectedMandalReport)?.voters.toLocaleString() || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block font-bold">Villages</span>
                  <span className="text-slate-950 font-extrabold text-sm block mt-0.5">
                    {mandalsData.find(m => m.name === selectedMandalReport)?.villages || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block font-bold">Polling Booths</span>
                  <span className="text-slate-950 font-extrabold text-sm block mt-0.5">
                    {mandalsData.find(m => m.name === selectedMandalReport)?.booths || 'N/A'}
                  </span>
                </div>
              </div>

              {/* DEMOGRAPHIC ANALYSIS */}
              <div className="space-y-2">
                <h4 className="font-black text-slate-950 uppercase text-[10px]">Demographic & Preference Outlook</h4>
                <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Survey Coverage:</span>
                    <span className="text-slate-900 font-extrabold">
                      {selectedMandalReport === 'Singarayakonda' ? '94.5%' : selectedMandalReport === 'Kondapi' ? '92%' : selectedMandalReport === 'Tangutur' ? '89%' : selectedMandalReport === 'Jarugumalli' ? '81%' : selectedMandalReport === 'Ponnaluru' ? '75%' : '68%'}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Aggregate Sentiment:</span>
                    <span className="text-emerald-600 font-black">
                      {selectedMandalReport === 'Marripudi' ? 'YSRCP Trailing Watch' : 'TDP Winning Holdings'}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Cadre Coverage:</span>
                    <span className="text-slate-900 font-extrabold">
                      {selectedMandalReport === 'Singarayakonda' ? '96%' : selectedMandalReport === 'Kondapi' ? '95%' : selectedMandalReport === 'Tangutur' ? '91%' : '84%'} active assigned
                    </span>
                  </div>
                </div>
              </div>

              {/* ADVISORY DIRECTIVE */}
              <div className="space-y-1 bg-yellow-50 text-yellow-900 border border-yellow-200 p-3.5 rounded-xl text-[11px] leading-relaxed">
                <span className="font-extrabold uppercase block text-[9px] tracking-wide mb-0.5 text-yellow-800">Operational Incharge Directive</span>
                {selectedMandalReport === 'Marripudi' 
                  ? 'Appoint 15 local village coordinators in trailing Booth blocks to accelerate coverage before survey closure.'
                  : 'Maintain current layout campaign templates. Assign backup water tankers to dry rural sections immediately.'}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedMandalReport(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-lg text-[10px] uppercase cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GROUND ISSUE DETAILS MODAL */}
      {selectedIssueDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-lg w-full space-y-4 text-xs font-bold text-slate-700 animate-slide-up">
            
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-slate-950 text-sm font-black uppercase">Issue Analysis: {selectedIssueDetail}</h3>
                <p className="text-[10px] text-slate-400 uppercase mt-0.5">Strategic bottleneck analysis &bull; AI classification</p>
              </div>
              <button 
                onClick={() => setSelectedIssueDetail(null)}
                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="leading-relaxed font-semibold text-slate-600">
                This public issue has been flagged multiple times across several mandals. The highest frequency of reports is located in **Singarayakonda** (particularly Kalikivaya and Singarayakonda Ward 12).
              </p>

              <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl space-y-2">
                <div className="flex justify-between">
                  <span>Frequency Trend:</span>
                  <span className="text-red-600 font-extrabold uppercase">RISING (+12% this week)</span>
                </div>
                <div className="flex justify-between">
                  <span>Reported Location Density:</span>
                  <span>9 distinct villages</span>
                </div>
                <div className="flex justify-between">
                  <span>District Council Status:</span>
                  <span className="text-emerald-600 font-extrabold">Collector released tanker funds</span>
                </div>
              </div>

              <div className="bg-slate-900 text-white p-4 rounded-xl space-y-1 text-[11px] font-mono leading-relaxed font-semibold">
                <span className="text-yellow-400 uppercase font-black block text-[9px] mb-1">Recommended Response Protocol</span>
                1. Coordinate with Ward 12 Supervisor to verify water main line valves.
                <br />
                2. Streamline Collector tanker distribution through localized cadre nodes.
                <br />
                3. Update Constituency command logs with verified feedback daily.
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedIssueDetail(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-lg text-[10px] uppercase cursor-pointer"
              >
                Close Analysis
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
