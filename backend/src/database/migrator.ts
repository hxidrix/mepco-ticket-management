import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2/promise';

import { env } from '../config/env.js';

interface AppliedMigrationRow extends RowDataPacket {
  filename: string;
  checksum: string;
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

function migrationDirectory(): string {
  return fileURLToPath(new URL('./migrations/', import.meta.url));
}

export async function runMigrations(): Promise<MigrationResult> {
  const connection = await mysql.createConnection({
    host: env.database.host,
    port: env.database.port,
    user: env.database.user,
    password: env.database.password,
    database: env.database.name,
    charset: 'utf8mb4',
    timezone: 'Z',
    multipleStatements: true,
  });

  const result: MigrationResult = { applied: [], skipped: [] };

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        filename VARCHAR(255) NOT NULL,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_schema_migrations_filename (filename)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const files = (await readdir(migrationDirectory()))
      .filter((filename) => /^\d+_.+\.sql$/u.test(filename))
      .sort((left, right) => left.localeCompare(right));

    const [rows] = await connection.query<AppliedMigrationRow[]>(
      'SELECT filename, checksum FROM schema_migrations',
    );
    const applied = new Map(rows.map((row) => [row.filename, row.checksum]));

    for (const filename of files) {
      const sql = await readFile(new URL(`./migrations/${filename}`, import.meta.url), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const recordedChecksum = applied.get(filename);

      if (recordedChecksum !== undefined) {
        if (recordedChecksum !== checksum) {
          throw new Error(`Applied migration ${filename} has been modified`);
        }
        result.skipped.push(filename);
        continue;
      }

      await connection.query(sql);
      await connection.execute(
        'INSERT INTO schema_migrations (filename, checksum) VALUES (?, ?)',
        [filename, checksum],
      );
      result.applied.push(filename);
    }
  } finally {
    await connection.end();
  }

  return result;
}

export async function getMigrationStatus(): Promise<AppliedMigrationRow[]> {
  const connection = await mysql.createConnection({
    host: env.database.host,
    port: env.database.port,
    user: env.database.user,
    password: env.database.password,
    database: env.database.name,
    charset: 'utf8mb4',
    timezone: 'Z',
  });

  try {
    const [rows] = await connection.query<AppliedMigrationRow[]>(
      `SELECT filename, checksum, applied_at
       FROM schema_migrations
       ORDER BY id`,
    );
    return rows;
  } finally {
    await connection.end();
  }
}

