import { createHash, randomInt, randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { env } from '../../config/env.js';
import { databasePool } from '../../database/pool.js';
import { AppError } from '../../shared/app-error.js';
import { writeAudit } from '../../shared/audit.js';
import type { RequestContext } from '../auth/auth.types.js';
import type {
  TicketActor, TicketClosureReviewInput, TicketCreateInput, TicketDomain, TicketListInput,
} from './tickets.types.js';
import { classifyConsumerPriority } from './consumer-priority.js';
import { consumerRoutingDepartment } from './ticket-routing.js';

type SqlValue = string | number | null;
interface IdRow extends RowDataPacket { id: number; name: string }
interface PriorityRow extends IdRow { slug: string }
interface CategoryRow extends RowDataPacket {
  id: number; name: string; domain: TicketDomain; departmentId: number | null; departmentName: string | null;
}
interface CountRow extends RowDataPacket { count: number }
interface TicketRow extends RowDataPacket {
  id: number; ticketNumber: string; domain: TicketDomain; subject: string; description: string;
  categoryId: number; categoryName: string; complaintTypeId: number; complaintTypeName: string;
  departmentId: number | null; departmentName: string | null; circleId: number | null;
  circleName: string | null; cityId: number | null; cityName: string | null;
  otherCategory: string | null; otherComplaintType: string | null; locationDetails: string | null;
  priorityId: number; priorityName: string; prioritySlug: string; priorityColor: string;
  statusId: number; statusName: string; statusSlug: string; assigneeId: number | null;
  assigneeName: string | null; requesterId: number; requesterName: string; resolutionSummary: string | null;
  version: number; createdAt: Date; updatedAt: Date; resolvedAt: Date | null; closedAt: Date | null;
}
interface DetailChildRow extends RowDataPacket { id: number }
interface TicketReviewRow extends RowDataPacket {
  id: number; issueResolved: boolean; satisfactionRating: number; reviewText: string | null;
  requesterId: number; requesterName: string; createdAt: Date;
}
interface WorkflowRow extends RowDataPacket {
  id: number; requesterId: number; domain: TicketDomain; departmentId: number | null;
  categoryId: number; circleId: number | null; assigneeId: number | null;
  statusId: number; statusSlug: string; version: number; resolvedAt: Date | null; closedAt: Date | null;
}
interface TechnicianRow extends RowDataPacket {
  id: number; displayName: string; departmentName: string | null; activeAssignments: number;
}
interface AutoAssigneeRow extends RowDataPacket {
  id: number; displayName: string; activeAssignments: number;
}
interface MetricRow extends RowDataPacket { label: string; count: number }
interface SummaryMetricRow extends RowDataPacket {
  total: number; open: number; overdue: number; resolved: number; averageResolutionHours: number | null;
}
interface WorkloadRow extends RowDataPacket { assigneeId: number; assigneeName: string; count: number }
interface AttachmentRow extends RowDataPacket {
  id: number; ticketId: number; originalName: string; mimeType: string; storagePath: string;
}

const allowedAttachments = new Map<string, string[]>([
  ['.jpg', ['image/jpeg']], ['.jpeg', ['image/jpeg']], ['.png', ['image/png']],
  ['.pdf', ['application/pdf']], ['.txt', ['text/plain']],
  ['.doc', ['application/msword']],
  ['.docx', ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']],
]);

const ticketSelect = `
  SELECT t.id, t.ticket_number AS ticketNumber, t.domain, t.subject, t.description,
    t.category_id AS categoryId, t.category_name_snapshot AS categoryName,
    t.complaint_type_id AS complaintTypeId, t.complaint_type_name_snapshot AS complaintTypeName,
    t.department_id AS departmentId, t.department_name_snapshot AS departmentName,
    t.circle_id AS circleId, t.circle_name_snapshot AS circleName,
    t.city_id AS cityId, t.city_name_snapshot AS cityName, t.other_category AS otherCategory,
    t.other_complaint_type AS otherComplaintType, t.location_details AS locationDetails,
    p.id AS priorityId, p.name AS priorityName, p.slug AS prioritySlug, p.color_token AS priorityColor,
    s.id AS statusId, s.name AS statusName, s.slug AS statusSlug,
    t.current_assignee_id AS assigneeId, assignee.display_name AS assigneeName,
    t.requester_id AS requesterId, requester.display_name AS requesterName,
    t.resolution_summary AS resolutionSummary, t.version, t.created_at AS createdAt,
    t.updated_at AS updatedAt, t.resolved_at AS resolvedAt, t.closed_at AS closedAt
  FROM tickets t
  JOIN priorities p ON p.id = t.priority_id
  JOIN ticket_statuses s ON s.id = t.status_id
  JOIN users requester ON requester.id = t.requester_id
  LEFT JOIN users assignee ON assignee.id = t.current_assignee_id`;

function ticketNumber(): string {
  return `MEPCO-${new Date().getUTCFullYear()}-${String(randomInt(0, 1_000_000)).padStart(6, '0')}`;
}

function scopeCondition(actor: TicketActor): { sql: string; values: SqlValue[] } {
  if (actor.role === 'administrator') return { sql: '1 = 1', values: [] };
  if (actor.role === 'consumer' || actor.role === 'employee') return { sql: 't.requester_id = ?', values: [actor.id] };
  if (actor.role === 'technician') return { sql: 't.current_assignee_id = ?', values: [actor.id] };
  return {
    sql: `EXISTS (SELECT 1 FROM staff_scopes scope WHERE scope.user_id = ? AND scope.domain = t.domain
      AND (scope.department_id IS NULL OR scope.department_id = t.department_id)
      AND (scope.category_id IS NULL OR scope.category_id = t.category_id)
      AND (scope.circle_id IS NULL OR scope.circle_id = t.circle_id))`,
    values: [actor.id],
  };
}

async function validateCreation(
  connection: PoolConnection,
  domain: TicketDomain,
  input: TicketCreateInput,
) {
  const [categories] = await connection.execute<CategoryRow[]>(
    `SELECT cat.id, cat.name, cat.domain, cat.department_id AS departmentId, d.name AS departmentName
     FROM categories cat LEFT JOIN departments d ON d.id = cat.department_id
     WHERE cat.id = ? AND cat.is_active = TRUE`, [input.categoryId],
  );
  const category = categories[0];
  if (category === undefined || category.domain !== domain) {
    throw new AppError(422, 'INVALID_CATEGORY', 'The category is not valid for this ticket domain');
  }
  const [types] = await connection.execute<IdRow[]>(
    `SELECT id, name FROM complaint_types WHERE id = ? AND category_id = ? AND is_active = TRUE`,
    [input.complaintTypeId, input.categoryId],
  );
  const complaintType = types[0];
  if (complaintType === undefined) throw new AppError(422, 'INVALID_COMPLAINT_TYPE', 'The complaint type does not belong to this category');
  if (category.name === 'Other' && (input.otherCategory?.trim() ?? '') === '') {
    throw new AppError(422, 'OTHER_CATEGORY_REQUIRED', 'Please describe the other category');
  }
  if (complaintType.name === 'Other' && (input.otherComplaintType?.trim() ?? '') === '') {
    throw new AppError(422, 'OTHER_COMPLAINT_TYPE_REQUIRED', 'Please describe the other complaint type');
  }
  let departmentId = category.departmentId;
  let departmentName = category.departmentName;
  let routingDepartmentId = category.departmentId;
  let routingDepartmentName = category.departmentName;
  let circle: IdRow | undefined;
  let city: IdRow | undefined;
  if (domain === 'consumer') {
    if (input.circleId === undefined || input.cityId === undefined) {
      throw new AppError(422, 'LOCATION_REQUIRED', 'Circle and city are required for consumer tickets');
    }
    const [circles] = await connection.execute<IdRow[]>('SELECT id, name FROM circles WHERE id = ? AND is_active = TRUE', [input.circleId]);
    [circle] = circles;
    const [cities] = await connection.execute<IdRow[]>('SELECT id, name FROM cities WHERE id = ? AND circle_id = ? AND is_active = TRUE', [input.cityId, input.circleId]);
    [city] = cities;
    if (circle === undefined || city === undefined) throw new AppError(422, 'INVALID_LOCATION', 'The circle and city selection is invalid');
    routingDepartmentName = consumerRoutingDepartment(category.name);
    const [routingDepartments] = await connection.execute<IdRow[]>(
      'SELECT id, name FROM departments WHERE name = ? AND is_active = TRUE',
      [routingDepartmentName],
    );
    routingDepartmentId = routingDepartments[0]?.id ?? null;
    departmentId = null; departmentName = null;
  } else {
    const requestedDepartment = input.departmentId ?? category.departmentId;
    if (requestedDepartment === null) throw new AppError(422, 'DEPARTMENT_REQUIRED', 'A department is required for employee tickets');
    const [departments] = await connection.execute<IdRow[]>('SELECT id, name FROM departments WHERE id = ? AND is_active = TRUE', [requestedDepartment]);
    const department = departments[0];
    if (department === undefined) throw new AppError(422, 'INVALID_DEPARTMENT', 'The department is unavailable');
    if (category.departmentId !== null && category.departmentId !== department.id) {
      throw new AppError(422, 'CATEGORY_DEPARTMENT_MISMATCH', 'The category does not belong to this department');
    }
    departmentId = department.id; departmentName = department.name;
    routingDepartmentId = department.id; routingDepartmentName = department.name;
  }
  let priority: PriorityRow | undefined;
  if (domain === 'consumer') {
    const prioritySlug = classifyConsumerPriority({
      categoryName: category.name,
      complaintTypeName: complaintType.name,
      subject: input.subject,
      description: input.description,
      ...(input.otherCategory === undefined ? {} : { otherCategory: input.otherCategory }),
      ...(input.otherComplaintType === undefined ? {} : { otherComplaintType: input.otherComplaintType }),
    });
    const [priorities] = await connection.execute<PriorityRow[]>(
      'SELECT id, name, slug FROM priorities WHERE slug = ? AND is_active = TRUE', [prioritySlug],
    );
    [priority] = priorities;
  } else {
    if (input.priorityId === undefined) {
      throw new AppError(422, 'PRIORITY_REQUIRED', 'Select a priority for the employee ticket');
    }
    const [priorities] = await connection.execute<PriorityRow[]>(
      'SELECT id, name, slug FROM priorities WHERE id = ? AND is_active = TRUE', [input.priorityId],
    );
    [priority] = priorities;
  }
  if (priority === undefined) throw new AppError(422, 'INVALID_PRIORITY', 'The ticket priority is unavailable');
  return {
    category, complaintType, departmentId, departmentName, routingDepartmentId,
    routingDepartmentName, circle, city, priority,
  };
}

async function leastBusyTechnician(
  connection: PoolConnection,
  departmentId: number | null,
): Promise<AutoAssigneeRow | undefined> {
  if (departmentId === null) return undefined;
  const [technicians] = await connection.execute<AutoAssigneeRow[]>(
    `SELECT u.id, u.display_name AS displayName, COUNT(a.id) AS activeAssignments
     FROM users u
     JOIN roles r ON r.id = u.role_id AND r.name = 'technician'
     JOIN staff_profiles sp ON sp.user_id = u.id AND sp.department_id = ?
     LEFT JOIN assignments a ON a.technician_id = u.id AND a.ended_at IS NULL
     WHERE u.status = 'active' AND u.deleted_at IS NULL
     GROUP BY u.id, u.display_name
     ORDER BY activeAssignments ASC, u.id ASC
     LIMIT 1`,
    [departmentId],
  );
  return technicians[0];
}

export async function createTicket(
  actor: TicketActor,
  input: TicketCreateInput,
  context: RequestContext,
): Promise<{ id: number; ticketNumber: string }> {
  if (actor.role !== 'consumer' && actor.role !== 'employee') {
    throw new AppError(403, 'REQUESTER_ROLE_REQUIRED', 'Only consumers and employees can submit tickets');
  }
  const domain = actor.role;
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    if (input.idempotencyKey !== undefined) {
      const [existing] = await connection.execute<Array<RowDataPacket & { id: number; ticketNumber: string }>>(
        'SELECT id, ticket_number AS ticketNumber FROM tickets WHERE requester_id = ? AND idempotency_key = ?',
        [actor.id, input.idempotencyKey],
      );
      if (existing[0] !== undefined) { await connection.commit(); return existing[0]; }
    }
    const validated = await validateCreation(connection, domain, input);
    const assignee = await leastBusyTechnician(connection, validated.routingDepartmentId);
    const initialStatusSlug = assignee === undefined ? 'new' : 'assigned';
    const [statuses] = await connection.execute<PriorityRow[]>(
      'SELECT id, name, slug FROM ticket_statuses WHERE slug = ? AND is_active = TRUE',
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
           (ticket_number, idempotency_key, requester_id, domain, subject, description,
            category_id, complaint_type_id, department_id, circle_id, city_id, other_category,
            other_complaint_type, location_details, priority_id, status_id, current_assignee_id,
            category_name_snapshot, complaint_type_name_snapshot, department_name_snapshot,
            circle_name_snapshot, city_name_snapshot)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [number, input.idempotencyKey ?? null, actor.id, domain, input.subject, input.description,
            input.categoryId, input.complaintTypeId, validated.departmentId, validated.circle?.id ?? null,
            validated.city?.id ?? null, input.otherCategory ?? null, input.otherComplaintType ?? null,
            input.locationDetails ?? null, validated.priority.id, statusId, assignee?.id ?? null,
            validated.category.name,
            validated.complaintType.name, validated.departmentName, validated.circle?.name ?? null,
            validated.city?.name ?? null],
        );
        break;
      } catch (error) {
        if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'ER_DUP_ENTRY') throw error;
        number = ticketNumber();
      }
    }
    if (result === null) throw new Error('Could not allocate a unique ticket number');
    await connection.execute(
      `INSERT INTO ticket_history (ticket_id, event_type, actor_id, new_value, reason)
       VALUES (?, 'ticket_created', ?, ?, 'Ticket submitted by requester')`,
      [result.insertId, actor.id, JSON.stringify({
        status: initialStatusSlug,
        priorityId: validated.priority.id,
        priority: validated.priority.slug,
        prioritySource: domain === 'consumer' ? 'automatic' : 'requester',
      })],
    );
    if (assignee !== undefined) {
      const assignmentReason = `Automatic routing to ${validated.routingDepartmentName ?? 'the responsible department'} based on ticket category and complaint type`;
      await connection.execute(
        `INSERT INTO assignments (ticket_id, technician_id, assigned_by, reason)
         VALUES (?, ?, ?, ?)`,
        [result.insertId, assignee.id, actor.id, assignmentReason],
      );
      await connection.execute(
        `INSERT INTO ticket_history (ticket_id, event_type, actor_id, old_value, new_value, reason)
         VALUES (?, 'auto_assigned', NULL, ?, ?, ?)`,
        [result.insertId, JSON.stringify({ assigneeId: null, status: 'new' }), JSON.stringify({
          assigneeId: assignee.id,
          assigneeName: assignee.displayName,
          status: 'assigned',
          departmentId: validated.routingDepartmentId,
          departmentName: validated.routingDepartmentName,
        }), assignmentReason],
      );
      await connection.execute(
        `INSERT INTO notifications (recipient_id, type, title, message, target_type, target_id)
         VALUES (?, 'ticket_assigned', 'Ticket assigned automatically', ?, 'ticket', ?)`,
        [assignee.id, `${number}: ${input.subject}`, result.insertId],
      );
    }
    await connection.execute(
      `INSERT INTO notifications (recipient_id, type, title, message, target_type, target_id)
       VALUES (?, 'ticket_created', 'Ticket submitted', ?, 'ticket', ?)`,
      [actor.id, assignee === undefined
        ? `${number} was submitted successfully and is awaiting assignment`
        : `${number} was submitted and assigned to ${assignee.displayName}`,
      result.insertId],
    );
    await connection.execute(
      `INSERT INTO notifications (recipient_id, type, title, message, target_type, target_id)
       SELECT u.id, 'queue_ticket_created', 'New ticket in queue', ?, 'ticket', ?
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE r.name IN ('supervisor', 'administrator') AND u.status = 'active' AND u.deleted_at IS NULL`,
      [`${number}: ${input.subject}`, result.insertId],
    );
    await writeAudit(connection, { actorId: actor.id, action: 'ticket.created', entityType: 'ticket', entityId: String(result.insertId), context, metadata: { ticketNumber: number, domain, priority: validated.priority.slug, prioritySource: domain === 'consumer' ? 'automatic' : 'requester', assignmentSource: assignee === undefined ? 'unassigned' : 'automatic_department_routing', routingDepartmentId: validated.routingDepartmentId, routingDepartmentName: validated.routingDepartmentName, assigneeId: assignee?.id ?? null } });
    await connection.commit();
    return { id: result.insertId, ticketNumber: number };
  } catch (error) {
    await connection.rollback(); throw error;
  } finally { connection.release(); }
}

export async function listTickets(actor: TicketActor, input: TicketListInput) {
  const scope = scopeCondition(actor);
  const conditions = ['t.deleted_at IS NULL', scope.sql];
  const values: SqlValue[] = [...scope.values];
  if (input.search !== undefined) { conditions.push('(t.ticket_number LIKE ? OR t.subject LIKE ? OR t.description LIKE ?)'); const q = `%${input.search}%`; values.push(q, q, q); }
  if (input.status !== undefined) { conditions.push('s.slug = ?'); values.push(input.status); }
  if (input.priority !== undefined) { conditions.push('p.slug = ?'); values.push(input.priority); }
  if (input.domain !== undefined) { conditions.push('t.domain = ?'); values.push(input.domain); }
  if (input.categoryId !== undefined) { conditions.push('t.category_id = ?'); values.push(input.categoryId); }
  if (input.departmentId !== undefined) { conditions.push('t.department_id = ?'); values.push(input.departmentId); }
  if (input.circleId !== undefined) { conditions.push('t.circle_id = ?'); values.push(input.circleId); }
  if (input.assigneeId !== undefined) { conditions.push('t.current_assignee_id = ?'); values.push(input.assigneeId); }
  if (input.dateFrom !== undefined) { conditions.push('t.created_at >= ?'); values.push(input.dateFrom); }
  if (input.dateTo !== undefined) { conditions.push('t.created_at < DATE_ADD(?, INTERVAL 1 DAY)'); values.push(input.dateTo); }
  const where = conditions.join(' AND ');
  const sortColumns = { createdAt: 't.created_at', updatedAt: 't.updated_at', ticketNumber: 't.ticket_number', priority: 'p.sort_order', status: 's.sort_order' } as const;
  const sortColumn = sortColumns[input.sortBy ?? 'createdAt'];
  const sortOrder = input.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const [counts] = await databasePool.execute<CountRow[]>(
    `SELECT COUNT(*) AS count FROM tickets t JOIN priorities p ON p.id=t.priority_id JOIN ticket_statuses s ON s.id=t.status_id WHERE ${where}`,
    values,
  );
  const [items] = await databasePool.execute<TicketRow[]>(
    `${ticketSelect} WHERE ${where} ORDER BY ${sortColumn} ${sortOrder}, t.id ${sortOrder} LIMIT ? OFFSET ?`,
    [...values, input.pageSize, (input.page - 1) * input.pageSize],
  );
  return { items, totalItems: counts[0]?.count ?? 0 };
}

export async function canAccessTicket(actor: TicketActor, ticketId: number): Promise<boolean> {
  const scope = scopeCondition(actor);
  const [rows] = await databasePool.execute<CountRow[]>(
    `SELECT COUNT(*) AS count FROM tickets t WHERE t.id = ? AND t.deleted_at IS NULL AND ${scope.sql}`,
    [ticketId, ...scope.values],
  );
  return (rows[0]?.count ?? 0) > 0;
}

export async function getTicketDetail(actor: TicketActor, ticketId: number) {
  if (!(await canAccessTicket(actor, ticketId))) throw new AppError(404, 'TICKET_NOT_FOUND', 'The ticket was not found');
  const [tickets] = await databasePool.execute<TicketRow[]>(`${ticketSelect} WHERE t.id = ? LIMIT 1`, [ticketId]);
  const ticket = tickets[0];
  if (ticket === undefined) throw new AppError(404, 'TICKET_NOT_FOUND', 'The ticket was not found');
  const commentVisibility = actor.role === 'consumer' || actor.role === 'employee' ? "AND c.visibility = 'public'" : '';
  const [comments] = await databasePool.execute<DetailChildRow[]>(
    `SELECT c.id, c.visibility, c.body, c.created_at AS createdAt, c.updated_at AS updatedAt,
      u.id AS authorId, u.display_name AS authorName, r.name AS authorRole
     FROM comments c JOIN users u ON u.id=c.author_id JOIN roles r ON r.id=u.role_id
     WHERE c.ticket_id = ? AND c.deleted_at IS NULL ${commentVisibility} ORDER BY c.created_at, c.id`, [ticketId],
  );
  const [history] = await databasePool.execute<DetailChildRow[]>(
    `SELECT h.id, h.event_type AS eventType, h.old_value AS oldValue, h.new_value AS newValue,
      h.reason, h.created_at AS createdAt, u.display_name AS actorName
     FROM ticket_history h LEFT JOIN users u ON u.id=h.actor_id WHERE h.ticket_id=? ORDER BY h.created_at, h.id`, [ticketId],
  );
  const [attachments] = await databasePool.execute<DetailChildRow[]>(
    `SELECT id, original_name AS originalName, mime_type AS mimeType, size_bytes AS sizeBytes,
      created_at AS createdAt FROM attachments WHERE ticket_id=? AND deleted_at IS NULL ORDER BY created_at`, [ticketId],
  );
  const [reviews] = await databasePool.execute<TicketReviewRow[]>(
    `SELECT review.id, review.issue_resolved AS issueResolved,
      review.satisfaction_rating AS satisfactionRating, review.review_text AS reviewText,
      review.requester_id AS requesterId, requester.display_name AS requesterName,
      review.created_at AS createdAt
     FROM ticket_reviews review JOIN users requester ON requester.id=review.requester_id
     WHERE review.ticket_id=? LIMIT 1`, [ticketId],
  );
  const review = reviews[0];
  return {
    ticket,
    comments,
    history,
    attachments,
    review: review === undefined ? null : { ...review, issueResolved: Boolean(review.issueResolved) },
    allowedStatusTransitions: actor.role === 'consumer' || actor.role === 'employee'
      ? []
      : allowedWorkflowTargets(actor, ticket),
  };
}

async function workflowTicket(connection: PoolConnection, ticketId: number): Promise<WorkflowRow> {
  const [rows] = await connection.execute<WorkflowRow[]>(
    `SELECT t.id, t.requester_id AS requesterId, t.domain, t.department_id AS departmentId,
      t.category_id AS categoryId, t.circle_id AS circleId, t.current_assignee_id AS assigneeId,
      t.status_id AS statusId, s.slug AS statusSlug, t.version,
      t.resolved_at AS resolvedAt, t.closed_at AS closedAt
     FROM tickets t JOIN ticket_statuses s ON s.id=t.status_id
     WHERE t.id=? AND t.deleted_at IS NULL FOR UPDATE`, [ticketId],
  );
  const row = rows[0];
  if (row === undefined) throw new AppError(404, 'TICKET_NOT_FOUND', 'The ticket was not found');
  return row;
}

export async function listTechnicians(actor: TicketActor, ticketId?: number): Promise<TechnicianRow[]> {
  if (actor.role !== 'supervisor' && actor.role !== 'administrator') {
    throw new AppError(403, 'FORBIDDEN', 'Only supervisors and administrators can list technicians');
  }
  if (ticketId !== undefined && !(await canAccessTicket(actor, ticketId))) {
    throw new AppError(404, 'TICKET_NOT_FOUND', 'The ticket was not found');
  }
  const scopeFilter = actor.role === 'administrator' || ticketId === undefined ? '' : `AND EXISTS (
    SELECT 1 FROM tickets target
    JOIN staff_scopes scope ON scope.user_id=u.id AND scope.domain=target.domain
    WHERE target.id=?
      AND (scope.department_id IS NULL OR scope.department_id=target.department_id)
      AND (scope.category_id IS NULL OR scope.category_id=target.category_id)
      AND (scope.circle_id IS NULL OR scope.circle_id=target.circle_id))`;
  const [rows] = await databasePool.execute<TechnicianRow[]>(
    `SELECT u.id, u.display_name AS displayName, d.name AS departmentName,
      COUNT(a.id) AS activeAssignments
     FROM users u JOIN roles r ON r.id=u.role_id
     JOIN staff_profiles sp ON sp.user_id=u.id LEFT JOIN departments d ON d.id=sp.department_id
     LEFT JOIN assignments a ON a.technician_id=u.id AND a.ended_at IS NULL
     WHERE r.name='technician' AND u.status='active' AND u.deleted_at IS NULL ${scopeFilter}
     GROUP BY u.id, u.display_name, d.name ORDER BY activeAssignments, u.display_name`,
    ticketId === undefined || actor.role === 'administrator' ? [] : [ticketId],
  );
  return rows;
}

export async function assignTicket(
  actor: TicketActor,
  ticketId: number,
  technicianId: number,
  reason: string,
  expectedVersion: number,
  context: RequestContext,
): Promise<void> {
  if (actor.role !== 'supervisor' && actor.role !== 'administrator') throw new AppError(403, 'FORBIDDEN', 'Only supervisors and administrators can assign tickets');
  if (!(await canAccessTicket(actor, ticketId))) throw new AppError(404, 'TICKET_NOT_FOUND', 'The ticket was not found');
  const eligible = await listTechnicians(actor, ticketId);
  if (!eligible.some((technician) => technician.id === technicianId)) {
    throw new AppError(422, 'TECHNICIAN_OUT_OF_SCOPE', 'The technician is not eligible for this ticket');
  }
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const ticket = await workflowTicket(connection, ticketId);
    if (ticket.version !== expectedVersion) throw new AppError(409, 'VERSION_CONFLICT', 'The ticket changed; reload and try again');
    if (['resolved', 'closed', 'cancelled'].includes(ticket.statusSlug)) throw new AppError(409, 'TERMINAL_TICKET', 'A resolved, closed, or cancelled ticket cannot be assigned');
    await connection.execute(
      `UPDATE assignments SET ended_at=UTC_TIMESTAMP(), ended_reason='Reassigned' WHERE ticket_id=? AND ended_at IS NULL`, [ticketId],
    );
    await connection.execute(
      `INSERT INTO assignments (ticket_id, technician_id, assigned_by, reason) VALUES (?, ?, ?, ?)`,
      [ticketId, technicianId, actor.id, reason],
    );
    const [assignedStatuses] = await connection.execute<IdRow[]>(`SELECT id, name FROM ticket_statuses WHERE slug='assigned'`);
    const assignedStatusId = assignedStatuses[0]?.id;
    if (assignedStatusId === undefined) throw new Error('Assigned status is missing');
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE tickets SET current_assignee_id=?, status_id=?, version=version+1
       WHERE id=? AND version=?`, [technicianId, assignedStatusId, ticketId, expectedVersion],
    );
    if (result.affectedRows === 0) throw new AppError(409, 'VERSION_CONFLICT', 'The ticket changed; reload and try again');
    await connection.execute(
      `INSERT INTO ticket_history (ticket_id, event_type, actor_id, old_value, new_value, reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [ticketId, ticket.assigneeId === null ? 'assigned' : 'reassigned', actor.id,
        JSON.stringify({ assigneeId: ticket.assigneeId, status: ticket.statusSlug }),
        JSON.stringify({ assigneeId: technicianId, status: 'assigned' }), reason],
    );
    await connection.execute(
      `INSERT INTO notifications (recipient_id, type, title, message, target_type, target_id)
       VALUES (?, 'ticket_assigned', 'Ticket assigned', 'A ticket was assigned to you', 'ticket', ?),
              (?, 'ticket_updated', 'Ticket assigned', 'Your ticket has been assigned', 'ticket', ?)`,
      [technicianId, ticketId, ticket.requesterId, ticketId],
    );
    await writeAudit(connection, { actorId: actor.id, action: 'ticket.assigned', entityType: 'ticket', entityId: String(ticketId), context, metadata: { technicianId } });
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

function allowedWorkflowTargets(
  actor: TicketActor,
  ticket: Pick<WorkflowRow, 'assigneeId' | 'requesterId' | 'statusSlug' | 'resolvedAt' | 'closedAt'>,
): string[] {
  if (actor.role === 'technician') {
    if (ticket.assigneeId !== actor.id || !['assigned', 'in-progress', 'pending-user', 'reopened'].includes(ticket.statusSlug)) {
      return [];
    }
    return ['in-progress', 'pending-user', 'resolved'].filter((status) => status !== ticket.statusSlug);
  }
  if (actor.role === 'supervisor' || actor.role === 'administrator') {
    if (['closed', 'cancelled', 'resolved'].includes(ticket.statusSlug)) return ['reopened'];
    return ['in-progress', 'pending-user', 'resolved', 'cancelled']
      .filter((status) => status !== ticket.statusSlug);
  }
  if (ticket.requesterId !== actor.id) return [];
  if (ticket.statusSlug === 'new') return ['cancelled'];
  if (['resolved', 'closed'].includes(ticket.statusSlug)) return ['reopened'];
  return [];
}

export async function transitionTicket(
  actor: TicketActor,
  ticketId: number,
  targetStatus: string,
  reason: string,
  resolutionSummary: string | undefined,
  expectedVersion: number,
  context: RequestContext,
): Promise<void> {
  if (!(await canAccessTicket(actor, ticketId))) throw new AppError(404, 'TICKET_NOT_FOUND', 'The ticket was not found');
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const ticket = await workflowTicket(connection, ticketId);
    if (ticket.version !== expectedVersion) throw new AppError(409, 'VERSION_CONFLICT', 'The ticket changed; reload and try again');
    const allowed = allowedWorkflowTargets(actor, ticket).includes(targetStatus);
    if (ticket.requesterId === actor.id && targetStatus === 'reopened') {
      const reference = ticket.closedAt ?? ticket.resolvedAt;
      if (reference === null || Date.now() - reference.getTime() > env.reopenWindowDays * 86_400_000) {
        throw new AppError(409, 'REOPEN_WINDOW_EXPIRED', `Tickets can be reopened within ${env.reopenWindowDays} days`);
      }
    }
    if (!allowed) throw new AppError(409, 'INVALID_STATUS_TRANSITION', `Cannot move from ${ticket.statusSlug} to ${targetStatus}`);
    if (targetStatus === 'resolved' && (resolutionSummary?.trim() ?? '').length < 10) {
      throw new AppError(422, 'RESOLUTION_REQUIRED', 'A meaningful resolution summary is required');
    }
    const [statuses] = await connection.execute<IdRow[]>(
      `SELECT id, name FROM ticket_statuses WHERE slug=? AND is_active=TRUE`, [targetStatus],
    );
    const target = statuses[0];
    if (target === undefined) throw new AppError(422, 'INVALID_STATUS', 'The target status is unavailable');
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE tickets SET status_id=?, version=version+1,
        resolution_summary=CASE WHEN ?='resolved' THEN ? WHEN ?='reopened' THEN NULL ELSE resolution_summary END,
        resolved_at=CASE WHEN ?='resolved' THEN UTC_TIMESTAMP() WHEN ?='reopened' THEN NULL ELSE resolved_at END,
        closed_at=CASE WHEN ?='closed' THEN UTC_TIMESTAMP() WHEN ?='reopened' THEN NULL ELSE closed_at END,
        requester_confirmed_at=CASE WHEN ?='closed' AND ?=requester_id THEN UTC_TIMESTAMP() WHEN ?='reopened' THEN NULL ELSE requester_confirmed_at END
       WHERE id=? AND version=?`,
      [target.id, targetStatus, resolutionSummary ?? null, targetStatus, targetStatus, targetStatus,
        targetStatus, targetStatus, targetStatus, actor.id, targetStatus, ticketId, expectedVersion],
    );
    if (result.affectedRows === 0) throw new AppError(409, 'VERSION_CONFLICT', 'The ticket changed; reload and try again');
    await connection.execute(
      `INSERT INTO ticket_history (ticket_id, event_type, actor_id, old_value, new_value, reason)
       VALUES (?, 'status_changed', ?, ?, ?, ?)`,
      [ticketId, actor.id, JSON.stringify({ status: ticket.statusSlug }), JSON.stringify({ status: targetStatus, resolutionSummary }), reason],
    );
    const recipients = new Set([ticket.requesterId]); if (ticket.assigneeId !== null) recipients.add(ticket.assigneeId);
    for (const recipientId of recipients) {
      if (recipientId === actor.id) continue;
      await connection.execute(
        `INSERT INTO notifications (recipient_id, type, title, message, target_type, target_id)
         VALUES (?, 'ticket_status_changed', 'Ticket status updated', ?, 'ticket', ?)`,
        [recipientId, `Ticket moved to ${target.name}`, ticketId],
      );
    }
    await writeAudit(connection, { actorId: actor.id, action: 'ticket.status_changed', entityType: 'ticket', entityId: String(ticketId), context, metadata: { from: ticket.statusSlug, to: targetStatus } });
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

export async function closeTicketWithReview(
  actor: TicketActor,
  ticketId: number,
  input: TicketClosureReviewInput,
  context: RequestContext,
): Promise<void> {
  if (actor.role !== 'consumer' && actor.role !== 'employee') {
    throw new AppError(403, 'REQUESTER_ROLE_REQUIRED', 'Only the requester can close a ticket with a review');
  }
  if (!(await canAccessTicket(actor, ticketId))) {
    throw new AppError(404, 'TICKET_NOT_FOUND', 'The ticket was not found');
  }
  if (!Number.isInteger(input.satisfactionRating) || input.satisfactionRating < 1 || input.satisfactionRating > 5) {
    throw new AppError(422, 'INVALID_SATISFACTION_RATING', 'Satisfaction rating must be between 1 and 5');
  }
  const reviewText = input.reviewText?.trim() || null;
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const ticket = await workflowTicket(connection, ticketId);
    if (ticket.requesterId !== actor.id) throw new AppError(404, 'TICKET_NOT_FOUND', 'The ticket was not found');
    if (ticket.version !== input.version) throw new AppError(409, 'VERSION_CONFLICT', 'The ticket changed; reload and try again');
    if (['closed', 'cancelled'].includes(ticket.statusSlug)) {
      throw new AppError(409, 'TICKET_ALREADY_FINISHED', 'A closed or cancelled ticket cannot be closed again');
    }
    const [statuses] = await connection.execute<IdRow[]>(
      "SELECT id, name FROM ticket_statuses WHERE slug='closed' AND is_active=TRUE",
    );
    const closedStatus = statuses[0];
    if (closedStatus === undefined) throw new Error('Closed ticket status is not configured');
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE tickets SET status_id=?, requester_confirmed_at=UTC_TIMESTAMP(), closed_at=UTC_TIMESTAMP(),
        version=version+1 WHERE id=? AND version=?`,
      [closedStatus.id, ticketId, input.version],
    );
    if (result.affectedRows === 0) throw new AppError(409, 'VERSION_CONFLICT', 'The ticket changed; reload and try again');
    await connection.execute(
      `INSERT INTO ticket_reviews
        (ticket_id, requester_id, issue_resolved, satisfaction_rating, review_text)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE requester_id=VALUES(requester_id), issue_resolved=VALUES(issue_resolved),
         satisfaction_rating=VALUES(satisfaction_rating), review_text=VALUES(review_text), created_at=CURRENT_TIMESTAMP`,
      [ticketId, actor.id, input.issueResolved, input.satisfactionRating, reviewText],
    );
    await connection.execute(
      `UPDATE assignments SET ended_at=UTC_TIMESTAMP(), ended_reason='Ticket closed by requester'
       WHERE ticket_id=? AND ended_at IS NULL`,
      [ticketId],
    );
    await connection.execute(
      `INSERT INTO ticket_history (ticket_id, event_type, actor_id, old_value, new_value, reason)
       VALUES (?, 'ticket_closed_with_review', ?, ?, ?, 'Requester closed the ticket and submitted feedback')`,
      [ticketId, actor.id, JSON.stringify({ status: ticket.statusSlug }), JSON.stringify({
        status: 'closed', issueResolved: input.issueResolved, satisfactionRating: input.satisfactionRating,
      })],
    );
    if (ticket.assigneeId !== null && ticket.assigneeId !== actor.id) {
      await connection.execute(
        `INSERT INTO notifications (recipient_id, type, title, message, target_type, target_id)
         VALUES (?, 'ticket_reviewed', 'Ticket closed and reviewed', 'The requester closed a ticket and submitted feedback', 'ticket', ?)`,
        [ticket.assigneeId, ticketId],
      );
    }
    await writeAudit(connection, {
      actorId: actor.id,
      action: 'ticket.closed_with_review',
      entityType: 'ticket',
      entityId: String(ticketId),
      context,
      metadata: { issueResolved: input.issueResolved, satisfactionRating: input.satisfactionRating },
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteTicket(
  actor: TicketActor,
  ticketId: number,
  reason: string,
  expectedVersion: number,
  context: RequestContext,
): Promise<void> {
  if (actor.role !== 'administrator') {
    throw new AppError(403, 'FORBIDDEN', 'Only administrators can delete tickets');
  }
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const ticket = await workflowTicket(connection, ticketId);
    if (ticket.version !== expectedVersion) throw new AppError(409, 'VERSION_CONFLICT', 'The ticket changed; reload and try again');
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE tickets SET deleted_at=UTC_TIMESTAMP(), deleted_by=?, deleted_reason=?, version=version+1
       WHERE id=? AND version=? AND deleted_at IS NULL`,
      [actor.id, reason, ticketId, expectedVersion],
    );
    if (result.affectedRows === 0) throw new AppError(409, 'VERSION_CONFLICT', 'The ticket changed; reload and try again');
    await connection.execute(
      `UPDATE assignments SET ended_at=UTC_TIMESTAMP(), ended_reason='Ticket deleted by administrator'
       WHERE ticket_id=? AND ended_at IS NULL`,
      [ticketId],
    );
    await writeAudit(connection, {
      actorId: actor.id,
      action: 'ticket.deleted',
      entityType: 'ticket',
      entityId: String(ticketId),
      context,
      metadata: { reason, previousStatus: ticket.statusSlug },
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function changeTicketPriority(
  actor: TicketActor,
  ticketId: number,
  priorityId: number,
  reason: string,
  expectedVersion: number,
  context: RequestContext,
): Promise<void> {
  if (actor.role !== 'supervisor' && actor.role !== 'administrator') throw new AppError(403, 'FORBIDDEN', 'Only supervisors and administrators can change priority');
  if (!(await canAccessTicket(actor, ticketId))) throw new AppError(404, 'TICKET_NOT_FOUND', 'The ticket was not found');
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction(); const ticket = await workflowTicket(connection, ticketId);
    if (ticket.version !== expectedVersion) throw new AppError(409, 'VERSION_CONFLICT', 'The ticket changed; reload and try again');
    const [priorities] = await connection.execute<IdRow[]>('SELECT id, name FROM priorities WHERE id=? AND is_active=TRUE', [priorityId]);
    if (priorities[0] === undefined) throw new AppError(422, 'INVALID_PRIORITY', 'The priority is unavailable');
    const [old] = await connection.execute<IdRow[]>('SELECT p.id, p.name FROM tickets t JOIN priorities p ON p.id=t.priority_id WHERE t.id=?', [ticketId]);
    await connection.execute('UPDATE tickets SET priority_id=?, version=version+1 WHERE id=? AND version=?', [priorityId, ticketId, expectedVersion]);
    await connection.execute(
      `INSERT INTO ticket_history (ticket_id,event_type,actor_id,old_value,new_value,reason) VALUES (?,'priority_changed',?,?,?,?)`,
      [ticketId, actor.id, JSON.stringify({ priority: old[0]?.name }), JSON.stringify({ priority: priorities[0].name }), reason],
    );
    await writeAudit(connection, { actorId: actor.id, action: 'ticket.priority_changed', entityType: 'ticket', entityId: String(ticketId), context, metadata: { priorityId } });
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

export async function addTicketComment(
  actor: TicketActor,
  ticketId: number,
  body: string,
  visibility: 'public' | 'internal',
  context: RequestContext,
): Promise<number> {
  if (!(await canAccessTicket(actor, ticketId))) throw new AppError(404, 'TICKET_NOT_FOUND', 'The ticket was not found');
  const requester = actor.role === 'consumer' || actor.role === 'employee';
  if (requester && visibility !== 'public') throw new AppError(403, 'INTERNAL_COMMENT_FORBIDDEN', 'Requesters cannot add internal comments');
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const ticket = await workflowTicket(connection, ticketId);
    if (requester && ['closed', 'cancelled'].includes(ticket.statusSlug)) {
      throw new AppError(409, 'TICKET_READ_ONLY', 'Closed or cancelled tickets are read-only for requesters');
    }
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO comments (ticket_id, author_id, visibility, body) VALUES (?, ?, ?, ?)`,
      [ticketId, actor.id, visibility, body],
    );
    await connection.execute(
      `INSERT INTO ticket_history (ticket_id, event_type, actor_id, new_value, reason)
       VALUES (?, 'comment_added', ?, ?, ?)`,
      [ticketId, actor.id, JSON.stringify({ commentId: result.insertId, visibility }), visibility === 'internal' ? 'Internal note added' : 'Public comment added'],
    );
    const recipients = new Set<number>();
    if (visibility === 'public') recipients.add(ticket.requesterId);
    if (ticket.assigneeId !== null) recipients.add(ticket.assigneeId);
    for (const recipientId of recipients) {
      if (recipientId === actor.id) continue;
      await connection.execute(
        `INSERT INTO notifications (recipient_id, type, title, message, target_type, target_id)
         VALUES (?, 'ticket_comment', 'New ticket comment', ?, 'ticket', ?)`,
        [recipientId, visibility === 'internal' ? 'A new internal note was added' : 'A new public comment was added', ticketId],
      );
    }
    await writeAudit(connection, { actorId: actor.id, action: 'ticket.comment_added', entityType: 'ticket', entityId: String(ticketId), context, metadata: { commentId: result.insertId, visibility } });
    await connection.commit();
    return result.insertId;
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

export async function addTicketAttachment(
  actor: TicketActor,
  ticketId: number,
  file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  context: RequestContext,
): Promise<number> {
  if (!(await canAccessTicket(actor, ticketId))) throw new AppError(404, 'TICKET_NOT_FOUND', 'The ticket was not found');
  const extension = extname(file.originalname).toLowerCase();
  const validMimeTypes = allowedAttachments.get(extension);
  if (validMimeTypes === undefined || !validMimeTypes.includes(file.mimetype)) {
    throw new AppError(415, 'UNSUPPORTED_ATTACHMENT', 'Allowed file types are JPG, PNG, PDF, TXT, DOC, and DOCX');
  }
  if (file.size === 0 || file.size > env.maxUploadBytes) {
    throw new AppError(413, 'ATTACHMENT_SIZE_INVALID', `Attachments must be between 1 byte and ${env.maxUploadBytes} bytes`);
  }
  const now = new Date();
  const relativeDirectory = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const directory = resolve(env.uploadDirectory, relativeDirectory);
  const storedName = `${randomUUID()}${extension}`;
  const storagePath = resolve(directory, storedName);
  await mkdir(directory, { recursive: true });
  await writeFile(storagePath, file.buffer, { flag: 'wx' });
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const ticket = await workflowTicket(connection, ticketId);
    const requester = actor.role === 'consumer' || actor.role === 'employee';
    if (requester && ['closed', 'cancelled'].includes(ticket.statusSlug)) {
      throw new AppError(409, 'TICKET_READ_ONLY', 'Closed or cancelled tickets are read-only for requesters');
    }
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO attachments
        (ticket_id, uploader_id, original_name, stored_name, mime_type, extension, size_bytes, checksum_sha256, storage_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ticketId, actor.id, file.originalname, storedName, file.mimetype, extension.slice(1), file.size,
        createHash('sha256').update(file.buffer).digest('hex'), storagePath],
    );
    await connection.execute(
      `INSERT INTO ticket_history (ticket_id, event_type, actor_id, new_value, reason)
       VALUES (?, 'attachment_added', ?, ?, 'Evidence attachment uploaded')`,
      [ticketId, actor.id, JSON.stringify({ attachmentId: result.insertId, name: file.originalname })],
    );
    await writeAudit(connection, { actorId: actor.id, action: 'ticket.attachment_added', entityType: 'ticket', entityId: String(ticketId), context, metadata: { attachmentId: result.insertId, mimeType: file.mimetype, size: file.size } });
    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    await unlink(storagePath).catch(() => undefined);
    throw error;
  } finally { connection.release(); }
}

export async function getTicketAttachment(
  actor: TicketActor,
  attachmentId: number,
): Promise<{ originalName: string; mimeType: string; storagePath: string }> {
  const [rows] = await databasePool.execute<AttachmentRow[]>(
    `SELECT id, ticket_id AS ticketId, original_name AS originalName, mime_type AS mimeType, storage_path AS storagePath
     FROM attachments WHERE id=? AND deleted_at IS NULL`, [attachmentId],
  );
  const attachment = rows[0];
  if (attachment === undefined || !(await canAccessTicket(actor, attachment.ticketId))) {
    throw new AppError(404, 'ATTACHMENT_NOT_FOUND', 'The attachment was not found');
  }
  const uploadRoot = resolve(env.uploadDirectory);
  const storagePath = resolve(attachment.storagePath);
  if (!storagePath.startsWith(`${uploadRoot}${sep}`) && storagePath !== uploadRoot) {
    throw new AppError(500, 'ATTACHMENT_PATH_INVALID', 'The attachment storage path is invalid');
  }
  return { originalName: attachment.originalName, mimeType: attachment.mimeType, storagePath };
}

export async function ticketMetrics(actor: TicketActor) {
  const scope = scopeCondition(actor); const values = scope.values;
  const common = `FROM tickets t JOIN priorities p ON p.id=t.priority_id JOIN ticket_statuses s ON s.id=t.status_id
    WHERE t.deleted_at IS NULL AND ${scope.sql}`;
  const [summaries] = await databasePool.execute<SummaryMetricRow[]>(
    `SELECT COUNT(*) AS total,
      SUM(s.slug NOT IN ('resolved','closed','cancelled')) AS open,
      SUM(s.slug NOT IN ('resolved','closed','cancelled') AND p.sla_target_hours IS NOT NULL
        AND TIMESTAMPDIFF(HOUR,t.created_at,UTC_TIMESTAMP()) > p.sla_target_hours) AS overdue,
      SUM(s.slug IN ('resolved','closed')) AS resolved,
      ROUND(AVG(CASE WHEN t.resolved_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE,t.created_at,t.resolved_at)/60 END),1) AS averageResolutionHours
     ${common}`, values,
  );
  const [byStatus] = await databasePool.execute<MetricRow[]>(
    `SELECT s.name AS label, COUNT(*) AS count ${common} GROUP BY s.id,s.name,s.sort_order ORDER BY s.sort_order`, values,
  );
  const [byPriority] = await databasePool.execute<MetricRow[]>(
    `SELECT p.name AS label, COUNT(*) AS count ${common} GROUP BY p.id,p.name,p.sort_order ORDER BY p.sort_order`, values,
  );
  let workload: WorkloadRow[] = [];
  if (actor.role === 'supervisor' || actor.role === 'administrator') {
    [workload] = await databasePool.execute<WorkloadRow[]>(
      `SELECT u.id AS assigneeId, u.display_name AS assigneeName, COUNT(*) AS count
       FROM tickets t JOIN priorities p ON p.id=t.priority_id JOIN ticket_statuses s ON s.id=t.status_id
       JOIN users u ON u.id=t.current_assignee_id
       WHERE t.deleted_at IS NULL AND s.slug NOT IN ('resolved','closed','cancelled') AND ${scope.sql}
       GROUP BY u.id,u.display_name ORDER BY count DESC,u.display_name`, values,
    );
  }
  const recent = await listTickets(actor, { page: 1, pageSize: 5 });
  const summary = summaries[0] ?? { total: 0, open: 0, overdue: 0, resolved: 0, averageResolutionHours: null };
  return { summary, byStatus, byPriority, workload, recent: recent.items };
}

function csvCell(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function exportTicketsCsv(actor: TicketActor, input: Omit<TicketListInput, 'page' | 'pageSize'>): Promise<string> {
  const result = await listTickets(actor, { ...input, page: 1, pageSize: 10_000 });
  const header = ['Ticket number', 'Domain', 'Subject', 'Category', 'Complaint type', 'Priority', 'Status', 'Requester', 'Assignee', 'Created at', 'Updated at'];
  const rows = result.items.map((ticket) => [ticket.ticketNumber, ticket.domain, ticket.subject, ticket.categoryName,
    ticket.complaintTypeName, ticket.priorityName, ticket.statusName, ticket.requesterName, ticket.assigneeName,
    ticket.createdAt.toISOString(), ticket.updatedAt.toISOString()].map(csvCell).join(','));
  return `\uFEFF${header.map(csvCell).join(',')}\r\n${rows.join('\r\n')}\r\n`;
}
