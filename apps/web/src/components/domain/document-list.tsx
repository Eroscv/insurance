'use client';
import { DOCUMENT_TYPE_LABELS, formatDateTime, formatQuoteNumber } from '@insurance/shared';
import { Check, Eye, FileText, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { handleApiError } from '@/lib/handle-error';
import { useDeleteDocument, useUpdateDocumentStatus, type Document } from '@/lib/queries/documents';
import { DocumentStatusBadge } from './status-badges';
import { DocumentViewer } from './document-viewer';

export function DocumentList({ docs, showClient, showQuote, emptyAction }: { docs: Document[]; showClient?: boolean; showQuote?: boolean; emptyAction?: React.ReactNode }) {
  const [viewing, setViewing] = useState<Document | null>(null);
  const [deleting, setDeleting] = useState<Document | null>(null);
  const updateStatus = useUpdateDocumentStatus();
  const del = useDeleteDocument();

  const setStatus = async (d: Document, status: 'VALIDATED' | 'REJECTED' | 'RECEIVED') => {
    try {
      await updateStatus.mutateAsync({ id: d.id, status });
      toast.success(status === 'VALIDATED' ? 'Documento validado.' : status === 'REJECTED' ? 'Documento rejeitado.' : 'Status atualizado.');
    } catch (e) {
      handleApiError(e);
    }
  };

  if (docs.length === 0) return <EmptyState icon={FileText} title="Nenhum documento" description="Envie CNH, CRLV e demais documentos para conferência." action={emptyAction} />;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Arquivo</TableHead>
            {showClient ? <TableHead>Cliente</TableHead> : null}
            {showQuote ? <TableHead>Cotação</TableHead> : null}
            <TableHead>Status</TableHead>
            <TableHead>Enviado</TableHead>
            <TableHead className="w-40" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="font-medium">{DOCUMENT_TYPE_LABELS[d.type]}</TableCell>
              <TableCell className="max-w-56 truncate text-muted-foreground" title={d.fileName}>{d.fileName}</TableCell>
              {showClient ? <TableCell>{d.client ? <Link className="hover:underline" href={`/clients/${d.client.id}`}>{d.client.name}</Link> : '—'}</TableCell> : null}
              {showQuote ? <TableCell>{d.quote ? <Link className="hover:underline" href={`/quotes/${d.quote.id}`}>{formatQuoteNumber(d.quote.quoteNumber)}</Link> : '—'}</TableCell> : null}
              <TableCell><DocumentStatusBadge status={d.status} /></TableCell>
              <TableCell className="text-muted-foreground whitespace-nowrap">{formatDateTime(d.uploadedAt)}<br /><span className="text-xs">{d.uploadedBy.name}</span></TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" title="Visualizar" onClick={() => setViewing(d)}><Eye /></Button>
                  {d.status !== 'VALIDATED' ? <Button variant="ghost" size="icon" title="Validar" className="text-emerald-700" onClick={() => setStatus(d, 'VALIDATED')}><Check /></Button> : null}
                  {d.status !== 'REJECTED' ? <Button variant="ghost" size="icon" title="Rejeitar" className="text-red-700" onClick={() => setStatus(d, 'REJECTED')}><X /></Button> : null}
                  <Button variant="ghost" size="icon" title="Excluir" onClick={() => setDeleting(d)}><Trash2 /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <DocumentViewer doc={viewing} onOpenChange={(o) => !o && setViewing(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Excluir documento?"
        description={deleting?.fileName}
        confirmLabel="Excluir"
        destructive
        loading={del.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await del.mutateAsync(deleting.id);
            toast.success('Documento excluído.');
            setDeleting(null);
          } catch (e) {
            handleApiError(e);
          }
        }}
      />
    </>
  );
}
