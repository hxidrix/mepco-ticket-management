import type { AxiosRequestConfig } from 'axios';

import { apiClient } from './api';
import type { PaginationMeta } from '../types/users';
import type { TicketDetail, TicketSummary } from '../types/tickets';

function unwrap<T>(payload: unknown): T {
  if (typeof payload !== 'object' || payload === null || !('data' in payload)) {
    throw new Error('The API returned an invalid response');
  }
  return (payload as { data: T }).data;
}

export async function createTicketRequest(input: Record<string, unknown>): Promise<{ id: number; ticketNumber: string }> {
  const response = await apiClient.post('/tickets', input);
  return unwrap<{ ticket: { id: number; ticketNumber: string } }>(response.data).ticket;
}

export async function ticketsRequest(config: AxiosRequestConfig = {}): Promise<{ items: TicketSummary[]; meta: PaginationMeta }> {
  const response = await apiClient.get('/tickets', config);
  return { items: unwrap<TicketSummary[]>(response.data), meta: (response.data as { meta: PaginationMeta }).meta };
}

export async function ticketDetailRequest(id: number): Promise<TicketDetail> {
  const response = await apiClient.get(`/tickets/${id}`);
  return unwrap<TicketDetail>(response.data);
}

export interface TechnicianOption {
  id: number;
  displayName: string;
  departmentName: string | null;
  activeAssignments: number;
}

export interface TicketMetrics {
  summary: { total: number; open: number; overdue: number; resolved: number; averageResolutionHours: number | null };
  byStatus: Array<{ label: string; count: number }>;
  byPriority: Array<{ label: string; count: number }>;
  workload: Array<{ assigneeId: number; assigneeName: string; count: number }>;
  recent: TicketSummary[];
}

export async function ticketMetricsRequest(): Promise<TicketMetrics> {
  const response = await apiClient.get('/tickets/reports/metrics');
  return unwrap<TicketMetrics>(response.data);
}

export async function exportTicketsRequest(params: Record<string, string> = {}): Promise<void> {
  const response = await apiClient.get('/tickets/reports/export.csv', { params, responseType: 'blob' });
  const url = URL.createObjectURL(response.data as Blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `mepco-tickets-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click();
  URL.revokeObjectURL(url);
}

export async function techniciansRequest(ticketId: number): Promise<TechnicianOption[]> {
  const response = await apiClient.get('/tickets/workflow/technicians', { params: { ticketId } });
  return unwrap<TechnicianOption[]>(response.data);
}

export async function assignTicketRequest(
  ticketId: number,
  input: { technicianId: number; reason: string; version: number },
): Promise<void> {
  await apiClient.post(`/tickets/${ticketId}/assign`, input);
}

export async function transitionTicketRequest(
  ticketId: number,
  input: { status: string; reason: string; resolutionSummary?: string; version: number },
): Promise<void> {
  await apiClient.post(`/tickets/${ticketId}/status`, input);
}

export async function changePriorityRequest(
  ticketId: number,
  input: { priorityId: number; reason: string; version: number },
): Promise<void> {
  await apiClient.post(`/tickets/${ticketId}/priority`, input);
}

export async function closeTicketWithReviewRequest(
  ticketId: number,
  input: { issueResolved: boolean; satisfactionRating: number; reviewText?: string; version: number },
): Promise<void> {
  await apiClient.post(`/tickets/${ticketId}/close-review`, input);
}

export async function deleteTicketRequest(
  ticketId: number,
  input: { reason: string; version: number },
): Promise<void> {
  await apiClient.delete(`/tickets/${ticketId}`, { data: input });
}

export async function addCommentRequest(
  ticketId: number,
  input: { body: string; visibility: 'public' | 'internal' },
): Promise<void> {
  await apiClient.post(`/tickets/${ticketId}/comments`, input);
}

export async function uploadAttachmentRequest(ticketId: number, file: File): Promise<void> {
  const data = new FormData(); data.append('file', file);
  await apiClient.post(`/tickets/${ticketId}/attachments`, data);
}

export async function downloadAttachmentRequest(attachmentId: number, originalName: string): Promise<void> {
  const response = await apiClient.get(`/tickets/attachments/${attachmentId}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data as Blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = originalName; anchor.click();
  URL.revokeObjectURL(url);
}
