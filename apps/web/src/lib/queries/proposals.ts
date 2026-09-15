import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DeductibleType, ProposalInput, ProposalStatus, QuoteInsurerStatus, UpdateQuoteInsurerInput } from '@insurance/shared';
import { apiClient } from '../api-client';
import { quoteKeys } from './quotes';

export interface Coverage { id: string; name: string; insuredAmount: string | null; included: boolean; notes: string | null }
export interface Assistance { id: string; name: string; included: boolean; description: string | null }
export interface Proposal {
  id: string;
  quoteInsurerId: string;
  proposalNumber: string | null;
  totalAmount: string;
  firstInstallment: string | null;
  installmentAmount: string | null;
  installments: number;
  deductibleAmount: string | null;
  deductibleType: DeductibleType | null;
  commissionPercentage: string | null;
  validityDate: string | null;
  fileName: string | null;
  storageKey?: string | null;
  status: ProposalStatus;
  notes: string | null;
  createdAt: string;
  coverages: Coverage[];
  assistances: Assistance[];
  quoteInsurer: { id: string; quoteId: string; insurer: { id: string; name: string; logoKey: string | null } };
}
export interface QuoteInsurerFull {
  id: string;
  quoteId: string;
  insurerId: string;
  status: QuoteInsurerStatus;
  requestedAt: string | null;
  respondedAt: string | null;
  notes: string | null;
  insurer: { id: string; name: string; logoKey: string | null; email: string | null; phone: string | null };
  createdBy: { id: string; name: string };
  proposals: Proposal[];
}

const invalidate = (qc: ReturnType<typeof useQueryClient>, quoteId: string) => {
  qc.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
  qc.invalidateQueries({ queryKey: ['quote-insurers', quoteId] });
  qc.invalidateQueries({ queryKey: ['proposals', quoteId] });
  qc.invalidateQueries({ queryKey: ['comparison', quoteId] });
  qc.invalidateQueries({ queryKey: quoteKeys.all });
};

export function useQuoteInsurers(quoteId: string) {
  return useQuery({ queryKey: ['quote-insurers', quoteId], queryFn: () => apiClient.get<QuoteInsurerFull[]>(`/quotes/${quoteId}/insurers`) });
}
export function useAddQuoteInsurers(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (insurerIds: string[]) => apiClient.post<QuoteInsurerFull[]>(`/quotes/${quoteId}/insurers`, { insurerIds }), onSuccess: () => invalidate(qc, quoteId) });
}
export function useUpdateQuoteInsurer(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...body }: UpdateQuoteInsurerInput & { id: string }) => apiClient.patch<QuoteInsurerFull>(`/quote-insurers/${id}`, body), onSuccess: () => invalidate(qc, quoteId) });
}
export function useRemoveQuoteInsurer(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => apiClient.delete(`/quote-insurers/${id}`), onSuccess: () => invalidate(qc, quoteId) });
}
export function useProposals(quoteId: string) {
  return useQuery({ queryKey: ['proposals', quoteId], queryFn: () => apiClient.get<Proposal[]>(`/quotes/${quoteId}/proposals`) });
}
export function useCreateProposal(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ quoteInsurerId, ...body }: ProposalInput & { quoteInsurerId: string }) => apiClient.post<Proposal>(`/quote-insurers/${quoteInsurerId}/proposals`, body), onSuccess: () => invalidate(qc, quoteId) });
}
export function useUpdateProposal(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...body }: ProposalInput & { id: string }) => apiClient.patch<Proposal>(`/proposals/${id}`, body), onSuccess: () => invalidate(qc, quoteId) });
}
export function useSelectProposal(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => apiClient.post<Proposal>(`/proposals/${id}/select`), onSuccess: () => invalidate(qc, quoteId) });
}
export function useDeleteProposal(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => apiClient.delete(`/proposals/${id}`), onSuccess: () => invalidate(qc, quoteId) });
}
export function useUploadProposalFile(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => { const fd = new FormData(); fd.append('file', file); return apiClient.post<Proposal>(`/proposals/${id}/file`, fd); },
    onSuccess: () => invalidate(qc, quoteId),
  });
}
export const getProposalFileUrl = (id: string) => apiClient.get<{ url: string; fileName: string | null }>(`/proposals/${id}/file`);
