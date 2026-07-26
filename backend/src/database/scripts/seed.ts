import { logger } from '../../config/logger.js';
import { closeDatabasePool } from '../pool.js';
import { runSeed } from '../seeder.js';

try {
  await runSeed();
  logger.info('Reference data seed completed');
} catch (error) {
  logger.error({ err: error }, 'Database seed failed');
  process.exitCode = 1;
} finally {
  await closeDatabasePool();
}
