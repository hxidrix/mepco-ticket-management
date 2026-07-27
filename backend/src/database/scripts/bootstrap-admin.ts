import { randomUUID } from 'node:crypto';

import { hash } from 'bcryptjs';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { logger } from '../../config/logger.js';
import { closeDatabasePool, databasePool } from '../pool.js';

interface IdRow extends RowDataPacket {
  id: number;
}

interface CountRow extends RowDataPacket {
  count: number;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value === '') throw new Error(`${name} is required`);
  return value;
}

function validatePassword(password: string): void {
  const strong = password.length >= 10
    && password.length <= 128
    && /[a-z]/u.test(password)
    && /[A-Z]/u.test(password)
    && /[0-9]/u.test(password)
    && /[^A-Za-z0-9]/u.test(password);
  if (!strong) {
    throw new Error(
      'BOOTSTRAP_ADMIN_PASSWORD must be 10-128 characters and include upper, lower, number, and symbol',
    );
  }
}

try {
  const username = required('BOOTSTRAP_ADMIN_USERNAME');
  const displayName = required('BOOTSTRAP_ADMIN_NAME');
  const password = required('BOOTSTRAP_ADMIN_PASSWORD');

  if (!/^[a-zA-Z0-9._-]{3,80}$/u.test(username)) {
    throw new Error('BOOTSTRAP_ADMIN_USERNAME must be 3-80 letters, numbers, dots, dashes, or underscores');
  }
  if (displayName.length < 2 || displayName.length > 140) {
    throw new Error('BOOTSTRAP_ADMIN_NAME must be 2-140 characters');
  }
  validatePassword(password);

  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [roleRows] = await connection.execute<IdRow[]>(
      "SELECT id FROM roles WHERE name = 'administrator' AND is_active = TRUE LIMIT 1",
    );
    const roleId = roleRows[0]?.id;
    if (roleId === undefined) throw new Error('Administrator role is missing; run db:seed first');

    const [administratorRows] = await connection.execute<CountRow[]>(
      `SELECT COUNT(*) AS count FROM users
       WHERE role_id = ? AND deleted_at IS NULL`,
      [roleId],
    );
    if ((administratorRows[0]?.count ?? 0) > 0) {
      throw new Error('An administrator already exists; use account management instead of bootstrapping again');
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO users
         (role_id, display_name, username, password_hash, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [roleId, displayName, username, await hash(password, 12)],
    );
    const userId = result.insertId;
    await connection.execute(
      `INSERT INTO staff_profiles
         (user_id, department_id, designation, work_location, circle_id, division_id, subdivision_id)
       VALUES (?, NULL, 'System Administrator', 'Not assigned', NULL, NULL, NULL)`,
      [userId],
    );
    await connection.execute(
      `INSERT INTO audit_logs
         (actor_id, action, entity_type, entity_id, result, request_id, metadata)
       VALUES (?, 'admin.bootstrap.created', 'user', ?, 'success', ?, ?)`,
      [
        userId,
        String(userId),
        randomUUID(),
        JSON.stringify({ username, source: 'secure-bootstrap' }),
      ],
    );
    await connection.commit();
    logger.info({ userId, username }, 'Initial administrator created');
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
} catch (error) {
  logger.error({ err: error }, 'Administrator bootstrap failed');
  process.exitCode = 1;
} finally {
  await closeDatabasePool();
}
