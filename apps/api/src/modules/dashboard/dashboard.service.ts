import { Injectable } from '@nestjs/common';
import { QUOTE_OPEN_STATUSES, QUOTE_STATUS_VALUES, type QuoteStatus } from '@insurance/shared';
import { orgId, TenantContext } from '../../common/tenant/tenant-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DocumentsService } from '../documents/documents.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
  ) {}

  async summary() {
    const ctx = TenantContext.require();
    const now = new Date();
    const settings = await this.prisma.tenant.organizationSettings.findUnique({ where: { organizationId: orgId() } });
    const staleLimit = new Date(now.getTime() - (settings?.staleQuoteDays ?? 5) * 24 * 60 * 60 * 1000);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [byStatusRaw, proposalsReceived, overdueTasks, myOpenTasks, staleQuotes, wonMonth, lostMonth, openQuotes] = await Promise.all([
      this.prisma.tenant.quote.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.tenant.proposal.count({ where: { status: { in: ['RECEIVED', 'SELECTED'] }, quoteInsurer: { quote: { deletedAt: null, status: { in: QUOTE_OPEN_STATUSES } } } } }),
      this.prisma.tenant.task.count({ where: { status: { in: ['TODO', 'IN_PROGRESS'] }, dueDate: { lt: now } } }),
      this.prisma.tenant.task.count({ where: { status: { in: ['TODO', 'IN_PROGRESS'] }, userId: ctx.userId! } }),
      this.prisma.tenant.quote.findMany({ where: { status: { in: QUOTE_OPEN_STATUSES }, lastActivityAt: { lt: staleLimit } }, select: { id: true, quoteNumber: true, lastActivityAt: true, client: { select: { name: true } } }, orderBy: { lastActivityAt: 'asc' }, take: 10 }),
      this.prisma.tenant.quote.count({ where: { status: 'WON', closedAt: { gte: monthStart } } }),
      this.prisma.tenant.quote.count({ where: { status: 'LOST', closedAt: { gte: monthStart } } }),
      this.prisma.tenant.quote.findMany({ where: { status: { in: ['NEW', 'WAITING_DOCUMENTS'] } }, select: { id: true, quoteNumber: true, clientId: true, client: { select: { name: true } } }, take: 200 }),
    ]);
    const byStatus: Record<QuoteStatus, number> = Object.fromEntries(QUOTE_STATUS_VALUES.map((s) => [s, 0])) as Record<QuoteStatus, number>;
    for (const row of byStatusRaw) byStatus[row.status] = row._count._all;

    // documentos pendentes: derivado em tempo real (sem job)
    const pendingDocs: { id: string; quoteNumber: number; clientName: string; pending: string[] }[] = [];
    for (const q of openQuotes) {
      const pending = await this.documents.pendingRequiredTypes(q);
      if (pending.length) pendingDocs.push({ id: q.id, quoteNumber: q.quoteNumber, clientName: q.client.name, pending });
    }

    const open = QUOTE_OPEN_STATUSES.reduce((n, s) => n + byStatus[s], 0);
    return {
      cards: {
        open,
        waitingDocuments: byStatus.WAITING_DOCUMENTS,
        proposalsReceived,
        proposalsSent: byStatus.PROPOSAL_SENT + byStatus.NEGOTIATION,
        won: byStatus.WON,
        lost: byStatus.LOST,
        wonMonth,
        lostMonth,
        overdueTasks,
        myOpenTasks,
      },
      byStatus: QUOTE_STATUS_VALUES.map((status) => ({ status, count: byStatus[status] })),
      alerts: { staleQuotes, pendingDocuments: pendingDocs.slice(0, 10), pendingDocumentsTotal: pendingDocs.length },
    };
  }

  async activity(limit = 20) {
    const rows = await this.prisma.tenant.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit, include: { user: { select: { id: true, name: true } } } });
    return rows;
  }
}
