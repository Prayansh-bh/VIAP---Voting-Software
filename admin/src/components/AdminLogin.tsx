import React, { useState } from 'react';
import { Shield, Phone, ArrowRight, KeyRound, Loader2, Zap } from 'lucide-react';
import { AdminUser } from '../types';
import { authenticateAdminCredentials, authenticateAdminRole } from '../lib/api';

interface AdminLoginProps {
  onLoginSuccess: (user: AdminUser) => void;
}

export default function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [mobile, setMobile] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile || !passcode) {
      setError('Please provide phone number and security passcode.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const user = await authenticateAdminCredentials(mobile, passcode);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role: 'SUPER_ADMIN' | 'ORGANISER') => {
    setLoading(true);
    setError('');
    try {
      const user = await authenticateAdminRole(role);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -top-10 -left-10" />
      <div className="absolute w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -bottom-10 -right-10" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 mx-auto shadow-lg shadow-amber-500/20">
            <Shield className="w-7 h-7 fill-slate-950" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">
            Platform CMS & Admin Console
          </h1>
          <p className="text-xs text-slate-400">
            Authorized access for Party Super Admin, Organiser & System Engineers.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Admin Mobile Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="10-digit mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-amber-400 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Master Security Passcode
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                placeholder="••••••••"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-amber-400 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 font-bold text-xs shadow-lg shadow-amber-400/20 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <>
                <span>Authenticate into CMS</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Instant 1-Click Demo Buttons for Admin */}
          <div className="pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin('SUPER_ADMIN')}
                disabled={loading}
                className="flex-1 py-2.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-bold text-[11px] transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>Demo Super Admin</span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('ORGANISER')}
                disabled={loading}
                className="flex-1 py-2.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 font-bold text-[11px] transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5 text-sky-400 fill-sky-400" />
                <span>Demo Organiser</span>
              </button>
            </div>
          </div>
        </form>

        {/* Security Notice & Default Authoritative Credentials */}
        <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/90 text-left space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                Authoritative Credentials
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                PostgreSQL & Bcrypt
              </span>
            </div>
            <div className="text-[11px] text-slate-300 font-mono flex items-center justify-between">
              <span>Mobile / ID:</span>
              <button
                type="button"
                onClick={() => setMobile('9848099999')}
                className="text-amber-300 hover:underline cursor-pointer"
              >
                9848099999
              </button>
            </div>
            <div className="text-[11px] text-slate-300 font-mono flex items-center justify-between">
              <span>Security Passcode:</span>
              <button
                type="button"
                onClick={() => setPasscode('Kondapi@2026')}
                className="text-amber-300 hover:underline cursor-pointer"
              >
                Kondapi@2026
              </button>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 text-center">
            Strict password verification is enforced. Unauthorized passcodes are rejected with 401 Unauthorized.
          </p>
        </div>
      </div>
    </div>
  );
}
