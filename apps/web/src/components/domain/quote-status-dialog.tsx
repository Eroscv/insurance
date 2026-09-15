'use client';
import {
  allowedTransitions,
  canTransition,
  LOST_REASON_LABELS,
  LOST_REASON_VALUES,
  QUOTE_STATUS_LABELS,
  type LostReason,
  type QuoteSnapshot,
  type QuoteStatus,
  type Role,
} from '@insurance/shared';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { handleApiError } from '@/lib/handle-error';
import { useChangeQuoteStatus, type QuoteDetail } from '@/lib/queries/quotes';

export function snapshotOf(q: Pick<QuoteDetail, 'pendingRequiredDocs' | 'vehicleId' | 'quoteInsurers'>): QuoteSnapshot {
  const proposals = q.quoteInsurers.flatMap((qi) => qi.proposals).filter((p) => p.status === 'RECEIVED' || p.status === 'SELECTED');
  return {
    pendingRequiredDocs: q.pendingRequiredDocs.length,
    hasVehicle: q.vehicleId !== null,
    proposalCount: proposals.length,
    hasSelectedProposal: proposals.some((p) => p.status === 'SELECTED'),
  };
}

interface Props {
  quote: QuoteDetail | null;
  role: Role;
  target?: QuoteStatus | null;
  onOpenChange: (o: boolean) => void;
}

/** Diálogo de mudança de status: valida com a máquina de estados no cliente (UX) e no servidor (verdade). */
export function QuoteStatusDialog({ quote, role, target, onOpenChange }: Props) {
  const change = useChangeQuoteStatus();
  const [status, setStatus] = useState<QuoteStatus | ''>('');
  const [lostReason, setLostReason] = useState<LostReason | ''>('');
  const [lostNotes, setLostNotes] = useState('');
  const [reason, setReason] = useState('');
  useEffect(() => {
    setStatus(target ?? '');
    setLostReason('');
    setLostNotes('');
    setReason('');
  }, [target, quote]);
  if (!quote) return null;
  const options = allowedTransitions(quote.status);
  const snap: QuoteSnapshot = { ...snapshotOf(quote), lostReason: lostReason || null, lostNotes };
  const check = status ? canTransition(quote.status, status, snap, role) : null;

  return (
    <Dialog open={!!quote} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar status</DialogTitle>
          <DialogDescription>Status atual: {QUOTE_STATUS_LABELS[quote.status]}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <FormField label="Novo status" htmlFor="st" required>
            <Select id="st" value={status} onChange={(e) => setStatus(e.target.value as QuoteStatus)}>
              <option value="">Selecione…</option>
              {options.map((s) => <option key={s} value={s}>{QUOTE_STATUS_LABELS[s]}</option>)}
            </Select>
          </FormField>
          {status === 'LOST' ? (
            <>
              <FormField label="Motivo da perda" htmlFor="lr" required>
                <Select id="lr" value={lostReason} onChange={(e) => setLostReason(e.target.value as LostReason)}>
                  <option value="">Selecione…</option>
                  {LOST_REASON_VALUES.map((r) => <option key={r} value={r}>{LOST_REASON_LABELS[r]}</option>)}
                </Select>
              </FormField>
              <FormField label="Detalhes" htmlFor="ln" required={lostReason === 'OTHER'}>
                <Textarea id="ln" rows={2} value={lostNotes} onChange={(e) => setLostNotes(e.target.value)} />
              </FormField>
            </>
          ) : status ? (
            <FormField label="Observação (opcional)" htmlFor="rs">
              <Textarea id="rs" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </FormField>
          ) : null}
          {check && !check.ok ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{check.reason}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!status || !check?.ok}
            loading={change.isPending}
            onClick={async () => {
              if (!status) return;
              try {
                await change.mutateAsync({ id: quote.id, status, lostReason: lostReason || null, lostNotes: lostNotes || null, reason: reason || null });
                toast.success(`Status alterado para ${QUOTE_STATUS_LABELS[status]}.`);
                onOpenChange(false);
              } catch (e) {
                handleApiError(e);
              }
            }}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
