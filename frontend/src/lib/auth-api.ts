import { apiClient } from './api';
import type { AuthPayload, EmployeeVerificationPreview, LocationCatalogOptions, LoginMode } from '../types/auth';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function unwrapData<T>(payload: unknown): T {
  if (!isRecord(payload) || payload.success !== true || !('data' in payload)) {
    throw new Error('The API returned an invalid response');
  }
  return payload.data as T;
}

export function getApiErrorMessage(error: unknown): string {
  if (!isRecord(error) || !('response' in error) || !isRecord(error.response)) {
    return error instanceof Error ? error.message : 'Something went wrong';
  }
  const responseData = error.response.data;
  if (!isRecord(responseData) || !isRecord(responseData.error)) return 'Something went wrong';
  return typeof responseData.error.message === 'string'
    ? responseData.error.message
    : 'Something went wrong';
}

export async function loginRequest(
  mode: LoginMode,
  identifier: string,
  password: string,
): Promise<AuthPayload> {
  const response = mode === 'employee'
    ? await apiClient.post('/auth/employee/continue', {
        employeeId: identifier,
        cnicLastFour: password,
      })
    : await apiClient.post('/auth/login', { mode: 'staff', identifier, password });
  const payload: unknown = response.data;
  return unwrapData<AuthPayload>(payload);
}

export async function verifyEmployeeRequest(
  employeeId: string,
  cnicLastFour: string,
): Promise<EmployeeVerificationPreview> {
  const response = await apiClient.post('/auth/employee/verify', { employeeId, cnicLastFour });
  return unwrapData<{ employee: EmployeeVerificationPreview }>(response.data).employee;
}

export async function refreshRequest(): Promise<AuthPayload> {
  const response = await apiClient.post('/auth/refresh');
  const payload: unknown = response.data;
  return unwrapData<AuthPayload>(payload);
}

export async function logoutRequest(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function locationCatalogRequest(): Promise<LocationCatalogOptions> {
  const response = await apiClient.get('/master-data/catalog');
  return unwrapData<LocationCatalogOptions>(response.data);
}
