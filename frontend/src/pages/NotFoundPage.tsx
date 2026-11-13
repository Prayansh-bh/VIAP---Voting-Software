import React from 'react';
import { Compass, Home, ArrowLeft } from 'lucide-react';

interface NotFoundPageProps {
  onGoHome?: () => void;
  onGoLogin?: () => void;
}

export default function NotFoundPage({ onGoHome, onGoLogin }: NotFoundPageProps) {
  const handleHome = () => {
    if (onGoHome) {
      onGoHome();
    } else {
      window.location.href = '/';
    }
  };

  const handleLogin = () => {
    if (onGoLogin) {
      onGoLogin();
    } else {
      window.location.href = '/login';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white flex flex-col items-center justify-center p-6 select-none">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-2xl shadow-amber-500/20">
          <Compass className="w-10 h-10 text-amber-400 animate-pulse" />
        </div>

        <div className="space-y-2">
          <div className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase bg-amber-500/10 text-amber-300 border border-amber-500/20">
            HTTP 404 &bull; Route Unreachable
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Page Not Found
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            The requested command view, hierarchy link, or URL path does not exist in this deployed party instance.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={handleHome}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Return to Landing</span>
          </button>
          <button
            type="button"
            onClick={handleLogin}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-sm transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Secure Login</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-600 font-mono">
          VIAP Field Command Platform &bull; Secure Routing Node
        </div>
      </div>
    </div>
  );
}
