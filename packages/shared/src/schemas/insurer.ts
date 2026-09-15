import { z } from 'zod';
import { optionalDocumentNumber, optionalEmail, optionalString, paginationSchema, phone } from './common';

export const insurerSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome').max(120),
  document: optionalDocumentNumber,
  email: optionalEmail,
  phone: phone,
  website: optionalString(200),
  active: z.boolean().default(true),
  notes: optionalString(1000),
});
export type InsurerInput = z.infer<typeof insurerSchema>;

export const listInsurersSchema = paginationSchema.extend({
  active: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ListInsurersQuery = z.infer<typeof listInsurersSchema>;
