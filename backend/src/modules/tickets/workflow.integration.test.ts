import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';

import { app } from '../../app.js';

function token(response: SupertestResponse): string {
  const body = response.body as { data?: { accessToken?: unknown } };
  if (typeof body.data?.accessToken !== 'string') throw new Error('Expected access token');
  return body.data.accessToken;
}
async function login(mode: 'consumer' | 'staff', identifier: string): Promise<string> {
  return token(await request(app).post('/api/v1/auth/login')
    .send({ mode, identifier, password: 'Demo@12345' }).expect(200));
}
async function detail(accessToken: string, id: number) {
  const response = await request(app).get(`/api/v1/tickets/${id}`)
    .set('Authorization', `Bearer ${accessToken}`).expect(200);
  return (response.body as { data: { ticket: { version: number; statusSlug: string; priorityId: number } } }).data.ticket;
}

describe('ticket assignment and workflow API', () => {
  it('enforces scoped assignment, optimistic versions, technician transitions and requester confirmation/reopen', async () => {
    const supervisor = await login('staff', 'supervisor.demo');
    const queue = await request(app).get('/api/v1/tickets?status=new')
      .set('Authorization', `Bearer ${supervisor}`).expect(200);
    const ticketId = (queue.body as { data: Array<{ id: number }> }).data[0]?.id;
    if (ticketId === undefined) throw new Error('Seed new ticket is missing');
    let ticket = await detail(supervisor, ticketId);

    const catalog = await request(app).get('/api/v1/master-data/catalog')
      .set('Authorization', `Bearer ${supervisor}`).expect(200);
    const lowPriority = (catalog.body as { data: { priorities: Array<{ id: number; slug: string }> } })
      .data.priorities.find((priority) => priority.slug === 'low');
    if (lowPriority === undefined) throw new Error('Low priority is missing');
    await request(app).post(`/api/v1/tickets/${ticketId}/priority`)
      .set('Authorization', `Bearer ${supervisor}`)
      .send({ priorityId: lowPriority.id, reason: 'Fictional acceptance reprioritization', version: ticket.version })
      .expect(200);
    ticket = await detail(supervisor, ticketId);
    expect(ticket.priorityId).toBe(lowPriority.id);

    const options = await request(app).get(`/api/v1/tickets/workflow/technicians?ticketId=${ticketId}`)
      .set('Authorization', `Bearer ${supervisor}`).expect(200);
    const technician = (options.body as { data: Array<{ id: number; displayName: string }> }).data
      .find((item) => item.displayName === 'Bilal Operations Technician');
    if (technician === undefined) throw new Error('Scoped technician missing');
    const assignmentVersion = ticket.version;
    await request(app).post(`/api/v1/tickets/${ticketId}/assign`)
      .set('Authorization', `Bearer ${supervisor}`)
      .send({ technicianId: technician.id, reason: 'Fictional supervisor assignment', version: assignmentVersion })
      .expect(200);
    await request(app).post(`/api/v1/tickets/${ticketId}/assign`)
      .set('Authorization', `Bearer ${supervisor}`)
      .send({ technicianId: technician.id, reason: 'Stale assignment attempt', version: assignmentVersion })
      .expect(409);

    const operationsTechnician = await login('staff', 'tech.ops');
    const otherTechnician = await login('staff', 'tech.it');
    await request(app).get(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${otherTechnician}`).expect(404);
    ticket = await detail(operationsTechnician, ticketId);
    expect(ticket.statusSlug).toBe('assigned');
    await request(app).post(`/api/v1/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${operationsTechnician}`)
      .send({ status: 'in-progress', reason: 'Work started', version: ticket.version }).expect(200);
    ticket = await detail(operationsTechnician, ticketId);
    await request(app).post(`/api/v1/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${operationsTechnician}`)
      .send({ status: 'resolved', reason: 'Work completed', resolutionSummary: 'Fictional safe resolution completed successfully.', version: ticket.version })
      .expect(200);

    const consumer = await login('consumer', '10000000000001');
    ticket = await detail(consumer, ticketId);
    expect(ticket.statusSlug).toBe('resolved');
    await request(app).post(`/api/v1/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${consumer}`)
      .send({ status: 'closed', reason: 'Requester confirmed the resolution', version: ticket.version }).expect(200);
    ticket = await detail(consumer, ticketId);
    await request(app).post(`/api/v1/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${consumer}`)
      .send({ status: 'reopened', reason: 'Fictional issue returned within the configured window', version: ticket.version })
      .expect(200);
    expect((await detail(consumer, ticketId)).statusSlug).toBe('reopened');
  });

  it('requires a resolution summary and rejects requester-controlled staff transitions', async () => {
    const technician = await login('staff', 'tech.it');
    const list = await request(app).get('/api/v1/tickets?status=in-progress')
      .set('Authorization', `Bearer ${technician}`).expect(200);
    const item = (list.body as { data: Array<{ id: number; version: number }> }).data[0];
    if (item !== undefined) {
      await request(app).post(`/api/v1/tickets/${item.id}/status`)
        .set('Authorization', `Bearer ${technician}`)
        .send({ status: 'resolved', reason: 'Missing resolution summary', version: item.version }).expect(422);
    }
    const consumer = await login('consumer', '10000000000001');
    const own = await request(app).get('/api/v1/tickets?status=in-progress')
      .set('Authorization', `Bearer ${consumer}`).expect(200);
    const ownItem = (own.body as { data: Array<{ id: number; version: number }> }).data[0];
    if (ownItem !== undefined) {
      await request(app).post(`/api/v1/tickets/${ownItem.id}/status`)
        .set('Authorization', `Bearer ${consumer}`)
        .send({ status: 'resolved', reason: 'Requester cannot resolve', resolutionSummary: 'Not permitted', version: ownItem.version })
        .expect(409);
    }
  });
});
