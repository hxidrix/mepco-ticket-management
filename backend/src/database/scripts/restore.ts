import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

const inputArgument = process.argv[2];
if (inputArgument === undefined) {
  throw new Error('Usage: npm run db:restore -- <path-to-backup.sql>');
}

const inputPath = resolve(inputArgument);
await access(inputPath);
const executable = env.database.mysqlBinDirectory
  ? join(env.database.mysqlBinDirectory, process.platform === 'win32' ? 'mysql.exe' : 'mysql')
  : 'mysql';

const child = spawn(
  executable,
  ['--host', env.database.host, '--port', String(env.database.port), '--user', env.database.user],
  {
    env: { ...process.env, MYSQL_PWD: env.database.password },
    stdio: ['pipe', 'ignore', 'pipe'],
  },
);
createReadStream(inputPath).pipe(child.stdin);
let stderr = '';
child.stderr.on('data', (chunk: Buffer) => {
  stderr += chunk.toString('utf8');
});

const exitCode = await new Promise<number | null>((resolveExit) => {
  child.on('close', resolveExit);
});

if (exitCode !== 0) {
  logger.error({ exitCode, stderr, inputPath }, 'Database restore failed');
  process.exitCode = 1;
} else {
  logger.info({ inputPath }, 'Database restore completed');
}

