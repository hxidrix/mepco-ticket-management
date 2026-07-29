import request from 'supertest';
import { app } from '../../app.js';
import { integrationAccessToken, loginEmployee, loginStaff } from '../../test/integration-auth.js';

describe('user profile and account administration API', () => {
  it('allows a requester to read and update only their own profile', async () => {
    const accessToken = await loginEmployee();
    const before = await request(app)
      .get('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const profile = (before.body as { data: { profile: {
      circleId: number; divisionId: number; subdivisionId: number;
      displayName: string; cnic: string; email: string; phone: string;
      departmentId: number; designation: string;
    } } }).data.profile;

    const response = await request(app)
      .put('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        displayName: profile.displayName,
        email: 'employee.profile@example.test',
        phone: '03002222222',
        cnic: profile.cnic,
        departmentId: profile.departmentId,
        designation: profile.designation,
        circleId: profile.circleId,
        divisionId: profile.divisionId,
        subdivisionId: profile.subdivisionId,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      data: { profile: { role: 'employee', email: 'employee.profile@example.test' } },
    });
    await request(app)
      .get('/api/v1/users/admin')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
    await request(app)
      .post('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'unused', newPassword: 'NotAllowed@123' })
      .expect(403);

    const adminToken = await loginStaff('admin.demo');
    const employeeId = (before.body as { data: { profile: { id: number } } }).data.profile.id;
    await request(app)
      .post(`/api/v1/users/admin/${employeeId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'NotAllowed@123' })
      .expect(422);
  });

  it('supports the administrator account lifecycle with audit-safe soft deletion', async () => {
    const adminToken = await loginStaff('admin.demo');
    const catalogResponse = await request(app).get('/api/v1/master-data/catalog').expect(200);
    const optionData = (catalogResponse.body as { data: {
      departments: Array<{ id: number }>;
      circles: Array<{ id: number; divisions: Array<{ id: number; subdivisions: Array<{ id: number }> }> }>;
    } }).data;
    const departmentId = optionData.departments[0]?.id;
    const circle = optionData.circles[0];
    const division = circle?.divisions[0];
    const subdivision = division?.subdivisions[0];
    if (departmentId === undefined || circle === undefined || division === undefined || subdivision === undefined) {
      throw new Error('Expected seeded department and location options');
    }

    const created = await request(app)
      .post('/api/v1/users/admin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        role: 'technician', username: 'tech.milestone4', displayName: 'Milestone Four Technician',
        email: 'm4-tech@example.test', phone: '03004444444', password: 'Demo@12345',
        cnic: '3520290000010',
        departmentId, designation: 'Acceptance Technician',
        circleId: circle.id, divisionId: division.id, subdivisionId: subdivision.id,
      })
      .expect(201);
    const profile = (created.body as { data: { profile: { id: number } } }).data.profile;
    expect(created.body).toMatchObject({
      data: {
        profile: {
          circleId: circle.id,
          divisionId: division.id,
          subdivisionId: subdivision.id,
        },
      },
    });

    const list = await request(app)
      .get('/api/v1/users/admin?search=tech.milestone4')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(list.body).toMatchObject({ meta: { totalItems: 1 } });

    await request(app)
      .put(`/api/v1/users/admin/${profile.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        displayName: 'Milestone Four Technician', email: 'm4-tech@example.test', phone: '03004444444',
        cnic: '3520290000010',
        status: 'suspended', statusReason: 'Fictional acceptance check', role: 'technician',
        departmentId, designation: 'Acceptance Technician',
        circleId: circle.id, divisionId: division.id, subdivisionId: subdivision.id,
      })
      .expect(200);
    const suspendedLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ mode: 'staff', identifier: 'tech.milestone4', password: 'Demo@12345' })
      .expect(200);
    const suspendedToken = integrationAccessToken(suspendedLogin);
    expect(suspendedLogin.body).toMatchObject({
      data: { user: { status: 'suspended', role: 'technician' } },
    });
    await request(app)
      .get('/api/v1/suspensions/me')
      .set('Authorization', `Bearer ${suspendedToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ data: { account: { statusReason: 'Fictional acceptance check' } } });
      });
    await request(app)
      .get('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${suspendedToken}`)
      .expect(403);

    await request(app)
      .post(`/api/v1/users/admin/${profile.id}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'ResetDemo@456' })
      .expect(200);

    await request(app)
      .delete(`/api/v1/users/admin/${profile.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const afterDelete = await request(app)
      .get('/api/v1/users/admin?search=tech.milestone4')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(afterDelete.body).toMatchObject({ data: [], meta: { totalItems: 0 } });
  });

  it('prevents an administrator from deactivating or deleting their own account', async () => {
    const adminToken = await loginStaff('admin.demo');
    const me = await request(app)
      .get('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const profile = (me.body as { data: { profile: {
      id: number; displayName: string; email: string; phone: string; cnic: string;
      departmentId: number; designation: string;
      circleId: number; divisionId: number; subdivisionId: number;
    } } }).data.profile;

    await request(app)
      .put(`/api/v1/users/admin/${profile.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...profile, status: 'inactive', role: 'administrator' })
      .expect(409);
    await request(app)
      .delete(`/api/v1/users/admin/${profile.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
  });
});
