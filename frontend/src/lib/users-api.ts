import type { AxiosRequestConfig } from 'axios';

import { apiClient } from './api';
import type { PaginationMeta, UserProfile } from '../types/users';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function unwrap<T>(payload: unknown): T {
  if (!isRecord(payload) || payload.success !== true || !('data' in payload)) {
    throw new Error('The API returned an invalid response');
  }
  return payload.data as T;
}

export async function profileRequest(): Promise<UserProfile> {
  const response = await apiClient.get('/users/me/profile');
  return unwrap<{ profile: UserProfile }>(response.data).profile;
}

export async function updateProfileRequest(input: Record<string, unknown>): Promise<UserProfile> {
  const response = await apiClient.put('/users/me/profile', input);
  return unwrap<{ profile: UserProfile }>(response.data).profile;
}

export async function changePasswordRequest(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await apiClient.post('/users/me/password', input);
}

export async function usersRequest(config: AxiosRequestConfig = {}): Promise<{
  items: UserProfile[];
  meta: PaginationMeta;
}> {
  const response = await apiClient.get('/users/admin', config);
  const items = unwrap<UserProfile[]>(response.data);
  const payload = response.data as { meta: PaginationMeta };
  return { items, meta: payload.meta };
}

export async function createStaffRequest(input: Record<string, unknown>): Promise<UserProfile> {
  const response = await apiClient.post('/users/admin', input);
  return unwrap<{ profile: UserProfile }>(response.data).profile;
}

export async function createEmployeeRequest(input: Record<string, unknown>): Promise<UserProfile> {
  const response = await apiClient.post('/users/admin/employees', input);
  return unwrap<{ profile: UserProfile }>(response.data).profile;
}

export async function updateUserRequest(
  id: number,
  input: Record<string, unknown>,
): Promise<UserProfile> {
  const response = await apiClient.put(`/users/admin/${id}`, input);
  return unwrap<{ profile: UserProfile }>(response.data).profile;
}

export async function resetPasswordRequest(id: number, password: string): Promise<void> {
  await apiClient.post(`/users/admin/${id}/reset-password`, { password });
}

export async function deleteUserRequest(id: number): Promise<void> {
  await apiClient.delete(`/users/admin/${id}`);
}
