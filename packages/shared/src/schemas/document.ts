import { z } from 'zod';
import { DOCUMENT_STATUS_VALUES, DOCUMENT_TYPE_VALUES } from '../enums';
import { optionalString, paginationSchema, uuid } from './common';

export const uploadDocumentSchema = z.object({
  type: z.enum(DOCUMENT_TYPE_VALUES),
  clientId: uuid.optional(),
  quoteId: uuid.optional(),
  notes: optionalString(500),
});
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

export const updateDocumentStatusSchema = z.object({
  status: z.enum(DOCUMENT_STATUS_VALUES),
  notes: optionalString(500),
});
export type UpdateDocumentStatusInput = z.infer<typeof updateDocumentStatusSchema>;

export const listDocumentsSchema = paginationSchema.extend({
  status: z.enum(DOCUMENT_STATUS_VALUES).optional(),
  type: z.enum(DOCUMENT_TYPE_VALUES).optional(),
  clientId: uuid.optional(),
  quoteId: uuid.optional(),
});
export type ListDocumentsQuery = z.infer<typeof listDocumentsSchema>;
