import { createServer } from 'node:http';

import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { closeDatabasePool } from './database/pool.js';

const server = createServer(app);

server.listen(env.port, env.host, () => {
  logger.info(
    {
      host: env.host,
      port: env.port,
      ...(env.enableApiDocs ? { apiDocsUrl: `http://${env.host}:${env.port}/api-docs` } : {}),
    },
    'MEPCO Help Desk API started',
  );
});

let shuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Graceful shutdown started');

  server.close(async (serverError) => {
    try {
      await closeDatabasePool();
      if (serverError !== undefined) throw serverError;
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, 'Graceful shutdown failed');
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
