import { randomUUID } from 'node:crypto';

import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { databasePool } from '../../database/pool.js';

export type SmsEvent = 'complaint_submitted' | 'assigned' | 'updated' | 'resolved' | 'closed';

interface SmsRow extends RowDataPacket {
  id: number;
  recipientPhone: string;
  eventType: SmsEvent;
  message: string;
}

export async function queueSms(
  connection: PoolConnection,
  ticketId: number,
  recipientPhone: string | null,
  eventType: SmsEvent,
  message: string,
): Promise<void> {
  if (recipientPhone === null) return;
  await connection.execute(
    `INSERT INTO sms_outbox (ticket_id, recipient_phone, event_type, message)
     VALUES (?, ?, ?, ?)`,
    [ticketId, recipientPhone, eventType, message],
  );
}

async function deliver(row: SmsRow): Promise<string> {
  if (env.smsDriver === 'local-log') {
    logger.info({
      smsOutboxId: row.id,
      eventType: row.eventType,
      recipientSuffix: row.recipientPhone.slice(-4),
      message: row.message,
    }, 'Local SMS delivery simulation');
    return `local-${randomUUID()}`;
  }

  if (env.smsWebhookUrl === '') {
    throw new Error('SMS_WEBHOOK_URL is required when SMS_DRIVER=webhook');
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (env.smsWebhookToken !== '') headers.Authorization = `Bearer ${env.smsWebhookToken}`;
  const response = await fetch(env.smsWebhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to: row.recipientPhone,
      senderId: env.smsSenderId,
      event: row.eventType,
      message: row.message,
      idempotencyKey: `mepco-sms-${row.id}`,
    }),
  });
  if (!response.ok) throw new Error(`SMS webhook returned HTTP ${response.status}`);
  const payload = await response.json().catch(() => null) as { messageId?: unknown } | null;
  return typeof payload?.messageId === 'string' ? payload.messageId : `webhook-${row.id}`;
}

export async function dispatchSmsOutbox(limit = 10): Promise<void> {
  const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const [rows] = await databasePool.execute<SmsRow[]>(
    `SELECT id, recipient_phone AS recipientPhone, event_type AS eventType, message
     FROM sms_outbox
     WHERE status = 'pending' AND next_attempt_at <= UTC_TIMESTAMP()
     ORDER BY id
     LIMIT ${boundedLimit}`,
  );
  for (const row of rows) {
    try {
      const providerMessageId = await deliver(row);
      await databasePool.execute(
        `UPDATE sms_outbox
         SET status = 'sent', attempt_count = attempt_count + 1,
             provider_message_id = ?, last_error = NULL, sent_at = UTC_TIMESTAMP()
         WHERE id = ? AND status = 'pending'`,
        [providerMessageId, row.id],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown SMS delivery error';
      await databasePool.execute(
        `UPDATE sms_outbox
         SET status = IF(attempt_count + 1 >= 5, 'failed', 'pending'),
             attempt_count = attempt_count + 1, last_error = ?,
             next_attempt_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 MINUTE)
         WHERE id = ? AND status = 'pending'`,
        [message.slice(0, 500), row.id],
      );
      logger.warn({ smsOutboxId: row.id, error: message }, 'SMS delivery attempt failed');
    }
  }
}
