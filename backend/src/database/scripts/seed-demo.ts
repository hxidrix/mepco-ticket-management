import { logger } from '../../config/logger.js';
import { closeDatabasePool } from '../pool.js';
import { runSeed } from '../seeder.js';

try {
  await runSeed({ includeDemoData: true });
  logger.info('Local demo accounts and operational data seeded');
} catch (error) {
  logger.error({ err: error }, 'Local demo seed failed');
  process.exitCode = 1;
} finally {
  await closeDatabasePool();
}
