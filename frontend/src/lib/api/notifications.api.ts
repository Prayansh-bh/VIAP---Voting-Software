import { apiFetch } from './client';

export async function fetchNotifications(unreadOnly = false): Promise<{ items: any[]; unreadCount: number }> {
  return apiFetch<{ items: any[]; unreadCount: number }>(`/api/notifications?unreadOnly=${unreadOnly}`);
}

export async function markNotificationRead(id: string): Promise<any> {
  return apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
}

export async function markAllNotificationsRead(): Promise<any> {
  return apiFetch('/api/notifications/read-all', { method: 'PATCH' });
}
