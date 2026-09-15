import { z } from 'zod';
import { CLIENT_TYPE_VALUES, MARITAL_STATUS_VALUES } from '../enums';
import { cep, documentNumber, optionalDateOnly, optionalEmail, optionalString, paginationSchema, phone } from './common';

export const clientSchema = z
  .object({
    type: z.enum(CLIENT_TYPE_VALUES),
    name: z.string().trim().min(2, 'Informe o nome').max(150),
    document: documentNumber,
    birthDate: optionalDateOnly,
    maritalStatus: z.enum(MARITAL_STATUS_VALUES).nullable().optional().or(z.literal('').transform(() => null)),
    email: optionalEmail,
    phone: phone,
    whatsapp: phone,
    zipCode: cep,
    street: optionalString(150),
    number: optionalString(20),
    complement: optionalString(80),
    neighborhood: optionalString(80),
    city: optionalString(80),
    state: z
      .string()
      .trim()
      .toUpperCase()
      .transform((v) => (v === '' ? null : v))
      .pipe(z.string().length(2, 'UF inválida').nullable())
      .nullable()
      .optional(),
    notes: optionalString(2000),
  })
  .refine((v) => (v.type === 'INDIVIDUAL' ? v.document.length === 11 : v.document.length === 14), {
    path: ['document'],
    message: 'Documento incompatível com o tipo de cliente (CPF para PF, CNPJ para PJ)',
  });
export type ClientInput = z.infer<typeof clientSchema>;

export const listClientsSchema = paginationSchema.extend({
  type: z.enum(CLIENT_TYPE_VALUES).optional(),
  city: z.string().trim().max(80).optional(),
});
export type ListClientsQuery = z.infer<typeof listClientsSchema>;
