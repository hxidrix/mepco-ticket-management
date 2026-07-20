import pino from 'pino';

import { env } from './env.js';

export const logger = pino({
  level: env.logLevel,
  base: {
    service: 'mepco-help-desk-api',
    environment: env.nodeEnv,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      '*.password',
      'refreshToken',
      '*.refreshToken',
      'token',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
});
