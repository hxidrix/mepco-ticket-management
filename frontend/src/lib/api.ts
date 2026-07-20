import axios from 'axios';

import type { ApiSuccess, HealthData } from '../types/health';

// Keep browser requests on the frontend origin. Vite and Nginx proxy /api to
// the backend, so the HttpOnly refresh cookie remains first-party on reload.
const apiBaseUrl = import.meta.env.VITE_API_URL ?? '/api/v1';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10_000,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
});

export function setApiAccessToken(token: string | null): void {
  if (token === null) {
    delete apiClient.defaults.headers.common.Authorization;
    return;
  }
  apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isHealthResponse(value: unknown): value is ApiSuccess<HealthData> {
  if (!isRecord(value) || value.success !== true || !isRecord(value.data)) return false;

  return (
    typeof value.data.service === 'string' &&
    value.data.status === 'ready' &&
    value.data.database === 'connected' &&
    typeof value.data.timestamp === 'string'
  );
}

export async function getPlatformStatus(signal?: AbortSignal): Promise<HealthData> {
  const config = signal === undefined ? undefined : { signal };
  const response = await apiClient.get('/health/ready', config);
  const payload: unknown = response.data;

  if (!isHealthResponse(payload)) {
    throw new Error('The API returned an invalid health response');
  }

  return payload.data;
}
