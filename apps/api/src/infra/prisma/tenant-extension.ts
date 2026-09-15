import { Prisma, type PrismaClient } from '@insurance/database';
import type { TenantCtx } from '../../common/tenant/tenant-context';

/** Models que possuem organizationId e devem ser filtrados automaticamente. */
export const TENANT_MODELS = new Set<string>([
  'User',
  'OrganizationSettings',
  'OrganizationQuoteCounter',
  'Client',
  'Vehicle',
  'Document',
  'Quote',
  'QuoteStatusHistory',
  'Insurer',
  'QuoteInsurer',
  'Proposal',
  'Task',
  'Notification',
  'AuditLog',
]);

/** Models com soft delete (deletedAt). */
export const SOFT_DELETE_MODELS = new Set<string>(['User', 'Client', 'Vehicle', 'Document', 'Quote', 'Insurer']);

const WHERE_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
]);
const READ_OPS = new Set(['findMany', 'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow', 'count', 'aggregate', 'groupBy']);
const CREATE_OPS = new Set(['create', 'createMany', 'createManyAndReturn']);

type AnyArgs = Record<string, unknown> & { where?: Record<string, unknown>; data?: unknown; create?: Record<string, unknown>; includeDeleted?: boolean };

export class TenantContextMissingError extends Error {
  constructor(model: string, operation: string) {
    super(`Contexto de organização ausente em ${model}.${operation}.`);
  }
}

/**
 * Cria um Prisma Client estendido que injeta organizationId (tenant) e deletedAt: null (soft delete)
 * em todas as operações dos models tenantizados. Fonte da regra crítica de isolamento.
 */
export function createTenantExtension(getCtx: () => TenantCtx | undefined) {
  return Prisma.defineExtension((client) =>
    client.$extends({
      name: 'tenant',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const a = (args ?? {}) as AnyArgs;
            const isTenant = TENANT_MODELS.has(model);
            const isSoft = SOFT_DELETE_MODELS.has(model);
            const includeDeleted = a.includeDeleted === true;
            delete a.includeDeleted;

            if (isTenant) {
              const ctx = getCtx();
              if (!ctx) throw new TenantContextMissingError(model, operation);
              const orgId = ctx.organizationId;

              if (WHERE_OPS.has(operation)) {
                a.where = { ...(a.where ?? {}), organizationId: orgId };
              }
              if (CREATE_OPS.has(operation)) {
                if (Array.isArray(a.data)) {
                  a.data = a.data.map((d) => ({ ...(d as object), organizationId: orgId }));
                } else if (a.data && typeof a.data === 'object') {
                  a.data = { ...(a.data as object), organizationId: orgId };
                }
              }
              if (operation === 'upsert' && a.create) {
                a.create = { ...a.create, organizationId: orgId };
              }
            }

            if (isSoft && !includeDeleted && READ_OPS.has(operation)) {
              a.where = { deletedAt: null, ...(a.where ?? {}) };
            }
            if (isSoft && !includeDeleted && (operation === 'update' || operation === 'updateMany')) {
              a.where = { deletedAt: null, ...(a.where ?? {}) };
            }

            return query(a as never);
          },
        },
      },
    }),
  );
}

export type TenantClient = ReturnType<PrismaClient['$extends']>;
