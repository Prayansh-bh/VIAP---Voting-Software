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
  UserPlus,
  Copy,
  Check,
} from 'lucide-react';
import { CommandRole, UserSession } from '../types';
import { requestOtp, verifyOtp, loginAsDemoRole, loginAsDevUser } from '../lib/api';

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
    roleId: 'VILLAGE_INCHARGE',
    name: 'Village Incharge',
    title: 'Gram Panchayat & Local Ward',
    mobile: '9848010001',
    badge: 'Village',
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

  // Tab: 'dev' = In-App Dev Mode (New / Any User), 'demo' = Preset Accounts, 'live' = Live Gateway
  const [activeTab, setActiveTab] = useState<'dev' | 'demo' | 'live'>('dev');

  // Dev Mode Custom User State
  const [devMobile, setDevMobile] = useState('');
  const [devName, setDevName] = useState('');
  const [devOtpDisplay, setDevOtpDisplay] = useState('');
  const [copied, setCopied] = useState(false);

  // OTP Flow State
  const [mobileNumber, setMobileNumber] = useState(currentDemo.mobile);
  const [otpCode, setOtpCode] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);

  const [channel, setChannel] = useState<'SMS' | 'WHATSAPP'>('WHATSAPP');
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

  // 1-Click Instant In-App Dev Login for ANY Mobile / New User
  const handleDevInstantLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = devMobile.replace(/\D/g, '').slice(-10);
    if (clean.length < 10) {
      setError('Please enter a valid 10-digit mobile number for In-App Dev Mode.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      const result = await loginAsDevUser(clean, role.id, devName.trim() || undefined);
      onSuccess(result.session, result.token);
    } catch (err: any) {
      setError(err?.message || 'Failed to authenticate in Dev Mode.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Simulate In-App Dev OTP for ANY Mobile / New User
  const handleDevRequestOtp = async () => {
    const clean = devMobile.replace(/\D/g, '').slice(-10);
    if (clean.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      const response = await requestOtp(clean, role.id, 'SMS', {
        devMode: true,
        name: devName.trim() || undefined,
      });
      setRequestId(response.requestId);
      setCooldown(response.cooldownSeconds || 10);
      setMobileNumber(clean);
      const code = response.devOtp || '123456';
      setDevOtpDisplay(code);
      setOtpCode(code);
      setActiveTab('live'); // switches to OTP verification view seamlessly
    } catch (err: any) {
      setError(err?.message || 'Failed to generate Dev OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  // Request OTP via Live Gateway or MSG91/Twilio
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
      const response = await requestOtp(numToUse, role.id, channel, {
        devMode: true,
      });
      setRequestId(response.requestId);
      setCooldown(response.cooldownSeconds || 30);
      const demoNumbers = [
        '9848012345', '9848088888', '9848088887', '9848099998', '9848099999',
        '9848077777', '9848010001', '9848010002', '9848010003', '9848010004',
        '9848010005', '9998887777', '9736654406'
      ];
      if (response?.devOtp) {
        setDevOtpDisplay(response.devOtp);
        setOtpCode(response.devOtp);
      } else if (demoNumbers.includes(numToUse)) {
        setDevOtpDisplay('123456');
        setOtpCode('123456');
      }
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

  const handleCopyOtp = (code: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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

        {/* Tab Selector: Dev Mode (Default) | Demo Accounts | Live Gateway */}
        {otpMode === 'request' && (
          <div className="px-5 pt-4 pb-1 shrink-0">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('dev');
                  setError('');
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'dev'
                    ? 'bg-amber-400 text-slate-950 shadow-sm font-black'
                    : 'text-slate-600 hover:text-slate-900 font-bold'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-slate-950 fill-slate-950" />
                <span>In-App Dev Mode</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('demo');
                  setError('');
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'demo'
                    ? 'bg-white text-slate-950 shadow-sm border border-slate-200/50 font-black'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Preset Demo</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('live');
                  setError('');
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'live'
                    ? 'bg-white text-slate-950 shadow-sm border border-slate-200/50 font-black'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 text-slate-600" />
                <span>Live Gateway</span>
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 1: IN-APP DEV MODE (NEW / ANY USER ONBOARDING) */}
          {/* ========================================================== */}
          {otpMode === 'request' && activeTab === 'dev' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-amber-50 via-amber-100/50 to-amber-50 border border-amber-200/80 rounded-2xl p-3.5 text-xs text-amber-950 font-medium leading-relaxed space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-black text-amber-900 text-xs">
                    <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
                    ⚡ In-App Dev Mode Active
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                    No External SMS Needed
                  </span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Enter <strong>any 10-digit mobile number</strong> to register & sign in as a new user. The system auto-provisions your account with full operational command.
                </p>
              </div>

              <form onSubmit={handleDevInstantLogin} className="space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Mobile Number (Any 10-Digit)
                    </label>
                    <span className="text-[10px] font-bold text-slate-400">New or Existing</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                      +91
                    </span>
                    <input
                      type="tel"
                      value={devMobile}
                      onChange={(e) => setDevMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="e.g. 9876543210"
                      className="w-full pl-12 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-bold focus:bg-white focus:border-amber-400 focus:outline-none transition-all font-mono tracking-wider"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Leader / Candidate Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={devName}
                    onChange={(e) => setDevName(e.target.value)}
                    placeholder="e.g. Priya Sharma / Dev Leader"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:bg-white focus:border-amber-400 focus:outline-none transition-all"
                  />
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Command Station Role</span>
                    <span className="text-xs font-black text-slate-800">{role.name}</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    {role.id}
                  </span>
                </div>

                {/* Primary 1-Click Action */}
                <button
                  type="submit"
                  disabled={isSubmitting || devMobile.replace(/\D/g, '').length < 10}
                  className="w-full py-3 bg-gradient-to-r from-amber-400 via-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  {isSubmitting ? (
                    <LoaderCircle className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <Zap className="w-4 h-4 text-slate-950 fill-slate-950" />
                  )}
                  <span>⚡ Instant 1-Click Sign In as New User</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                {/* Secondary Simulated OTP Action */}
                <button
                  type="button"
                  onClick={handleDevRequestOtp}
                  disabled={isSubmitting || devMobile.replace(/\D/g, '').length < 10}
                  className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Simulate In-App OTP & Verify</span>
                </button>
              </form>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-[11px] text-slate-500 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Zero external gateway dependencies. Works offline and in local dev.</span>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 2: PRESET DEMO ACCOUNTS (1-CLICK DIRECTORY) */}
          {/* ========================================================== */}
          {otpMode === 'request' && activeTab === 'demo' && (
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
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 3: LIVE GATEWAY (SMS/WHATSAPP) OR OTP VERIFY */}
          {/* ========================================================== */}
          {(otpMode === 'verify' || activeTab === 'live') && (
            <div className="space-y-4">
              {otpMode === 'request' ? (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 font-medium leading-relaxed flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="font-bold text-amber-950 block">Live SMS / WhatsApp Gateway</span>
                      <span>Dispatches 6-digit OTP via configured provider (with simulated Dev fallback).</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">Mobile Number</label>
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

                  {/* Channel Selection Toggle: WhatsApp vs SMS */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Dispatch OTP Channel
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setChannel('WHATSAPP')}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          channel === 'WHATSAPP'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs font-black'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                        }`}
                      >
                        <span className="text-sm">💬</span>
                        <span>WhatsApp OTP</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setChannel('SMS')}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          channel === 'SMS'
                            ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-2xs font-black'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                        }`}
                      >
                        <span className="text-sm">📱</span>
                        <span>SMS OTP</span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || mobileNumber.length < 10}
                    className="w-full py-3 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-200 disabled:text-slate-400 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed active:scale-98"
                  >
                    {isSubmitting ? <LoaderCircle className="w-4 h-4 animate-spin" /> : null}
                    <span>Request {channel === 'WHATSAPP' ? 'WhatsApp' : 'SMS'} Verification Code</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                /* ========================================================== */
                /* OTP VERIFICATION STEP */
                /* ========================================================== */
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  {/* In-App Dev Mode OTP Display Banner */}
                  {(devOtpDisplay || otpCode) && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-950 uppercase tracking-wide">
                          <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          ⚡ In-App Dev Mode Active
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full">
                          Auto-Filled
                        </span>
                      </div>
                      <div className="flex items-center justify-between bg-white border border-emerald-200 rounded-xl p-2.5">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Your Verification Code
                          </span>
                          <span className="font-mono text-xl font-black text-emerald-700 tracking-[0.25em]">
                            {devOtpDisplay || otpCode}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyOtp(devOtpDisplay || otpCode)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          {copied ? (
                            <>
                              <Check className="w-3 h-3 text-white" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-white" />
                              <span>Copy Code</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] text-emerald-800 font-medium">
                        External SMS/WhatsApp skipped in Dev Mode. Click <strong>Verify & Remember Device</strong> below.
                      </p>
                    </div>
                  )}

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 font-semibold flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Verifying Mobile Number</span>
                      <span className="font-mono text-slate-900 font-bold">+91 {mobileNumber}</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                      {role.name}
                    </span>
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
                        setDevOtpDisplay('');
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
