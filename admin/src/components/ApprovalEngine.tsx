import React, { useState } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Eye,
  UserPlus,
  ShieldCheck,
  FileCheck,
  FileText,
  AlertTriangle,
  X,
  Phone,
} from 'lucide-react';
import { ApprovalRecord } from '../types';

interface ApprovalEngineProps {
  approvals: ApprovalRecord[];
  onApprove: (id: string, reviewerNote?: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
}

export default function ApprovalEngine({
  approvals,
  onApprove,
  onReject,
}: ApprovalEngineProps) {
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [search, setSearch] = useState('');

  // Modals
  const [inspectItem, setInspectItem] = useState<ApprovalRecord | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const stats = {
    totalPending: approvals.filter((a) => a.status === 'PENDING').length,
    userRegistrations: approvals.filter((a) => a.type === 'USER_REGISTRATION').length,
    inchargeRequests: approvals.filter((a) => a.type === 'INCHARGE_REQUEST').length,
    dataCorrections: approvals.filter((a) => a.type === 'DATA_CORRECTION').length,
    surveyApprovals: approvals.filter((a) => a.type === 'SURVEY_APPROVAL').length,
  };

  const filteredApprovals = approvals.filter((item) => {
    const matchType = activeTab === 'ALL' || item.type === activeTab;
    const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
    const matchSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.applicantName.toLowerCase().includes(search.toLowerCase()) ||
      item.jurisdiction.toLowerCase().includes(search.toLowerCase()) ||
      item.applicantPhone.includes(search);
    return matchType && matchStatus && matchSearch;
  });

  const handleExecuteApprove = async (item: ApprovalRecord) => {
    setActionLoading(true);
    try {
      await onApprove(item.id, 'Approved via CMS Admin Panel');
      setFeedback({ message: `Approved "${item.title}".`, type: 'success' });
      setInspectItem(null);
    } catch (err: any) {
      setFeedback({ message: err.message || 'Approval failed', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteReject = async (item: ApprovalRecord) => {
    if (!rejectReason.trim()) {
      alert('Please state a reason for rejection.');
      return;
    }
    setActionLoading(true);
    try {
      await onReject(item.id, rejectReason.trim());
      setFeedback({ message: `Rejected "${item.title}".`, type: 'success' });
      setIsRejecting(false);
      setRejectReason('');
      setInspectItem(null);
    } catch (err: any) {
      setFeedback({ message: err.message || 'Rejection failed', type: 'error' });
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
            <ClipboardCheck className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-white">Central Approval Management Engine</h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Super Admin verification portal for incharge registrations, voter data corrections, and field surveys.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
            {stats.totalPending} Pending Approvals
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

      {/* Category Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div
          onClick={() => setActiveTab('USER_REGISTRATION')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            activeTab === 'USER_REGISTRATION'
              ? 'bg-blue-500/10 border-blue-400 text-white shadow-sm'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400">User Registrations</div>
          <div className="text-2xl font-black text-white mt-1">{stats.userRegistrations}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">New Cadre Signups</div>
        </div>

        <div
          onClick={() => setActiveTab('INCHARGE_REQUEST')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            activeTab === 'INCHARGE_REQUEST'
              ? 'bg-purple-500/10 border-purple-400 text-white shadow-sm'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Incharge Requests</div>
          <div className="text-2xl font-black text-white mt-1">{stats.inchargeRequests}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Role Escalations</div>
        </div>

        <div
          onClick={() => setActiveTab('DATA_CORRECTION')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            activeTab === 'DATA_CORRECTION'
              ? 'bg-amber-500/10 border-amber-400 text-white shadow-sm'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Data Corrections</div>
          <div className="text-2xl font-black text-white mt-1">{stats.dataCorrections}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Voter Info Updates</div>
        </div>

        <div
          onClick={() => setActiveTab('SURVEY_APPROVAL')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            activeTab === 'SURVEY_APPROVAL'
              ? 'bg-emerald-500/10 border-emerald-400 text-white shadow-sm'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Survey Approvals</div>
          <div className="text-2xl font-black text-white mt-1">{stats.surveyApprovals}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Field Outreach Batches</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search request, applicant, unit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-amber-400 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {/* Status Toggle */}
          <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold">
            {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  statusFilter === s ? 'bg-amber-400 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {activeTab !== 'ALL' && (
            <button
              onClick={() => setActiveTab('ALL')}
              className="text-xs text-slate-400 hover:text-white font-bold underline px-2"
            >
              Reset Category
            </button>
          )}
        </div>
      </div>

      {/* Approvals List */}
      <div className="space-y-3">
        {filteredApprovals.length === 0 ? (
          <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center text-slate-400 space-y-2">
            <ClipboardCheck className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-sm font-bold text-slate-300">No approval requests found</div>
            <p className="text-xs text-slate-500">All submissions in this category are up to date.</p>
          </div>
        ) : (
          filteredApprovals.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-amber-400 font-bold shrink-0 mt-0.5">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{item.title}</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-950 border border-slate-800 text-slate-300">
                      {item.type.replace('_', ' ')}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        item.status === 'PENDING'
                          ? 'bg-amber-400/10 text-amber-300 border border-amber-400/20'
                          : item.status === 'APPROVED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                    <span>
                      Applicant: <strong className="text-slate-200">{item.applicantName}</strong>
                    </span>
                    <span className="flex items-center gap-1 font-mono text-slate-400">
                      <Phone className="w-3 h-3 text-slate-500" />
                      {item.applicantPhone}
                    </span>
                    <span>
                      Jurisdiction: <strong className="text-slate-200">{item.jurisdiction}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  onClick={() => setInspectItem(item)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspect</span>
                </button>

                {item.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => handleExecuteApprove(item)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => {
                        setInspectItem(item);
                        setIsRejecting(true);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Inspect / Review Modal */}
      {inspectItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">Approval Payload Review</h3>
              </div>
              <button
                onClick={() => {
                  setInspectItem(null);
                  setIsRejecting(false);
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <div className="text-sm font-bold text-white">{inspectItem.title}</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {inspectItem.applicantName} • {inspectItem.applicantPhone} • {inspectItem.jurisdiction}
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono text-xs text-slate-300 space-y-1 overflow-x-auto max-h-56">
              <div className="text-[10px] font-bold uppercase text-slate-500 font-sans mb-1">
                Verified Verification Payload
              </div>
              {Object.entries(inspectItem.details).map(([key, val]) => (
                <div key={key} className="flex justify-between gap-2 border-b border-slate-900 py-1">
                  <span className="text-slate-400">{key}:</span>
                  <span className="text-amber-400 font-bold">{String(val)}</span>
                </div>
              ))}
            </div>

            {isRejecting ? (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="block text-xs font-bold text-rose-400">
                  State Reason for Rejection *
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Duplicate registration / Invalid phone number / Incorrect EPIC"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-rose-500/40 text-xs text-white outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsRejecting(false)}
                    className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleExecuteReject(inspectItem)}
                    disabled={actionLoading}
                    className="px-4 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs shadow-sm disabled:opacity-50"
                  >
                    {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                </div>
              </div>
            ) : (
              inspectItem.status === 'PENDING' && (
                <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                  <button
                    onClick={() => setIsRejecting(true)}
                    className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold border border-rose-500/20"
                  >
                    Reject with Reason
                  </button>
                  <button
                    onClick={() => handleExecuteApprove(inspectItem)}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition disabled:opacity-50"
                  >
                    {actionLoading ? 'Approving...' : 'Authorize & Approve'}
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
