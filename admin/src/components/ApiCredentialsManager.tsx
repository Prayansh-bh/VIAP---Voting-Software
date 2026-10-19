import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Shield,
  RefreshCw,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Server,
  Zap,
  ExternalLink,
} from 'lucide-react';
import { AppInstance } from '../types';
import {
  ApiCredentialItem,
  fetchCredentials,
  setCredential,
  rotateCredential,
  revealCredential,
  deleteCredential,
} from '../lib/api';

interface ApiCredentialsManagerProps {
  currentApp: AppInstance | null;
  apps: AppInstance[];
  onSelectApp: (app: AppInstance | null) => void;
}

const COMMON_KEY_TEMPLATES = [
  { keyName: 'GEMINI_API_KEY', provider: 'Google Gemini AI (Google AI Studio)', serviceType: 'AI' },
  { keyName: 'WHATSAPP_API_KEY', provider: 'Meta WhatsApp Cloud', serviceType: 'MESSAGING' },
  { keyName: 'SMS_GATEWAY_TOKEN', provider: 'MSG91 / Twilio', serviceType: 'SMS' },
  { keyName: 'MAPBOX_ACCESS_TOKEN', provider: 'Mapbox GIS Engine', serviceType: 'MAPS' },
  { keyName: 'ECI_POLLING_API_KEY', provider: 'Election Commission Service', serviceType: 'GOVERNMENT' },
  { keyName: 'AI_GATEWAY_API_KEY', provider: 'Google Gemini / Neon AI', serviceType: 'AI' },
  { keyName: 'PAYMENT_GATEWAY_SECRET', provider: 'Razorpay / Cashfree', serviceType: 'PAYMENT' },
];

export default function ApiCredentialsManager({
  currentApp,
  apps,
  onSelectApp,
}: ApiCredentialsManagerProps) {
  const [credentials, setCredentials] = useState<ApiCredentialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal / Form state for Add or Update
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formKeyName, setFormKeyName] = useState('');
  const [formSecretValue, setFormSecretValue] = useState('');
  const [formProvider, setFormProvider] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rotation modal state
  const [rotatingKey, setRotatingKey] = useState<ApiCredentialItem | null>(null);
  const [newRotateSecret, setNewRotateSecret] = useState('');

  // Revealed secrets cache (keyName -> decrypted secret)
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const effectiveOrgId = currentApp?.organisationId || currentApp?.id;

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchCredentials(effectiveOrgId);
      setCredentials(items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load encrypted API credentials.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [effectiveOrgId]);

  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKeyName.trim() || !formSecretValue.trim()) {
      setError('Key name and secret value are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await setCredential({
        keyName: formKeyName.trim().toUpperCase(),
        secretValue: formSecretValue.trim(),
        provider: formProvider.trim() || 'Custom Provider',
        organisationId: effectiveOrgId,
      });

      setSuccessMsg(`Credential ${formKeyName.toUpperCase()} encrypted and saved to database.`);
      setIsAddModalOpen(false);
      setFormKeyName('');
      setFormSecretValue('');
      setFormProvider('');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to save encrypted credential.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRotate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rotatingKey || !newRotateSecret.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await rotateCredential(rotatingKey.keyName, newRotateSecret.trim(), effectiveOrgId);
      setSuccessMsg(`Credential ${rotatingKey.keyName} rotated and re-encrypted successfully.`);
      setRotatingKey(null);
      setNewRotateSecret('');
      // Invalidate revealed cache for this key
      setRevealedSecrets((prev) => {
        const next = { ...prev };
        delete next[rotatingKey.keyName];
        return next;
      });
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to rotate credential.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleReveal = async (keyName: string) => {
    if (revealedSecrets[keyName]) {
      // Hide
      setRevealedSecrets((prev) => {
        const next = { ...prev };
        delete next[keyName];
        return next;
      });
      return;
    }

    // Reveal from server
    try {
      const res = await revealCredential(keyName, effectiveOrgId);
      setRevealedSecrets((prev) => ({
        ...prev,
        [keyName]: res.secretValue,
      }));
    } catch (err: any) {
      setError(err?.message || `Failed to decrypt credential ${keyName}.`);
    }
  };

  const handleDelete = async (keyName: string) => {
    if (!window.confirm(`Are you sure you want to deactivate and soft-delete API key "${keyName}"? Live integrations using this key will immediately halt.`)) {
      return;
    }

    try {
      await deleteCredential(keyName, effectiveOrgId);
      setSuccessMsg(`Credential "${keyName}" soft-deleted successfully.`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete credential.');
    }
  };

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-400/10 border border-amber-400/20 text-amber-400 rounded-xl">
                <KeyRound className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-black text-white tracking-tight">
                Database-Backed Encrypted API Credentials
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                AES-256-GCM
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              SuperAdmin cryptographic vault. API keys and secrets are encrypted at rest using AES-256-GCM and stored in the database. SuperAdmin can change, rotate, and audit all tenant API keys with zero platform downtime.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm shadow-amber-400/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Configure New Key</span>
            </button>
            <button
              onClick={loadData}
              title="Refresh credentials"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tenant Organization Filter Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">Active Tenant Scope:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => onSelectApp(null)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  !currentApp
                    ? 'bg-amber-400 text-slate-950 font-black'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                All Platform Keys
              </button>
              {apps.map((app) => (
                <button
                  key={app.id}
                  onClick={() => onSelectApp(app)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    currentApp?.id === app.id
                      ? 'bg-amber-400 text-slate-950 font-black'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: app.primaryColor || '#F59E0B' }}
                  />
                  <span>{app.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-mono">Vault Mode: Hardware Key Derivation</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-slate-400 hover:text-white text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Credentials Table / Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <span className="text-xs font-black text-white uppercase tracking-wider">
            Configured Credentials ({credentials.length})
          </span>
          <span className="text-[11px] text-slate-400">
            Keys are masked automatically. Only authorized SuperAdmins can decrypt or rotate keys.
          </span>
        </div>

        {loading && credentials.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
            <span>Loading encrypted keys from database...</span>
          </div>
        ) : credentials.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-3">
            <Lock className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="font-bold text-slate-300">No API keys configured yet for this tenant scope.</p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Store WhatsApp API keys, SMS gateway tokens, AI keys, or Mapbox tokens securely in the database.
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Add First API Key
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {credentials.map((cred) => {
              const isRevealed = Boolean(revealedSecrets[cred.keyName]);
              const displayVal = isRevealed ? revealedSecrets[cred.keyName] : cred.maskedValue;

              return (
                <div
                  key={cred.id}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/40 transition"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs font-black text-amber-300 tracking-wider">
                        {cred.keyName}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {cred.provider}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                        v{cred.version}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Updated {new Date(cred.updatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs text-slate-300 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 w-full max-w-xl">
                      <span className="truncate flex-1 select-all font-semibold">
                        {displayVal}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleReveal(cred.keyName)}
                        title={isRevealed ? 'Hide secret' : 'Reveal plaintext secret'}
                        className="p-1 hover:text-amber-400 text-slate-400 transition cursor-pointer"
                      >
                        {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(displayVal, cred.keyName)}
                        title="Copy to clipboard"
                        className="p-1 hover:text-amber-400 text-slate-400 transition cursor-pointer"
                      >
                        {copiedKey === cred.keyName ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setRotatingKey(cred);
                        setNewRotateSecret('');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                      <span>Rotate Key</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(cred.keyName)}
                      title="Deactivate credential"
                      className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition border border-transparent hover:border-rose-500/20 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Update Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">Configure Encrypted API Key</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {/* Quick Templates */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400">Quick Template Presets:</label>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_KEY_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.keyName}
                    type="button"
                    onClick={() => {
                      setFormKeyName(tmpl.keyName);
                      setFormProvider(tmpl.provider);
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer"
                  >
                    {tmpl.keyName}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSaveCredential} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-300">Key Identifier Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WHATSAPP_API_KEY"
                  value={formKeyName}
                  onChange={(e) => setFormKeyName(e.target.value.replace(/\s+/g, '_').toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono font-bold text-white placeholder-slate-600 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Provider / Service Label</label>
                <input
                  type="text"
                  placeholder="e.g. Meta Cloud API"
                  value={formProvider}
                  onChange={(e) => setFormProvider(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Secret Value / API Key Token *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Paste raw API key, bearer token, or secret string here..."
                  value={formSecretValue}
                  onChange={(e) => setFormSecretValue(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-white placeholder-slate-600 focus:border-amber-400 focus:outline-none resize-none"
                />
                <p className="text-[10px] text-slate-500">
                  Value will be encrypted with AES-256-GCM before entering the PostgreSQL database.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 rounded-xl font-black transition cursor-pointer"
                >
                  {isSubmitting ? 'Encrypting & Saving...' : 'Save & Encrypt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rotate Key Modal */}
      {rotatingKey && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">Rotate Credential: {rotatingKey.keyName}</h3>
              </div>
              <button
                onClick={() => setRotatingKey(null)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Rotating this credential will increment its version to <strong>v{rotatingKey.version + 1}</strong> and archive the previous key. Active services will immediately adopt the new key.
            </p>

            <form onSubmit={handleRotate} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-300">New Secret Value / API Key *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Paste new rotated API key string here..."
                  value={newRotateSecret}
                  onChange={(e) => setNewRotateSecret(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-white placeholder-slate-600 focus:border-amber-400 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRotatingKey(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newRotateSecret.trim()}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 rounded-xl font-black transition cursor-pointer"
                >
                  {isSubmitting ? 'Rotating...' : 'Rotate & Re-encrypt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
