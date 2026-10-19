import React from 'react';
import {
  CheckCircle2,
  X,
  Copy,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import { getAppUrl } from '../lib/env';

export interface CreatedCredentialsData {
  appName: string;
  tenantCode: string;
  mobileNumber: string;
  role: string;
  password?: string;
  tierIncharges?: Array<{
    tierLevel: string;
    name: string;
    role: string;
    unitName?: string;
    mobileNumber: string;
  }>;
}

export interface CreatedCredentialsModalProps {
  credentials: CreatedCredentialsData;
  onClose: () => void;
  onContinue: () => void;
}

export default function CreatedCredentialsModal({
  credentials,
  onClose,
  onContinue,
}: CreatedCredentialsModalProps) {
  const { notify } = useNotification();

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-black">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Application Tenant Provisioned!</h3>
              <p className="text-xs text-slate-400 font-medium">Real PostgreSQL database entities registered</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Provisioned Application & Tenant
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">{credentials.appName}</span>
              <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20">
                {credentials.tenantCode}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>Candidate Login Credentials</span>
              <span className="text-emerald-400 font-bold">● Active & Ready</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-medium">Mobile Number (ID)</div>
                <div className="font-mono text-xs font-black text-white mt-0.5">
                  +91 {credentials.mobileNumber}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-medium">Assigned Role</div>
                <div className="font-mono text-[11px] font-black text-amber-300 mt-0.5">
                  {credentials.role}
                </div>
              </div>
            </div>

            {credentials.password && (
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">Initial Passcode / Password</div>
                  <div className="font-mono text-xs font-black text-amber-400 mt-0.5">
                    {credentials.password}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`Mobile: ${credentials.mobileNumber}\nPassword: ${credentials.password}`);
                    notify.success('Credentials copied to clipboard!', 'Copied');
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </button>
              </div>
            )}

            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-400 font-medium">Authentication Channels</div>
                <div className="font-mono text-xs font-black text-emerald-400 mt-0.5">
                  WhatsApp OTP • SMS OTP • Passcode Login
                </div>
              </div>
              <div className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                ● Active in DB
              </div>
            </div>

            <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Candidate logs in directly to the Party Application using their verified mobile number.</span>
            </div>
          </div>

          {credentials.tierIncharges && credentials.tierIncharges.length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>Provisioned Hierarchy-Tier Incharges</span>
                <span className="text-amber-400 font-bold">{credentials.tierIncharges.length} Tiers</span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {credentials.tierIncharges.map((ti: any, idx: number) => (
                  <div key={idx} className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-400/20 text-amber-300 font-black">{ti.tierLevel}</span>
                        <span>{ti.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">{ti.role} • {ti.unitName || ti.tierLevel}</div>
                    </div>
                    <div className="font-mono font-bold text-emerald-400 text-xs">
                      +91 {ti.mobileNumber}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <a
            href={`${getAppUrl()}/?app=${encodeURIComponent((credentials.tenantCode || '').toLowerCase())}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs text-center flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 cursor-pointer"
          >
            <span>Launch Party App</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={onContinue}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer border border-slate-700"
          >
            <span>Continue to Role Modules</span>
          </button>
        </div>
      </div>
    </div>
  );
}
