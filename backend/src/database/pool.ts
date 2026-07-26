import mysql from 'mysql2/promise';

import { env } from '../config/env.js';
import { databaseConnectionOptions } from './connection-options.js';

export const databasePool = mysql.createPool({
  ...databaseConnectionOptions(),
  waitForConnections: true,
  connectionLimit: env.database.connectionLimit,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
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
