import request from 'supertest';

import { app } from './app.js';

describe('application foundation', () => {
  it('returns the standardized liveness response', async () => {
    const response = await request(app).get('/api/v1/health/live').expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        service: 'mepco-help-desk-api',
        status: 'up',
      },
      meta: null,
    });
    expect(response.headers['x-request-id']).toBeTypeOf('string');
  });

  it('publishes an OpenAPI document for implemented endpoints', async () => {
    const response = await request(app).get('/api-docs.json').expect(200);

    const body = response.body as {
      openapi?: unknown;
      paths?: unknown;
    };

    expect(body.openapi).toBe('3.1.0');
    expect(body.paths).toHaveProperty('/api/v1/health/live');
    expect(body.paths).toHaveProperty('/api/v1/health/ready');
  });

  it('uses the standardized safe error envelope for unknown routes', async () => {
    const response = await request(app).get('/api/v1/not-a-route').expect(404);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
      },
    });
    const body = response.body as { requestId?: unknown };
    expect(body.requestId).toBeTypeOf('string');
  });
});
