import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  ArrowLeft,
  Loader2,
  RefreshCw,
  KeyRound,
} from 'lucide-react';
import { requestMobileChangeOtpApi, verifyMobileChangeOtpApi } from '../lib/api/auth.api';

interface ChangeMobileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMobile: string;
  onMobileChanged: (newMobile: string, updatedUser?: any) => void;
}

export default function ChangeMobileModal({
  isOpen,
  onClose,
  currentMobile,
  onMobileChanged,
}: ChangeMobileModalProps) {
  const [step, setStep] = useState<'REQUEST' | 'VERIFY'>('REQUEST');
  const [newMobile, setNewMobile] = useState('');
  const [channel, setChannel] = useState<'SMS' | 'WHATSAPP'>('SMS');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');

  // Loading & error states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Timers
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [expirySeconds, setExpirySeconds] = useState(300);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('REQUEST');
      setNewMobile('');
      setOtpCode('');
      setErrorMsg(null);
      setSuccessMsg(null);
      setRequestId(null);
      setCooldownSeconds(0);
      setExpirySeconds(300);
    }
  }, [isOpen]);

  // Handle countdown intervals
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    if (step !== 'VERIFY' || expirySeconds <= 0) return;
    const timer = setInterval(() => {
      setExpirySeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [step, expirySeconds]);

  if (!isOpen) return null;

  const cleanCurrentMobile = (currentMobile || '').replace(/\D/g, '').slice(-10);

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (cooldownSeconds > 0) {
      setErrorMsg(`Please wait ${cooldownSeconds}s before requesting a new verification code.`);
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanNumber = newMobile.replace(/\D/g, '').slice(-10);
    if (cleanNumber.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (cleanNumber === cleanCurrentMobile) {
      setErrorMsg('The proposed mobile number is identical to your current registered number.');
      return;
    }

    setLoading(true);
    try {
      const res = await requestMobileChangeOtpApi(cleanNumber, channel);
      setRequestId(res.requestId);
      setStep('VERIFY');
      const serverCooldown = typeof res.cooldownSeconds === 'number' ? res.cooldownSeconds : 60;
      setCooldownSeconds(serverCooldown);
      setExpirySeconds(300);
      setSuccessMsg(res.message || `Verification code sent to +91 ${cleanNumber}`);
    } catch (err: any) {
      const retryAfter = err?.retryAfter || err?.data?.retryAfter;
      if (typeof retryAfter === 'number' && retryAfter > 0) {
        setCooldownSeconds(retryAfter);
      }
      setErrorMsg(err.message || 'Failed to dispatch verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!requestId) {
      setErrorMsg('Session expired. Please request a new verification code.');
      setStep('REQUEST');
      return;
    }

    const cleanOtp = otpCode.trim();
    if (cleanOtp.length !== 6) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }

    const cleanNumber = newMobile.replace(/\D/g, '').slice(-10);
    setLoading(true);
    try {
      const res = await verifyMobileChangeOtpApi(requestId, cleanNumber, cleanOtp);
      setSuccessMsg('Registered mobile number updated successfully in PostgreSQL!');
      setTimeout(() => {
        onMobileChanged(cleanNumber, res.user);
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Incorrect verification code. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Change Registered Mobile Number</h2>
              <p className="text-[11px] text-slate-400">Self-service cryptographic verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Status Banners */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {step === 'REQUEST' ? (
            /* Phase A: Proposed Number Entry */
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Current Registered Number
                </div>
                <div className="text-xs font-mono font-bold text-slate-300">
                  {cleanCurrentMobile ? `+91 ${cleanCurrentMobile}` : 'Not Available'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  New 10-Digit Mobile Number *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={newMobile}
                    onChange={(e) => setNewMobile(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-12 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:border-amber-400 outline-none transition"
                    placeholder="Enter new 10-digit mobile"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  A 6-digit one-time passcode will be dispatched to this new number.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Delivery Channel
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setChannel('SMS')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      channel === 'SMS'
                        ? 'bg-amber-400 text-slate-950 border-amber-400'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span>SMS Gateway</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel('WHATSAPP')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      channel === 'WHATSAPP'
                        ? 'bg-emerald-400 text-slate-950 border-emerald-400'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span>WhatsApp</span>
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || newMobile.length !== 10}
                  className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-lg shadow-amber-400/20 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Dispatching OTP...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Verification Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Phase B: OTP Verification */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Verifying New Number
                  </div>
                  <div className="text-xs font-mono font-bold text-amber-400 mt-0.5">
                    +91 {newMobile}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep('REQUEST');
                    setErrorMsg(null);
                  }}
                  className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Enter 6-Digit OTP *</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Valid for: {Math.floor(expirySeconds / 60)}:{(expirySeconds % 60).toString().padStart(2, '0')}
                  </span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm font-mono tracking-widest text-center focus:border-amber-400 outline-none transition"
                    placeholder="• • • • • •"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-500 text-[11px]">Didn't receive code?</span>
                {cooldownSeconds > 0 ? (
                  <span className="text-slate-500 text-[11px] font-mono">
                    Resend in {cooldownSeconds}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRequestOtp()}
                    disabled={loading || cooldownSeconds > 0}
                    className="text-amber-400 hover:text-amber-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Resend OTP</span>
                  </button>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying & Updating...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Confirm & Update Mobile Number</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Security Guarantee */}
          <div className="pt-3 border-t border-slate-800/80 text-[10px] text-slate-500 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400 font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Identity & Hierarchy Preservation</span>
            </div>
            <p>
              Your role assignments, organizational identity, and historical activity will remain intact. All previous device sessions will be revoked for security.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
