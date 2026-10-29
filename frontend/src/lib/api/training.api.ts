import { TrainingVideo } from '../../types';
import { apiFetch } from './client';

export interface TrainingProgressItem {
  id: string;
  status: 'ASSIGNED' | 'WATCHED' | 'COMPLETED';
  quizScore?: number | null;
  watchedAt?: string | null;
  completedAt?: string | null;
  video: {
    id: string;
    title: string;
  };
  user: {
    id: string;
    userCode: string;
    name: string;
  };
}

export interface TrainingAnalyticsData {
  totalVideos: number;
  totalCadreMembers: number;
  totalAssignedTrainings: number;
  totalWatched: number;
  totalCompleted: number;
  completionRate: number;
}

export async function fetchTrainingAnalytics(): Promise<TrainingAnalyticsData> {
  return apiFetch<TrainingAnalyticsData>('/api/training/analytics');
}

export async function fetchTrainingVideos(_unitId?: string): Promise<TrainingVideo[]> {
  return apiFetch<TrainingVideo[]>('/api/training/videos');
}

export async function fetchTrainingProgress(userId?: string): Promise<TrainingProgressItem[]> {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return apiFetch<TrainingProgressItem[]>(`/api/training/progress${query}`);
}

export async function fetchTrainingProgressForUnit(unitId: string): Promise<TrainingProgressItem[]> {
  return apiFetch<TrainingProgressItem[]>(`/api/training/unit/${encodeURIComponent(unitId)}/progress`);
}

export async function ensureTrainingAssigned(userId: string, videoId: string): Promise<any> {
  return apiFetch('/api/training/ensure-assigned', {
    method: 'POST',
    body: JSON.stringify({ userId, videoId }),
  });
}

export async function updateTrainingProgress(videoId: string, status: string, quizScore?: number): Promise<any> {
  return apiFetch(`/api/training/${videoId}/progress`, {
    method: 'PATCH',
    body: JSON.stringify({ status, quizScore }),
  });
}
