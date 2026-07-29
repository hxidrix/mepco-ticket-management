import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';

import { app } from '../app.js';

export function integrationAccessToken(response: SupertestResponse): string {
  const body = response.body as { data?: { accessToken?: unknown } };
  if (typeof body.data?.accessToken !== 'string') throw new Error('Expected access token');
  return body.data.accessToken;
}

export async function loginStaff(identifier: string): Promise<string> {
  const response = await request(app).post('/api/v1/auth/login')
    .send({ mode: 'staff', identifier, password: 'Demo@12345' }).expect(200);
  return integrationAccessToken(response);
}

export async function loginEmployee(
  employeeId = '00000001',
  cnicLastFour = '0003',
): Promise<string> {
  const response = await request(app).post('/api/v1/auth/employee/continue')
    .send({ employeeId, cnicLastFour }).expect(200);
  return integrationAccessToken(response);
}

export async function provisionEmployee(label: string): Promise<{
  id: number;
  employeeId: string;
  cnicLastFour: string;
  accessToken: string;
}> {
  const administrator = await loginStaff('admin.demo');
  const catalogResponse = await request(app).get('/api/v1/master-data/catalog').expect(200);
  const data = (catalogResponse.body as { data: {
    departments: Array<{ id: number }>;
    circles: Array<{
      id: number;
      divisions: Array<{ id: number; subdivisions: Array<{ id: number }> }>;
    }>;
  } }).data;
  const departmentId = data.departments[0]?.id;
  const circle = data.circles[0];
  const division = circle?.divisions[0];
  const subdivision = division?.subdivisions[0];
  if (departmentId === undefined || circle === undefined || division === undefined || subdivision === undefined) {
    throw new Error('Employee provisioning catalog is incomplete');
  }
  const entropy = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
  const employeeId = entropy.slice(-8).padStart(8, '0');
  const cnic = `7${entropy.slice(-12).padStart(12, '0')}`;
  const created = await request(app).post('/api/v1/users/admin/employees')
    .set('Authorization', `Bearer ${administrator}`)
    .send({
      employeeId,
      displayName: `${label} Employee`,
      email: `${label.toLowerCase().replace(/[^a-z0-9]+/gu, '.')}.${employeeId}@example.test`,
      phone: '03005550101',
      cnic,
      departmentId,
      designation: 'Acceptance Employee',
      circleId: circle.id,
      divisionId: division.id,
      subdivisionId: subdivision.id,
    }).expect(201);
  const id = (created.body as { data: { profile: { id: number } } }).data.profile.id;
  return {
    id,
    employeeId,
    cnicLastFour: cnic.slice(-4),
    accessToken: await loginEmployee(employeeId, cnic.slice(-4)),
  };
}
