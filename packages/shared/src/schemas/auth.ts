import { z } from 'zod';
import { documentNumber, optionalString, phone } from './common';

export const passwordSchema = z
  .string()
  .min(8, 'Mínimo de 8 caracteres')
  .max(72)
  .regex(/[A-Za-z]/, 'Inclua ao menos uma letra')
  .regex(/\d/, 'Inclua ao menos um número');

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  organizationName: z.string().trim().min(2, 'Informe o nome da corretora').max(120),
  organizationDocument: documentNumber.optional(),
  organizationPhone: phone,
  name: z.string().trim().min(2, 'Informe seu nome').max(120),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
});
export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: passwordSchema,
});
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: optionalString(20),
});
