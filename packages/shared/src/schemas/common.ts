import { z } from 'zod';
import { isValidCep, isValidCpfOrCnpj, onlyDigits } from '../validators/document';

export const uuid = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  sort: z
    .string()
    .regex(/^[a-zA-Z_.]+:(asc|desc)$/)
    .optional(),
});
export type PaginationQuery = z.infer<typeof paginationSchema>;

export const documentNumber = z
  .string()
  .transform(onlyDigits)
  .refine(isValidCpfOrCnpj, 'CPF/CNPJ inválido');

export const optionalDocumentNumber = z
  .string()
  .transform((v) => (v ? onlyDigits(v) : ''))
  .refine((v) => v === '' || isValidCpfOrCnpj(v), 'CPF/CNPJ inválido')
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

export const phone = z
  .string()
  .transform(onlyDigits)
  .refine((v) => v === '' || (v.length >= 10 && v.length <= 11), 'Telefone inválido')
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

export const cep = z
  .string()
  .transform(onlyDigits)
  .refine((v) => v === '' || isValidCep(v), 'CEP inválido')
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

export const optionalString = (max = 255) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const optionalEmail = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v.toLowerCase()))
  .pipe(z.string().email('E-mail inválido').nullable())
  .nullable()
  .optional();

/** Data no formato YYYY-MM-DD (sem hora). */
export const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida');
export const optionalDateOnly = z
  .string()
  .transform((v) => (v === '' ? null : v))
  .pipe(dateOnly.nullable())
  .nullable()
  .optional();

/** Valor monetário como string decimal com até 2 casas (evita float). */
export const money = z
  .union([z.number(), z.string()])
  .transform((v) => String(v).replace(',', '.').trim())
  .refine((v) => /^-?\d+(\.\d{1,2})?$/.test(v), 'Valor inválido');
export const optionalMoney = z
  .union([z.number(), z.string(), z.null()])
  .transform((v) => (v === null || v === '' ? null : String(v).replace(',', '.').trim()))
  .refine((v) => v === null || /^-?\d+(\.\d{1,2})?$/.test(v), 'Valor inválido')
  .nullable()
  .optional();

export const percentage = z.number().min(0).max(100);
