import { apiClient } from './api';
import type { AuthPayload, LoginMode, RegistrationOptions } from '../types/auth';

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
  const response = await apiClient.post('/auth/login', { mode, identifier, password });
  const payload: unknown = response.data;
  return unwrapData<AuthPayload>(payload);
}

export async function refreshRequest(): Promise<AuthPayload> {
  const response = await apiClient.post('/auth/refresh');
  const payload: unknown = response.data;
  return unwrapData<AuthPayload>(payload);
}

export async function logoutRequest(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function registrationOptionsRequest(): Promise<RegistrationOptions> {
  const response = await apiClient.get('/auth/registration-options');
  const payload: unknown = response.data;
  return unwrapData<RegistrationOptions>(payload);
}

export async function registerConsumerRequest(input: Record<string, unknown>): Promise<void> {
  await apiClient.post('/auth/register/consumer', input);
}

export async function registerEmployeeRequest(input: Record<string, unknown>): Promise<void> {
  await apiClient.post('/auth/register/employee', input);
}

