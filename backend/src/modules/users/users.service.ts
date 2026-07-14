import { compare, hash } from 'bcryptjs';

import { AppError } from '../../shared/app-error.js';
import type { RequestContext, UserRole } from '../auth/auth.types.js';
import {
  createStaffUser,
  getPasswordHash,
  savePassword,
  updateUserProfile,
} from './users.repository.js';
import type { ProfileUpdateInput, StaffCreateInput } from './users.types.js';

export async function updateProfile(
  userId: number,
  role: UserRole,
  input: ProfileUpdateInput,
  context: RequestContext,
) {
  return updateUserProfile(userId, role, input, context);
}

export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
  context: RequestContext,
): Promise<void> {
  const currentHash = await getPasswordHash(userId);
  if (currentHash === null || !(await compare(currentPassword, currentHash))) {
    throw new AppError(422, 'CURRENT_PASSWORD_INCORRECT', 'The current password is incorrect');
  }
  await savePassword(userId, await hash(newPassword, 12), userId, 'profile.password.changed', context);
}

export async function createStaff(
  input: StaffCreateInput,
  actorId: number,
  context: RequestContext,
) {
  return createStaffUser(input, await hash(input.password, 12), actorId, context);
}

export async function resetUserPassword(
  targetId: number,
  password: string,
  actorId: number,
  context: RequestContext,
): Promise<void> {
  await savePassword(targetId, await hash(password, 12), actorId, 'admin.user.password_reset', context);
}
