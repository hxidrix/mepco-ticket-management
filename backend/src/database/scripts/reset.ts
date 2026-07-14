import type { RowDataPacket } from 'mysql2/promise';

import { logger } from '../../config/logger.js';
import { runMigrations } from '../migrator.js';
import { closeDatabasePool, databasePool } from '../pool.js';
import { runSeed } from '../seeder.js';

interface TableRow extends RowDataPacket {
  tableName: string;
}

try {
  const connection = await databasePool.getConnection();
  try {
    const [tables] = await connection.query<TableRow[]>(
      `SELECT TABLE_NAME AS tableName
       FROM information_schema.tables
       WHERE table_schema = DATABASE()`,
    );
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of tables) {
      await connection.query(`DROP TABLE IF EXISTS ${connection.escapeId(table.tableName)}`);
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    connection.release();
  }

  const migrationResult = await runMigrations();
  await runSeed();
  logger.info(migrationResult, 'Development database reset and seeded');
} catch (error) {
  logger.error({ err: error }, 'Development database reset failed');
  process.exitCode = 1;
} finally {
  await closeDatabasePool();
}

