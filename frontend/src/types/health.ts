export interface HealthData {
  service: string;
  status: 'ready';
  database: 'connected';
  timestamp: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: Record<string, unknown> | null;
}
