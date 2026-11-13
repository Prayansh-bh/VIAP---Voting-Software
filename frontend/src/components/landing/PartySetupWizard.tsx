import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Flag,
  Palette,
  Eye,
  X,
} from 'lucide-react';
import { useCms } from '../../context/CmsContext';
import { getApiBase } from '../../lib/api';
import { getAuthToken } from '../../lib/authStorage';

interface PartySetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onComplete?: () => void;
}

export default function PartySetupWizard({ isOpen, onClose, onSuccess, onComplete }: PartySetupWizardProps) {
  const { parties, reloadConfig } = useCms();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    shortName: '',
    symbolName: '',
    primaryColor: '#eab308',
    secondaryColor: '#1e293b',
    accentColor: '#3b82f6',
    logoUrl: '',
    flagUrl: '',
    sortOrder: parties.length + 1,
  });

  if (!isOpen) return null;

  const handleNext = () => {
    setErrorMessage('');
    if (step === 1) {
      if (!formData.name.trim() || !formData.code.trim() || !formData.shortName.trim()) {
        setErrorMessage('Party Name, Code, and Short Name are required.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handlePublishAndLock = async () => {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const token = getAuthToken();
      const res = await fetch(`${getApiBase()}/api/cms/parties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...formData,
          code: formData.code.trim().toUpperCase(),
          lifecycleStatus: 'LOCKED',
          isLocked: true,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || json?.message || 'Failed to publish party configuration');
      }

      await reloadConfig();
      setStep(4);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during party publication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                One-Time Party Identity Setup
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Step {step} of 4
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-medium">Configure and seal platform identity for all operational tiers</p>
            </div>
          </div>
          {step !== 4 && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Progress Line */}
        <div className="w-full bg-slate-800 h-1">
          <div
            className="bg-gradient-to-r from-amber-500 to-indigo-500 h-1 transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto max-h-[70vh]">
          {errorMessage && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3 text-xs text-red-300 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: Basic Information */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Enter the political party name, official symbol, and branding palette. This configuration will be utilized by all dashboards, voter telemetry, and field modules.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Party Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Democratic People's Front"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-hidden focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Party Code / Abbreviation *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. DPF"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-hidden focus:border-amber-400 font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Short Display Name *
                  </label>
                  <input
                    type="text"
                    value={formData.shortName}
                    onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                    placeholder="e.g. DPF Front"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-hidden focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Election Symbol Name
                  </label>
                  <input
                    type="text"
                    value={formData.symbolName}
                    onChange={(e) => setFormData({ ...formData, symbolName: e.target.value })}
                    placeholder="e.g. Rising Sun, Bicycle, Torch"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-hidden focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Color Controls */}
              <div className="p-4 bg-slate-950/40 rounded-2xl border border-slate-800/80 space-y-3">
                <div className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Palette className="w-3.5 h-3.5 text-amber-400" /> Color Branding Palette
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 font-semibold mb-1">Primary Color</label>
                    <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <input
                        type="color"
                        value={formData.primaryColor}
                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent"
                      />
                      <span className="text-xs font-mono text-slate-300">{formData.primaryColor}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 font-semibold mb-1">Secondary</label>
                    <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <input
                        type="color"
                        value={formData.secondaryColor}
                        onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                        className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent"
                      />
                      <span className="text-xs font-mono text-slate-300">{formData.secondaryColor}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 font-semibold mb-1">Accent</label>
                    <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <input
                        type="color"
                        value={formData.accentColor}
                        onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                        className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent"
                      />
                      <span className="text-xs font-mono text-slate-300">{formData.accentColor}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Live Preview */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-in">
              <div className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" /> Identity Preview Across Platform Views
              </div>

              {/* Sample Card */}
              <div className="p-5 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-8 h-8 rounded-full border border-white/20 shadow-md flex items-center justify-center font-black text-xs"
                      style={{ backgroundColor: formData.primaryColor, color: '#000' }}
                    >
                      {formData.code.slice(0, 2)}
                    </span>
                    <div>
                      <div className="text-sm font-black text-white">{formData.name}</div>
                      <div className="text-xs text-slate-400 font-mono">
                        Code: {formData.code} • Symbol: {formData.symbolName || 'Standard Flag'}
                      </div>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Draft Preview
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800/80 text-center">
                  <div className="p-3 bg-slate-900 rounded-xl">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Primary Theme</div>
                    <div className="text-xs font-black font-mono mt-0.5" style={{ color: formData.primaryColor }}>
                      {formData.primaryColor}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Secondary</div>
                    <div className="text-xs font-black font-mono mt-0.5" style={{ color: formData.secondaryColor }}>
                      {formData.secondaryColor}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Accent</div>
                    <div className="text-xs font-black font-mono mt-0.5" style={{ color: formData.accentColor }}>
                      {formData.accentColor}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Immutability Warning & Seal Confirmation */}
          {step === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3">
                <div className="flex items-center gap-3 text-amber-400 font-black text-sm">
                  <Lock className="w-5 h-5 shrink-0" />
                  <span>Important: Immutability Guarantee & Permanent Sealing</span>
                </div>
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  Once published, political party definitions are permanently sealed, locked, and immutable across all databases and APIs.
                </p>
                <ul className="text-xs text-amber-300/80 space-y-1.5 list-disc list-inside">
                  <li>No user (including Super Admin) can edit or delete this party after publication.</li>
                  <li>All modification or deletion API requests will be permanently rejected with <code>403 Forbidden</code>.</li>
                  <li>The party branding will be active and available across all voter records, dashboards, and reports.</li>
                </ul>
              </div>

              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Party to be locked:</span>
                <span className="font-black text-white">{formData.name} ({formData.code})</span>
              </div>
            </div>
          )}

          {/* STEP 4: Success & Transition */}
          {step === 4 && (
            <div className="text-center py-6 space-y-5 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-lg font-black text-white">Party Published & Permanently Locked</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  The party configuration is now active, sealed, and immutable. Your VIAP environment is completely configured and ready for operational deployment.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Lock className="w-3.5 h-3.5 text-amber-400" /> Published • Locked • Immutable
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-800 flex items-center justify-between bg-slate-950/50">
          {step > 1 && step < 4 ? (
            <button
              onClick={() => setStep((prev) => (prev - 1) as any)}
              className="px-4 py-2.5 text-slate-400 hover:text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 && (
            <button
              onClick={handleNext}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              Continue to Review <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {step === 3 && (
            <button
              onClick={handlePublishAndLock}
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Publishing & Locking...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" /> Confirm, Publish & Seal Party
                </>
              )}
            </button>
          )}

          {step === 4 && (
            <button
              onClick={() => {
                if (onSuccess) onSuccess();
                if (onComplete) onComplete();
                onClose();
              }}
              className="w-full px-6 py-3 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-cyan-500/20 transition-all cursor-pointer"
            >
              Enter VIAP Application <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
