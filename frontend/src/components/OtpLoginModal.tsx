import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
  ArrowRight,
  Zap,
  Users,
  Building,
  Crown,
} from 'lucide-react';
import { CommandRole, UserSession } from '../types';
import { requestOtp, verifyOtp, loginAsDemoRole } from '../lib/api';

interface OtpLoginModalProps {
  role: CommandRole;
  onClose: () => void;
  onSuccess: (session: UserSession, token: string) => void;
}

export const ROLE_DEMO_PROFILES: Array<{
  roleId: string;
  name: string;
  title: string;
  mobile: string;
  badge: string;
}> = [
  {
    roleId: 'CONSTITUENCY_INCHARGE',
    name: 'Constituency Incharge',
    title: 'Assembly Constituency Command (MLA)',
    mobile: '9848012345',
    badge: 'MLA Seat',
  },
  {
    roleId: 'STATE_ADMIN',
    name: 'State Incharge',
    title: 'Statewide War Room & Apex Command',
    mobile: '9848088888',
    badge: 'Apex',
  },
  {
    roleId: 'PARLIAMENT_INCHARGE',
    name: 'Parliament Incharge',
    title: 'Parliament MP War Room',
    mobile: '9848088887',
    badge: 'MP Seat',
  },
  {
    roleId: 'ZONE_INCHARGE',
    name: 'Zone Coordinator',
    title: 'Multi-Parliament Zone Command',
    mobile: '9848099998',
    badge: 'Regional',
  },
  {
    roleId: 'SUPER_ADMIN',
    name: 'Super Administrator',
    title: 'System Governance & Telemetry',
    mobile: '9848099999',
    badge: 'System',
  },
  {
    roleId: 'MANDAL_INCHARGE',
    name: 'Mandal President',
    title: 'Mandal Level Leadership',
    mobile: '9848077777',
    badge: 'Mandal',
  },
  {
    roleId: 'BOOTH_PRESIDENT',
    name: 'Booth President',
    title: 'Polling Station Defense',
    mobile: '9848010002',
    badge: 'Booth',
  },
  {
    roleId: 'VOTER_100_INCHARGE',
    name: '100 Voter Incharge',
    title: '100-Voter Cluster Outreach',
    mobile: '9848010003',
    badge: 'Cluster',
  },
];

export const ROLE_DEMO_MOBILE_DIRECTORY: Record<string, { mobile: string; name: string; title: string }> =
  Object.fromEntries(
    ROLE_DEMO_PROFILES.map((p) => [p.roleId, { mobile: p.mobile, name: p.name, title: p.title }])
  );

export default function OtpLoginModal({ role, onClose, onSuccess }: OtpLoginModalProps) {
  const currentDemo = ROLE_DEMO_PROFILES.find((p) => p.roleId === role.id) || {
    roleId: role.id,
    name: role.name,
    title: role.subtitle,
    mobile: '9848012345',
    badge: 'Incharge',
  };

  const [activeTab, setActiveTab] = useState<'demo' | 'otp'>('demo');

  // OTP Flow State
  const [mobileNumber, setMobileNumber] = useState(currentDemo.mobile);
  const [otpCode, setOtpCode] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingRoleId, setSubmittingRoleId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const otpMode = useMemo(() => (requestId ? 'verify' : 'request'), [requestId]);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // 1-Click Instant Demo Authentication
  const handleInstantDemoLogin = async (targetRole: string) => {
    setError('');
    setIsSubmitting(true);
    setSubmittingRoleId(targetRole);

    try {
      const result = await loginAsDemoRole(targetRole);
      onSuccess(result.session, result.token);
    } catch (err: any) {
      setError(err?.message || 'Failed to authenticate demo account. Please retry.');
    } finally {
      setIsSubmitting(false);
      setSubmittingRoleId(null);
    }
  };

  // Request real OTP via MSG91
  const handleRequestOtp = async (event?: React.FormEvent, customMobile?: string) => {
    if (event) event.preventDefault();
    if (cooldown > 0) return;

    const numToUse = (customMobile || mobileNumber).replace(/\D/g, '').slice(-10);
    if (numToUse.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const response = await requestOtp(numToUse, role.id);
      setRequestId(response.requestId);
      setCooldown(response.cooldownSeconds || 30);
    } catch (requestError: any) {
      setError(requestError?.message || 'Failed to dispatch OTP. Please check mobile number.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verify OTP and authorize device
  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!requestId || otpCode.length < 6) {
      setError('Please enter the complete 6-digit OTP code.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const result = await verifyOtp(requestId, otpCode);
      onSuccess(result.session, result.token);
    } catch (verifyError: any) {
      setError(verifyError?.message || 'Invalid or expired OTP code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in font-sans">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-100 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center font-bold shadow-xs">
              <KeyRound className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 leading-tight">Command Station Login</h3>
              <p className="text-[11px] text-amber-700 font-bold mt-0.5">{role.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-5 pt-4 pb-1 shrink-0">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setActiveTab('demo');
                setError('');
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'demo'
                  ? 'bg-white text-slate-950 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Demo Accounts (Instant)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('otp');
                setError('');
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'otp'
                  ? 'bg-white text-slate-950 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-600" />
              <span>Mobile OTP (MSG91)</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 1: DEMO ACCOUNTS (INSTANT 1-CLICK ACCESS) */}
          {/* ========================================================== */}
          {activeTab === 'demo' && (
            <div className="space-y-4">
              {/* Featured 1-Click Action for current role */}
              <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 rounded-2xl p-4 text-white shadow-md relative overflow-hidden">
                <div className="relative z-10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/20 text-amber-100">
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      1-Click Instant Demo
                    </span>
                    <span className="text-[11px] font-mono font-bold text-amber-100 bg-white/10 px-2 py-0.5 rounded">
                      +91 {currentDemo.mobile}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-base font-black leading-tight text-white">{currentDemo.name}</h4>
                    <p className="text-[11px] text-amber-100 font-medium">{currentDemo.title}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleInstantDemoLogin(currentDemo.roleId)}
                    disabled={isSubmitting}
                    className="w-full py-2.5 bg-white hover:bg-amber-50 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    {isSubmitting && submittingRoleId === currentDemo.roleId ? (
                      <LoaderCircle className="w-4 h-4 animate-spin text-slate-950" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
                    )}
                    <span>Sign In Instantly as {currentDemo.name}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-700" />
                  </button>
                </div>
              </div>

              {/* All Demo Accounts Directory */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                    All Demo Accounts Directory
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">1-Tap to Login Any Role</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ROLE_DEMO_PROFILES.map((item) => {
                    const isCurrent = item.roleId === role.id;
                    const isItemSubmitting = isSubmitting && submittingRoleId === item.roleId;

                    return (
                      <div
                        key={item.roleId}
                        className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                          isCurrent
                            ? 'bg-amber-50/70 border-amber-300 shadow-2xs'
                            : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/80'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-slate-900 truncate">{item.name}</span>
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700">
                              {item.badge}
                            </span>
                          </div>
                          <div className="font-mono text-[10px] text-slate-500 flex items-center gap-1 font-semibold">
                            <span>+91 {item.mobile}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleInstantDemoLogin(item.roleId)}
                          disabled={isSubmitting}
                          className={`w-full py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-98 ${
                            isCurrent
                              ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-2xs'
                              : 'bg-white hover:bg-slate-900 hover:text-white text-slate-800 border border-slate-200 shadow-2xs'
                          }`}
                        >
                          {isItemSubmitting ? (
                            <LoaderCircle className="w-3 h-3 animate-spin" />
                          ) : (
                            <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                          )}
                          <span>Sign In</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Security Hint */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[11px] text-slate-600 font-medium flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Demo sessions register this device automatically for persistent zero-OTP access.</span>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 2: LIVE MOBILE NUMBER + MSG91 OTP */}
          {/* ========================================================== */}
          {activeTab === 'otp' && (
            <div className="space-y-4">
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 font-medium leading-relaxed flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-amber-950 block">Live MSG91 SMS / WhatsApp Verification</span>
                  <span>Enter any registered mobile number to receive a 6-digit OTP and remember this device.</span>
                </div>
              </div>

              {otpMode === 'request' ? (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">Registered Mobile Number</label>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileNumber(currentDemo.mobile);
                          setError('');
                        }}
                        className="text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        Fill Demo: {currentDemo.mobile}
                      </button>
                    </div>

                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                        +91
                      </span>
                      <input
                        type="tel"
                        value={mobileNumber}
                        onChange={(event) => setMobileNumber(event.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="Enter 10-digit mobile number"
                        className="w-full pl-12 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-bold focus:bg-white focus:border-amber-400 focus:outline-none transition-all font-mono tracking-wider"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || mobileNumber.length < 10}
                    className="w-full py-3 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-200 disabled:text-slate-400 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed active:scale-98"
                  >
                    {isSubmitting ? <LoaderCircle className="w-4 h-4 animate-spin" /> : null}
                    <span>Request Verification Code</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 font-semibold flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                    <div>
                      OTP dispatched to <span className="font-mono font-bold">+91 {mobileNumber}</span>.
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">Enter 6-Digit OTP</label>
                      <button
                        type="button"
                        disabled={cooldown > 0 || isSubmitting}
                        onClick={() => handleRequestOtp()}
                        className="text-[11px] font-bold text-amber-700 hover:text-amber-800 disabled:text-slate-400 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <RefreshCw className={`w-3 h-3 ${isSubmitting ? 'animate-spin' : ''}`} />
                        {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="------"
                      className="w-full text-center tracking-[0.4em] font-mono py-3 bg-slate-50 border border-slate-200 rounded-xl text-2xl text-slate-900 font-black focus:bg-white focus:border-amber-400 focus:outline-none transition-all shadow-inner"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setRequestId(null);
                        setOtpCode('');
                        setError('');
                      }}
                      className="flex-1 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Change Number
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || otpCode.length < 6}
                      className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-200 disabled:text-slate-400 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed active:scale-98"
                    >
                      {isSubmitting ? <LoaderCircle className="w-4 h-4 animate-spin" /> : null}
                      Verify & Remember Device
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
