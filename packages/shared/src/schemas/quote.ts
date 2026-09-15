import { z } from 'zod';
import {
  DEDUCTIBLE_TYPE_VALUES,
  INSURANCE_TYPE_VALUES,
  LOST_REASON_VALUES,
  MARITAL_STATUS_VALUES,
  PRIORITY_VALUES,
  QUOTE_STATUS_VALUES,
} from '../enums';
import { cep, optionalDateOnly, optionalDocumentNumber, optionalString, paginationSchema, uuid } from './common';

const emptyToNull = <T extends z.ZodTypeAny>(schema: T) => schema.nullable().optional().or(z.literal('').transform(() => null));

export const quoteAutoDetailsSchema = z.object({
  mainDriverName: optionalString(150),
  mainDriverDocument: optionalDocumentNumber,
  mainDriverBirthDate: optionalDateOnly,
  maritalStatus: emptyToNull(z.enum(MARITAL_STATUS_VALUES)),
  profession: optionalString(100),
  residenceZipCode: cep,
  vehicleUsage: optionalString(80),
  annualMileage: z.number().int().min(0).max(1_000_000).nullable().optional(),
  hasHomeGarage: z.boolean().nullable().optional(),
  hasWorkGarage: z.boolean().nullable().optional(),
  commercialUse: z.boolean().nullable().optional(),
  appUsage: z.boolean().nullable().optional(),
  numberOfDrivers: z.number().int().min(1).max(20).nullable().optional(),
  deductibleType: emptyToNull(z.enum(DEDUCTIBLE_TYPE_VALUES)),
  desiredCoverage: optionalString(1000),
});
export type QuoteAutoDetailsInput = z.infer<typeof quoteAutoDetailsSchema>;

export const createQuoteSchema = z.object({
  clientId: uuid,
  vehicleId: uuid.nullable().optional(),
  insuranceType: z.enum(INSURANCE_TYPE_VALUES).default('AUTO'),
  priority: z.enum(PRIORITY_VALUES).default('MEDIUM'),
  assignedUserId: uuid.nullable().optional(),
  notes: optionalString(2000),
  autoDetails: quoteAutoDetailsSchema.optional(),
  insurerIds: z.array(uuid).max(20).optional(),
});
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

export const updateQuoteSchema = z.object({
  vehicleId: uuid.nullable().optional(),
  priority: z.enum(PRIORITY_VALUES).optional(),
  assignedUserId: uuid.nullable().optional(),
  notes: optionalString(2000),
});
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;

export const changeQuoteStatusSchema = z.object({
  status: z.enum(QUOTE_STATUS_VALUES),
  lostReason: emptyToNull(z.enum(LOST_REASON_VALUES)),
  lostNotes: optionalString(500),
  reason: optionalString(500),
});
export type ChangeQuoteStatusInput = z.infer<typeof changeQuoteStatusSchema>;

export const assignQuoteSchema = z.object({ assignedUserId: uuid.nullable() });

const csv = <T extends z.ZodTypeAny>(item: T) =>
  z
    .union([z.array(item), item])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .optional();

export const listQuotesSchema = paginationSchema.extend({
  status: csv(z.enum(QUOTE_STATUS_VALUES)),
  assignedUserId: uuid.optional(),
  insurerId: uuid.optional(),
  clientId: uuid.optional(),
  insuranceType: z.enum(INSURANCE_TYPE_VALUES).optional(),
  priority: z.enum(PRIORITY_VALUES).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  open: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ListQuotesQuery = z.infer<typeof listQuotesSchema>;
