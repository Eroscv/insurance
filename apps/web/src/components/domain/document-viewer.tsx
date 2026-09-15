'use client';
import { ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { handleApiError } from '@/lib/handle-error';
import { getDocumentUrl, type Document } from '@/lib/queries/documents';

/** Visualiza o arquivo (PDF em iframe, imagem em img) via URL pré-assinada. Sem leitura automática do conteúdo. */
export function DocumentViewer({ doc, onOpenChange }: { doc: Document | null; onOpenChange: (o: boolean) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    if (!doc) return;
    let active = true;
    getDocumentUrl(doc.id)
      .then((r) => active && setUrl(r.url))
      .catch(handleApiError);
    return () => {
      active = false;
    };
  }, [doc]);
  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{doc?.fileName}</DialogTitle>
          <DialogDescription>Visualize o documento e preencha os dados manualmente no formulário.</DialogDescription>
        </DialogHeader>
        {!url ? (
          <Skeleton className="h-[70vh]" />
        ) : doc?.mimeType === 'application/pdf' ? (
          <iframe src={url} title={doc.fileName} className="h-[70vh] w-full rounded-md border bg-muted" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={doc?.fileName} className="max-h-[70vh] w-full rounded-md border object-contain" />
        )}
        {url ? (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" asChild>
              <a href={url} target="_blank" rel="noreferrer"><ExternalLink /> Abrir em nova aba</a>
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
