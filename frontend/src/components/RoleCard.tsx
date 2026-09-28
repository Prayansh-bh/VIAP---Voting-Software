/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Crown, Layers, Home, Vote, Users, ShieldCheck, Building, Sparkles, Flag } from 'lucide-react';
import { CommandRole } from '../types';

// Simple mapping for Lucide icons
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Crown,
  Layers,
  Home,
  Vote,
  Users,
  ShieldCheck,
  Building,
  Sparkles,
};

const cardThemes: Record<string, {
  borderClass: string;
  hoverBorderClass: string;
  bgClass: string;
  iconBgClass: string;
  iconColorClass: string;
  subtitleColorClass: string;
  btnBgClass: string;
}> = {
  SUPER_ADMIN: {
    borderClass: 'border-yellow-300',
    hoverBorderClass: 'hover:border-yellow-500',
    bgClass: 'bg-yellow-50/20',
    iconBgClass: 'bg-yellow-100',
    iconColorClass: 'text-yellow-600',
    subtitleColorClass: 'text-yellow-600',
    btnBgClass: 'bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-black',
  },
  STATE_ADMIN: {
    borderClass: 'border-indigo-200',
    hoverBorderClass: 'hover:border-indigo-400',
    bgClass: 'bg-indigo-50/15',
    iconBgClass: 'bg-indigo-100/70',
    iconColorClass: 'text-indigo-600',
    subtitleColorClass: 'text-indigo-500',
    btnBgClass: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  },
  ZONE_INCHARGE: {
    borderClass: 'border-teal-200',
    hoverBorderClass: 'hover:border-teal-400',
    bgClass: 'bg-teal-50/15',
    iconBgClass: 'bg-teal-100/70',
    iconColorClass: 'text-teal-600',
    subtitleColorClass: 'text-teal-500',
    btnBgClass: 'bg-teal-600 hover:bg-teal-700 text-white',
  },
  PARLIAMENT_INCHARGE: {
    borderClass: 'border-fuchsia-200',
    hoverBorderClass: 'hover:border-fuchsia-400',
    bgClass: 'bg-fuchsia-50/15',
    iconBgClass: 'bg-fuchsia-100/70',
    iconColorClass: 'text-fuchsia-600',
    subtitleColorClass: 'text-fuchsia-500',
    btnBgClass: 'bg-fuchsia-600 hover:bg-fuchsia-700 text-white',
  },
  CONSTITUENCY_INCHARGE: {
    borderClass: 'border-amber-200',
    hoverBorderClass: 'hover:border-amber-400',
    bgClass: 'bg-amber-50/15',
    iconBgClass: 'bg-amber-100/70',
    iconColorClass: 'text-amber-500',
    subtitleColorClass: 'text-amber-500',
    btnBgClass: 'bg-amber-400 hover:bg-amber-500 text-white',
  },
  MANDAL_INCHARGE: {
    borderClass: 'border-emerald-200',
    hoverBorderClass: 'hover:border-emerald-400',
    bgClass: 'bg-emerald-50/15',
    iconBgClass: 'bg-emerald-100/70',
    iconColorClass: 'text-emerald-600',
    subtitleColorClass: 'text-emerald-500',
    btnBgClass: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  },
  VILLAGE_INCHARGE: {
    borderClass: 'border-blue-200',
    hoverBorderClass: 'hover:border-blue-400',
    bgClass: 'bg-blue-50/15',
    iconBgClass: 'bg-blue-100/70',
    iconColorClass: 'text-blue-600',
    subtitleColorClass: 'text-blue-500',
    btnBgClass: 'bg-blue-500 hover:bg-blue-600 text-white',
  },
  BOOTH_PRESIDENT: {
    borderClass: 'border-purple-200',
    hoverBorderClass: 'hover:border-purple-400',
    bgClass: 'bg-purple-50/15',
    iconBgClass: 'bg-purple-100/70',
    iconColorClass: 'text-purple-600',
    subtitleColorClass: 'text-purple-500',
    btnBgClass: 'bg-purple-600 hover:bg-purple-700 text-white',
  },
  VOTER_100_INCHARGE: {
    borderClass: 'border-orange-200',
    hoverBorderClass: 'hover:border-orange-400',
    bgClass: 'bg-orange-50/15',
    iconBgClass: 'bg-orange-100/70',
    iconColorClass: 'text-orange-600',
    subtitleColorClass: 'text-orange-500',
    btnBgClass: 'bg-orange-500 hover:bg-orange-600 text-white',
  },
};

interface RoleCardProps {
  role: CommandRole;
  index?: number;
  onClick: () => void;
  key?: React.Key;
}

export default function RoleCard({ role, index, onClick }: RoleCardProps) {
  const IconComponent = iconMap[role.iconName] || Flag;
  const theme = cardThemes[role.id] || {
    borderClass: 'border-slate-200',
    hoverBorderClass: 'hover:border-slate-300',
    bgClass: 'bg-white',
    iconBgClass: 'bg-slate-100',
    iconColorClass: 'text-slate-700',
    subtitleColorClass: 'text-slate-500',
    btnBgClass: 'bg-slate-900 text-white',
  };

  return (
    <div
      onClick={onClick}
      id={`role-card-${role.id}`}
      className="relative bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-md rounded-2xl p-5 transition-all duration-200 cursor-pointer flex flex-col justify-between group min-h-[180px] hover:-translate-y-0.5"
    >
      <div className="space-y-3.5">
        {/* Header: Distinct colored icon badge and active indicator */}
        <div className="flex items-center justify-between">
          <div className={`w-11 h-11 rounded-xl ${theme.iconBgClass} border border-slate-100/80 flex items-center justify-center ${theme.iconColorClass} transition-transform duration-200 group-hover:scale-105 shadow-2xs`}>
            <IconComponent className="w-5 h-5 stroke-[2.2]" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 border border-emerald-200/60 text-emerald-700 tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active
          </span>
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-1">
          <h3 className="font-bold text-base text-slate-900 tracking-tight group-hover:text-slate-950 transition-colors">
            {role.name}
          </h3>
          <p className="text-xs font-medium text-slate-500 leading-snug">
            {role.subtitle}
          </p>
        </div>
      </div>

      {/* Footer subtle hint */}
      <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-xs font-medium text-slate-400 group-hover:text-slate-700 transition-colors">
        <span>Click to access dashboard</span>
        <span className="text-slate-300 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all font-bold">&rarr;</span>
      </div>
    </div>
  );
}
