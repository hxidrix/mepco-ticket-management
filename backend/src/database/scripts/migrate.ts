import { logger } from '../../config/logger.js';
import { runMigrations } from '../migrator.js';

try {
  const result = await runMigrations();
  logger.info(result, 'Database migrations completed');
} catch (error) {
  logger.error({ err: error }, 'Database migration failed');
  process.exitCode = 1;
}

