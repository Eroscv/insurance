import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocumentType, UpdateOrganizationInput, UpdateOrganizationSettingsInput } from '@insurance/shared';
import { apiClient } from '../api-client';

export interface Organization {
  id: string;
  name: string;
  legalName: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  logoUrl: string | null;
  settings: {
    commissionPercentage: string;
    staleQuoteDays: number;
    requiredDocumentTypes: DocumentType[];
    proposalValidityDays: number;
    proposalFooterText: string | null;
  } | null;
}

const key = ['organization', 'current'] as const;

export function useOrganization() {
  return useQuery({ queryKey: key, queryFn: () => apiClient.get<Organization>('/organizations/current') });
}
export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateOrganizationInput) => apiClient.patch('/organizations/current', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}
export function useUpdateOrganizationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateOrganizationSettingsInput) => apiClient.patch('/organizations/current/settings', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}
export function useUploadLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return apiClient.post<{ logoUrl: string }>('/organizations/current/logo', fd);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}
