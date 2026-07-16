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
async function firstConsumerTicket(accessToken: string): Promise<number> {
  const response = await request(app).get('/api/v1/tickets?pageSize=100')
    .set('Authorization', `Bearer ${accessToken}`).expect(200);
  const id = (response.body as { data: Array<{ id: number; statusSlug: string }> }).data
    .find((ticket) => !['closed', 'cancelled'].includes(ticket.statusSlug))?.id;
  if (id === undefined) throw new Error('Seed consumer ticket missing');
  return id;
}

describe('ticket collaboration and notifications API', () => {
  it('keeps internal notes staff-only and delivers public comment notifications', async () => {
    const consumer = await login('consumer', '10000000000001');
    const administrator = await login('staff', 'admin.demo');
    const ticketId = await firstConsumerTicket(consumer);
    await request(app).post(`/api/v1/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${administrator}`)
      .send({ body: 'Fictional internal investigation note.', visibility: 'internal' }).expect(201);
    await request(app).post(`/api/v1/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${administrator}`)
      .send({ body: 'Fictional public progress update.', visibility: 'public' }).expect(201);
    await request(app).post(`/api/v1/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${consumer}`)
      .send({ body: 'Requester must not create an internal note.', visibility: 'internal' }).expect(403);

    const staffDetail = await request(app).get(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${administrator}`).expect(200);
    const requesterDetail = await request(app).get(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${consumer}`).expect(200);
    const staffComments = (staffDetail.body as { data: { comments: Array<{ visibility: string }> } }).data.comments;
    const requesterComments = (requesterDetail.body as { data: { comments: Array<{ visibility: string }> } }).data.comments;
    expect(staffComments.some((item) => item.visibility === 'internal')).toBe(true);
    expect(requesterComments.every((item) => item.visibility === 'public')).toBe(true);

    const notifications = await request(app).get('/api/v1/notifications')
      .set('Authorization', `Bearer ${consumer}`).expect(200);
    const notification = (notifications.body as { data: { items: Array<{ id: number; type: string }> } }).data.items
      .find((item) => item.type === 'ticket_comment');
    if (notification === undefined) throw new Error('Comment notification missing');
    await request(app).post(`/api/v1/notifications/${notification.id}/read`)
      .set('Authorization', `Bearer ${administrator}`).expect(404);
    await request(app).post(`/api/v1/notifications/${notification.id}/read`)
      .set('Authorization', `Bearer ${consumer}`).expect(200);
    await request(app).post('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${consumer}`).expect(200);
    const after = await request(app).get('/api/v1/notifications?unreadOnly=true')
      .set('Authorization', `Bearer ${consumer}`).expect(200);
    expect(after.body).toMatchObject({ data: { unreadCount: 0 }, meta: { totalItems: 0 } });
  });

  it('validates, stores, lists and securely downloads evidence attachments', async () => {
    const consumer = await login('consumer', '10000000000001');
    const ticketId = await firstConsumerTicket(consumer);
    const upload = await request(app).post(`/api/v1/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${consumer}`)
      .attach('file', Buffer.from('Fictional MEPCO evidence file.'), { filename: 'evidence.txt', contentType: 'text/plain' })
      .expect(201);
    const attachmentId = (upload.body as { data: { attachmentId: number } }).data.attachmentId;
    const detail = await request(app).get(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${consumer}`).expect(200);
    expect((detail.body as { data: { attachments: Array<{ id: number }> } }).data.attachments)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: attachmentId })]));
    const download = await request(app).get(`/api/v1/tickets/attachments/${attachmentId}/download`)
      .set('Authorization', `Bearer ${consumer}`).expect(200);
    expect(download.headers['content-disposition']).toContain('evidence.txt');
    const employee = await login('employee', 'EMP-DEMO-001');
    await request(app).get(`/api/v1/tickets/attachments/${attachmentId}/download`)
      .set('Authorization', `Bearer ${employee}`).expect(404);
    await request(app).post(`/api/v1/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${consumer}`)
      .attach('file', Buffer.from('not executable'), { filename: 'unsafe.exe', contentType: 'application/octet-stream' })
      .expect(415);
  });
});
