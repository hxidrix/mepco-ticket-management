import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { httpLogger } from './middleware/http-logger.js';
import { notFoundHandler } from './middleware/not-found.js';
import { healthRouter } from './modules/health/health.routes.js';
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

app.get('/', (_request, response) => {
  response.redirect('/api-docs');
});
app.get('/api-docs.json', (_request, response) => {
  response.json(openApiDocument);
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.use('/api/v1/health', healthRouter);

app.use(notFoundHandler);
app.use(errorHandler);

