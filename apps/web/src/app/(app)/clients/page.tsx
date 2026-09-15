'use client';
import { CLIENT_TYPE_LABELS, CLIENT_TYPE_VALUES, formatDate, formatPhone, formatQuoteNumber, maskDocument, type ClientType } from '@insurance/shared';
import { Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { ClientForm } from '@/components/domain/client-form';
import { QuoteStatusBadge } from '@/components/domain/status-badges';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/skeleton';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { handleApiError } from '@/lib/handle-error';
import { useClients, useCreateClient } from '@/lib/queries/clients';

export default function ClientsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<ClientType | ''>('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('name:asc');
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useClients({ search, type: type || undefined, page, pageSize: 20, sort });
  const create = useCreateClient();

  return (
    <>
      <PageHeader title="Clientes" description="Cadastre uma vez, reutilize em todas as cotações." actions={<Button onClick={() => setCreating(true)}><Plus /> Novo cliente</Button>} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Nome, CPF/CNPJ, telefone ou e-mail" className="sm:w-96" />
        <Select value={type} onChange={(e) => { setType(e.target.value as ClientType | ''); setPage(1); }} className="sm:w-44">
          <option value="">Todos os tipos</option>
          {CLIENT_TYPE_VALUES.map((t) => <option key={t} value={t}>{CLIENT_TYPE_LABELS[t]}</option>)}
        </Select>
      </div>
      {isLoading ? (
        <TableSkeleton cols={6} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum cliente encontrado" description={search ? 'Tente outra busca.' : 'Cadastre o primeiro cliente para iniciar uma cotação.'} action={!search ? <Button onClick={() => setCreating(true)}><Plus /> Novo cliente</Button> : undefined} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="name" sort={sort} onSort={(s) => { setSort(s); setPage(1); }}>Cliente</SortableTableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-center">Cotações</TableHead>
                <TableHead>Última cotação</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => router.push(`/clients/${c.id}`)}>
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.city ? `${c.city}${c.state ? '/' + c.state : ''}` : CLIENT_TYPE_LABELS[c.type]}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{maskDocument(c.document)}</TableCell>
                  <TableCell>{formatPhone(c.whatsapp ?? c.phone) || '—'}</TableCell>
                  <TableCell className="text-center">{c.quotesCount}</TableCell>
                  <TableCell>
                    {c.lastQuote ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{formatQuoteNumber(c.lastQuote.quoteNumber)}</span>
                        <QuoteStatusBadge status={c.lastQuote.status} />
                        <span className="text-xs text-muted-foreground">{formatDate(c.lastQuote.createdAt)}</span>
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="sm" asChild><Link href={`/quotes/new?clientId=${c.id}`}>Cotar</Link></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination meta={data.meta} onPageChange={setPage} />
        </>
      )}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
            <DialogDescription>CPF/CNPJ é único por corretora.</DialogDescription>
          </DialogHeader>
          <ClientForm
            onCancel={() => setCreating(false)}
            submitLabel="Cadastrar"
            onSubmit={async (v) => {
              try {
                const c = await create.mutateAsync(v);
                toast.success('Cliente cadastrado.');
                setCreating(false);
                router.push(`/clients/${c.id}`);
              } catch (e) {
                handleApiError(e);
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
