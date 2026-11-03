import React, { useState } from 'react';
import { UserPlus, Smartphone, CheckCircle2, AlertCircle, X, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { requestRegistrationOtp, verifyRegistrationOtp } from '../../lib/api/auth.api';
import { createApprovalRequest } from '../../lib/api/approvals.api';

interface CadreRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePartyCode?: string;
  primaryColor?: string;
}

export default function CadreRegistrationModal({
  isOpen,
  onClose,
  activePartyCode,
  primaryColor = '#FF6600',
}: CadreRegistrationModalProps) {
  const [step, setStep] = useState<'FORM' | 'OTP' | 'SUCCESS'>('FORM');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState('BOOTH_INCHARGE');
  const [constituency, setConstituency] = useState('');
  const [otp, setOtp] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMobile = mobile.replace(/\D/g, '').slice(-10);
    if (!name.trim()) {
      setError('Please provide your full legal name.');
      return;
    }
    if (cleanMobile.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await requestRegistrationOtp(cleanMobile, 'SMS');
      setRequestId(res.requestId);
      setStep('OTP');
      if (res.devOtp) {
        setOtp(res.devOtp);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to dispatch registration passcode. Please check your number.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestId || otp.length < 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await verifyRegistrationOtp(requestId, otp);

      // Successfully verified mobile! Now submit application to Central Approval Engine
      await createApprovalRequest({
        partyId: activePartyCode || undefined,
        type: 'USER_REGISTRATION',
        title: `Cadre Registration: ${name.trim()} (${role.replace(/_/g, ' ')})`,
        description: `New cadre volunteer registration for ${name.trim()} (${role.replace(/_/g, ' ')}), assigned to ${constituency.trim() || 'General Territory'}.`,
        payload: {
          name: name.trim(),
          mobileNumber: mobile.replace(/\D/g, '').slice(-10),
          role,
          constituency: constituency.trim(),
          registeredAt: new Date().toISOString(),
        },
        requestedByName: name.trim(),
        requestedByRole: role,
        requestedByMobile: mobile.replace(/\D/g, '').slice(-10),
      });

      setStep('SUCCESS');
    } catch (err: any) {
      setError(err?.message || 'Verification or submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setStep('FORM');
    setName('');
    setMobile('');
    setOtp('');
    setRequestId(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 overflow-hidden">
        {/* Glow accent */}
        <div
          className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ backgroundColor: primaryColor }}
        />

        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-2xl text-white shadow-md flex items-center justify-center"
              style={{ backgroundColor: primaryColor }}
            >
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Cadre &amp; Volunteer Onboarding</h2>
              <p className="text-xs text-slate-400">Apply to join the grassroots election network</p>
            </div>
          </div>
          <button
            onClick={resetAndClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Application Form */}
        {step === 'FORM' && (
          <form onSubmit={handleRequestOtp} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Legal Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full px-4 py-3 bg-slate-950/80 border border-slate-700/80 rounded-2xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Mobile Number</label>
              <div className="flex rounded-2xl border border-slate-700/80 bg-slate-950/80 overflow-hidden focus-within:border-amber-400">
                <span className="px-3.5 py-3 text-xs font-mono font-bold text-slate-400 border-r border-slate-800 bg-slate-900/60">
                  +91
                </span>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  className="flex-1 px-4 py-3 text-sm text-white bg-transparent placeholder:text-slate-600 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Desired Cadre Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950/80 border border-slate-700/80 rounded-2xl text-sm text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="BOOTH_INCHARGE">Booth In-Charge</option>
                  <option value="VILLAGE_INCHARGE">Village Coordinator</option>
                  <option value="MANDAL_INCHARGE">Mandal Coordinator</option>
                  <option value="VOLUNTEER">Campaign Volunteer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Constituency / Region</label>
                <input
                  type="text"
                  value={constituency}
                  onChange={(e) => setConstituency(e.target.value)}
                  placeholder="e.g. Kondapi (103)"
                  className="w-full px-4 py-3 bg-slate-950/80 border border-slate-700/80 rounded-2xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || mobile.length < 10 || !name.trim()}
              className="w-full mt-2 py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                  <span>Verify Phone &amp; Apply</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: OTP Verification */}
        {step === 'OTP' && (
          <form onSubmit={handleVerifyAndSubmit} className="mt-6 space-y-4">
            <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs">
              <p>
                A 6-digit confirmation code was dispatched to <strong>+91 {mobile}</strong>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-center">
                Enter 6-Digit Passcode
              </label>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="------"
                className="w-full py-3.5 bg-slate-950/90 border border-slate-700/80 rounded-2xl text-center text-2xl font-mono text-white font-black tracking-[0.5em] placeholder:text-slate-700 focus:outline-none focus:border-amber-400"
                required
                autoFocus
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('FORM')}
                className="py-3 px-4 rounded-2xl border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="flex-1 py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>
                    <span>Confirm Application</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Success Screen */}
        {step === 'SUCCESS' && (
          <div className="mt-6 py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Application Queued for Approval</h3>
              <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
                Thank you, <strong>{name}</strong>! Your application for <strong>{role.replace(/_/g, ' ')}</strong> has been forwarded to the Party Administration Approval Engine.
              </p>
              <p className="text-[11px] text-slate-500 mt-2">
                Once reviewed by your Party Admin, your profile will be activated, and you can log in immediately.
              </p>
            </div>

            <button
              onClick={resetAndClose}
              className="mt-4 px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-white transition-colors"
            >
              Return to Login
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Encrypted Verification</span>
          </span>
          <span>Central Approval Engine Connected</span>
        </div>
      </div>
    </div>
  );
}

