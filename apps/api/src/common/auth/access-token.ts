import type { Role } from '@insurance/database';

export interface AccessTokenPayload {
  sub: string;
  org: string;
  role: Role;
  email: string;
  name: string;
}
export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
