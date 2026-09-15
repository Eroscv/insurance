import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';
import { quoteKeys } from './quotes';

export interface ComparisonColumn {
  proposalId: string;
  insurerId: string;
  insurerName: string;
  status: string;
  proposalNumber: string | null;
  totalAmount: string;
  firstInstallment: string | null;
  installmentAmount: string | null;
  installments: number;
  installmentTotal: string | null;
  deductibleAmount: string | null;
  deductibleType: string | null;
  validityDate: string | null;
  commissionPercentage: string;
  commissionAmount: string;
  netPremium: string;
  iofAmount: string;
  difference: string;
  percentageDifference: string | null;
  renewal: { savings: string; savingsPercentage: string | null; isCheaper: boolean } | null;
  coverages: Record<string, { included: boolean; insuredAmount: string | null }>;
  assistances: Record<string, boolean>;
}
export interface Comparison {
  columns: ComparisonColumn[];
  coverageNames: string[];
  assistanceNames: string[];
  highlights: { lowestPremiumIds: string[]; lowestDeductibleIds: string[] };
  iofRatePercent: string;
  expiringPremium: string | null;
}

export function useComparison(quoteId: string) {
  return useQuery({ queryKey: ['comparison', quoteId], queryFn: () => apiClient.get<Comparison>(`/quotes/${quoteId}/comparison`) });
}
export function useGenerateProposalPdf(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (proposalId?: string) => apiClient.post<{ documentId: string; fileName: string; url: string }>(`/quotes/${quoteId}/proposal-pdf${proposalId ? `?proposalId=${proposalId}` : ''}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}
export const getMessageTemplate = (quoteId: string) => apiClient.get<{ text: string }>(`/quotes/${quoteId}/message-template`);
