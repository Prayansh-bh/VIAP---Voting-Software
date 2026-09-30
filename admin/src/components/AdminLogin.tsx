import React, { useState } from 'react';
import { Shield, Lock, Phone, ArrowRight, Sparkles, KeyRound } from 'lucide-react';
import { AdminUser } from '../types';

interface AdminLoginProps {
  onLoginSuccess: (user: AdminUser) => void;
}

export default function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [mobile, setMobile] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile || !passcode) {
      setError('Please provide phone number and security passcode.');
      return;
    }

    // Default Super Admin credentials
    const adminUser: AdminUser = {
      id: 'admin-1',
      name: 'Dr. Balaji (Party Organiser)',
      email: 'organiser@politicalconnect.in',
      role: 'SUPER_ADMIN',
      token: 'admin-super-jwt-token-active',
    };
    onLoginSuccess(adminUser);
  };

  const handleDemoLogin = (role: 'SUPER_ADMIN' | 'ORGANISER') => {
    const adminUser: AdminUser = {
      id: 'admin-demo',
      name: role === 'SUPER_ADMIN' ? 'State War Room Director' : 'Chief Party Organiser',
      email: 'admin@platform.gov',
      role: role,
      token: 'demo-admin-jwt-token',
    };
    onLoginSuccess(adminUser);
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
            className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-lg shadow-amber-400/20 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Authenticate into CMS</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Demo Fast Access Buttons */}
        <div className="pt-4 border-t border-slate-800/80 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">
            One-Click Developer & Organiser Access
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleDemoLogin('SUPER_ADMIN')}
              className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-amber-400 transition"
            >
              Super Admin Mode
            </button>
            <button
              onClick={() => handleDemoLogin('ORGANISER')}
              className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 transition"
            >
              Party Organiser Mode
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
