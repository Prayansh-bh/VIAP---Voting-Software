'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  KeyRound,
  RefreshCw,
  LoaderCircle,
  AlertTriangle,
  Lock,
  Zap,
  Building2,
  Users2,
  Vote,
  Radio,
  CheckCircle2,
} from 'lucide-react';
import { useCms } from '../context/CmsContext';
import { requestOtp, verifyOtp } from '../lib/api';
import { UserSession } from '../types';

interface LoginPageProps {
  onLoginSuccess: (session: UserSession, token: string) => void;
  onBackToLanding: () => void;
}

export default function LoginPage({ onLoginSuccess, onBackToLanding }: LoginPageProps) {
  const { config, activeParty } = useCms();

  // Form states
  const [mobileInput, setMobileInput] = useState('');
  const [channel, setChannel] = useState<'SMS' | 'WHATSAPP'>('WHATSAPP');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // OTP Verification state
  const [requestId, setRequestId] = useState<string | null>(null);
  const [verifiedMobile, setVerifiedMobile] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const isVerifying = Boolean(requestId);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Request OTP handler
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
      // Role is omitted so backend dynamically resolves authorized account and jurisdiction
      const response = await requestOtp(targetNum, undefined, channel);

      setRequestId(response.requestId);
      setCooldown(response.cooldownSeconds || 30);
      setVerifiedMobile(targetNum);
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

  // Verify OTP handler
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestId || otpCode.length < 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const result = await verifyOtp(requestId, otpCode);
      onLoginSuccess(result.session, result.token);
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired OTP code. Please verify your code and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const primaryColor = config.primaryColor || '#FF6600';
  const partyTitle = config.organisationName || config.headerTitle || 'Political Command Station';
  const stateLabel = config.stateName || 'Statewide';

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950 relative overflow-x-hidden font-sans">
      {/* Background ambient lighting */}
      <div
        className="absolute top-0 left-0 w-[550px] h-[550px] rounded-full blur-[140px] opacity-20 pointer-events-none -z-10"
        style={{ backgroundColor: primaryColor }}
      />
      <div className="absolute bottom-0 right-0 w-[450px] h-[450px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Top Utility Bar */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md z-20">
        <button
          onClick={onBackToLanding}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Return to Overview</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline">
            Secure Command Gateway • Port 3000
          </span>
        </div>
      </header>

      {/* Main Split Grid Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* ========================================================= */}
          {/* LEFT COLUMN: HERO COMMAND BRANDING (DESKTOP) */}
          {/* ========================================================= */}
          <div className="hidden lg:flex lg:col-span-7 flex-col justify-between space-y-8 pr-4">
            <div className="space-y-6">
              {/* Active Workspace Crest */}
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-xs"
                  style={{ backgroundColor: primaryColor }}
                >
                  {(config.activePartyCode || 'VIAP').slice(0, 3)}
                </div>
                <div>
                  <div className="text-xs font-black tracking-wider text-slate-200 uppercase">
                    {partyTitle}
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium">
                    {stateLabel} • Official Operational Workspace
                  </div>
                </div>
              </div>

              {/* Main Headline */}
              <div className="space-y-3">
                <h1 className="text-4xl xl:text-5xl font-black text-white tracking-tight leading-tight">
                  Unified Political Command &amp; Field Telemetry
                </h1>
                <p className="text-base text-slate-400 font-normal leading-relaxed max-w-xl">
                  {config.slogan ||
                    'Authoritative voter management, real-time live vote tracking, booth defense, and multi-tier organizational command.'}
                </p>
              </div>

              {/* Feature Highlights Grid */}
              <div className="grid grid-cols-2 gap-3.5 pt-2 max-w-xl">
                <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                    <Radio className="w-4 h-4" />
                    <span>Live Turnout Velocity</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Real-time booth tracking &amp; fake voter objections
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <Building2 className="w-4 h-4" />
                    <span>Jurisdiction Routing</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Direct access to state, constituency, or booth
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                  <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold">
                    <Users2 className="w-4 h-4" />
                    <span>Cadre Network</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    100-voter incharges &amp; polling agent hierarchy
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                  <div className="flex items-center gap-2 text-purple-400 text-xs font-bold">
                    <Lock className="w-4 h-4" />
                    <span>Zero-Trust Security</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Strict multi-tenant cryptographic isolation
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Security Assurance Banner */}
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-900/40 border border-slate-800/60 max-w-xl">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-xs text-slate-400 leading-snug">
                Protected by 256-bit AES token encryption. Mobile-bound OTP authentication prevents credential theft and unauthorized election interference.
              </p>
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: PROFESSIONAL AUTHENTICATION STATION */}
          {/* ========================================================= */}
          <div className="w-full lg:col-span-5">
            <div className="w-full max-w-md mx-auto bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden">
              {/* Subtle top indicator bar */}
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{
                  background: `linear-gradient(90deg, ${primaryColor} 0%, #10b981 100%)`,
                }}
              />

              {/* Station Header */}
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[10px] font-black uppercase tracking-wider text-amber-400">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Command Station Authentication</span>
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  {isVerifying ? 'Enter Security Passcode' : 'Sign In to Station'}
                </h2>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  {isVerifying
                    ? `Enter the 6-digit OTP code sent to your ${channel === 'WHATSAPP' ? 'WhatsApp' : 'mobile phone'}.`
                    : 'Enter your 10-digit registered mobile number. Your role and jurisdiction will be verified automatically.'}
                </p>
              </div>

              {/* Error Notification Alert */}
              {error && (
                <div className="p-3.5 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs font-semibold flex items-start gap-2.5 animate-shake">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              {/* ===================================================== */}
              {/* STEP 1: PHONE NUMBER & CHANNEL SELECTION */}
              {/* ===================================================== */}
              {!isVerifying && (
                <form onSubmit={handleRequestOtp} className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-300">
                      Mobile Number (Registered Login ID) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 font-mono">
                        +91
                      </span>
                      <input
                        type="tel"
                        value={mobileInput}
                        onChange={(e) => setMobileInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="e.g. 9340423885 or registered mobile"
                        className="w-full pl-13 pr-4 py-3 bg-slate-950/90 border border-slate-700/80 rounded-2xl text-sm font-mono text-white font-bold placeholder:text-slate-600 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all tracking-wider"
                        required
                        autoFocus
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium block">
                      Must be registered to an active political party in CMS Studio
                    </span>
                  </div>

                  {/* Delivery Channel Radio / Buttons */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-300">
                      OTP Dispatch Protocol
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setChannel('WHATSAPP')}
                        className={`py-2.5 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          channel === 'WHATSAPP'
                            ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-sm'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>WhatsApp OTP</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setChannel('SMS')}
                        className={`py-2.5 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          channel === 'SMS'
                            ? 'bg-amber-950/60 border-amber-500 text-amber-300 shadow-sm'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>SMS Gateway</span>
                      </button>
                    </div>
                  </div>

                  {/* Primary Submit CTA */}
                  <button
                    type="submit"
                    disabled={isSubmitting || mobileInput.length < 10}
                    className="w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] transition-all shadow-lg shadow-amber-400/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <LoaderCircle className="w-4 h-4 animate-spin text-slate-950" />
                    ) : (
                      <>
                        <span>Request Security Passcode</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* ===================================================== */}
              {/* STEP 2: OTP VERIFICATION FORM */}
              {/* ===================================================== */}
              {isVerifying && (
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  <div className="p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-200 text-xs space-y-1">
                    <div className="flex items-center gap-2 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Code Dispatched Successfully</span>
                    </div>
                    <p className="text-[11px] text-emerald-300/80">
                      Dispatched to <strong>+91 {verifiedMobile}</strong> via{' '}
                      {channel === 'WHATSAPP' ? 'WhatsApp' : 'SMS'}.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-300">
                        Enter 6-Digit Passcode
                      </label>
                      <button
                        type="button"
                        disabled={cooldown > 0 || isSubmitting}
                        onClick={() => handleRequestOtp(undefined, verifiedMobile)}
                        className="text-[11px] font-bold text-amber-400 hover:text-amber-300 disabled:text-slate-500 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <RefreshCw className={`w-3 h-3 ${isSubmitting ? 'animate-spin' : ''}`} />
                        {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                      </button>
                    </div>

                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="------"
                      className="w-full py-3.5 bg-slate-950/90 border border-slate-700/80 rounded-2xl text-center text-2xl font-mono text-white font-black tracking-[0.5em] placeholder:text-slate-700 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all shadow-inner"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setRequestId(null);
                        setOtpCode('');
                        setError('');
                      }}
                      className="py-3 px-4 rounded-2xl border border-slate-700 bg-slate-800/80 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors cursor-pointer"
                    >
                      Change Number
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmitting || otpCode.length < 6}
                      className="flex-1 py-3 px-4 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] transition-all shadow-lg shadow-amber-400/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <LoaderCircle className="w-4 h-4 animate-spin text-slate-950" />
                      ) : (
                        <>
                          <span>Verify &amp; Enter Station</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Security Footer Note */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>256-Bit Encrypted</span>
                </span>
                <span>Active Tenant Enforced</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Page Footer */}
      <footer className="w-full px-6 py-4 border-t border-slate-800/80 bg-slate-950/80 text-center text-xs text-slate-400">
        VIAP Multi-Tenant SaaS Command Infrastructure • Compliant with Election Commission Protocols
      </footer>
    </div>
  );
}
