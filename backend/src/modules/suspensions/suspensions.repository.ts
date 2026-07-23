import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { databasePool } from '../../database/pool.js';
import { AppError } from '../../shared/app-error.js';
import type { RequestContext } from '../auth/auth.types.js';
import { currentSuspensionCase } from '../account-governance/account-governance.repository.js';

export type SuspensionRequestType = 'appeal' | 'support';
export type SuspensionRequestStatus = 'submitted' | 'under-review' | 'approved' | 'rejected' | 'resolved';
export type ContactPreference = 'portal' | 'email' | 'phone';

interface SuspensionAccountRow extends RowDataPacket {
  id: number;
  displayName: string;
  email: string | null;
  phone: string | null;
  status: 'active' | 'suspended' | 'inactive';
  statusReason: string | null;
  statusUpdatedAt: Date;
}

interface SupportRequestRow extends RowDataPacket {
  id: number;
  userId: number;
  displayName: string;
  role: string;
  requestType: SuspensionRequestType;
  message: string;
  contactPreference: ContactPreference;
  status: SuspensionRequestStatus;
  adminResponse: string | null;
  reviewerName: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  suspensionReason: string | null;
}

interface ReviewTargetRow extends RowDataPacket {
  id: number;
  userId: number;
  requestType: SuspensionRequestType;
  status: SuspensionRequestStatus;
}

async function writeAudit(
  connection: PoolConnection,
  input: {
    actorId: number;
    action: string;
    entityId: string;
    context: RequestContext;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await connection.execute(
    `INSERT INTO audit_logs
       (actor_id, action, entity_type, entity_id, result, request_id, ip_address, metadata)
     VALUES (?, ?, 'account_support_request', ?, 'success', ?, ?, ?)`,
    [input.actorId, input.action, input.entityId, input.context.requestId, input.context.ipAddress,
      input.metadata === undefined ? null : JSON.stringify(input.metadata)],
  );
}

const requestSelect = `SELECT request.id,request.user_id AS userId,u.display_name AS displayName,
  role.name AS role,request.request_type AS requestType,request.message,
  request.contact_preference AS contactPreference,request.status,
  request.admin_response AS adminResponse,reviewer.display_name AS reviewerName,
  request.reviewed_at AS reviewedAt,request.created_at AS createdAt,
  request.updated_at AS updatedAt,u.status_reason AS suspensionReason
  FROM account_support_requests request
  JOIN users u ON u.id=request.user_id
  JOIN roles role ON role.id=u.role_id
  LEFT JOIN users reviewer ON reviewer.id=request.reviewed_by`;

export async function suspensionPortal(userId: number) {
  const [accounts] = await databasePool.execute<SuspensionAccountRow[]>(
    `SELECT id,display_name AS displayName,email,phone,status,status_reason AS statusReason,
       updated_at AS statusUpdatedAt FROM users WHERE id=? AND deleted_at IS NULL`, [userId],
  );
  const account = accounts[0];
  if (account === undefined) throw new AppError(404, 'USER_NOT_FOUND', 'The account was not found');
  if (account.status !== 'suspended') {
    throw new AppError(403, 'ACCOUNT_NOT_SUSPENDED', 'This portal is only available to suspended accounts');
  }
  const [requests] = await databasePool.execute<SupportRequestRow[]>(
    `${requestSelect} WHERE request.user_id=? ORDER BY request.created_at DESC`, [userId],
  );
  return { account, suspensionCase: await currentSuspensionCase(userId), requests };
}

export async function createSuspensionRequest(
  userId: number,
  input: { requestType: SuspensionRequestType; message: string; contactPreference: ContactPreference },
  context: RequestContext,
): Promise<number> {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [accounts] = await connection.execute<Array<RowDataPacket & {
      status: string;
      displayName: string;
      email: string | null;
      phone: string | null;
    }>>(
      'SELECT status,display_name AS displayName,email,phone FROM users WHERE id=? AND deleted_at IS NULL FOR UPDATE', [userId],
    );
    const account = accounts[0];
    if (account?.status !== 'suspended') {
      throw new AppError(403, 'ACCOUNT_NOT_SUSPENDED', 'This portal is only available to suspended accounts');
    }
    if (input.contactPreference === 'email' && account.email === null) {
      throw new AppError(422, 'CONTACT_METHOD_UNAVAILABLE', 'This account has no registered email address');
    }
    if (input.contactPreference === 'phone' && account.phone === null) {
      throw new AppError(422, 'CONTACT_METHOD_UNAVAILABLE', 'This account has no registered phone number');
    }
    if (input.requestType === 'appeal') {
      const [openAppeals] = await connection.execute<Array<RowDataPacket & { id: number }>>(
        `SELECT id FROM account_support_requests
         WHERE user_id=? AND request_type='appeal' AND status IN ('submitted','under-review') LIMIT 1`, [userId],
      );
      if (openAppeals[0] !== undefined) {
        throw new AppError(409, 'APPEAL_ALREADY_OPEN', 'You already have an appeal awaiting review');
      }
    }
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO account_support_requests (user_id,request_type,message,contact_preference)
       VALUES (?,?,?,?)`, [userId, input.requestType, input.message, input.contactPreference],
    );
    await connection.execute(
      `INSERT INTO notifications (recipient_id,type,title,message,target_type,target_id)
       SELECT u.id,'suspension_support_submitted',?,?,'support_request',?
       FROM users u JOIN roles role ON role.id=u.role_id
       WHERE role.name IN ('supervisor','administrator') AND u.status='active' AND u.deleted_at IS NULL`,
      [
        input.requestType === 'appeal' ? 'Suspension appeal submitted' : 'Account support request submitted',
        `${account.displayName} submitted a suspension ${input.requestType}.`,
        result.insertId,
      ],
    );
    await writeAudit(connection, {
      actorId: userId,
      action: 'account.suspension_request.created',
      entityId: String(result.insertId),
      context,
      metadata: { requestType: input.requestType, contactPreference: input.contactPreference },
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

export async function listSuspensionRequests(status?: SuspensionRequestStatus): Promise<SupportRequestRow[]> {
  const where = status === undefined ? '' : ' WHERE request.status=?';
  const values = status === undefined ? [] : [status];
  const [rows] = await databasePool.execute<SupportRequestRow[]>(
    `${requestSelect}${where} ORDER BY FIELD(request.status,'submitted','under-review','approved','rejected','resolved'),request.created_at`,
    values,
  );
  return rows;
}

export async function reviewSuspensionRequest(
  reviewerId: number,
  requestId: number,
  input: { status: Exclude<SuspensionRequestStatus, 'submitted'>; response: string },
  context: RequestContext,
): Promise<void> {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [requests] = await connection.execute<ReviewTargetRow[]>(
      `SELECT id,user_id AS userId,request_type AS requestType,status
       FROM account_support_requests WHERE id=? FOR UPDATE`, [requestId],
    );
    const target = requests[0];
    if (target === undefined) throw new AppError(404, 'SUPPORT_REQUEST_NOT_FOUND', 'The request was not found');
    if (input.status === 'approved' && target.requestType !== 'appeal') {
      throw new AppError(422, 'INVALID_SUPPORT_DECISION', 'Only suspension appeals can be approved');
    }
    await connection.execute(
      `UPDATE account_support_requests SET status=?,admin_response=?,reviewed_by=?,reviewed_at=UTC_TIMESTAMP()
       WHERE id=?`, [input.status, input.response, reviewerId, requestId],
    );
    if (input.status === 'approved') {
      await connection.execute(
        `UPDATE users SET status='active',status_reason=? WHERE id=? AND status='suspended'`,
        [`Appeal approved: ${input.response}`.slice(0, 500), target.userId],
      );
    }
    await writeAudit(connection, {
      actorId: reviewerId,
      action: 'account.suspension_request.reviewed',
      entityId: String(requestId),
      context,
      metadata: { status: input.status, userId: target.userId, requestType: target.requestType },
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
