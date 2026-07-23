import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { databasePool } from '../../database/pool.js';
import { AppError } from '../../shared/app-error.js';
import { writeAudit } from '../../shared/audit.js';
import type { RequestContext } from '../auth/auth.types.js';

export type MasterResource =
  | 'departments' | 'circles' | 'divisions' | 'subdivisions' | 'categories' | 'complaint-types'
  | 'priorities' | 'statuses';

type SqlValue = string | number | boolean | null;
interface MasterRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  isActive: number;
  sortOrder: number;
  parentId?: number | null;
  parentName?: string | null;
  domain?: 'consumer' | 'employee';
  departmentId?: number | null;
  isConfidential?: number;
  colorToken?: string;
  slaTargetHours?: number | null;
  isTerminal?: number;
}

interface IdRow extends RowDataPacket { id: number; name?: string; slug?: string }

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/&/gu, ' and ').replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
}

function text(input: Record<string, unknown>, key: string, fallback = ''): string {
  const value = input[key];
  return typeof value === 'string' ? value.trim() : fallback;
}

function integer(input: Record<string, unknown>, key: string): number | null {
  const value = input[key];
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function flag(input: Record<string, unknown>, key: string, fallback = false): boolean {
  const value = input[key];
  return typeof value === 'boolean' ? value : fallback;
}

function selectFor(resource: MasterResource): string {
  switch (resource) {
    case 'departments': return `SELECT id, name, slug, description, is_active AS isActive, sort_order AS sortOrder FROM departments`;
    case 'circles': return `SELECT id, name, slug, NULL AS description, is_active AS isActive, sort_order AS sortOrder FROM circles`;
    case 'divisions': return `SELECT division.id, division.name, division.slug, NULL AS description,
      division.is_active AS isActive, division.sort_order AS sortOrder,
      division.circle_id AS parentId, c.name AS parentName
      FROM divisions division JOIN circles c ON c.id = division.circle_id`;
    case 'subdivisions': return `SELECT subdivision.id, subdivision.name, subdivision.slug,
      NULL AS description, subdivision.is_active AS isActive,
      subdivision.sort_order AS sortOrder, subdivision.division_id AS parentId,
      division.name AS parentName
      FROM subdivisions subdivision JOIN divisions division ON division.id = subdivision.division_id`;
    case 'categories': return `SELECT cat.id, cat.name, cat.slug, cat.description, cat.is_active AS isActive,
      cat.sort_order AS sortOrder, cat.domain, cat.department_id AS departmentId, d.name AS parentName
      FROM categories cat LEFT JOIN departments d ON d.id = cat.department_id`;
    case 'complaint-types': return `SELECT ct.id, ct.name, ct.slug, ct.description, ct.is_active AS isActive,
      ct.sort_order AS sortOrder, ct.category_id AS parentId, cat.name AS parentName,
      ct.is_confidential AS isConfidential, ct.sla_target_hours AS slaTargetHours
      FROM complaint_types ct JOIN categories cat ON cat.id = ct.category_id`;
    case 'priorities': return `SELECT id, name, slug, description, is_active AS isActive, sort_order AS sortOrder,
      color_token AS colorToken, sla_target_hours AS slaTargetHours FROM priorities`;
    case 'statuses': return `SELECT id, name, slug, description, is_active AS isActive, sort_order AS sortOrder,
      is_terminal AS isTerminal FROM ticket_statuses`;
  }
}

export async function listMasterItems(resource: MasterResource, includeInactive: boolean): Promise<MasterRow[]> {
  const activeColumn = resource === 'divisions'
    ? 'division.is_active'
    : resource === 'subdivisions'
      ? 'subdivision.is_active'
    : resource === 'categories'
      ? 'cat.is_active'
      : resource === 'complaint-types'
        ? 'ct.is_active'
        : 'is_active';
  const [rows] = await databasePool.query<MasterRow[]>(
    `${selectFor(resource)} ${includeInactive ? '' : `WHERE ${activeColumn} = TRUE`} ORDER BY sortOrder, name`,
  );
  return rows;
}

async function ensureParent(connection: PoolConnection, table: string, id: number | null): Promise<void> {
  if (id === null) throw new AppError(422, 'PARENT_REQUIRED', 'A parent selection is required');
  const [rows] = await connection.execute<IdRow[]>(
    `SELECT id FROM ${table} WHERE id = ? AND is_active = TRUE`, [id],
  );
  if (rows[0] === undefined) throw new AppError(422, 'INVALID_PARENT', 'The selected parent is unavailable');
}

function insertStatement(resource: MasterResource, input: Record<string, unknown>): { sql: string; values: SqlValue[] } {
  const name = text(input, 'name');
  const slug = slugify(text(input, 'slug', name));
  const description = text(input, 'description') || null;
  const sortOrder = integer(input, 'sortOrder') ?? 0;
  switch (resource) {
    case 'departments': return { sql: `INSERT INTO departments (name, slug, description, is_active, sort_order) VALUES (?, ?, ?, ?, ?)`, values: [name, slug, description, flag(input, 'isActive', true), sortOrder] };
    case 'circles': return { sql: `INSERT INTO circles (name, slug, is_active, sort_order) VALUES (?, ?, ?, ?)`, values: [name, slug, flag(input, 'isActive', true), sortOrder] };
    case 'divisions': return { sql: `INSERT INTO divisions (circle_id, name, slug, is_active, sort_order) VALUES (?, ?, ?, ?, ?)`, values: [integer(input, 'parentId'), name, slug, flag(input, 'isActive', true), sortOrder] };
    case 'subdivisions': return { sql: `INSERT INTO subdivisions (division_id, name, slug, is_active, sort_order) VALUES (?, ?, ?, ?, ?)`, values: [integer(input, 'parentId'), name, slug, flag(input, 'isActive', true), sortOrder] };
    case 'categories': return { sql: `INSERT INTO categories (domain, department_id, name, slug, description, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`, values: [text(input, 'domain'), integer(input, 'departmentId'), name, slug, description, flag(input, 'isActive', true), sortOrder] };
    case 'complaint-types': return { sql: `INSERT INTO complaint_types (category_id, name, slug, description, sla_target_hours, is_confidential, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, values: [integer(input, 'parentId'), name, slug, description, integer(input, 'slaTargetHours') ?? 120, flag(input, 'isConfidential'), flag(input, 'isActive', true), sortOrder] };
    case 'priorities': return { sql: `INSERT INTO priorities (name, slug, description, color_token, sla_target_hours, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`, values: [name, slug, description ?? '', text(input, 'colorToken', 'blue'), integer(input, 'slaTargetHours'), flag(input, 'isActive', true), sortOrder] };
    case 'statuses': return { sql: `INSERT INTO ticket_statuses (name, slug, description, is_terminal, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?)`, values: [name, slug, description ?? '', flag(input, 'isTerminal'), flag(input, 'isActive', true), sortOrder] };
  }
}

function updateStatement(resource: MasterResource, input: Record<string, unknown>, id: number): { sql: string; values: SqlValue[] } {
  const name = text(input, 'name');
  const slug = slugify(text(input, 'slug', name));
  const description = text(input, 'description') || null;
  const active = flag(input, 'isActive', true);
  const sortOrder = integer(input, 'sortOrder') ?? 0;
  switch (resource) {
    case 'departments': return { sql: `UPDATE departments SET name=?, slug=?, description=?, is_active=?, sort_order=? WHERE id=?`, values: [name, slug, description, active, sortOrder, id] };
    case 'circles': return { sql: `UPDATE circles SET name=?, slug=?, is_active=?, sort_order=? WHERE id=?`, values: [name, slug, active, sortOrder, id] };
    case 'divisions': return { sql: `UPDATE divisions SET circle_id=?, name=?, slug=?, is_active=?, sort_order=? WHERE id=?`, values: [integer(input, 'parentId'), name, slug, active, sortOrder, id] };
    case 'subdivisions': return { sql: `UPDATE subdivisions SET division_id=?, name=?, slug=?, is_active=?, sort_order=? WHERE id=?`, values: [integer(input, 'parentId'), name, slug, active, sortOrder, id] };
    case 'categories': return { sql: `UPDATE categories SET domain=?, department_id=?, name=?, slug=?, description=?, is_active=?, sort_order=? WHERE id=?`, values: [text(input, 'domain'), integer(input, 'departmentId'), name, slug, description, active, sortOrder, id] };
    case 'complaint-types': return { sql: `UPDATE complaint_types SET category_id=?, name=?, slug=?, description=?, sla_target_hours=?, is_confidential=?, is_active=?, sort_order=? WHERE id=?`, values: [integer(input, 'parentId'), name, slug, description, integer(input, 'slaTargetHours') ?? 120, flag(input, 'isConfidential'), active, sortOrder, id] };
    case 'priorities': return { sql: `UPDATE priorities SET name=?, slug=?, description=?, color_token=?, sla_target_hours=?, is_active=?, sort_order=? WHERE id=?`, values: [name, slug, description ?? '', text(input, 'colorToken', 'blue'), integer(input, 'slaTargetHours'), active, sortOrder, id] };
    case 'statuses': return { sql: `UPDATE ticket_statuses SET name=?, slug=?, description=?, is_terminal=?, is_active=?, sort_order=? WHERE id=?`, values: [name, slug, description ?? '', flag(input, 'isTerminal'), active, sortOrder, id] };
  }
}

async function validateInput(connection: PoolConnection, resource: MasterResource, input: Record<string, unknown>): Promise<void> {
  if (text(input, 'name').length < 2) throw new AppError(422, 'NAME_REQUIRED', 'A name is required');
  if (resource === 'divisions') await ensureParent(connection, 'circles', integer(input, 'parentId'));
  if (resource === 'subdivisions') await ensureParent(connection, 'divisions', integer(input, 'parentId'));
  if (resource === 'complaint-types') await ensureParent(connection, 'categories', integer(input, 'parentId'));
  if (resource === 'categories') {
    if (!['consumer', 'employee'].includes(text(input, 'domain'))) throw new AppError(422, 'INVALID_DOMAIN', 'Domain must be consumer or employee');
    const departmentId = integer(input, 'departmentId');
    if (departmentId !== null) await ensureParent(connection, 'departments', departmentId);
  }
}

function duplicateError(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') {
    throw new AppError(409, 'MASTER_DATA_DUPLICATE', 'An item with this name or slug already exists');
  }
  throw error;
}

export async function createMasterItem(resource: MasterResource, input: Record<string, unknown>, actorId: number, context: RequestContext): Promise<number> {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    await validateInput(connection, resource, input);
    const statement = insertStatement(resource, input);
    const [result] = await connection.execute<ResultSetHeader>(statement.sql, statement.values);
    await writeAudit(connection, { actorId, action: 'master_data.created', entityType: resource, entityId: String(result.insertId), context, metadata: { name: text(input, 'name') } });
    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    duplicateError(error);
  } finally { connection.release(); }
}

export async function updateMasterItem(resource: MasterResource, id: number, input: Record<string, unknown>, actorId: number, context: RequestContext): Promise<void> {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const table = resource === 'complaint-types' ? 'complaint_types' : resource === 'statuses' ? 'ticket_statuses' : resource;
    const [existing] = await connection.execute<IdRow[]>(`SELECT id, name, slug FROM ${table} WHERE id = ? FOR UPDATE`, [id]);
    if (existing[0] === undefined) throw new AppError(404, 'MASTER_DATA_NOT_FOUND', 'The item was not found');
    if (['other', 'other-division', 'other-sub-division'].includes(existing[0].slug ?? '')
        && !flag(input, 'isActive', true)) {
      throw new AppError(409, 'OTHER_OPTION_REQUIRED', 'The Other option must remain active');
    }
    await validateInput(connection, resource, input);
    const statement = updateStatement(resource, input, id);
    await connection.execute(statement.sql, statement.values);
    await writeAudit(connection, { actorId, action: 'master_data.updated', entityType: resource, entityId: String(id), context, metadata: { isActive: flag(input, 'isActive', true) } });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    duplicateError(error);
  } finally { connection.release(); }
}

export async function getActiveCatalog() {
  const [departments, circles, divisions, subdivisions, categories, complaintTypes, priorities, statuses] = await Promise.all([
    listMasterItems('departments', false), listMasterItems('circles', false),
    listMasterItems('divisions', false), listMasterItems('subdivisions', false),
    listMasterItems('categories', false), listMasterItems('complaint-types', false),
    listMasterItems('priorities', false), listMasterItems('statuses', false),
  ]);
  return {
    departments,
    circles: circles.map((circle) => ({
      ...circle,
      divisions: divisions.filter((division) => division.parentId === circle.id).map((division) => ({
        ...division,
        subdivisions: subdivisions.filter((subdivision) => subdivision.parentId === division.id),
      })),
    })),
    categories: categories.map((category) => ({ ...category, complaintTypes: complaintTypes.filter((type) => type.parentId === category.id) })),
    priorities,
    statuses,
  };
}
