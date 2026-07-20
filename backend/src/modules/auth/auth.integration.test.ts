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
  it.each([
    ['consumer', '10000000000001'],
    ['employee', 'EMP-DEMO-001'],
    ['staff', 'tech.it'],
    ['staff', 'supervisor.demo'],
    ['staff', 'admin.demo'],
  ] as const)('authenticates the seeded %s identity %s', async (mode, identifier) => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ mode, identifier, password: 'Demo@12345' })
      .expect(200);

    expect(accessToken(response)).toBeTypeOf('string');
    expect(responseCookie(response)).toContain('mepco_refresh=');
    const setCookie = response.headers['set-cookie']?.[0];
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/api/v1/auth');
    expect(setCookie).not.toContain('Secure');
  });

  it('rejects a suspended account', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ mode: 'consumer', identifier: '10000000000099', password: 'Demo@12345' })
      .expect(403);

    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'ACCOUNT_SUSPENDED' },
    });
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

  it('protects authenticated endpoints with a short-lived access token', async () => {
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ mode: 'employee', identifier: 'EMP-DEMO-001', password: 'Demo@12345' })
      .expect(200);
    const token = accessToken(loginResponse);

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.body).toMatchObject({ data: { user: { role: 'employee' } } });
    await request(app).get('/api/v1/auth/me').expect(401);
  });

  it('registers consumer and employee identities using active master data', async () => {
    const optionsResponse = await request(app).get('/api/v1/auth/registration-options').expect(200);
    const options = optionsResponse.body as {
      data?: {
        circles?: Array<{ id: number; cities: Array<{ id: number }> }>;
        departments?: Array<{ id: number }>;
      };
    };
    const circle = options.data?.circles?.[0];
    const city = circle?.cities[0];
    const department = options.data?.departments?.[0];
    if (circle === undefined || city === undefined || department === undefined) {
      throw new Error('Registration options were not seeded');
    }

    const suffix = String(Date.now()).slice(-8);
    await request(app)
      .post('/api/v1/auth/register/consumer')
      .send({
        referenceNumber: `200000${suffix}`,
        name: 'Fictional New Consumer',
        phone: '0300-1234567',
        password: 'NewDemo@123',
        address: 'Fictional Registration Address',
        circleId: circle.id,
        cityId: city.id,
      })
      .expect(201);

    await request(app)
      .post('/api/v1/auth/register/employee')
      .send({
        employeeId: `EMP-${suffix}`,
        name: 'Fictional New Employee',
        email: `employee-${suffix}@example.test`,
        phone: '0300-7654321',
        password: 'NewDemo@123',
        departmentId: department.id,
        designation: 'Demo Officer',
        workLocation: 'Fictional Office',
      })
      .expect(201);
  });
});
