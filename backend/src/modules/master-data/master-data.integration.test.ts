import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';

import { app } from '../../app.js';

function accessToken(response: SupertestResponse): string {
  const body = response.body as { data?: { accessToken?: unknown } };
  if (typeof body.data?.accessToken !== 'string') throw new Error('Expected an access token');
  return body.data.accessToken;
}

async function signIn(identifier: string, mode: 'consumer' | 'staff'): Promise<string> {
  const response = await request(app).post('/api/v1/auth/login')
    .send({ mode, identifier, password: 'Demo@12345' }).expect(200);
  return accessToken(response);
}

describe('master-data API', () => {
  it('returns the full active SRS catalog as structured ticket-form data', async () => {
    const token = await signIn('10000000000001', 'consumer');
    const response = await request(app).get('/api/v1/master-data/catalog')
      .set('Authorization', `Bearer ${token}`).expect(200);
    const catalog = (response.body as { data: {
      departments: unknown[]; circles: Array<{ cities: unknown[] }>;
      categories: Array<{ complaintTypes: Array<{ name: string }> }>;
      priorities: unknown[]; statuses: unknown[];
    } }).data;
    expect(catalog.departments.length).toBe(14);
    expect(catalog.circles.length).toBe(11);
    expect(catalog.circles.reduce((count, circle) => count + circle.cities.length, 0)).toBe(52);
    expect(catalog.categories.length).toBe(18);
    expect(catalog.categories.reduce((count, category) => count + category.complaintTypes.length, 0)).toBe(154);
    expect(catalog.categories.every((category) => category.complaintTypes.some((item) => item.name === 'Other'))).toBe(true);
  });

  it('enforces administrator access and supports create, edit, ordering and deactivation', async () => {
    const consumerToken = await signIn('10000000000001', 'consumer');
    await request(app).get('/api/v1/master-data/admin/circles?includeInactive=true')
      .set('Authorization', `Bearer ${consumerToken}`).expect(403);

    const adminToken = await signIn('admin.demo', 'staff');
    const createdCircle = await request(app).post('/api/v1/master-data/admin/circles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Fictional Acceptance Circle', sortOrder: 99, isActive: true }).expect(201);
    const circleId = (createdCircle.body as { data: { id: number } }).data.id;
    const createdCity = await request(app).post('/api/v1/master-data/admin/cities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Fictional Acceptance City', parentId: circleId, sortOrder: 1, isActive: true }).expect(201);
    const cityId = (createdCity.body as { data: { id: number } }).data.id;

    await request(app).put(`/api/v1/master-data/admin/cities/${cityId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Fictional Acceptance City Updated', parentId: circleId, sortOrder: 2, isActive: false })
      .expect(200);
    const list = await request(app).get('/api/v1/master-data/admin/cities?includeInactive=true')
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect((list.body as { data: Array<{ id: number; isActive: number }> }).data)
      .toContainEqual(expect.objectContaining({ id: cityId, isActive: 0 }));
  });

  it('prevents deactivation of a required Other option', async () => {
    const adminToken = await signIn('admin.demo', 'staff');
    const list = await request(app).get('/api/v1/master-data/admin/departments?includeInactive=true')
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    const other = (list.body as { data: Array<{
      id: number; name: string; slug: string; description: string; sortOrder: number;
    }> }).data.find((item) => item.name === 'Other');
    if (other === undefined) throw new Error('Other department was not seeded');
    await request(app).put(`/api/v1/master-data/admin/departments/${other.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...other, isActive: false }).expect(409);
  });
});
