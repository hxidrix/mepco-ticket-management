import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';

import { app } from '../../app.js';

function accessToken(response: SupertestResponse): string {
  const token = (response.body as { data?: { accessToken?: unknown } }).data?.accessToken;
  if (typeof token !== 'string') throw new Error('Expected an access token');
  return token;
}

function refreshCookie(response: SupertestResponse): string {
  const value = response.headers['set-cookie']?.[0]?.split(';')[0];
  if (value === undefined) throw new Error('Expected a refresh cookie');
  return value;
}

async function login(mode: 'consumer' | 'staff', identifier: string) {
  return request(app).post('/api/v1/auth/login')
    .send({ mode, identifier, password: 'Demo@12345' }).expect(200);
}

describe('suspended account support portal', () => {
  it('permits only the restricted portal, stores an appeal, and supports supervisor review', async () => {
    const suspendedLogin = await login('consumer', '10000000000099');
    const suspendedToken = accessToken(suspendedLogin);
    const suspendedCookie = refreshCookie(suspendedLogin);

    const portal = await request(app).get('/api/v1/suspensions/me')
      .set('Authorization', `Bearer ${suspendedToken}`).expect(200);
    expect(portal.body).toMatchObject({
      data: {
        account: {
          status: 'suspended',
          statusReason: 'Fictional suspended-account acceptance scenario',
        },
        requests: [],
      },
    });

    const restricted = await request(app).get('/api/v1/tickets')
      .set('Authorization', `Bearer ${suspendedToken}`).expect(403);
    expect(restricted.body).toMatchObject({ error: { code: 'ACCOUNT_SUSPENDED_RESTRICTED' } });

    const created = await request(app).post('/api/v1/suspensions/me/requests')
      .set('Authorization', `Bearer ${suspendedToken}`)
      .send({ requestType: 'appeal', contactPreference: 'portal', message: 'Please review this fictional suspension because the account details are now verified.' })
      .expect(201);
    const requestId = (created.body as { data: { id: number } }).data.id;

    await request(app).post('/api/v1/suspensions/me/requests')
      .set('Authorization', `Bearer ${suspendedToken}`)
      .send({ requestType: 'appeal', contactPreference: 'portal', message: 'This duplicate fictional appeal must be prevented while the first remains open.' })
      .expect(409);

    const supervisorLogin = await login('staff', 'supervisor.demo');
    const supervisorToken = accessToken(supervisorLogin);
    const queue = await request(app).get('/api/v1/suspensions/management/requests?status=submitted')
      .set('Authorization', `Bearer ${supervisorToken}`).expect(200);
    expect((queue.body as { data: Array<{ id: number; status: string }> }).data)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: requestId, status: 'submitted' })]));

    await request(app).put(`/api/v1/suspensions/management/requests/${requestId}`)
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ status: 'approved', response: 'Identity verified. The fictional account has been restored.' })
      .expect(200);

    await request(app).get('/api/v1/suspensions/me')
      .set('Authorization', `Bearer ${suspendedToken}`).expect(403);
    await request(app).get('/api/v1/tickets')
      .set('Authorization', `Bearer ${suspendedToken}`).expect(200);

    const refreshed = await request(app).post('/api/v1/auth/refresh')
      .set('Cookie', suspendedCookie).expect(200);
    expect(refreshed.body).toMatchObject({ data: { user: { status: 'active' } } });
  });
});
