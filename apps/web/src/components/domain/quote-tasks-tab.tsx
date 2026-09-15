'use client';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { handleApiError } from '@/lib/handle-error';
import type { QuoteDetail } from '@/lib/queries/quotes';
import { useCreateTask, useTasks } from '@/lib/queries/tasks';
import { TaskForm } from './task-form';
import { TaskList } from './task-list';

export function QuoteTasksTab({ quote }: { quote: QuoteDetail }) {
  const { data, isLoading } = useTasks({ quoteId: quote.id, pageSize: 100, sort: 'dueDate:asc' });
  const create = useCreateTask();
  const [creating, setCreating] = useState(false);
  const action = <Button onClick={() => setCreating(true)}><Plus /> Nova tarefa</Button>;
  return (
    <>
      <div className="mb-3 flex items-center justify-between"><p className="text-sm text-muted-foreground">Follow-ups desta cotação.</p>{action}</div>
      {isLoading ? <Skeleton className="h-32" /> : <TaskList tasks={data?.data ?? []} emptyAction={action} showQuote={false} />}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
          <TaskForm defaults={{ quoteId: quote.id, clientId: quote.clientId, userId: quote.assignedUserId ?? undefined }} onCancel={() => setCreating(false)} submitLabel="Criar" onSubmit={async (v) => { try { await create.mutateAsync(v); toast.success('Tarefa criada.'); setCreating(false); } catch (e) { handleApiError(e); } }} />
        </DialogContent>
      </Dialog>
    </>
  );
}
