import { apiClient } from './api';

export type SuspensionRequestType = 'appeal' | 'support';
export type SuspensionRequestStatus = 'submitted' | 'under-review' | 'approved' | 'rejected' | 'resolved';
export type ContactPreference = 'portal' | 'email' | 'phone';

export interface SuspensionRequest {
  id: number;
  userId: number;
  displayName: string;
  role: string;
  requestType: SuspensionRequestType;
  message: string;
  contactPreference: ContactPreference;
  status: SuspensionRequestStatus;
  adminResponse: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  suspensionReason: string | null;
}

export interface SuspensionPortal {
  account: {
    id: number;
    displayName: string;
    email: string | null;
    phone: string | null;
    status: 'suspended';
    statusReason: string | null;
    statusUpdatedAt: string;
  };
  requests: SuspensionRequest[];
}

function unwrap<T>(payload: unknown): T {
  if (typeof payload !== 'object' || payload === null || !('data' in payload)) {
    throw new Error('The API returned an invalid response');
  }
  return (payload as { data: T }).data;
}

export async function suspensionPortalRequest(): Promise<SuspensionPortal> {
  const response = await apiClient.get('/suspensions/me');
  return unwrap<SuspensionPortal>(response.data);
}

export async function submitSuspensionRequest(input: {
  requestType: SuspensionRequestType;
  message: string;
  contactPreference: ContactPreference;
}): Promise<void> {
  await apiClient.post('/suspensions/me/requests', input);
}

export async function suspensionRequestsAdminRequest(status = ''): Promise<SuspensionRequest[]> {
  const response = await apiClient.get('/suspensions/admin/requests', {
    params: status === '' ? undefined : { status },
  });
  return unwrap<SuspensionRequest[]>(response.data);
}

export async function reviewSuspensionRequestAdmin(
  id: number,
  input: { status: Exclude<SuspensionRequestStatus, 'submitted'>; response: string },
): Promise<void> {
  await apiClient.put(`/suspensions/admin/requests/${id}`, input);
}
