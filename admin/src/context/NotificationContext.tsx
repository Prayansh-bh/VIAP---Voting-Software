import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  Trash2,
  KeyRound,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  icon?: 'trash' | 'alert' | 'key' | 'shield' | 'question';
}

interface NotificationContextType {
  notify: {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
  };
  confirmDialog: (options: ConfirmOptions) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const addToast = useCallback((type: ToastType, message: string, title?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newToast: ToastItem = { id, type, message, title };

    setToasts((prev) => [...prev.slice(-4), newToast]); // keep max 5 active

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = {
    success: useCallback((message: string, title?: string) => addToast('success', message, title || 'Success'), [addToast]),
    error: useCallback((message: string, title?: string) => addToast('error', message, title || 'Error Notice'), [addToast]),
    warning: useCallback((message: string, title?: string) => addToast('warning', message, title || 'Attention Required'), [addToast]),
    info: useCallback((message: string, title?: string) => addToast('info', message, title || 'System Update'), [addToast]),
  };

  const confirmDialog = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        options,
        resolve: (val: boolean) => {
          setConfirmState(null);
          resolve(val);
        },
      });
    });
  }, []);

  return (
    <NotificationContext.Provider value={{ notify, confirmDialog }}>
      {children}

      {/* Floating Modern Toast Notifications Stack */}
      <div
        className="fixed top-5 right-5 z-[999999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';

          const borderBg = isSuccess
            ? 'border-emerald-500/40 bg-slate-950/95 text-emerald-400'
            : isError
            ? 'border-rose-500/40 bg-slate-950/95 text-rose-400'
            : isWarning
            ? 'border-amber-500/40 bg-slate-950/95 text-amber-400'
            : 'border-cyan-500/40 bg-slate-950/95 text-cyan-400';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto p-4 rounded-2xl border shadow-2xl backdrop-blur-md flex items-start gap-3 transition-all duration-300 transform translate-y-0 opacity-100 animate-slide-in ${borderBg}`}
              style={{
                boxShadow: isSuccess
                  ? '0 10px 25px -5px rgba(16, 185, 129, 0.15)'
                  : isError
                  ? '0 10px 25px -5px rgba(244, 63, 94, 0.15)'
                  : isWarning
                  ? '0 10px 25px -5px rgba(245, 158, 11, 0.15)'
                  : '0 10px 25px -5px rgba(6, 182, 212, 0.15)',
              }}
            >
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {isError && <AlertCircle className="w-5 h-5 text-rose-400" />}
                {isWarning && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                {!isSuccess && !isError && !isWarning && <Info className="w-5 h-5 text-cyan-400" />}
              </div>

              <div className="flex-1 text-left min-w-0 pr-1">
                {toast.title && (
                  <h4 className="text-xs font-black uppercase tracking-wider text-white mb-0.5 truncate">
                    {toast.title}
                  </h4>
                )}
                <p className="text-xs text-slate-300 font-medium leading-relaxed break-words">
                  {toast.message}
                </p>
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 text-slate-500 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal Backdrop & Dialog */}
      {confirmState && (
        <div className="fixed inset-0 z-[999999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 text-left relative overflow-hidden transform scale-100 transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top decorative accent */}
            <div
              className={`absolute top-0 left-0 right-0 h-1 ${
                confirmState.options.danger ? 'bg-rose-500' : 'bg-amber-400'
              }`}
            />

            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                  confirmState.options.danger
                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    : 'bg-amber-400/10 border-amber-400/20 text-amber-400'
                }`}
              >
                {confirmState.options.icon === 'trash' || confirmState.options.danger ? (
                  <Trash2 className="w-6 h-6" />
                ) : confirmState.options.icon === 'key' ? (
                  <KeyRound className="w-6 h-6" />
                ) : confirmState.options.icon === 'shield' ? (
                  <ShieldAlert className="w-6 h-6" />
                ) : (
                  <HelpCircle className="w-6 h-6" />
                )}
              </div>

              <div className="space-y-1.5 flex-1 min-w-0">
                <h3 className="text-base font-black text-white tracking-tight">
                  {confirmState.options.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed font-normal">
                  {confirmState.options.message}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => confirmState.resolve(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                {confirmState.options.cancelText || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => confirmState.resolve(true)}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition cursor-pointer flex items-center gap-1.5 ${
                  confirmState.options.danger
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-400/20'
                }`}
              >
                {confirmState.options.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
