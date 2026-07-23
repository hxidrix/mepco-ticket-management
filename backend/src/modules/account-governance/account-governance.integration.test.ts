import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';

import { app } from '../../app.js';

function token(response: SupertestResponse): string {
  const body = response.body as { data?: { accessToken?: unknown } };
  if (typeof body.data?.accessToken !== 'string') throw new Error('Expected an access token');
  return body.data.accessToken;
}

async function login(mode: 'consumer' | 'employee' | 'staff', identifier: string): Promise<SupertestResponse> {
  return request(app).post('/api/v1/auth/login')
    .send({ mode, identifier, password: 'Demo@12345' }).expect(200);
}

async function registerConsumer(label: string): Promise<{ id: number; identifier: string; accessToken: string }> {
  const optionsResponse = await request(app).get('/api/v1/auth/registration-options').expect(200);
  const options = optionsResponse.body as { data: { circles: Array<{ id: number; divisions: Array<{ id: number; subdivisions: Array<{ id: number }> }> }> } };
  const circle = options.data.circles[0];
  const division = circle?.divisions[0];
  const subdivision = division?.subdivisions[0];
  if (circle === undefined || division === undefined || subdivision === undefined) throw new Error('Registration location options are missing');
  const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`.slice(-12);
  const identifier = `31${suffix}`;
  const cnic = `4${suffix}`;
  await request(app).post('/api/v1/auth/register/consumer').send({
    referenceNumber: identifier,
    name: `Governance ${label} Consumer`,
    phone: '03005550101',
    cnic,
    password: 'Governance@123',
    address: 'Fictional governance acceptance address',
    circleId: circle.id,
    divisionId: division.id,
    subdivisionId: subdivision.id,
  }).expect(201);
  const response = await request(app).post('/api/v1/auth/login')
    .send({ mode: 'consumer', identifier, password: 'Governance@123' }).expect(200);
  const userId = (response.body as { data: { user: { id: number } } }).data.user.id;
  return { id: userId, identifier, accessToken: token(response) };
}

async function createTicketAssignedToTechnician(
  consumerToken: string,
  supervisorToken: string,
): Promise<number> {
  const catalogResponse = await request(app).get('/api/v1/master-data/catalog')
    .set('Authorization', `Bearer ${consumerToken}`).expect(200);
  const catalog = catalogResponse.body as { data: {
    categories: Array<{ id: number; domain: string; complaintTypes: Array<{ id: number }> }>;
    circles: Array<{ id: number; divisions: Array<{ id: number; subdivisions: Array<{ id: number }> }> }>;
  } };
  const category = catalog.data.categories.find((item) => item.domain === 'consumer' && item.complaintTypes.length > 0);
  const complaintType = category?.complaintTypes[0];
  const circle = catalog.data.circles[0];
  const division = circle?.divisions[0];
  const subdivision = division?.subdivisions[0];
  if (category === undefined || complaintType === undefined || circle === undefined || division === undefined || subdivision === undefined) {
    throw new Error('Ticket catalog is incomplete');
  }
  const created = await request(app).post('/api/v1/tickets')
    .set('Authorization', `Bearer ${consumerToken}`).send({
      subject: 'Fictional account governance review ticket',
      description: 'An isolated ticket used to verify the technician suspension request workflow.',
      categoryId: category.id,
      complaintTypeId: complaintType.id,
      circleId: circle.id,
      divisionId: division.id,
      subdivisionId: subdivision.id,
      locationDetails: 'Fictional governance test location',
    }).expect(201);
  const ticketId = (created.body as { data: { ticket: { id: number } } }).data.ticket.id;
  const detail = await request(app).get(`/api/v1/tickets/${ticketId}`)
    .set('Authorization', `Bearer ${supervisorToken}`).expect(200);
  const ticket = (detail.body as { data: { ticket: { version: number; assigneeName: string | null } } }).data.ticket;
  if (ticket.assigneeName !== 'Sara IT Technician') {
    const technicians = await request(app).get(`/api/v1/tickets/workflow/technicians?ticketId=${ticketId}`)
      .set('Authorization', `Bearer ${supervisorToken}`).expect(200);
    const technician = (technicians.body as { data: Array<{ id: number; displayName: string }> }).data
      .find((item) => item.displayName === 'Sara IT Technician');
    if (technician === undefined) throw new Error('Expected the seeded IT technician');
    await request(app).post(`/api/v1/tickets/${ticketId}/assign`)
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ technicianId: technician.id, reason: 'Governance acceptance assignment', version: ticket.version })
      .expect(200);
  }
  return ticketId;
}

describe('account suspension governance API', () => {
  it('sends a technician request to managers and records the reviewed decision for the account holder', async () => {
    const supervisorToken = token(await login('staff', 'supervisor.demo'));
    const consumer = await registerConsumer('Technician Request');
    const ticketId = await createTicketAssignedToTechnician(consumer.accessToken, supervisorToken);
    const technicianToken = token(await login('staff', 'tech.it'));

    const input = {
      ticketId,
      category: 'repeated-policy-violation',
      reasonSummary: 'Repeated misuse documented on the assigned support ticket',
      details: 'The fictional acceptance scenario records repeated misuse and links the manager review to the complete ticket conversation.',
    };
    const created = await request(app).post('/api/v1/account-governance/requests')
      .set('Authorization', `Bearer ${technicianToken}`).send(input).expect(201);
    const caseId = (created.body as { data: { id: number } }).data.id;
    await request(app).post('/api/v1/account-governance/requests')
      .set('Authorization', `Bearer ${technicianToken}`).send(input).expect(409);

    const notifications = await request(app).get('/api/v1/notifications')
      .set('Authorization', `Bearer ${supervisorToken}`).expect(200);
    const notificationItems = (notifications.body as { data: { items: Array<{ type: string }> } }).data.items;
    expect(notificationItems.some((item) => item.type === 'suspension_requested')).toBe(true);
    const queue = await request(app).get('/api/v1/account-governance/requests?status=pending')
      .set('Authorization', `Bearer ${supervisorToken}`).expect(200);
    const queuedCase = (queue.body as { data: Array<{
      id: number; targetUserId: number; ticketNumber: string | null; requesterName: string; status: string;
    }> }).data[0];
    expect(queuedCase).toMatchObject({
      id: caseId, targetUserId: consumer.id, status: 'pending',
    });
    expect(typeof queuedCase?.ticketNumber).toBe('string');
    expect(typeof queuedCase?.requesterName).toBe('string');

    const decisionNotes = 'The supervisor reviewed the ticket evidence and approved a proportionate account suspension.';
    await request(app).put(`/api/v1/account-governance/requests/${caseId}/review`)
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ decision: 'approved', decisionNotes }).expect(200);
    const ownCases = await request(app).get('/api/v1/account-governance/requests')
      .set('Authorization', `Bearer ${technicianToken}`).expect(200);
    expect(ownCases.body).toMatchObject({ data: [expect.objectContaining({ id: caseId, status: 'approved' })] });

    const consumerLogin = await request(app).post('/api/v1/auth/login')
      .send({ mode: 'consumer', identifier: consumer.identifier, password: 'Governance@123' }).expect(200);
    expect(consumerLogin.body).toMatchObject({ data: { user: { status: 'suspended' } } });
    const suspendedToken = token(consumerLogin);
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

    await request(app).post(`/api/v1/account-governance/users/${consumer.id}/reactivate`)
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ reason: 'Acceptance cleanup after completing the suspension review test' }).expect(200);
  });

  it('requires complete details for a direct manager suspension', async () => {
    const supervisorToken = token(await login('staff', 'supervisor.demo'));
    const registered = await registerConsumer('Direct Manager');
    const options = await request(app).get(`/api/v1/account-governance/requesters?search=${registered.identifier}`)
      .set('Authorization', `Bearer ${supervisorToken}`).expect(200);
    const consumer = (options.body as { data: Array<{ id: number; status: string }> }).data[0];
    if (consumer === undefined) throw new Error('Expected the seeded consumer');

    await request(app).post(`/api/v1/account-governance/users/${consumer.id}/suspend`)
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ category: 'other', reasonSummary: 'short', details: 'too short' }).expect(422);

    const input = {
      category: 'security-risk',
      reasonSummary: 'Account activity requires a documented security review',
      details: 'The fictional manager decision records the observed risk, review context, and proportional basis for temporarily restricting access.',
    };
    await request(app).post(`/api/v1/account-governance/users/${consumer.id}/suspend`)
      .set('Authorization', `Bearer ${supervisorToken}`).send(input).expect(201);
    const consumerLogin = await request(app).post('/api/v1/auth/login')
      .send({ mode: 'consumer', identifier: registered.identifier, password: 'Governance@123' }).expect(200);
    expect(consumerLogin.body).toMatchObject({ data: { user: { status: 'suspended' } } });
    const portal = await request(app).get('/api/v1/suspensions/me')
      .set('Authorization', `Bearer ${token(consumerLogin)}`).expect(200);
    expect(portal.body).toMatchObject({ data: { suspensionCase: {
      origin: 'manager_direct',
      category: input.category,
      reasonSummary: input.reasonSummary,
      details: input.details,
    } } });

    await request(app).post(`/api/v1/account-governance/users/${consumer.id}/reactivate`)
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ reason: 'Acceptance cleanup after completing the direct suspension test' }).expect(200);
  });
});
