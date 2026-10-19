import React, { useState } from 'react';
import {
  Palette,
  Sparkles,
  PlusCircle,
  ArrowRight,
  Layers,
  Search,
  ExternalLink,
  Shield,
  User,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { AppInstance } from '../types';
import { getAppUrl } from '../lib/env';

interface CmsBrandGatewayProps {
  apps: AppInstance[];
  selectedApp: AppInstance | null;
  onSelectApp: (app: AppInstance) => void;
  onProvisionNewParty: () => void;
}

export default function CmsBrandGateway({
  apps,
  selectedApp,
  onSelectApp,
  onProvisionNewParty,
}: CmsBrandGatewayProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredApps = apps.filter(
    (app) =>
      app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.party.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.partyCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (app.leaderName && app.leaderName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-amber-400/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/10 text-amber-300 border border-amber-400/30">
              <Palette className="w-3.5 h-3.5" />
              <span>Visual Identity & Brand Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              CMS & Brand Studio
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Manage visual branding, candidate identities, color themes, slogans, and campaign promises across your political party tenants, or provision a new party application.
            </p>
          </div>

          <button
            onClick={onProvisionNewParty}
            className="self-start md:self-auto px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm transition shadow-lg shadow-amber-400/20 flex items-center gap-2 shrink-0 group cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 transition-transform group-hover:rotate-90 duration-300" />
            <span>Provision New Party</span>
            <Sparkles className="w-4 h-4 text-slate-950" />
          </button>
        </div>
      </div>

      {/* Two Direct Options Banner / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Provision New Party */}
        <div
          onClick={onProvisionNewParty}
          className="group relative p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-amber-400/50 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between hover:shadow-xl hover:shadow-amber-400/5"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                Option 1 • Setup Wizard
              </span>
              <h2 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                Provision a Brand-New Party
              </h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Create a new political party tenant from scratch. Configure custom visual branding, election symbols, party leadership, and multi-tier operational hierarchies.
            </p>
          </div>

          <div className="pt-5 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-amber-400">
            <span>Launch Step-by-Step Setup Wizard</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 2: Customize Existing Party */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Palette className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                Option 2 • Visual Brand Studio
              </span>
              <h2 className="text-lg font-bold text-white">
                Customize an Existing Party Brand
              </h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Edit visual themes, logos, candidate photo, slogan, manifesto, and color schemes for any of your <span className="text-white font-bold">{apps.length} active party tenants</span> below.
            </p>
          </div>

          <div className="pt-5 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-slate-400">
            <span>Select a party card below to launch studio</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
        </div>
      </div>

      {/* Existing Parties Brand Studio Section */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Active Party Applications</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                {apps.length}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Click any party to open its Visual Brand & CMS Studio editor.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by party, name, or code..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
            />
          </div>
        </div>

        {filteredApps.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800/80 text-slate-400">
            <p className="text-sm">No party applications match "{searchTerm}".</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredApps.map((app) => {
              const isSelected = selectedApp?.id === app.id;
              return (
                <div
                  key={app.id}
                  onClick={() => onSelectApp(app)}
                  className={`group p-5 rounded-3xl bg-slate-900 border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-amber-400 shadow-lg shadow-amber-400/10'
                      : 'border-slate-800 hover:border-slate-700 hover:shadow-lg hover:shadow-black/20'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-md shrink-0 border border-white/10"
                          style={{ backgroundColor: app.primaryColor || '#F59E0B' }}
                        >
                          {app.partyCode || 'APP'}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-white truncate group-hover:text-amber-300 transition-colors">
                            {app.name}
                          </h3>
                          <div className="text-[11px] text-slate-400 truncate">
                            {app.party}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {app.isDefault && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                            DEFAULT
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-slate-500 font-bold">
                          {app.partyCode}
                        </span>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 space-y-2 text-xs">
                      {app.leaderName && (
                        <div className="flex items-center gap-2 text-slate-300">
                          <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">{app.leaderName}</span>
                        </div>
                      )}
                      {app.jurisdiction && (
                        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">{app.jurisdiction}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60">
                        <span className="text-slate-500">Theme Colors:</span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20"
                            style={{ backgroundColor: app.primaryColor || '#F59E0B' }}
                            title="Primary"
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20"
                            style={{ backgroundColor: app.secondaryColor || '#DC2626' }}
                            title="Secondary"
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20"
                            style={{ backgroundColor: app.accentColor || '#0F172A' }}
                            title="Accent"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-bold text-slate-400 group-hover:text-slate-200 transition-colors">
                      Edit Brand & Themes
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectApp(app);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-400/10 hover:bg-amber-400 text-amber-300 hover:text-slate-950 font-bold text-xs transition border border-amber-400/30 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Palette className="w-3.5 h-3.5" />
                      <span>Launch Studio</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
