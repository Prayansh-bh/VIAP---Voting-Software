/// <reference types="vite/client" />

import { io, Socket } from 'socket.io-client';
import { getAuthToken } from './authStorage';
import { getApiBase } from './api';

const API_BASE = getApiBase();

export interface RealtimeVoteEvent {
  id: string;
  previousStatus: 'NOT_VOTED' | 'VOTE_DONE';
  nextStatus: 'NOT_VOTED' | 'VOTE_DONE';
  changedAt: string;
  voter: {
    id: string;
    name: string;
    epicNumber: string;
    politicalPreference?: string;
  };
  unit: {
    id: string;
    name: string;
    level: string;
  };
  incharge: {
    id: string;
    userCode: string;
    name: string;
  };
}

export interface RealtimeTaskEvent {
  type: 'created' | 'updated' | 'status_updated';
  taskId: string;
  unitId?: string;
  status?: string;
}

export interface RealtimeReportEvent {
  type: 'created';
  reportId: string;
  unitId?: string;
  description?: string;
}

export interface RealtimePollingReportEvent {
  reportId: string;
  mandal: string;
  booth: string;
  totalVotes: number;
}

export interface RealtimeSummaryInvalidate {
  unitId: string;
  delta?: number;
  voterId?: string;
  timestamp?: string;
}

export function createRealtimeSocket(params: { userId: string; unitId?: string }): Socket {
  const token = getAuthToken();

  const socket = io(API_BASE, {
    transports: ['websocket', 'polling'],
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    auth: {
      token,
    },
    query: {
      userId: params.userId,
      unitId: params.unitId || '',
    },
  });

  socket.on('connect', () => {
    console.log(`[Socket] Connected as user ${params.userId}, unit: ${params.unitId || 'all'}`);
    if (params.unitId) {
      socket.emit('join:unit', params.unitId);
    }
  });

  socket.on('disconnect', (reason) => {
    console.warn('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.warn('[Socket] Connection error:', error.message);
  });

  return socket;
}
