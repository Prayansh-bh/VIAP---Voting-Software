/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useCms } from '../context/CmsContext';

export default function Footer() {
  const { config } = useCms();
  const orgName = config?.organisationName || 'Telangana Pradesh Congress Committee (TPCC)';

  return (
    <footer className="w-full py-6 mt-auto select-none" id="app-footer">
      <div className="w-full max-w-5xl mx-auto text-center px-4">
        <p className="text-xs font-normal text-slate-400">
          &copy; 2024 Telangana Pradesh Congress Committee (TPCC). Authorized Access Only.
        </p>
      </div>
    </footer>
  );
}
