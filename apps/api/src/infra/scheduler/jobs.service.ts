import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { formatDate, formatQuoteNumber, QUOTE_OPEN_STATUSES } from '@insurance/shared';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const today = () => new Date().toISOString().slice(0, 10);
const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * Automações tradicionais baseadas em datas e regras. Idempotentes por dedupeKey.
 * Cada job é público para poder ser executado por testes.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Cotação parada: aberta e sem atividade há mais de `staleQuoteDays` dias. */
  @Cron('0 7 * * *')
  async staleQuotes(now = new Date()): Promise<number> {
    const orgs = await this.prisma.system.organization.findMany({ include: { settings: true } });
    let count = 0;
    for (const org of orgs) {
      const days = org.settings?.staleQuoteDays ?? 5;
      const limit = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const quotes = await this.prisma.system.quote.findMany({ where: { organizationId: org.id, deletedAt: null, status: { in: QUOTE_OPEN_STATUSES }, lastActivityAt: { lt: limit } }, include: { client: { select: { name: true } } } });
      for (const q of quotes) {
        count += await this.notifications.notifyQuoteOwner(q, {
          type: 'STALE_QUOTE',
          title: `Cotação ${formatQuoteNumber(q.quoteNumber)} parada há mais de ${days} dias`,
          body: `${q.client.name} · última atividade em ${formatDate(q.lastActivityAt)}`,
          dedupeKey: today(),
        });
      }
    }
    this.logger.log(`staleQuotes: ${count} notificação(ões)`);
    return count;
  }

  /** Propostas vencendo em 3 dias → tarefa + notificação; vencidas → EXPIRED. */
  @Cron('5 7 * * *')
  async expiringProposals(now = new Date()): Promise<{ expiring: number; expired: number }> {
    const day = startOfUtcDay(now);
    const in3 = new Date(day.getTime() + 3 * 24 * 60 * 60 * 1000);
    const expiring = await this.prisma.system.proposal.findMany({
      where: { status: { in: ['RECEIVED', 'SELECTED'] }, validityDate: in3, quoteInsurer: { quote: { deletedAt: null, status: { in: QUOTE_OPEN_STATUSES } } } },
      include: { quoteInsurer: { include: { insurer: { select: { name: true } }, quote: true } } },
    });
    let created = 0;
    for (const p of expiring) {
      const quote = p.quoteInsurer.quote;
      const ok = await this.notifications.notifyQuoteOwner(quote, {
        type: 'PROPOSAL_EXPIRING',
        title: `Proposta da ${p.quoteInsurer.insurer.name} vence em 3 dias`,
        body: `Cotação ${formatQuoteNumber(quote.quoteNumber)} · validade ${formatDate(p.validityDate)}`,
        dedupeKey: p.id,
      });
      if (ok > 0) {
        const owner = quote.assignedUserId ?? (await this.prisma.system.user.findFirst({ where: { organizationId: quote.organizationId, role: 'ADMIN', active: true }, select: { id: true } }))?.id;
        if (owner) {
          await this.prisma.system.task.create({
            data: { organizationId: quote.organizationId, userId: owner, createdById: owner, quoteId: quote.id, clientId: quote.clientId, title: `Proposta ${p.quoteInsurer.insurer.name} vence em ${formatDate(p.validityDate)} — fazer follow-up`, priority: 'HIGH', dueDate: new Date(in3.getTime() - 24 * 60 * 60 * 1000) },
          });
        }
        created++;
      }
    }
    const expired = await this.prisma.system.proposal.updateMany({ where: { status: { in: ['RECEIVED', 'SELECTED'] }, validityDate: { lt: day } }, data: { status: 'EXPIRED' } });
    this.logger.log(`expiringProposals: ${created} aviso(s), ${expired.count} vencida(s)`);
    return { expiring: created, expired: expired.count };
  }

  /** Tarefas vencidas: notifica o dono uma vez por dia. */
  @Cron('0 * * * *')
  async overdueTasks(now = new Date()): Promise<number> {
    const tasks = await this.prisma.system.task.findMany({ where: { status: { in: ['TODO', 'IN_PROGRESS'] }, dueDate: { lt: now } }, include: { quote: { select: { quoteNumber: true } } } });
    let count = 0;
    for (const t of tasks) {
      const ok = await this.notifications.notify({
        organizationId: t.organizationId,
        userId: t.userId,
        type: 'TASK_OVERDUE',
        title: `Tarefa atrasada: ${t.title}`,
        body: t.quote ? `Cotação ${formatQuoteNumber(t.quote.quoteNumber)} · vencia em ${formatDate(t.dueDate)}` : `Vencia em ${formatDate(t.dueDate)}`,
        entity: 'task',
        entityId: t.id,
        dedupeKey: today(),
      });
      if (ok) count++;
    }
    this.logger.log(`overdueTasks: ${count} notificação(ões)`);
    return count;
  }
}
