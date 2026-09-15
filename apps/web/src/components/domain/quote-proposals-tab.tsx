'use client';
import { DEDUCTIBLE_TYPE_LABELS, formatBRL, formatDate, installmentTotal } from '@insurance/shared';
import { Check, FileText, Paperclip, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { handleApiError } from '@/lib/handle-error';
import { getProposalFileUrl, useCreateProposal, useDeleteProposal, useProposals, useQuoteInsurers, useSelectProposal, useUpdateProposal, useUploadProposalFile, type Proposal } from '@/lib/queries/proposals';
import type { QuoteDetail } from '@/lib/queries/quotes';
import { ProposalForm } from './proposal-form';
import { ProposalStatusBadge } from './status-badges';
import { cn } from '@/lib/utils';

export function QuoteProposalsTab({ quote }: { quote: QuoteDetail }) {
  const { data: proposals, isLoading } = useProposals(quote.id);
  const { data: insurers } = useQuoteInsurers(quote.id);
  const create = useCreateProposal(quote.id);
  const update = useUpdateProposal(quote.id);
  const select = useSelectProposal(quote.id);
  const del = useDeleteProposal(quote.id);
  const upload = useUploadProposalFile(quote.id);
  const [creating, setCreating] = useState(false);
  const [quoteInsurerId, setQuoteInsurerId] = useState('');
  const [editing, setEditing] = useState<Proposal | null>(null);
  const [deleting, setDeleting] = useState<Proposal | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileTarget, setFileTarget] = useState<string | null>(null);

  const action = <Button onClick={() => { setQuoteInsurerId(insurers?.[0]?.id ?? ''); setCreating(true); }} disabled={!insurers || insurers.length === 0}><Plus /> Registrar proposta</Button>;

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Digite os valores recebidos de cada seguradora. Anexe o PDF original para consulta.</p>
        {action}
      </div>
      {isLoading ? <Skeleton className="h-40" /> : !proposals || proposals.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhuma proposta registrada" description={!insurers || insurers.length === 0 ? 'Adicione seguradoras na aba Seguradoras primeiro.' : 'Registre a primeira proposta recebida.'} action={action} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {proposals.map((p) => (
            <Card key={p.id} className={cn(p.status === 'SELECTED' && 'border-emerald-500 ring-1 ring-emerald-500/40', p.status === 'REJECTED' && 'opacity-70')}>
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <CardTitle>{p.quoteInsurer.insurer.name}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{p.proposalNumber ? `Nº ${p.proposalNumber} · ` : ''}válida até {formatDate(p.validityDate)}</p>
                </div>
                <ProposalStatusBadge status={p.status} />
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div>
                  <p className="text-2xl font-semibold">{formatBRL(p.totalAmount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.installments > 1 ? `${p.installments}x de ${formatBRL(p.installmentAmount)} (total ${formatBRL(installmentTotal(p.installmentAmount ?? '0', p.installments))})` : 'À vista'}
                    {p.firstInstallment ? ` · 1ª ${formatBRL(p.firstInstallment)}` : ''}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-1 text-sm">
                  <dt className="text-muted-foreground">Franquia</dt><dd>{formatBRL(p.deductibleAmount)}{p.deductibleType ? ` · ${DEDUCTIBLE_TYPE_LABELS[p.deductibleType]}` : ''}</dd>
                  <dt className="text-muted-foreground">Coberturas</dt><dd>{p.coverages.filter((c) => c.included).length}</dd>
                  <dt className="text-muted-foreground">Assistências</dt><dd>{p.assistances.filter((a) => a.included).map((a) => a.name).join(', ') || '—'}</dd>
                </dl>
                {p.notes ? <p className="text-xs text-muted-foreground">{p.notes}</p> : null}
                <div className="flex flex-wrap gap-1 border-t pt-3">
                  {p.status !== 'SELECTED' && p.status !== 'EXPIRED' ? (
                    <Button size="sm" onClick={async () => { try { await select.mutateAsync(p.id); toast.success(`Proposta da ${p.quoteInsurer.insurer.name} selecionada.`); } catch (e) { handleApiError(e); } }}><Check /> Selecionar</Button>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)}><Pencil /> Editar</Button>
                  {p.fileName ? (
                    <Button size="sm" variant="outline" onClick={async () => { try { const r = await getProposalFileUrl(p.id); window.open(r.url, '_blank'); } catch (e) { handleApiError(e); } }}><Paperclip /> {p.fileName.length > 18 ? p.fileName.slice(0, 15) + '…' : p.fileName}</Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => { setFileTarget(p.id); fileRef.current?.click(); }}><Paperclip /> Anexar PDF</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setDeleting(p)}><Trash2 /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f || !fileTarget) return; try { await upload.mutateAsync({ id: fileTarget, file: f }); toast.success('Arquivo anexado.'); } catch (err) { handleApiError(err); } finally { e.target.value = ''; } }} />

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Registrar proposta</DialogTitle><DialogDescription>Transcreva os valores da proposta recebida.</DialogDescription></DialogHeader>
          <FormField label="Seguradora" htmlFor="qi" required>
            <Select id="qi" value={quoteInsurerId} onChange={(e) => setQuoteInsurerId(e.target.value)}>
              {insurers?.map((qi) => <option key={qi.id} value={qi.id}>{qi.insurer.name}</option>)}
            </Select>
          </FormField>
          <ProposalForm onCancel={() => setCreating(false)} submitLabel="Registrar" onSubmit={async (v) => { try { await create.mutateAsync({ quoteInsurerId, ...v }); toast.success('Proposta registrada.'); setCreating(false); } catch (e) { handleApiError(e); } }} />
        </DialogContent>
      </Dialog>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Editar proposta — {editing?.quoteInsurer.insurer.name}</DialogTitle></DialogHeader>
          <ProposalForm initial={editing} onCancel={() => setEditing(null)} onSubmit={async (v) => { if (!editing) return; try { await update.mutateAsync({ id: editing.id, ...v }); toast.success('Proposta atualizada.'); setEditing(null); } catch (e) { handleApiError(e); } }} />
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Excluir proposta?" description={deleting ? `${deleting.quoteInsurer.insurer.name} · ${formatBRL(deleting.totalAmount)}` : undefined} confirmLabel="Excluir" destructive loading={del.isPending}
        onConfirm={async () => { if (!deleting) return; try { await del.mutateAsync(deleting.id); toast.success('Proposta excluída.'); setDeleting(null); } catch (e) { handleApiError(e); } }} />
    </>
  );
}
