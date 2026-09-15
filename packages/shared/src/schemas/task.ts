import { z } from 'zod';
import { PRIORITY_VALUES, TASK_STATUS_VALUES } from '../enums';
import { optionalString, paginationSchema, uuid } from './common';

export const taskSchema = z.object({
  title: z.string().trim().min(2, 'Informe o título').max(150),
  description: optionalString(2000),
  priority: z.enum(PRIORITY_VALUES).default('MEDIUM'),
  userId: z
    .union([uuid, z.literal('')])
    .transform((v) => (v === '' ? undefined : v))
    .optional(),
  clientId: uuid.nullable().optional(),
  quoteId: uuid.nullable().optional(),
  dueDate: z
    .string()
    .transform((v) => (v === '' ? null : v))
    .pipe(z.string().datetime({ offset: true }).nullable())
    .nullable()
    .optional(),
});
export type TaskInput = z.infer<typeof taskSchema>;

export const updateTaskStatusSchema = z.object({ status: z.enum(TASK_STATUS_VALUES) });

export const listTasksSchema = paginationSchema.extend({
  status: z.enum(TASK_STATUS_VALUES).optional(),
  userId: z
    .union([uuid, z.literal('')])
    .transform((v) => (v === '' ? undefined : v))
    .optional(),
  clientId: uuid.optional(),
  quoteId: uuid.optional(),
  overdue: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  open: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type ListTasksQuery = z.infer<typeof listTasksSchema>;

export const listNotificationsSchema = paginationSchema.extend({
  unreadOnly: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>;
