import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocumentStatus, DocumentType, ListDocumentsQuery } from '@insurance/shared';
import { apiClient } from '../api-client';
import type { PageMeta } from '@/components/ui/pagination';

export interface Document {
  id: string;
  clientId: string | null;
  quoteId: string | null;
  type: DocumentType;
  fileName: string;
  mimeType: string;
  size: number;
  status: DocumentStatus;
  uploadedAt: string;
  validatedAt: string | null;
  notes: string | null;
  uploadedBy: { id: string; name: string };
  validatedBy: { id: string; name: string } | null;
  client: { id: string; name: string } | null;
  quote: { id: string; quoteNumber: number; status: string } | null;
}

export const documentKeys = { all: ['documents'] as const, list: (q: unknown) => ['documents', 'list', q] as const };

export function useDocuments(q: Partial<ListDocumentsQuery>) {
  return useQuery({ queryKey: documentKeys.list(q), queryFn: () => apiClient.get<{ data: Document[]; meta: PageMeta }>('/documents', q) });
}
export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, type, clientId, quoteId, notes }: { file: File; type: DocumentType; clientId?: string; quoteId?: string; notes?: string }) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', type);
      if (clientId) fd.append('clientId', clientId);
      if (quoteId) fd.append('quoteId', quoteId);
      if (notes) fd.append('notes', notes);
      return apiClient.post<Document>('/documents', fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentKeys.all });
      qc.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}
export function useUpdateDocumentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: DocumentStatus; notes?: string | null }) => apiClient.patch<Document>(`/documents/${id}/status`, { status, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentKeys.all });
      qc.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}
export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => apiClient.delete(`/documents/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }) });
}
export function getDocumentUrl(id: string) {
  return apiClient.get<{ url: string; fileName: string; mimeType: string }>(`/documents/${id}/download`);
}
