import { logger } from '../../config/logger.js';
import { getMigrationStatus } from '../migrator.js';

try {
  const migrations = await getMigrationStatus();
  logger.info({ migrations }, 'Database migration status');
} catch (error) {
  logger.error({ err: error }, 'Could not read migration status');
  process.exitCode = 1;
}

