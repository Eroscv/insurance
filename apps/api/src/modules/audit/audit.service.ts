import { Injectable } from '@nestjs/common';
import type { AuditAction, Prisma } from '@insurance/database';
import { TenantContext } from '../../common/tenant/tenant-context';
import { type PrismaService } from '../../infra/prisma/prisma.service';

const REDACTED_KEYS = new Set(['passwordHash', 'password', 'tokenHash', 'storageKey']);

export function sanitize(data: unknown): Prisma.InputJsonValue | undefined {
  if (data === null || data === undefined) return undefined;
  return JSON.parse(
    JSON.stringify(data, (key, value) => {
      if (REDACTED_KEYS.has(key)) return undefined;
      if (typeof value === 'bigint') return value.toString();
      return value;
    }),
  ) as Prisma.InputJsonValue;
}

export interface AuditEntry {
  entity: string;
  entityId: string;
  action: AuditAction;
  oldData?: unknown;
  newData?: unknown;
  /** Para chamadas fora de request (crons), informar organizationId/userId explicitamente. */
  organizationId?: string;
  userId?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    const ctx = TenantContext.get();
    const organizationId = entry.organizationId ?? ctx?.organizationId;
    if (!organizationId) throw new Error('AuditService.record sem organizationId');
    const userId = entry.userId !== undefined ? entry.userId : (ctx?.userId ?? null);
    await this.prisma.forOrganization(organizationId).auditLog.create({
      data: {
        organizationId,
        userId,
        entity: entry.entity,
        entityId: entry.entityId,
        action: entry.action,
        oldData: sanitize(entry.oldData),
        newData: sanitize(entry.newData),
      },
    });
  }
}
