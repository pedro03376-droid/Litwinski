import { SetMetadata } from '@nestjs/common';

export enum UserRole {
  ADMIN = 'admin',
  TECHNICAL_STAFF = 'technical_staff',
  VIEWER = 'viewer',
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
