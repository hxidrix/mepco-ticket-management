import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { databasePool } from '../../database/pool.js';
import { AppError } from '../../shared/app-error.js';
import { writeAudit } from '../../shared/audit.js';
import type { RequestContext, UserRole } from '../auth/auth.types.js';

interface CountRow extends RowDataPacket { count: number }
interface IdRow extends RowDataPacket { id: number }
interface CategoryReferenceRow extends RowDataPacket { id: number; domain: 'consumer' | 'employee' }
interface AnnouncementRow extends RowDataPacket {
  id: number; title: string; body: string; authorName: string; startsAt: Date; endsAt: Date | null;
  isActive: number; audiences: string | null; createdAt: Date; updatedAt: Date;
}
interface AuditRow extends RowDataPacket {
  id: number; actorId: number | null; actorName: string | null; actorRole: string | null;
  action: string; entityType: string; entityId: string | null; result: string;
  requestId: string | null; ipAddress: string | null; beforeData: unknown; afterData: unknown;
  metadata: unknown; createdAt: Date;
}
interface ScopeRow extends RowDataPacket {
  id: number; userId: number; displayName: string; role: string; domain: string; departmentId: number | null;
  departmentName: string | null; categoryId: number | null; categoryName: string | null; circleId: number | null;
  circleName: string | null;
}

const announcementSelect = `SELECT a.id,a.title,a.body,u.display_name AS authorName,a.starts_at AS startsAt,
  a.ends_at AS endsAt,a.is_active AS isActive,GROUP_CONCAT(r.name ORDER BY r.id) AS audiences,
  a.created_at AS createdAt,a.updated_at AS updatedAt
  FROM announcements a JOIN users u ON u.id=a.author_id
  JOIN announcement_audiences aa ON aa.announcement_id=a.id JOIN roles r ON r.id=aa.role_id`;

function mapAnnouncement(row: AnnouncementRow) {
  return { ...row, audiences: row.audiences?.split(',') ?? [] };
}

export async function activeAnnouncements(role: UserRole) {
  const [rows] = await databasePool.execute<AnnouncementRow[]>(
    `${announcementSelect} WHERE a.is_active=TRUE AND a.starts_at<=UTC_TIMESTAMP()
     AND (a.ends_at IS NULL OR a.ends_at>=UTC_TIMESTAMP()) AND r.name=?
     GROUP BY a.id,u.display_name ORDER BY a.starts_at DESC`, [role],
  );
  return rows.map(mapAnnouncement);
}

export async function listAnnouncements() {
  const [rows] = await databasePool.execute<AnnouncementRow[]>(
    `${announcementSelect} GROUP BY a.id,u.display_name ORDER BY a.created_at DESC`,
  );
  return rows.map(mapAnnouncement);
}

async function audienceIds(connection: PoolConnection, roles: UserRole[]): Promise<number[]> {
  const placeholders = roles.map(() => '?').join(',');
  const [rows] = await connection.execute<IdRow[]>(`SELECT id FROM roles WHERE name IN (${placeholders})`, roles);
  if (rows.length !== roles.length) throw new AppError(422, 'INVALID_AUDIENCE', 'One or more announcement audiences are invalid');
  return rows.map((row) => row.id);
}

export async function saveAnnouncement(
  actorId: number, id: number | null,
  input: { title: string; body: string; startsAt: string; endsAt?: string; isActive: boolean; audiences: UserRole[] },
  context: RequestContext,
): Promise<number> {
  if (new Date(input.startsAt).getTime() >= new Date(input.endsAt ?? '9999-01-01').getTime()) {
    throw new AppError(422, 'INVALID_ANNOUNCEMENT_WINDOW', 'The end date must be later than the start date');
  }
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction(); const roles = [...new Set(input.audiences)];
    if (roles.length === 0) throw new AppError(422, 'AUDIENCE_REQUIRED', 'Select at least one audience');
    const roleIds = await audienceIds(connection, roles);
    let announcementId = id;
    if (id === null) {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO announcements (title,body,author_id,starts_at,ends_at,is_active) VALUES (?,?,?,?,?,?)`,
        [input.title, input.body, actorId, new Date(input.startsAt), input.endsAt === undefined ? null : new Date(input.endsAt), input.isActive],
      ); announcementId = result.insertId;
    } else {
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE announcements SET title=?,body=?,starts_at=?,ends_at=?,is_active=? WHERE id=?`,
        [input.title, input.body, new Date(input.startsAt), input.endsAt === undefined ? null : new Date(input.endsAt), input.isActive, id],
      );
      if (result.affectedRows === 0) throw new AppError(404, 'ANNOUNCEMENT_NOT_FOUND', 'The announcement was not found');
      await connection.execute('DELETE FROM announcement_audiences WHERE announcement_id=?', [id]);
    }
    for (const roleId of roleIds) await connection.execute(
      'INSERT INTO announcement_audiences (announcement_id,role_id) VALUES (?,?)', [announcementId, roleId],
    );
    await writeAudit(connection, { actorId, action: id === null ? 'admin.announcement.created' : 'admin.announcement.updated', entityType: 'announcement', entityId: String(announcementId), context });
    await connection.commit(); return announcementId!;
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

export async function deactivateAnnouncement(actorId: number, id: number, context: RequestContext): Promise<void> {
  const connection = await databasePool.getConnection();
  try { await connection.beginTransaction();
    const [result] = await connection.execute<ResultSetHeader>('UPDATE announcements SET is_active=FALSE WHERE id=?', [id]);
    if (result.affectedRows === 0) throw new AppError(404, 'ANNOUNCEMENT_NOT_FOUND', 'The announcement was not found');
    await writeAudit(connection, { actorId, action: 'admin.announcement.deactivated', entityType: 'announcement', entityId: String(id), context });
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

export async function listAuditLogs(input: { page: number; pageSize: number; search?: string; result?: string }) {
  const conditions = ['1=1']; const values: Array<string | number> = [];
  if (input.search !== undefined) {
    conditions.push(`(al.action LIKE ? OR al.entity_type LIKE ? OR al.entity_id LIKE ? OR u.display_name LIKE ?
      OR al.request_id LIKE ? OR al.ip_address LIKE ? OR CAST(al.metadata AS CHAR) LIKE ?)`);
    const q=`%${input.search}%`; values.push(q,q,q,q,q,q,q);
  }
  if (input.result !== undefined) { conditions.push('al.result=?'); values.push(input.result); }
  const where=conditions.join(' AND ');
  const [counts] = await databasePool.execute<CountRow[]>(`SELECT COUNT(*) AS count FROM audit_logs al LEFT JOIN users u ON u.id=al.actor_id WHERE ${where}`,values);
  const [rows] = await databasePool.execute<AuditRow[]>(
    `SELECT al.id,al.actor_id AS actorId,u.display_name AS actorName,r.name AS actorRole,al.action,
      al.entity_type AS entityType,al.entity_id AS entityId,al.result,al.request_id AS requestId,
      al.ip_address AS ipAddress,al.before_data AS beforeData,al.after_data AS afterData,
      al.metadata,al.created_at AS createdAt
     FROM audit_logs al LEFT JOIN users u ON u.id=al.actor_id LEFT JOIN roles r ON r.id=u.role_id WHERE ${where}
     ORDER BY al.created_at DESC,al.id DESC LIMIT ? OFFSET ?`, [...values,input.pageSize,(input.page-1)*input.pageSize],
  );
  return { items: rows, totalItems: counts[0]?.count ?? 0 };
}

export async function listStaffScopes(): Promise<ScopeRow[]> {
  const [rows] = await databasePool.execute<ScopeRow[]>(
    `SELECT ss.id,u.id AS userId,u.display_name AS displayName,r.name AS role,ss.domain,
      ss.department_id AS departmentId,d.name AS departmentName,ss.category_id AS categoryId,c.name AS categoryName,
      ss.circle_id AS circleId,ci.name AS circleName
     FROM staff_scopes ss JOIN users u ON u.id=ss.user_id JOIN roles r ON r.id=u.role_id
     LEFT JOIN departments d ON d.id=ss.department_id LEFT JOIN categories c ON c.id=ss.category_id
     LEFT JOIN circles ci ON ci.id=ss.circle_id ORDER BY u.display_name,ss.domain,ss.id`,
  ); return rows;
}

export async function replaceStaffScopes(
  actorId: number, userId: number,
  scopes: Array<{ domain: 'consumer' | 'employee'; departmentId?: number; categoryId?: number; circleId?: number }>,
  context: RequestContext,
): Promise<void> {
  const connection=await databasePool.getConnection();
  try { await connection.beginTransaction();
    const [users]=await connection.execute<IdRow[]>(`SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=? AND r.name IN ('technician','supervisor') AND u.deleted_at IS NULL`,[userId]);
    if (users[0]===undefined) throw new AppError(422,'INVALID_SCOPED_USER','Scopes can only be assigned to technicians and supervisors');
    await connection.execute('DELETE FROM staff_scopes WHERE user_id=?',[userId]);
    for (const scope of scopes) {
      if (scope.domain === 'consumer' && scope.departmentId !== undefined) throw new AppError(422,'INVALID_SCOPE','Consumer scopes cannot target an employee department');
      if (scope.domain === 'employee' && scope.circleId !== undefined) throw new AppError(422,'INVALID_SCOPE','Employee scopes cannot target a consumer circle');
      if (scope.departmentId !== undefined) {
        const [departments]=await connection.execute<IdRow[]>('SELECT id FROM departments WHERE id=? AND is_active=TRUE',[scope.departmentId]);
        if(departments[0]===undefined)throw new AppError(422,'INVALID_SCOPE','The selected department is unavailable');
      }
      if (scope.circleId !== undefined) {
        const [circles]=await connection.execute<IdRow[]>('SELECT id FROM circles WHERE id=? AND is_active=TRUE',[scope.circleId]);
        if(circles[0]===undefined)throw new AppError(422,'INVALID_SCOPE','The selected circle is unavailable');
      }
      if (scope.categoryId !== undefined) {
        const [categories]=await connection.execute<CategoryReferenceRow[]>('SELECT id,domain FROM categories WHERE id=? AND is_active=TRUE',[scope.categoryId]);
        if(categories[0]===undefined||categories[0].domain!==scope.domain)throw new AppError(422,'INVALID_SCOPE','The category does not match the scope domain');
      }
      await connection.execute(
        `INSERT INTO staff_scopes (user_id,domain,department_id,category_id,circle_id,can_self_assign) VALUES (?,?,?,?,?,FALSE)`,
        [userId,scope.domain,scope.departmentId ?? null,scope.categoryId ?? null,scope.circleId ?? null],
      );
    }
    await writeAudit(connection,{ actorId,action:'admin.staff_scopes.replaced',entityType:'user',entityId:String(userId),context,metadata:{ count:scopes.length } });
    await connection.commit();
  } catch(error){ await connection.rollback(); throw error; } finally { connection.release(); }
}
