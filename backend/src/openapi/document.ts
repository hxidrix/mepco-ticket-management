export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'MEPCO Integrated Help Desk API',
    version: '0.1.0',
    description:
      'Versioned REST API for the consumer and employee MEPCO help-desk domains.',
  },
  servers: [{ url: 'http://localhost:5000', description: 'Local development' }],
  tags: [{ name: 'Health', description: 'Service liveness and database readiness' }],
  paths: {
    '/api/v1/health/live': {
      get: {
        tags: ['Health'],
        summary: 'Check API liveness',
        operationId: 'getLiveness',
        responses: {
          '200': {
            description: 'The API process is accepting requests',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthSuccess' },
              },
            },
          },
        },
      },
    },
    '/api/v1/health/ready': {
      get: {
        tags: ['Health'],
        summary: 'Check API and database readiness',
        operationId: 'getReadiness',
        responses: {
          '200': {
            description: 'The API can reach MySQL',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthSuccess' },
              },
            },
          },
          '503': {
            description: 'The database is unavailable',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      HealthSuccess: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', const: true },
          data: {
            type: 'object',
            required: ['service', 'status', 'timestamp'],
            properties: {
              service: { type: 'string', example: 'mepco-help-desk-api' },
              status: { type: 'string', example: 'ready' },
              database: { type: 'string', example: 'connected' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
          meta: { type: ['object', 'null'], default: null },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['success', 'error', 'requestId'],
        properties: {
          success: { type: 'boolean', const: false },
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'DATABASE_UNAVAILABLE' },
              message: { type: 'string' },
            },
          },
          requestId: { type: 'string', example: '4c70cc29-3aca-4de6-b03e-57f005f5fb35' },
        },
      },
    },
  },
} as const;
