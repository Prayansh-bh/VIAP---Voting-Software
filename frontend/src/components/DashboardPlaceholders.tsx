/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldCheck, User, Smartphone, MapPin, Layers, Home, Vote, Users, LogOut, ArrowLeft, Terminal, AlertCircle } from 'lucide-react';
import { UserSession, RoleType } from '../types';

interface DashboardPlaceholdersProps {
  session: UserSession;
  onLogout: () => void;
}

export default function DashboardPlaceholders({ session, onLogout }: DashboardPlaceholdersProps) {
  
  // Mapping roles to readable names
  const roleNameMap: Record<RoleType, string> = {
    SUPER_ADMIN: "Platform Super Administrator",
    STATE_ADMIN: "State Administrator",
    ZONE_INCHARGE: "Zone In-Charge",
    PARLIAMENT_INCHARGE: "Parliament In-Charge",
    CONSTITUENCY_INCHARGE: "Constituency Incharge (Assembly Command)",
    MANDAL_INCHARGE: "Mandal President (Mandal Command)",
    VILLAGE_INCHARGE: "Village Incharge (Village Command)",
    BOOTH_PRESIDENT: "Booth President (Polling Booth Command)",
    VOTER_100_INCHARGE: "100 Voter Incharge (Group Command)",
    POLLING_AGENT: "Polling Agent",
    VIEWER: "Verified Viewer",
  };

  const getRoleIcon = () => {
    switch (session.role) {
      case 'CONSTITUENCY_INCHARGE': return <CrownIcon className="w-5 h-5 text-yellow-500" />;
      case 'MANDAL_INCHARGE': return <Layers className="w-5 h-5 text-yellow-500" />;
      case 'VILLAGE_INCHARGE': return <Home className="w-5 h-5 text-yellow-500" />;
      case 'BOOTH_PRESIDENT': return <Vote className="w-5 h-5 text-yellow-500" />;
      case 'VOTER_100_INCHARGE': return <Users className="w-5 h-5 text-yellow-500" />;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 animate-fade-in" id="dashboard-placeholder-panel">
      
      {/* Return Button */}
      <button
        onClick={onLogout}
        className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors mb-6 uppercase tracking-wider cursor-pointer"
        id="btn-return-role"
      >
        <ArrowLeft className="w-4 h-4" />
        Return to Command Center
      </button>

      <div className="bg-white border border-slate-100 rounded-2xl shadow-md overflow-hidden">
        
        {/* Active Session Secure Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-400 rounded-lg text-slate-900 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-emerald-500 text-emerald-950 font-extrabold px-2 py-0.5 rounded uppercase tracking-wider text-[9px]">
                  Connected
                </span>
                <span className="text-xs text-slate-400 font-mono font-bold">
                  ID: {session.userId}
                </span>
              </div>
              <h2 className="text-lg font-bold tracking-tight mt-0.5">
                {roleNameMap[session.role]}
              </h2>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-800 hover:bg-red-900/60 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
            id="btn-disconnect"
          >
            <LogOut className="w-3.5 h-3.5" />
            Disconnect Portal
          </button>
        </div>

        {/* Credentials Breakdown Panel */}
        <div className="border-b border-slate-100 p-6 bg-slate-50 grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Column 1: Operator info */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Operator Profile</h3>
            
            <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2.5 text-sm">
                <User className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-semibold text-slate-700">Name:</span>
                <span className="font-bold text-slate-950 ml-auto">{session.userName}</span>
              </div>

              <div className="flex items-center gap-2.5 text-sm">
                <Smartphone className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-semibold text-slate-700">Mobile:</span>
                <span className="font-medium text-slate-950 ml-auto">{session.mobileNumber}</span>
              </div>

              <div className="flex items-center gap-2.5 text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-semibold text-slate-700">Command Access:</span>
                <span className="font-bold text-emerald-600 ml-auto">Authorized</span>
              </div>
            </div>
          </div>

          {/* Column 2: Scope of Authority */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Jurisdictional Scope</h3>
            
            <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2.5 text-sm">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-semibold text-slate-700">Assembly:</span>
                <span className="font-bold text-slate-950 ml-auto">Kondapi Constituency</span>
              </div>

              {session.assignedMandal && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Layers className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-700">Mandal:</span>
                  <span className="font-bold text-yellow-700 ml-auto">{session.assignedMandal}</span>
                </div>
              )}

              {session.assignedVillage && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Home className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-700">Village:</span>
                  <span className="font-bold text-slate-950 ml-auto">{session.assignedVillage}</span>
                </div>
              )}

              {session.assignedBooth && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Vote className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-700">Polling Booth:</span>
                  <span className="font-bold text-slate-950 ml-auto">{session.assignedBooth}</span>
                </div>
              )}

              {session.assignedVoterGroup && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Users className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-700">Voter Team:</span>
                  <span className="font-bold text-slate-950 ml-auto">{session.assignedVoterGroup}</span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Phase Announcement Area */}
        <div className="p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-500 mx-auto border border-yellow-200">
            <AlertCircle className="w-6 h-6" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h4 className="text-base font-bold text-slate-900">Dashboard Level Ready for Integration</h4>
            <p className="text-sm text-slate-500 leading-relaxed font-normal">
              You have successfully passed the role authentication check. This specific dashboard section is set up to load live demographic logs and telemetry charts.
            </p>
            <p className="text-xs text-slate-400 font-medium">
              Ready for Next Phase Deployment for {roleNameMap[session.role]}.
            </p>
          </div>

          {/* Secure Handshake / Simulated Telemetry */}
          <div className="bg-slate-950 text-slate-400 rounded-xl p-4 text-left font-mono text-[11px] leading-relaxed border border-slate-900 max-w-xl mx-auto space-y-1 select-none">
            <div className="flex items-center gap-1.5 text-yellow-400 font-bold border-b border-slate-800 pb-1 mb-1">
              <Terminal className="w-3.5 h-3.5" />
              Secure Telemetry Handshake Log
            </div>
            <div>[SECURE] Connected via ID {session.userId}</div>
            <div>[INFO] Scope: {session.assignedMandal || 'Kondapi Assembly'} &rarr; {session.assignedVillage || 'All Villages'}</div>
            <div>[PORTAL] Cryptographic token authorized for mobile +91 {session.mobileNumber.slice(0, 3)}••••{session.mobileNumber.slice(-3)}</div>
            <div>[STATUS] Ready to hook with server-side database on approval</div>
          </div>
        </div>

      </div>
    </div>
  );
}

// Simple Helper for Crown
function CrownIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
      <path d="M3 20h18" />
    </svg>
  );
}
