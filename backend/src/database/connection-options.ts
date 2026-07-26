import type { ConnectionOptions } from 'mysql2/promise';

import { env } from '../config/env.js';

export function databaseConnectionOptions(): ConnectionOptions {
  const ssl = env.database.sslMode === 'disabled'
    ? undefined
    : {
        rejectUnauthorized: env.database.sslMode === 'verify_identity',
        ...(env.database.sslCaBase64 === ''
          ? {}
          : { ca: Buffer.from(env.database.sslCaBase64, 'base64').toString('utf8') }),
      };

  return {
    host: env.database.host,
    port: env.database.port,
    user: env.database.user,
    password: env.database.password,
    database: env.database.name,
    charset: 'utf8mb4',
    timezone: 'Z',
    ...(ssl === undefined ? {} : { ssl }),
  };
}
