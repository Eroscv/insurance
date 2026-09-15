import { describe, expect, it } from 'vitest';
import { canEditQuote, hasPermission, Permission } from './permissions';

describe('permissions', () => {
  it('ADMIN has everything', () => {
    for (const p of Object.values(Permission)) expect(hasPermission('ADMIN', p)).toBe(true);
  });
  it('MANAGER cannot manage org/users/insurers', () => {
    expect(hasPermission('MANAGER', Permission.ORG_MANAGE)).toBe(false);
    expect(hasPermission('MANAGER', Permission.USERS_MANAGE)).toBe(false);
    expect(hasPermission('MANAGER', Permission.INSURERS_MANAGE)).toBe(false);
    expect(hasPermission('MANAGER', Permission.QUOTES_REASSIGN)).toBe(true);
  });
  it('BROKER only operates', () => {
    expect(hasPermission('BROKER', Permission.OPERATE)).toBe(true);
    expect(hasPermission('BROKER', Permission.RECORDS_DELETE)).toBe(false);
  });
  it('canEditQuote respects assignment for BROKER', () => {
    expect(canEditQuote('BROKER', 'u1', 'u1')).toBe(true);
    expect(canEditQuote('BROKER', 'u1', null)).toBe(true);
    expect(canEditQuote('BROKER', 'u1', 'u2')).toBe(false);
    expect(canEditQuote('MANAGER', 'u1', 'u2')).toBe(true);
  });
});
