import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DEDUCTIBLE_TYPE_LABELS, formatBRL, formatCep, formatDate, formatDocument, formatPhone, formatPlate, formatQuoteNumber, FUEL_LABELS, INSURANCE_TYPE_LABELS, installmentTotal } from '@insurance/shared';
import { orgId, TenantContext } from '../../common/tenant/tenant-context';
import { PdfService } from '../../infra/pdf/pdf.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { ProposalsService } from '../proposals/proposals.service';
import { QuotesService } from '../quotes/quotes.service';

@Injectable()
export class ProposalPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly quotes: QuotesService,
    private readonly proposals: ProposalsService,
  ) {}

  /** Monta os dados do template a partir da proposta selecionada (ou de um proposalId explícito). */
  async buildData(quoteId: string, proposalId?: string) {
    const quote = await this.quotes.get(quoteId);
    const all = await this.proposals.listByQuote(quoteId);
    const proposal = proposalId ? all.find((p) => p.id === proposalId) : all.find((p) => p.status === 'SELECTED');
    if (!proposal) throw new BadRequestException(proposalId ? 'Proposta não encontrada.' : 'Selecione uma proposta antes de gerar a proposta comercial.');
    const org = await this.prisma.system.organization.findUniqueOrThrow({ where: { id: orgId() }, include: { settings: true } });
    const ctx = TenantContext.require();
    const broker = quote.assignedUser ? await this.prisma.tenant.user.findUnique({ where: { id: quote.assignedUser.id } }) : await this.prisma.tenant.user.findUnique({ where: { id: ctx.userId! } });
    let logoDataUrl: string | null = null;
    if (org.logoKey) {
      const obj = await this.storage.getObject(org.logoKey).catch(() => null);
      if (obj) logoDataUrl = `data:${obj.contentType ?? 'image/png'};base64,${obj.body.toString('base64')}`;
    }
    const c = quote.client;
    const v = quote.vehicle;
    return {
      generatedAt: new Date().toISOString(),
      organization: {
        name: org.name,
        legalName: org.legalName,
        documentFormatted: org.document ? formatDocument(org.document) : null,
        phoneFormatted: org.phone ? formatPhone(org.phone) : null,
        email: org.email,
        footerText: org.settings?.proposalFooterText ?? null,
        logoDataUrl,
      },
      quote: { number: formatQuoteNumber(quote.quoteNumber), insuranceTypeLabel: INSURANCE_TYPE_LABELS[quote.insuranceType] },
      client: {
        name: c.name,
        documentFormatted: formatDocument(c.document),
        phoneFormatted: c.phone ? formatPhone(c.whatsapp ?? c.phone) : null,
        email: c.email,
        address: [c.street, c.number, c.complement, c.neighborhood, c.city && c.state ? `${c.city}/${c.state}` : c.city, c.zipCode ? `CEP ${formatCep(c.zipCode)}` : null].filter(Boolean).join(', ') || null,
      },
      vehicle: v ? { ...v, plateFormatted: v.plate ? formatPlate(v.plate) : null, fuelLabel: v.fuel ? FUEL_LABELS[v.fuel] : null } : null,
      proposal: {
        id: proposal.id,
        insurerName: proposal.quoteInsurer.insurer.name,
        proposalNumber: proposal.proposalNumber,
        totalAmount: proposal.totalAmount.toString(),
        firstInstallment: proposal.firstInstallment?.toString() ?? null,
        installmentAmount: proposal.installmentAmount?.toString() ?? null,
        installments: proposal.installments,
        isInstallment: proposal.installments > 1,
        installmentTotal: proposal.installmentAmount ? installmentTotal(proposal.installmentAmount.toString(), proposal.installments) : null,
        deductibleAmount: proposal.deductibleAmount?.toString() ?? null,
        deductibleTypeLabel: proposal.deductibleType ? DEDUCTIBLE_TYPE_LABELS[proposal.deductibleType] : null,
        validityDate: proposal.validityDate?.toISOString() ?? null,
        notes: proposal.notes,
        coverages: proposal.coverages.map((x) => ({ ...x, insuredAmount: x.insuredAmount?.toString() ?? null })),
        assistances: proposal.assistances,
      },
      broker: { name: broker?.name ?? ctx.userId, email: broker?.email ?? '', phoneFormatted: broker?.phone ? formatPhone(broker.phone) : null },
    };
  }

  async generate(quoteId: string, proposalId?: string) {
    await this.quotes.getEditable(quoteId);
    const data = await this.buildData(quoteId, proposalId);
    const html = await this.pdf.render('proposal', data);
    const buffer = await this.pdf.htmlToPdf(html);
    const fileName = `proposta-${data.quote.number.replace('#', '')}-${data.proposal.insurerName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;
    const key = this.storage.buildKey(orgId(), `quotes/${quoteId}/generated`, fileName);
    await this.storage.put(key, buffer, 'application/pdf');
    const quote = await this.prisma.tenant.quote.findUniqueOrThrow({ where: { id: quoteId }, select: { clientId: true } });
    const doc = await this.prisma.tenant.document.create({
      data: {
        organizationId: orgId(),
        clientId: quote.clientId,
        quoteId,
        type: 'PROPOSAL',
        fileName,
        storageKey: key,
        mimeType: 'application/pdf',
        size: buffer.length,
        status: 'VALIDATED',
        uploadedById: TenantContext.require().userId!,
        notes: `Proposta comercial gerada — ${data.proposal.insurerName}`,
      },
    });
    await this.audit.record({ entity: 'quote', entityId: quoteId, action: 'SEND', newData: { documentId: doc.id, fileName, proposalId: data.proposal.id, insurer: data.proposal.insurerName } });
    await this.quotes.touch(quoteId);
    return { documentId: doc.id, fileName, url: await this.storage.presignedGetUrl(key, fileName, 60) };
  }

  /** Pré-visualização HTML (mesmo template) — útil para conferência antes do PDF. */
  async previewHtml(quoteId: string, proposalId?: string) {
    const data = await this.buildData(quoteId, proposalId);
    return this.pdf.render('proposal', data);
  }

  /** Texto pronto para copiar (WhatsApp/e-mail). Sem integração: apenas template determinístico. */
  async messageTemplate(quoteId: string) {
    const quote = await this.quotes.get(quoteId);
    const proposals = (await this.proposals.listByQuote(quoteId)).filter((p) => p.status === 'RECEIVED' || p.status === 'SELECTED');
    if (proposals.length === 0) throw new NotFoundException('Nenhuma proposta ativa para montar a mensagem.');
    const first = quote.client.name.split(' ')[0];
    const vehicle = quote.vehicle ? `${quote.vehicle.brand} ${quote.vehicle.model} ${quote.vehicle.modelYear}` : 'seu veículo';
    const lines = proposals
      .sort((a, b) => Number(a.totalAmount) - Number(b.totalAmount))
      .map((p) => {
        const pay = p.installments > 1 ? `${p.installments}x de ${formatBRL(p.installmentAmount?.toString())}` : 'à vista';
        const franquia = p.deductibleAmount ? ` · franquia ${formatBRL(p.deductibleAmount.toString())}` : '';
        return `• ${p.quoteInsurer.insurer.name}: ${formatBRL(p.totalAmount.toString())} (${pay})${franquia}${p.status === 'SELECTED' ? ' ✅ recomendada' : ''}`;
      });
    const validity = proposals.map((p) => p.validityDate).filter(Boolean).sort()[0];
    const text = [
      `Olá, ${first}! Sua cotação de seguro para o ${vehicle} foi concluída. Encontramos as seguintes opções:`,
      '',
      ...lines,
      '',
      validity ? `As propostas são válidas até ${formatDate(validity)}.` : null,
      'Posso te enviar a proposta completa em PDF e tirar qualquer dúvida. Qual opção prefere?',
      '',
      `${quote.assignedUser?.name ?? ''}`.trim(),
    ]
      .filter((l) => l !== null)
      .join('\n');
    return { text };
  }
}
