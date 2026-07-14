import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';

import { app } from '../../app.js';

function token(response: SupertestResponse): string {
  const value = (response.body as { data?: { accessToken?: unknown } }).data?.accessToken;
  if (typeof value !== 'string') throw new Error('Expected access token');
  return value;
}
async function login(mode: 'consumer' | 'staff', identifier: string): Promise<string> {
  return token(await request(app).post('/api/v1/auth/login').send({ mode, identifier, password: 'Demo@12345' }).expect(200));
}

describe('role-scoped reporting API', () => {
  it('returns internally consistent metrics limited to the actor ticket scope', async () => {
    const consumer = await login('consumer', '10000000000001');
    const metrics = await request(app).get('/api/v1/tickets/reports/metrics')
      .set('Authorization', `Bearer ${consumer}`).expect(200);
    const data = (metrics.body as { data: { summary: { total: number }; byStatus: Array<{ count: number }>; recent: unknown[] } }).data;
    expect(data.byStatus.reduce((sum, item) => sum + Number(item.count), 0)).toBe(Number(data.summary.total));
    expect(data.recent.length).toBeLessThanOrEqual(5);
    const ownTickets = await request(app).get('/api/v1/tickets?pageSize=100')
      .set('Authorization', `Bearer ${consumer}`).expect(200);
    expect(Number(data.summary.total)).toBe((ownTickets.body as { meta: { totalItems: number } }).meta.totalItems);
  });

  it('exports a UTF-8 CSV for managers and denies requester exports', async () => {
    const supervisor = await login('staff', 'supervisor.demo');
    const csv = await request(app).get('/api/v1/tickets/reports/export.csv?domain=consumer')
      .set('Authorization', `Bearer ${supervisor}`).expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(String(csv.text)).toContain('Ticket number,Domain,Subject');
    const consumer = await login('consumer', '10000000000001');
    await request(app).get('/api/v1/tickets/reports/export.csv')
      .set('Authorization', `Bearer ${consumer}`).expect(403);
  });
});
