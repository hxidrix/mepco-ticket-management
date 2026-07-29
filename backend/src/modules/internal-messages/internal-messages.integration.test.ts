import request from 'supertest';
import { app } from '../../app.js';
import { loginEmployee, loginStaff } from '../../test/integration-auth.js';

describe('internal technician-to-manager messages API', () => {
  it('keeps a technician thread private, notifies the manager, and supports replies', async () => {
    const technician = await loginStaff('tech.it');
    const supervisor = await loginStaff('supervisor.demo');
    const administrator = await loginStaff('admin.demo');
    const employee = await loginEmployee();

    await request(app).get('/api/v1/internal-messages/threads')
      .set('Authorization', `Bearer ${employee}`).expect(403);

    const managerRecipientsResponse = await request(app).get('/api/v1/internal-messages/recipients')
      .set('Authorization', `Bearer ${supervisor}`).expect(200);
    const managerRecipients = (managerRecipientsResponse.body as {
      data: Array<{ id: number; displayName: string; role: string }>;
    }).data;
    expect(managerRecipients.every((item) => item.role === 'technician')).toBe(true);
    const technicianRecipient = managerRecipients.find((item) => item.displayName === 'Sara IT Technician');
    if (technicianRecipient === undefined) throw new Error('Expected a seeded technician recipient');

    const managerCreated = await request(app).post('/api/v1/internal-messages/threads')
      .set('Authorization', `Bearer ${supervisor}`)
      .send({
        recipientId: technicianRecipient.id,
        subject: 'Manager follow-up for technician',
        message: 'Please review this management follow-up and confirm the required operational action.',
      })
      .expect(201);
    const managerThreadId = (managerCreated.body as { data: { threadId: number } }).data.threadId;
    const managerThreadOpened = await request(app).get(`/api/v1/internal-messages/threads/${managerThreadId}`)
      .set('Authorization', `Bearer ${technician}`).expect(200);
    expect(managerThreadOpened.body).toMatchObject({
      data: {
        thread: { id: managerThreadId, technicianId: technicianRecipient.id },
        messages: [expect.objectContaining({ senderRole: 'supervisor' })],
      },
    });

    const administratorRecipientsResponse = await request(app).get('/api/v1/internal-messages/recipients')
      .set('Authorization', `Bearer ${administrator}`).expect(200);
    const administratorRecipients = (administratorRecipientsResponse.body as {
      data: Array<{ id: number; displayName: string; role: string }>;
    }).data;
    const administratorTechnician = administratorRecipients.find(
      (item) => item.displayName === 'Sara IT Technician',
    );
    if (administratorTechnician === undefined) throw new Error('Expected an administrator technician recipient');
    const administratorCreated = await request(app).post('/api/v1/internal-messages/threads')
      .set('Authorization', `Bearer ${administrator}`)
      .send({
        recipientId: administratorTechnician.id,
        subject: 'Administrator operational request',
        message: 'Please review this administrative request and reply through the private staff channel.',
      })
      .expect(201);
    const administratorThreadId = (administratorCreated.body as {
      data: { threadId: number };
    }).data.threadId;
    await request(app).get(`/api/v1/internal-messages/threads/${administratorThreadId}`)
      .set('Authorization', `Bearer ${technician}`).expect(200);

    const recipientsResponse = await request(app).get('/api/v1/internal-messages/recipients')
      .set('Authorization', `Bearer ${technician}`).expect(200);
    const recipients = (recipientsResponse.body as {
      data: Array<{ id: number; displayName: string; role: string }>;
    }).data;
    expect(recipients.every((item) => ['supervisor', 'administrator'].includes(item.role))).toBe(true);
    const recipient = recipients.find((item) => item.role === 'supervisor');
    if (recipient === undefined) throw new Error('Expected a seeded supervisor recipient');

    const created = await request(app).post('/api/v1/internal-messages/threads')
      .set('Authorization', `Bearer ${technician}`)
      .send({
        recipientId: recipient.id,
        subject: 'Assistance with a difficult ticket',
        message: 'Please review the ticket routing context and advise on the next documented action.',
      })
      .expect(201);
    const threadId = (created.body as { data: { threadId: number } }).data.threadId;

    const supervisorThreads = await request(app).get('/api/v1/internal-messages/threads')
      .set('Authorization', `Bearer ${supervisor}`).expect(200);
    const supervisorThreadItems = (supervisorThreads.body as {
      data: Array<{ id: number; unreadCount: number }>;
    }).data;
    expect(supervisorThreadItems.find((item) => item.id === threadId)).toMatchObject({ unreadCount: 1 });

    const notifications = await request(app).get('/api/v1/notifications')
      .set('Authorization', `Bearer ${supervisor}`).expect(200);
    const notificationItems = (notifications.body as {
      data: { items: Array<{ type: string; targetType: string | null; targetId: number | null }> };
    }).data.items;
    expect(notificationItems.some((item) => (
      item.type === 'internal_message'
      && item.targetType === 'internal_message_thread'
      && item.targetId === threadId
    ))).toBe(true);

    await request(app).get(`/api/v1/internal-messages/threads/${threadId}`)
      .set('Authorization', `Bearer ${administrator}`).expect(404);
    const opened = await request(app).get(`/api/v1/internal-messages/threads/${threadId}`)
      .set('Authorization', `Bearer ${supervisor}`).expect(200);
    expect(opened.body).toMatchObject({
      data: {
        thread: { id: threadId, managerId: recipient.id },
        messages: [
          expect.objectContaining({
            body: 'Please review the ticket routing context and advise on the next documented action.',
          }),
        ],
      },
    });

    await request(app).post(`/api/v1/internal-messages/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${supervisor}`)
      .send({ message: 'I reviewed the context. Continue with the scoped escalation and record the outcome.' })
      .expect(201);

    const technicianOpened = await request(app).get(`/api/v1/internal-messages/threads/${threadId}`)
      .set('Authorization', `Bearer ${technician}`).expect(200);
    const messages = (technicianOpened.body as {
      data: { messages: Array<{ senderRole: string; body: string }> };
    }).data.messages;
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({
      senderRole: 'supervisor',
      body: 'I reviewed the context. Continue with the scoped escalation and record the outcome.',
    });

    const technicianThreads = await request(app).get('/api/v1/internal-messages/threads')
      .set('Authorization', `Bearer ${technician}`).expect(200);
    const technicianThreadItems = (technicianThreads.body as {
      data: Array<{ id: number; unreadCount: number }>;
    }).data;
    expect(technicianThreadItems.find((item) => item.id === threadId)).toMatchObject({ unreadCount: 0 });
  });

  it('rejects invalid recipients and incomplete messages', async () => {
    const technician = await loginStaff('tech.it');
    const supervisor = await loginStaff('supervisor.demo');
    const recipientsResponse = await request(app).get('/api/v1/internal-messages/recipients')
      .set('Authorization', `Bearer ${technician}`).expect(200);
    const recipients = (recipientsResponse.body as {
      data: Array<{ id: number; role: string }>;
    }).data;

    await request(app).post('/api/v1/internal-messages/threads')
      .set('Authorization', `Bearer ${technician}`)
      .send({ recipientId: 99999999, subject: 'Valid subject', message: 'Valid message' })
      .expect(422);
    await request(app).post('/api/v1/internal-messages/threads')
      .set('Authorization', `Bearer ${technician}`)
      .send({ recipientId: recipients[0]?.id, subject: 'x', message: '' })
      .expect(422);
    await request(app).post('/api/v1/internal-messages/threads')
      .set('Authorization', `Bearer ${supervisor}`)
      .send({
        recipientId: recipients.find((item) => item.role === 'administrator')?.id,
        subject: 'Invalid manager pair',
        message: 'Managers can only start a new thread with an active technician.',
      })
      .expect(422);
  });
});
