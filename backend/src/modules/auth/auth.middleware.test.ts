import express from 'express';
import request from 'supertest';

import { errorHandler } from '../../middleware/error-handler.js';
import { issueTokens } from './auth.tokens.js';
import { authenticate, authorizeRoles } from './auth.middleware.js';
import type { UserRole } from './auth.types.js';

describe('role authorization middleware', () => {
  const testApp = express();
  testApp.get(
    '/admin',
    authenticate,
    authorizeRoles('administrator'),
    (_request, response) => response.json({ allowed: true }),
  );
  testApp.use(errorHandler);

  it.each([
    'consumer',
    'employee',
    'technician',
    'supervisor',
  ] as const)('forbids the %s role from an administrator route', async (role) => {
    const token = issueTokens({ id: 1, role, displayName: 'Test User', status: 'active' }).accessToken;
    await request(testApp).get('/admin').set('Authorization', `Bearer ${token}`).expect(403);
  });

  it('allows the administrator role', async () => {
    const role: UserRole = 'administrator';
    const token = issueTokens({ id: 1, role, displayName: 'Test Admin', status: 'active' }).accessToken;
    await request(testApp).get('/admin').set('Authorization', `Bearer ${token}`).expect(200);
  });
});
