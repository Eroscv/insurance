'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { PRIORITY_LABELS, PRIORITY_VALUES, taskSchema, type TaskInput } from '@insurance/shared';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Task } from '@/lib/queries/tasks';
import { useUserOptions } from '@/lib/queries/users';

type Values = z.input<typeof taskSchema>;

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaskForm({ initial, defaults, onSubmit, onCancel, submitLabel = 'Salvar' }: { initial?: Task | null; defaults?: Partial<Values>; onSubmit: (v: TaskInput) => Promise<void>; onCancel?: () => void; submitLabel?: string }) {
  const { data: users } = useUserOptions();
  const toForm = (): Values => ({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    priority: initial?.priority ?? 'MEDIUM',
    userId: initial?.userId ?? defaults?.userId,
    clientId: initial?.clientId ?? defaults?.clientId ?? null,
    quoteId: initial?.quoteId ?? defaults?.quoteId ?? null,
    dueDate: toLocalInput(initial?.dueDate),
  });
  const form = useForm<Values, unknown, TaskInput>({ resolver: zodResolver(taskSchema), defaultValues: toForm() });
  const e = form.formState.errors;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { form.reset(toForm()); }, [initial, form]);
  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit((v) => onSubmit({ ...v, dueDate: v.dueDate ? new Date(v.dueDate).toISOString() : null }))}>
      <FormField label="Título" htmlFor="t-title" error={e.title?.message} required><Input id="t-title" {...form.register('title')} autoFocus /></FormField>
      <FormField label="Descrição" htmlFor="t-desc" error={e.description?.message}><Textarea id="t-desc" rows={2} {...form.register('description')} /></FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Prazo" htmlFor="t-due" error={e.dueDate?.message}><Input id="t-due" type="datetime-local" {...form.register('dueDate')} /></FormField>
        <FormField label="Prioridade" htmlFor="t-prio" error={e.priority?.message}>
          <Select id="t-prio" {...form.register('priority')}>{PRIORITY_VALUES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}</Select>
        </FormField>
        <FormField label="Responsável" htmlFor="t-user" error={e.userId?.message}>
          <Select id="t-user" {...form.register('userId')}><option value="">Eu mesmo</option>{users?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
        </FormField>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel ? <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button> : null}
        <Button type="submit" loading={form.formState.isSubmitting}>{submitLabel}</Button>
      </div>
    </form>
  );
}
