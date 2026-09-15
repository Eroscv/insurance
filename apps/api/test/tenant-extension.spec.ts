import { describe, expect, it } from 'vitest';
import { createTenantExtension, TenantContextMissingError } from '../src/infra/prisma/tenant-extension';

// Testa a lógica de injeção sem banco, interceptando a query.
function fakeClient() {
  const calls: { model: string; operation: string; args: unknown }[] = [];
  const ext = createTenantExtension(() => ({ organizationId: 'org-1', userId: 'u1', role: 'ADMIN' }));
  const noCtx = createTenantExtension(() => undefined);
  // Prisma.defineExtension retorna uma função (client) => client.$extends(...). Simulamos $extends para capturar a query.
  const simulate = (extension: ReturnType<typeof createTenantExtension>) => {
    let allOps: (p: { model: string; operation: string; args: unknown; query: (a: unknown) => unknown }) => unknown = () => undefined;
    const client = {
      $extends(cfg: unknown) {
        const c = typeof cfg === 'function' ? (cfg as (c: unknown) => unknown)(client) : cfg;
        const q = (c as { query: { $allModels: { $allOperations: typeof allOps } } }).query.$allModels.$allOperations;
        allOps = q;
        return client;
      },
    };
    (extension as unknown as (c: unknown) => unknown)(client);
    return (model: string, operation: string, args: unknown) =>
      allOps({ model, operation, args, query: (a) => (calls.push({ model, operation, args: a }), a) });
  };
  return { run: simulate(ext), runNoCtx: simulate(noCtx), calls };
}

describe('tenant extension', () => {
  it('injects organizationId on where/data and deletedAt on reads', async () => {
    const { run } = fakeClient();
    expect(await run('Client', 'findMany', { where: { name: 'x' } })).toEqual({
      where: { deletedAt: null, name: 'x', organizationId: 'org-1' },
    });
    expect(await run('Client', 'create', { data: { name: 'x' } })).toEqual({ data: { name: 'x', organizationId: 'org-1' } });
    expect(await run('Task', 'findMany', {})).toEqual({ where: { organizationId: 'org-1' } });
    expect(await run('Quote', 'findMany', { includeDeleted: true })).toEqual({ where: { organizationId: 'org-1' } });
    expect(await run('Quote', 'createMany', { data: [{ a: 1 }, { a: 2 }] })).toEqual({
      data: [{ a: 1, organizationId: 'org-1' }, { a: 2, organizationId: 'org-1' }],
    });
  });
  it('caller cannot override organizationId', async () => {
    const { run } = fakeClient();
    expect(await run('Client', 'findFirst', { where: { organizationId: 'org-2' } })).toEqual({
      where: { deletedAt: null, organizationId: 'org-1' },
    });
  });
  it('non-tenant models pass through; missing ctx throws', async () => {
    const { run, runNoCtx } = fakeClient();
    expect(await run('Organization', 'findMany', { where: { id: 'o' } })).toEqual({ where: { id: 'o' } });
    await expect(runNoCtx('Client', 'findMany', {})).rejects.toBeInstanceOf(TenantContextMissingError);
  });
});
