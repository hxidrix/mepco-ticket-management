import { timingSafeEqual } from 'node:crypto';

import { compare } from 'bcryptjs';

import { AppError } from '../../shared/app-error.js';
import {
  normalizeEmployeeId,
  normalizeLoginIdentifier,
} from '../../shared/identity-format.js';
import {
  findLoginCandidate,
  findEmployeeVerificationCandidate,
  recordLoginFailure,
  recordLoginSuccess,
  revokeRefreshSession,
  rotateRefreshSession,
} from './auth.repository.js';
import {
  createRefreshSessionMaterial,
  hashTokenIdentifier,
  issueTokens,
  issueTokensForSession,
  verifyRefreshToken,
} from './auth.tokens.js';
import type {
  LoginMode,
  NewRefreshSession,
  RequestContext,
} from './auth.types.js';

const dummyPasswordHash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6Ttxl3p7cQ7kYfL8RYuQf3x7mYF5e';

function toNewSession(
  userId: number,
  session: { id: string; familyId: string; jtiHash: string; expiresAt: Date },
): NewRefreshSession {
  return {
    id: session.id,
    familyId: session.familyId,
    userId,
    tokenJtiHash: session.jtiHash,
    expiresAt: session.expiresAt,
  };
}

export async function login(
  mode: LoginMode,
  identifier: string,
  password: string,
  context: RequestContext,
) {
  const normalizedIdentifier = normalizeLoginIdentifier(mode, identifier);
  const candidate = await findLoginCandidate(mode, normalizedIdentifier);
  const passwordMatches = await compare(password, candidate?.passwordHash ?? dummyPasswordHash);

  if (candidate === null || !passwordMatches) {
    await recordLoginFailure(candidate, normalizedIdentifier, mode, context);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'The identifier or password is incorrect');
  }
  if (candidate.lockedUntil !== null && candidate.lockedUntil.getTime() > Date.now()) {
    await recordLoginFailure(candidate, normalizedIdentifier, mode, context);
    throw new AppError(429, 'ACCOUNT_TEMPORARILY_LOCKED', 'Too many login attempts; try again later');
  }
  if (candidate.status !== 'active') {
    if (candidate.status !== 'suspended') {
      throw new AppError(403, 'ACCOUNT_NOT_ACTIVE', 'This account is not active');
    }
  }

  const user = { id: candidate.id, role: candidate.role, displayName: candidate.displayName, status: candidate.status };
  const tokens = issueTokens(user);
  await recordLoginSuccess(user, toNewSession(user.id, tokens.refreshSession), context);
  return { user, tokens };
}
function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function maskValue(value: string | null, visibleEnd = 2): string {
  if (value === null || value === '') return 'Not recorded';
  if (value.length <= visibleEnd) return '*'.repeat(value.length);
  return `${'*'.repeat(Math.max(3, value.length - visibleEnd))}${value.slice(-visibleEnd)}`;
}

function maskName(value: string): string {
  return value.split(/\s+/u).map((part) => part.length <= 1
    ? '*'
    : `${part[0]}${'*'.repeat(Math.max(2, part.length - 1))}`).join(' ');
}

function maskEmail(value: string | null): string {
  if (value === null) return 'Not recorded';
  const [local, domain] = value.split('@');
  if (domain === undefined) return maskValue(value);
  return `${(local ?? '').slice(0, 1)}***@${domain}`;
}

async function verifiedEmployee(employeeId: string, cnicLastFour: string, context: RequestContext) {
  const normalizedEmployeeId = normalizeEmployeeId(employeeId);
  const candidate = await findEmployeeVerificationCandidate(normalizedEmployeeId);
  const expectedSuffix = candidate?.cnic?.slice(-4) ?? '0000';
  const matches = safeEqual(cnicLastFour, expectedSuffix);
  const unavailable = candidate === null
    || !matches
    || (candidate.lockedUntil !== null && candidate.lockedUntil.getTime() > Date.now())
    || candidate.status === 'inactive';
  if (unavailable) {
    await recordLoginFailure(candidate, normalizedEmployeeId, 'employee', context);
    throw new AppError(401, 'EMPLOYEE_VERIFICATION_FAILED', 'The employee details could not be verified');
  }
  return candidate;
}

export async function verifyEmployeeIdentity(
  employeeId: string,
  cnicLastFour: string,
  context: RequestContext,
) {
  const candidate = await verifiedEmployee(employeeId, cnicLastFour, context);
  return {
    employeeId: maskValue(candidate.employeeId, 4),
    name: maskName(candidate.displayName),
    email: maskEmail(candidate.email),
    phone: maskValue(candidate.phone, 2),
    department: candidate.departmentName,
    office: candidate.office,
  };
}

export async function continueEmployeeLogin(
  employeeId: string,
  cnicLastFour: string,
  context: RequestContext,
) {
  const candidate = await verifiedEmployee(employeeId, cnicLastFour, context);
  const user = {
    id: candidate.id,
    role: candidate.role,
    displayName: candidate.displayName,
    status: candidate.status === 'suspended' ? 'suspended' as const : 'active' as const,
  };
  const tokens = issueTokens(user);
  await recordLoginSuccess(user, toNewSession(user.id, tokens.refreshSession), context);
  return { user, tokens };
}

export async function refresh(refreshToken: string, context: RequestContext) {
  const claims = verifyRefreshToken(refreshToken);
  const userId = Number(claims.sub);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'The refresh session is invalid or expired');
  }

  const material = createRefreshSessionMaterial(claims.familyId);
  const currentJtiHash = hashTokenIdentifier(claims.jti);
  const nextSession: NewRefreshSession = {
    id: material.id,
    familyId: material.familyId,
    userId,
    tokenJtiHash: material.jtiHash,
    expiresAt: material.expiresAt,
  };
  const current = await rotateRefreshSession(
    currentJtiHash,
    userId,
    claims.familyId,
    nextSession,
    context,
  );
  const tokens = issueTokensForSession(current.user, material);
  return { user: current.user, tokens };
}

export async function logout(refreshToken: string | null, context: RequestContext): Promise<void> {
  if (refreshToken === null) return;
  try {
    const claims = verifyRefreshToken(refreshToken);
    await revokeRefreshSession(hashTokenIdentifier(claims.jti), context);
  } catch (error) {
    if (!(error instanceof AppError) || error.code !== 'INVALID_REFRESH_TOKEN') throw error;
  }
}
