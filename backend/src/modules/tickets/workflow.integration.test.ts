import request from 'supertest';
import { app } from '../../app.js';
import { loginEmployee, loginStaff } from '../../test/integration-auth.js';
async function detail(accessToken: string, id: number) {
  const response = await request(app).get(`/api/v1/tickets/${id}`)
    .set('Authorization', `Bearer ${accessToken}`).expect(200);
  return (response.body as { data: { ticket: { version: number; statusSlug: string; priorityId: number } } }).data.ticket;
}

describe('ticket assignment and workflow API', () => {
  it('enforces scoped assignment, optimistic versions, technician transitions and requester confirmation/reopen', async () => {
    const employee = await loginEmployee();
    const supervisor = await loginStaff('supervisor.demo');
    const queue = await request(app).get('/api/v1/tickets?status=assigned')
      .set('Authorization', `Bearer ${employee}`).expect(200);
    const ticketId = (queue.body as { data: Array<{ id: number }> }).data[0]?.id;
    if (ticketId === undefined) throw new Error('Seed new ticket is missing');
    let ticket = await detail(supervisor, ticketId);

    const catalog = await request(app).get('/api/v1/master-data/catalog')
      .set('Authorization', `Bearer ${supervisor}`).expect(200);
    const lowPriority = (catalog.body as { data: { priorities: Array<{ id: number; slug: string }> } })
      .data.priorities.find((priority) => priority.slug === 'low');
    if (lowPriority === undefined) throw new Error('Low priority is missing');
    await request(app).post(`/api/v1/tickets/${ticketId}/priority`)
      .set('Authorization', `Bearer ${supervisor}`)
      .send({ priorityId: lowPriority.id, reason: 'Fictional acceptance reprioritization', version: ticket.version })
      .expect(200);
    ticket = await detail(supervisor, ticketId);
    expect(ticket.priorityId).toBe(lowPriority.id);

    const options = await request(app).get(`/api/v1/tickets/workflow/technicians?ticketId=${ticketId}`)
      .set('Authorization', `Bearer ${supervisor}`).expect(200);
    const technician = (options.body as { data: Array<{ id: number; displayName: string }> }).data
      .find((item) => item.displayName === 'Sara IT Technician');
    if (technician === undefined) throw new Error('Scoped technician missing');
    const assignmentVersion = ticket.version;
    await request(app).post(`/api/v1/tickets/${ticketId}/assign`)
      .set('Authorization', `Bearer ${supervisor}`)
      .send({ technicianId: technician.id, reason: 'Fictional supervisor assignment', version: assignmentVersion })
      .expect(200);
    await request(app).post(`/api/v1/tickets/${ticketId}/assign`)
      .set('Authorization', `Bearer ${supervisor}`)
      .send({ technicianId: technician.id, reason: 'Stale assignment attempt', version: assignmentVersion })
      .expect(409);

    const assignedTechnician = await loginStaff('tech.it');
    const otherTechnician = await loginStaff('tech.ops');
    await request(app).get(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${otherTechnician}`).expect(404);
    ticket = await detail(assignedTechnician, ticketId);
    expect(ticket.statusSlug).toBe('assigned');
    const technicianDetail = await request(app).get(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${assignedTechnician}`).expect(200);
    expect(technicianDetail.body).toMatchObject({
      data: { allowedStatusTransitions: ['in-progress', 'pending-user', 'resolved'] },
    });
    await request(app).post(`/api/v1/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${assignedTechnician}`)
      .send({ status: 'in-progress', reason: 'Work started', version: ticket.version }).expect(200);
    ticket = await detail(assignedTechnician, ticketId);
    await request(app).post(`/api/v1/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${assignedTechnician}`)
      .send({ status: 'resolved', reason: 'Work completed', resolutionSummary: 'Fictional safe resolution completed successfully.', version: ticket.version })
      .expect(200);

    ticket = await detail(employee, ticketId);
    expect(ticket.statusSlug).toBe('resolved');
    const requesterDetail = await request(app).get(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${employee}`).expect(200);
    expect(requesterDetail.body).toMatchObject({ data: { allowedStatusTransitions: [] } });
    await request(app).post(`/api/v1/tickets/${ticketId}/close-review`)
      .set('Authorization', `Bearer ${employee}`)
      .send({
        issueResolved: true,
        satisfactionRating: 5,
        reviewText: 'The fictional issue was resolved successfully.',
        version: ticket.version,
      }).expect(200);
    ticket = await detail(employee, ticketId);
    const reviewed = await request(app).get(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${employee}`).expect(200);
    expect(reviewed.body).toMatchObject({ data: { review: {
      issueResolved: true,
      satisfactionRating: 5,
      reviewText: 'The fictional issue was resolved successfully.',
    } } });
    await request(app).post(`/api/v1/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${employee}`)
      .send({ status: 'reopened', reason: 'Fictional issue returned within the configured window', version: ticket.version })
      .expect(200);
    expect((await detail(employee, ticketId)).statusSlug).toBe('reopened');
  });

  it('requires a resolution summary and rejects requester-controlled staff transitions', async () => {
    const technician = await loginStaff('tech.it');
    const list = await request(app).get('/api/v1/tickets?status=in-progress')
      .set('Authorization', `Bearer ${technician}`).expect(200);
    const item = (list.body as { data: Array<{ id: number; version: number }> }).data[0];
    if (item !== undefined) {
      await request(app).post(`/api/v1/tickets/${item.id}/status`)
        .set('Authorization', `Bearer ${technician}`)
        .send({ status: 'resolved', reason: 'Missing resolution summary', version: item.version }).expect(422);
    }
    const employee = await loginEmployee();
    const own = await request(app).get('/api/v1/tickets?status=in-progress')
      .set('Authorization', `Bearer ${employee}`).expect(200);
    const ownItem = (own.body as { data: Array<{ id: number; version: number }> }).data[0];
    if (ownItem !== undefined) {
      await request(app).post(`/api/v1/tickets/${ownItem.id}/status`)
        .set('Authorization', `Bearer ${employee}`)
        .send({ status: 'resolved', reason: 'Requester cannot resolve', resolutionSummary: 'Not permitted', version: ownItem.version })
        .expect(409);
    }
  });
});
