import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, ArrowUpRight, Users } from 'lucide-react';
import { UserSession } from '../types';
import { fetchHierarchySummaryByUser, fetchLiveVoteEventsByUser, HierarchySummaryPayload, LiveVoteEventItem } from '../lib/api';
import { createRealtimeSocket, RealtimeSummaryInvalidate, RealtimeVoteEvent } from '../lib/realtime';

interface HierarchyPulseProps {
  session: UserSession;
}

export default function HierarchyPulse({ session }: HierarchyPulseProps) {
  const [summary, setSummary] = useState<HierarchySummaryPayload | null>(null);
  const [events, setEvents] = useState<LiveVoteEventItem[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    let active = true;
    const socket = createRealtimeSocket({ userId: session.userId, unitId: session.unitId });

    const run = async () => {
      try {
        const [summaryPayload, eventItems] = await Promise.all([
          fetchHierarchySummaryByUser(session.userId),
          fetchLiveVoteEventsByUser(session.userId, 5),
        ]);

        if (!active) {
          return;
        }

        setSummary(summaryPayload);
        setEvents(eventItems);
        setStatus('ready');
      } catch {
        if (active) {
          setStatus('error');
        }
      }
    };

    socket.on('connect', () => {
      if (active) {
        setStatus('ready');
      }
    });

    socket.on('summary:invalidate', (_payload: RealtimeSummaryInvalidate) => {
      void run();
    });

    socket.on('vote:event', (event: RealtimeVoteEvent) => {
      if (!active) {
        return;
      }

      setEvents((prev) => {
        const next: LiveVoteEventItem[] = [event, ...prev.filter((item) => item.id !== event.id)];
        return next.slice(0, 5);
      });
      void run();
    });

    void run();

    return () => {
      active = false;
      socket.disconnect();
    };
  }, [session.unitId, session.userId]);

  const turnoutPercent = useMemo(() => {
    const total = summary?.snapshot?.summary?.totalVoters ?? 0;
    if (!total) {
      return 0;
    }

    const voted = summary?.snapshot?.summary?.voted ?? 0;
    return Math.round((voted / total) * 100);
  }, [summary]);

  if (status === 'error') {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Live Hierarchy Pulse</p>
          <h3 className="text-sm font-bold text-slate-900">{summary?.user?.unitName || 'Loading scope...'}</h3>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          <Activity className="w-3.5 h-3.5" />
          {status === 'loading' ? 'Syncing' : 'Live'}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Total" value={summary?.snapshot?.summary?.totalVoters ?? 0} />
        <Stat label="Voted" value={summary?.snapshot?.summary?.voted ?? 0} />
        <Stat label="Remaining" value={summary?.snapshot?.summary?.remaining ?? 0} />
        <Stat label="Turnout" value={`${turnoutPercent}%`} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Fake" value={summary?.snapshot?.summary?.fakeVoters ?? 0} icon={AlertCircle} />
        <Stat label="Migrated" value={summary?.snapshot?.summary?.migrated ?? 0} icon={Users} />
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Recent Vote Events</p>
        {events.length === 0 ? (
          <p className="text-xs text-slate-500">No recent voter updates in this scope.</p>
        ) : (
          events.map((event) => (
            <div key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-800 truncate">{event.voter.name}</p>
                <span className="text-[10px] text-slate-500">{new Date(event.changedAt).toLocaleTimeString()}</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">{event.unit.name} • {event.incharge.name}</p>
              <p className="text-[11px] font-medium text-emerald-700 mt-1 inline-flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" />
                {event.previousStatus} to {event.nextStatus}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number | string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-bold text-slate-900 mt-1 inline-flex items-center gap-1.5">
        {Icon ? <Icon className="w-3.5 h-3.5 text-slate-500" /> : null}
        {value}
      </p>
    </div>
  );
}
