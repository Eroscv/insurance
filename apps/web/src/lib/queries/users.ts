import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateUserInput, ListUsersQuery, Role, UpdateUserInput } from '@insurance/shared';
import { apiClient } from '../api-client';
import type { PageMeta } from '@/components/ui/pagination';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  active: boolean;
  createdAt: string;
}
export interface UserOption {
  id: string;
  name: string;
  role: Role;
}

export function useUsers(q: Partial<ListUsersQuery> & { active?: boolean }) {
  return useQuery({
    queryKey: ['users', q],
    queryFn: () => apiClient.get<{ data: User[]; meta: PageMeta }>('/users', { ...q, active: q.active === undefined ? undefined : String(q.active) }),
  });
}
export function useUserOptions() {
  return useQuery({ queryKey: ['users', 'options'], queryFn: () => apiClient.get<UserOption[]>('/users/options'), staleTime: 5 * 60_000 });
}
export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: CreateUserInput) => apiClient.post<User>('/users', body), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });
}
export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateUserInput & { id: string }) => apiClient.patch<User>(`/users/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}
export function useSetUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => apiClient.patch<User>(`/users/${id}/active`, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; phone?: string | null }) => apiClient.patch('/users/me', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', 'me'] }),
  });
}
export function useChangePassword() {
  return useMutation({ mutationFn: (body: { currentPassword: string; newPassword: string }) => apiClient.patch('/users/me/password', body) });
}
