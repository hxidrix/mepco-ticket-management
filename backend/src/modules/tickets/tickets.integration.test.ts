import request from 'supertest';

import { app } from '../../app.js';
import { loginEmployee, loginStaff } from '../../test/integration-auth.js';

interface CatalogShape {
  categories: Array<{
    id: number;
    domain: string;
    departmentId: number | null;
    complaintTypes: Array<{ id: number }>;
  }>;
  priorities: Array<{ id: number; slug: string }>;
}

async function catalog(): Promise<CatalogShape> {
  const response = await request(app).get('/api/v1/master-data/catalog').expect(200);
  return (response.body as { data: CatalogShape }).data;
}

describe('authenticated employee ticket API', () => {
  it('creates one employee ticket for an idempotent submission and keeps it private', async () => {
    const employee = await loginEmployee();
    const data = await catalog();
    const category = data.categories.find((item) => item.domain === 'employee');
    const complaintType = category?.complaintTypes[0];
    const priority = data.priorities.find((item) => item.slug === 'medium');
    if (category === undefined || complaintType === undefined || category.departmentId === null || priority === undefined) {
      throw new Error('Employee catalog is incomplete');
    }
    const payload = {
      subject: 'Fictional employee workstation issue',
      description: 'A fictional employee ticket created by the integration acceptance suite.',
      categoryId: category.id,
      complaintTypeId: complaintType.id,
      departmentId: category.departmentId,
      priorityId: priority.id,
      idempotencyKey: `employee-ticket-${Date.now()}`,
    };
    const first = await request(app).post('/api/v1/tickets')
      .set('Authorization', `Bearer ${employee}`).send(payload).expect(201);
    const second = await request(app).post('/api/v1/tickets')
      .set('Authorization', `Bearer ${employee}`).send(payload).expect(201);
    const firstTicket = (first.body as { data: { ticket: { id: number; ticketNumber: string } } }).data.ticket;
    const secondTicket = (second.body as { data: { ticket: { id: number } } }).data.ticket;
    expect(secondTicket.id).toBe(firstTicket.id);
    expect(firstTicket.ticketNumber).toMatch(/^\d{10}$/u);

    const detail = await request(app).get(`/api/v1/tickets/${firstTicket.id}`)
      .set('Authorization', `Bearer ${employee}`).expect(200);
    expect(detail.body).toMatchObject({ data: { ticket: {
      id: firstTicket.id,
      domain: 'employee',
      requesterName: 'Hamza Demo Employee',
    } } });
  });

  it('rejects a consumer category on the employee-only authenticated endpoint', async () => {
    const employee = await loginEmployee();
    const data = await catalog();
    const category = data.categories.find((item) => item.domain === 'consumer');
    const complaintType = category?.complaintTypes[0];
    if (category === undefined || complaintType === undefined) throw new Error('Consumer catalog missing');
    await request(app).post('/api/v1/tickets')
      .set('Authorization', `Bearer ${employee}`)
      .send({
        subject: 'Invalid cross-domain request',
        description: 'The employee endpoint must reject consumer complaint classifications.',
        categoryId: category.id,
        complaintTypeId: complaintType.id,
        departmentId: 1,
      })
      .expect(422);
  });

  it('keeps dashboard open and overdue views consistent with ticket metrics', async () => {
    const administrator = await loginStaff('admin.demo');
    const metrics = await request(app).get('/api/v1/tickets/reports/metrics')
      .set('Authorization', `Bearer ${administrator}`).expect(200);
    const summary = (metrics.body as {
      data: { summary: { open: number | string; overdue: number | string } };
    }).data.summary;

    const open = await request(app).get('/api/v1/tickets?view=open&pageSize=100')
      .set('Authorization', `Bearer ${administrator}`).expect(200);
    expect(open.body).toMatchObject({ meta: { totalItems: Number(summary.open) } });
    const overdue = await request(app).get('/api/v1/tickets?view=overdue&pageSize=100')
      .set('Authorization', `Bearer ${administrator}`).expect(200);
    expect(overdue.body).toMatchObject({ meta: { totalItems: Number(summary.overdue) } });
    await request(app).get('/api/v1/tickets?view=unsupported')
      .set('Authorization', `Bearer ${administrator}`).expect(422);
  });

  it('applies only allow-listed ticket sorting fields and directions', async () => {
    const employee = await loginEmployee();
    const response = await request(app).get('/api/v1/tickets?pageSize=100&sortBy=ticketNumber&sortOrder=asc')
      .set('Authorization', `Bearer ${employee}`).expect(200);
    const numbers = (response.body as { data: Array<{ ticketNumber: string }> }).data
      .map((item) => item.ticketNumber);
    expect(numbers).toEqual([...numbers].sort((left, right) => left.localeCompare(right)));
    await request(app).get('/api/v1/tickets?sortBy=unsafe_sql')
      .set('Authorization', `Bearer ${employee}`).expect(422);
  });

  it('allows only an administrator to soft-delete a ticket', async () => {
    const employee = await loginEmployee();
    const cancelled = await request(app).get('/api/v1/tickets?status=cancelled&pageSize=1')
      .set('Authorization', `Bearer ${employee}`).expect(200);
    const item = (cancelled.body as { data: Array<{ id: number; version: number }> }).data[0];
    if (item === undefined) throw new Error('Seed cancelled employee ticket missing');
    await request(app).delete(`/api/v1/tickets/${item.id}`)
      .set('Authorization', `Bearer ${employee}`)
      .send({ reason: 'Employee must not delete tickets', version: item.version }).expect(403);

    const administrator = await loginStaff('admin.demo');
    const detail = await request(app).get(`/api/v1/tickets/${item.id}`)
      .set('Authorization', `Bearer ${administrator}`).expect(200);
    const version = (detail.body as { data: { ticket: { version: number } } }).data.ticket.version;
    await request(app).delete(`/api/v1/tickets/${item.id}`)
      .set('Authorization', `Bearer ${administrator}`)
      .send({ reason: 'Fictional administrative cleanup', version }).expect(200);
    await request(app).get(`/api/v1/tickets/${item.id}`)
      .set('Authorization', `Bearer ${administrator}`).expect(404);
  });
});
