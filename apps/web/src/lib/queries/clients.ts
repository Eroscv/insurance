import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClientInput, ClientType, ListClientsQuery, MaritalStatus, QuoteStatus, VehicleInput, Fuel } from '@insurance/shared';
import { apiClient } from '../api-client';
import type { PageMeta } from '@/components/ui/pagination';

export interface Vehicle {
  id: string;
  clientId: string;
  brand: string;
  model: string;
  version: string | null;
  manufacturingYear: number;
  modelYear: number;
  plate: string | null;
  chassis: string | null;
  renavam: string | null;
  fuel: Fuel | null;
  zeroKm: boolean;
  usageType: string | null;
  overnightLocation: string | null;
}
export interface Client {
  id: string;
  type: ClientType;
  name: string;
  document: string;
  birthDate: string | null;
  maritalStatus: MaritalStatus | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface ClientRow extends Client {
  quotesCount: number;
  lastQuote: { id: string; quoteNumber: number; status: QuoteStatus; createdAt: string } | null;
}
export interface ClientDetail extends Client {
  vehicles: Vehicle[];
  _count: { quotes: number; documents: number };
}
export interface ClientQuoteRow {
  id: string;
  quoteNumber: number;
  status: QuoteStatus;
  priority: string;
  insuranceType: string;
  createdAt: string;
  vehicle: { brand: string; model: string; plate: string | null } | null;
  assignedUser: { id: string; name: string } | null;
}
export interface AuditRow {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; name: string } | null;
}

export const clientKeys = {
  all: ['clients'] as const,
  list: (q: unknown) => ['clients', 'list', q] as const,
  detail: (id: string) => ['clients', 'detail', id] as const,
  quotes: (id: string) => ['clients', 'detail', id, 'quotes'] as const,
  history: (id: string) => ['clients', 'detail', id, 'history'] as const,
};

export function useClients(q: Partial<ListClientsQuery>) {
  return useQuery({ queryKey: clientKeys.list(q), queryFn: () => apiClient.get<{ data: ClientRow[]; meta: PageMeta }>('/clients', q) });
}
export function useClient(id: string | undefined) {
  return useQuery({ queryKey: clientKeys.detail(id!), queryFn: () => apiClient.get<ClientDetail>(`/clients/${id}`), enabled: !!id });
}
export function useClientQuotes(id: string | undefined) {
  return useQuery({ queryKey: clientKeys.quotes(id!), queryFn: () => apiClient.get<ClientQuoteRow[]>(`/clients/${id}/quotes`), enabled: !!id });
}
export function useClientHistory(id: string | undefined) {
  return useQuery({ queryKey: clientKeys.history(id!), queryFn: () => apiClient.get<AuditRow[]>(`/clients/${id}/history`), enabled: !!id });
}
export function useSearchClients(term: string) {
  return useQuery({
    queryKey: ['clients', 'search', term],
    queryFn: () => apiClient.get<Pick<Client, 'id' | 'name' | 'document' | 'type' | 'phone' | 'city'>[]>('/clients/search', { q: term }),
    enabled: term.trim().length >= 2,
  });
}
export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: ClientInput) => apiClient.post<Client>('/clients', body), onSuccess: () => qc.invalidateQueries({ queryKey: clientKeys.all }) });
}
export function useUpdateClient(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: ClientInput) => apiClient.patch<Client>(`/clients/${id}`, body), onSuccess: () => qc.invalidateQueries({ queryKey: clientKeys.all }) });
}
export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => apiClient.delete(`/clients/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: clientKeys.all }) });
}
export function useCreateVehicle(clientId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: VehicleInput) => apiClient.post<Vehicle>(`/clients/${clientId}/vehicles`, body), onSuccess: () => qc.invalidateQueries({ queryKey: clientKeys.detail(clientId) }) });
}
export function useUpdateVehicle(clientId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...body }: VehicleInput & { id: string }) => apiClient.patch<Vehicle>(`/vehicles/${id}`, body), onSuccess: () => qc.invalidateQueries({ queryKey: clientKeys.detail(clientId) }) });
}
export function useDeleteVehicle(clientId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => apiClient.delete(`/vehicles/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: clientKeys.detail(clientId) }) });
}
