'use client';
import { formatBRL, formatDateTime, QUOTE_INSURER_STATUS_LABELS, QUOTE_INSURER_STATUS_VALUES, type QuoteInsurerStatus } from '@insurance/shared';
import { Building2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { handleApiError } from '@/lib/handle-error';
import { useInsurerOptions } from '@/lib/queries/insurers';
import { useAddQuoteInsurers, useQuoteInsurers, useRemoveQuoteInsurer, useUpdateQuoteInsurer, type QuoteInsurerFull } from '@/lib/queries/proposals';
import type { QuoteDetail } from '@/lib/queries/quotes';
import { QuoteInsurerStatusBadge } from './status-badges';
import { cn } from '@/lib/utils';

export function QuoteInsurersTab({ quote }: { quote: QuoteDetail }) {
  const { data, isLoading } = useQuoteInsurers(quote.id);
  const update = useUpdateQuoteInsurer(quote.id);
  const remove = useRemoveQuoteInsurer(quote.id);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<QuoteInsurerFull | null>(null);
  const action = <Button onClick={() => setAdding(true)}><Plus /> Adicionar seguradoras</Button>;

  const setStatus = async (qi: QuoteInsurerFull, status: QuoteInsurerStatus) => {
    try { await update.mutateAsync({ id: qi.id, status }); toast.success(`${qi.insurer.name}: ${QUOTE_INSURER_STATUS_LABELS[status]}`); } catch (e) { handleApiError(e); }
  };
  const saveNotes = async (qi: QuoteInsurerFull, notes: string) => {
    if ((qi.notes ?? '') === notes) return;
    try { await update.mutateAsync({ id: qi.id, notes }); } catch (e) { handleApiError(e); }
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Registre manualmente o andamento de cada consulta. Nenhuma integração automática.</p>
        {action}
      </div>
      {isLoading ? <TableSkeleton /> : !data || data.length === 0 ? (
        <EmptyState icon={Building2} title="Nenhuma seguradora consultada" description="Adicione as seguradoras para começar a cotar." action={action} />
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Seguradora</TableHead><TableHead>Status</TableHead><TableHead>Solicitada</TableHead><TableHead>Respondida</TableHead><TableHead>Propostas</TableHead><TableHead>Observações</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
          <TableBody>
            {data.map((qi) => (
              <TableRow key={qi.id}>
                <TableCell className="font-medium">{qi.insurer.name}{qi.insurer.email ? <p className="text-xs font-normal text-muted-foreground">{qi.insurer.email}</p> : null}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <QuoteInsurerStatusBadge status={qi.status} />
                    <Select value={qi.status} onChange={(e) => setStatus(qi, e.target.value as QuoteInsurerStatus)} className="w-40">
                      {QUOTE_INSURER_STATUS_VALUES.map((s) => <option key={s} value={s}>{QUOTE_INSURER_STATUS_LABELS[s]}</option>)}
                    </Select>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(qi.requestedAt)}</TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(qi.respondedAt)}</TableCell>
                <TableCell>{qi.proposals.length > 0 ? qi.proposals.map((p) => <span key={p.id} className={cn('block text-sm', p.status === 'SELECTED' && 'font-semibold text-emerald-700')}>{formatBRL(p.totalAmount)}</span>) : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell><Input defaultValue={qi.notes ?? ''} placeholder="Ex.: aguardando retorno do corretor" onBlur={(e) => saveNotes(qi, e.target.value)} className="min-w-48" /></TableCell>
                <TableCell><Button variant="ghost" size="icon" title="Remover" disabled={qi.proposals.length > 0} onClick={() => setRemoving(qi)}><Trash2 /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <AddInsurersDialog quoteId={quote.id} open={adding} onOpenChange={setAdding} existing={(data ?? []).map((q) => q.insurerId)} />
      <ConfirmDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)} title="Remover consulta?" description={removing?.insurer.name} confirmLabel="Remover" destructive loading={remove.isPending}
        onConfirm={async () => { if (!removing) return; try { await remove.mutateAsync(removing.id); toast.success('Consulta removida.'); setRemoving(null); } catch (e) { handleApiError(e); } }} />
    </>
  );
}

function AddInsurersDialog({ quoteId, open, onOpenChange, existing }: { quoteId: string; open: boolean; onOpenChange: (o: boolean) => void; existing: string[] }) {
  const { data: insurers } = useInsurerOptions();
  const add = useAddQuoteInsurers(quoteId);
  const [selected, setSelected] = useState<string[]>([]);
  const available = (insurers ?? []).filter((i) => !existing.includes(i.id));
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setSelected([]); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adicionar seguradoras</DialogTitle><DialogDescription>Selecione as seguradoras a consultar nesta cotação.</DialogDescription></DialogHeader>
        {available.length === 0 ? <p className="text-sm text-muted-foreground">Todas as seguradoras ativas já foram adicionadas.</p> : (
          <div className="grid gap-2 sm:grid-cols-2">
            {available.map((i) => {
              const checked = selected.includes(i.id);
              return (
                <label key={i.id} className={cn('flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm hover:bg-muted', checked && 'border-primary bg-primary/5')}>
                  <Checkbox checked={checked} onCheckedChange={(c) => setSelected(c ? [...selected, i.id] : selected.filter((x) => x !== i.id))} />{i.name}
                </label>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={selected.length === 0} loading={add.isPending} onClick={async () => { try { await add.mutateAsync(selected); toast.success('Seguradoras adicionadas.'); onOpenChange(false); setSelected([]); } catch (e) { handleApiError(e); } }}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
