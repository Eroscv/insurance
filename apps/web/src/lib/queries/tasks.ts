import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListTasksQuery, NotificationType, Priority, TaskInput, TaskStatus } from '@insurance/shared';
import { apiClient } from '../api-client';
import type { PageMeta } from '@/components/ui/pagination';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: string | null;
  completedAt: string | null;
  userId: string;
  clientId: string | null;
  quoteId: string | null;
  createdAt: string;
  overdue: boolean;
  user: { id: string; name: string };
  createdBy: { id: string; name: string };
  client: { id: string; name: string } | null;
  quote: { id: string; quoteNumber: number; status: string } | null;
}
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entity: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}
export type TaskFilters = Partial<Omit<ListTasksQuery, 'overdue' | 'open'>> & { overdue?: boolean; open?: boolean };
const toQuery = (q: TaskFilters) => ({ ...q, overdue: q.overdue === undefined ? undefined : String(q.overdue), open: q.open === undefined ? undefined : String(q.open) });

export function useTasks(q: TaskFilters) {
  return useQuery({ queryKey: ['tasks', q], queryFn: () => apiClient.get<{ data: Task[]; meta: PageMeta }>('/tasks', toQuery(q)) });
}
function useInvalidateTasks() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['quotes'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
}
export function useCreateTask() {
  const inv = useInvalidateTasks();
  return useMutation({ mutationFn: (body: TaskInput) => apiClient.post<Task>('/tasks', body), onSuccess: inv });
}
export function useUpdateTask() {
  const inv = useInvalidateTasks();
  return useMutation({ mutationFn: ({ id, ...body }: TaskInput & { id: string }) => apiClient.patch<Task>(`/tasks/${id}`, body), onSuccess: inv });
}
export function useSetTaskStatus() {
  const inv = useInvalidateTasks();
  return useMutation({ mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => apiClient.patch<Task>(`/tasks/${id}/status`, { status }), onSuccess: inv });
}
export function useDeleteTask() {
  const inv = useInvalidateTasks();
  return useMutation({ mutationFn: (id: string) => apiClient.delete(`/tasks/${id}`), onSuccess: inv });
}

export function useNotifications(unreadOnly = false) {
  return useQuery({ queryKey: ['notifications', unreadOnly], queryFn: () => apiClient.get<{ data: Notification[]; meta: PageMeta; unread: number }>('/notifications', { unreadOnly: String(unreadOnly), pageSize: 30 }), refetchInterval: 60_000 });
}
export function useUnreadCount() {
  return useQuery({ queryKey: ['notifications', 'unread'], queryFn: () => apiClient.get<{ unread: number }>('/notifications/unread-count'), refetchInterval: 60_000 });
}
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/read`), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
}
export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => apiClient.post('/notifications/read-all'), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
}
