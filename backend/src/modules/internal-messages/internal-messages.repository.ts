import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';

import { databasePool } from '../../database/pool.js';
import { AppError } from '../../shared/app-error.js';
import { writeAudit } from '../../shared/audit.js';
import type { AuthenticatedUser, RequestContext } from '../auth/auth.types.js';
import type {
  MessageRecipientRow,
  MessageRow,
  MessageThreadRow,
  ThreadParticipantRow,
} from './internal-messages.types.js';

async function getParticipantThread(
  connection: PoolConnection,
  threadId: number,
  actorId: number,
  lock = false,
): Promise<ThreadParticipantRow> {
  const [rows] = await connection.execute<ThreadParticipantRow[]>(
    `SELECT thread.id,thread.subject,thread.technician_id AS technicianId,
       technician.display_name AS technicianName,thread.manager_id AS managerId,
       manager.display_name AS managerName,manager_role.name AS managerRole,
       thread.last_message_id AS lastMessageId,thread.last_message_at AS lastMessageAt,
       thread.created_at AS createdAt
     FROM internal_message_threads thread
     JOIN users technician ON technician.id=thread.technician_id
     JOIN users manager ON manager.id=thread.manager_id
     JOIN roles manager_role ON manager_role.id=manager.role_id
     WHERE thread.id=? AND (thread.technician_id=? OR thread.manager_id=?)
     ${lock ? 'FOR UPDATE' : ''}`,
    [threadId, actorId, actorId],
  );
  const thread = rows[0];
  if (thread === undefined) {
    throw new AppError(404, 'MESSAGE_THREAD_NOT_FOUND', 'The message thread was not found');
  }
  return thread;
}

async function createNotification(
  connection: PoolConnection,
  recipientId: number,
  senderName: string,
  subject: string,
  threadId: number,
): Promise<void> {
  await connection.execute(
    `INSERT INTO notifications (recipient_id,type,title,message,target_type,target_id)
     VALUES (?,'internal_message','New internal message',?,'internal_message_thread',?)`,
    [recipientId, `${senderName} sent a message about “${subject}”.`, threadId],
  );
}

export async function listMessageRecipients(actor: AuthenticatedUser): Promise<MessageRecipientRow[]> {
  const [rows] = await databasePool.execute<MessageRecipientRow[]>(
    `SELECT user.id,user.display_name AS displayName,role.name AS role
     FROM users user JOIN roles role ON role.id=user.role_id
     WHERE (
       (?='technician' AND role.name IN ('supervisor','administrator'))
       OR (? IN ('supervisor','administrator') AND role.name='technician')
     )
       AND user.status='active' AND user.deleted_at IS NULL
     ORDER BY FIELD(role.name,'technician','supervisor','administrator'),user.display_name`,
    [actor.role, actor.role],
  );
  return rows;
}

export async function listMessageThreads(actor: AuthenticatedUser): Promise<MessageThreadRow[]> {
  const [rows] = await databasePool.execute<MessageThreadRow[]>(
    `SELECT thread.id,thread.subject,thread.technician_id AS technicianId,
       technician.display_name AS technicianName,thread.manager_id AS managerId,
       manager.display_name AS managerName,manager_role.name AS managerRole,
       LEFT(last_message.body,180) AS lastMessagePreview,
       thread.last_message_at AS lastMessageAt,thread.created_at AS createdAt,
       (SELECT COUNT(*) FROM internal_messages unread
        WHERE unread.thread_id=thread.id AND unread.sender_id<>?
          AND unread.id>COALESCE(
            IF(thread.technician_id=?,thread.technician_last_read_message_id,
              thread.manager_last_read_message_id),0
          )) AS unreadCount
     FROM internal_message_threads thread
     JOIN users technician ON technician.id=thread.technician_id
     JOIN users manager ON manager.id=thread.manager_id
     JOIN roles manager_role ON manager_role.id=manager.role_id
     JOIN internal_messages last_message ON last_message.id=thread.last_message_id
     WHERE thread.technician_id=? OR thread.manager_id=?
     ORDER BY thread.last_message_at DESC,thread.id DESC`,
    [actor.id, actor.id, actor.id, actor.id],
  );
  return rows;
}

export async function createMessageThread(
  actor: AuthenticatedUser,
  recipientId: number,
  subject: string,
  message: string,
  context: RequestContext,
): Promise<number> {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [recipients] = await connection.execute<MessageRecipientRow[]>(
      `SELECT user.id,user.display_name AS displayName,role.name AS role
       FROM users user JOIN roles role ON role.id=user.role_id
       WHERE user.id=? AND role.name IN ('technician','supervisor','administrator')
         AND user.status='active' AND user.deleted_at IS NULL FOR UPDATE`,
      [recipientId],
    );
    const recipient = recipients[0];
    const actorIsTechnician = actor.role === 'technician';
    const validPair = recipient !== undefined && (
      (actorIsTechnician && ['supervisor', 'administrator'].includes(recipient.role))
      || (!actorIsTechnician && recipient.role === 'technician')
    );
    if (!validPair || recipient === undefined) {
      const expectedRole = actorIsTechnician ? 'supervisor or administrator' : 'technician';
      throw new AppError(422, 'MESSAGE_RECIPIENT_INVALID', `Choose an active ${expectedRole}`);
    }
    const technicianId = actorIsTechnician ? actor.id : recipient.id;
    const managerId = actorIsTechnician ? recipient.id : actor.id;
    const [threadResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO internal_message_threads
        (technician_id,manager_id,subject,last_message_at)
       VALUES (?,?,?,UTC_TIMESTAMP())`,
      [technicianId, managerId, subject],
    );
    const threadId = threadResult.insertId;
    const [messageResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO internal_messages (thread_id,sender_id,body) VALUES (?,?,?)`,
      [threadId, actor.id, message],
    );
    const readColumn = actorIsTechnician
      ? 'technician_last_read_message_id'
      : 'manager_last_read_message_id';
    await connection.execute(
      `UPDATE internal_message_threads
       SET last_message_id=?,${readColumn}=? WHERE id=?`,
      [messageResult.insertId, messageResult.insertId, threadId],
    );
    await createNotification(connection, recipient.id, actor.displayName, subject, threadId);
    await writeAudit(connection, {
      actorId: actor.id,
      action: 'internal_message.thread.created',
      entityType: 'internal_message_thread',
      entityId: String(threadId),
      context,
      metadata: { recipientId: recipient.id, recipientRole: recipient.role, messageId: messageResult.insertId },
    });
    await connection.commit();
    return threadId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getMessageThread(
  actor: AuthenticatedUser,
  threadId: number,
): Promise<{ thread: ThreadParticipantRow; messages: MessageRow[] }> {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const thread = await getParticipantThread(connection, threadId, actor.id, true);
    const [messages] = await connection.execute<MessageRow[]>(
      `SELECT message.id,message.sender_id AS senderId,sender.display_name AS senderName,
         sender_role.name AS senderRole,message.body,message.created_at AS createdAt
       FROM internal_messages message
       JOIN users sender ON sender.id=message.sender_id
       JOIN roles sender_role ON sender_role.id=sender.role_id
       WHERE message.thread_id=? ORDER BY message.id`,
      [threadId],
    );
    const latestMessageId = messages.at(-1)?.id ?? null;
    if (latestMessageId !== null) {
      const readColumn = thread.technicianId === actor.id
        ? 'technician_last_read_message_id'
        : 'manager_last_read_message_id';
      await connection.execute(
        `UPDATE internal_message_threads SET ${readColumn}=? WHERE id=?`,
        [latestMessageId, threadId],
      );
    }
    await connection.commit();
    return { thread, messages };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function replyToMessageThread(
  actor: AuthenticatedUser,
  threadId: number,
  body: string,
  context: RequestContext,
): Promise<number> {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const thread = await getParticipantThread(connection, threadId, actor.id, true);
    const [messageResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO internal_messages (thread_id,sender_id,body) VALUES (?,?,?)`,
      [threadId, actor.id, body],
    );
    const actorIsTechnician = thread.technicianId === actor.id;
    const readColumn = actorIsTechnician
      ? 'technician_last_read_message_id'
      : 'manager_last_read_message_id';
    await connection.execute(
      `UPDATE internal_message_threads
       SET last_message_id=?,last_message_at=UTC_TIMESTAMP(),${readColumn}=? WHERE id=?`,
      [messageResult.insertId, messageResult.insertId, threadId],
    );
    const recipientId = actorIsTechnician ? thread.managerId : thread.technicianId;
    await createNotification(connection, recipientId, actor.displayName, thread.subject, threadId);
    await writeAudit(connection, {
      actorId: actor.id,
      action: 'internal_message.sent',
      entityType: 'internal_message_thread',
      entityId: String(threadId),
      context,
      metadata: { recipientId, messageId: messageResult.insertId },
    });
    await connection.commit();
    return messageResult.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
