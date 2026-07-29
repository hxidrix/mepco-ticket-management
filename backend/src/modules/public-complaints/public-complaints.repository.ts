import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';

import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { env } from '../../config/env.js';
import { databasePool } from '../../database/pool.js';
import { AppError } from '../../shared/app-error.js';
import { deleteAttachment, storeAttachment } from '../../shared/attachment-storage.js';
import { writeAudit } from '../../shared/audit.js';
import type { RequestContext } from '../auth/auth.types.js';
import { dispatchSmsOutbox, queueSms } from '../sms/sms.service.js';
import {
  leastBusyTechnician,
  ticketNumber,
  validateCreation,
} from '../tickets/tickets.repository.js';
import type { TicketCreateInput } from '../tickets/tickets.types.js';

interface ConsumerRecordRow extends RowDataPacket {
  id: number;
  referenceNumber: string;
  consumerId: string;
  fullName: string;
  registeredPhone: string | null;
  tariff: string;
  circleId: number;
  circleName: string;
  divisionId: number;
  divisionName: string;
  subdivisionId: number;
  subdivisionName: string;
}

interface ExistingTicketRow extends RowDataPacket {
  id: number;
  ticketNumber: string;
}

interface PublicTicketRow extends RowDataPacket {
  ticketNumber: string;
  subject: string;
  categoryName: string;
  complaintTypeName: string;
  priorityName: string;
  statusName: string;
  statusSlug: string;
  circleName: string;
  divisionName: string;
  subdivisionName: string;
  resolutionSummary: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
}

export interface PublicComplaintInput extends TicketCreateInput {
  referenceNumber: string;
  consumerId: string;
  contactPhone?: string;
}

export interface UploadFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const allowedAttachments = new Map<string, string[]>([
  ['.jpg', ['image/jpeg']], ['.jpeg', ['image/jpeg']], ['.png', ['image/png']],
  ['.pdf', ['application/pdf']], ['.txt', ['text/plain']],
  ['.doc', ['application/msword']],
  ['.docx', ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']],
]);

function maskDigits(value: string, visibleEnd: number): string {
  return `${'*'.repeat(value.length - visibleEnd)}${value.slice(-visibleEnd)}`;
}

function maskName(value: string): string {
  return value.split(/\s+/u).map((part) => part.length < 2
    ? '*'
    : `${part[0]}${'*'.repeat(Math.max(2, part.length - 1))}`).join(' ');
}

async function consumerRecord(
  referenceNumber: string,
  consumerId: string,
): Promise<ConsumerRecordRow | null> {
  const [rows] = await databasePool.execute<ConsumerRecordRow[]>(
    `SELECT record.id, record.reference_number AS referenceNumber,
            record.consumer_id AS consumerId, record.full_name AS fullName,
            record.registered_phone AS registeredPhone, record.tariff,
            record.circle_id AS circleId, circle.name AS circleName,
            record.division_id AS divisionId, division.name AS divisionName,
            record.subdivision_id AS subdivisionId, subdivision.name AS subdivisionName
     FROM consumer_records record
     JOIN circles circle ON circle.id = record.circle_id
     JOIN divisions division ON division.id = record.division_id
     JOIN subdivisions subdivision ON subdivision.id = record.subdivision_id
     WHERE record.reference_number = ? AND record.consumer_id = ? AND record.is_active = TRUE
     LIMIT 1`,
    [referenceNumber, consumerId],
  );
  return rows[0] ?? null;
}

async function requireConsumer(referenceNumber: string, consumerId: string): Promise<ConsumerRecordRow> {
  const consumer = await consumerRecord(referenceNumber, consumerId);
  if (consumer === null) {
    throw new AppError(401, 'CONSUMER_VERIFICATION_FAILED', 'The consumer details could not be verified');
  }
  return consumer;
}

export async function verifyConsumer(referenceNumber: string, consumerId: string) {
  const consumer = await requireConsumer(referenceNumber, consumerId);
  return {
    referenceNumber: maskDigits(consumer.referenceNumber, 4),
    consumerId: maskDigits(consumer.consumerId, 4),
    name: maskName(consumer.fullName),
    subdivision: consumer.subdivisionName,
    tariff: consumer.tariff,
    hasRegisteredPhone: consumer.registeredPhone !== null,
  };
}

function validateAttachment(file: UploadFile): string {
  const extension = extname(file.originalname).toLowerCase();
  const mimeTypes = allowedAttachments.get(extension);
  if (mimeTypes === undefined || !mimeTypes.includes(file.mimetype)) {
    throw new AppError(415, 'UNSUPPORTED_ATTACHMENT', 'Allowed file types are JPG, PNG, PDF, TXT, DOC, and DOCX');
  }
  if (file.size === 0 || file.size > env.maxUploadBytes) {
    throw new AppError(413, 'ATTACHMENT_SIZE_INVALID', `Each attachment must be between 1 byte and ${env.maxUploadBytes} bytes`);
  }
  return extension;
}

export async function submitPublicComplaint(
  input: PublicComplaintInput,
  files: UploadFile[],
  context: RequestContext,
): Promise<{ id: number; ticketNumber: string; smsQueued: boolean }> {
  const consumer = await requireConsumer(input.referenceNumber, input.consumerId);
  const contactPhone = consumer.registeredPhone ?? input.contactPhone ?? null;
  if (contactPhone === null) {
    throw new AppError(422, 'CONTACT_PHONE_REQUIRED', 'Enter a mobile number for complaint updates');
  }
  const extensions = files.map(validateAttachment);
  const connection = await databasePool.getConnection();
  const storedLocators: string[] = [];
  try {
    await connection.beginTransaction();
    if (input.idempotencyKey !== undefined) {
      const [existing] = await connection.execute<ExistingTicketRow[]>(
        `SELECT id, ticket_number AS ticketNumber
         FROM tickets WHERE consumer_record_id = ? AND idempotency_key = ?`,
        [consumer.id, input.idempotencyKey],
      );
      if (existing[0] !== undefined) {
        await connection.commit();
        return { ...existing[0], smsQueued: false };
      }
    }

    const consumerInput: TicketCreateInput = {
      ...input,
      circleId: consumer.circleId,
      divisionId: consumer.divisionId,
      subdivisionId: consumer.subdivisionId,
    };
    const validated = await validateCreation(connection, 'consumer', consumerInput);
    const assignee = await leastBusyTechnician(connection, {
      domain: 'consumer',
      routingDepartmentId: validated.routingDepartmentId,
      categoryId: input.categoryId,
      circleId: consumer.circleId,
      divisionId: consumer.divisionId,
      subdivisionId: consumer.subdivisionId,
    });
    const initialStatusSlug = assignee === undefined ? 'new' : 'assigned';
    const [statuses] = await connection.execute<Array<RowDataPacket & { id: number }>>(
      'SELECT id FROM ticket_statuses WHERE slug = ? AND is_active = TRUE',
      [initialStatusSlug],
    );
    const statusId = statuses[0]?.id;
    if (statusId === undefined) throw new Error(`${initialStatusSlug} ticket status is not configured`);

    let number = ticketNumber();
    let result: ResultSetHeader | null = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO tickets
           (ticket_number, idempotency_key, requester_id, consumer_record_id,
            complaint_contact_phone, domain, subject, description, category_id,
            complaint_type_id, department_id, circle_id, division_id, subdivision_id,
            other_category, other_complaint_type, location_details, priority_id, status_id,
            current_assignee_id, complaint_sla_target_hours, sla_target_hours,
            category_name_snapshot, complaint_type_name_snapshot, department_name_snapshot,
            circle_name_snapshot, division_name_snapshot, subdivision_name_snapshot)
           VALUES (?, ?, NULL, ?, ?, 'consumer', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [number, input.idempotencyKey ?? null, consumer.id, contactPhone,
            input.subject, input.description, input.categoryId, input.complaintTypeId,
            validated.departmentId, consumer.circleId, consumer.divisionId, consumer.subdivisionId,
            input.otherCategory ?? null, input.otherComplaintType ?? null,
            input.locationDetails ?? null, validated.priority.id, statusId, assignee?.id ?? null,
            validated.complaintType.slaTargetHours, validated.slaTargetHours,
            validated.category.name, validated.complaintType.name, validated.departmentName,
            consumer.circleName, consumer.divisionName, consumer.subdivisionName],
        );
        break;
      } catch (error) {
        if (typeof error !== 'object' || error === null || !('code' in error)
            || error.code !== 'ER_DUP_ENTRY') throw error;
        number = ticketNumber();
      }
    }
    if (result === null) throw new Error('Could not allocate a unique ticket number');

    await connection.execute(
      `INSERT INTO ticket_history (ticket_id, event_type, actor_id, new_value, reason)
       VALUES (?, 'ticket_created', NULL, ?, 'Complaint submitted through the public portal')`,
      [result.insertId, JSON.stringify({
        status: initialStatusSlug,
        priorityId: validated.priority.id,
        priority: validated.priority.slug,
        prioritySource: 'automatic',
        complaintSlaTargetHours: validated.complaintType.slaTargetHours,
        slaTargetHours: validated.slaTargetHours,
      })],
    );

    if (assignee !== undefined) {
      const reason = `Automatic routing to ${validated.routingDepartmentName ?? 'the responsible department'} based on complaint type`;
      await connection.execute(
        `INSERT INTO assignments (ticket_id, technician_id, assigned_by, reason)
         VALUES (?, ?, NULL, ?)`,
        [result.insertId, assignee.id, reason],
      );
      await connection.execute(
        `INSERT INTO notifications (recipient_id, type, title, message, target_type, target_id)
         VALUES (?, 'ticket_assigned', 'Ticket assigned automatically', ?, 'ticket', ?)`,
        [assignee.id, `${number}: ${input.subject}`, result.insertId],
      );
    }

    await connection.execute(
      `INSERT INTO notifications (recipient_id, type, title, message, target_type, target_id)
       SELECT u.id, 'queue_ticket_created', 'New public complaint', ?, 'ticket', ?
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE r.name IN ('supervisor', 'administrator')
         AND u.status = 'active' AND u.deleted_at IS NULL`,
      [`${number}: ${input.subject}`, result.insertId],
    );

    const now = new Date();
    const relativeDirectory = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    for (const [index, file] of files.entries()) {
      const extension = extensions[index]!;
      const storedName = `${randomUUID()}${extension}`;
      const storagePath = await storeAttachment({
        buffer: file.buffer,
        mimeType: file.mimetype,
        storedName,
        relativeDirectory,
      });
      storedLocators.push(storagePath);
      await connection.execute(
        `INSERT INTO attachments
          (ticket_id, uploader_id, original_name, stored_name, mime_type, extension,
           size_bytes, checksum_sha256, storage_path)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
        [result.insertId, file.originalname, storedName, file.mimetype, extension.slice(1),
          file.size, createHash('sha256').update(file.buffer).digest('hex'), storagePath],
      );
    }

    const smsMessage = `MEPCO complaint ${number} has been submitted. Keep this number with your Reference Number and Consumer ID to track progress.`;
    await queueSms(connection, result.insertId, contactPhone, 'complaint_submitted', smsMessage);
    await writeAudit(connection, {
      actorId: null,
      action: 'public_complaint.created',
      entityType: 'ticket',
      entityId: String(result.insertId),
      context,
      metadata: {
        ticketNumber: number,
        consumerRecordId: consumer.id,
        attachmentCount: files.length,
        smsQueued: true,
      },
    });
    await connection.commit();
    void dispatchSmsOutbox(10).catch(() => undefined);
    return { id: result.insertId, ticketNumber: number, smsQueued: true };
  } catch (error) {
    await connection.rollback();
    await Promise.all(storedLocators.map((locator) => deleteAttachment(locator).catch(() => undefined)));
    throw error;
  } finally {
    connection.release();
  }
}

export async function trackPublicComplaint(
  ticketNumberValue: string,
  referenceNumber: string,
  consumerId: string,
) {
  const [rows] = await databasePool.execute<PublicTicketRow[]>(
    `SELECT ticket.ticket_number AS ticketNumber, ticket.subject,
            ticket.category_name_snapshot AS categoryName,
            ticket.complaint_type_name_snapshot AS complaintTypeName,
            priority.name AS priorityName, status.name AS statusName, status.slug AS statusSlug,
            ticket.circle_name_snapshot AS circleName,
            ticket.division_name_snapshot AS divisionName,
            ticket.subdivision_name_snapshot AS subdivisionName,
            ticket.resolution_summary AS resolutionSummary,
            ticket.created_at AS createdAt, ticket.updated_at AS updatedAt,
            ticket.resolved_at AS resolvedAt, ticket.closed_at AS closedAt
     FROM tickets ticket
     JOIN consumer_records consumer ON consumer.id = ticket.consumer_record_id
     JOIN priorities priority ON priority.id = ticket.priority_id
     JOIN ticket_statuses status ON status.id = ticket.status_id
     WHERE ticket.ticket_number = ? AND consumer.reference_number = ?
       AND consumer.consumer_id = ? AND ticket.deleted_at IS NULL
     LIMIT 1`,
    [ticketNumberValue, referenceNumber, consumerId],
  );
  const ticket = rows[0];
  if (ticket === undefined) {
    throw new AppError(404, 'COMPLAINT_NOT_FOUND', 'No complaint matched the supplied details');
  }
  return ticket;
}
