import type { UserRole } from './user.schema';

export interface AuthenticatedUser {
  sub: string;
  username: string;
  role: UserRole;
  playerId?: string;
}

export interface UserSummary {
  id: string;
  username: string;
  role: UserRole;
  playerId?: string;
}
