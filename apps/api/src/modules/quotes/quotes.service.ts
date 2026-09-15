import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, Quote, QuoteStatus } from '@insurance/database';
import {
  canEditQuote,
  canTransition,
  QUOTE_OPEN_STATUSES,
  type ChangeQuoteStatusInput,
  type CreateQuoteInput,
  type ListQuotesQuery,
  type QuoteAutoDetailsInput,
  type QuoteSnapshot,
  type UpdateQuoteInput,
} from '@insurance/shared';
import { pageArgs, parseSort, toPage } from '../../common/pagination/paginate';
import { TenantContext } from '../../common/tenant/tenant-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DocumentsService } from '../documents/documents.service';

export const quoteListInclude = {
  client: { select: { id: true, name: true, document: true, phone: true, whatsapp: true } },
  vehicle: { select: { id: true, brand: true, model: true, version: true, manufacturingYear: true, modelYear: true, plate: true } },
  assignedUser: { select: { id: true, name: true } },
  _count: { select: { quoteInsurers: true, documents: { where: { deletedAt: null } }, tasks: { where: { status: { in: ['TODO', 'IN_PROGRESS'] } } } } },
} satisfies Prisma.QuoteInclude;

const quoteDetailInclude = {
  ...quoteListInclude,
  client: true,
  vehicle: true,
  autoDetails: true,
  quoteInsurers: {
    include: { insurer: { select: { id: true, name: true, logoKey: true } }, proposals: { select: { id: true, status: true, totalAmount: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.QuoteInclude;

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly documents: DocumentsService,
  ) {}

  private buildWhere(q: ListQuotesQuery): Prisma.QuoteWhereInput {
    const digits = q.search?.replace(/\D/g, '') ?? '';
    const asNumber = Number(q.search?.replace('#', ''));
    return {
      status: q.status ? { in: q.status } : q.open === true ? { in: QUOTE_OPEN_STATUSES } : q.open === false ? { in: ['WON', 'LOST', 'CANCELLED'] } : undefined,
      assignedUserId: q.assignedUserId,
      clientId: q.clientId,
      insuranceType: q.insuranceType,
      priority: q.priority,
      quoteInsurers: q.insurerId ? { some: { insurerId: q.insurerId } } : undefined,
      createdAt: q.from || q.to ? { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(`${q.to}T23:59:59.999Z`) : undefined } : undefined,
      OR: q.search
        ? [
            { client: { name: { contains: q.search, mode: 'insensitive' } } },
            ...(digits.length >= 3 ? [{ client: { document: { contains: digits } } }] : []),
            ...(Number.isInteger(asNumber) && asNumber > 0 ? [{ quoteNumber: asNumber }] : []),
            { vehicle: { plate: { contains: q.search.toUpperCase().replace(/[^A-Z0-9]/g, '') } } },
          ]
        : undefined,
    };
  }

  async list(q: ListQuotesQuery) {
    const where = this.buildWhere(q);
    const [data, total] = await Promise.all([
      this.prisma.tenant.quote.findMany({
        where,
        include: quoteListInclude,
        orderBy: parseSort(q.sort, ['createdAt', 'quoteNumber', 'lastActivityAt', 'priority', 'status'], { createdAt: 'desc' }),
        ...pageArgs(q),
      }),
      this.prisma.tenant.quote.count({ where }),
    ]);
    return toPage(data, total, q);
  }

  /** Cotações abertas agrupadas por status (Kanban). */
  async kanban(q: ListQuotesQuery) {
    const where = { ...this.buildWhere({ ...q, open: q.status ? undefined : true }) };
    const rows = await this.prisma.tenant.quote.findMany({ where, include: quoteListInclude, orderBy: { lastActivityAt: 'desc' }, take: 500 });
    const groups: Record<string, typeof rows> = {};
    for (const r of rows) (groups[r.status] ??= []).push(r);
    return groups;
  }

  async get(id: string) {
    const quote = await this.prisma.tenant.quote.findUnique({ where: { id }, include: quoteDetailInclude });
    if (!quote) throw new NotFoundException('Cotação não encontrada.');
    const pendingRequiredDocs = await this.documents.pendingRequiredTypes(quote);
    return { ...quote, pendingRequiredDocs };
  }

  async create(input: CreateQuoteInput) {
    const ctx = TenantContext.require();
    const client = await this.prisma.tenant.client.findUnique({ where: { id: input.clientId }, select: { id: true } });
    if (!client) throw new NotFoundException('Cliente não encontrado.');
    if (input.vehicleId) await this.assertVehicle(input.vehicleId, input.clientId);
    if (input.assignedUserId) await this.assertUser(input.assignedUserId);

    const quote = await this.prisma.system.$transaction(async (tx) => {
      const counter = await tx.organizationQuoteCounter.update({
        where: { organizationId: ctx.organizationId },
        data: { lastNumber: { increment: 1 } },
      });
      const created = await tx.quote.create({
        data: {
          organizationId: ctx.organizationId,
          quoteNumber: counter.lastNumber,
          clientId: input.clientId,
          vehicleId: input.vehicleId ?? null,
          insuranceType: input.insuranceType,
          priority: input.priority,
          assignedUserId: input.assignedUserId ?? ctx.userId,
          notes: input.notes ?? null,
          expiringPremium: input.expiringPremium ?? null,
          autoDetails: input.autoDetails ? { create: this.autoDetailsData(input.autoDetails) } : undefined,
          statusHistory: { create: { organizationId: ctx.organizationId, fromStatus: null, toStatus: 'NEW', userId: ctx.userId } },
        },
      });
      if (input.insurerIds?.length) {
        const insurers = await tx.insurer.findMany({ where: { organizationId: ctx.organizationId, id: { in: input.insurerIds }, active: true, deletedAt: null }, select: { id: true } });
        await tx.quoteInsurer.createMany({
          data: insurers.map((i) => ({ organizationId: ctx.organizationId, quoteId: created.id, insurerId: i.id, createdById: ctx.userId! })),
        });
      }
      return created;
    });
    await this.audit.record({ entity: 'quote', entityId: quote.id, action: 'CREATE', newData: { quoteNumber: quote.quoteNumber, clientId: quote.clientId } });
    return this.get(quote.id);
  }

  async update(id: string, input: UpdateQuoteInput) {
    const before = await this.getEditable(id);
    if (input.vehicleId) await this.assertVehicle(input.vehicleId, before.clientId);
    if (input.assignedUserId && input.assignedUserId !== before.assignedUserId) {
      const ctx = TenantContext.require();
      if (!canEditQuote(ctx.role!, ctx.userId!, before.assignedUserId) || ctx.role === 'BROKER') {
        if (input.assignedUserId !== ctx.userId) throw new ForbiddenException('Apenas gestores podem reatribuir cotações.');
      }
      await this.assertUser(input.assignedUserId);
    }
    const quote = await this.prisma.tenant.quote.update({
      where: { id },
      data: { vehicleId: input.vehicleId, priority: input.priority, assignedUserId: input.assignedUserId, notes: input.notes, expiringPremium: input.expiringPremium, lastActivityAt: new Date() },
    });
    await this.audit.record({ entity: 'quote', entityId: id, action: 'UPDATE', oldData: this.pick(before), newData: this.pick(quote) });
    return this.get(id);
  }

  async updateAutoDetails(id: string, input: QuoteAutoDetailsInput) {
    const quote = await this.getEditable(id);
    const before = await this.prisma.system.quoteAutoDetails.findUnique({ where: { quoteId: id } });
    const data = this.autoDetailsData(input);
    const details = await this.prisma.system.quoteAutoDetails.upsert({ where: { quoteId: quote.id }, update: data, create: { ...data, quoteId: quote.id } });
    await this.prisma.tenant.quote.update({ where: { id }, data: { lastActivityAt: new Date() } });
    await this.audit.record({ entity: 'quote', entityId: id, action: 'UPDATE', oldData: before ?? undefined, newData: details });
    return details;
  }

  async assign(id: string, assignedUserId: string | null) {
    const before = await this.get(id);
    if (assignedUserId) await this.assertUser(assignedUserId);
    const quote = await this.prisma.tenant.quote.update({ where: { id }, data: { assignedUserId, lastActivityAt: new Date() } });
    await this.audit.record({ entity: 'quote', entityId: id, action: 'UPDATE', oldData: { assignedUserId: before.assignedUserId }, newData: { assignedUserId: quote.assignedUserId } });
    return this.get(id);
  }

  /** Snapshot determinístico usado pelos guards da máquina de estados. */
  async snapshot(quote: { id: string; clientId: string; vehicleId: string | null }, extra?: Partial<QuoteSnapshot>): Promise<QuoteSnapshot> {
    const [pending, proposals] = await Promise.all([
      this.documents.pendingRequiredTypes(quote),
      this.prisma.tenant.proposal.findMany({ where: { quoteInsurer: { quoteId: quote.id }, status: { in: ['RECEIVED', 'SELECTED'] } }, select: { status: true } }),
    ]);
    return {
      pendingRequiredDocs: pending.length,
      hasVehicle: quote.vehicleId !== null,
      proposalCount: proposals.length,
      hasSelectedProposal: proposals.some((p) => p.status === 'SELECTED'),
      ...extra,
    };
  }

  async changeStatus(id: string, input: ChangeQuoteStatusInput) {
    const quote = await this.getEditable(id);
    const ctx = TenantContext.require();
    const snap = await this.snapshot(quote, { lostReason: input.lostReason ?? null, lostNotes: input.lostNotes ?? null });
    const result = canTransition(quote.status, input.status, snap, ctx.role!);
    if (!result.ok) throw new BadRequestException(result.reason);
    await this.applyStatus(quote, input.status, ctx.userId, input.reason ?? null, { lostReason: input.lostReason ?? null, lostNotes: input.lostNotes ?? null });
    return this.get(id);
  }

  /**
   * Transição automática determinística (efeitos de sistema). Ignora silenciosamente se a máquina não permitir.
   * Usa o contexto do request; retorna true se aplicou.
   */
  async autoTransition(quoteId: string, to: QuoteStatus, reason: string): Promise<boolean> {
    const quote = await this.prisma.tenant.quote.findUnique({ where: { id: quoteId } });
    if (!quote || quote.status === to) return false;
    const snap = await this.snapshot(quote);
    if (!canTransition(quote.status, to, snap).ok) return false;
    await this.applyStatus(quote, to, TenantContext.get()?.userId ?? null, reason);
    return true;
  }

  private async applyStatus(quote: Quote, to: QuoteStatus, userId: string | null, reason: string | null, lost?: { lostReason: Quote['lostReason']; lostNotes: string | null }) {
    const terminal = to === 'WON' || to === 'LOST' || to === 'CANCELLED';
    await this.prisma.system.$transaction([
      this.prisma.system.quote.update({
        where: { id: quote.id },
        data: {
          status: to,
          closedAt: terminal ? new Date() : null,
          lostReason: to === 'LOST' ? lost?.lostReason ?? null : null,
          lostNotes: to === 'LOST' ? lost?.lostNotes ?? null : null,
          lastActivityAt: new Date(),
        },
      }),
      this.prisma.system.quoteStatusHistory.create({
        data: { organizationId: quote.organizationId, quoteId: quote.id, fromStatus: quote.status, toStatus: to, userId, reason },
      }),
    ]);
    await this.audit.record({
      organizationId: quote.organizationId,
      userId,
      entity: 'quote',
      entityId: quote.id,
      action: 'STATUS_CHANGE',
      oldData: { status: quote.status },
      newData: { status: to, reason, lostReason: to === 'LOST' ? lost?.lostReason : undefined },
    });
  }

  async history(id: string) {
    await this.get(id);
    const [statusHistory, childIds] = await Promise.all([
      this.prisma.tenant.quoteStatusHistory.findMany({ where: { quoteId: id }, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true } } } }),
      Promise.all([
        this.prisma.tenant.document.findMany({ where: { quoteId: id }, select: { id: true } }),
        this.prisma.tenant.quoteInsurer.findMany({ where: { quoteId: id }, select: { id: true, proposals: { select: { id: true } } } }),
        this.prisma.tenant.task.findMany({ where: { quoteId: id }, select: { id: true } }),
      ]),
    ]);
    const [docs, qis, tasks] = childIds;
    const ids = [id, ...docs.map((d) => d.id), ...qis.map((q) => q.id), ...qis.flatMap((q) => q.proposals.map((p) => p.id)), ...tasks.map((t) => t.id)];
    const auditLogs = await this.prisma.tenant.auditLog.findMany({ where: { entityId: { in: ids } }, orderBy: { createdAt: 'desc' }, take: 300, include: { user: { select: { id: true, name: true } } } });
    return { statusHistory, auditLogs };
  }

  async remove(id: string) {
    const quote = await this.get(id);
    await this.prisma.tenant.quote.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record({ entity: 'quote', entityId: id, action: 'DELETE', oldData: { quoteNumber: quote.quoteNumber } });
  }

  /** Garante existência e permissão de edição (BROKER só edita as próprias/sem responsável). */
  async getEditable(id: string) {
    const quote = await this.prisma.tenant.quote.findUnique({ where: { id } });
    if (!quote) throw new NotFoundException('Cotação não encontrada.');
    const ctx = TenantContext.require();
    if (!canEditQuote(ctx.role!, ctx.userId!, quote.assignedUserId)) throw new ForbiddenException('Esta cotação pertence a outro corretor.');
    return quote;
  }

  /** Atualiza lastActivityAt (chamado por módulos filhos). */
  touch(id: string) {
    return this.prisma.tenant.quote.update({ where: { id }, data: { lastActivityAt: new Date() } });
  }

  private async assertVehicle(vehicleId: string, clientId: string) {
    const v = await this.prisma.tenant.vehicle.findUnique({ where: { id: vehicleId }, select: { clientId: true } });
    if (!v || v.clientId !== clientId) throw new BadRequestException('Veículo não pertence ao cliente.');
  }
  private async assertUser(userId: string) {
    const u = await this.prisma.tenant.user.findUnique({ where: { id: userId }, select: { active: true } });
    if (!u || !u.active) throw new BadRequestException('Usuário responsável inválido.');
  }
  private autoDetailsData(input: QuoteAutoDetailsInput): Omit<Prisma.QuoteAutoDetailsUncheckedCreateInput, 'quoteId'> {
    return {
      mainDriverName: input.mainDriverName ?? null,
      mainDriverDocument: input.mainDriverDocument ?? null,
      mainDriverBirthDate: input.mainDriverBirthDate ? new Date(input.mainDriverBirthDate) : null,
      maritalStatus: input.maritalStatus ?? null,
      profession: input.profession ?? null,
      residenceZipCode: input.residenceZipCode ?? null,
      vehicleUsage: input.vehicleUsage ?? null,
      annualMileage: input.annualMileage ?? null,
      hasHomeGarage: input.hasHomeGarage ?? null,
      hasWorkGarage: input.hasWorkGarage ?? null,
      commercialUse: input.commercialUse ?? null,
      appUsage: input.appUsage ?? null,
      numberOfDrivers: input.numberOfDrivers ?? null,
      deductibleType: input.deductibleType ?? null,
      desiredCoverage: input.desiredCoverage ?? null,
    };
  }
  private pick(q: Quote) {
    return { vehicleId: q.vehicleId, priority: q.priority, assignedUserId: q.assignedUserId, notes: q.notes };
  }
}
