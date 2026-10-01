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

    setToasts((prev) => [...prev.slice(-4), newToast]);

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
    info: useCallback((message: string, title?: string) => addToast('info', message, title || 'Information'), [addToast]),
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

      {/* Floating Modern Toast Stack */}
      <div
        className="fixed top-5 right-5 z-[999999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';

          const borderBg = isSuccess
            ? 'border-emerald-200 bg-white text-emerald-950 shadow-emerald-500/10'
            : isError
            ? 'border-rose-200 bg-white text-rose-950 shadow-rose-500/10'
            : isWarning
            ? 'border-amber-200 bg-white text-amber-950 shadow-amber-500/10'
            : 'border-sky-200 bg-white text-slate-900 shadow-sky-500/10';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto p-4 rounded-2xl border shadow-xl flex items-start gap-3 transition-all duration-300 transform translate-y-0 opacity-100 ${borderBg}`}
            >
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                {isError && <AlertCircle className="w-5 h-5 text-rose-600" />}
                {isWarning && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                {!isSuccess && !isError && !isWarning && <Info className="w-5 h-5 text-sky-600" />}
              </div>

              <div className="flex-1 text-left min-w-0 pr-1">
                {toast.title && (
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-0.5 truncate">
                    {toast.title}
                  </h4>
                )}
                <p className="text-xs text-slate-600 font-semibold leading-relaxed break-words">
                  {toast.message}
                </p>
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
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
        <div className="fixed inset-0 z-[999999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 text-left relative overflow-hidden transform scale-100 transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top decorative accent */}
            <div
              className={`absolute top-0 left-0 right-0 h-1.5 ${
                confirmState.options.danger ? 'bg-rose-500' : 'bg-amber-400'
              }`}
            />

            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                  confirmState.options.danger
                    ? 'bg-rose-50 border-rose-200 text-rose-600'
                    : 'bg-amber-50 border-amber-200 text-amber-600'
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
                <h3 className="text-base font-black text-slate-950 tracking-tight">
                  {confirmState.options.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  {confirmState.options.message}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => confirmState.resolve(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                {confirmState.options.cancelText || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => confirmState.resolve(true)}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5 ${
                  confirmState.options.danger
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                    : 'bg-yellow-400 hover:bg-yellow-500 text-slate-950 shadow-yellow-400/20'
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
