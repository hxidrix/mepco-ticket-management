import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';

import { app } from '../../app.js';
import {
  integrationAccessToken,
  loginStaff,
  provisionEmployee,
} from '../../test/integration-auth.js';

function refreshCookie(response: SupertestResponse): string {
  const value = response.headers['set-cookie']?.[0]?.split(';')[0];
  if (value === undefined) throw new Error('Expected a refresh cookie');
  return value;
}

describe('suspended employee support portal', () => {
  it('permits only the restricted portal, stores an appeal, and supports supervisor review', async () => {
    const employee = await provisionEmployee('Suspension Portal');
    const supervisorToken = await loginStaff('supervisor.demo');
    await request(app).post(`/api/v1/account-governance/users/${employee.id}/suspend`)
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({
        category: 'other',
        reasonSummary: 'Fictional suspended-account acceptance scenario',
        details: 'This isolated employee account is suspended solely to exercise the restricted appeal and support workflow.',
      }).expect(201);

    const suspendedLogin = await request(app).post('/api/v1/auth/employee/continue')
      .send({ employeeId: employee.employeeId, cnicLastFour: employee.cnicLastFour })
      .expect(200);
    const suspendedToken = integrationAccessToken(suspendedLogin);
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
      .send({
        requestType: 'appeal',
        contactPreference: 'portal',
        message: 'Please review this fictional suspension because the account details are now verified.',
      }).expect(201);
    const requestId = (created.body as { data: { id: number } }).data.id;

    await request(app).post('/api/v1/suspensions/me/requests')
      .set('Authorization', `Bearer ${suspendedToken}`)
      .send({
        requestType: 'appeal',
        contactPreference: 'portal',
        message: 'This duplicate fictional appeal must be prevented while the first remains open.',
      }).expect(409);

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
