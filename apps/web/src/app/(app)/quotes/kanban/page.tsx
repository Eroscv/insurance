'use client';
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { canTransition, formatPlate, formatQuoteNumber, QUOTE_PIPELINE, QUOTE_STATUS_LABELS, type QuoteStatus } from '@insurance/shared';
import { List, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { QuoteFilters } from '@/components/domain/quote-filters';
import { PriorityBadge } from '@/components/domain/status-badges';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { handleApiError } from '@/lib/handle-error';
import { useMe } from '@/lib/queries/auth';
import { useChangeQuoteStatus, useKanban, type QuoteFilters as Filters, type QuoteRow } from '@/lib/queries/quotes';
import { cn } from '@/lib/utils';

const COLUMNS: QuoteStatus[] = QUOTE_PIPELINE;

function Card({ q, dragging }: { q: QuoteRow; dragging?: boolean }) {
  return (
    <div className={cn('rounded-md border bg-card p-3 text-sm shadow-xs', dragging && 'opacity-90 shadow-md')}>
      <div className="mb-1 flex items-center justify-between">
        <Link href={`/quotes/${q.id}`} className="font-mono text-xs text-muted-foreground hover:underline" onClick={(e) => e.stopPropagation()}>{formatQuoteNumber(q.quoteNumber)}</Link>
        <PriorityBadge priority={q.priority} />
      </div>
      <p className="font-medium leading-tight">{q.client.name}</p>
      <p className="text-xs text-muted-foreground">{q.vehicle ? `${q.vehicle.brand} ${q.vehicle.model}${q.vehicle.plate ? ' · ' + formatPlate(q.vehicle.plate) : ''}` : 'Sem veículo'}</p>
      <p className="mt-1 text-xs text-muted-foreground">{q.assignedUser?.name ?? 'Sem responsável'}</p>
    </div>
  );
}

function DraggableCard({ q }: { q: QuoteRow }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: q.id, data: q });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={cn('cursor-grab touch-none active:cursor-grabbing', isDragging && 'opacity-30')}>
      <Card q={q} />
    </div>
  );
}

function Column({ status, items, active }: { status: QuoteStatus; items: QuoteRow[]; active: QuoteRow | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const allowed = active ? canTransition(active.status, status, { pendingRequiredDocs: 0, hasVehicle: true, proposalCount: 1, hasSelectedProposal: true, lostReason: 'PRICE' }).ok : true;
  return (
    <div ref={setNodeRef} className={cn('flex w-64 shrink-0 flex-col rounded-lg bg-muted/60 p-2', isOver && allowed && 'ring-2 ring-primary', active && !allowed && 'opacity-50')}>
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{QUOTE_STATUS_LABELS[status]}</span>
        <span className="rounded-full bg-background px-2 text-xs">{items.length}</span>
      </div>
      <div className="flex min-h-24 flex-col gap-2">
        {items.map((q) => <DraggableCard key={q.id} q={q} />)}
      </div>
    </div>
  );
}

export default function KanbanPage() {
  const { data: me } = useMe();
  const [filters, setFilters] = useState<Filters>({});
  const { data, isLoading } = useKanban(filters);
  const change = useChangeQuoteStatus();
  const [active, setActive] = useState<QuoteRow | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = async (e: DragEndEvent) => {
    const q = e.active.data.current as QuoteRow | undefined;
    const to = e.over?.id as QuoteStatus | undefined;
    setActive(null);
    if (!q || !to || to === q.status) return;
    // validação otimista com snapshot permissivo; o servidor aplica os guards reais
    const pre = canTransition(q.status, to, { pendingRequiredDocs: 0, hasVehicle: true, proposalCount: 1, hasSelectedProposal: true, lostReason: 'PRICE' }, me?.role ?? 'BROKER');
    if (!pre.ok) return toast.error(pre.reason);
    try {
      await change.mutateAsync({ id: q.id, status: to });
      toast.success(`${formatQuoteNumber(q.quoteNumber)} → ${QUOTE_STATUS_LABELS[to]}`);
    } catch (err) {
      handleApiError(err);
    }
  };

  return (
    <>
      <PageHeader title="Pipeline" description="Arraste a cotação para mudar o status. Regras de negócio são validadas ao mover." actions={<><Button variant="outline" asChild><Link href="/quotes"><List /> Lista</Link></Button><Button asChild><Link href="/quotes/new"><Plus /> Nova cotação</Link></Button></>} />
      <QuoteFilters value={filters} onChange={setFilters} showStatus={false} />
      {isLoading || !data ? (
        <div className="flex gap-3 overflow-x-auto">{COLUMNS.map((c) => <Skeleton key={c} className="h-64 w-64 shrink-0" />)}</div>
      ) : (
        <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActive(e.active.data.current as QuoteRow)} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {COLUMNS.map((status) => <Column key={status} status={status} items={data[status] ?? []} active={active} />)}
          </div>
          <DragOverlay>{active ? <div className="w-60"><Card q={active} dragging /></div> : null}</DragOverlay>
        </DndContext>
      )}
    </>
  );
}
