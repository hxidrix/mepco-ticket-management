import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { databasePool } from '../../database/pool.js';
import { AppError } from '../../shared/app-error.js';
import { sqlPagination } from '../../shared/sql-pagination.js';

interface NotificationRow extends RowDataPacket {
  id: number; type: string; title: string; message: string; targetType: string | null;
  targetId: number | null; readAt: Date | null; createdAt: Date;
}
interface CountRow extends RowDataPacket { count: number }

export async function listNotifications(userId: number, page: number, pageSize: number, unreadOnly: boolean) {
  const unreadFilter = unreadOnly ? 'AND read_at IS NULL' : '';
  const [rows] = await databasePool.execute<NotificationRow[]>(
    `SELECT id, type, title, message, target_type AS targetType, target_id AS targetId,
      read_at AS readAt, created_at AS createdAt
     FROM notifications WHERE recipient_id=? ${unreadFilter}
     ORDER BY created_at DESC, id DESC ${sqlPagination(page, pageSize)}`,
    [userId],
  );
  const [totals] = await databasePool.execute<CountRow[]>(
    `SELECT COUNT(*) AS count FROM notifications WHERE recipient_id=? ${unreadFilter}`, [userId],
  );
  const [unread] = await databasePool.execute<CountRow[]>(
    `SELECT COUNT(*) AS count FROM notifications WHERE recipient_id=? AND read_at IS NULL`, [userId],
  );
  return { items: rows, totalItems: totals[0]?.count ?? 0, unreadCount: unread[0]?.count ?? 0 };
}

export async function markNotificationRead(userId: number, notificationId: number): Promise<void> {
  const [result] = await databasePool.execute<ResultSetHeader>(
    `UPDATE notifications SET read_at=COALESCE(read_at, UTC_TIMESTAMP()) WHERE id=? AND recipient_id=?`,
    [notificationId, userId],
  );
  if (result.affectedRows === 0) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'The notification was not found');
}

export async function markAllNotificationsRead(userId: number): Promise<number> {
  const [result] = await databasePool.execute<ResultSetHeader>(
    `UPDATE notifications SET read_at=UTC_TIMESTAMP() WHERE recipient_id=? AND read_at IS NULL`, [userId],
  );
  return result.affectedRows;
}
