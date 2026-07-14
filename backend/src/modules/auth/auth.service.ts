import { compare, hash } from 'bcryptjs';

import { AppError } from '../../shared/app-error.js';
import {
  findLoginCandidate,
  recordLoginFailure,
  recordLoginSuccess,
  registerConsumer,
  registerEmployee,
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
  ConsumerRegistrationInput,
  EmployeeRegistrationInput,
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
  const candidate = await findLoginCandidate(mode, identifier);
  const passwordMatches = await compare(password, candidate?.passwordHash ?? dummyPasswordHash);

  if (candidate === null || !passwordMatches) {
    await recordLoginFailure(candidate, identifier, mode, context);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'The identifier or password is incorrect');
  }
  if (candidate.lockedUntil !== null && candidate.lockedUntil.getTime() > Date.now()) {
    await recordLoginFailure(candidate, identifier, mode, context);
    throw new AppError(429, 'ACCOUNT_TEMPORARILY_LOCKED', 'Too many login attempts; try again later');
  }
  if (candidate.status === 'suspended') {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended');
  }
  if (candidate.status !== 'active') {
    throw new AppError(403, 'ACCOUNT_NOT_ACTIVE', 'This account is not active');
  }

  const user = { id: candidate.id, role: candidate.role, displayName: candidate.displayName };
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

export async function createConsumerAccount(
  input: ConsumerRegistrationInput,
  context: RequestContext,
) {
  return registerConsumer(input, await hash(input.password, 12), context);
}

export async function createEmployeeAccount(
  input: EmployeeRegistrationInput,
  context: RequestContext,
) {
  return registerEmployee(input, await hash(input.password, 12), context);
}

