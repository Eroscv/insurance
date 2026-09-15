import { Injectable } from '@nestjs/common';
import { breakdownGrossPremium, commission, differencesFromCheapest, highlightBest, installmentTotal, renewalComparison, type RenewalComparison } from '@insurance/shared';
import { orgId } from '../../common/tenant/tenant-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ProposalsService } from '../proposals/proposals.service';

export interface ComparisonColumn {
  proposalId: string;
  insurerId: string;
  insurerName: string;
  status: string;
  proposalNumber: string | null;
  totalAmount: string;
  firstInstallment: string | null;
  installmentAmount: string | null;
  installments: number;
  installmentTotal: string | null;
  deductibleAmount: string | null;
  deductibleType: string | null;
  validityDate: string | null;
  commissionPercentage: string;
  commissionAmount: string;
  netPremium: string;
  iofAmount: string;
  difference: string;
  percentageDifference: string | null;
  renewal: RenewalComparison | null;
  coverages: Record<string, { included: boolean; insuredAmount: string | null }>;
  assistances: Record<string, boolean>;
}

export interface Comparison {
  columns: ComparisonColumn[];
  coverageNames: string[];
  assistanceNames: string[];
  highlights: { lowestPremiumIds: string[]; lowestDeductibleIds: string[] };
  iofRatePercent: string;
  /** Prêmio da apólice vigente, se informado na cotação (fluxo de renovação). */
  expiringPremium: string | null;
}

/** Comparativo determinístico: apenas regras matemáticas (menor valor, diferenças). */
@Injectable()
export class ComparisonService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly proposals: ProposalsService,
  ) {}

  async forQuote(quoteId: string): Promise<Comparison> {
    const [proposals, settings, quote] = await Promise.all([
      this.proposals.listByQuote(quoteId),
      this.prisma.tenant.organizationSettings.findUnique({ where: { organizationId: orgId() } }),
      this.prisma.tenant.quote.findUnique({ where: { id: quoteId }, select: { expiringPremium: true } }),
    ]);
    const active = proposals.filter((p) => p.status !== 'REJECTED');
    const defaultCommission = settings?.commissionPercentage.toString() ?? '0';
    const iofRatePercent = settings?.iofRatePercent.toString() ?? '7.38';
    const expiringPremium = quote?.expiringPremium?.toString() ?? null;
    const coverageNames = [...new Set(active.flatMap((p) => p.coverages.map((c) => c.name)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const assistanceNames = [...new Set(active.flatMap((p) => p.assistances.map((a) => a.name)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const comparable = active.map((p) => ({ id: p.id, totalAmount: p.totalAmount.toString(), deductibleAmount: p.deductibleAmount?.toString() ?? null }));
    const highlights = highlightBest(comparable);
    const diffs = differencesFromCheapest(comparable);

    const columns: ComparisonColumn[] = active.map((p) => {
      const pct = p.commissionPercentage?.toString() ?? defaultCommission;
      const breakdown = breakdownGrossPremium(p.totalAmount.toString(), iofRatePercent);
      return {
        proposalId: p.id,
        insurerId: p.quoteInsurer.insurer.id,
        insurerName: p.quoteInsurer.insurer.name,
        status: p.status,
        proposalNumber: p.proposalNumber,
        totalAmount: p.totalAmount.toString(),
        firstInstallment: p.firstInstallment?.toString() ?? null,
        installmentAmount: p.installmentAmount?.toString() ?? null,
        installments: p.installments,
        installmentTotal: p.installmentAmount ? installmentTotal(p.installmentAmount.toString(), p.installments) : null,
        deductibleAmount: p.deductibleAmount?.toString() ?? null,
        deductibleType: p.deductibleType,
        validityDate: p.validityDate ? p.validityDate.toISOString().slice(0, 10) : null,
        commissionPercentage: pct,
        commissionAmount: commission(p.totalAmount.toString(), pct),
        netPremium: breakdown.netPremium,
        iofAmount: breakdown.iofAmount,
        difference: diffs[p.id]?.difference ?? '0.00',
        percentageDifference: diffs[p.id]?.percentage ?? null,
        renewal: expiringPremium ? renewalComparison(p.totalAmount.toString(), expiringPremium) : null,
        coverages: Object.fromEntries(p.coverages.map((c) => [c.name, { included: c.included, insuredAmount: c.insuredAmount?.toString() ?? null }])),
        assistances: Object.fromEntries(p.assistances.map((a) => [a.name, a.included])),
      };
    });
    return { columns, coverageNames, assistanceNames, highlights, iofRatePercent, expiringPremium };
  }
}
