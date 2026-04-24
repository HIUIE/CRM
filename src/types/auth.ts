export type UserRole = 'admin' | 'staff';

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  name: string;
  active?: boolean;
}
