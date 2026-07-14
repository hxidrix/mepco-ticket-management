import { logger } from '../../config/logger.js';
import { closeDatabasePool } from '../pool.js';
import { developmentCredentials, runSeed } from '../seeder.js';

try {
  await runSeed();
  logger.info(
    { developmentAccounts: Object.keys(developmentCredentials) },
    'Fictional development seed completed',
  );
} catch (error) {
  logger.error({ err: error }, 'Database seed failed');
  process.exitCode = 1;
} finally {
  await closeDatabasePool();
}

