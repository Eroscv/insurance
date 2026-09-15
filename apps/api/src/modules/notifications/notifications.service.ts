import { Injectable } from '@nestjs/common';
import { Prisma, type NotificationType } from '@insurance/database';
import type { ListNotificationsQuery } from '@insurance/shared';
import { pageArgs, toPage } from '../../common/pagination/paginate';
import { TenantContext } from '../../common/tenant/tenant-context';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface NotifyInput {
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  entity?: string;
  entityId?: string;
  /** Chave de idempotência (ex.: data do dia). Com ela, a notificação não se repete. */
  dedupeKey?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ListNotificationsQuery) {
    const { userId } = TenantContext.require();
    const where: Prisma.NotificationWhereInput = { userId: userId!, readAt: q.unreadOnly ? null : undefined };
    const [data, total, unread] = await Promise.all([
      this.prisma.tenant.notification.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(q) }),
      this.prisma.tenant.notification.count({ where }),
      this.prisma.tenant.notification.count({ where: { userId: userId!, readAt: null } }),
    ]);
    return { ...toPage(data, total, q), unread };
  }

  async unreadCount() {
    const { userId } = TenantContext.require();
    return { unread: await this.prisma.tenant.notification.count({ where: { userId: userId!, readAt: null } }) };
  }

  async markRead(id: string) {
    const { userId } = TenantContext.require();
    await this.prisma.tenant.notification.updateMany({ where: { id, userId: userId!, readAt: null }, data: { readAt: new Date() } });
  }

  async markAllRead() {
    const { userId } = TenantContext.require();
    await this.prisma.tenant.notification.updateMany({ where: { userId: userId!, readAt: null }, data: { readAt: new Date() } });
  }

  /** Cria notificação; silenciosamente ignora duplicata por dedupeKey. Funciona dentro ou fora de request. */
  async notify(input: NotifyInput): Promise<boolean> {
    if (input.dedupeKey) {
      const exists = await this.prisma.system.notification.findFirst({
        where: { organizationId: input.organizationId, userId: input.userId, type: input.type, entity: input.entity ?? null, entityId: input.entityId ?? null, dedupeKey: input.dedupeKey },
        select: { id: true },
      });
      if (exists) return false;
    }
    try {
      await this.prisma.system.notification.create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          entity: input.entity ?? null,
          entityId: input.entityId ?? null,
          dedupeKey: input.dedupeKey ?? null,
        },
      });
      return true;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return false;
      throw e;
    }
  }

  /** Notifica o responsável da cotação; sem responsável, todos os ADMINs ativos. */
  async notifyQuoteOwner(quote: { id: string; organizationId: string; assignedUserId: string | null; quoteNumber: number }, input: Omit<NotifyInput, 'organizationId' | 'userId' | 'entity' | 'entityId'>) {
    const targets = quote.assignedUserId
      ? [quote.assignedUserId]
      : (await this.prisma.system.user.findMany({ where: { organizationId: quote.organizationId, role: 'ADMIN', active: true, deletedAt: null }, select: { id: true } })).map((u) => u.id);
    let created = 0;
    for (const userId of targets) {
      if (await this.notify({ ...input, organizationId: quote.organizationId, userId, entity: 'quote', entityId: quote.id })) created++;
    }
    return created;
  }
}
