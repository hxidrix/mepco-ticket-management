import request from 'supertest';
import { app } from '../../app.js';
import { loginEmployee, loginStaff } from '../../test/integration-auth.js';

describe('role-scoped reporting API', () => {
  it('returns internally consistent metrics limited to the actor ticket scope', async () => {
    const employee = await loginEmployee();
    const metrics = await request(app).get('/api/v1/tickets/reports/metrics')
      .set('Authorization', `Bearer ${employee}`).expect(200);
    const data = (metrics.body as { data: { summary: { total: number }; byStatus: Array<{ count: number }>; recent: unknown[] } }).data;
    expect(data.byStatus.reduce((sum, item) => sum + Number(item.count), 0)).toBe(Number(data.summary.total));
    expect(data.recent.length).toBeLessThanOrEqual(5);
    const ownTickets = await request(app).get('/api/v1/tickets?pageSize=100')
      .set('Authorization', `Bearer ${employee}`).expect(200);
    expect(Number(data.summary.total)).toBe((ownTickets.body as { meta: { totalItems: number } }).meta.totalItems);
  });

  it('exports a UTF-8 CSV for managers and denies requester exports', async () => {
    const supervisor = await loginStaff('supervisor.demo');
    const csv = await request(app).get('/api/v1/tickets/reports/export.csv?domain=consumer')
      .set('Authorization', `Bearer ${supervisor}`).expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(String(csv.text)).toContain('Ticket number,Domain,Subject');
    const employee = await loginEmployee();
    await request(app).get('/api/v1/tickets/reports/export.csv')
      .set('Authorization', `Bearer ${employee}`).expect(403);
  });

  it('exports a valid scoped PDF for managers and denies requester exports', async () => {
    const supervisor = await loginStaff('supervisor.demo');
    const pdf = await request(app).get('/api/v1/tickets/reports/export.pdf?domain=consumer')
      .set('Authorization', `Bearer ${supervisor}`).expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.headers['content-disposition']).toContain('.pdf');
    expect(Buffer.isBuffer(pdf.body)).toBe(true);
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    const employee = await loginEmployee();
    await request(app).get('/api/v1/tickets/reports/export.pdf')
      .set('Authorization', `Bearer ${employee}`).expect(403);
  });
});
