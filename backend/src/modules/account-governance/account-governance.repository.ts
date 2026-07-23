import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { databasePool } from '../../database/pool.js';
import { AppError } from '../../shared/app-error.js';
import { writeAudit } from '../../shared/audit.js';
import type { RequestContext, UserRole } from '../auth/auth.types.js';

export type SuspensionCategory =
  | 'abusive-behavior'
  | 'fraudulent-information'
  | 'repeated-policy-violation'
  | 'security-risk'
  | 'misuse-of-service'
  | 'other';
export type SuspensionCaseStatus = 'pending' | 'approved' | 'rejected';

export interface SuspensionCaseInput {
  category: SuspensionCategory;
  reasonSummary: string;
  details: string;
}

interface TicketTargetRow extends RowDataPacket {
  ticketId: number;
  ticketNumber: string;
  requesterId: number;
  requesterName: string;
  requesterRole: 'consumer' | 'employee';
  requesterStatus: 'active' | 'suspended' | 'inactive';
}

interface TargetUserRow extends RowDataPacket {
  id: number;
  displayName: string;
  role: UserRole;
  status: 'active' | 'suspended' | 'inactive';
}

interface CaseTargetRow extends RowDataPacket {
  id: number;
  targetUserId: number;
  requestedBy: number;
  status: SuspensionCaseStatus;
  targetName: string;
  reasonSummary: string;
}

export interface SuspensionCaseRow extends RowDataPacket {
  id: number;
  targetUserId: number;
  targetName: string;
  targetRole: 'consumer' | 'employee';
  targetStatus: 'active' | 'suspended' | 'inactive';
  requestedBy: number;
  requesterName: string;
  requesterRole: UserRole;
  sourceTicketId: number | null;
  ticketNumber: string | null;
  origin: 'technician_request' | 'manager_direct';
  category: SuspensionCategory;
  reasonSummary: string;
  details: string;
  status: SuspensionCaseStatus;
  reviewerName: string | null;
  decisionNotes: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface RequesterOptionRow extends RowDataPacket {
  id: number;
  displayName: string;
  role: 'consumer' | 'employee';
  status: 'active' | 'suspended' | 'inactive';
  identifier: string;
}

const caseSelect = `SELECT suspension.id,suspension.target_user_id AS targetUserId,
  target.display_name AS targetName,target_role.name AS targetRole,target.status AS targetStatus,
  suspension.requested_by AS requestedBy,requester.display_name AS requesterName,
  requester_role.name AS requesterRole,suspension.source_ticket_id AS sourceTicketId,
  ticket.ticket_number AS ticketNumber,suspension.origin,suspension.category,
  suspension.reason_summary AS reasonSummary,suspension.details,suspension.status,
  reviewer.display_name AS reviewerName,suspension.decision_notes AS decisionNotes,
  suspension.reviewed_at AS reviewedAt,suspension.created_at AS createdAt,
  suspension.updated_at AS updatedAt
  FROM account_suspension_cases suspension
  JOIN users target ON target.id=suspension.target_user_id
  JOIN roles target_role ON target_role.id=target.role_id
  JOIN users requester ON requester.id=suspension.requested_by
  JOIN roles requester_role ON requester_role.id=requester.role_id
  LEFT JOIN tickets ticket ON ticket.id=suspension.source_ticket_id
  LEFT JOIN users reviewer ON reviewer.id=suspension.reviewed_by`;

async function notifyManagers(
  connection: PoolConnection,
  caseId: number,
  targetName: string,
): Promise<void> {
  await connection.execute(
    `INSERT INTO notifications (recipient_id,type,title,message,target_type,target_id)
     SELECT u.id,'suspension_requested','Account suspension review required',?,
       'suspension_case',?
     FROM users u JOIN roles role ON role.id=u.role_id
     WHERE role.name IN ('supervisor','administrator') AND u.status='active' AND u.deleted_at IS NULL`,
    [`A technician requested review of ${targetName}'s account.`, caseId],
  );
}

async function targetRequester(
  connection: PoolConnection,
  targetUserId: number,
): Promise<TargetUserRow> {
  const [targets] = await connection.execute<TargetUserRow[]>(
    `SELECT u.id,u.display_name AS displayName,role.name AS role,u.status
     FROM users u JOIN roles role ON role.id=u.role_id
     WHERE u.id=? AND u.deleted_at IS NULL FOR UPDATE`,
    [targetUserId],
  );
  const target = targets[0];
  if (target === undefined) throw new AppError(404, 'USER_NOT_FOUND', 'The account was not found');
  if (target.role !== 'consumer' && target.role !== 'employee') {
    throw new AppError(422, 'REQUESTER_ACCOUNT_REQUIRED', 'Only consumer or employee accounts can use this workflow');
  }
  return target;
}

async function suspendTarget(
  connection: PoolConnection,
  target: TargetUserRow,
  reasonSummary: string,
): Promise<void> {
  if (target.status !== 'active') {
    throw new AppError(409, 'ACCOUNT_NOT_ACTIVE', 'Only an active requester account can be suspended');
  }
  await connection.execute(
    `UPDATE users SET status='suspended',status_reason=? WHERE id=?`,
    [reasonSummary, target.id],
  );
  await connection.execute(
    `UPDATE refresh_sessions SET revoked_at=COALESCE(revoked_at,UTC_TIMESTAMP()),
       revoked_reason=COALESCE(revoked_reason,'Account suspended') WHERE user_id=?`,
    [target.id],
  );
}

export async function createTechnicianSuspensionRequest(
  technicianId: number,
  ticketId: number,
  input: SuspensionCaseInput,
  context: RequestContext,
): Promise<number> {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [tickets] = await connection.execute<TicketTargetRow[]>(
      `SELECT t.id AS ticketId,t.ticket_number AS ticketNumber,t.requester_id AS requesterId,
        requester.display_name AS requesterName,requester_role.name AS requesterRole,
        requester.status AS requesterStatus
       FROM tickets t JOIN users requester ON requester.id=t.requester_id
       JOIN roles requester_role ON requester_role.id=requester.role_id
       WHERE t.id=? AND t.current_assignee_id=? AND t.deleted_at IS NULL FOR UPDATE`,
      [ticketId, technicianId],
    );
    const ticket = tickets[0];
    if (ticket === undefined) {
      throw new AppError(404, 'TICKET_NOT_FOUND', 'The ticket is not assigned to you or no longer exists');
    }
    if (ticket.requesterStatus !== 'active') {
      throw new AppError(409, 'ACCOUNT_NOT_ACTIVE', 'A suspension request can only target an active account');
    }
    const [duplicates] = await connection.execute<Array<RowDataPacket & { id: number }>>(
      `SELECT id FROM account_suspension_cases
       WHERE target_user_id=? AND source_ticket_id=? AND status='pending' LIMIT 1`,
      [ticket.requesterId, ticketId],
    );
    if (duplicates[0] !== undefined) {
      throw new AppError(409, 'SUSPENSION_REQUEST_ALREADY_PENDING', 'This ticket already has a pending suspension request');
    }
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO account_suspension_cases
        (target_user_id,requested_by,source_ticket_id,origin,category,reason_summary,details)
       VALUES (?,?,?,'technician_request',?,?,?)`,
      [ticket.requesterId, technicianId, ticketId, input.category, input.reasonSummary, input.details],
    );
    await notifyManagers(connection, result.insertId, ticket.requesterName);
    await writeAudit(connection, {
      actorId: technicianId,
      action: 'account.suspension.requested',
      entityType: 'account_suspension_case',
      entityId: String(result.insertId),
      context,
      metadata: { targetUserId: ticket.requesterId, ticketId, category: input.category },
    });
    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listSuspensionCases(
  actor: { id: number; role: UserRole },
  status?: SuspensionCaseStatus,
): Promise<SuspensionCaseRow[]> {
  const conditions: string[] = [];
  const values: Array<string | number> = [];
  if (actor.role === 'technician') {
    conditions.push('suspension.requested_by=?');
    values.push(actor.id);
  }
  if (status !== undefined) {
    conditions.push('suspension.status=?');
    values.push(status);
  }
  const where = conditions.length === 0 ? '' : ` WHERE ${conditions.join(' AND ')}`;
  const [rows] = await databasePool.execute<SuspensionCaseRow[]>(
    `${caseSelect}${where}
     ORDER BY FIELD(suspension.status,'pending','approved','rejected'),suspension.created_at DESC`,
    values,
  );
  return rows;
}

export async function listRequesterOptions(search?: string): Promise<RequesterOptionRow[]> {
  const searchCondition = search === undefined ? '' : `AND (u.display_name LIKE ? OR
    consumer.reference_number LIKE ? OR employee.employee_id LIKE ?)`;
  const values = search === undefined ? [] : [`%${search}%`, `%${search}%`, `%${search}%`];
  const [rows] = await databasePool.execute<RequesterOptionRow[]>(
    `SELECT u.id,u.display_name AS displayName,role.name AS role,u.status,
       COALESCE(consumer.reference_number,employee.employee_id,CONCAT('#',u.id)) AS identifier
     FROM users u JOIN roles role ON role.id=u.role_id
     LEFT JOIN consumer_profiles consumer ON consumer.user_id=u.id
     LEFT JOIN employee_profiles employee ON employee.user_id=u.id
     WHERE role.name IN ('consumer','employee') AND u.deleted_at IS NULL ${searchCondition}
     ORDER BY u.display_name LIMIT 50`,
    values,
  );
  return rows;
}

export async function directlySuspendRequester(
  actor: { id: number; role: UserRole },
  targetUserId: number,
  input: SuspensionCaseInput,
  context: RequestContext,
): Promise<number> {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const target = await targetRequester(connection, targetUserId);
    await suspendTarget(connection, target, input.reasonSummary);
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO account_suspension_cases
        (target_user_id,requested_by,origin,category,reason_summary,details,status,
         reviewed_by,decision_notes,reviewed_at)
       VALUES (?,?,'manager_direct',?,?,?,'approved',?,'Direct suspension recorded by manager',UTC_TIMESTAMP())`,
      [target.id, actor.id, input.category, input.reasonSummary, input.details, actor.id],
    );
    await writeAudit(connection, {
      actorId: actor.id,
      action: 'account.suspended.direct',
      entityType: 'user',
      entityId: String(target.id),
      context,
      metadata: {
        caseId: result.insertId,
        category: input.category,
        details: input.details,
        before: { status: target.status },
        after: { status: 'suspended', reasonSummary: input.reasonSummary },
      },
    });
    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function reviewTechnicianRequest(
  actor: { id: number; role: UserRole },
  caseId: number,
  decision: 'approved' | 'rejected',
  decisionNotes: string,
  context: RequestContext,
): Promise<void> {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [cases] = await connection.execute<CaseTargetRow[]>(
      `SELECT suspension.id,suspension.target_user_id AS targetUserId,
        suspension.requested_by AS requestedBy,suspension.status,target.display_name AS targetName,
        suspension.reason_summary AS reasonSummary
       FROM account_suspension_cases suspension JOIN users target ON target.id=suspension.target_user_id
       WHERE suspension.id=? AND suspension.origin='technician_request' FOR UPDATE`,
      [caseId],
    );
    const suspensionCase = cases[0];
    if (suspensionCase === undefined) throw new AppError(404, 'SUSPENSION_CASE_NOT_FOUND', 'The suspension request was not found');
    if (suspensionCase.status !== 'pending') {
      throw new AppError(409, 'SUSPENSION_CASE_ALREADY_REVIEWED', 'This suspension request has already been reviewed');
    }
    const target = await targetRequester(connection, suspensionCase.targetUserId);
    if (decision === 'approved') await suspendTarget(connection, target, suspensionCase.reasonSummary);
    await connection.execute(
      `UPDATE account_suspension_cases SET status=?,reviewed_by=?,decision_notes=?,reviewed_at=UTC_TIMESTAMP()
       WHERE id=?`,
      [decision, actor.id, decisionNotes, caseId],
    );
    await connection.execute(
      `INSERT INTO notifications (recipient_id,type,title,message,target_type,target_id)
       VALUES (?,'suspension_request_reviewed','Suspension request reviewed',?,'suspension_case',?)`,
      [suspensionCase.requestedBy,
        `${suspensionCase.targetName}'s suspension request was ${decision}.`, caseId],
    );
    await writeAudit(connection, {
      actorId: actor.id,
      action: `account.suspension_request.${decision}`,
      entityType: 'account_suspension_case',
      entityId: String(caseId),
      context,
      metadata: {
        targetUserId: target.id,
        decisionNotes,
        before: { status: 'pending', targetStatus: target.status },
        after: { status: decision, targetStatus: decision === 'approved' ? 'suspended' : target.status },
      },
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function reactivateRequester(
  actor: { id: number; role: UserRole },
  targetUserId: number,
  reason: string,
  context: RequestContext,
): Promise<void> {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const target = await targetRequester(connection, targetUserId);
    if (target.status !== 'suspended') {
      throw new AppError(409, 'ACCOUNT_NOT_SUSPENDED', 'Only a suspended requester account can be reactivated');
    }
    await connection.execute(
      `UPDATE users SET status='active',status_reason=? WHERE id=?`,
      [`Reactivated: ${reason}`.slice(0, 500), target.id],
    );
    await writeAudit(connection, {
      actorId: actor.id,
      action: 'account.reactivated',
      entityType: 'user',
      entityId: String(target.id),
      context,
      metadata: { before: { status: target.status }, after: { status: 'active', reason } },
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function currentSuspensionCase(userId: number): Promise<SuspensionCaseRow | null> {
  const [rows] = await databasePool.execute<SuspensionCaseRow[]>(
    `${caseSelect} WHERE suspension.target_user_id=? AND suspension.status='approved'
     ORDER BY suspension.reviewed_at DESC,suspension.id DESC LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}
