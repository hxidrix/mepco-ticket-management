import { apiClient } from './api';
import type { MasterCatalog, MasterItem, MasterResource } from '../types/master-data';

function unwrap<T>(payload: unknown): T {
  if (typeof payload !== 'object' || payload === null || !('success' in payload) || !('data' in payload)) {
    throw new Error('The API returned an invalid response');
  }
  return (payload as { data: T }).data;
}

export async function catalogRequest(): Promise<MasterCatalog> {
  const response = await apiClient.get('/master-data/catalog');
  return unwrap<MasterCatalog>(response.data);
}

export async function masterItemsRequest(resource: MasterResource): Promise<MasterItem[]> {
  const response = await apiClient.get(`/master-data/admin/${resource}`, { params: { includeInactive: true } });
  return unwrap<MasterItem[]>(response.data);
}

export async function createMasterItemRequest(
  resource: MasterResource,
  input: Record<string, unknown>,
): Promise<void> {
  await apiClient.post(`/master-data/admin/${resource}`, input);
}

export async function updateMasterItemRequest(
  resource: MasterResource,
  id: number,
  input: Record<string, unknown>,
): Promise<void> {
  await apiClient.put(`/master-data/admin/${resource}/${id}`, input);
}
