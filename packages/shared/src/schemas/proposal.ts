import { z } from 'zod';
import { DEDUCTIBLE_TYPE_VALUES, QUOTE_INSURER_STATUS_VALUES } from '../enums';
import { money, optionalDateOnly, optionalMoney, optionalString, percentage, uuid } from './common';

export const addQuoteInsurersSchema = z.object({ insurerIds: z.array(uuid).min(1).max(20) });

export const updateQuoteInsurerSchema = z.object({
  status: z.enum(QUOTE_INSURER_STATUS_VALUES).optional(),
  notes: optionalString(1000),
});
export type UpdateQuoteInsurerInput = z.infer<typeof updateQuoteInsurerSchema>;

export const coverageSchema = z.object({
  name: z.string().trim().min(1, 'Informe a cobertura').max(120),
  insuredAmount: optionalMoney,
  included: z.boolean().default(true),
  notes: optionalString(300),
});
export const assistanceSchema = z.object({
  name: z.string().trim().min(1, 'Informe a assistência').max(120),
  included: z.boolean().default(true),
  description: optionalString(300),
});

export const proposalSchema = z
  .object({
    proposalNumber: optionalString(60),
    totalAmount: money,
    firstInstallment: optionalMoney,
    installmentAmount: optionalMoney,
    installments: z.number().int().min(1).max(24).default(1),
    deductibleAmount: optionalMoney,
    deductibleType: z.enum(DEDUCTIBLE_TYPE_VALUES).nullable().optional().or(z.literal('').transform(() => null)),
    commissionPercentage: percentage.nullable().optional(),
    validityDate: optionalDateOnly,
    notes: optionalString(2000),
    coverages: z.array(coverageSchema).max(50).default([]),
    assistances: z.array(assistanceSchema).max(50).default([]),
  })
  .refine((v) => v.installments === 1 || (v.installmentAmount !== null && v.installmentAmount !== undefined), {
    path: ['installmentAmount'],
    message: 'Informe o valor da parcela quando houver parcelamento',
  });
export type ProposalInput = z.infer<typeof proposalSchema>;

/** Coberturas e assistências mais comuns no seguro auto (sugestões para o formulário). */
export const COMMON_COVERAGES = ['Casco (compreensiva)', 'Danos materiais a terceiros', 'Danos corporais a terceiros', 'Danos morais', 'APP – Morte', 'APP – Invalidez', 'Vidros', 'Roubo e furto', 'Colisão', 'Incêndio'];
export const COMMON_ASSISTANCES = ['Assistência 24h', 'Carro reserva', 'Guincho', 'Chaveiro', 'Vidros', 'Pane seca', 'Troca de pneu', 'Hospedagem'];
