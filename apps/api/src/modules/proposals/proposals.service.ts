import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@insurance/database';
import type { ProposalInput } from '@insurance/shared';
import { orgId } from '../../common/tenant/tenant-context';
import type { Env } from '../../config/env';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { validateUpload, type UploadedFile } from '../../infra/storage/upload';
import { AuditService } from '../audit/audit.service';
import { QuoteInsurersService } from '../quote-insurers/quote-insurers.service';
import { QuotesService } from '../quotes/quotes.service';

export const proposalInclude = {
  coverages: { orderBy: { name: 'asc' as const } },
  assistances: { orderBy: { name: 'asc' as const } },
  quoteInsurer: { select: { id: true, quoteId: true, insurer: { select: { id: true, name: true, logoKey: true } } } },
} satisfies Prisma.ProposalInclude;

@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly quotes: QuotesService,
    private readonly quoteInsurers: QuoteInsurersService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async listByQuote(quoteId: string) {
    await this.quotes.get(quoteId);
    return this.prisma.tenant.proposal.findMany({ where: { quoteInsurer: { quoteId } }, include: proposalInclude, orderBy: { createdAt: 'asc' } });
  }

  async get(id: string) {
    const p = await this.prisma.tenant.proposal.findUnique({ where: { id }, include: proposalInclude });
    if (!p) throw new NotFoundException('Proposta não encontrada.');
    return p;
  }

  async create(quoteInsurerId: string, input: ProposalInput) {
    const qi = await this.quoteInsurers.get(quoteInsurerId);
    const quote = await this.quotes.getEditable(qi.quoteId);
    const validityDate = input.validityDate ? new Date(input.validityDate) : await this.defaultValidity();
    const proposal = await this.prisma.tenant.proposal.create({
      data: {
        ...this.toData(input),
        organizationId: orgId(),
        quoteInsurerId,
        validityDate,
        coverages: { create: input.coverages.map((c) => ({ name: c.name, insuredAmount: c.insuredAmount ?? null, included: c.included, notes: c.notes ?? null })) },
        assistances: { create: input.assistances.map((a) => ({ name: a.name, included: a.included, description: a.description ?? null })) },
      },
      include: proposalInclude,
    });
    await this.quoteInsurers.markReceived(quoteInsurerId);
    await this.audit.record({ entity: 'proposal', entityId: proposal.id, action: 'CREATE', newData: { insurer: qi.insurer.name, totalAmount: proposal.totalAmount, quoteId: qi.quoteId } });
    await this.quotes.touch(qi.quoteId);
    // Primeira proposta: QUOTING → WAITING_PROPOSALS → PROPOSALS_RECEIVED (efeito determinístico; máquina valida cada passo)
    if (quote.status === 'QUOTING') await this.quotes.autoTransition(qi.quoteId, 'WAITING_PROPOSALS', 'auto:first_proposal');
    if (quote.status === 'QUOTING' || quote.status === 'WAITING_PROPOSALS') await this.quotes.autoTransition(qi.quoteId, 'PROPOSALS_RECEIVED', 'auto:first_proposal');
    return this.get(proposal.id);
  }

  async update(id: string, input: ProposalInput) {
    const before = await this.get(id);
    await this.quotes.getEditable(before.quoteInsurer.quoteId);
    const proposal = await this.prisma.system.$transaction(async (tx) => {
      await tx.proposalCoverage.deleteMany({ where: { proposalId: id } });
      await tx.proposalAssistance.deleteMany({ where: { proposalId: id } });
      return tx.proposal.update({
        where: { id },
        data: {
          ...this.toData(input),
          validityDate: input.validityDate ? new Date(input.validityDate) : before.validityDate,
          coverages: { create: input.coverages.map((c) => ({ name: c.name, insuredAmount: c.insuredAmount ?? null, included: c.included, notes: c.notes ?? null })) },
          assistances: { create: input.assistances.map((a) => ({ name: a.name, included: a.included, description: a.description ?? null })) },
        },
        include: proposalInclude,
      });
    });
    await this.audit.record({ entity: 'proposal', entityId: id, action: 'UPDATE', oldData: { totalAmount: before.totalAmount, installments: before.installments }, newData: { totalAmount: proposal.totalAmount, installments: proposal.installments } });
    await this.quotes.touch(before.quoteInsurer.quoteId);
    return proposal;
  }

  /** Seleciona a proposta: as demais RECEIVED/SELECTED da cotação voltam para RECEIVED/REJECTED. */
  async select(id: string) {
    const proposal = await this.get(id);
    await this.quotes.getEditable(proposal.quoteInsurer.quoteId);
    if (proposal.status === 'EXPIRED') throw new BadRequestException('Proposta vencida não pode ser selecionada.');
    const quoteId = proposal.quoteInsurer.quoteId;
    await this.prisma.system.$transaction([
      this.prisma.system.proposal.updateMany({ where: { organizationId: orgId(), quoteInsurer: { quoteId }, id: { not: id }, status: { in: ['SELECTED', 'RECEIVED'] } }, data: { status: 'REJECTED' } }),
      this.prisma.system.proposal.update({ where: { id }, data: { status: 'SELECTED' } }),
    ]);
    await this.audit.record({ entity: 'proposal', entityId: id, action: 'SELECT_PROPOSAL', oldData: { status: proposal.status }, newData: { status: 'SELECTED', insurer: proposal.quoteInsurer.insurer.name, totalAmount: proposal.totalAmount } });
    await this.quotes.touch(quoteId);
    return this.get(id);
  }

  async uploadFile(id: string, file: UploadedFile | undefined) {
    const proposal = await this.get(id);
    await this.quotes.getEditable(proposal.quoteInsurer.quoteId);
    const mime = validateUpload(file, this.config.get('MAX_UPLOAD_MB', { infer: true }));
    const key = this.storage.buildKey(orgId(), `quotes/${proposal.quoteInsurer.quoteId}/proposals`, file!.originalname);
    await this.storage.put(key, file!.buffer, mime);
    if (proposal.storageKey) await this.storage.delete(proposal.storageKey).catch(() => undefined);
    await this.prisma.tenant.proposal.update({ where: { id }, data: { storageKey: key, fileName: file!.originalname.slice(0, 255) } });
    await this.audit.record({ entity: 'proposal', entityId: id, action: 'UPLOAD', newData: { fileName: file!.originalname } });
    return this.get(id);
  }

  async fileUrl(id: string) {
    const proposal = await this.get(id);
    if (!proposal.storageKey) throw new NotFoundException('Proposta sem arquivo anexado.');
    return { url: await this.storage.presignedGetUrl(proposal.storageKey, proposal.fileName ?? undefined, 60), fileName: proposal.fileName };
  }

  async remove(id: string) {
    const proposal = await this.get(id);
    await this.quotes.getEditable(proposal.quoteInsurer.quoteId);
    await this.prisma.tenant.proposal.delete({ where: { id } });
    if (proposal.storageKey) await this.storage.delete(proposal.storageKey).catch(() => undefined);
    await this.audit.record({ entity: 'proposal', entityId: id, action: 'DELETE', oldData: { insurer: proposal.quoteInsurer.insurer.name, totalAmount: proposal.totalAmount } });
    await this.quotes.touch(proposal.quoteInsurer.quoteId);
  }

  private async defaultValidity(): Promise<Date> {
    const settings = await this.prisma.tenant.organizationSettings.findUnique({ where: { organizationId: orgId() } });
    const days = settings?.proposalValidityDays ?? 7;
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }

  private toData(input: ProposalInput) {
    return {
      proposalNumber: input.proposalNumber ?? null,
      totalAmount: input.totalAmount,
      firstInstallment: input.firstInstallment ?? null,
      installmentAmount: input.installmentAmount ?? null,
      installments: input.installments,
      deductibleAmount: input.deductibleAmount ?? null,
      deductibleType: input.deductibleType ?? null,
      commissionPercentage: input.commissionPercentage ?? null,
      notes: input.notes ?? null,
    };
  }
}
