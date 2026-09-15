import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@insurance/database';
import { TenantContext, type TenantCtx } from '../../common/tenant/tenant-context';
import { createTenantExtension } from './tenant-extension';

function buildTenantClient(base: PrismaClient, getCtx: () => TenantCtx | undefined) {
  return base.$extends(createTenantExtension(getCtx));
}
export type TenantPrisma = ReturnType<typeof buildTenantClient>;

/**
 * - `prisma.tenant`  → client estendido; usa o TenantContext da requisição (padrão nos módulos).
 * - `prisma.forOrganization(id)` → client estendido preso a uma organização (crons, seed, auth).
 * - `prisma.system` → client cru, SEM filtro de tenant. Restrito a infra/auth.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  readonly system: PrismaClient;
  readonly tenant: TenantPrisma;

  constructor() {
    this.system = new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });
    this.tenant = buildTenantClient(this.system, () => TenantContext.get());
  }

  forOrganization(organizationId: string, userId: string | null = null): TenantPrisma {
    return buildTenantClient(this.system, () => ({ organizationId, userId, role: null }));
  }

  async onModuleInit() {
    await this.system.$connect();
    this.logger.log('Conectado ao banco de dados');
  }

  async onModuleDestroy() {
    await this.system.$disconnect();
  }
}
