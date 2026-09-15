import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChangeQuoteStatusInput,
  CreateQuoteInput,
  DeductibleType,
  DocumentType,
  InsuranceType,
  ListQuotesQuery,
  LostReason,
  MaritalStatus,
  Priority,
  ProposalStatus,
  QuoteAutoDetailsInput,
  QuoteInsurerStatus,
  QuoteStatus,
  UpdateQuoteInput,
} from '@insurance/shared';
import { apiClient } from '../api-client';
import type { PageMeta } from '@/components/ui/pagination';
import type { AuditRow, Client, Vehicle } from './clients';

export interface QuoteRow {
  id: string;
  quoteNumber: number;
  status: QuoteStatus;
  priority: Priority;
  insuranceType: InsuranceType;
  clientId: string;
  vehicleId: string | null;
  assignedUserId: string | null;
  lostReason: LostReason | null;
  lostNotes: string | null;
  notes: string | null;
  closedAt: string | null;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string; document: string; phone: string | null; whatsapp: string | null };
  vehicle: { id: string; brand: string; model: string; version: string | null; manufacturingYear: number; modelYear: number; plate: string | null } | null;
  assignedUser: { id: string; name: string } | null;
  _count: { quoteInsurers: number; documents: number; tasks: number };
}
export interface QuoteAutoDetails {
  mainDriverName: string | null;
  mainDriverDocument: string | null;
  mainDriverBirthDate: string | null;
  maritalStatus: MaritalStatus | null;
  profession: string | null;
  residenceZipCode: string | null;
  vehicleUsage: string | null;
  annualMileage: number | null;
  hasHomeGarage: boolean | null;
  hasWorkGarage: boolean | null;
  commercialUse: boolean | null;
  appUsage: boolean | null;
  numberOfDrivers: number | null;
  deductibleType: DeductibleType | null;
  desiredCoverage: string | null;
}
export interface QuoteInsurerRow {
  id: string;
  insurerId: string;
  status: QuoteInsurerStatus;
  requestedAt: string | null;
  respondedAt: string | null;
  notes: string | null;
  insurer: { id: string; name: string; logoKey: string | null };
  proposals: { id: string; status: ProposalStatus; totalAmount: string }[];
}
export interface QuoteDetail extends Omit<QuoteRow, 'client' | 'vehicle'> {
  client: Client;
  vehicle: Vehicle | null;
  autoDetails: QuoteAutoDetails | null;
  quoteInsurers: QuoteInsurerRow[];
  pendingRequiredDocs: DocumentType[];
}
export interface StatusHistoryRow {
  id: string;
  fromStatus: QuoteStatus | null;
  toStatus: QuoteStatus;
  reason: string | null;
  createdAt: string;
  user: { id: string; name: string } | null;
}

export const quoteKeys = {
  all: ['quotes'] as const,
  list: (q: unknown) => ['quotes', 'list', q] as const,
  kanban: (q: unknown) => ['quotes', 'kanban', q] as const,
  detail: (id: string) => ['quotes', 'detail', id] as const,
  history: (id: string) => ['quotes', 'detail', id, 'history'] as const,
};

export type QuoteFilters = Partial<Omit<ListQuotesQuery, 'status' | 'open'>> & { status?: QuoteStatus[]; open?: boolean };
const toQuery = (q: QuoteFilters) => ({ ...q, open: q.open === undefined ? undefined : String(q.open) });

export function useQuotes(q: QuoteFilters) {
  return useQuery({ queryKey: quoteKeys.list(q), queryFn: () => apiClient.get<{ data: QuoteRow[]; meta: PageMeta }>('/quotes', toQuery(q)) });
}
export function useKanban(q: QuoteFilters) {
  return useQuery({ queryKey: quoteKeys.kanban(q), queryFn: () => apiClient.get<Partial<Record<QuoteStatus, QuoteRow[]>>>('/quotes/kanban', toQuery(q)) });
}
export function useQuote(id: string | undefined) {
  return useQuery({ queryKey: quoteKeys.detail(id!), queryFn: () => apiClient.get<QuoteDetail>(`/quotes/${id}`), enabled: !!id });
}
export function useQuoteHistory(id: string | undefined) {
  return useQuery({ queryKey: quoteKeys.history(id!), queryFn: () => apiClient.get<{ statusHistory: StatusHistoryRow[]; auditLogs: AuditRow[] }>(`/quotes/${id}/history`), enabled: !!id });
}
function useInvalidateQuotes() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: quoteKeys.all });
    qc.invalidateQueries({ queryKey: ['clients'] });
  };
}
export function useCreateQuote() {
  const inv = useInvalidateQuotes();
  return useMutation({ mutationFn: (body: CreateQuoteInput) => apiClient.post<QuoteDetail>('/quotes', body), onSuccess: inv });
}
export function useUpdateQuote(id: string) {
  const inv = useInvalidateQuotes();
  return useMutation({ mutationFn: (body: UpdateQuoteInput) => apiClient.patch<QuoteDetail>(`/quotes/${id}`, body), onSuccess: inv });
}
export function useUpdateAutoDetails(id: string) {
  const inv = useInvalidateQuotes();
  return useMutation({ mutationFn: (body: QuoteAutoDetailsInput) => apiClient.patch<QuoteAutoDetails>(`/quotes/${id}/auto-details`, body), onSuccess: inv });
}
export function useChangeQuoteStatus() {
  const inv = useInvalidateQuotes();
  return useMutation({ mutationFn: ({ id, ...body }: ChangeQuoteStatusInput & { id: string }) => apiClient.patch<QuoteDetail>(`/quotes/${id}/status`, body), onSuccess: inv });
}
export function useAssignQuote(id: string) {
  const inv = useInvalidateQuotes();
  return useMutation({ mutationFn: (assignedUserId: string | null) => apiClient.patch<QuoteDetail>(`/quotes/${id}/assign`, { assignedUserId }), onSuccess: inv });
}
export function useDeleteQuote() {
  const inv = useInvalidateQuotes();
  return useMutation({ mutationFn: (id: string) => apiClient.delete(`/quotes/${id}`), onSuccess: inv });
}
