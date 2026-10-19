import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  X,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { CommandRole, UserSession } from '../types';
import { requestOtp, verifyOtp } from '../lib/api';

interface OtpLoginModalProps {
  role?: CommandRole | null;
  onClose: () => void;
  onSuccess: (session: UserSession, token: string) => void;
}

export default function OtpLoginModal({ role, onClose, onSuccess }: OtpLoginModalProps) {
  // Login form state
  const [mobileInput, setMobileInput] = useState('');
  const [channel, setChannel] = useState<'SMS' | 'WHATSAPP'>('WHATSAPP');
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      const response = await requestOtp(targetNum, role?.id, channel);

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

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in font-sans">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-100 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center font-bold shadow-xs">
              <KeyRound className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 leading-tight">Command Station Login</h3>
              <p className="text-[11px] text-amber-700 font-bold mt-0.5">
                {role ? role.name : 'Direct Mobile OTP Login'}
              </p>
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
          {!isVerifying && (
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
                      placeholder="e.g. 9340423885 or registered mobile"
                      className="w-full pl-12 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-bold focus:bg-white focus:border-amber-400 focus:outline-none transition-all font-mono tracking-wider"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                {/* Channel Selection Toggle: WhatsApp vs SMS */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">Receive Code Via</label>
                    <span className="text-[10px] text-slate-400">WhatsApp recommended</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setChannel('WHATSAPP')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        channel === 'WHATSAPP'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>WhatsApp OTP</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setChannel('SMS')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        channel === 'SMS'
                          ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>SMS OTP</span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || mobileInput.length < 10}
                  className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-200 disabled:text-slate-400 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed active:scale-98"
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
          {/* VIEW B: OTP VERIFICATION STEP */}
          {/* ========================================================== */}
          {isVerifying && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3 text-[12px] text-emerald-950 flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  A 6-digit verification code has been dispatched to your <strong>{channel === 'WHATSAPP' ? 'WhatsApp' : 'phone'}</strong> (+91 {mobileNumber}). Please enter the code below.
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 font-semibold flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Verifying Mobile Number</span>
                  <span className="font-mono text-slate-900 font-bold">+91 {mobileNumber}</span>
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                  {role?.name || 'Authorized Incharge'}
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
