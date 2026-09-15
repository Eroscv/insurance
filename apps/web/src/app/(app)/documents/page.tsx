'use client';
import { DOCUMENT_STATUS_LABELS, DOCUMENT_STATUS_VALUES, DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_VALUES, type DocumentStatus, type DocumentType } from '@insurance/shared';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { DocumentList } from '@/components/domain/document-list';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useDocuments } from '@/lib/queries/documents';

export default function DocumentsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DocumentStatus | ''>('');
  const [type, setType] = useState<DocumentType | ''>('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useDocuments({ search, status: status || undefined, type: type || undefined, page, pageSize: 20 });
  return (
    <>
      <PageHeader title="Documentos" description="Todos os arquivos recebidos, por cliente e cotação." />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Arquivo ou cliente" className="sm:w-80" />
        <Select value={status} onChange={(e) => { setStatus(e.target.value as DocumentStatus | ''); setPage(1); }} className="sm:w-44">
          <option value="">Todos os status</option>
          {DOCUMENT_STATUS_VALUES.map((s) => <option key={s} value={s}>{DOCUMENT_STATUS_LABELS[s]}</option>)}
        </Select>
        <Select value={type} onChange={(e) => { setType(e.target.value as DocumentType | ''); setPage(1); }} className="sm:w-52">
          <option value="">Todos os tipos</option>
          {DOCUMENT_TYPE_VALUES.map((t) => <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>)}
        </Select>
      </div>
      {isLoading ? <TableSkeleton cols={6} /> : <DocumentList docs={data?.data ?? []} showClient showQuote />}
      {data ? <Pagination meta={data.meta} onPageChange={setPage} /> : null}
    </>
  );
}
