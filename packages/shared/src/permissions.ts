import type { Role } from './enums';

export const Permission = {
  ORG_MANAGE: 'org:manage',
  USERS_MANAGE: 'users:manage',
  INSURERS_MANAGE: 'insurers:manage',
  QUOTES_EDIT_ANY: 'quotes:edit_any',
  QUOTES_REASSIGN: 'quotes:reassign',
  QUOTES_REOPEN: 'quotes:reopen',
  RECORDS_DELETE: 'records:delete',
  OPERATE: 'operate',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

const MATRIX: Record<Role, ReadonlySet<Permission>> = {
  ADMIN: new Set(Object.values(Permission)),
  MANAGER: new Set([
    Permission.QUOTES_EDIT_ANY,
    Permission.QUOTES_REASSIGN,
    Permission.QUOTES_REOPEN,
    Permission.RECORDS_DELETE,
    Permission.OPERATE,
  ]),
  BROKER: new Set([Permission.OPERATE]),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return MATRIX[role].has(permission);
}

/** BROKER só edita cotações atribuídas a si ou sem responsável. */
export function canEditQuote(role: Role, userId: string, assignedUserId: string | null): boolean {
  if (hasPermission(role, Permission.QUOTES_EDIT_ANY)) return true;
  return assignedUserId === null || assignedUserId === userId;
}
