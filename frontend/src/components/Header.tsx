/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useCms } from '../context/CmsContext';

export default function Header() {
  const { config } = useCms();

  // Determine if this is Congress / INC branding
  const isINC = config.activePartyCode === 'INC' || config.primaryColor === '#FF6600';

  return (
    <header className="relative w-full flex flex-col items-center pt-4 pb-2 md:pt-5 md:pb-3 select-none animate-fade-in shrink-0" id="app-header">

      {/* Party Logo Badge */}
      <div
        className="w-16 h-16 bg-white border-2 border-orange-500 rounded-full flex items-center justify-center shadow-xs mb-3 hover:scale-105 transition-transform duration-300 overflow-hidden"
        id="logo-container"
      >
        {config.logoUrl ? (
          <img src={config.logoUrl} alt="Party Logo" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xl font-bold tracking-tight text-orange-600">
            {config.activePartyCode || 'INC'}
          </span>
        )}
      </div>

      {/* Dynamic Title */}
      <div className="flex flex-col items-center gap-1 text-center">
        <h1
          className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 px-4"
          id="main-title"
        >
          {config.organisationName || 'Telangana Congress Connect'}
        </h1>
        <p
          className="text-xs md:text-sm font-medium text-slate-400 max-w-xl text-center px-4"
          id="main-subtitle"
        >
          {config.slogan || 'Integrated Voter Management & Command Center'}
        </p>
      </div>

      {/* Clean Brand Accent Divider */}
      <div
        className="w-16 h-1 rounded-full transition-colors duration-300 mt-3"
        style={{
          background: isINC
            ? 'linear-gradient(90deg, #f97316 0%, #10b981 100%)'
            : (config.primaryColor || '#f59e0b'),
        }}
        id="header-divider"
      />
    </header>
  );
}
