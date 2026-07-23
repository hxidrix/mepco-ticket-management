import { apiClient } from './api';

export type SuspensionCategory =
  | 'abusive-behavior'
  | 'fraudulent-information'
  | 'repeated-policy-violation'
  | 'security-risk'
  | 'misuse-of-service'
  | 'other';
export type SuspensionCaseStatus = 'pending' | 'approved' | 'rejected';

export interface SuspensionCaseInput {
  category: SuspensionCategory;
  reasonSummary: string;
  details: string;
}

export interface SuspensionCase {
  id: number;
  targetUserId: number;
  targetName: string;
  targetRole: 'consumer' | 'employee';
  targetStatus: 'active' | 'suspended' | 'inactive';
  requestedBy: number;
  requesterName: string;
  requesterRole: string;
  sourceTicketId: number | null;
  ticketNumber: string | null;
  origin: 'technician_request' | 'manager_direct';
  category: SuspensionCategory;
  reasonSummary: string;
  details: string;
  status: SuspensionCaseStatus;
  reviewerName: string | null;
  decisionNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequesterAccountOption {
  id: number;
  displayName: string;
  role: 'consumer' | 'employee';
  status: 'active' | 'suspended' | 'inactive';
  identifier: string;
}

function unwrap<T>(payload: unknown): T {
  if (typeof payload !== 'object' || payload === null || !('data' in payload)) {
    throw new Error('The API returned an invalid response');
  }
  return (payload as { data: T }).data;
}

export async function suspensionCasesRequest(status = ''): Promise<SuspensionCase[]> {
  const response = await apiClient.get('/account-governance/requests', {
    params: status === '' ? undefined : { status },
  });
  return unwrap<SuspensionCase[]>(response.data);
}

export async function requestAccountSuspension(
  ticketId: number,
  input: SuspensionCaseInput,
): Promise<void> {
  await apiClient.post('/account-governance/requests', { ticketId, ...input });
}

export async function requesterAccountsRequest(search = ''): Promise<RequesterAccountOption[]> {
  const response = await apiClient.get('/account-governance/requesters', {
    params: search === '' ? undefined : { search },
  });
  return unwrap<RequesterAccountOption[]>(response.data);
}

export async function directlySuspendAccount(
  userId: number,
  input: SuspensionCaseInput,
): Promise<void> {
  await apiClient.post(`/account-governance/users/${userId}/suspend`, input);
}

export async function reviewAccountSuspension(
  caseId: number,
  input: { decision: 'approved' | 'rejected'; decisionNotes: string },
): Promise<void> {
  await apiClient.put(`/account-governance/requests/${caseId}/review`, input);
}

export async function reactivateRequesterAccount(userId: number, reason: string): Promise<void> {
  await apiClient.post(`/account-governance/users/${userId}/reactivate`, { reason });
}
