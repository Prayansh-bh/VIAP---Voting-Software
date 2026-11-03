import { VoterTask } from '../../types';
import { apiFetch } from './client';

export async function fetchTasks(query: any = {}): Promise<VoterTask[]> {
  const searchParams = new URLSearchParams(query);
  const endpoint = `/api/tasks${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  return apiFetch<VoterTask[]>(endpoint);
}

export async function fetchTasksForUser(_userId: string): Promise<VoterTask[]> {
  return fetchTasks();
}

export async function fetchTasksForUnit(unitId: string): Promise<VoterTask[]> {
  return fetchTasks({ unitId });
}

export async function createTask(data: Partial<VoterTask>): Promise<VoterTask> {
  return apiFetch<VoterTask>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTaskStatus(id: string, status: string, comments?: string): Promise<VoterTask> {
  const normalizedStatus = String(status || '').trim().toUpperCase().replace(/\s+/g, '_');
  return apiFetch<VoterTask>(`/api/tasks/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: normalizedStatus, comments }),
  });
}

export async function deleteTask(id: string): Promise<{ id: string; deleted: boolean; softArchived?: boolean }> {
  return apiFetch<{ id: string; deleted: boolean; softArchived?: boolean }>(`/api/tasks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
