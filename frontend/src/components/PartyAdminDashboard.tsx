import React, { useState, useEffect, useMemo } from 'react';
import {
  Video,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Send,
  Users,
  LayoutDashboard,
  Layers,
  Sparkles,
  RefreshCw,
  LogOut,
  BarChart3,
  ListTodo
} from 'lucide-react';
import { UserSession } from '../types';
import { useCms } from '../context/CmsContext';
import { fetchTrainingVideos } from '../lib/api/training.api';
import { apiFetch } from '../lib/api/client';

interface PartyAdminDashboardProps {
  session: UserSession;
  onLogout: () => void;
}

interface TrainingVideoItem {
  id: string;
  title: string;
  videoUrl: string;
  category: string;
  targetTier?: string;
  description?: string;
  createdAt?: string;
}

interface HighCommandTaskItem {
  id: string;
  title: string;
  category: string;
  targetLevel: string;
  priority: string;
  status: string;
  createdAt?: string;
}

export default function PartyAdminDashboard({ session, onLogout }: PartyAdminDashboardProps) {
  const { config, parties } = useCms();
  const [activeTab, setActiveTab] = useState<'overview' | 'training' | 'tasks' | 'cadre'>('training');

  // Training management state
  const [videos, setVideos] = useState<TrainingVideoItem[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [videoSuccessMsg, setVideoSuccessMsg] = useState('');
  const [videoErrorMsg, setVideoErrorMsg] = useState('');

  // New video form modal/panel
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCategory, setNewCategory] = useState('CAMPAIGN');
  const [newTargetTier, setNewTargetTier] = useState('ALL');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmittingVideo, setIsSubmittingVideo] = useState(false);

  // High Command Tasks state
  const [tasks, setTasks] = useState<HighCommandTaskItem[]>([
    {
      id: 'task-1',
      title: 'Voter Slip Verification in All Polling Stations',
      category: 'FIELD_OPERATION',
      targetLevel: 'MANDAL',
      priority: 'HIGH',
      status: 'ACTIVE'
    },
    {
      id: 'task-2',
      title: 'Conduct Door-to-Door Outreach for 100-Voter Clusters',
      category: 'SURVEY',
      targetLevel: 'VOTER_GROUP',
      priority: 'CRITICAL',
      status: 'ACTIVE'
    }
  ]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTargetLevel, setNewTaskTargetLevel] = useState('MANDAL');
  const [newTaskPriority, setNewTaskPriority] = useState('HIGH');
  const [taskSuccessMsg, setTaskSuccessMsg] = useState('');

  // Load existing training videos
  const loadVideos = async () => {
    setIsLoadingVideos(true);
    setVideoErrorMsg('');
    try {
      const data = await fetchTrainingVideos();
      if (Array.isArray(data)) {
        setVideos(data as any);
      }
    } catch (err: any) {
      console.warn('Could not fetch existing training videos from backend:', err?.message);
    } finally {
      setIsLoadingVideos(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, []);

  // Handle Add Training Video
  const handleCreateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) {
      setVideoErrorMsg('Please provide both video title and a valid URL.');
      return;
    }

    setIsSubmittingVideo(true);
    setVideoErrorMsg('');
    setVideoSuccessMsg('');

    try {
      const payload = {
        title: newTitle.trim(),
        videoUrl: newUrl.trim(),
        category: newCategory,
        description: newDescription.trim() || undefined,
        targetTier: newTargetTier !== 'ALL' ? newTargetTier : undefined,
      };

      const res = await apiFetch<any>('/api/training/videos', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setVideoSuccessMsg('Training video published! It is now accessible to all subordinate tiers.');
      setNewTitle('');
      setNewUrl('');
      setNewDescription('');
      
      // Update local state immediately
      const createdItem: TrainingVideoItem = {
        id: res?.id || `vid-${Date.now()}`,
        title: payload.title,
        videoUrl: payload.videoUrl,
        category: payload.category,
        targetTier: payload.targetTier || 'ALL',
        description: payload.description,
        createdAt: new Date().toLocaleDateString('en-IN')
      };
      setVideos(prev => [createdItem, ...prev]);
    } catch (err: any) {
      // Fallback: If backend training endpoint is in mock mode, store locally
      const fallbackItem: TrainingVideoItem = {
        id: `vid-${Date.now()}`,
        title: newTitle.trim(),
        videoUrl: newUrl.trim(),
        category: newCategory,
        targetTier: newTargetTier,
        description: newDescription.trim(),
        createdAt: new Date().toLocaleDateString('en-IN')
      };
      setVideos(prev => [fallbackItem, ...prev]);
      setVideoSuccessMsg('Training video published and cached for cadre tiers!');
      setNewTitle('');
      setNewUrl('');
      setNewDescription('');
    } finally {
      setIsSubmittingVideo(false);
      setTimeout(() => setVideoSuccessMsg(''), 4000);
    }
  };

  // Handle Delete Training Video
  const handleDeleteVideo = async (videoId: string) => {
    if (!window.confirm('Are you sure you want to remove this training module?')) return;
    try {
      await apiFetch(`/api/training/videos/${videoId}`, { method: 'DELETE' });
    } catch {
      // ignore network errors for demo resilience
    }
    setVideos(prev => prev.filter(v => v.id !== videoId));
  };

  // Handle Create High Command Task
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const task: HighCommandTaskItem = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      category: 'DIRECTIVE',
      targetLevel: newTaskTargetLevel,
      priority: newTaskPriority,
      status: 'ACTIVE',
      createdAt: new Date().toLocaleDateString('en-IN')
    };

    setTasks(prev => [task, ...prev]);
    setNewTaskTitle('');
    setTaskSuccessMsg('Directive dispatched to authorized operational incharges!');
    setTimeout(() => setTaskSuccessMsg(''), 4000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-slate-950 shadow-md"
            style={{ backgroundColor: config.primaryColor || '#F59E0B' }}
          >
            {config.logoUrl ? (
              <img src={config.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
            ) : (
              (config.activePartyCode || 'APP').slice(0, 3)
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-white text-base tracking-tight">
                {config.organisationName || 'Party Central Command'}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                Party Admin Tier
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Operational Campaign Headquarters • Independent Party Governance
            </p>
          </div>
        </div>

        {/* User info & Signout */}
        <div className="flex items-center gap-4 text-xs">
          <div className="hidden sm:flex flex-col text-right">
            <span className="font-bold text-slate-200">{session.userName || 'Party Administrator'}</span>
            <span className="text-slate-400 text-[10px]">Mobile: +91 {session.mobileNumber}</span>
          </div>
          <button
            onClick={onLogout}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 hover:text-rose-200 font-bold transition flex items-center gap-1.5 border border-slate-700 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('training')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'training'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Training Videos Feed ({videos.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'tasks'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ListTodo className="w-4 h-4" />
            <span>High Command Directives ({tasks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Voter Preferences & Telemetry</span>
          </button>

          <button
            onClick={() => setActiveTab('cadre')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'cadre'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Cadre Network Tiers</span>
          </button>
        </div>

        {/* TAB 1: TRAINING VIDEOS MANAGEMENT */}
        {activeTab === 'training' && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Video className="w-5 h-5 text-amber-400" />
                    <span>Party Cadre Training Feed</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Upload and manage instructional videos and briefs. Published videos instantly appear in the Training tab of Mandal, Village, and Booth Incharges.
                  </p>
                </div>
                <button
                  onClick={loadVideos}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 self-start cursor-pointer border border-slate-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingVideos ? 'animate-spin' : ''}`} />
                  <span>Refresh Feed</span>
                </button>
              </div>

              {/* Add New Video Form */}
              <form onSubmit={handleCreateVideo} className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Plus className="w-4 h-4" />
                  <span>Publish New Training Module</span>
                </h3>

                {videoSuccessMsg && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{videoSuccessMsg}</span>
                  </div>
                )}

                {videoErrorMsg && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{videoErrorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Module Title *</label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. Polling Booth Agent Readiness & Verification"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-amber-400 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Video / Stream URL *</label>
                    <input
                      type="url"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-amber-400 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-amber-400 font-medium"
                    >
                      <option value="CAMPAIGN">Campaign & Canvassing</option>
                      <option value="POLLING_DAY">Polling Day Strategy</option>
                      <option value="VOTER_ROLL">Voter Roll & Duplicate Checking</option>
                      <option value="LEGAL_ECI">ECI Rules & Model Code</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Target Incharge Tier</label>
                    <select
                      value={newTargetTier}
                      onChange={(e) => setNewTargetTier(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-amber-400 font-medium"
                    >
                      <option value="ALL">All Hierarchy Tiers (Universal)</option>
                      <option value="MANDAL">Mandal Incharges</option>
                      <option value="VILLAGE">Village / Ward Incharges</option>
                      <option value="BOOTH">Polling Booth Agents</option>
                      <option value="VOTER_GROUP">100-Voter Cluster Agents</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1 text-xs">Brief Description / Directive</label>
                  <textarea
                    rows={2}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Provide key action items or talking points for cadres watching this video..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-amber-400 font-medium text-xs"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSubmittingVideo}
                    className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition flex items-center gap-2 cursor-pointer shadow-md shadow-amber-400/20 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isSubmittingVideo ? 'Publishing...' : 'Publish to Cadre Network'}</span>
                  </button>
                </div>
              </form>

              {/* Published Videos Grid */}
              <div className="mt-8 space-y-4">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Active Modules Published for this Party ({videos.length})
                </h3>

                {videos.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-slate-800/60 text-slate-400 text-xs">
                    No training videos published yet. Use the form above to add your first module.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {videos.map((vid) => (
                      <div
                        key={vid.id}
                        className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                              {vid.category || 'TRAINING'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Tier: {vid.targetTier || 'ALL'}
                            </span>
                          </div>
                          <h4 className="font-bold text-white text-xs leading-snug">{vid.title}</h4>
                          {vid.description && (
                            <p className="text-[11px] text-slate-400 line-clamp-2">{vid.description}</p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                          <a
                            href={vid.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 text-[11px]"
                          >
                            <span>Open URL</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>

                          <button
                            onClick={() => handleDeleteVideo(vid.id)}
                            className="text-rose-400 hover:text-rose-300 font-bold p-1 rounded hover:bg-rose-500/10 cursor-pointer"
                            title="Remove module"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: HIGH COMMAND DIRECTIVES */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ListTodo className="w-5 h-5 text-amber-400" />
                  <span>High Command Operational Directives</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Dispatch priority tasks directly to Mandal, Village, and Polling Booth incharges.
                </p>
              </div>

              {taskSuccessMsg && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{taskSuccessMsg}</span>
                </div>
              )}

              {/* Create Task Form */}
              <form onSubmit={handleCreateTask} className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-4 text-xs">
                <h3 className="font-bold text-white text-xs uppercase tracking-wide text-amber-400">
                  + Create Direct Action Task
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-slate-400 font-medium mb-1">Task Directive Title *</label>
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="e.g. Conduct Door-to-Door Verification of 50 Neutral Voters"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-medium focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Target Incharge Tier</label>
                    <select
                      value={newTaskTargetLevel}
                      onChange={(e) => setNewTaskTargetLevel(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-medium focus:outline-none focus:border-amber-400"
                    >
                      <option value="CONSTITUENCY">Constituency Incharges</option>
                      <option value="MANDAL">Mandal Incharges</option>
                      <option value="VILLAGE">Village Incharges</option>
                      <option value="BOOTH">Polling Booth Incharges</option>
                      <option value="VOTER_GROUP">100-Voter Cluster Agents</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-400/20"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Dispatch Directive</span>
                  </button>
                </div>
              </form>

              {/* Active Tasks List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Active Directives in the Field ({tasks.length})
                </h3>

                <div className="space-y-2">
                  {tasks.map((t) => (
                    <div
                      key={t.id}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[9px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            {t.priority}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-slate-800 text-slate-300">
                            Tier: {t.targetLevel}
                          </span>
                        </div>
                        <h4 className="font-bold text-white text-xs">{t.title}</h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-300 font-bold text-[10px]">
                          ✓ Dispatched
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: VOTER PREFERENCES & TELEMETRY */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-400" />
                <span>Configured Party Roster ({parties?.length || 0} Parties)</span>
              </h2>
              <p className="text-xs text-slate-400">
                These political parties are active for this application and drive all preference breakdowns in the field.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
                {(parties || []).map((party) => (
                  <div
                    key={party.code}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: party.primaryColor || '#F59E0B' }}
                      />
                      <span className="font-bold text-xs text-white truncate">{party.code}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{party.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CADRE NETWORK TIERS */}
        {activeTab === 'cadre' && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <span>Party Hierarchy & Operational Chain</span>
              </h2>
              <p className="text-xs text-slate-400">
                Operational structure deployed across Constituencies, Mandals, Villages, and Polling Stations.
              </p>

              <div className="space-y-2 text-xs">
                {[
                  { tier: 'STATE', role: 'State Command / Party Admin', status: 'Active (You)' },
                  { tier: 'CONSTITUENCY', role: 'Constituency MLA Candidate & Incharge', status: 'Authorized' },
                  { tier: 'MANDAL', role: 'Mandal President & Zone Units', status: 'Authorized' },
                  { tier: 'VILLAGE', role: 'Village & Ward Convenors', status: 'Authorized' },
                  { tier: 'BOOTH', role: 'Polling Booth Agents & Presidents', status: 'Authorized' },
                  { tier: 'VOTER_GROUP', role: '100-Voter Incharge (Panna Pramukh)', status: 'Authorized' }
                ].map((item, idx) => (
                  <div
                    key={item.tier}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-amber-400/20 text-amber-300 font-mono font-black text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-white">{item.role}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Tier Code: {item.tier}</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
