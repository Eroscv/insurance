import { z } from 'zod';
import { DOCUMENT_TYPE_VALUES } from '../enums';
import { optionalDocumentNumber, optionalEmail, optionalMoney, optionalString, percentage, phone } from './common';

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  legalName: optionalString(200),
  document: optionalDocumentNumber,
  email: optionalEmail,
  phone: phone,
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export const updateOrganizationSettingsSchema = z.object({
  commissionPercentage: percentage,
  staleQuoteDays: z.number().int().min(1).max(90),
  requiredDocumentTypes: z.array(z.enum(DOCUMENT_TYPE_VALUES)),
  proposalValidityDays: z.number().int().min(1).max(90),
  proposalFooterText: optionalString(500),
  /** Alíquota de IOF usada para decompor o prêmio total em líquido + IOF nas telas de proposta/comparativo. */
  iofRatePercent: percentage,
  /** Meta mensal de prêmio fechado (soma dos totalAmount das cotações WON no mês). Vazio = sem meta. */
  monthlyRevenueGoal: optionalMoney,
});
export type UpdateOrganizationSettingsInput = z.infer<typeof updateOrganizationSettingsSchema>;
