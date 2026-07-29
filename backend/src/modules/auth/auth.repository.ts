import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

import { databasePool } from '../../database/pool.js';
import { AppError } from '../../shared/app-error.js';
import type {
  AuthenticatedUser,
  EmployeeVerificationCandidate,
  LoginCandidate,
  LoginMode,
  NewRefreshSession,
  RefreshSessionRecord,
  RequestContext,
  UserRole,
} from './auth.types.js';

interface LoginRow extends RowDataPacket {
  id: number;
  role: UserRole;
  displayName: string;
  passwordHash: string;
  status: 'active' | 'suspended' | 'inactive';
  lockedUntil: Date | null;
}

interface SessionRow extends RowDataPacket {
  id: string;
  familyId: string;
  userId: number;
  role: UserRole;
  displayName: string;
  status: 'active' | 'suspended' | 'inactive';
  expiresAt: Date;
  revokedAt: Date | null;
}

async function writeAudit(
  connection: PoolConnection,
  actorId: number | null,
  action: string,
  entityType: string,
  entityId: string | null,
  result: 'success' | 'failure',
  context: RequestContext,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await connection.execute(
    `INSERT INTO audit_logs
       (actor_id, action, entity_type, entity_id, result, request_id, ip_address, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      actorId,
      action,
      entityType,
      entityId,
      result,
      context.requestId,
      context.ipAddress,
      metadata === undefined ? null : JSON.stringify(metadata),
    ],
  );
}

export async function findLoginCandidate(
  mode: LoginMode,
  identifier: string,
): Promise<LoginCandidate | null> {
  if (mode !== 'staff') return null;

  const [rows] = await databasePool.execute<LoginRow[]>(
    `SELECT u.id, r.name AS role, u.display_name AS displayName,
            u.password_hash AS passwordHash, u.status, u.locked_until AS lockedUntil
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.username = ? AND r.name IN ('technician', 'supervisor', 'administrator')
       AND u.deleted_at IS NULL
     LIMIT 1`,
    [identifier],
  );
  return rows[0] ?? null;
}
export async function findEmployeeVerificationCandidate(
  employeeId: string,
): Promise<EmployeeVerificationCandidate | null> {
  const [rows] = await databasePool.execute<Array<RowDataPacket & EmployeeVerificationCandidate>>(
    `SELECT u.id, r.name AS role, u.display_name AS displayName,
            u.password_hash AS passwordHash, u.status, u.locked_until AS lockedUntil,
            profile.employee_id AS employeeId, u.cnic, u.email, u.phone,
            department.name AS departmentName,
            profile.work_location AS office
     FROM users u
     JOIN roles r ON r.id = u.role_id AND r.name = 'employee'
     JOIN employee_profiles profile ON profile.user_id = u.id
     JOIN departments department ON department.id = profile.department_id
     WHERE profile.employee_id = ? AND u.deleted_at IS NULL
     LIMIT 1`,
    [employeeId],
  );
  return rows[0] ?? null;
}

export async function recordLoginFailure(
  candidate: LoginCandidate | null,
  identifier: string,
  mode: LoginMode,
  context: RequestContext,
): Promise<void> {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    if (candidate !== null) {
      await connection.execute(
        `UPDATE users
         SET failed_login_count = failed_login_count + 1,
             locked_until = CASE
               WHEN failed_login_count + 1 >= 5 THEN DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)
               ELSE locked_until
             END
         WHERE id = ?`,
        [candidate.id],
      );
    }
    await writeAudit(
      connection,
      candidate?.id ?? null,
      'auth.login.failed',
      'user',
      candidate === null ? null : String(candidate.id),
      'failure',
      context,
      { mode, identifierSuffix: identifier.slice(-4) },
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
export async function recordLoginSuccess(
  user: AuthenticatedUser,
  session: NewRefreshSession,
  context: RequestContext,
): Promise<void> {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE users
       SET failed_login_count = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [user.id],
    );
    await connection.execute(
      `INSERT INTO refresh_sessions
         (id, family_id, user_id, token_jti_hash, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.familyId,
        session.userId,
        session.tokenJtiHash,
        session.expiresAt,
        context.ipAddress,
        context.userAgent,
      ],
    );
    await writeAudit(
      connection,
      user.id,
      'auth.login.succeeded',
      'refresh_session',
      session.id,
      'success',
      context,
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function rotateRefreshSession(
  currentJtiHash: string,
  expectedUserId: number,
  expectedFamilyId: string,
  next: NewRefreshSession,
  context: RequestContext,
): Promise<RefreshSessionRecord> {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<SessionRow[]>(
      `SELECT s.id, s.family_id AS familyId, s.user_id AS userId,
              s.expires_at AS expiresAt, s.revoked_at AS revokedAt,
              u.display_name AS displayName, u.status, r.name AS role
       FROM refresh_sessions s
       JOIN users u ON u.id = s.user_id
       JOIN roles r ON r.id = u.role_id
       WHERE s.token_jti_hash = ?
       FOR UPDATE`,
      [currentJtiHash],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'The refresh session is invalid or expired');
    }
    if (row.userId !== expectedUserId || row.familyId !== expectedFamilyId) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'The refresh session is invalid or expired');
    }
    if (row.revokedAt !== null) {
      await connection.execute(
        `UPDATE refresh_sessions
         SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP()),
             revoked_reason = COALESCE(revoked_reason, 'Refresh token reuse detected')
         WHERE family_id = ?`,
        [row.familyId],
      );
      await writeAudit(
        connection,
        row.userId,
        'auth.refresh.reuse_detected',
        'refresh_session',
        row.id,
        'failure',
        context,
      );
      await connection.commit();
      throw new AppError(
        401,
        'REFRESH_TOKEN_REUSE_DETECTED',
        'This refresh-token family has been revoked',
      );
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'The refresh session is invalid or expired');
    }
    if (row.status === 'inactive') {
      throw new AppError(403, 'ACCOUNT_NOT_ACTIVE', 'This account is not active');
    }

    await connection.execute(
      `UPDATE refresh_sessions
       SET revoked_at = UTC_TIMESTAMP(), revoked_reason = 'Rotated', replaced_by_session_id = ?
       WHERE id = ?`,
      [next.id, row.id],
    );
    await connection.execute(
      `INSERT INTO refresh_sessions
         (id, family_id, user_id, token_jti_hash, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        next.id,
        row.familyId,
        row.userId,
        next.tokenJtiHash,
        next.expiresAt,
        context.ipAddress,
        context.userAgent,
      ],
    );
    await writeAudit(
      connection,
      row.userId,
      'auth.refresh.rotated',
      'refresh_session',
      next.id,
      'success',
      context,
    );
    await connection.commit();
    return {
      id: row.id,
      familyId: row.familyId,
      user: { id: row.userId, role: row.role, displayName: row.displayName, status: row.status },
      status: row.status,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function revokeRefreshSession(
  jtiHash: string,
  context: RequestContext,
): Promise<void> {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<Array<RowDataPacket & { id: string; userId: number }>>(
      'SELECT id, user_id AS userId FROM refresh_sessions WHERE token_jti_hash = ? FOR UPDATE',
      [jtiHash],
    );
    const row = rows[0];
    if (row !== undefined) {
      await connection.execute(
        `UPDATE refresh_sessions
         SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP()),
             revoked_reason = COALESCE(revoked_reason, 'Logout')
         WHERE id = ?`,
        [row.id],
      );
      await writeAudit(
        connection,
        row.userId,
        'auth.logout',
        'refresh_session',
        row.id,
        'success',
        context,
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
