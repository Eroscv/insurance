import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Role } from '@insurance/shared';
import { apiClient } from '../api-client';

export interface Me {
  id: string;
  organizationId: string;
  role: Role;
  email: string;
  name: string;
  phone: string | null;
  organization: { id: string; name: string; logoKey: string | null };
}

export const meQueryKey = ['auth', 'me'] as const;

export function useMe() {
  return useQuery({ queryKey: meQueryKey, queryFn: () => apiClient.get<Me>('/auth/me'), staleTime: 5 * 60_000 });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) => apiClient.post<{ user: Me }>('/auth/login', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: meQueryKey }),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => apiClient.post<{ user: Me }>('/auth/register', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: meQueryKey }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<void>('/auth/logout'),
    onSuccess: () => qc.clear(),
  });
}
