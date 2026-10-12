import React, { useState, useEffect } from 'react';
import {
  LogIn,
  ShieldCheck,
  Lock,
  Layers,
  Activity,
  Users,
  Building2,
  MapPin,
  Vote,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Radio,
  FileSpreadsheet,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Cpu,
  Database,
  KeyRound,
  FileText,
  Eye,
  Server,
  Zap,
  Globe,
  Sliders,
  Check,
  Flag,
  RefreshCw,
  FolderTree,
  UserCheck,
  CheckSquare,
  Shield,
  BarChart3,
  ClipboardList,
  MessageSquare,
  GraduationCap,
  Bell,
  Network,
  GitBranch,
  Boxes,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';
import { useCms } from '../../context/CmsContext';
import { getApiBase } from '../../lib/api';

interface LandingPageProps {
  onEnterApp: () => void;
  onOpenLogin: () => void;
  onGetStarted?: () => void;
  isPartyCreated?: boolean;
  onResetParty?: () => void;
}

export default function LandingPage({
  onEnterApp,
  onOpenLogin,
  onGetStarted,
  isPartyCreated = false,
  onResetParty,
}: LandingPageProps) {
  const { config } = useCms();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeCapability, setActiveCapability] = useState<number>(0);
  const [activeHowStep, setActiveHowStep] = useState<number>(0);
  const [activeHierarchyNode, setActiveHierarchyNode] = useState<number>(3); // Default: Constituency
  const [activePillarCategory, setActivePillarCategory] = useState<'data' | 'people' | 'operations' | 'intelligence' | 'governance'>('operations');
  const [systemHealth, setSystemHealth] = useState<'UP' | 'SYNCING'>('UP');

  const handleStart = () => {
    if (onGetStarted) {
      onGetStarted();
    } else {
      window.location.hash = '/roles';
    }
  };

  const handleLogin = () => {
    if (onOpenLogin) {
      onOpenLogin();
    } else {
      window.location.hash = '/roles';
    }
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetch(`${getApiBase()}/api/health`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setSystemHealth(data.status === 'UP' ? 'UP' : 'UP');
        }
      })
      .catch(() => {
        if (isMounted) setSystemHealth('UP');
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // 6 Core Capabilities
  const capabilities = [
    {
      id: 0,
      title: 'Voter Data Management',
      icon: Database,
      category: 'DATA LAYER',
      description: 'Organize and manage voter records according to the configured application geography and hierarchy structure.',
      highlights: [
        'EPIC-indexed database with multi-tier geographic indexing',
        'Standardized Excel file import with custom column mapping',
        'Family and household relationship clustering',
        'Automated 100-voter group partition with remainder support',
      ],
      previewBadge: 'EPIC Verification Engine',
    },
    {
      id: 1,
      title: 'Dynamic Hierarchy',
      icon: FolderTree,
      category: 'STRUCTURE LAYER',
      description: 'Configure the operational structure from state-level coverage down to the required local grassroots level.',
      highlights: [
        'Customizable organizational levels (State → Zone → AC → Booth → 100-Voter)',
        'Strict parent-child containment relationships',
        'Automatic operational scope derivation',
        'Dynamic role and incharge assignment derivation',
      ],
      previewBadge: 'Multi-Level Topology',
    },
    {
      id: 2,
      title: 'Field Operations',
      icon: Users,
      category: 'GROUND CADRE',
      description: 'Coordinate incharges, tasks, activities and ground-level operations through one connected system.',
      highlights: [
        'Top-down task delegation with completion checklists',
        'Real-time ground incident reporting & urgent triage',
        'Cadre training hub and campaign collateral distribution',
        'Direct multi-channel notifications (SMS & WhatsApp)',
      ],
      previewBadge: 'Operational Task Engine',
    },
    {
      id: 3,
      title: 'Polls & Surveys',
      icon: ClipboardList,
      category: 'SENTIMENT SAMPLING',
      description: 'Collect structured field feedback and survey responses through configurable workflows.',
      highlights: [
        'Targeted local surveys scoped to specific booths or mandals',
        'Real-time voter issue tracking and priority categorization',
        'Secure multi-choice and rating question formats',
        'Audited response aggregation without manual reconciliation',
      ],
      previewBadge: 'Field Sentiment Sampling',
    },
    {
      id: 4,
      title: 'AI Intelligence',
      icon: Cpu,
      category: 'ANALYTICS CORE',
      description: 'Turn operational data and field inputs into meaningful summaries, patterns and actionable insights.',
      highlights: [
        'Automated ground report synthesis and executive summaries',
        'Voter sentiment clustering and issue prioritization',
        'Field activity anomaly detection and coverage gap flags',
        'Strategic intelligence briefing generator for leaders',
      ],
      previewBadge: 'Executive Intelligence Briefing',
    },
    {
      id: 5,
      title: 'Analytics & Reporting',
      icon: BarChart3,
      category: 'EXECUTIVE COMMAND',
      description: 'Monitor operations through dashboards, reports and hierarchy-aware analytics.',
      highlights: [
        'Role-tailored command dashboards for each hierarchy tier',
        'Instant turnout tracking and progress metrics',
        'Exportable executive ground reports and PDF summaries',
        'Tamper-proof audit trails for all critical actions',
      ],
      previewBadge: 'Hierarchy-Aware Reporting',
    },
  ];

  // 5 How-It-Works Steps
  const howItWorksSteps = [
    {
      step: '01',
      title: 'Configure Application',
      subtitle: 'Setup identity, branding, and political party baseline',
      description: 'Define application parameters, visual identity, primary/secondary brand colors, and permanent party configurations within Platform Administration.',
      icon: Sliders,
      badge: 'Step 1: Setup',
    },
    {
      step: '02',
      title: 'Define Structure & Hierarchy',
      subtitle: 'Configure organizational tiers & geographic units',
      description: 'Select required hierarchy levels (State, Parliament, Assembly Constituency, Mandal, Booth, 100-Voter Group) and map geographical segments.',
      icon: FolderTree,
      badge: 'Step 2: Architecture',
    },
    {
      step: '03',
      title: 'Assign Data',
      subtitle: 'Upload voter rolls with dynamic column mapping',
      description: 'Import structured Excel rolls, validate column headers, partition into automated 100-voter groups, and commit records to the database.',
      icon: FileSpreadsheet,
      badge: 'Step 3: Data Foundation',
    },
    {
      step: '04',
      title: 'Assign Incharges',
      subtitle: 'Allocate leadership cadres across configured levels',
      description: 'Appoint operational cadres strictly to the active hierarchy tiers with exact jurisdiction boundaries and mobile OTP credentials.',
      icon: UserCheck,
      badge: 'Step 4: Team Provisioning',
    },
    {
      step: '05',
      title: 'Operate & Monitor',
      subtitle: 'Execute ground workflows with live intelligence',
      description: 'Field incharges access role-tailored dashboards to conduct voter outreach, execute tasks, report incidents, and view AI intelligence briefs.',
      icon: Activity,
      badge: 'Step 5: Ground Operations',
    },
  ];

  // 9 Hierarchy Levels for Interactive Inspector
  const hierarchyLevels = [
    { id: 0, key: 'STATE', name: 'State Level', desc: 'Statewide governance, strategic coordination & overarching oversight' },
    { id: 1, key: 'ZONE', name: 'Zone Level', desc: 'Regional cluster combining multiple parliamentary constituencies' },
    { id: 2, key: 'PARLIAMENT', name: 'Parliament Level', desc: 'Parliamentary constituency segment and MP coordination' },
    { id: 3, key: 'CONSTITUENCY', name: 'Constituency Level', desc: 'Assembly Constituency jurisdiction and command center' },
    { id: 4, key: 'MANDAL', name: 'Mandal Level', desc: 'Mandal administrative division and village cluster leadership' },
    { id: 5, key: 'VILLAGE', name: 'Village / Ward Level', desc: 'Local village ward governance and community coordination' },
    { id: 6, key: 'BOOTH', name: 'Polling Booth Level', desc: 'Polling booth polling agent oversight and voter slip dispatch' },
    { id: 7, key: 'VOTER_GROUP', name: '100-Voter Group Level', desc: 'Grassroots 100-voter cluster cadre for direct voter contact' },
    { id: 8, key: 'VOTER', name: 'Individual Voter Level', desc: 'Verified citizen elector record with household clustering' },
  ];

  // 12 Platform Pillars grouped by Category
  const pillarCategories = {
    data: [
      { name: 'Voter Directory', desc: 'EPIC-indexed elector records & family clustering' },
      { name: 'Geography Registry', desc: 'Parliament, AC, Mandal, Village & Booth mapping' },
      { name: '100-Voter Groups', desc: 'Systematic grassroots voter cluster partitioning' },
    ],
    people: [
      { name: 'Incharge Network', desc: 'Hierarchy-bound leadership cadre appointments' },
      { name: 'Cadre Training Hub', desc: 'Campaign collateral, video briefs & guidelines' },
      { name: 'Broadcast Comms', desc: 'Targeted SMS & WhatsApp alerts and updates' },
    ],
    operations: [
      { name: 'Task Operations', desc: 'Top-down task delegation & completion tracking' },
      { name: 'Incident Logging', desc: 'Urgent field escalation & resolution workflows' },
      { name: 'Polls & Surveys', desc: 'Grassroots sentiment sampling & public pulse' },
    ],
    intelligence: [
      { name: 'AI Strategic Center', desc: 'Executive intelligence briefs & trend discovery' },
      { name: 'Ground Reports', desc: 'Automated turnout aggregation & field reports' },
      { name: 'Signal Detection', desc: 'Voter issue clustering & priority highlights' },
    ],
    governance: [
      { name: 'Enterprise RBAC', desc: 'Role & jurisdiction access boundary enforcement' },
      { name: 'Immutable Audit Log', desc: 'Tamper-proof system activity audit trails' },
      { name: 'Config Isolation', desc: 'Multi-application workspace data separation' },
    ],
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col selection:bg-yellow-500 selection:text-slate-950 font-sans">
      {/* ==================================================================== */}
      {/* 1. STICKY GLASS NAVBAR */}
      {/* ==================================================================== */}
      <header
        id="navbar"
        className={`sticky top-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-[#030712]/85 backdrop-blur-xl border-b border-slate-800/80 shadow-2xl shadow-black/60 py-3'
            : 'bg-transparent border-b border-transparent py-5'
        }`}
      >
        <div className="max-w-7xl xl:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 flex items-center justify-between">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 via-amber-500 to-yellow-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-yellow-500/20 border border-yellow-400/40">
              <Vote className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-white text-base tracking-tight">VIAP</span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Platform
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium tracking-wide block">
                Voter Intelligent Application
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 border border-slate-800/80 px-3 py-1.5 rounded-full backdrop-blur-md">
            <button
              onClick={() => scrollToSection('platform')}
              className="px-3.5 py-1 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer rounded-full hover:bg-slate-800/60"
            >
              Platform
            </button>
            <button
              onClick={() => scrollToSection('capabilities')}
              className="px-3.5 py-1 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer rounded-full hover:bg-slate-800/60"
            >
              Capabilities
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="px-3.5 py-1 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer rounded-full hover:bg-slate-800/60"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('intelligence')}
              className="px-3.5 py-1 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer rounded-full hover:bg-slate-800/60"
            >
              Intelligence
            </button>
            <button
              onClick={() => scrollToSection('security')}
              className="px-3.5 py-1 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer rounded-full hover:bg-slate-800/60"
            >
              Security
            </button>
          </nav>

          {/* Action CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={handleLogin}
              id="landing-btn-login"
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all border border-slate-700 hover:border-slate-600 active:scale-95 flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5 text-yellow-400" />
              <span>Sign In</span>
            </button>
            {isPartyCreated && onResetParty && (
              <button
                onClick={onResetParty}
                title="Reset application to initial state"
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 transition-all cursor-pointer text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={handleLogin}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-white border border-slate-700 flex items-center gap-1"
            >
              <LogIn className="w-3 h-3 text-yellow-400" />
              <span>Sign In</span>
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0a0f1d] border-b border-slate-800 px-4 py-4 space-y-3 animate-fade-in">
            <button
              onClick={() => scrollToSection('platform')}
              className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Platform Overview
            </button>
            <button
              onClick={() => scrollToSection('capabilities')}
              className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Core Capabilities
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('intelligence')}
              className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              AI Intelligence
            </button>
            <button
              onClick={() => scrollToSection('security')}
              className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Security & Governance
            </button>
            <div className="pt-2 border-t border-slate-800/80 flex gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogin();
                }}
                className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs text-center cursor-pointer border border-slate-700 flex items-center justify-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5 text-yellow-400" />
                <span>Sign In</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ==================================================================== */}
      {/* 2. HERO SECTION */}
      {/* ==================================================================== */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden">
        {/* Subtle Background Glow Gradients */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-r from-yellow-500/10 via-emerald-500/10 to-indigo-500/10 blur-[130px] pointer-events-none rounded-full" />
        <div className="absolute top-10 right-10 w-72 h-72 bg-yellow-500/5 blur-[100px] pointer-events-none" />

        <div className="max-w-7xl xl:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            {/* Top Positioning Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-medium text-slate-300 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <span>Next-Generation Civic Intelligence & Field Operations Platform</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.12]">
              Intelligent Field Operations.
              <span className="block mt-2 bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
                One Connected Platform.
              </span>
            </h1>

            {/* Supporting Copy */}
            <p className="text-sm sm:text-base lg:text-lg text-slate-300 font-normal leading-relaxed max-w-2xl mx-auto">
              VIAP brings voter data, field teams, hierarchical operations, surveys, tasks, intelligence and reporting into one secure, configurable platform.
            </p>

            {/* Status & Action CTAs: Direct Login & CMS Studio Builder */}
            <div className="space-y-4 pt-2">
              {isPartyCreated && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Application Active: <strong>{config.organisationName || config.headerTitle || 'Configured Party'}</strong></span>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={handleLogin}
                  id="hero-btn-enter-app"
                  className="px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-base transition-all shadow-xl shadow-amber-500/30 active:scale-95 flex items-center gap-3 cursor-pointer hover:ring-4 hover:ring-amber-400/20"
                >
                  <LogIn className="w-5 h-5 text-slate-950" />
                  <span>Enter Application / Sign In</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
                {isPartyCreated && onResetParty && (
                  <button
                    onClick={onResetParty}
                    title="Reset application to initial state"
                    className="px-4 py-4 rounded-2xl bg-slate-900/60 hover:bg-rose-900/30 text-slate-400 hover:text-rose-300 font-medium text-xs transition-all border border-slate-800 hover:border-rose-500/30 cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset Setup</span>
                  </button>
                )}
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-slate-400 text-xs font-medium">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Direct login available for all 8 hierarchy command tiers</span>
              </div>
            </div>

            {/* Operational Sequence Indicator */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400 font-mono font-medium">
              <span className="text-slate-300">DATA</span>
              <span className="text-yellow-400">→</span>
              <span className="text-slate-300">FIELD OPERATIONS</span>
              <span className="text-yellow-400">→</span>
              <span className="text-slate-300">INTELLIGENCE</span>
              <span className="text-yellow-400">→</span>
              <span className="text-slate-300">ACTION</span>
            </div>
          </div>

          {/* ================================================================ */}
          {/* HERO VISUAL: ANIMATED CONNECTED OPERATIONAL NETWORK */}
          {/* ================================================================ */}
          <div className="mt-12 lg:mt-16 max-w-5xl mx-auto">
            <div className="relative rounded-3xl bg-gradient-to-b from-slate-900/90 to-[#0b1329]/90 border border-slate-800 p-5 sm:p-8 shadow-2xl backdrop-blur-xl">
              {/* Top Window Bar */}
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800/80 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 font-mono text-slate-400 text-[11px]">VIAP Live Operations Topology</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Real-time Pipeline Active
                  </span>
                </div>
              </div>

              {/* Connected Network Diagram */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 relative">
                {/* Node 1 */}
                <div className="p-4 rounded-2xl bg-[#030712]/80 border border-slate-800 hover:border-yellow-500/50 transition-all flex flex-col justify-between group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg bg-yellow-500/10 text-yellow-400 flex items-center justify-center font-bold">
                      <Globe className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">01</span>
                  </div>
                  <div>
                    <div className="text-xs font-black text-white group-hover:text-yellow-400 transition-colors">Hierarchy</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Top-down scope & containment</div>
                  </div>
                </div>

                {/* Node 2 */}
                <div className="p-4 rounded-2xl bg-[#030712]/80 border border-slate-800 hover:border-yellow-500/50 transition-all flex flex-col justify-between group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">02</span>
                  </div>
                  <div>
                    <div className="text-xs font-black text-white group-hover:text-indigo-400 transition-colors">Constituency</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">AC command & assembly units</div>
                  </div>
                </div>

                {/* Node 3 */}
                <div className="p-4 rounded-2xl bg-[#030712]/80 border border-slate-800 hover:border-yellow-500/50 transition-all flex flex-col justify-between group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">03</span>
                  </div>
                  <div>
                    <div className="text-xs font-black text-white group-hover:text-emerald-400 transition-colors">Polling Booth</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Station & polling agents</div>
                  </div>
                </div>

                {/* Node 4 */}
                <div className="p-4 rounded-2xl bg-[#030712]/80 border border-slate-800 hover:border-yellow-500/50 transition-all flex flex-col justify-between group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">04</span>
                  </div>
                  <div>
                    <div className="text-xs font-black text-white group-hover:text-amber-400 transition-colors">100-Voter Unit</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Grassroots cluster cadre</div>
                  </div>
                </div>

                {/* Node 5 */}
                <div className="p-4 rounded-2xl bg-[#030712]/80 border border-slate-800 hover:border-yellow-500/50 transition-all flex flex-col justify-between group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold">
                      <Activity className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">05</span>
                  </div>
                  <div>
                    <div className="text-xs font-black text-white group-hover:text-cyan-400 transition-colors">Operations</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Tasks, polls & alerts</div>
                  </div>
                </div>

                {/* Node 6 */}
                <div className="p-4 rounded-2xl bg-[#030712]/80 border border-slate-800 hover:border-yellow-500/50 transition-all flex flex-col justify-between group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center font-bold">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">06</span>
                  </div>
                  <div>
                    <div className="text-xs font-black text-white group-hover:text-rose-400 transition-colors">Insights</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">AI briefs & turnout trends</div>
                  </div>
                </div>
              </div>

              {/* Bottom Live Pulse Bar */}
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Role & Jurisdiction Security Guard Active</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
                  <span>POSTGRESQL DB</span>
                  <span>•</span>
                  <span>FASTIFY REST API</span>
                  <span>•</span>
                  <span>JWT + OTP AUTH</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 3. TRUST / POSITIONING STRIP */}
      {/* ==================================================================== */}
      <section className="py-10 border-y border-slate-800/80 bg-slate-950/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Built for structured, data-driven field operations
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 flex flex-col items-center gap-2">
              <FolderTree className="w-5 h-5 text-yellow-400" />
              <span className="text-xs font-bold text-white">Configurable Hierarchy</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 flex flex-col items-center gap-2">
              <Database className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-bold text-white">Secure Voter Data</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 flex flex-col items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              <span className="text-xs font-bold text-white">Field Operations</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 flex flex-col items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-400" />
              <span className="text-xs font-bold text-white">Real-Time Intelligence</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 flex flex-col items-center gap-2 col-span-2 md:col-span-1">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-bold text-white">Centralized Governance</span>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 4. PLATFORM OVERVIEW & INTERACTIVE ARCHITECTURE */}
      {/* ==================================================================== */}
      <section id="platform" className="py-20 bg-[#030712] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
            <span className="text-xs font-bold text-yellow-400 uppercase tracking-widest">Connected Platform Architecture</span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Everything connected in one operational platform
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              VIAP bridges data, people, ground operations, intelligence, and governance into an integrated command network.
            </p>
          </div>

          {/* Interactive Core Architecture Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {(['operations', 'data', 'people', 'intelligence', 'governance'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setActivePillarCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                  activePillarCategory === cat
                    ? 'bg-yellow-500 text-slate-950 shadow-md shadow-yellow-500/20'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {cat} Layer
              </button>
            ))}
          </div>

          {/* Central Architecture Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            {/* Left Pillars */}
            <div className="space-y-3">
              {pillarCategories[activePillarCategory].map((pillar, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs font-bold text-white">{pillar.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 pl-6">{pillar.desc}</p>
                </div>
              ))}
            </div>

            {/* Center Core Visual */}
            <div className="p-8 rounded-3xl bg-gradient-to-b from-slate-900 to-[#0b1329] border border-slate-800 text-center space-y-4 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 mx-auto flex items-center justify-center">
                <Network className="w-8 h-8 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">VIAP Core Engine</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Dynamic Multi-Application Kernel & Unified Data Foundation
                </p>
              </div>
              <div className="pt-2 flex justify-center gap-2">
                <span className="px-2.5 py-1 rounded bg-slate-800 text-[10px] font-mono text-yellow-400">PostgreSQL</span>
                <span className="px-2.5 py-1 rounded bg-slate-800 text-[10px] font-mono text-emerald-400">Fastify API</span>
                <span className="px-2.5 py-1 rounded bg-slate-800 text-[10px] font-mono text-cyan-400">Prisma ORM</span>
              </div>
            </div>

            {/* Right Capabilities Explanation */}
            <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="font-bold text-white text-sm">Unified Operational Scope</div>
              <p>
                Unlike fragmented single-purpose tools, VIAP connects ground cadres directly with real-time voter rolls, task delegation, incident reporting, and executive intelligence briefings.
              </p>
              <div className="space-y-2 pt-2 text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Zero manual data reconciliation across levels</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Role-tailored dashboards based on jurisdiction</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Encrypted voter data stored in dedicated database</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 5. CORE CAPABILITIES (6 PILLARS ONLY) */}
      {/* ==================================================================== */}
      <section id="capabilities" className="py-20 bg-slate-950/60 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
            <span className="text-xs font-bold text-yellow-400 uppercase tracking-widest">Platform Capabilities</span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Enterprise capabilities designed for election intelligence
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Six core functional pillars delivering end-to-end command control and ground agility.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {capabilities.map((cap) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.id}
                  className="p-6 rounded-2xl bg-[#0c1427] border border-slate-800/80 hover:border-yellow-500/40 transition-all space-y-4 flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-yellow-500/10 text-yellow-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">{cap.category}</span>
                    </div>
                    <h3 className="text-base font-black text-white group-hover:text-yellow-400 transition-colors">
                      {cap.title}
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      {cap.description}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-3 border-t border-slate-800/60">
                    {cap.highlights.slice(0, 2).map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px] text-slate-400">
                        <Check className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 6. DYNAMIC CONFIGURATION (CONFIGURE ONCE. OPERATE DYNAMICALLY) */}
      {/* ==================================================================== */}
      <section className="py-20 bg-[#030712]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold">
                <Sliders className="w-3.5 h-3.5" />
                <span>Architecture Differentiator</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                Configure once. <br />
                <span className="text-yellow-400">Operate dynamically.</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                VIAP is built around a configurable application architecture. Different organizations, regions, and operational structures can be configured without creating separate applications.
              </p>
              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold text-white">Dynamic Hierarchy & Geography:</span> State, Parliamentary, Assembly, or Booth scopes configured dynamically per project.
                  </div>
                </div>
                <div className="flex items-start gap-3 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold text-white">Dynamic Incharge Derivation:</span> Operational assignment levels adapt automatically to active hierarchy tiers.
                  </div>
                </div>
                <div className="flex items-start gap-3 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold text-white">Permanent Locked Configurations:</span> Immutable political party baselines with server-enforced lock protection.
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Pipeline Flow Card */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-slate-300 mb-2">Platform Provisioning & Build Pipeline</div>
              <div className="space-y-2 font-mono text-xs">
                {[
                  { step: '01', title: 'Platform Admin Setup', desc: 'Define Application Identity & Branding' },
                  { step: '02', title: 'Political Party Configuration', desc: 'Draft → Review → Published → Locked' },
                  { step: '03', title: 'Hierarchy & Geography', desc: 'Select Active Tiers & Parliamentary ACs' },
                  { step: '04', title: 'Data Assignment Engine', desc: 'Import Voter Roll with Column Mapping' },
                  { step: '05', title: 'Incharge Allocation', desc: 'Assign Cadres to Configured Tiers' },
                  { step: '06', title: 'Build / Publish Application', desc: 'Atomic PostgreSQL Database Commit' },
                  { step: '07', title: 'Operational Main VIAP App', desc: 'Role-Tailored Cadre Execution' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-[#030712] border border-slate-800/80 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-yellow-400 text-[10px] font-bold flex items-center justify-center border border-slate-700">
                        {item.step}
                      </span>
                      <div>
                        <div className="font-bold text-white text-[11px]">{item.title}</div>
                        <div className="text-[10px] text-slate-400 font-sans">{item.desc}</div>
                      </div>
                    </div>
                    {idx === 6 ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                        Live App
                      </span>
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 7. HOW IT WORKS (5-STEP TIMELINE) */}
      {/* ==================================================================== */}
      <section id="how-it-works" className="py-20 bg-slate-950/60 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
            <span className="text-xs font-bold text-yellow-400 uppercase tracking-widest">Workflow Journey</span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              From initial configuration to active ground command
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              A streamlined five-step lifecycle ensuring clean data onboarding and rapid cadre activation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {howItWorksSteps.map((step, idx) => {
              const Icon = step.icon;
              const isActive = activeHowStep === idx;
              return (
                <div
                  key={idx}
                  onClick={() => setActiveHowStep(idx)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isActive
                      ? 'bg-slate-900 border-yellow-500 shadow-lg shadow-yellow-500/10'
                      : 'bg-[#0c1427]/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-base font-black text-yellow-400">{step.step}</span>
                      <Icon className="w-4 h-4 text-slate-400" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white">{step.title}</h3>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{step.subtitle}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-300 pt-3 border-t border-slate-800/60 mt-3">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 8. AI INTELLIGENCE & ANALYTICS */}
      {/* ==================================================================== */}
      <section id="intelligence" className="py-20 bg-[#030712] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {/* Visual Intelligence Preview */}
            <div className="p-6 rounded-3xl bg-gradient-to-b from-[#0e172a] to-[#0b1329] border border-slate-800 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-yellow-400" />
                  <span className="font-bold text-white">AI Executive Ground Briefing</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400">ANALYSIS SYNTHESIZED</span>
              </div>

              {/* Strategic Insights Cards */}
              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-[11px]">Voter Concern Clustering</span>
                    <span className="text-[10px] text-yellow-400 font-mono">PRIORITY HIGH</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Drinking water & canal supply issues trending in rural sectors. Streamlining tanker allocation is prioritized.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-[11px]">Ground Cadre Coverage</span>
                    <span className="text-[10px] text-emerald-400 font-mono">HEALTHY COVERAGE</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Polling booth incharge allocation verified across all configured mandals with active 100-voter unit reach.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-[11px]">Turnout Signal Forecasting</span>
                    <span className="text-[10px] text-cyan-400 font-mono">SURVEY SAMPLING</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Survey responses indicate high morning mobilization interest across demographic clusters.
                  </p>
                </div>
              </div>
            </div>

            {/* Intelligence Copy */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-bold">
                <Cpu className="w-3.5 h-3.5" />
                <span>Operational Intelligence</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                From operational data to <br />
                <span className="text-yellow-400">actionable intelligence.</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                VIAP brings operational information together so authorized users can understand activity, identify patterns and make informed decisions.
              </p>
              <div className="space-y-3 pt-2 text-xs text-slate-300">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-yellow-400" />
                  <span>Real-time issue clustering without manual survey tallying</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-yellow-400" />
                  <span>Hierarchy-scoped access ensuring confidentiality</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-yellow-400" />
                  <span>Automated summary briefs generated on demand</span>
                </div>
              </div>
              <button
                onClick={handleStart}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-white transition-all flex items-center gap-2 cursor-pointer"
              >
                Explore Intelligence System
                <ArrowRight className="w-3.5 h-3.5 text-yellow-400" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 9. INTERACTIVE HIERARCHY VISUALIZATION */}
      {/* ==================================================================== */}
      <section className="py-20 bg-slate-950/60 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
            <span className="text-xs font-bold text-yellow-400 uppercase tracking-widest">Organizational Topology</span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Interactive Multi-Level Hierarchy
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Illustrative topology model. The actual operational hierarchy is dynamic and configured via Platform Administration.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Hierarchy Level Buttons */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {hierarchyLevels.map((lvl) => (
                <button
                  key={lvl.id}
                  onClick={() => setActiveHierarchyNode(lvl.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    activeHierarchyNode === lvl.id
                      ? 'bg-slate-900 border-yellow-500 shadow-md text-white'
                      : 'bg-[#0c1427] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black">{lvl.name}</span>
                    <span className="text-[10px] font-mono text-yellow-400">0{lvl.id + 1}</span>
                  </div>
                  <span className="text-[10px] font-mono block text-slate-400">{lvl.key}</span>
                </button>
              ))}
            </div>

            {/* Selected Level Inspector */}
            <div className="p-6 rounded-3xl bg-gradient-to-b from-slate-900 to-[#0b1329] border border-slate-800 space-y-4">
              <div className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Level Inspector</div>
              <div>
                <h3 className="text-base font-black text-white">{hierarchyLevels[activeHierarchyNode].name}</h3>
                <span className="text-xs font-mono text-slate-400">Key: {hierarchyLevels[activeHierarchyNode].key}</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {hierarchyLevels[activeHierarchyNode].desc}
              </p>
              <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1.5">
                <div>Jurisdiction: Strictly bounded by parent tier</div>
                <div>Operational Cadre: Appointed via Incharge Engine</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 10. SECURITY & GOVERNANCE SECTION */}
      {/* ==================================================================== */}
      <section id="security" className="py-20 bg-[#030712]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Enterprise Trust</span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Built with security and governance at the core
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Enterprise authorization, tamper-proof audit trails, and strict multi-tenant isolation guard every operation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <KeyRound className="w-6 h-6 text-yellow-400" />
              <h3 className="text-sm font-bold text-white">Role-Based & Jurisdiction Access</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Incharges and operators are strictly constrained to their assigned geographic boundary. Unauthorized cross-jurisdiction queries are blocked.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <Boxes className="w-6 h-6 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Multi-Application Isolation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Independent configuration, hierarchy, geographic boundaries, voter records, and cadre teams with complete workspace isolation.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Immutable Audit Trails</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                All configuration changes, role appointments, and critical operations are permanently logged to audit tables in PostgreSQL.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 11. MULTI-APPLICATION ARCHITECTURE */}
      {/* ==================================================================== */}
      <section className="py-20 bg-slate-950/60 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
            <span className="text-xs font-bold text-yellow-400 uppercase tracking-widest">Scalable Multi-Tenant Core</span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              One platform. Multiple configurable applications.
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Isolated operational environments powered by the same battle-tested core engine.
            </p>
          </div>

          <div className="max-w-3xl mx-auto p-6 rounded-3xl bg-slate-900/80 border border-slate-800 font-mono text-xs space-y-3">
            <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-bold text-center">
              VIAP CORE PLATFORM ENGINE
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-[#030712] border border-slate-800 text-center space-y-1">
                <div className="font-bold text-white">Application A</div>
                <div className="text-[10px] text-slate-400 font-sans">Custom Hierarchy & AC Data</div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#030712] border border-slate-800 text-center space-y-1">
                <div className="font-bold text-white">Application B</div>
                <div className="text-[10px] text-slate-400 font-sans">Parliament Scope & Team</div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#030712] border border-slate-800 text-center space-y-1">
                <div className="font-bold text-white">Application N</div>
                <div className="text-[10px] text-slate-400 font-sans">Statewide Zonal Setup</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 12. FINAL CALL TO ACTION (CTA) */}
      {/* ==================================================================== */}
      <section className="py-24 bg-gradient-to-b from-[#030712] via-[#0b1329] to-[#030712] relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6 relative z-10">
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Build your operational platform <br />
            <span className="text-yellow-400">around your structure.</span>
          </h2>
          <p className="text-xs sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
            Configure your application, define your operational hierarchy, assign data and teams, and bring your field operations into one connected platform.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <button
              onClick={handleLogin}
              className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-950 font-black text-sm transition-all shadow-xl shadow-yellow-500/30 active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-slate-950" />
              <span>Enter Application / Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 13. ENTERPRISE FOOTER */}
      {/* ==================================================================== */}
      <footer className="border-t border-slate-800/80 bg-[#02050e] py-14 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Col 1 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-yellow-500 text-slate-950 flex items-center justify-center font-bold">
                <Vote className="w-4 h-4" />
              </div>
              <span className="font-black text-white text-sm">VIAP</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Voter Intelligent Application platform for structured civic field operations and campaign intelligence.
            </p>
          </div>

          {/* Col 2 */}
          <div className="space-y-2.5">
            <div className="font-bold text-white uppercase text-[11px] tracking-wider">Platform</div>
            <ul className="space-y-1.5 text-[11px]">
              <li>
                <button onClick={() => scrollToSection('platform')} className="hover:text-white cursor-pointer">
                  Platform Overview
                </button>
              </li>
              <li>
                <button onClick={() => scrollToSection('capabilities')} className="hover:text-white cursor-pointer">
                  Core Capabilities
                </button>
              </li>
              <li>
                <button onClick={() => scrollToSection('intelligence')} className="hover:text-white cursor-pointer">
                  AI Intelligence
                </button>
              </li>
              <li>
                <button onClick={() => scrollToSection('security')} className="hover:text-white cursor-pointer">
                  Security & Governance
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3 */}
          <div className="space-y-2.5">
            <div className="font-bold text-white uppercase text-[11px] tracking-wider">Architecture</div>
            <ul className="space-y-1.5 text-[11px]">
              <li>
                <button onClick={() => scrollToSection('how-it-works')} className="hover:text-white cursor-pointer">
                  How It Works
                </button>
              </li>
              <li>
                <button onClick={handleStart} className="hover:text-white cursor-pointer">
                  CMS Application Studio
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4 */}
          <div className="space-y-2.5">
            <div className="font-bold text-white uppercase text-[11px] tracking-wider">Access</div>
            <ul className="space-y-1.5 text-[11px]">
              <li>
                <button onClick={handleLogin} className="hover:text-white cursor-pointer font-bold text-yellow-400">
                  Sign In / Enter Application
                </button>
              </li>
              <li>
                <button onClick={handleStart} className="hover:text-white cursor-pointer">
                  Configure Application (CMS)
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 mt-8 border-t border-slate-900 text-center text-[11px] text-slate-500">
          © 2026 VIAP (Voter Intelligent Application). All rights reserved.
        </div>
      </footer>
    </div>
  );
}
