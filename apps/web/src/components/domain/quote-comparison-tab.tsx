'use client';
import { DEDUCTIBLE_TYPE_LABELS, formatBRL, formatDate, type DeductibleType } from '@insurance/shared';
import { Check, Copy, FileDown, Scale, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { handleApiError } from '@/lib/handle-error';
import { getMessageTemplate, useComparison, useGenerateProposalPdf, type ComparisonColumn } from '@/lib/queries/comparison';
import { useSelectProposal } from '@/lib/queries/proposals';
import type { QuoteDetail } from '@/lib/queries/quotes';
import { cn } from '@/lib/utils';

function Cell({ children, best, className }: { children: React.ReactNode; best?: boolean; className?: string }) {
  return <td className={cn('border-b px-3 py-2 text-center align-middle text-sm', best && 'bg-emerald-50 font-semibold text-emerald-800', className)}>{children}</td>;
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <th className="sticky left-0 border-b bg-card px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{label}</th>
      {children}
    </tr>
  );
}
const YesNo = ({ v }: { v: boolean | undefined }) => (v === undefined ? <span className="text-muted-foreground">—</span> : v ? <Check className="mx-auto size-4 text-emerald-700" /> : <X className="mx-auto size-4 text-red-600" />);

export function QuoteComparisonTab({ quote }: { quote: QuoteDetail }) {
  const { data, isLoading } = useComparison(quote.id);
  const select = useSelectProposal(quote.id);
  const generate = useGenerateProposalPdf(quote.id);
  const [copying, setCopying] = useState(false);

  if (isLoading || !data) return <Skeleton className="h-64" />;
  if (data.columns.length === 0) return <EmptyState icon={Scale} title="Nada para comparar" description="Registre pelo menos uma proposta na aba Propostas." />;
  const cols = data.columns;
  const isBestPremium = (c: ComparisonColumn) => data.highlights.lowestPremiumIds.includes(c.proposalId);
  const isBestDeductible = (c: ComparisonColumn) => data.highlights.lowestDeductibleIds.includes(c.proposalId);
  const selected = cols.find((c) => c.status === 'SELECTED');

  const copyMessage = async () => {
    setCopying(true);
    try {
      const { text } = await getMessageTemplate(quote.id);
      await navigator.clipboard.writeText(text);
      toast.success('Mensagem copiada. Cole no WhatsApp ou e-mail.');
    } catch (e) {
      handleApiError(e, 'Não foi possível copiar.');
    } finally {
      setCopying(false);
    }
  };
  const generatePdf = async () => {
    try {
      const r = await generate.mutateAsync(undefined);
      toast.success(`Proposta comercial gerada: ${r.fileName}`);
      window.open(r.url, '_blank');
    } catch (e) {
      handleApiError(e);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Destaques calculados por regra: <Badge variant="success">menor prêmio</Badge> e <Badge variant="success">menor franquia</Badge>. Diferenças em relação à mais barata.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyMessage} loading={copying}><Copy /> Copiar mensagem</Button>
          <Button onClick={generatePdf} loading={generate.isPending} disabled={!selected} title={selected ? undefined : 'Selecione uma proposta primeiro'}><FileDown /> Gerar proposta PDF</Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left text-xs text-muted-foreground uppercase">Seguradora</th>
              {cols.map((c) => (
                <th key={c.proposalId} className={cn('bg-muted/50 px-3 py-2 text-center', c.status === 'SELECTED' && 'bg-emerald-100')}>
                  <div className="font-semibold">{c.insurerName}</div>
                  <div className="mt-1 flex justify-center gap-1">
                    {c.status === 'SELECTED' ? <Badge variant="success">Selecionada</Badge> : c.status === 'EXPIRED' ? <Badge variant="destructive">Vencida</Badge> : (
                      <Button size="sm" variant="outline" onClick={async () => { try { await select.mutateAsync(c.proposalId); toast.success(`${c.insurerName} selecionada.`); } catch (e) { handleApiError(e); } }}>Selecionar</Button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label="Prêmio total">{cols.map((c) => <Cell key={c.proposalId} best={isBestPremium(c)} className="text-base">{formatBRL(c.totalAmount)}</Cell>)}</Row>
            <Row label="Diferença">{cols.map((c) => <Cell key={c.proposalId}>{Number(c.difference) === 0 ? <span className="text-muted-foreground">—</span> : `+${formatBRL(c.difference)} (${c.percentageDifference}%)`}</Cell>)}</Row>
            <Row label="Pagamento">{cols.map((c) => <Cell key={c.proposalId}>{c.installments > 1 ? `${c.installments}x ${formatBRL(c.installmentAmount)}` : 'À vista'}{c.firstInstallment ? <div className="text-xs text-muted-foreground">1ª {formatBRL(c.firstInstallment)}</div> : null}</Cell>)}</Row>
            <Row label="Total parcelado">{cols.map((c) => <Cell key={c.proposalId}>{c.installmentTotal ? formatBRL(c.installmentTotal) : '—'}</Cell>)}</Row>
            <Row label="Franquia">{cols.map((c) => <Cell key={c.proposalId} best={isBestDeductible(c)}>{formatBRL(c.deductibleAmount)}{c.deductibleType ? <div className="text-xs font-normal text-muted-foreground">{DEDUCTIBLE_TYPE_LABELS[c.deductibleType as DeductibleType]}</div> : null}</Cell>)}</Row>
            <Row label="Comissão">{cols.map((c) => <Cell key={c.proposalId}><span className="text-muted-foreground">{c.commissionPercentage}% · </span>{formatBRL(c.commissionAmount)}</Cell>)}</Row>
            <Row label="Validade">{cols.map((c) => <Cell key={c.proposalId}>{formatDate(c.validityDate)}</Cell>)}</Row>
            {data.coverageNames.length ? <tr><th colSpan={cols.length + 1} className="bg-muted/30 px-3 py-1.5 text-left text-xs font-semibold uppercase text-muted-foreground">Coberturas</th></tr> : null}
            {data.coverageNames.map((name) => (
              <Row key={name} label={name}>{cols.map((c) => { const cv = c.coverages[name]; return <Cell key={c.proposalId}>{!cv ? <span className="text-muted-foreground">—</span> : cv.included ? (cv.insuredAmount ? formatBRL(cv.insuredAmount) : <Check className="mx-auto size-4 text-emerald-700" />) : <X className="mx-auto size-4 text-red-600" />}</Cell>; })}</Row>
            ))}
            {data.assistanceNames.length ? <tr><th colSpan={cols.length + 1} className="bg-muted/30 px-3 py-1.5 text-left text-xs font-semibold uppercase text-muted-foreground">Assistências</th></tr> : null}
            {data.assistanceNames.map((name) => (
              <Row key={name} label={name}>{cols.map((c) => <Cell key={c.proposalId}><YesNo v={c.assistances[name]} /></Cell>)}</Row>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
