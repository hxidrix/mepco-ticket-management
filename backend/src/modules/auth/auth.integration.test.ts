import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';

import { app } from '../../app.js';

function responseCookie(response: SupertestResponse): string {
  const headers = response.headers as Record<string, unknown>;
  const header = headers['set-cookie'];
  const value: unknown = Array.isArray(header) ? (header as unknown[])[0] : header;
  if (typeof value !== 'string') throw new Error('Expected a refresh cookie');
  const cookie = value.split(';')[0];
  if (cookie === undefined) throw new Error('Refresh cookie was empty');
  return cookie;
}

function accessToken(response: SupertestResponse): string {
  const body = response.body as { data?: { accessToken?: unknown } };
  const token = body.data?.accessToken;
  if (typeof token !== 'string') throw new Error('Expected an access token');
  return token;
}

describe('authentication API', () => {
  it.each(['tech.it', 'supervisor.demo', 'admin.demo']) (
    'authenticates seeded staff identity %s with a password',
    async (identifier) => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ mode: 'staff', identifier, password: 'Demo@12345' })
        .expect(200);

      expect(accessToken(response)).toBeTypeOf('string');
      expect(responseCookie(response)).toContain('mepco_refresh=');
      const setCookie = response.headers['set-cookie']?.[0];
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
      expect(setCookie).toContain('Path=/api/v1/auth');
      expect(setCookie).not.toContain('Secure');
    },
  );

  it('verifies a seeded employee using Employee ID and CNIC last four before continuing', async () => {
    const preview = await request(app)
      .post('/api/v1/auth/employee/verify')
      .send({ employeeId: '1', cnicLastFour: '0003' })
      .expect(200);

    expect(preview.body).toMatchObject({
      success: true,
      data: { employee: { employeeId: '****0001' } },
    });
    expect(preview.headers['set-cookie']).toBeUndefined();
    expect(JSON.stringify(preview.body)).not.toContain('3520200000003');

    const response = await request(app)
      .post('/api/v1/auth/employee/continue')
      .send({ employeeId: '00000001', cnicLastFour: '0003' })
      .expect(200);
    expect(response.body).toMatchObject({ data: { user: { role: 'employee' } } });
    expect(accessToken(response)).toBeTypeOf('string');
    expect(responseCookie(response)).toContain('mepco_refresh=');
  });

  it('returns a generic failure for incorrect employee verification details', async () => {
    const response = await request(app)
      .post('/api/v1/auth/employee/verify')
      .send({ employeeId: '00000001', cnicLastFour: '9999' })
      .expect(401);
    expect(response.body).toMatchObject({ error: { code: 'EMPLOYEE_VERIFICATION_FAILED' } });
    expect(JSON.stringify(response.body).toLowerCase()).not.toContain('cnic');
  });

  it('does not expose consumer login or self-registration endpoints', async () => {
    await request(app).post('/api/v1/auth/login')
      .send({ mode: 'consumer', identifier: '10000000000001', password: 'Demo@12345' })
      .expect(422);
    await request(app).post('/api/v1/auth/register/consumer').send({}).expect(404);
    await request(app).post('/api/v1/auth/register/employee').send({}).expect(404);
    await request(app).get('/api/v1/auth/registration-options').expect(404);
  });

  it('rotates refresh tokens and revokes the family when an old token is reused', async () => {
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ mode: 'staff', identifier: 'admin.demo', password: 'Demo@12345' })
      .expect(200);
    const originalCookie = responseCookie(loginResponse);

    const refreshResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', originalCookie)
      .expect(200);
    const rotatedCookie = responseCookie(refreshResponse);
    expect(rotatedCookie).not.toBe(originalCookie);

    const reuseResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', originalCookie)
      .expect(401);
    expect(reuseResponse.body).toMatchObject({
      error: { code: 'REFRESH_TOKEN_REUSE_DETECTED' },
    });
    await request(app).post('/api/v1/auth/refresh').set('Cookie', rotatedCookie).expect(401);
  });

  it('revokes the current refresh session on logout', async () => {
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ mode: 'staff', identifier: 'supervisor.demo', password: 'Demo@12345' })
      .expect(200);
    const cookie = responseCookie(loginResponse);

    await request(app).post('/api/v1/auth/logout').set('Cookie', cookie).expect(200);
    await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('protects authenticated endpoints with the employee access token', async () => {
    const loginResponse = await request(app)
      .post('/api/v1/auth/employee/continue')
      .send({ employeeId: '00000001', cnicLastFour: '0003' })
      .expect(200);
    const token = accessToken(loginResponse);

    const response = await request(app).get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(response.body).toMatchObject({ data: { user: { role: 'employee' } } });
    await request(app).get('/api/v1/auth/me').expect(401);
  });
});
