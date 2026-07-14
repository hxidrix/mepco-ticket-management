import type { PoolConnection } from 'mysql2/promise';

import type { RequestContext } from '../modules/auth/auth.types.js';

export async function writeAudit(
  connection: PoolConnection,
  input: {
    actorId: number | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    result?: 'success' | 'failure';
    context: RequestContext;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await connection.execute(
    `INSERT INTO audit_logs
       (actor_id, action, entity_type, entity_id, result, request_id, ip_address, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.actorId,
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.result ?? 'success',
      input.context.requestId,
      input.context.ipAddress,
      input.metadata === undefined ? null : JSON.stringify(input.metadata),
    ],
  );
}
