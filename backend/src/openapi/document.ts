const successResponse = { description: 'Successful standardized API response', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } };
const createdResponse = { description: 'Resource created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } };
const errorResponses = {
  '400': { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
  '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
  '403': { description: 'Role or scope denied', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
  '409': { description: 'State or optimistic-version conflict', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
  '422': { description: 'Business rule rejected the request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
};
const bearer = [{ bearerAuth: [] }];
const idParameter = { name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } };
const jsonRequest = (schema: Record<string, unknown> = { type: 'object', additionalProperties: true }) => ({
  required: true, content: { 'application/json': { schema } },
});
const operation = (tag: string, summary: string, options: { created?: boolean; body?: boolean; parameters?: unknown[]; security?: boolean } = {}) => ({
  tags: [tag], summary, ...(options.security === false ? {} : { security: bearer }),
  ...(options.parameters === undefined ? {} : { parameters: options.parameters }),
  ...(options.body === true ? { requestBody: jsonRequest() } : {}),
  responses: { [options.created === true ? '201' : '200']: options.created === true ? createdResponse : successResponse, ...errorResponses },
});

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'MEPCO Integrated Help Desk API', version: '1.0.0',
    description: 'Complete versioned REST API for consumer complaints, employee support, workflow, reporting, and administration. All protected operations enforce backend role and routing scope checks.',
  },
  servers: [{ url: 'http://localhost:5000', description: 'Local / XAMPP development' }],
  tags: [
    { name: 'Health' }, { name: 'Authentication' }, { name: 'Users' }, { name: 'Master data' },
    { name: 'Tickets' }, { name: 'Workflow' }, { name: 'Collaboration' }, { name: 'Notifications' },
    { name: 'Reports' }, { name: 'Suspensions' }, { name: 'Account governance' }, { name: 'Administration' },
  ],
  paths: {
    '/api/v1/health/live': { get: operation('Health', 'Check API liveness', { security: false }) },
    '/api/v1/health/ready': { get: operation('Health', 'Check API and MySQL readiness', { security: false }) },
    '/api/v1/auth/registration-options': { get: operation('Authentication', 'List registration departments and the Circle → Division → Sub-division hierarchy', { security: false }) },
    '/api/v1/auth/register/consumer': { post: { ...operation('Authentication', 'Register a consumer account', { security: false, created: true }), requestBody: jsonRequest({ $ref: '#/components/schemas/ConsumerRegistrationRequest' }) } },
    '/api/v1/auth/register/employee': { post: { ...operation('Authentication', 'Register an employee account', { security: false, created: true }), requestBody: jsonRequest({ $ref: '#/components/schemas/EmployeeRegistrationRequest' }) } },
    '/api/v1/auth/login': { post: { ...operation('Authentication', 'Sign in and issue access/refresh credentials', { security: false, body: true }), requestBody: jsonRequest({ $ref: '#/components/schemas/LoginRequest' }) } },
    '/api/v1/auth/refresh': { post: operation('Authentication', 'Rotate the HttpOnly refresh session', { security: false }) },
    '/api/v1/auth/logout': { post: operation('Authentication', 'Revoke the refresh session', { security: false }) },
    '/api/v1/auth/me': { get: operation('Authentication', 'Return the authenticated identity') },
    '/api/v1/suspensions/me': { get: operation('Suspensions', 'Get suspension details and own support request history') },
    '/api/v1/suspensions/me/requests': { post: operation('Suspensions', 'Submit a suspension appeal or support request', { body: true, created: true }) },
    '/api/v1/suspensions/management/requests': { get: operation('Suspensions', 'Supervisor or administrator: list suspension appeals and support requests') },
    '/api/v1/suspensions/management/requests/{id}': { put: operation('Suspensions', 'Supervisor or administrator: reply to and decide a suspension request', { body: true, parameters: [idParameter] }) },
    '/api/v1/account-governance/requests': {
      get: operation('Account governance', 'List own technician requests or the manager review queue'),
      post: operation('Account governance', 'Technician: request suspension of the requester on an assigned ticket', { body: true, created: true }),
    },
    '/api/v1/account-governance/requests/{id}/review': { put: operation('Account governance', 'Supervisor or administrator: approve or reject a technician request', { body: true, parameters: [idParameter] }) },
    '/api/v1/account-governance/requesters': { get: operation('Account governance', 'Supervisor or administrator: search consumer and employee accounts') },
    '/api/v1/account-governance/users/{id}/suspend': { post: operation('Account governance', 'Supervisor or administrator: directly suspend a requester with details', { body: true, created: true, parameters: [idParameter] }) },
    '/api/v1/account-governance/users/{id}/reactivate': { post: operation('Account governance', 'Supervisor or administrator: reactivate a requester with a reason', { body: true, parameters: [idParameter] }) },
    '/api/v1/users/me/profile': { get: operation('Users', 'Get own role-specific profile'), put: operation('Users', 'Update own profile', { body: true }) },
    '/api/v1/users/me/password': { post: operation('Users', 'Change own password and revoke sessions', { body: true }) },
    '/api/v1/users/admin': { get: operation('Users', 'Search and paginate user accounts'), post: operation('Users', 'Create a staff account', { body: true, created: true }) },
    '/api/v1/users/admin/{id}': { put: operation('Users', 'Update role, profile, or account status', { body: true, parameters: [idParameter] }), delete: operation('Users', 'Soft-delete an account', { parameters: [idParameter] }) },
    '/api/v1/users/admin/{id}/reset-password': { post: operation('Users', 'Reset a user password and revoke sessions', { body: true, parameters: [idParameter] }) },
    '/api/v1/master-data/catalog': { get: operation('Master data', 'Get the active ticket-form catalog with nested circles, divisions, and sub-divisions') },
    '/api/v1/master-data/admin/{resource}': {
      get: operation('Master data', 'List an administrative master-data resource', { parameters: [{ name: 'resource', in: 'path', required: true, schema: { $ref: '#/components/schemas/MasterResource' } }] }),
      post: operation('Master data', 'Create a master-data item', { body: true, created: true, parameters: [{ name: 'resource', in: 'path', required: true, schema: { $ref: '#/components/schemas/MasterResource' } }] }),
    },
    '/api/v1/master-data/admin/{resource}/{id}': { put: operation('Master data', 'Edit, reorder, activate, or deactivate a master-data item', { body: true, parameters: [{ name: 'resource', in: 'path', required: true, schema: { $ref: '#/components/schemas/MasterResource' } }, idParameter] }) },
    '/api/v1/tickets': { get: operation('Tickets', 'List and filter tickets within the actor scope', { parameters: [{ name: 'view', in: 'query', required: false, description: 'Dashboard queue view using the same rules as Open work or Past SLA metrics.', schema: { type: 'string', enum: ['open', 'overdue'] } }] }), post: operation('Tickets', 'Submit a requester ticket idempotently with automatic department assignment', { body: true, created: true }) },
    '/api/v1/tickets/{id}': {
      get: operation('Tickets', 'Get scoped ticket detail, comments, files, review, and history', { parameters: [idParameter] }),
      delete: operation('Tickets', 'Soft-delete a ticket as an administrator', { body: true, parameters: [idParameter] }),
    },
    '/api/v1/tickets/workflow/technicians': { get: operation('Workflow', 'List eligible technicians and workloads') },
    '/api/v1/tickets/{id}/assign': { post: operation('Workflow', 'Assign or reassign a ticket', { body: true, parameters: [idParameter] }) },
    '/api/v1/tickets/{id}/status': { post: operation('Workflow', 'Apply a permitted status transition', { body: true, parameters: [idParameter] }) },
    '/api/v1/tickets/{id}/close-review': { post: operation('Workflow', 'Close a resolved requester ticket and submit closure feedback', { body: true, parameters: [idParameter] }) },
    '/api/v1/tickets/{id}/priority': { post: operation('Workflow', 'Change ticket priority', { body: true, parameters: [idParameter] }) },
    '/api/v1/tickets/{id}/comments': { post: operation('Collaboration', 'Add a public comment or staff-only note', { body: true, created: true, parameters: [idParameter] }) },
    '/api/v1/tickets/{id}/attachments': { post: { ...operation('Collaboration', 'Upload a validated evidence attachment', { created: true, parameters: [idParameter] }), requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } } } } } },
    '/api/v1/tickets/attachments/{attachmentId}/download': { get: operation('Collaboration', 'Download an attachment after ticket access checks', { parameters: [{ name: 'attachmentId', in: 'path', required: true, schema: { type: 'integer' } }] }) },
    '/api/v1/notifications': { get: operation('Notifications', 'List own notifications and unread count') },
    '/api/v1/notifications/read-all': { post: operation('Notifications', 'Mark all own notifications read') },
    '/api/v1/notifications/{id}/read': { post: operation('Notifications', 'Mark one own notification read', { parameters: [idParameter] }) },
    '/api/v1/tickets/reports/metrics': { get: operation('Reports', 'Get role-scoped status, SLA, and workload metrics') },
    '/api/v1/tickets/reports/export.csv': { get: { ...operation('Reports', 'Export a manager-scoped UTF-8 ticket CSV'), responses: { '200': { description: 'CSV export', content: { 'text/csv': { schema: { type: 'string' } } } }, ...errorResponses } } },
    '/api/v1/tickets/reports/export.pdf': { get: { ...operation('Reports', 'Export a manager-scoped paginated ticket PDF'), responses: { '200': { description: 'PDF export', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } }, ...errorResponses } } },
    '/api/v1/administration/announcements': { get: operation('Administration', 'List active announcements for own role'), post: operation('Administration', 'Supervisor or administrator: create a targeted announcement', { body: true, created: true }) },
    '/api/v1/administration/announcements/all': { get: operation('Administration', 'Supervisor or administrator: list all announcements') },
    '/api/v1/administration/announcements/{id}': { put: operation('Administration', 'Supervisor or administrator: update an announcement', { body: true, parameters: [idParameter] }), delete: operation('Administration', 'Supervisor or administrator: deactivate an announcement', { parameters: [idParameter] }) },
    '/api/v1/administration/audit': { get: operation('Administration', 'Search immutable audit logs') },
    '/api/v1/administration/scopes': { get: operation('Administration', 'List technician and supervisor routing scopes') },
    '/api/v1/administration/scopes/{userId}': { put: operation('Administration', 'Atomically replace a staff member routing scopes', { body: true, parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'integer' } }] }) },
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Short-lived access token returned by login or refresh.' } },
    schemas: {
      SuccessResponse: { type: 'object', required: ['success', 'data', 'meta'], properties: { success: { type: 'boolean', const: true }, data: {}, message: { type: 'string' }, meta: { type: ['object', 'null'] } } },
      ErrorResponse: { type: 'object', required: ['success', 'error', 'requestId'], properties: { success: { type: 'boolean', const: false }, error: { type: 'object', required: ['code', 'message'], properties: { code: { type: 'string' }, message: { type: 'string' }, details: {} } }, requestId: { type: 'string', format: 'uuid' } } },
      ConsumerReferenceNumber: { type: 'string', pattern: '^[0-9]{14}$', minLength: 14, maxLength: 14, example: '10000000000001' },
      EmployeeIdInput: { type: 'string', pattern: '^[0-9]{1,8}$', minLength: 1, maxLength: 8, example: '1234', description: 'Normalized and stored as exactly eight digits, for example 00001234.' },
      PhoneNumber: { type: 'string', pattern: '^03[0-9]{9}$', minLength: 11, maxLength: 11, example: '03001234567', description: 'Exactly 11 digits beginning with 03.' },
      Cnic: { type: 'string', pattern: '^[0-9]{13}$', minLength: 13, maxLength: 13, example: '3520212345671', description: 'Exactly 13 digits without dashes. Required for new accounts in every role and unique when provided.' },
      LoginRequest: { type: 'object', required: ['mode', 'identifier', 'password'], properties: { mode: { type: 'string', enum: ['consumer', 'employee', 'staff'] }, identifier: { type: 'string', description: 'Consumer: exactly 14 digits. Employee: 1–8 digits, left-padded to 8. Staff: username.' }, password: { type: 'string', format: 'password' } } },
      ConsumerRegistrationRequest: { type: 'object', required: ['referenceNumber', 'name', 'phone', 'cnic', 'password', 'address', 'circleId', 'divisionId', 'subdivisionId'], properties: { referenceNumber: { $ref: '#/components/schemas/ConsumerReferenceNumber' }, name: { type: 'string' }, email: { type: 'string', format: 'email' }, phone: { $ref: '#/components/schemas/PhoneNumber' }, cnic: { $ref: '#/components/schemas/Cnic' }, password: { type: 'string', format: 'password' }, address: { type: 'string' }, circleId: { type: 'integer', minimum: 1 }, divisionId: { type: 'integer', minimum: 1 }, subdivisionId: { type: 'integer', minimum: 1 }, serviceAddress: { type: 'string' } } },
      EmployeeRegistrationRequest: { type: 'object', required: ['employeeId', 'name', 'email', 'phone', 'cnic', 'password', 'departmentId', 'designation', 'workLocation'], properties: { employeeId: { $ref: '#/components/schemas/EmployeeIdInput' }, name: { type: 'string' }, email: { type: 'string', format: 'email' }, phone: { $ref: '#/components/schemas/PhoneNumber' }, cnic: { $ref: '#/components/schemas/Cnic' }, password: { type: 'string', format: 'password' }, departmentId: { type: 'integer', minimum: 1 }, designation: { type: 'string' }, workLocation: { type: 'string' } } },
      MasterResource: { type: 'string', enum: ['departments', 'circles', 'divisions', 'subdivisions', 'categories', 'complaint-types', 'priorities', 'statuses'] },
    },
  },
} as const;
