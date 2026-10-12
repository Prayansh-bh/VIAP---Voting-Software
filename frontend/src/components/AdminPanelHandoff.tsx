import React from 'react';
import { Shield, ExternalLink, ArrowRight, Server, Layers } from 'lucide-react';

interface AdminPanelHandoffProps {
  onReturnToPartyApp: () => void;
}

export default function AdminPanelHandoff({ onReturnToPartyApp }: AdminPanelHandoffProps) {
  const adminUrl = 'http://localhost:3001';

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-12 sm:py-16 animate-fade-in" id="admin-panel-handoff-root">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl text-center space-y-6 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -top-10 -right-10" />

        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 mx-auto shadow-xl shadow-amber-500/20">
          <Shield className="w-8 h-8 fill-slate-950" />
        </div>

        <div className="space-y-2 max-w-xl mx-auto">
          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
            SYSTEM SEPARATION ACTIVE
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            CMS & Platform Admin is a Dedicated Panel
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Following strict architectural separation, the <strong>CMS / Admin Panel</strong> runs independently on port{' '}
            <strong className="text-amber-400 font-mono">3001</strong> connected to the shared PostgreSQL database. This application (port 3000) is dedicated strictly to field incharge operations.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <a
            href={adminUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm shadow-xl shadow-amber-400/20 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Launch CMS Admin Panel (Port 3001)</span>
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            onClick={onReturnToPartyApp}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Return to Incharge Roles Gateway</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* System Architecture Specs */}
        <div className="pt-8 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Party Application</div>
            <div className="text-xs font-bold text-white mt-1">Field Incharge Operational Command</div>
            <div className="text-[10px] font-mono text-emerald-400 mt-0.5">http://localhost:3000</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CMS / Admin Panel</div>
            <div className="text-xs font-bold text-white mt-1">Super Admin & Tenant Governance</div>
            <div className="text-[10px] font-mono text-amber-400 mt-0.5">http://localhost:3001</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shared Database</div>
            <div className="text-xs font-bold text-white mt-1">PostgreSQL Fastify API Backend</div>
            <div className="text-[10px] font-mono text-cyan-400 mt-0.5">http://localhost:4000/api</div>
          </div>
        </div>
      </div>
    </div>
  );
}
