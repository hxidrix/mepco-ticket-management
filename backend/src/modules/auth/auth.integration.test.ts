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
    ['employee', '00000001'],
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

  it('authenticates a suspended account into a restricted session', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ mode: 'consumer', identifier: '10000000000099', password: 'Demo@12345' })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: { user: { role: 'consumer', status: 'suspended' } },
    });
    expect(accessToken(response)).toBeTypeOf('string');
    expect(responseCookie(response)).toContain('mepco_refresh=');
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
      .send({ mode: 'employee', identifier: '1', password: 'Demo@12345' })
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
        circles?: Array<{ id: number; divisions: Array<{ id: number; subdivisions: Array<{ id: number }> }> }>;
        departments?: Array<{ id: number }>;
      };
    };
    const circle = options.data?.circles?.[0];
    const division = circle?.divisions[0];
    const subdivision = division?.subdivisions[0];
    const department = options.data?.departments?.[0];
    if (circle === undefined || division === undefined || subdivision === undefined || department === undefined) {
      throw new Error('Registration options were not seeded');
    }

    const suffix = String(Date.now()).slice(-8);
    await request(app)
      .post('/api/v1/auth/register/consumer')
      .send({
        referenceNumber: `200000${suffix}`,
        name: 'Fictional New Consumer',
        phone: '03001234567',
        cnic: '3520290000001',
        password: 'NewDemo@123',
        address: 'Fictional Registration Address',
        circleId: circle.id,
        divisionId: division.id,
        subdivisionId: subdivision.id,
      })
      .expect(201);

    await request(app)
      .post('/api/v1/auth/register/employee')
      .send({
        employeeId: suffix,
        name: 'Fictional New Employee',
        email: `employee-${suffix}@example.test`,
        phone: '03007654321',
        cnic: '3520290000002',
        password: 'NewDemo@123',
        departmentId: department.id,
        designation: 'Demo Officer',
        circleId: circle.id,
        divisionId: division.id,
        subdivisionId: subdivision.id,
      })
      .expect(201);

    const employeeLogin = await request(app).post('/api/v1/auth/login').send({
      mode: 'employee',
      identifier: suffix,
      password: 'NewDemo@123',
    }).expect(200);
    const employeeProfile = await request(app).get('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${accessToken(employeeLogin)}`).expect(200);
    expect(employeeProfile.body).toMatchObject({
      data: {
        profile: {
          role: 'employee',
          circleId: circle.id,
          divisionId: division.id,
          subdivisionId: subdivision.id,
        },
      },
    });
  });

  it('rejects malformed reference numbers and employee IDs', async () => {
    const optionsResponse = await request(app).get('/api/v1/auth/registration-options').expect(200);
    const options = optionsResponse.body as {
      data?: {
        circles?: Array<{ id: number; divisions: Array<{ id: number; subdivisions: Array<{ id: number }> }> }>;
        departments?: Array<{ id: number }>;
      };
    };
    const circle = options.data?.circles?.[0];
    const division = circle?.divisions[0];
    const subdivision = division?.subdivisions[0];
    const department = options.data?.departments?.[0];
    if (circle === undefined || division === undefined || subdivision === undefined || department === undefined) {
      throw new Error('Registration options were not seeded');
    }

    await request(app)
      .post('/api/v1/auth/register/consumer')
      .send({
        referenceNumber: '1234567890123',
        name: 'Invalid Reference Consumer',
        phone: '03001234567',
        cnic: '3520290000003',
        password: 'NewDemo@123',
        address: 'Fictional Registration Address',
        circleId: circle.id,
        divisionId: division.id,
        subdivisionId: subdivision.id,
      })
      .expect(422);

    await request(app)
      .post('/api/v1/auth/register/employee')
      .send({
        employeeId: 'EMP-123',
        name: 'Invalid Employee',
        email: 'invalid-employee@example.test',
        phone: '03007654321',
        cnic: '3520290000004',
        password: 'NewDemo@123',
        departmentId: department.id,
        designation: 'Demo Officer',
        circleId: circle.id,
        divisionId: division.id,
        subdivisionId: subdivision.id,
      })
      .expect(422);
  });

  it('rejects phone numbers that are not 11 digits beginning with 03', async () => {
    const optionsResponse = await request(app).get('/api/v1/auth/registration-options').expect(200);
    const options = optionsResponse.body as {
      data?: {
        circles?: Array<{ id: number; divisions: Array<{ id: number; subdivisions: Array<{ id: number }> }> }>;
      };
    };
    const circle = options.data?.circles?.[0];
    const division = circle?.divisions[0];
    const subdivision = division?.subdivisions[0];
    if (circle === undefined || division === undefined || subdivision === undefined) {
      throw new Error('Registration options were not seeded');
    }

    await request(app)
      .post('/api/v1/auth/register/consumer')
      .send({
        referenceNumber: '90000000000001',
        name: 'Invalid Phone Consumer',
        phone: '0300-1234567',
        cnic: '3520290000005',
        password: 'NewDemo@123',
        address: 'Fictional Registration Address',
        circleId: circle.id,
        divisionId: division.id,
        subdivisionId: subdivision.id,
      })
      .expect(422);
  });

  it('rejects malformed and duplicate CNIC values', async () => {
    const optionsResponse = await request(app).get('/api/v1/auth/registration-options').expect(200);
    const options = optionsResponse.body as {
      data?: {
        circles?: Array<{ id: number; divisions: Array<{ id: number; subdivisions: Array<{ id: number }> }> }>;
      };
    };
    const circle = options.data?.circles?.[0];
    const division = circle?.divisions[0];
    const subdivision = division?.subdivisions[0];
    if (circle === undefined || division === undefined || subdivision === undefined) {
      throw new Error('Registration options were not seeded');
    }
    const baseInput = {
      name: 'CNIC Validation Consumer',
      phone: '03001234567',
      password: 'NewDemo@123',
      address: 'Fictional Registration Address',
      circleId: circle.id,
      divisionId: division.id,
      subdivisionId: subdivision.id,
    };

    await request(app)
      .post('/api/v1/auth/register/consumer')
      .send({ ...baseInput, referenceNumber: '90000000000002', cnic: '352021234567' })
      .expect(422);

    await request(app)
      .post('/api/v1/auth/register/consumer')
      .send({ ...baseInput, referenceNumber: '90000000000003', cnic: '3520200000001' })
      .expect(409);
  });
});
