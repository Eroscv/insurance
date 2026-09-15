import { z } from 'zod';
import { FUEL_VALUES } from '../enums';
import { isValidPlate } from '../validators/document';
import { optionalString } from './common';

const currentYear = new Date().getFullYear();

export const vehicleSchema = z
  .object({
    brand: z.string().trim().min(1, 'Informe a marca').max(60),
    model: z.string().trim().min(1, 'Informe o modelo').max(80),
    version: optionalString(80),
    manufacturingYear: z.number().int().min(1950).max(currentYear + 1),
    modelYear: z.number().int().min(1950).max(currentYear + 2),
    plate: z
      .string()
      .trim()
      .toUpperCase()
      .transform((v) => v.replace(/[^A-Z0-9]/g, ''))
      .refine((v) => v === '' || isValidPlate(v), 'Placa inválida')
      .transform((v) => (v === '' ? null : v))
      .nullable()
      .optional(),
    chassis: optionalString(30),
    renavam: optionalString(20),
    fuel: z.enum(FUEL_VALUES).nullable().optional().or(z.literal('').transform(() => null)),
    zeroKm: z.boolean().default(false),
    usageType: optionalString(60),
    overnightLocation: optionalString(120),
  })
  .refine((v) => v.modelYear >= v.manufacturingYear && v.modelYear <= v.manufacturingYear + 1, {
    path: ['modelYear'],
    message: 'Ano modelo deve ser igual ao ano de fabricação ou o seguinte',
  });
export type VehicleInput = z.infer<typeof vehicleSchema>;
