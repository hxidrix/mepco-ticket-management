import mysql from 'mysql2/promise';

import { env } from '../config/env.js';

export const databasePool = mysql.createPool({
  host: env.database.host,
  port: env.database.port,
  user: env.database.user,
  password: env.database.password,
  database: env.database.name,
  waitForConnections: true,
  connectionLimit: env.database.connectionLimit,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: 'Z',
  charset: 'utf8mb4',
});

export async function checkDatabaseConnection(): Promise<void> {
  const connection = await databasePool.getConnection();
  try {
    await connection.query('SELECT 1 AS healthy');
  } finally {
    connection.release();
  }
}

export async function closeDatabasePool(): Promise<void> {
  await databasePool.end();
}

