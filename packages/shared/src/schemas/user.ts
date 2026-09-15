import { z } from 'zod';
import { ROLE_VALUES } from '../enums';
import { passwordSchema } from './auth';
import { optionalString, paginationSchema } from './common';

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  role: z.enum(ROLE_VALUES),
  phone: optionalString(20),
  password: passwordSchema,
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(ROLE_VALUES).optional(),
  phone: optionalString(20),
  password: passwordSchema.optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const setUserActiveSchema = z.object({ active: z.boolean() });

export const listUsersSchema = paginationSchema.extend({
  role: z.enum(ROLE_VALUES).optional(),
  active: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersSchema>;
