import React, { useState } from 'react';
import {
  UserCheck,
  UserPlus,
  ArrowRightLeft,
  UserX,
  KeyRound,
  Shield,
  Search,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  X,
  Phone,
} from 'lucide-react';
import { InchargeRecord, AppInstance, HierarchyLevelKey } from '../types';

interface InchargeManagementProps {
  incharges: InchargeRecord[];
  currentApp: AppInstance | null;
  onTransfer: (inchargeId: string, targetJurisdiction: string, targetLevel: string) => Promise<void>;
  onReplace: (inchargeId: string, replacementName: string, replacementMobile: string, handoverNote?: string) => Promise<void>;
  onToggleStatus: (inchargeId: string, status: string) => Promise<void>;
  onResetCredentials: (inchargeId: string) => Promise<void>;
}

export default function InchargeManagement({
  incharges,
  currentApp,
  onTransfer,
  onReplace,
  onToggleStatus,
  onResetCredentials,
}: InchargeManagementProps) {
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('ALL');

  // Modals
  const [transferItem, setTransferItem] = useState<InchargeRecord | null>(null);
  const [targetJurisdiction, setTargetJurisdiction] = useState('');
  const [targetLevel, setTargetLevel] = useState<HierarchyLevelKey>('BOOTH');

  const [replaceItem, setReplaceItem] = useState<InchargeRecord | null>(null);
  const [replacementName, setReplacementName] = useState('');
  const [replacementMobile, setReplacementMobile] = useState('');
  const [handoverNote, setHandoverNote] = useState('');

  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const filteredIncharges = incharges.filter((inc) => {
    const matchSearch =
      inc.name.toLowerCase().includes(search.toLowerCase()) ||
      inc.phone.includes(search) ||
      inc.jurisdiction.toLowerCase().includes(search.toLowerCase());
    const matchLevel = filterLevel === 'ALL' || inc.level === filterLevel;
    return matchSearch && matchLevel;
  });

  const handleExecuteTransfer = async () => {
    if (!transferItem || !targetJurisdiction.trim()) {
      alert('Please specify the target jurisdiction.');
      return;
    }
    setActionLoading(true);
    try {
      await onTransfer(transferItem.id, targetJurisdiction.trim(), targetLevel);
      setFeedback({ message: `Successfully transferred ${transferItem.name} to ${targetJurisdiction}.`, type: 'success' });
      setTransferItem(null);
      setTargetJurisdiction('');
    } catch (err: any) {
      setFeedback({ message: err.message || 'Transfer failed', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteReplace = async () => {
    if (!replaceItem || !replacementName.trim() || !replacementMobile.trim()) {
      alert('Replacement name and valid mobile number are required.');
      return;
    }
    setActionLoading(true);
    try {
      await onReplace(replaceItem.id, replacementName.trim(), replacementMobile.trim(), handoverNote.trim());
      setFeedback({ message: `Successfully replaced ${replaceItem.name} with ${replacementName}.`, type: 'success' });
      setReplaceItem(null);
      setReplacementName('');
      setReplacementMobile('');
      setHandoverNote('');
    } catch (err: any) {
      setFeedback({ message: err.message || 'Replacement failed', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl font-bold text-white">Incharge Lifecycle & Cadre Governance</h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Deploy, transfer, replace, and audit incharge appointments across enabled hierarchy tiers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300">
            Total Cadre: {incharges.length}
          </span>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-sm font-bold">✕</button>
        </div>
      )}

      {/* Performance Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Deployed Incharges</div>
            <div className="text-2xl font-black text-white mt-0.5">{incharges.filter((i) => i.status === 'ACTIVE').length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Average Voter Coverage</div>
            <div className="text-2xl font-black text-white mt-0.5">86.4%</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hierarchy Saturation</div>
            <div className="text-2xl font-black text-white mt-0.5">92.0%</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
            <Shield className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, phone, or unit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-emerald-400 outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 self-stretch sm:self-auto overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'CONSTITUENCY', 'MANDAL', 'VILLAGE', 'BOOTH', 'VOTER_GROUP'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilterLevel(lvl)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                filterLevel === lvl
                  ? 'bg-emerald-400 text-slate-950 shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {lvl.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Incharges Table */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3">Incharge Name</th>
                <th className="p-3">Role & Hierarchy Level</th>
                <th className="p-3">Assigned Jurisdiction</th>
                <th className="p-3">Coverage Rate</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredIncharges.map((inc) => (
                <tr key={inc.id} className="hover:bg-slate-800/40 text-slate-300">
                  <td className="p-3">
                    <div className="font-bold text-white">{inc.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-500" />
                      <span>{inc.phone}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-950 border border-slate-800 text-emerald-400">
                      {inc.level.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3 font-medium text-slate-200">{inc.jurisdiction}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-slate-950 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-400 h-full rounded-full"
                          style={{ width: `${inc.coverageRate}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-emerald-400">{inc.coverageRate}%</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                        inc.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {inc.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setTransferItem(inc);
                          setTargetLevel(inc.level);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition flex items-center gap-1"
                        title="Transfer to another unit"
                      >
                        <ArrowRightLeft className="w-3 h-3 text-amber-400" />
                        <span>Transfer</span>
                      </button>

                      <button
                        onClick={() => setReplaceItem(inc)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition flex items-center gap-1"
                        title="Replace with new incharge"
                      >
                        <UserX className="w-3 h-3 text-rose-400" />
                        <span>Replace</span>
                      </button>

                      <button
                        onClick={async () => {
                          if (confirm(`Reset login credentials for ${inc.name}?`)) {
                            await onResetCredentials(inc.id);
                            setFeedback({ message: `Reset passcode sent to ${inc.phone}.`, type: 'success' });
                          }
                        }}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition"
                        title="Reset Access Credentials"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={async () => {
                          const nextStatus = inc.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
                          await onToggleStatus(inc.id, nextStatus);
                        }}
                        className={`p-1 rounded-lg transition ${
                          inc.status === 'ACTIVE'
                            ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'
                            : 'text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                        title={inc.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transfer Incharge Modal */}
      {transferItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">Transfer Incharge</h3>
              </div>
              <button onClick={() => setTransferItem(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-300">
              Transferring <strong className="text-white">{transferItem.name}</strong> from current jurisdiction{' '}
              <strong className="text-amber-400">{transferItem.jurisdiction}</strong>.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Target Hierarchy Tier</label>
              <select
                value={targetLevel}
                onChange={(e) => setTargetLevel(e.target.value as HierarchyLevelKey)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none"
              >
                {['CONSTITUENCY', 'MANDAL', 'VILLAGE', 'BOOTH', 'VOTER_GROUP'].map((l) => (
                  <option key={l} value={l}>{l.replace('_', ' ')}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Target Unit / Jurisdiction Name *</label>
              <input
                type="text"
                placeholder="e.g. Booth 108 - ZPHS South"
                value={targetJurisdiction}
                onChange={(e) => setTargetJurisdiction(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-amber-400"
              />
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setTransferItem(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteTransfer}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-md transition disabled:opacity-50"
              >
                {actionLoading ? 'Transferring...' : 'Confirm Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Replace Incharge Modal */}
      {replaceItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserX className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-white text-base">Replace Incharge</h3>
              </div>
              <button onClick={() => setReplaceItem(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-300">
              Replacing <strong className="text-white">{replaceItem.name}</strong> ({replaceItem.jurisdiction}). A handover log will be recorded.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">New Incharge Full Name *</label>
              <input
                type="text"
                placeholder="e.g. S. Venkata Subbaiah"
                value={replacementName}
                onChange={(e) => setReplacementName(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-rose-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">New Mobile Number (Login ID) *</label>
              <input
                type="text"
                placeholder="10-digit mobile"
                value={replacementMobile}
                onChange={(e) => setReplacementMobile(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-rose-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Handover Note / Justification</label>
              <textarea
                rows={2}
                placeholder="e.g. Incharge relocated / health reasons / structural reshuffle"
                value={handoverNote}
                onChange={(e) => setHandoverNote(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-rose-400"
              />
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setReplaceItem(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteReplace}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
              >
                {actionLoading ? 'Replacing...' : 'Confirm Handover & Replace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
