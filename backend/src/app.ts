import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { httpLogger } from './middleware/http-logger.js';
import { notFoundHandler } from './middleware/not-found.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { administrationRouter } from './modules/administration/administration.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { masterDataRouter } from './modules/master-data/master-data.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { ticketsRouter } from './modules/tickets/tickets.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { openApiDocument } from './openapi/document.js';

export const app = express();

app.disable('x-powered-by');
app.use(httpLogger);
app.use(helmet({ contentSecurityPolicy: false }));
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
  response.redirect('/api-docs');
});
app.get('/api-docs.json', (_request, response) => {
  response.json(openApiDocument);
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/administration', administrationRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/master-data', masterDataRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/tickets', ticketsRouter);

app.use(notFoundHandler);
app.use(errorHandler);
