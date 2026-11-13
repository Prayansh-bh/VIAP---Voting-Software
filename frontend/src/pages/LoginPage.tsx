import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  ShieldCheck,
  Smartphone,
  KeyRound,
  RefreshCw,
  LoaderCircle,
  AlertTriangle,
  Lock,
  Building2,
  Users2,
  Radio,
  CheckCircle2,
  Eye,
  EyeOff,
  Check,
  Crown,
  Sparkles,
} from 'lucide-react';
import { requestOtp, verifyOtp, loginWithPasscode } from '../lib/api';
import { UserSession } from '../types';

interface LoginPageProps {
  onLoginSuccess: (session: UserSession, token: string) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  // Authentication mode
  const [authMode, setAuthMode] = useState<'OTP' | 'PASSCODE'>('OTP');

  // Form states
  const [mobileInput, setMobileInput] = useState('9340423885');
  const [passcodeInput, setPasscodeInput] = useState('123456');
  const [showPasscode, setShowPasscode] = useState(false);
  const [channel, setChannel] = useState<'WHATSAPP' | 'SMS'>('WHATSAPP');
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

  // Passcode direct login handler
  const handlePasscodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = mobileInput.replace(/\D/g, '').slice(-10);
    const cleanPass = passcodeInput.trim();

    if (cleanNum.length < 10) {
      setError('Please enter your 10-digit registered mobile number.');
      return;
    }
    if (!cleanPass) {
      setError('Please enter your 6-digit allocated security passcode.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const result = await loginWithPasscode(cleanNum, cleanPass);
      onLoginSuccess(result.session, result.token);
    } catch (err: any) {
      setError(
        err?.message ||
          'Authentication failed. Please verify your registered mobile number and security passcode.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

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
      const response = await requestOtp(targetNum, undefined, channel);
      if (!response?.requestId) {
        throw new Error('Could not establish verification session. Please retry or use Security Passcode.');
      }
      setRequestId(response.requestId);
      setCooldown(response.cooldownSeconds || 30);
      setVerifiedMobile(targetNum);
      setOtpCode('');
    } catch (err: any) {
      setError(
        err?.message ||
          `Mobile number +91 ${targetNum} is not registered in the database. Please contact your party administrator.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verify OTP handler
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otpCode.trim();
    if (!requestId || cleanOtp.length < 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const result = await verifyOtp(requestId.trim(), cleanOtp);
      onLoginSuccess(result.session, result.token);
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired OTP code. Please verify your code and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'VIAP Mobile — Voter Intelligence Command';
    }
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#06070B] text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-white relative overflow-x-hidden font-sans">
      {/* Background ambient cyber glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[520px] h-[360px] bg-gradient-to-b from-blue-600/15 via-indigo-600/10 to-transparent rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-[420px] h-[300px] bg-cyan-500/10 rounded-full blur-[130px] pointer-events-none -z-10" />

      {/* Top Mobile Status Header */}
      <header className="w-full px-5 py-3.5 flex items-center justify-between border-b border-white/[0.08] bg-[#0C0E17]/90 backdrop-blur-md z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-white font-black text-xs shadow-lg shadow-cyan-500/25">
            <Crown className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-xs font-black tracking-wide text-white uppercase">VIAP Mobile</div>
            <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Cadre Operations Hub</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">LIVE SECURE</span>
        </div>
      </header>

      {/* Main Focused Mobile App Container */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-8 flex flex-col justify-center">
        
        {/* App Hero Branding */}
        <div className="text-center space-y-2.5 mb-7">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-[#0C0E17] border border-white/[0.1] shadow-2xl shadow-cyan-500/15 relative">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-cyan-500/30">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 border-2 border-[#0C0E17] flex items-center justify-center text-[10px] text-slate-950 font-black">
              ✓
            </div>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">VIAP Field Command</h1>
          <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">
            Voter Intelligence, Live Polling Telemetry &amp; Micro-Targeting
          </p>
        </div>

        {/* Focused Card Form */}
        <div className="w-full bg-[#0C0E17]/95 backdrop-blur-2xl border border-white/[0.08] rounded-3xl shadow-2xl shadow-black/80 p-6 sm:p-7 space-y-5 relative">
          
          {/* Subtle Top Indicator Cyber Gradient */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-400 rounded-t-3xl" />

          {/* Quick Preset Selector for Field Testing */}
          <div className="flex items-center justify-between text-[11px] pb-2 border-b border-white/[0.06]">
            <span className="text-slate-400 font-medium">Cadre Quick Login:</span>
            <button
              type="button"
              onClick={() => {
                setMobileInput('9340423885');
                setPasscodeInput('123456');
                setError('');
              }}
              className="text-cyan-400 hover:text-cyan-300 font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>+91 9340423885</span>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-black">
                FIELD INCHARGE
              </span>
            </button>
          </div>

          {/* Auth Mode Toggle: WhatsApp OTP vs Security Passcode */}
          {!isVerifying && (
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#06070B] rounded-2xl border border-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('OTP');
                  setError('');
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authMode === 'OTP'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-cyan-500/20 font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>WhatsApp OTP</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode('PASSCODE');
                  setError('');
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authMode === 'PASSCODE'
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-500/20 font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                <span>Passcode</span>
              </button>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* ===================================================== */}
          {/* MODE A: WHATSAPP / SMS OTP LOGIN */}
          {/* ===================================================== */}
          {!isVerifying && authMode === 'OTP' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Registered Mobile Number
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-cyan-400 font-mono">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={mobileInput}
                    onChange={(e) => setMobileInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9340423885"
                    className="w-full pl-13 pr-4 py-3 bg-[#08090E] border border-white/[0.12] rounded-2xl text-sm font-mono text-white font-bold placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all tracking-wider"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Channel Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Verification Channel
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setChannel('WHATSAPP')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      channel === 'WHATSAPP'
                        ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-sm'
                        : 'bg-[#08090E] border-white/[0.08] text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setChannel('SMS')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      channel === 'SMS'
                        ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 shadow-sm'
                        : 'bg-[#08090E] border-white/[0.08] text-slate-400 hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                    <span>SMS</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || mobileInput.length < 10}
                className="w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-[0.98] transition-all shadow-lg shadow-cyan-500/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <LoaderCircle className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ===================================================== */}
          {/* MODE B: DIRECT SECURITY PASSCODE LOGIN */}
          {/* ===================================================== */}
          {!isVerifying && authMode === 'PASSCODE' && (
            <form onSubmit={handlePasscodeLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Registered Mobile Number
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-cyan-400 font-mono">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={mobileInput}
                    onChange={(e) => setMobileInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9340423885"
                    className="w-full pl-13 pr-4 py-3 bg-[#08090E] border border-white/[0.12] rounded-2xl text-sm font-mono text-white font-bold placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all tracking-wider"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-300">
                    6-Digit Security Passcode
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {showPasscode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showPasscode ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPasscode ? 'text' : 'password'}
                    value={passcodeInput}
                    onChange={(e) => setPasscodeInput(e.target.value.slice(0, 20))}
                    placeholder="Default passcode: 123456"
                    className="w-full px-4 py-3 bg-[#08090E] border border-white/[0.12] rounded-2xl text-sm font-mono text-white font-bold placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all tracking-wider"
                    required
                  />
                </div>
                <span className="text-[10px] text-slate-400 block">
                  Default allocated field cadre passcode is <strong className="text-cyan-400">123456</strong>
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || mobileInput.length < 10 || !passcodeInput.trim()}
                className="w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-[0.98] transition-all shadow-lg shadow-cyan-500/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <LoaderCircle className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <span>Authenticate into Station</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ===================================================== */}
          {/* STEP 2: OTP VERIFICATION STEP */}
          {/* ===================================================== */}
          {isVerifying && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
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
                    Enter 6-Digit OTP Code
                  </label>
                  <button
                    type="button"
                    disabled={cooldown > 0 || isSubmitting}
                    onClick={() => handleRequestOtp(undefined, verifiedMobile)}
                    className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 hover:underline disabled:text-slate-500 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSubmitting ? 'animate-spin' : ''}`} />
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                  </button>
                </div>

                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full py-3.5 bg-[#08090E] border border-white/[0.12] rounded-2xl text-center text-2xl font-mono text-white font-black tracking-[0.5em] placeholder:text-slate-700 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all shadow-inner"
                  required
                  autoFocus
                />
                <span className="text-[10px] text-slate-400 font-medium block text-center">
                  Tip: Static field testing code is <strong className="text-cyan-400">123456</strong>
                </span>
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setRequestId(null);
                    setOtpCode('');
                    setError('');
                  }}
                  className="py-3 px-4 rounded-2xl border border-white/[0.1] bg-[#08090E] text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  Change Number
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || otpCode.length < 6}
                  className="flex-1 py-3 px-4 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-[0.98] transition-all shadow-lg shadow-cyan-500/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <LoaderCircle className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <>
                      <span>Verify &amp; Enter</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Security Footer Note */}
        <div className="text-center text-[11px] text-slate-500 mt-6 flex items-center justify-center gap-1.5 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span>PostgreSQL Audit Committed • Real-Time Baileys WhatsApp Gateway</span>
        </div>

      </main>

      {/* Footer System Status */}
      <footer className="w-full py-2.5 border-t border-white/[0.06] text-center text-[10px] text-slate-500 font-mono">
        Official Polling Command Terminal • VIAP Mobile v2.0
      </footer>
    </div>
  );
}
