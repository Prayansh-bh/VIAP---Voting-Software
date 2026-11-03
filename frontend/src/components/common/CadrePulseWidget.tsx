import React, { useState, useEffect } from 'react';
import { HelpCircle, CheckCircle2, BarChart2, Loader2, ArrowRight, Plus, Clock, Lock } from 'lucide-react';
import { fetchPolls, submitPollVote, closePoll, PollItem } from '../../lib/api/polls.api';
import CreatePollModal from './CreatePollModal';

interface CadrePulseWidgetProps {
  title?: string;
  className?: string;
  isAdmin?: boolean;
}

function formatRemainingTime(expiresAt?: string, isExpired?: boolean, status?: string): { label: string; isClosed: boolean } {
  if (status === 'CLOSED' || isExpired) return { label: 'Closed', isClosed: true };
  if (!expiresAt) return { label: 'Active', isClosed: false };
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { label: 'Closed', isClosed: true };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return { label: 'Closing soon', isClosed: false };
  if (hours < 24) return { label: `${hours}h left`, isClosed: false };
  const days = Math.floor(hours / 24);
  return { label: `${days}d left`, isClosed: false };
}

export default function CadrePulseWidget({ title = 'Cadre Opinion & Pulse', className = '', isAdmin = false }: CadrePulseWidgetProps) {
  const [polls, setPolls] = useState<PollItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingPollId, setVotingPollId] = useState<string | null>(null);
  const [isClosingId, setIsClosingId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'ACTIVE' | 'ALL'>('ACTIVE');

  const loadPolls = async () => {
    try {
      const data = await fetchPolls();
      setPolls(data);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPolls();
  }, []);

  const handleVote = async (pollId: string, optionId: string) => {
    setVotingPollId(pollId);
    setFeedback(null);
    try {
      await submitPollVote(pollId, optionId);
      setFeedback('Vote recorded successfully!');
      setTimeout(() => setFeedback(null), 3000);
      await loadPolls();
    } catch (err: any) {
      setFeedback(err?.message || 'Failed to submit vote');
    } finally {
      setVotingPollId(null);
    }
  };

  const handleClosePoll = async (pollId: string) => {
    setIsClosingId(pollId);
    try {
      await closePoll(pollId);
      setFeedback('Poll closed successfully.');
      setTimeout(() => setFeedback(null), 3000);
      await loadPolls();
    } catch (err: any) {
      setFeedback(err?.message || 'Failed to close poll');
    } finally {
      setIsClosingId(null);
    }
  };

  const activePolls = polls.filter((p) => {
    const isPast = p.expiresAt && new Date(p.expiresAt).getTime() <= Date.now();
    return p.status === 'PUBLISHED' && !p.isExpired && !isPast;
  });

  const displayedPolls = filterMode === 'ACTIVE' ? activePolls : polls;

  if (loading) {
    return (
      <div className={`p-4 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center text-xs text-gray-400 gap-2 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
        <span>Loading cadre pulse polls...</span>
      </div>
    );
  }

  if (polls.length === 0 && !isAdmin) {
    return null; // Clean fallback for non-admins when no polls exist
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-amber-500" />
          <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {polls.length > 0 && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setFilterMode('ACTIVE')}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  filterMode === 'ACTIVE' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Active ({activePolls.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  filterMode === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                All ({polls.length})
              </button>
            </div>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Create Poll</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="p-2.5 bg-green-50 border border-green-200 text-green-800 text-xs font-bold rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {displayedPolls.length === 0 ? (
        <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl space-y-2">
          <p className="text-xs text-slate-500">
            {filterMode === 'ACTIVE' && polls.length > 0
              ? 'All current opinion polls have reached their duration and are closed.'
              : 'No opinion polls at this moment.'}
          </p>
          {filterMode === 'ACTIVE' && polls.length > 0 && (
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className="text-xs font-bold text-amber-600 hover:text-amber-700 underline"
            >
              View past poll results ({polls.length})
            </button>
          )}
          {isAdmin && (
            <div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="text-xs font-bold text-amber-600 hover:text-amber-700 underline"
              >
                Publish a new poll to your cadre network
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayedPolls.map((poll) => {
            const isPast = poll.expiresAt ? new Date(poll.expiresAt).getTime() <= Date.now() : false;
            const isClosed = poll.status === 'CLOSED' || Boolean(poll.isExpired) || isPast;
            const hasVoted = Boolean(poll.userVotedOptionId);
            const isVoting = votingPollId === poll.id;
            const isClosing = isClosingId === poll.id;
            const timeInfo = formatRemainingTime(poll.expiresAt, poll.isExpired, poll.status);

            return (
              <div key={poll.id} className="p-4 bg-slate-50/70 rounded-xl border border-slate-100 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-extrabold text-slate-800">{poll.title}</h4>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          isClosed
                            ? 'bg-slate-200 text-slate-600'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {isClosed ? <Lock className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5 text-emerald-600" />}
                        <span>{timeInfo.label}</span>
                      </span>
                    </div>
                    {poll.description && (
                      <p className="text-[11px] text-slate-500">{poll.description}</p>
                    )}
                  </div>
                  {isAdmin && !isClosed && (
                    <button
                      type="button"
                      disabled={isClosing}
                      onClick={() => handleClosePoll(poll.id)}
                      title="Close Poll"
                      className="text-[10px] text-slate-400 hover:text-rose-500 font-bold px-1.5 py-0.5 rounded border border-slate-200 hover:border-rose-300 transition-colors cursor-pointer"
                    >
                      {isClosing ? 'Closing...' : 'Close'}
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {poll.options.map((option) => {
                    const isSelected = poll.userVotedOptionId === option.id;
                    const pct = option.percentage ?? (poll.totalVotes > 0 ? Math.round(((option.votesCount || 0) / poll.totalVotes) * 100) : 0);

                    // Show visual bars if user has voted OR if poll is closed/expired
                    if (hasVoted || isClosed) {
                      return (
                        <div key={option.id} className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className={isSelected ? 'text-amber-700 font-black flex items-center gap-1' : 'text-slate-600'}>
                              {option.text} {isSelected && '✓'}
                            </span>
                            <span className="text-slate-500 font-mono">{pct}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${
                                isSelected ? 'bg-amber-500' : isClosed ? 'bg-slate-400' : 'bg-slate-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    }

                    // Otherwise show active voting button
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={isVoting || isClosed}
                        onClick={() => handleVote(poll.id, option.id)}
                        className="w-full text-left px-3 py-2 bg-white hover:bg-amber-50/60 border border-slate-200 hover:border-amber-300 rounded-lg text-xs font-bold text-slate-700 transition-all flex items-center justify-between group cursor-pointer disabled:opacity-50"
                      >
                        <span>{option.text}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-500 transition-colors" />
                      </button>
                    );
                  })}
                </div>

                <div className="text-[10px] text-slate-400 flex justify-between pt-1">
                  <span>Total votes: {poll.totalVotes}</span>
                  {hasVoted ? (
                    <span className="text-green-600 font-bold">✓ Vote submitted</span>
                  ) : isClosed ? (
                    <span className="text-slate-500 font-medium">Voting ended</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Create Poll Modal */}
      <CreatePollModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onPollCreated={loadPolls}
      />
    </div>
  );
}
