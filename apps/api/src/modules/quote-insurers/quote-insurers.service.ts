import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, QuoteInsurerStatus } from '@insurance/database';
import type { UpdateQuoteInsurerInput } from '@insurance/shared';
import { orgId, TenantContext } from '../../common/tenant/tenant-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { QuotesService } from '../quotes/quotes.service';

const include = {
  insurer: { select: { id: true, name: true, logoKey: true, email: true, phone: true } },
  createdBy: { select: { id: true, name: true } },
  proposals: { orderBy: { createdAt: 'asc' as const }, include: { coverages: true, assistances: true } },
} satisfies Prisma.QuoteInsurerInclude;

@Injectable()
export class QuoteInsurersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly quotes: QuotesService,
  ) {}

  async listByQuote(quoteId: string) {
    await this.quotes.get(quoteId);
    return this.prisma.tenant.quoteInsurer.findMany({ where: { quoteId }, include, orderBy: { createdAt: 'asc' } });
  }

  async add(quoteId: string, insurerIds: string[]) {
    const quote = await this.quotes.getEditable(quoteId);
    const insurers = await this.prisma.tenant.insurer.findMany({ where: { id: { in: insurerIds }, active: true }, select: { id: true, name: true } });
    if (insurers.length === 0) throw new BadRequestException('Nenhuma seguradora ativa selecionada.');
    const existing = await this.prisma.tenant.quoteInsurer.findMany({ where: { quoteId }, select: { insurerId: true } });
    const have = new Set(existing.map((e) => e.insurerId));
    const toCreate = insurers.filter((i) => !have.has(i.id));
    const ctx = TenantContext.require();
    if (toCreate.length) {
      await this.prisma.tenant.quoteInsurer.createMany({ data: toCreate.map((i) => ({ organizationId: orgId(), quoteId, insurerId: i.id, createdById: ctx.userId! })) });
      for (const i of toCreate) await this.audit.record({ entity: 'quote_insurer', entityId: quoteId, action: 'CREATE', newData: { insurer: i.name } });
    }
    await this.quotes.touch(quoteId);
    if (quote.status === 'DATA_COMPLETE') await this.quotes.autoTransition(quoteId, 'QUOTING', 'auto:insurers_added');
    return this.listByQuote(quoteId);
  }

  async update(id: string, input: UpdateQuoteInsurerInput) {
    const qi = await this.get(id);
    await this.quotes.getEditable(qi.quoteId);
    const data: Prisma.QuoteInsurerUpdateInput = { notes: input.notes };
    if (input.status && input.status !== qi.status) {
      data.status = input.status;
      if (input.status === 'REQUESTED' && !qi.requestedAt) data.requestedAt = new Date();
      if (['RECEIVED', 'REFUSED', 'NO_RESPONSE'].includes(input.status)) data.respondedAt = new Date();
    }
    const updated = await this.prisma.tenant.quoteInsurer.update({ where: { id }, data, include });
    if (input.status && input.status !== qi.status) {
      await this.audit.record({ entity: 'quote_insurer', entityId: id, action: 'STATUS_CHANGE', oldData: { status: qi.status }, newData: { status: input.status, insurer: qi.insurer.name } });
      await this.maybeAdvanceToWaitingProposals(qi.quoteId);
    }
    await this.quotes.touch(qi.quoteId);
    return updated;
  }

  async remove(id: string) {
    const qi = await this.get(id);
    await this.quotes.getEditable(qi.quoteId);
    if (qi.proposals.length > 0) throw new BadRequestException('Consulta possui propostas registradas. Exclua as propostas primeiro.');
    await this.prisma.tenant.quoteInsurer.delete({ where: { id } });
    await this.audit.record({ entity: 'quote_insurer', entityId: qi.quoteId, action: 'DELETE', oldData: { insurer: qi.insurer.name } });
    await this.quotes.touch(qi.quoteId);
  }

  async get(id: string) {
    const qi = await this.prisma.tenant.quoteInsurer.findUnique({ where: { id }, include });
    if (!qi) throw new NotFoundException('Consulta não encontrada.');
    return qi;
  }

  /** Marca a consulta como RECEIVED quando uma proposta é registrada. */
  async markReceived(id: string) {
    await this.prisma.tenant.quoteInsurer.update({ where: { id }, data: { status: 'RECEIVED', respondedAt: new Date() } });
  }

  /** QUOTING → WAITING_PROPOSALS quando todas as consultas ativas estiverem solicitadas/aguardando. */
  private async maybeAdvanceToWaitingProposals(quoteId: string) {
    const all = await this.prisma.tenant.quoteInsurer.findMany({ where: { quoteId }, select: { status: true } });
    const active = all.filter((q) => q.status !== 'CANCELLED');
    const pending: QuoteInsurerStatus[] = ['REQUESTED', 'WAITING', 'RECEIVED', 'REFUSED', 'NO_RESPONSE'];
    if (active.length > 0 && active.every((q) => pending.includes(q.status))) {
      await this.quotes.autoTransition(quoteId, 'WAITING_PROPOSALS', 'auto:all_insurers_requested');
    }
  }
}
