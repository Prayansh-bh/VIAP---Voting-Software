import React, { useEffect, useState, useMemo } from 'react';
import {
  AlertTriangle,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
  ArrowRight,
  Zap,
  Copy,
  Check,
} from 'lucide-react';
import { CommandRole, UserSession } from '../types';
import { requestOtp, verifyOtp, loginAsDemoRole } from '../lib/api';
import { useCms } from '../context/CmsContext';

const ROLE_TO_LEVEL: Record<string, string> = {
  STATE_ADMIN: 'STATE',
  ZONE_INCHARGE: 'ZONE',
  PARLIAMENT_INCHARGE: 'PARLIAMENT',
  CONSTITUENCY_INCHARGE: 'CONSTITUENCY',
  MANDAL_INCHARGE: 'MANDAL',
  VILLAGE_INCHARGE: 'VILLAGE',
  BOOTH_PRESIDENT: 'BOOTH',
  VOTER_100_INCHARGE: 'VOTER_GROUP',
};

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

const DEMO_MOBILE_SET = new Set(ROLE_DEMO_PROFILES.map((p) => p.mobile));

export default function OtpLoginModal({ role, onClose, onSuccess }: OtpLoginModalProps) {
  const currentDemo = ROLE_DEMO_PROFILES.find((p) => p.roleId === role.id) || {
    roleId: role.id,
    name: role.name,
    title: role.subtitle,
    mobile: '9848012345',
    badge: 'Incharge',
  };

  // Tab: 'login' = Registered Mobile Login, 'demo' = 1-Click Demo Accounts
  const [activeTab, setActiveTab] = useState<'login' | 'demo'>('login');

  const { config } = useCms();
  const enabledLevels = useMemo(() => {
    if (Array.isArray(config.activeHierarchyLevels) && config.activeHierarchyLevels.length > 0) {
      return config.activeHierarchyLevels;
    }
    try {
      const saved = localStorage.getItem('kdp_cms_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.activeHierarchyLevels) && parsed.activeHierarchyLevels.length > 0) {
          return parsed.activeHierarchyLevels;
        }
      }
    } catch {}
    return ['STATE', 'ZONE', 'PARLIAMENT', 'DISTRICT', 'CONSTITUENCY', 'MANDAL', 'VILLAGE', 'BOOTH', 'VOTER_GROUP'];
  }, [config.activeHierarchyLevels]);

  const filteredDemoProfiles = useMemo(() => {
    return ROLE_DEMO_PROFILES.filter((item) => {
      const level = ROLE_TO_LEVEL[item.roleId];
      return !level || enabledLevels.includes(level);
    });
  }, [enabledLevels]);

  // Login form state
  const [mobileInput, setMobileInput] = useState('');
  const [channel, setChannel] = useState<'SMS' | 'WHATSAPP'>('WHATSAPP');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingRoleId, setSubmittingRoleId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // OTP Verification state
  const [requestId, setRequestId] = useState<string | null>(null);
  const [mobileNumber, setMobileNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const isVerifying = Boolean(requestId);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Request OTP for a registered mobile number
  const handleRequestOtp = async (e?: React.FormEvent, customMobile?: string) => {
    if (e) e.preventDefault();
    if (cooldown > 0 && !customMobile) return;

    const targetNum = (customMobile || mobileInput).replace(/\D/g, '').slice(-10);
    if (targetNum.length < 10) {
      setError('Please enter a valid 10-digit registered mobile number.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const response = await requestOtp(targetNum, role.id, channel, { devMode: true });

      setRequestId(response.requestId);
      setCooldown(response.cooldownSeconds || 30);
      setMobileNumber(targetNum);
      setOtpCode('');
    } catch (err: any) {
      setError(
        err?.message ||
          `Mobile number +91 ${targetNum} is not registered with any active political party. Please register your party or contact your administrator.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verify OTP and issue access token
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
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired OTP code. Please check your code and retry.');
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

        {/* Tab Selector: Registered Mobile Login | Preset Demo Accounts */}
        {!isVerifying && (
          <div className="px-5 pt-4 pb-1 shrink-0">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setError('');
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'login'
                    ? 'bg-amber-400 text-slate-950 shadow-sm font-black'
                    : 'text-slate-600 hover:text-slate-900 font-bold'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 text-slate-950" />
                <span>Registered Account</span>
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
                <span>Demo Showcase</span>
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
          {/* VIEW A: REGISTERED ACCOUNT LOGIN (OTP REQUEST) */}
          {/* ========================================================== */}
          {!isVerifying && activeTab === 'login' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-slate-50 via-slate-100/70 to-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-xs text-slate-700 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-black text-slate-900 text-xs">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Official Party Authentication
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    Active Tenants Only
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Enter your <strong>10-digit mobile number</strong> registered with your political party. An authoritative OTP will be sent to your device.
                </p>
              </div>

              <form onSubmit={handleRequestOtp} className="space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Mobile Number (10-Digit Login ID) *
                    </label>
                    <span className="text-[10px] font-bold text-slate-400">Must be registered to an active party</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                      +91
                    </span>
                    <input
                      type="tel"
                      value={mobileInput}
                      onChange={(e) => setMobileInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="e.g. 9425664690 or registered mobile"
                      className="w-full pl-12 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-bold focus:bg-white focus:border-amber-400 focus:outline-none transition-all font-mono tracking-wider"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                {/* Channel Selection Toggle: WhatsApp vs SMS */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Dispatch Channel
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

                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Logging into</span>
                    <span className="text-xs font-black text-slate-800">{role.name}</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    {role.id}
                  </span>
                </div>

                {/* Primary Action Button: Dispatches Real OTP */}
                <button
                  type="submit"
                  disabled={isSubmitting || mobileInput.replace(/\D/g, '').length < 10}
                  className="w-full py-3 bg-gradient-to-r from-amber-400 via-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  {isSubmitting ? (
                    <LoaderCircle className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <Zap className="w-4 h-4 text-slate-950 fill-slate-950" />
                  )}
                  <span>Send Verification Code</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}

          {/* ========================================================== */}
          {/* VIEW B: PRESET DEMO ACCOUNTS (1-CLICK SHOWCASE) */}
          {/* ========================================================== */}
          {!isVerifying && activeTab === 'demo' && (
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
                    SaaS Showcase Demo Directory
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">1-Tap Demo Access</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredDemoProfiles.map((item) => {
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
          {/* VIEW C: OTP VERIFICATION STEP */}
          {/* ========================================================== */}
          {isVerifying && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3 text-[12px] text-emerald-950 flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  A 6-digit verification code has been dispatched to your <strong>WhatsApp</strong> (+91 {mobileNumber}). Please check your WhatsApp app and enter the code below.
                </span>
              </div>

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
                    onClick={() => handleRequestOtp(undefined, mobileNumber)}
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
                  Verify & Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
