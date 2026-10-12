/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Lock, KeyRound, ShieldCheck, Sparkles } from 'lucide-react';

interface SecurityControlsProps {
  onLock: () => void;
  onChangePasscode: () => void;
  isPanelLocked: boolean;
}

export default function SecurityControls({ onLock, onChangePasscode, isPanelLocked }: SecurityControlsProps) {
  // CMS Studio, Lock Panel, and Passcode controls are permanently removed as per requirements
  return null;
}
