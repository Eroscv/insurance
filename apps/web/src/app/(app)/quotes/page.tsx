'use client';
import { formatDate, formatPlate, formatQuoteNumber } from '@insurance/shared';
import { FileText, KanbanSquare, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import type { QuoteStatus } from '@insurance/shared';
import { PageHeader } from '@/components/layout/page-header';
import { QuoteFilters } from '@/components/domain/quote-filters';
import { PriorityBadge, QuoteStatusBadge } from '@/components/domain/status-badges';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/skeleton';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuotes, type QuoteFilters as Filters } from '@/lib/queries/quotes';

function QuotesList() {
  const router = useRouter();
  const initialStatus = useSearchParams().get('status') as QuoteStatus | null;
  const [filters, setFilters] = useState<Filters>(initialStatus ? { page: 1, pageSize: 20, sort: 'createdAt:desc', status: [initialStatus] } : { page: 1, pageSize: 20, sort: 'createdAt:desc', open: true });
  const { data, isLoading } = useQuotes(filters);
  return (
    <>
      <PageHeader
        title="Cotações"
        description="Todo o pipeline em um único lugar."
        actions={
          <>
            <Button variant="outline" asChild><Link href="/quotes/kanban"><KanbanSquare /> Kanban</Link></Button>
            <Button asChild><Link href="/quotes/new"><Plus /> Nova cotação</Link></Button>
          </>
        }
      />
      <QuoteFilters value={filters} onChange={setFilters} />
      <div className="mb-3 flex items-center gap-2">
        <Select value={filters.open === undefined ? 'all' : filters.open ? 'open' : 'closed'} onChange={(e) => setFilters({ ...filters, page: 1, status: undefined, open: e.target.value === 'all' ? undefined : e.target.value === 'open' })} className="w-44">
          <option value="open">Em aberto</option>
          <option value="closed">Encerradas</option>
          <option value="all">Todas</option>
        </Select>
      </div>
      {isLoading ? (
        <TableSkeleton cols={7} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhuma cotação encontrada" description="Ajuste os filtros ou crie uma nova cotação." action={<Button asChild><Link href="/quotes/new"><Plus /> Nova cotação</Link></Button>} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="quoteNumber" sort={filters.sort} onSort={(sort) => setFilters({ ...filters, sort, page: 1 })}>Nº</SortableTableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Veículo</TableHead>
                <SortableTableHead sortKey="status" sort={filters.sort} onSort={(sort) => setFilters({ ...filters, sort, page: 1 })}>Status</SortableTableHead>
                <SortableTableHead sortKey="priority" sort={filters.sort} onSort={(sort) => setFilters({ ...filters, sort, page: 1 })} defaultDirection="desc">Prioridade</SortableTableHead>
                <TableHead>Corretor</TableHead>
                <TableHead>Seguradoras</TableHead>
                <SortableTableHead sortKey="lastActivityAt" sort={filters.sort} onSort={(sort) => setFilters({ ...filters, sort, page: 1 })}>Atividade</SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((q) => (
                <TableRow key={q.id} className="cursor-pointer" onClick={() => router.push(`/quotes/${q.id}`)}>
                  <TableCell className="font-mono text-xs">{formatQuoteNumber(q.quoteNumber)}</TableCell>
                  <TableCell className="font-medium">{q.client.name}</TableCell>
                  <TableCell className="text-muted-foreground">{q.vehicle ? `${q.vehicle.brand} ${q.vehicle.model} ${q.vehicle.modelYear}${q.vehicle.plate ? ' · ' + formatPlate(q.vehicle.plate) : ''}` : '—'}</TableCell>
                  <TableCell><QuoteStatusBadge status={q.status} /></TableCell>
                  <TableCell><PriorityBadge priority={q.priority} /></TableCell>
                  <TableCell>{q.assignedUser?.name ?? '—'}</TableCell>
                  <TableCell className="text-center">{q._count.quoteInsurers}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(q.lastActivityAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination meta={data.meta} onPageChange={(page) => setFilters({ ...filters, page })} />
        </>
      )}
    </>
  );
}

export default function QuotesPage() {
  return <Suspense><QuotesList /></Suspense>;
}
