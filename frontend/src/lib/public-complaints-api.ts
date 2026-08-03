import { apiClient } from './api';

export interface VerifiedConsumer {
  referenceNumber: string;
  consumerId: string;
  name: string;
  subdivision: string;
  tariff: string;
  hasRegisteredPhone: boolean;
}

export interface PublicTrackedComplaint {
  ticketNumber: string;
  subject: string;
  description: string;
  categoryName: string;
  complaintTypeName: string;
  departmentName: string | null;
  priorityName: string;
  statusName: string;
  statusSlug: string;
  circleName: string;
  divisionName: string;
  subdivisionName: string;
  locationDetails: string | null;
  slaTargetHours: number;
  slaDueAt: string;
  resolutionSummary: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
}

function unwrap<T>(payload: unknown): T {
  if (typeof payload !== 'object' || payload === null || !('data' in payload)) {
    throw new Error('The API returned an invalid response');
  }
  return (payload as { data: T }).data;
}

export async function verifyConsumerRequest(
  referenceNumber: string,
  consumerId: string,
): Promise<VerifiedConsumer> {
  const response = await apiClient.post('/public/complaints/verify', { referenceNumber, consumerId });
  return unwrap<{ consumer: VerifiedConsumer }>(response.data).consumer;
}

export async function submitPublicComplaintRequest(
  input: Record<string, string | number>,
  attachments: File[],
): Promise<{ id: number; ticketNumber: string; smsQueued: boolean }> {
  const data = new FormData();
  for (const [key, value] of Object.entries(input)) data.append(key, String(value));
  for (const attachment of attachments) data.append('attachments', attachment);
  const response = await apiClient.post('/public/complaints/submit', data);
  return unwrap<{ ticket: { id: number; ticketNumber: string; smsQueued: boolean } }>(response.data).ticket;
}

export async function trackPublicComplaintRequest(input: {
  ticketNumber: string;
  referenceNumber: string;
  consumerId: string;
}): Promise<PublicTrackedComplaint> {
  const response = await apiClient.post('/public/complaints/track', input);
  return unwrap<{ ticket: PublicTrackedComplaint }>(response.data).ticket;
}
