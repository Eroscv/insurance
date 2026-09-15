import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api-client';

export interface Insurer {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  active: boolean;
  notes: string | null;
  logoUrl?: string | null;
}
export function useInsurerOptions() {
  return useQuery({ queryKey: ['insurers', 'options'], queryFn: () => apiClient.get<Insurer[]>('/insurers/options'), staleTime: 5 * 60_000 });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InsurerInput, ListInsurersQuery } from '@insurance/shared';
import type { PageMeta } from '@/components/ui/pagination';

export interface InsurerRow extends Insurer {
  quotesCount: number;
  logoUrl: string | null;
}
export function useInsurers(q: Partial<ListInsurersQuery> & { active?: boolean }) {
  return useQuery({ queryKey: ['insurers', 'list', q], queryFn: () => apiClient.get<{ data: InsurerRow[]; meta: PageMeta }>('/insurers', { ...q, active: q.active === undefined ? undefined : String(q.active) }) });
}
export function useCreateInsurer() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: InsurerInput) => apiClient.post<Insurer>('/insurers', body), onSuccess: () => qc.invalidateQueries({ queryKey: ['insurers'] }) });
}
export function useUpdateInsurer() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...body }: InsurerInput & { id: string }) => apiClient.patch<Insurer>(`/insurers/${id}`, body), onSuccess: () => qc.invalidateQueries({ queryKey: ['insurers'] }) });
}
export function useDeleteInsurer() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => apiClient.delete(`/insurers/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['insurers'] }) });
}
export function useUploadInsurerLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => { const fd = new FormData(); fd.append('file', file); return apiClient.post<{ logoUrl: string }>(`/insurers/${id}/logo`, fd); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurers'] }),
  });
}
