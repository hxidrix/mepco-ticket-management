import { createHash, randomUUID } from 'node:crypto';

import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';

import { env } from '../../config/env.js';
import { AppError } from '../../shared/app-error.js';
import type { AuthenticatedUser, UserRole } from './auth.types.js';

interface RefreshClaims extends JwtPayload {
  sub: string;
  type: 'refresh';
  familyId: string;
  jti: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresInSeconds: number;
  refreshSession: {
    id: string;
    familyId: string;
    jtiHash: string;
    expiresAt: Date;
  };
}

export interface RefreshSessionMaterial {
  id: string;
  familyId: string;
  jti: string;
  jtiHash: string;
  expiresAt: Date;
}

function isRole(value: unknown): value is UserRole {
  return ['consumer', 'employee', 'technician', 'supervisor', 'administrator'].includes(
    String(value),
  );
}

export function hashTokenIdentifier(identifier: string): string {
  return createHash('sha256').update(identifier).digest('hex');
}

export function createRefreshSessionMaterial(
  familyId: string = randomUUID(),
): RefreshSessionMaterial {
  const jti = randomUUID();
  const refreshExpiresInSeconds = env.refreshTokenTtlDays * 86_400;
  return {
    id: randomUUID(),
    familyId,
    jti,
    jtiHash: hashTokenIdentifier(jti),
    expiresAt: new Date(Date.now() + refreshExpiresInSeconds * 1_000),
  };
}

export function issueTokensForSession(
  user: AuthenticatedUser,
  material: RefreshSessionMaterial,
): IssuedTokens {
  const accessJti = randomUUID();
  const accessExpiresInSeconds = env.accessTokenTtlMinutes * 60;
  const refreshExpiresInSeconds = env.refreshTokenTtlDays * 86_400;

  const accessToken = jwt.sign(
    { type: 'access', role: user.role, displayName: user.displayName },
    env.jwtAccessSecret,
    { subject: String(user.id), jwtid: accessJti, expiresIn: accessExpiresInSeconds },
  );
  const refreshToken = jwt.sign(
    { type: 'refresh', familyId: material.familyId },
    env.jwtRefreshSecret,
    { subject: String(user.id), jwtid: material.jti, expiresIn: refreshExpiresInSeconds },
  );

  return {
    accessToken,
    refreshToken,
    accessExpiresInSeconds,
    refreshSession: {
      id: material.id,
      familyId: material.familyId,
      jtiHash: material.jtiHash,
      expiresAt: material.expiresAt,
    },
  };
}

export function issueTokens(user: AuthenticatedUser, familyId?: string): IssuedTokens {
  return issueTokensForSession(user, createRefreshSessionMaterial(familyId));
}

export function verifyAccessToken(token: string): AuthenticatedUser {
  try {
    const claims = jwt.verify(token, env.jwtAccessSecret);
    if (
      typeof claims === 'string' ||
      claims.type !== 'access' ||
      typeof claims.sub !== 'string' ||
      typeof claims.displayName !== 'string' ||
      !isRole(claims.role)
    ) {
      throw new Error('Invalid access claims');
    }
    const id = Number(claims.sub);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid subject');
    return { id, role: claims.role, displayName: claims.displayName };
  } catch {
    throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'Your session is invalid or has expired');
  }
}

export function verifyRefreshToken(token: string): RefreshClaims {
  try {
    const claims = jwt.verify(token, env.jwtRefreshSecret);
    if (
      typeof claims === 'string' ||
      claims.type !== 'refresh' ||
      typeof claims.sub !== 'string' ||
      typeof claims.familyId !== 'string' ||
      typeof claims.jti !== 'string'
    ) {
      throw new Error('Invalid refresh claims');
    }
    return claims as RefreshClaims;
  } catch {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'The refresh session is invalid or expired');
  }
}
