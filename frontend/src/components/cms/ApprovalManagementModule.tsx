import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Eye,
  FileCheck,
  UserCheck,
  ClipboardCheck,
  ArrowRightLeft,
  AlertTriangle,
  X,
  Send,
  MessageSquare,
  Sparkles,
  ChevronRight,
  UserPlus,
  Phone,
} from 'lucide-react';
import {
  ApprovalItem,
  ApprovalStats,
  fetchApprovals,
  fetchApprovalStats,
  approveRequest,
  rejectRequest,
} from '../../lib/api/approvals.api';
import { useCms } from '../../context/CmsContext';

interface ApprovalManagementModuleProps {
  partyId?: string;
  onClose?: () => void;
  onBack?: () => void;
}

export default function ApprovalManagementModule({
  partyId,
  onClose,
  onBack,
}: ApprovalManagementModuleProps) {
  const { config } = useCms();
  const [stats, setStats] = useState<ApprovalStats>({
    totalPending: 0,
    totalApproved: 0,
    totalRejected: 0,
    userRegistrations: 0,
    inchargeRequests: 0,
    dataCorrections: 0,
    surveyApprovals: 0,
    transferApprovals: 0,
  });
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, listRes] = await Promise.all([
        fetchApprovalStats(partyId),
        fetchApprovals({
          partyId,
          type: activeTab !== 'ALL' ? activeTab : undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          limit: 100,
        }),
      ]);
      setStats(statsRes);
      setApprovals(listRes.items || []);
    } catch (err: any) {
      console.error('Failed to load approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [partyId, activeTab, statusFilter]);

  const filteredApprovals = useMemo(() => {
    if (!searchQuery.trim()) return approvals;
    const q = searchQuery.toLowerCase();
    return approvals.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q) ||
        a.requestedByName.toLowerCase().includes(q) ||
        a.requestedByMobile.includes(q)
    );
  }, [approvals, searchQuery]);

  const handleApprove = async (item: ApprovalItem) => {
    setActionLoading(true);
    try {
      await approveRequest(item.id);
      setFeedbackMessage({ text: `Approved "${item.title}" successfully.`, type: 'success' });
      setSelectedItem(null);
      await loadData();
    } catch (err: any) {
      setFeedbackMessage({ text: err.message || 'Failed to approve request', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (item: ApprovalItem) => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }
    setActionLoading(true);
    try {
      await rejectRequest(item.id, rejectReason.trim());
      setFeedbackMessage({ text: `Rejected "${item.title}".`, type: 'success' });
      setIsRejecting(false);
      setRejectReason('');
      setSelectedItem(null);
      await loadData();
    } catch (err: any) {
      setFeedbackMessage({ text: err.message || 'Failed to reject request', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'USER_REGISTRATION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
            <UserPlus className="w-3 h-3" /> User Registration
          </span>
        );
      case 'INCHARGE_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
            <UserCheck className="w-3 h-3" /> Incharge Request
          </span>
        );
      case 'DATA_CORRECTION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
            <FileCheck className="w-3 h-3" /> Data Correction
          </span>
        );
      case 'SURVEY_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
            <ClipboardCheck className="w-3 h-3" /> Survey Approval
          </span>
        );
      case 'TRANSFER_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800">
            <ArrowRightLeft className="w-3 h-3" /> Transfer Approval
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in" id="approvals-management-root">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-white rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Approval Management System
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
                CMS CONTROL
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Review and authorize field registrations, incharge appointments, voter data corrections, and survey reports.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1.5 text-xs font-bold disabled:opacity-50"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          {(onClose || onBack) && (
            <button
              onClick={onClose || onBack}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Feedback banner */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{feedbackMessage.text}</span>
          <button onClick={() => setFeedbackMessage(null)} className="text-slate-500 hover:text-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Overview Grid (matches specification) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div
          onClick={() => setActiveTab('USER_REGISTRATION')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            activeTab === 'USER_REGISTRATION'
              ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-400/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <UserPlus className="w-5 h-5" />
            <span className="text-2xl font-black text-slate-900">{stats.userRegistrations}</span>
          </div>
          <div className="text-xs font-bold text-slate-700">User Registration</div>
          <div className="text-[10px] text-slate-400 font-medium">Cadre self-enrolment</div>
        </div>

        <div
          onClick={() => setActiveTab('INCHARGE_APPROVAL')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            activeTab === 'INCHARGE_APPROVAL'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <UserCheck className="w-5 h-5" />
            <span className="text-2xl font-black text-slate-900">{stats.inchargeRequests}</span>
          </div>
          <div className="text-xs font-bold text-slate-700">Incharge Requests</div>
          <div className="text-[10px] text-slate-400 font-medium">New jurisdictional posts</div>
        </div>

        <div
          onClick={() => setActiveTab('DATA_CORRECTION')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            activeTab === 'DATA_CORRECTION'
              ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-400/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-purple-600 mb-2">
            <FileCheck className="w-5 h-5" />
            <span className="text-2xl font-black text-slate-900">{stats.dataCorrections}</span>
          </div>
          <div className="text-xs font-bold text-slate-700">Data Corrections</div>
          <div className="text-[10px] text-slate-400 font-medium">Voter status & relations</div>
        </div>

        <div
          onClick={() => setActiveTab('SURVEY_APPROVAL')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            activeTab === 'SURVEY_APPROVAL'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <ClipboardCheck className="w-5 h-5" />
            <span className="text-2xl font-black text-slate-900">{stats.surveyApprovals}</span>
          </div>
          <div className="text-xs font-bold text-slate-700">Survey Approvals</div>
          <div className="text-[10px] text-slate-400 font-medium">Verified field surveys</div>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: 'ALL', label: 'All Categories' },
            { id: 'USER_REGISTRATION', label: 'Registrations' },
            { id: 'INCHARGE_APPROVAL', label: 'Incharges' },
            { id: 'DATA_CORRECTION', label: 'Corrections' },
            { id: 'SURVEY_APPROVAL', label: 'Surveys' },
            { id: 'TRANSFER_APPROVAL', label: 'Transfers' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status toggle & Search input */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition-all ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search request..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Approval Requests Table / List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-bold text-sm flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
            Loading approval requests...
          </div>
        ) : filteredApprovals.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No requests found</h3>
            <p className="text-xs text-slate-400">
              {statusFilter === 'PENDING'
                ? 'All pending approval requests in this category have been processed.'
                : 'No approval history matches the selected filters.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredApprovals.map((item) => (
              <div
                key={item.id}
                className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {getTypeBadge(item.type)}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        item.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-800'
                          : item.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {item.status}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3" />
                      {new Date(item.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 leading-snug">{item.title}</h4>
                  {item.description && (
                    <p className="text-xs text-slate-500 font-medium line-clamp-1">{item.description}</p>
                  )}

                  <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-3 pt-1">
                    <span>
                      Requested by: <strong className="text-slate-800">{item.requestedByName}</strong>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>Role: {item.requestedByRole.replace(/_/g, ' ')}</span>
                    {item.requestedByMobile && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Phone className="w-2.5 h-2.5" />
                          {item.requestedByMobile}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={() => {
                      setSelectedItem(item);
                      setIsRejecting(false);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    Review
                  </button>

                  {item.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => handleApprove(item)}
                        disabled={actionLoading}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider transition-colors shadow-xs flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setSelectedItem(item);
                          setIsRejecting(true);
                        }}
                        disabled={actionLoading}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review & Action Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Review Request</h3>
                  <div className="text-xs text-slate-400 font-medium">ID: {selectedItem.id.slice(0, 8)}...</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs font-medium text-slate-700">
              <div className="flex items-center justify-between">
                <div>{getTypeBadge(selectedItem.type)}</div>
                <span className="font-bold text-slate-500">
                  Status: <strong className="text-slate-900">{selectedItem.status}</strong>
                </span>
              </div>

              <div>
                <h4 className="text-sm font-black text-slate-900">{selectedItem.title}</h4>
                {selectedItem.description && (
                  <p className="text-slate-600 text-xs mt-1 leading-relaxed">{selectedItem.description}</p>
                )}
              </div>

              {/* Requester details block */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="text-[10px] uppercase font-black text-slate-400 tracking-wider">
                  REQUESTER CREDENTIALS
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Name:</span>
                  <span className="font-bold text-slate-800">{selectedItem.requestedByName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cadre Role:</span>
                  <span className="font-bold text-slate-800">{selectedItem.requestedByRole}</span>
                </div>
                {selectedItem.requestedByMobile && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Contact:</span>
                    <span className="font-bold text-slate-800">{selectedItem.requestedByMobile}</span>
                  </div>
                )}
              </div>

              {/* Payload Breakdown */}
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase font-black text-slate-400 tracking-wider">
                  SUBMITTED PAYLOAD / DIFF DETAILS
                </div>
                <div className="p-3.5 bg-slate-900 text-amber-300 font-mono text-[11px] rounded-2xl overflow-x-auto leading-relaxed">
                  <pre>{JSON.stringify(selectedItem.payload, null, 2)}</pre>
                </div>
              </div>

              {/* Rejection reason box if rejecting */}
              {isRejecting && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
                  <label className="block text-xs font-bold text-rose-800">Reason for Rejection *</label>
                  <textarea
                    rows={2}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Provide specific feedback or discrepancies found..."
                    className="w-full p-2.5 rounded-xl border border-rose-300 text-xs font-medium text-slate-800 bg-white focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer actions */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50/50">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100"
              >
                Close
              </button>

              {selectedItem.status === 'PENDING' && (
                <>
                  {!isRejecting ? (
                    <>
                      <button
                        onClick={() => setIsRejecting(true)}
                        className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold hover:bg-rose-100"
                      >
                        Reject...
                      </button>
                      <button
                        onClick={() => handleApprove(selectedItem)}
                        disabled={actionLoading}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {actionLoading ? 'Processing...' : 'Approve Request'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleReject(selectedItem)}
                      disabled={actionLoading}
                      className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider shadow-sm"
                    >
                      {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
