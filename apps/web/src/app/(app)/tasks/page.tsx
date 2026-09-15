'use client';
import { TASK_STATUS_LABELS, TASK_STATUS_VALUES, type TaskStatus } from '@insurance/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { TaskForm } from '@/components/domain/task-form';
import { TaskList } from '@/components/domain/task-list';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { handleApiError } from '@/lib/handle-error';
import { useMe } from '@/lib/queries/auth';
import { useCreateTask, useTasks, type TaskFilters } from '@/lib/queries/tasks';
import { useUserOptions } from '@/lib/queries/users';

export default function TasksPage() {
  const { data: me } = useMe();
  const { data: users } = useUserOptions();
  const [filters, setFilters] = useState<TaskFilters>({ page: 1, pageSize: 30, open: true, sort: 'dueDate:asc' });
  const [scope, setScope] = useState<'open' | 'overdue' | 'done' | 'all'>('open');
  const { data, isLoading } = useTasks(filters);
  const create = useCreateTask();
  const [creating, setCreating] = useState(false);
  const setScopeAnd = (s: typeof scope) => {
    setScope(s);
    setFilters({ ...filters, page: 1, status: s === 'done' ? 'DONE' : undefined, open: s === 'open' ? true : undefined, overdue: s === 'overdue' ? true : undefined });
  };
  const action = <Button onClick={() => setCreating(true)}><Plus /> Nova tarefa</Button>;
  return (
    <>
      <PageHeader title="Tarefas" description="Follow-ups e lembretes. Atrasadas aparecem em destaque." actions={action} />
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <SearchInput value={filters.search ?? ''} onChange={(v) => setFilters({ ...filters, search: v, page: 1 })} placeholder="Buscar por título" />
        <Select value={scope} onChange={(e) => setScopeAnd(e.target.value as typeof scope)}>
          <option value="open">Em aberto</option>
          <option value="overdue">Atrasadas</option>
          <option value="done">Concluídas</option>
          <option value="all">Todas</option>
        </Select>
        <Select value={filters.userId ?? ''} onChange={(e) => setFilters({ ...filters, userId: e.target.value || undefined, page: 1 })}>
          <option value="">Todos os responsáveis</option>
          {me ? <option value={me.id}>Minhas tarefas</option> : null}
          {users?.filter((u) => u.id !== me?.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
        <Select value={filters.status ?? ''} onChange={(e) => setFilters({ ...filters, status: (e.target.value || undefined) as TaskStatus | undefined, open: undefined, overdue: undefined, page: 1 })}>
          <option value="">Qualquer status</option>
          {TASK_STATUS_VALUES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
        </Select>
      </div>
      {isLoading ? <Skeleton className="h-48" /> : <TaskList tasks={data?.data ?? []} emptyAction={action} />}
      {data ? <Pagination meta={data.meta} onPageChange={(page) => setFilters({ ...filters, page })} /> : null}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
          <TaskForm onCancel={() => setCreating(false)} submitLabel="Criar" onSubmit={async (v) => { try { await create.mutateAsync(v); toast.success('Tarefa criada.'); setCreating(false); } catch (e) { handleApiError(e); } }} />
        </DialogContent>
      </Dialog>
    </>
  );
}
