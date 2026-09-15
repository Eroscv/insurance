import { AsyncLocalStorage } from 'node:async_hooks';
import type { Role } from '@insurance/database';

export interface TenantCtx {
  organizationId: string;
  userId: string | null;
  role: Role | null;
}

const als = new AsyncLocalStorage<TenantCtx>();

export const TenantContext = {
  run<T>(ctx: TenantCtx, fn: () => T): T {
    return als.run(ctx, fn);
  },
  get(): TenantCtx | undefined {
    return als.getStore();
  },
  require(): TenantCtx {
    const ctx = als.getStore();
    if (!ctx) throw new Error('TenantContext ausente: operação exige contexto de organização.');
    return ctx;
  },
};
