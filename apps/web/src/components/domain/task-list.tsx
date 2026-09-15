'use client';
import { formatDateTime, formatQuoteNumber, TASK_STATUS_LABELS, TASK_STATUS_VALUES, type TaskStatus } from '@insurance/shared';
import { CheckSquare, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import { handleApiError } from '@/lib/handle-error';
import { useDeleteTask, useSetTaskStatus, useUpdateTask, type Task } from '@/lib/queries/tasks';
import { cn } from '@/lib/utils';
import { PriorityBadge, TaskStatusBadge } from './status-badges';
import { TaskForm } from './task-form';

/** Lista de tarefas em cards (funciona bem no celular). */
export function TaskList({ tasks, emptyAction, showQuote = true }: { tasks: Task[]; emptyAction?: React.ReactNode; showQuote?: boolean }) {
  const setStatus = useSetTaskStatus();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  if (tasks.length === 0) return <EmptyState icon={CheckSquare} title="Nenhuma tarefa" description="Crie follow-ups para não perder oportunidades." action={emptyAction} />;
  const toggle = async (t: Task, done: boolean) => { try { await setStatus.mutateAsync({ id: t.id, status: done ? 'DONE' : 'TODO' }); } catch (e) { handleApiError(e); } };
  return (
    <>
      <ul className="flex flex-col gap-2">
        {tasks.map((t) => (
          <li key={t.id} className={cn('flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center', t.overdue && 'border-red-300 bg-red-50/40', t.status === 'DONE' && 'opacity-60')}>
            <Checkbox checked={t.status === 'DONE'} onCheckedChange={(c) => toggle(t, c === true)} aria-label="Concluir" className="mt-1 sm:mt-0" />
            <div className="min-w-0 flex-1">
              <p className={cn('font-medium', t.status === 'DONE' && 'line-through')}>{t.title}</p>
              {t.description ? <p className="text-xs text-muted-foreground">{t.description}</p> : null}
              <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                {t.dueDate ? <span className={cn(t.overdue && 'font-medium text-red-700')}>Prazo {formatDateTime(t.dueDate)}</span> : <span>Sem prazo</span>}
                <span>· {t.user.name}</span>
                {showQuote && t.quote ? <Link href={`/quotes/${t.quote.id}?tab=tasks`} className="hover:underline">· Cotação {formatQuoteNumber(t.quote.quoteNumber)}</Link> : null}
                {t.client ? <Link href={`/clients/${t.client.id}`} className="hover:underline">· {t.client.name}</Link> : null}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <PriorityBadge priority={t.priority} />
              <TaskStatusBadge status={t.status} overdue={t.overdue} />
              <Select value={t.status} onChange={async (e) => { try { await setStatus.mutateAsync({ id: t.id, status: e.target.value as TaskStatus }); } catch (err) { handleApiError(err); } }} className="w-36">
                {TASK_STATUS_VALUES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
              </Select>
              <Button variant="ghost" size="icon" onClick={() => setEditing(t)}><Pencil /></Button>
              <Button variant="ghost" size="icon" onClick={() => setDeleting(t)}><Trash2 /></Button>
            </div>
          </li>
        ))}
      </ul>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar tarefa</DialogTitle></DialogHeader>
          <TaskForm initial={editing} onCancel={() => setEditing(null)} onSubmit={async (v) => { if (!editing) return; try { await update.mutateAsync({ id: editing.id, ...v }); toast.success('Tarefa atualizada.'); setEditing(null); } catch (e) { handleApiError(e); } }} />
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Excluir tarefa?" description={deleting?.title} confirmLabel="Excluir" destructive loading={del.isPending}
        onConfirm={async () => { if (!deleting) return; try { await del.mutateAsync(deleting.id); toast.success('Tarefa excluída.'); setDeleting(null); } catch (e) { handleApiError(e); } }} />
    </>
  );
}
