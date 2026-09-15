import { Injectable } from '@nestjs/common';
import { commission, hasPermission, Permission, QUOTE_OPEN_STATUSES, QUOTE_STATUS_VALUES, type QuoteStatus } from '@insurance/shared';
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
    const defaultCommission = settings?.commissionPercentage.toString() ?? '0';

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

    // --- indicadores financeiros: prêmio/comissão realizados no mês e receita projetada do pipeline ---
    const [wonSelectedThisMonth, pipelineSelected] = await Promise.all([
      this.prisma.tenant.proposal.findMany({
        where: { status: 'SELECTED', quoteInsurer: { quote: { status: 'WON', closedAt: { gte: monthStart }, deletedAt: null } } },
        select: { totalAmount: true, commissionPercentage: true, quoteInsurer: { select: { quote: { select: { assignedUserId: true } } } } },
      }),
      this.prisma.tenant.proposal.findMany({
        where: { status: 'SELECTED', quoteInsurer: { quote: { status: { in: QUOTE_OPEN_STATUSES }, deletedAt: null } } },
        select: { totalAmount: true, commissionPercentage: true },
      }),
    ]);
    const sumMoney = (rows: { totalAmount: { toString(): string } }[]) =>
      rows.reduce((acc, r) => acc + Number(r.totalAmount.toString()), 0).toFixed(2);
    const sumCommission = (rows: { totalAmount: { toString(): string }; commissionPercentage: { toString(): string } | null }[]) =>
      rows.reduce((acc, r) => acc + Number(commission(r.totalAmount.toString(), r.commissionPercentage?.toString() ?? defaultCommission)), 0).toFixed(2);

    const wonPremiumMonth = sumMoney(wonSelectedThisMonth);
    const wonCommissionMonth = sumCommission(wonSelectedThisMonth);
    const projectedCommission = sumCommission(pipelineSelected);
    const monthlyGoal = settings?.monthlyRevenueGoal?.toString() ?? null;
    const goalProgressPercent = monthlyGoal && Number(monthlyGoal) > 0 ? ((Number(wonPremiumMonth) / Number(monthlyGoal)) * 100).toFixed(1) : null;

    // --- evolução dos últimos 6 meses (incluindo o atual) ---
    const monthlyEvolution: { month: string; won: number; wonPremium: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
      const [won, selected] = await Promise.all([
        this.prisma.tenant.quote.count({ where: { status: 'WON', closedAt: { gte: start, lt: end } } }),
        this.prisma.tenant.proposal.findMany({
          where: { status: 'SELECTED', quoteInsurer: { quote: { status: 'WON', closedAt: { gte: start, lt: end }, deletedAt: null } } },
          select: { totalAmount: true },
        }),
      ]);
      monthlyEvolution.push({ month: start.toISOString().slice(0, 7), won, wonPremium: sumMoney(selected) });
    }

    // --- ranking de corretores no mês (apenas para quem pode ver todos: ADMIN/MANAGER) ---
    let brokerRanking: { userId: string; name: string; wonCount: number; wonPremium: string }[] | null = null;
    if (hasPermission(ctx.role!, Permission.QUOTES_REASSIGN)) {
      const byUser = new Map<string, { wonCount: number; wonPremium: number }>();
      for (const row of wonSelectedThisMonth) {
        const userId = row.quoteInsurer.quote.assignedUserId;
        if (!userId) continue;
        const acc = byUser.get(userId) ?? { wonCount: 0, wonPremium: 0 };
        acc.wonCount += 1;
        acc.wonPremium += Number(row.totalAmount.toString());
        byUser.set(userId, acc);
      }
      const users = await this.prisma.tenant.user.findMany({ where: { id: { in: [...byUser.keys()] } }, select: { id: true, name: true } });
      brokerRanking = users
        .map((u) => ({ userId: u.id, name: u.name, wonCount: byUser.get(u.id)!.wonCount, wonPremium: byUser.get(u.id)!.wonPremium.toFixed(2) }))
        .sort((a, b) => Number(b.wonPremium) - Number(a.wonPremium));
    }

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
      financial: {
        wonPremiumMonth,
        wonCommissionMonth,
        projectedCommission,
        monthlyGoal,
        goalProgressPercent,
      },
      byStatus: QUOTE_STATUS_VALUES.map((status) => ({ status, count: byStatus[status] })),
      monthlyEvolution,
      brokerRanking,
      alerts: { staleQuotes, pendingDocuments: pendingDocs.slice(0, 10), pendingDocumentsTotal: pendingDocs.length },
    };
  }

  async activity(limit = 20) {
    const rows = await this.prisma.tenant.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit, include: { user: { select: { id: true, name: true } } } });
    return rows;
  }
}
