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
  circles: Array<{ id: number; divisions: Array<{ id: number; subdivisions: Array<{ id: number }> }> }>;
  priorities: Array<{ id: number; slug: string }>;
}

async function catalog(accessToken: string): Promise<CatalogShape> {
  const response = await request(app).get('/api/v1/master-data/catalog')
    .set('Authorization', `Bearer ${accessToken}`).expect(200);
  return (response.body as { data: CatalogShape }).data;
}

describe('requester ticket API', () => {
  it('keeps the long complaint target when automatic priority is low', async () => {
    const consumerToken = await login('consumer', '10000000000001');
    const data = await catalog(consumerToken);
    const category = data.categories.find((item) =>
      item.domain === 'consumer' && item.name === 'Leads / Requests / Others');
    const complaintType = category?.complaintTypes.find((item) => item.name === 'Electrification');
    const circle = data.circles[0];
    const division = circle?.divisions[0];
    const subdivision = division?.subdivisions[0];
    if (category === undefined || complaintType === undefined || circle === undefined || division === undefined || subdivision === undefined) {
      throw new Error('Long-term consumer complaint data is missing');
    }

    const response = await request(app).post('/api/v1/tickets')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({
        subject: 'Fictional long-term electrification request',
        description: 'Acceptance scenario for a planned request with a ninety-day normal target.',
        categoryId: category.id,
        complaintTypeId: complaintType.id,
        circleId: circle.id,
        divisionId: division.id,
        subdivisionId: subdivision.id,
        locationDetails: 'Fictional long-term request location',
      })
      .expect(201);
    const ticketId = (response.body as { data: { ticket: { id: number } } }).data.ticket.id;
    const detail = await request(app).get(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .expect(200);

    expect(detail.body).toMatchObject({ data: { ticket: {
      prioritySlug: 'low',
      complaintSlaTargetHours: 2160,
      slaTargetHours: 2160,
    } } });
  });

  it('creates one consumer ticket for a repeated idempotent submission and returns it privately', async () => {
    const consumerToken = await login('consumer', '10000000000001');
    const data = await catalog(consumerToken);
    const category = data.categories.find((item) => item.domain === 'consumer' && item.name === 'Line Complaints');
    const type = category?.complaintTypes.find((item) => item.name !== 'Other');
    const circle = data.circles[0];
    const division = circle?.divisions[0];
    const subdivision = division?.subdivisions[0];
    const priority = data.priorities.find((item) => item.slug === 'medium');
    if (category === undefined || type === undefined || circle === undefined || division === undefined || subdivision === undefined || priority === undefined) {
      throw new Error('Seed catalog is incomplete');
    }
    const payload = {
      subject: 'Fictional requester acceptance issue',
      description: 'A fictional consumer ticket created by the integration acceptance suite.',
      categoryId: category.id, complaintTypeId: type.id, circleId: circle.id,
      divisionId: division.id, subdivisionId: subdivision.id,
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
    expect(detail.body).toMatchObject({ data: { ticket: {
      id: firstTicket.id,
      domain: 'consumer',
      prioritySlug: 'high',
      complaintSlaTargetHours: 12,
      slaTargetHours: 12,
      isOverdue: 0,
      statusSlug: 'assigned',
      assigneeName: 'Bilal Operations Technician',
    } } });
    const slaDueAt = (detail.body as { data: { ticket: { slaDueAt: unknown } } }).data.ticket.slaDueAt;
    expect(typeof slaDueAt).toBe('string');
    const version = (detail.body as { data: { ticket: { version: number } } }).data.ticket.version;
    await request(app).post(`/api/v1/tickets/${firstTicket.id}/close-review`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({
        issueResolved: false,
        satisfactionRating: 2,
        reviewText: 'The requester chose to close this fictional new ticket.',
        version,
      }).expect(200);
    const closed = await request(app).get(`/api/v1/tickets/${firstTicket.id}`)
      .set('Authorization', `Bearer ${consumerToken}`).expect(200);
    expect(closed.body).toMatchObject({ data: {
      ticket: { statusSlug: 'closed' },
      review: { issueResolved: false, satisfactionRating: 2 },
    } });
    await request(app).post(`/api/v1/tickets/${firstTicket.id}/comments`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ body: 'A closed requester ticket must be read-only.', visibility: 'public' }).expect(409);
    await request(app).post(`/api/v1/tickets/${firstTicket.id}/attachments`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .attach('file', Buffer.from('Must not be stored.'), { filename: 'closed.txt', contentType: 'text/plain' })
      .expect(409);
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

  it('keeps dashboard open and overdue views consistent with ticket metrics', async () => {
    const administratorToken = await login('staff', 'admin.demo');
    const metrics = await request(app).get('/api/v1/tickets/reports/metrics')
      .set('Authorization', `Bearer ${administratorToken}`).expect(200);
    const summary = (metrics.body as { data: { summary: { open: number | string; overdue: number | string } } }).data.summary;

    const open = await request(app).get('/api/v1/tickets?view=open&pageSize=100')
      .set('Authorization', `Bearer ${administratorToken}`).expect(200);
    expect(open.body).toMatchObject({ meta: { totalItems: Number(summary.open) } });
    expect((open.body as { data: Array<{ statusSlug: string }> }).data.every((item) =>
      !['resolved', 'closed', 'cancelled'].includes(item.statusSlug))).toBe(true);

    const overdue = await request(app).get('/api/v1/tickets?view=overdue&pageSize=100')
      .set('Authorization', `Bearer ${administratorToken}`).expect(200);
    expect(overdue.body).toMatchObject({ meta: { totalItems: Number(summary.overdue) } });
    expect((overdue.body as { data: Array<{ isOverdue: number }> }).data.every((item) => item.isOverdue === 1)).toBe(true);

    await request(app).get('/api/v1/tickets?view=unsupported')
      .set('Authorization', `Bearer ${administratorToken}`).expect(422);
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

  it('allows only an administrator to soft-delete a ticket', async () => {
    const employeeToken = await login('employee', 'EMP-DEMO-001');
    const cancelled = await request(app).get('/api/v1/tickets?status=cancelled&pageSize=1')
      .set('Authorization', `Bearer ${employeeToken}`).expect(200);
    const item = (cancelled.body as { data: Array<{ id: number; version: number }> }).data[0];
    if (item === undefined) throw new Error('Seed cancelled ticket missing');
    await request(app).delete(`/api/v1/tickets/${item.id}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ reason: 'Requester must not delete tickets', version: item.version }).expect(403);

    const administratorToken = await login('staff', 'admin.demo');
    const detail = await request(app).get(`/api/v1/tickets/${item.id}`)
      .set('Authorization', `Bearer ${administratorToken}`).expect(200);
    const version = (detail.body as { data: { ticket: { version: number } } }).data.ticket.version;
    await request(app).delete(`/api/v1/tickets/${item.id}`)
      .set('Authorization', `Bearer ${administratorToken}`)
      .send({ reason: 'Fictional administrative cleanup', version }).expect(200);
    await request(app).get(`/api/v1/tickets/${item.id}`)
      .set('Authorization', `Bearer ${administratorToken}`).expect(404);
  });
});
