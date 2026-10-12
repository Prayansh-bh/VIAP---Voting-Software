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

export async function fetchTrainingVideos(_unitId?: string): Promise<TrainingVideo[]> {
  return apiFetch<TrainingVideo[]>('/api/training/videos');
}

export async function fetchTrainingProgress(_userId?: string): Promise<TrainingProgressItem[]> {
  return [];
}

export async function fetchTrainingProgressForUnit(_unitId: string): Promise<TrainingProgressItem[]> {
  return [];
}

export async function ensureTrainingAssigned(userId: string, videoId: string): Promise<any> {
  return { id: `prog-${videoId}-${userId}` };
}

export async function updateTrainingProgress(videoId: string, status: string, quizScore?: number): Promise<any> {
  return apiFetch(`/api/training/${videoId}/progress`, {
    method: 'PATCH',
    body: JSON.stringify({ status, quizScore }),
  });
}
