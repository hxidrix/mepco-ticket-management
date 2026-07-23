import { apiClient } from './api';
import type { UserRole } from '../types/auth';

export interface MessageRecipient {
  id: number;
  displayName: string;
  role: 'technician' | 'supervisor' | 'administrator';
}

export interface MessageThread {
  id: number;
  subject: string;
  technicianId: number;
  technicianName: string;
  managerId: number;
  managerName: string;
  managerRole: 'supervisor' | 'administrator';
  lastMessagePreview: string;
  lastMessageAt: string;
  createdAt: string;
  unreadCount: number;
}

export interface InternalMessage {
  id: number;
  senderId: number;
  senderName: string;
  senderRole: UserRole;
  body: string;
  createdAt: string;
}

export interface MessageThreadDetail {
  thread: Omit<MessageThread, 'lastMessagePreview' | 'unreadCount'> & { lastMessageId: number | null };
  messages: InternalMessage[];
}

function unwrap<T>(payload: unknown): T {
  if (typeof payload !== 'object' || payload === null || !('data' in payload)) {
    throw new Error('Invalid API response');
  }
  return (payload as { data: T }).data;
}

export async function messageRecipientsRequest(): Promise<MessageRecipient[]> {
  const response = await apiClient.get('/internal-messages/recipients');
  return unwrap<MessageRecipient[]>(response.data);
}

export async function messageThreadsRequest(): Promise<MessageThread[]> {
  const response = await apiClient.get('/internal-messages/threads');
  return unwrap<MessageThread[]>(response.data);
}

export async function messageThreadRequest(threadId: number): Promise<MessageThreadDetail> {
  const response = await apiClient.get(`/internal-messages/threads/${threadId}`);
  return unwrap<MessageThreadDetail>(response.data);
}

export async function createMessageThreadRequest(input: {
  recipientId: number;
  subject: string;
  message: string;
}): Promise<number> {
  const response = await apiClient.post('/internal-messages/threads', input);
  return unwrap<{ threadId: number }>(response.data).threadId;
}

export async function replyToMessageThreadRequest(threadId: number, message: string): Promise<void> {
  await apiClient.post(`/internal-messages/threads/${threadId}/messages`, { message });
}
