import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { databasePool } from '../../database/pool.js';
import { AppError } from '../../shared/app-error.js';
import { writeAudit } from '../../shared/audit.js';
import type { RequestContext, UserRole } from '../auth/auth.types.js';
import type {
  AdminUserUpdateInput,
  ProfileUpdateInput,
  StaffCreateInput,
  UserProfile,
  UserStatus,
} from './users.types.js';

interface ProfileRow extends RowDataPacket {
  id: number;
  role: UserRole;
  displayName: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  statusReason: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  referenceNumber: string | null;
  address: string | null;
  circleId: number | null;
  circleName: string | null;
  cityId: number | null;
  cityName: string | null;
  serviceAddress: string | null;
  employeeId: string | null;
  departmentId: number | null;
  departmentName: string | null;
  designation: string | null;
  workLocation: string | null;
}

interface IdRow extends RowDataPacket { id: number }
interface PasswordRow extends RowDataPacket { passwordHash: string }
interface CountRow extends RowDataPacket { count: number }

function mapProfile(row: ProfileRow): UserProfile {
  const profile: UserProfile = {
    id: row.id,
    role: row.role,
    displayName: row.displayName,
    username: row.username,
    email: row.email,
    phone: row.phone,
    status: row.status,
    statusReason: row.statusReason,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
  };
  if (row.role === 'consumer') {
    Object.assign(profile, {
      referenceNumber: row.referenceNumber ?? '',
      address: row.address ?? '',
      circleId: row.circleId ?? 0,
      circleName: row.circleName ?? '',
      cityId: row.cityId ?? 0,
      cityName: row.cityName ?? '',
      serviceAddress: row.serviceAddress,
    });
  } else {
    if (row.role === 'employee') profile.employeeId = row.employeeId ?? '';
    Object.assign(profile, {
      departmentId: row.departmentId,
      departmentName: row.departmentName,
      designation: row.designation ?? '',
      workLocation: row.workLocation ?? '',
    });
  }
  return profile;
}

const profileSelect = `
  SELECT u.id, r.name AS role, u.display_name AS displayName, u.username, u.email, u.phone,
         u.status, u.status_reason AS statusReason, u.last_login_at AS lastLoginAt,
         u.created_at AS createdAt, cp.reference_number AS referenceNumber, cp.address,
         cp.circle_id AS circleId, c.name AS circleName, cp.city_id AS cityId,
         city.name AS cityName, cp.service_address AS serviceAddress,
         ep.employee_id AS employeeId,
         COALESCE(ep.department_id, sp.department_id) AS departmentId,
         d.name AS departmentName, COALESCE(ep.designation, sp.designation) AS designation,
         COALESCE(ep.work_location, sp.work_location) AS workLocation
  FROM users u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN consumer_profiles cp ON cp.user_id = u.id
  LEFT JOIN circles c ON c.id = cp.circle_id
  LEFT JOIN cities city ON city.id = cp.city_id
  LEFT JOIN employee_profiles ep ON ep.user_id = u.id
  LEFT JOIN staff_profiles sp ON sp.user_id = u.id
  LEFT JOIN departments d ON d.id = COALESCE(ep.department_id, sp.department_id)`;

async function activeDepartment(connection: PoolConnection, id: number | null): Promise<void> {
  if (id === null) return;
  const [rows] = await connection.execute<IdRow[]>(
    'SELECT id FROM departments WHERE id = ? AND is_active = TRUE',
    [id],
  );
  if (rows[0] === undefined) throw new AppError(422, 'INVALID_DEPARTMENT', 'The department is unavailable');
}

export async function findUserProfile(userId: number): Promise<UserProfile | null> {
  const [rows] = await databasePool.execute<ProfileRow[]>(
    `${profileSelect} WHERE u.id = ? AND u.deleted_at IS NULL LIMIT 1`,
    [userId],
  );
  return rows[0] === undefined ? null : mapProfile(rows[0]);
}

export async function updateUserProfile(
  userId: number,
  role: UserRole,
  input: ProfileUpdateInput,
  context: RequestContext,
): Promise<UserProfile> {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      'UPDATE users SET display_name = ?, email = ?, phone = ? WHERE id = ? AND deleted_at IS NULL',
      [input.displayName, input.email ?? null, input.phone ?? null, userId],
    );
    if (role === 'consumer') {
      if (input.circleId === undefined || input.cityId === undefined || input.address === undefined) {
        throw new AppError(422, 'PROFILE_FIELDS_REQUIRED', 'Consumer location and address are required');
      }
      const [cities] = await connection.execute<IdRow[]>(
        `SELECT id FROM cities WHERE id = ? AND circle_id = ? AND is_active = TRUE`,
        [input.cityId, input.circleId],
      );
      if (cities[0] === undefined) throw new AppError(422, 'INVALID_LOCATION', 'The selected city is invalid');
      await connection.execute(
        `UPDATE consumer_profiles SET address = ?, circle_id = ?, city_id = ?, service_address = ?
         WHERE user_id = ?`,
        [input.address, input.circleId, input.cityId, input.serviceAddress ?? null, userId],
      );
    } else {
      if (input.designation === undefined || input.workLocation === undefined) {
        throw new AppError(422, 'PROFILE_FIELDS_REQUIRED', 'Designation and work location are required');
      }
      await activeDepartment(connection, input.departmentId ?? null);
      const table = role === 'employee' ? 'employee_profiles' : 'staff_profiles';
      await connection.execute(
        `UPDATE ${table} SET department_id = ?, designation = ?, work_location = ? WHERE user_id = ?`,
        [input.departmentId ?? null, input.designation, input.workLocation, userId],
      );
    }
    await writeAudit(connection, {
      actorId: userId, action: 'profile.updated', entityType: 'user', entityId: String(userId), context,
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  const profile = await findUserProfile(userId);
  if (profile === null) throw new AppError(404, 'USER_NOT_FOUND', 'The user was not found');
  return profile;
}

export async function getPasswordHash(userId: number): Promise<string | null> {
  const [rows] = await databasePool.execute<PasswordRow[]>(
    'SELECT password_hash AS passwordHash FROM users WHERE id = ? AND deleted_at IS NULL',
    [userId],
  );
  return rows[0]?.passwordHash ?? null;
}

export async function savePassword(
  userId: number,
  passwordHash: string,
  actorId: number,
  action: string,
  context: RequestContext,
): Promise<void> {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE users SET password_hash = ?, password_changed_at = UTC_TIMESTAMP(),
         failed_login_count = 0, locked_until = NULL WHERE id = ? AND deleted_at IS NULL`,
      [passwordHash, userId],
    );
    if (result.affectedRows === 0) throw new AppError(404, 'USER_NOT_FOUND', 'The user was not found');
    await connection.execute(
      `UPDATE refresh_sessions SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP()),
         revoked_reason = COALESCE(revoked_reason, 'Password changed') WHERE user_id = ?`,
      [userId],
    );
    await writeAudit(connection, {
      actorId, action, entityType: 'user', entityId: String(userId), context,
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listUsers(input: {
  page: number;
  pageSize: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
}): Promise<{ items: UserProfile[]; totalItems: number }> {
  const conditions = ['u.deleted_at IS NULL'];
  const params: Array<string | number> = [];
  if (input.search !== undefined) {
    conditions.push(`(u.display_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?
      OR cp.reference_number LIKE ? OR ep.employee_id LIKE ?)`);
    const search = `%${input.search}%`;
    params.push(search, search, search, search, search);
  }
  if (input.role !== undefined) { conditions.push('r.name = ?'); params.push(input.role); }
  if (input.status !== undefined) { conditions.push('u.status = ?'); params.push(input.status); }
  const where = conditions.join(' AND ');
  const [counts] = await databasePool.execute<CountRow[]>(
    `SELECT COUNT(*) AS count FROM users u JOIN roles r ON r.id = u.role_id
     LEFT JOIN consumer_profiles cp ON cp.user_id = u.id
     LEFT JOIN employee_profiles ep ON ep.user_id = u.id WHERE ${where}`,
    params,
  );
  const offset = (input.page - 1) * input.pageSize;
  const [rows] = await databasePool.execute<ProfileRow[]>(
    `${profileSelect} WHERE ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    [...params, input.pageSize, offset],
  );
  return { items: rows.map(mapProfile), totalItems: counts[0]?.count ?? 0 };
}

export async function createStaffUser(
  input: StaffCreateInput,
  passwordHash: string,
  actorId: number,
  context: RequestContext,
): Promise<UserProfile> {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [roles] = await connection.execute<IdRow[]>(
      `SELECT id FROM roles WHERE name = ? AND is_active = TRUE`, [input.role],
    );
    const roleId = roles[0]?.id;
    if (roleId === undefined) throw new AppError(422, 'INVALID_ROLE', 'The selected role is unavailable');
    await activeDepartment(connection, input.departmentId ?? null);
    const [existing] = await connection.execute<IdRow[]>(
      'SELECT id FROM users WHERE username = ? LIMIT 1', [input.username],
    );
    if (existing[0] !== undefined) throw new AppError(409, 'USERNAME_EXISTS', 'This username is already in use');
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO users
         (role_id, display_name, username, email, phone, password_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [roleId, input.displayName, input.username, input.email ?? null, input.phone ?? null, passwordHash],
    );
    await connection.execute(
      `INSERT INTO staff_profiles (user_id, department_id, designation, work_location)
       VALUES (?, ?, ?, ?)`,
      [result.insertId, input.departmentId ?? null, input.designation, input.workLocation],
    );
    await writeAudit(connection, {
      actorId, action: 'admin.user.created', entityType: 'user', entityId: String(result.insertId),
      context, metadata: { role: input.role },
    });
    await connection.commit();
    const profile = await findUserProfile(result.insertId);
    if (profile === null) throw new Error('Created user could not be loaded');
    return profile;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateUserAsAdmin(
  targetId: number,
  actorId: number,
  input: AdminUserUpdateInput,
  context: RequestContext,
): Promise<UserProfile> {
  if (targetId === actorId && input.status !== 'active') {
    throw new AppError(409, 'SELF_STATUS_CHANGE_NOT_ALLOWED', 'You cannot deactivate your own account');
  }
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [targetRows] = await connection.execute<Array<RowDataPacket & { role: UserRole }>>(
      `SELECT r.name AS role FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? AND u.deleted_at IS NULL FOR UPDATE`, [targetId],
    );
    const currentRole = targetRows[0]?.role;
    if (currentRole === undefined) throw new AppError(404, 'USER_NOT_FOUND', 'The user was not found');
    let roleId: number | null = null;
    if (input.role !== undefined) {
      if (!['technician', 'supervisor', 'administrator'].includes(currentRole)) {
        throw new AppError(422, 'ROLE_CHANGE_NOT_ALLOWED', 'Requester account roles cannot be changed');
      }
      const [roles] = await connection.execute<IdRow[]>('SELECT id FROM roles WHERE name = ?', [input.role]);
      roleId = roles[0]?.id ?? null;
    }
    await activeDepartment(connection, input.departmentId ?? null);
    await connection.execute(
      `UPDATE users SET display_name = ?, email = ?, phone = ?, status = ?, status_reason = ?,
         role_id = COALESCE(?, role_id) WHERE id = ?`,
      [input.displayName, input.email ?? null, input.phone ?? null, input.status,
        input.statusReason ?? null, roleId, targetId],
    );
    if (['technician', 'supervisor', 'administrator'].includes(currentRole)) {
      await connection.execute(
        `UPDATE staff_profiles SET department_id = ?, designation = ?, work_location = ? WHERE user_id = ?`,
        [input.departmentId ?? null, input.designation ?? '', input.workLocation ?? '', targetId],
      );
    }
    if (input.status !== 'active') {
      await connection.execute(
        `UPDATE refresh_sessions SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP()),
           revoked_reason = COALESCE(revoked_reason, 'Account status changed') WHERE user_id = ?`,
        [targetId],
      );
    }
    await writeAudit(connection, {
      actorId, action: 'admin.user.updated', entityType: 'user', entityId: String(targetId),
      context, metadata: { status: input.status, role: input.role ?? currentRole },
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  const profile = await findUserProfile(targetId);
  if (profile === null) throw new AppError(404, 'USER_NOT_FOUND', 'The user was not found');
  return profile;
}

export async function softDeleteUser(
  targetId: number,
  actorId: number,
  context: RequestContext,
): Promise<void> {
  if (targetId === actorId) throw new AppError(409, 'SELF_DELETE_NOT_ALLOWED', 'You cannot delete your own account');
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE users SET status = 'inactive', status_reason = 'Soft-deleted by administrator',
         deleted_at = UTC_TIMESTAMP() WHERE id = ? AND deleted_at IS NULL`, [targetId],
    );
    if (result.affectedRows === 0) throw new AppError(404, 'USER_NOT_FOUND', 'The user was not found');
    await connection.execute(
      `UPDATE refresh_sessions SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP()),
         revoked_reason = COALESCE(revoked_reason, 'Account deleted') WHERE user_id = ?`, [targetId],
    );
    await writeAudit(connection, {
      actorId, action: 'admin.user.deleted', entityType: 'user', entityId: String(targetId), context,
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
