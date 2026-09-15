'use client';
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_VALUES, type DocumentType } from '@insurance/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { handleApiError } from '@/lib/handle-error';
import { useUploadDocument } from '@/lib/queries/documents';

const TYPES = DOCUMENT_TYPE_VALUES.filter((t) => t !== 'PROPOSAL');

export function DocumentUploadDialog({ open, onOpenChange, clientId, quoteId }: { open: boolean; onOpenChange: (o: boolean) => void; clientId?: string; quoteId?: string }) {
  const upload = useUploadDocument();
  const [type, setType] = useState<DocumentType>('CNH');
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!file) return setError('Selecione um arquivo.');
    if (file.size > 10 * 1024 * 1024) return setError('Arquivo excede 10 MB.');
    setError(null);
    try {
      await upload.mutateAsync({ file, type, clientId, quoteId, notes: notes || undefined });
      toast.success('Documento enviado.');
      setFile(null);
      setNotes('');
      onOpenChange(false);
    } catch (e) {
      handleApiError(e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar documento</DialogTitle>
          <DialogDescription>PDF, JPG, PNG ou WEBP até 10 MB. O arquivo fica privado.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <FormField label="Tipo" htmlFor="doc-type" required>
            <Select id="doc-type" value={type} onChange={(e) => setType(e.target.value as DocumentType)}>
              {TYPES.map((t) => <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>)}
            </Select>
          </FormField>
          <FormField label="Arquivo" htmlFor="doc-file" error={error ?? undefined} required>
            <Input id="doc-file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </FormField>
          <FormField label="Observações" htmlFor="doc-notes">
            <Input id="doc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} loading={upload.isPending}>Enviar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
