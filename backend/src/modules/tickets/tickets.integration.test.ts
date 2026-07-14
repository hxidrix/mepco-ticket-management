import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';

import { app } from '../../app.js';

function token(response: SupertestResponse): string {
  const body = response.body as { data?: { accessToken?: unknown } };
  if (typeof body.data?.accessToken !== 'string') throw new Error('Expected access token');
  return body.data.accessToken;
}

async function login(mode: 'consumer' | 'employee' | 'staff', identifier: string): Promise<string> {
  return token(await request(app).post('/api/v1/auth/login')
    .send({ mode, identifier, password: 'Demo@12345' }).expect(200));
}

interface CatalogShape {
  categories: Array<{ id: number; domain: string; name: string; departmentId: number | null; complaintTypes: Array<{ id: number; name: string }> }>;
  circles: Array<{ id: number; cities: Array<{ id: number }> }>;
  priorities: Array<{ id: number; slug: string }>;
}

async function catalog(accessToken: string): Promise<CatalogShape> {
  const response = await request(app).get('/api/v1/master-data/catalog')
    .set('Authorization', `Bearer ${accessToken}`).expect(200);
  return (response.body as { data: CatalogShape }).data;
}

describe('requester ticket API', () => {
  it('creates one consumer ticket for a repeated idempotent submission and returns it privately', async () => {
    const consumerToken = await login('consumer', '10000000000001');
    const data = await catalog(consumerToken);
    const category = data.categories.find((item) => item.domain === 'consumer' && item.name !== 'Other');
    const type = category?.complaintTypes.find((item) => item.name !== 'Other');
    const circle = data.circles[0];
    const city = circle?.cities[0];
    const priority = data.priorities.find((item) => item.slug === 'medium');
    if (category === undefined || type === undefined || circle === undefined || city === undefined || priority === undefined) {
      throw new Error('Seed catalog is incomplete');
    }
    const payload = {
      subject: 'Fictional requester acceptance issue',
      description: 'A fictional consumer ticket created by the integration acceptance suite.',
      categoryId: category.id, complaintTypeId: type.id, circleId: circle.id, cityId: city.id,
      priorityId: priority.id, locationDetails: 'Fictional acceptance location',
      idempotencyKey: 'ticket-integration-idempotency-0001',
    };
    const first = await request(app).post('/api/v1/tickets')
      .set('Authorization', `Bearer ${consumerToken}`).send(payload).expect(201);
    const second = await request(app).post('/api/v1/tickets')
      .set('Authorization', `Bearer ${consumerToken}`).send(payload).expect(201);
    const firstTicket = (first.body as { data: { ticket: { id: number; ticketNumber: string } } }).data.ticket;
    const secondTicket = (second.body as { data: { ticket: { id: number } } }).data.ticket;
    expect(secondTicket.id).toBe(firstTicket.id);
    expect(firstTicket.ticketNumber).toMatch(/^MEPCO-\d{4}-\d{6}$/u);

    const list = await request(app).get('/api/v1/tickets?search=Fictional requester acceptance')
      .set('Authorization', `Bearer ${consumerToken}`).expect(200);
    expect(list.body).toMatchObject({ meta: { totalItems: 1 } });
    const detail = await request(app).get(`/api/v1/tickets/${firstTicket.id}`)
      .set('Authorization', `Bearer ${consumerToken}`).expect(200);
    expect(detail.body).toMatchObject({ data: { ticket: { id: firstTicket.id, domain: 'consumer' } } });
  });

  it('rejects a category from the other requester domain', async () => {
    const employeeToken = await login('employee', 'EMP-DEMO-001');
    const data = await catalog(employeeToken);
    const category = data.categories.find((item) => item.domain === 'consumer');
    const type = category?.complaintTypes[0];
    const priority = data.priorities[0];
    if (category === undefined || type === undefined || priority === undefined) throw new Error('Catalog missing');
    await request(app).post('/api/v1/tickets')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ subject: 'Invalid cross-domain request', description: 'This must be rejected by the API.',
        categoryId: category.id, complaintTypeId: type.id, departmentId: 1, priorityId: priority.id })
      .expect(422);
  });

  it('prevents one requester from opening another requester’s ticket', async () => {
    const employeeToken = await login('employee', 'EMP-DEMO-001');
    const employeeList = await request(app).get('/api/v1/tickets?pageSize=1')
      .set('Authorization', `Bearer ${employeeToken}`).expect(200);
    const ticketId = (employeeList.body as { data: Array<{ id: number }> }).data[0]?.id;
    if (ticketId === undefined) throw new Error('Seed employee ticket missing');
    const consumerToken = await login('consumer', '10000000000001');
    await request(app).get(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${consumerToken}`).expect(404);
  });

  it('applies only allow-listed ticket sorting fields and directions', async () => {
    const consumerToken = await login('consumer', '10000000000001');
    const response = await request(app).get('/api/v1/tickets?pageSize=100&sortBy=ticketNumber&sortOrder=asc')
      .set('Authorization', `Bearer ${consumerToken}`).expect(200);
    const numbers = (response.body as { data: Array<{ ticketNumber: string }> }).data.map((item) => item.ticketNumber);
    expect(numbers).toEqual([...numbers].sort((left, right) => left.localeCompare(right)));
    await request(app).get('/api/v1/tickets?sortBy=unsafe_sql')
      .set('Authorization', `Bearer ${consumerToken}`).expect(422);
  });
});
