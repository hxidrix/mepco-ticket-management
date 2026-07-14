import { apiClient } from './api';
import type { PaginationMeta } from '../types/users';

export interface NotificationItem {
  id: number; type: string; title: string; message: string; targetType: string | null;
  targetId: number | null; readAt: string | null; createdAt: string;
}

function unwrap<T>(payload: unknown): T {
  if (typeof payload !== 'object' || payload === null || !('data' in payload)) throw new Error('Invalid API response');
  return (payload as { data: T }).data;
}

export async function notificationsRequest(page = 1): Promise<{ items: NotificationItem[]; unreadCount: number; meta: PaginationMeta }> {
  const response = await apiClient.get('/notifications', { params: { page, pageSize: 30 } });
  const data = unwrap<{ items: NotificationItem[]; unreadCount: number }>(response.data);
  return { ...data, meta: (response.data as { meta: PaginationMeta }).meta };
}

export async function markNotificationReadRequest(id: number): Promise<void> {
  await apiClient.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsReadRequest(): Promise<void> {
  await apiClient.post('/notifications/read-all');
}
