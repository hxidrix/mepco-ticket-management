import request from 'supertest';
import type { RowDataPacket } from 'mysql2/promise';

import { app } from '../../app.js';
import { databasePool } from '../../database/pool.js';

interface Catalog {
  categories: Array<{
    id: number;
    domain: string;
    complaintTypes: Array<{ id: number }>;
  }>;
}

describe('public complaint portal API', () => {
  it('verifies a consumer with a masked preview without creating a session', async () => {
    const response = await request(app).post('/api/v1/public/complaints/verify')
      .send({ referenceNumber: '10012345678901', consumerId: '0123456789' })
      .expect(200);

    expect(response.body).toMatchObject({
      data: {
        consumer: {
          referenceNumber: '**********8901',
          consumerId: '******6789',
          hasRegisteredPhone: true,
        },
      },
    });
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('10012345678901');
    expect(JSON.stringify(response.body)).not.toContain('0123456789');
  });

  it('submits an attachment with a public complaint and tracks only with all three identifiers', async () => {
    const catalogResponse = await request(app).get('/api/v1/master-data/catalog').expect(200);
    const catalog = (catalogResponse.body as { data: Catalog }).data;
    const category = catalog.categories.find((item) => item.domain === 'consumer');
    const complaintType = category?.complaintTypes[0];
    if (category === undefined || complaintType === undefined) {
      throw new Error('Consumer complaint catalog is missing');
    }

    const idempotencyKey = `public-integration-${Date.now()}`;
    const submission = await request(app).post('/api/v1/public/complaints/submit')
      .field('referenceNumber', '10012345678901')
      .field('consumerId', '0123456789')
      .field('subject', 'Voltage fluctuation at fictional residence')
      .field('description', 'Voltage has fluctuated repeatedly during the documented acceptance-test period.')
      .field('categoryId', String(category.id))
      .field('complaintTypeId', String(complaintType.id))
      .field('locationDetails', 'Near the fictional consumer meter')
      .field('idempotencyKey', idempotencyKey)
      .attach('attachments', Buffer.from('Public complaint acceptance evidence.'), {
        filename: 'evidence.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    expect(submission.headers['set-cookie']).toBeUndefined();
    const ticket = (submission.body as {
      data: { ticket: { id: number; ticketNumber: string; smsQueued: boolean } };
    }).data.ticket;
    expect(ticket.ticketNumber).toMatch(/^MEPCO-\d{4}-\d{6}$/u);
    expect(ticket.smsQueued).toBe(true);

    const [attachmentRows] = await databasePool.execute<Array<RowDataPacket & {
      uploaderId: number | null;
      originalName: string;
    }>>(
      'SELECT uploader_id AS uploaderId, original_name AS originalName FROM attachments WHERE ticket_id = ?',
      [ticket.id],
    );
    expect(attachmentRows).toEqual([
      expect.objectContaining({ uploaderId: null, originalName: 'evidence.txt' }),
    ]);

    const tracked = await request(app).post('/api/v1/public/complaints/track')
      .send({
        ticketNumber: ticket.ticketNumber,
        referenceNumber: '10012345678901',
        consumerId: '0123456789',
      })
      .expect(200);
    expect(tracked.body).toMatchObject({
      data: { ticket: { ticketNumber: ticket.ticketNumber, subject: 'Voltage fluctuation at fictional residence' } },
    });
    expect(tracked.headers['set-cookie']).toBeUndefined();

    await request(app).post('/api/v1/public/complaints/track').send({
      ticketNumber: ticket.ticketNumber,
      referenceNumber: '10012345678901',
      consumerId: '9999999999',
    }).expect(404);
  });

  it('requires a complaint-only phone when the consumer record has no registered mobile', async () => {
    const catalogResponse = await request(app).get('/api/v1/master-data/catalog').expect(200);
    const catalog = (catalogResponse.body as { data: Catalog }).data;
    const category = catalog.categories.find((item) => item.domain === 'consumer');
    const complaintType = category?.complaintTypes[0];
    if (category === undefined || complaintType === undefined) throw new Error('Catalog missing');

    const baseFields = {
      referenceNumber: '10012345678902',
      consumerId: '0123456790',
      subject: 'Fictional complaint without a registered mobile',
      description: 'This acceptance scenario confirms complaint-only mobile collection behavior.',
      categoryId: String(category.id),
      complaintTypeId: String(complaintType.id),
      idempotencyKey: `public-phone-${Date.now()}`,
    };
    await request(app).post('/api/v1/public/complaints/submit')
      .field(baseFields).expect(422);
    await request(app).post('/api/v1/public/complaints/submit')
      .field({ ...baseFields, contactPhone: '03001234567', idempotencyKey: `${baseFields.idempotencyKey}-ok` })
      .expect(201);
  });
});
