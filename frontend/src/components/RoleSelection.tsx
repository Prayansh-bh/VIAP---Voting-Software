import React, { useMemo, useState, useEffect } from 'react';
import {
  Smartphone,
  KeyRound,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { CommandRole, RoleType, UserSession } from '../types';
import RoleCard from './RoleCard';
import { useCms } from '../context/CmsContext';
import { requestOtp, verifyOtp } from '../lib/api';

interface RoleSelectionProps {
  onSelectRole: (role: CommandRole) => void;
  onLock: () => void;
  onChangePasscode: () => void;
  isPanelLocked: boolean;
  onLoginSuccess?: (session: UserSession, token: string) => void;
}

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

export default function RoleSelection({ onSelectRole, onLock, onChangePasscode, isPanelLocked, onLoginSuccess }: RoleSelectionProps) {
  const { config, t } = useCms();

  // Direct Mobile OTP Login State
  const [mobileInput, setMobileInput] = useState('');
  const [channel, setChannel] = useState<'SMS' | 'WHATSAPP'>('WHATSAPP');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (cooldown > 0 && !requestId) return;

    const targetNum = mobileInput.replace(/\D/g, '').slice(-10);
    if (targetNum.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setError('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      // Direct login: role is omitted to let server resolve account & authorized role
      const res = await requestOtp(targetNum, undefined, channel);
      setRequestId(res.requestId);
      setCooldown(res.cooldownSeconds || 30);
      setSuccessMsg('OTP code sent to +91 ' + targetNum + '. Please enter the 6-digit code.');
    } catch (err: any) {
      setError(err?.message || 'Failed to dispatch OTP. Please check mobile number.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestId || otpCode.length < 6) {
      setError('Please enter the complete 6-digit OTP code.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const res = await verifyOtp(requestId, otpCode);
      if (onLoginSuccess) {
        onLoginSuccess(res.session, res.token);
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired OTP code.');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const activeRoles = useMemo<CommandRole[]>(() => {
    const allRoles: CommandRole[] = [
      // 1. State Incharge
      {
        id: 'STATE_ADMIN',
        name: t('STATE', 'State Incharge'),
        subtitle: `${config.stateName || 'State'} Command`,
        description: 'Statewide command & majority telemetry.',
        path: '/state',
        iconName: 'Building',
      },
      // 2. Zone Coordinator
      {
        id: 'ZONE_INCHARGE' as any,
        name: t('ZONE', 'Zone Coordinator'),
        subtitle: 'Multi-Parliament Oversight',
        description: 'Multi-Parliament zone level coordination.',
        path: '/zone',
        iconName: 'Building',
      },
      // 3. Parliament Incharge
      {
        id: 'PARLIAMENT_INCHARGE' as any,
        name: t('PARLIAMENT', 'Parliament Incharge'),
        subtitle: `${config.parliamentName || 'Lok Sabha'} MP Seat`,
        description: 'Parliament MP War Room Command.',
        path: '/parliament',
        iconName: 'Crown',
      },
      // 4. Constituency Incharge
      {
        id: 'CONSTITUENCY_INCHARGE',
        name: t('CONSTITUENCY', 'Constituency Incharge'),
        subtitle: `${config.constituencies?.[0]?.name || 'Assembly'} MLA Seat`,
        description: 'Assembly Constituency MLA operations.',
        path: '/constituency',
        iconName: 'Users',
      },
      // 5. Mandal President
      {
        id: 'MANDAL_INCHARGE',
        name: t('MANDAL', 'Mandal President'),
        subtitle: 'Mandal & Block Division',
        description: 'Mandal level cadre & booth oversight.',
        path: '/mandal/dashboard',
        iconName: 'Layers',
      },
      // 6. Village Incharge
      {
        id: 'VILLAGE_INCHARGE',
        name: t('VILLAGE', 'Village Incharge'),
        subtitle: 'Gram Panchayat & Local Ward',
        description: 'Village ward & local community unit.',
        path: '/village',
        iconName: 'Home',
      },
      // 7. Booth President
      {
        id: 'BOOTH_PRESIDENT',
        name: t('BOOTH', 'Booth President'),
        subtitle: 'Polling Booth Management',
        description: 'Polling booth command & voter turnout.',
        path: '/booth/dashboard',
        iconName: 'Vote',
      },
      // 8. 100 Voter Incharge
      {
        id: 'VOTER_100_INCHARGE',
        name: t('VOTER_GROUP', '100 Voters Incharge'),
        subtitle: 'Voter Family Cluster Committee',
        description: '100-voter cluster door-to-door outreach.',
        path: '/100-voter',
        iconName: 'Users',
      },
    ];

    // Filter strictly by enabled hierarchy tiers for this party application
    return allRoles.filter((role) => {
      const level = ROLE_TO_LEVEL[role.id];
      return !level || enabledLevels.includes(level);
    });
  }, [config, t, enabledLevels]);

  const scopeLabel = useMemo(() => {
    switch (config.appScope) {
      case 'SINGLE_MLA':
        return 'Configured for 1 MLA Candidate';
      case 'PARLIAMENT_MP':
        return `Configured for 1 MP + ${config.constituencies?.length || 7} MLA Candidates`;
      case 'ZONE':
        return 'Configured for Zone Level (~3 MPs + 21 MLAs)';
      case 'STATE':
        return `Statewide Command (${config.stateName})`;
      default:
        return 'Configured Jurisdictional Hierarchy';
    }
  }, [config]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 space-y-7 animate-fade-in" id="role-selection-section">
      {/* Current Workspace Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-xs"
            style={{ backgroundColor: config.primaryColor || '#f59e0b' }}
          >
            {(config.activePartyCode || 'APP').slice(0, 3)}
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Active Workspace: {config.organisationName || 'Political Connect'}</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                LIVE
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              {scopeLabel} • {config.stateName || 'Andhra Pradesh'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-medium text-[11px] text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-800">{activeRoles.length} Active Modules</span>
          </div>
        </div>
      </div>

      {/* Direct Mobile OTP Login Section */}
      <div className="bg-gradient-to-br from-white via-amber-50/30 to-white rounded-3xl border border-amber-200/90 shadow-sm p-5 sm:p-7 relative overflow-hidden" id="direct-otp-login-box">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-black uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
              <span>Direct Multi-Tier Mobile Login</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              One-Step Phone &amp; OTP Access
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
              Enter your registered mobile number. The server automatically authenticates your account, verifies your authorized hierarchy tier and jurisdiction, and routes you directly to your command dashboard without manual role selection.
            </p>
          </div>

          <div className="w-full lg:max-w-md bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
            {!requestId ? (
              <form onSubmit={handleRequestOtp} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Registered Mobile Number</span>
                    <span className="text-[10px] text-slate-400 font-semibold">10-Digit Mobile</span>
                  </label>
                  <div className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-amber-500 focus-within:border-amber-500 bg-slate-50/50">
                    <span className="text-xs font-black text-slate-500">+91</span>
                    <input
                      type="tel"
                      id="direct-mobile-input"
                      maxLength={10}
                      value={mobileInput}
                      onChange={(e) => setMobileInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="9848012345"
                      className="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none"
                    />
                    <Smartphone className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setChannel('WHATSAPP')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition border cursor-pointer ${channel === 'WHATSAPP' ? 'bg-emerald-50 border-emerald-400 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                  >
                    WhatsApp OTP
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel('SMS')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition border cursor-pointer ${channel === 'SMS' ? 'bg-amber-50 border-amber-400 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                  >
                    SMS OTP
                  </button>
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  id="direct-send-otp-btn"
                  disabled={isSubmitting || mobileInput.length < 10 || cooldown > 0}
                  className="w-full py-2.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider text-white bg-amber-500 hover:bg-amber-600 active:scale-[0.98] transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <LoaderCircle className="w-4 h-4 animate-spin" />
                  ) : cooldown > 0 ? (
                    `Resend in ${cooldown}s`
                  ) : (
                    <>
                      <span>Send Verification OTP</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-600">Enter 6-Digit OTP</span>
                  <button
                    type="button"
                    onClick={() => { setRequestId(null); setOtpCode(''); setError(''); }}
                    className="text-amber-600 hover:underline font-bold text-[11px] cursor-pointer"
                  >
                    Change (+91 {mobileInput})
                  </button>
                </div>

                <div className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-amber-500 bg-slate-50/50">
                  <KeyRound className="w-4 h-4 text-amber-600 shrink-0" />
                  <input
                    type="text"
                    id="direct-otp-input"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full bg-transparent text-center tracking-[0.4em] font-mono text-base font-black text-slate-900 focus:outline-none"
                    autoFocus
                  />
                </div>

                {successMsg && (
                  <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{successMsg}</span>
                  </p>
                )}

                {error && (
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    id="direct-verify-otp-btn"
                    disabled={isSubmitting || otpCode.length < 6}
                    className="flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <LoaderCircle className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Verify &amp; Launch</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting || cooldown > 0}
                    onClick={() => handleRequestOtp()}
                    className="px-3 py-2.5 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    title="Resend OTP"
                  >
                    {cooldown > 0 ? `${cooldown}s` : <RefreshCw className="w-4 h-4" />}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Title block */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-1 gap-2"
        id="role-selection-bar"
      >
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Select Command Role
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Choose your assigned command module to access role-specific intelligence, field operations, and reporting.
          </p>
        </div>
      </div>

      {/* Main card grid: Dynamically rendered according to selected hierarchy tiers */}
      {activeRoles.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <p className="text-slate-600 font-bold text-sm">
            No hierarchy levels are currently active.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5" id="roles-cards-grid">
          {activeRoles.map((role, idx) => (
            <RoleCard
              key={role.id}
              role={role}
              index={idx}
              onClick={() => onSelectRole(role)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
