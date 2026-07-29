import request from 'supertest';

import { app } from '../../app.js';
import {
  integrationAccessToken,
  loginEmployee,
  loginStaff,
  provisionEmployee,
} from '../../test/integration-auth.js';

async function createItTicket(employeeToken: string): Promise<number> {
  const catalogResponse = await request(app).get('/api/v1/master-data/catalog').expect(200);
  const catalog = (catalogResponse.body as { data: {
    categories: Array<{
      id: number;
      domain: string;
      name: string;
      departmentId: number | null;
      complaintTypes: Array<{ id: number }>;
    }>;
    priorities: Array<{ id: number; slug: string }>;
  } }).data;
  const category = catalog.categories.find((item) => (
    item.domain === 'employee' && item.name === 'Information Technology (IT) Directorate'
  ));
  const complaintType = category?.complaintTypes[0];
  const priority = catalog.priorities.find((item) => item.slug === 'medium');
  if (category === undefined || complaintType === undefined || category.departmentId === null || priority === undefined) {
    throw new Error('IT employee catalog is incomplete');
  }
  const created = await request(app).post('/api/v1/tickets')
    .set('Authorization', `Bearer ${employeeToken}`)
    .send({
      subject: 'Fictional account governance review ticket',
      description: 'An isolated ticket used to verify the technician suspension request workflow.',
      categoryId: category.id,
      complaintTypeId: complaintType.id,
      departmentId: category.departmentId,
      priorityId: priority.id,
      idempotencyKey: `governance-${Date.now()}`,
    }).expect(201);
  return (created.body as { data: { ticket: { id: number } } }).data.ticket.id;
}

describe('employee account suspension governance API', () => {
  it('sends a technician request to managers and records the reviewed decision', async () => {
    const supervisor = await loginStaff('supervisor.demo');
    const employee = await provisionEmployee('Governance Technician Request');
    const ticketId = await createItTicket(employee.accessToken);
    const technician = await loginStaff('tech.it');

    const input = {
      ticketId,
      category: 'repeated-policy-violation',
      reasonSummary: 'Repeated misuse documented on the assigned support ticket',
      details: 'The fictional acceptance scenario records repeated misuse and links the manager review to the complete ticket conversation.',
    };
    const created = await request(app).post('/api/v1/account-governance/requests')
      .set('Authorization', `Bearer ${technician}`).send(input).expect(201);
    const caseId = (created.body as { data: { id: number } }).data.id;
    await request(app).post('/api/v1/account-governance/requests')
      .set('Authorization', `Bearer ${technician}`).send(input).expect(409);

    const queue = await request(app).get('/api/v1/account-governance/requests?status=pending')
      .set('Authorization', `Bearer ${supervisor}`).expect(200);
    expect(queue.body).toMatchObject({
      data: [expect.objectContaining({ id: caseId, targetUserId: employee.id, status: 'pending' })],
    });

    const decisionNotes = 'The supervisor reviewed the ticket evidence and approved a proportionate account suspension.';
    await request(app).put(`/api/v1/account-governance/requests/${caseId}/review`)
      .set('Authorization', `Bearer ${supervisor}`)
      .send({ decision: 'approved', decisionNotes }).expect(200);

    const suspendedLogin = await request(app).post('/api/v1/auth/employee/continue')
      .send({ employeeId: employee.employeeId, cnicLastFour: employee.cnicLastFour }).expect(200);
    expect(suspendedLogin.body).toMatchObject({ data: { user: { status: 'suspended', role: 'employee' } } });
    const suspendedToken = integrationAccessToken(suspendedLogin);
    const portal = await request(app).get('/api/v1/suspensions/me')
      .set('Authorization', `Bearer ${suspendedToken}`).expect(200);
    expect(portal.body).toMatchObject({ data: { suspensionCase: {
      id: caseId,
      reasonSummary: input.reasonSummary,
      details: input.details,
      decisionNotes,
    } } });
    await request(app).get('/api/v1/tickets')
      .set('Authorization', `Bearer ${suspendedToken}`).expect(403);

    await request(app).post(`/api/v1/account-governance/users/${employee.id}/reactivate`)
      .set('Authorization', `Bearer ${supervisor}`)
      .send({ reason: 'Acceptance cleanup after completing the suspension review test' }).expect(200);
  });

  it('requires complete details for a direct manager suspension', async () => {
    const supervisor = await loginStaff('supervisor.demo');
    const employee = await provisionEmployee('Governance Direct Manager');
    const options = await request(app)
      .get(`/api/v1/account-governance/requesters?search=${employee.employeeId}`)
      .set('Authorization', `Bearer ${supervisor}`).expect(200);
    expect(options.body).toMatchObject({ data: [expect.objectContaining({ id: employee.id, role: 'employee' })] });

    await request(app).post(`/api/v1/account-governance/users/${employee.id}/suspend`)
      .set('Authorization', `Bearer ${supervisor}`)
      .send({ category: 'other', reasonSummary: 'short', details: 'too short' }).expect(422);

    const input = {
      category: 'security-risk',
      reasonSummary: 'Account activity requires a documented security review',
      details: 'The fictional manager decision records the observed risk, review context, and proportional basis for temporarily restricting access.',
    };
    await request(app).post(`/api/v1/account-governance/users/${employee.id}/suspend`)
      .set('Authorization', `Bearer ${supervisor}`).send(input).expect(201);
    const suspendedToken = await loginEmployee(employee.employeeId, employee.cnicLastFour);
    const portal = await request(app).get('/api/v1/suspensions/me')
      .set('Authorization', `Bearer ${suspendedToken}`).expect(200);
    expect(portal.body).toMatchObject({ data: { suspensionCase: {
      origin: 'manager_direct',
      category: input.category,
      reasonSummary: input.reasonSummary,
      details: input.details,
    } } });

    await request(app).post(`/api/v1/account-governance/users/${employee.id}/reactivate`)
      .set('Authorization', `Bearer ${supervisor}`)
      .send({ reason: 'Acceptance cleanup after completing the direct suspension test' }).expect(200);
  });
});
