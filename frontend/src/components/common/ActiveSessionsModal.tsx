import React, { useState, useEffect } from 'react';
import { ShieldCheck, Smartphone, Laptop, Trash2, X, Loader2, CheckCircle2 } from 'lucide-react';
import { fetchUserDevices, revokeDeviceApi, getDeviceId } from '../../lib/api/auth.api';

interface ActiveSessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ActiveSessionsModal({ isOpen, onClose }: ActiveSessionsModalProps) {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const currentDeviceId = getDeviceId();

  const loadDevices = async () => {
    try {
      const data = await fetchUserDevices();
      setDevices(Array.isArray(data) ? data : []);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      void loadDevices();
    }
  }, [isOpen]);

  const handleRevoke = async (deviceId: string) => {
    setRevokingId(deviceId);
    setFeedback(null);
    try {
      await revokeDeviceApi(deviceId, 'User requested session revocation');
      setFeedback('Device session revoked successfully.');
      setTimeout(() => setFeedback(null), 3000);
      setDevices((prev) => prev.filter((d) => d.id !== deviceId && d.deviceId !== deviceId));
    } catch (err: any) {
      setFeedback(err?.message || 'Failed to revoke device session');
    } finally {
      setRevokingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 my-8">
        {/* Header */}
        <div className="bg-slate-950 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-base font-bold text-slate-100">Active Login Sessions</h3>
              <p className="text-xs text-slate-400">Manage authenticated devices with active access to your account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {feedback && (
            <div className="p-2.5 bg-green-50 border border-green-200 text-green-800 text-xs font-bold rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          {loading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-400 font-bold">
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              <span>Querying authorized device sessions...</span>
            </div>
          ) : devices.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 font-medium">
              No remote device sessions registered. This session is currently active.
            </div>
          ) : (
            <div className="space-y-2.5">
              {devices.map((dev) => {
                const isCurrent = dev.deviceId === currentDeviceId;
                const isMobile = /mobile|android|iphone/i.test(dev.deviceName || dev.userAgent || '');

                return (
                  <div
                    key={dev.id || dev.deviceId}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                      isCurrent ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                        {isMobile ? <Smartphone className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-slate-900">{dev.deviceName || 'Authorized Device'}</h4>
                          {isCurrent && (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                              Current Device
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          IP: {dev.ipAddress || '127.0.0.1'} • Last active:{' '}
                          {dev.lastUsedAt ? new Date(dev.lastUsedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Recently'}
                        </p>
                      </div>
                    </div>

                    {!isCurrent && (
                      <button
                        type="button"
                        disabled={revokingId === (dev.id || dev.deviceId)}
                        onClick={() => handleRevoke(dev.id || dev.deviceId)}
                        className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg border border-red-200 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="Revoke session token"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Revoke</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
