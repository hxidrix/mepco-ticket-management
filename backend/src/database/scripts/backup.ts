import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputPath = resolve(process.argv[2] ?? `backups/mepco-help-desk-${timestamp}.sql`);
const executable = env.database.mysqlBinDirectory
  ? join(env.database.mysqlBinDirectory, process.platform === 'win32' ? 'mysqldump.exe' : 'mysqldump')
  : 'mysqldump';

await mkdir(dirname(outputPath), { recursive: true });

const child = spawn(
  executable,
  [
    '--host', env.database.host,
    '--port', String(env.database.port),
    '--user', env.database.user,
    '--single-transaction',
    '--routines',
    '--triggers',
    '--databases', env.database.name,
  ],
  {
    env: { ...process.env, MYSQL_PWD: env.database.password },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

child.stdout.pipe(createWriteStream(outputPath));
let stderr = '';
child.stderr.on('data', (chunk: Buffer) => {
  stderr += chunk.toString('utf8');
});

const exitCode = await new Promise<number | null>((resolveExit) => {
  child.on('close', resolveExit);
});

if (exitCode !== 0) {
  logger.error({ exitCode, stderr }, 'Database backup failed');
  process.exitCode = 1;
} else {
  logger.info({ outputPath }, 'Database backup created');
}

