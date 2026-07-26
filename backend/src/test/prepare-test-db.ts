import mysql from 'mysql2/promise';

const databaseName = process.env.DB_NAME ?? 'mepco_help_desk_test';
if (!databaseName.endsWith('_test')) {
  throw new Error('Integration database name must end with _test');
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
});

try {
  await connection.query(`DROP DATABASE IF EXISTS ${connection.escapeId(databaseName)}`);
  await connection.query(
    `CREATE DATABASE ${connection.escapeId(databaseName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
} finally {
  await connection.end();
}

const { runMigrations } = await import('../database/migrator.js');
const { runSeed } = await import('../database/seeder.js');
const { closeDatabasePool } = await import('../database/pool.js');

await runMigrations();
await runSeed({ includeTestFixtures: true });
await closeDatabasePool();
