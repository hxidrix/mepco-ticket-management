import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import './types/express.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { httpLogger } from './middleware/http-logger.js';
import { notFoundHandler } from './middleware/not-found.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { accountGovernanceRouter } from './modules/account-governance/account-governance.routes.js';
import { administrationRouter } from './modules/administration/administration.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { internalMessagesRouter } from './modules/internal-messages/internal-messages.routes.js';
import { masterDataRouter } from './modules/master-data/master-data.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { suspensionsRouter } from './modules/suspensions/suspensions.routes.js';
import { ticketsRouter } from './modules/tickets/tickets.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { openApiDocument } from './openapi/document.js';

export const app = express();

app.disable('x-powered-by');
if (process.env.VERCEL === '1') {
  // Vercel places exactly one trusted proxy hop in front of the function.
  app.set('trust proxy', 1);
}
app.use(httpLogger);
app.use(env.enableApiDocs ? helmet({ contentSecurityPolicy: false }) : helmet());
app.use(
  cors({
    origin: env.corsOrigin.split(',').map((origin) => origin.trim()),
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

app.get('/', (_request, response) => {
  response.status(200).json({
    success: true,
    data: { service: 'MEPCO Help Desk API', status: 'online' },
  });
});
if (env.enableApiDocs) {
  app.get('/api-docs.json', (_request, response) => {
    response.json(openApiDocument);
  });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
}
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/account-governance', accountGovernanceRouter);
app.use('/api/v1/suspensions', suspensionsRouter);
app.use('/api/v1/administration', administrationRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/master-data', masterDataRouter);
app.use('/api/v1/internal-messages', internalMessagesRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/tickets', ticketsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

// Vercel imports the Express application directly. The named export remains
// available to the local HTTP server and the test suite.
export default app;
