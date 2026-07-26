import type { RowDataPacket } from 'mysql2/promise';

import { logger } from '../../config/logger.js';
import { closeDatabasePool, databasePool } from '../pool.js';

interface IdRow extends RowDataPacket {
  id: number;
}

const usernames = ['tech.it', 'tech.ops', 'tech.csd', 'tech.inactive', 'supervisor.demo', 'admin.demo'];
const referenceNumbers = ['10000000000001', '10000000000099'];
const employeeIds = ['00000001'];
const seededTicketNumbers = Array.from({ length: 8 }, (_, index) =>
  `MEPCO-2026-${String(index + 1).padStart(6, '0')}`,
);

try {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [userRows] = await connection.query<IdRow[]>(
      `SELECT DISTINCT u.id
       FROM users u
       LEFT JOIN consumer_profiles cp ON cp.user_id = u.id
       LEFT JOIN employee_profiles ep ON ep.user_id = u.id
       WHERE u.username IN (?) OR cp.reference_number IN (?) OR ep.employee_id IN (?)`,
      [usernames, referenceNumbers, employeeIds],
    );
    const userIds = userRows.map((row) => row.id);

    if (userIds.length === 0) {
      await connection.rollback();
      logger.info('No legacy sample accounts were found');
    } else {
      const [ticketRows] = await connection.query<IdRow[]>(
        'SELECT id FROM tickets WHERE requester_id IN (?) OR ticket_number IN (?)',
        [userIds, seededTicketNumbers],
      );
      const ticketIds = ticketRows.map((row) => row.id);

      await connection.query('DELETE FROM account_support_requests WHERE user_id IN (?)', [userIds]);
      await connection.query(
        'UPDATE account_support_requests SET reviewed_by = NULL, reviewed_at = NULL WHERE reviewed_by IN (?)',
        [userIds],
      );
      await connection.query(
        `DELETE FROM account_suspension_cases
         WHERE target_user_id IN (?) OR requested_by IN (?) OR reviewed_by IN (?)${ticketIds.length > 0 ? ' OR source_ticket_id IN (?)' : ''}`,
        ticketIds.length > 0 ? [userIds, userIds, userIds, ticketIds] : [userIds, userIds, userIds],
      );
      await connection.query(
        'DELETE FROM internal_messages WHERE sender_id IN (?) OR thread_id IN (SELECT id FROM internal_message_threads WHERE technician_id IN (?) OR manager_id IN (?))',
        [userIds, userIds, userIds],
      );
      await connection.query(
        'DELETE FROM internal_message_threads WHERE technician_id IN (?) OR manager_id IN (?)',
        [userIds, userIds],
      );

      if (ticketIds.length > 0) {
        await connection.query('DELETE FROM ticket_reviews WHERE ticket_id IN (?) OR requester_id IN (?)', [ticketIds, userIds]);
        await connection.query('DELETE FROM attachments WHERE ticket_id IN (?) OR uploader_id IN (?)', [ticketIds, userIds]);
        await connection.query('DELETE FROM comments WHERE ticket_id IN (?) OR author_id IN (?)', [ticketIds, userIds]);
        await connection.query('DELETE FROM assignments WHERE ticket_id IN (?) OR technician_id IN (?) OR assigned_by IN (?)', [ticketIds, userIds, userIds]);
        await connection.query('DELETE FROM ticket_history WHERE ticket_id IN (?) OR actor_id IN (?)', [ticketIds, userIds]);
        await connection.query("DELETE FROM notifications WHERE target_type = 'ticket' AND target_id IN (?)", [ticketIds]);
        await connection.query('DELETE FROM tickets WHERE id IN (?)', [ticketIds]);
      }
      await connection.query('UPDATE tickets SET current_assignee_id = NULL WHERE current_assignee_id IN (?)', [userIds]);
      await connection.query('UPDATE tickets SET deleted_by = NULL WHERE deleted_by IN (?)', [userIds]);
      await connection.query('DELETE FROM assignments WHERE technician_id IN (?) OR assigned_by IN (?)', [userIds, userIds]);
      await connection.query('DELETE FROM comments WHERE author_id IN (?)', [userIds]);
      await connection.query('DELETE FROM attachments WHERE uploader_id IN (?)', [userIds]);
      await connection.query('DELETE FROM ticket_history WHERE actor_id IN (?)', [userIds]);
      await connection.query('DELETE FROM ticket_reviews WHERE requester_id IN (?)', [userIds]);
      await connection.query('DELETE FROM announcement_audiences WHERE announcement_id IN (SELECT id FROM announcements WHERE author_id IN (?))', [userIds]);
      await connection.query('DELETE FROM announcements WHERE author_id IN (?)', [userIds]);
      await connection.query("DELETE FROM audit_logs WHERE actor_id IN (?) OR (action = 'seed.completed' AND entity_id = 'development-demo')", [userIds]);
      await connection.query('DELETE FROM notifications WHERE recipient_id IN (?)', [userIds]);
      await connection.query('DELETE FROM refresh_sessions WHERE user_id IN (?)', [userIds]);
      await connection.query('DELETE FROM staff_scopes WHERE user_id IN (?)', [userIds]);
      await connection.query('DELETE FROM consumer_profiles WHERE user_id IN (?)', [userIds]);
      await connection.query('DELETE FROM employee_profiles WHERE user_id IN (?)', [userIds]);
      await connection.query('DELETE FROM staff_profiles WHERE user_id IN (?)', [userIds]);
      await connection.query('DELETE FROM users WHERE id IN (?)', [userIds]);
      await connection.commit();
      logger.info(
        { removedAccounts: userIds.length, removedTickets: ticketIds.length },
        'Legacy sample data removed',
      );
    }
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
} catch (error) {
  logger.error({ err: error }, 'Legacy sample data cleanup failed');
  process.exitCode = 1;
} finally {
  await closeDatabasePool();
}
