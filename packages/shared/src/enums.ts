// Espelho dos enums do Prisma (packages/database/prisma/schema.prisma).
// Fonte única para o frontend; o backend usa os enums gerados pelo Prisma (valores idênticos).

export const Role = { ADMIN: 'ADMIN', MANAGER: 'MANAGER', BROKER: 'BROKER' } as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ClientType = { INDIVIDUAL: 'INDIVIDUAL', COMPANY: 'COMPANY' } as const;
export type ClientType = (typeof ClientType)[keyof typeof ClientType];

export const MaritalStatus = {
  SINGLE: 'SINGLE',
  MARRIED: 'MARRIED',
  DIVORCED: 'DIVORCED',
  WIDOWED: 'WIDOWED',
  STABLE_UNION: 'STABLE_UNION',
} as const;
export type MaritalStatus = (typeof MaritalStatus)[keyof typeof MaritalStatus];

export const Fuel = {
  GASOLINE: 'GASOLINE',
  ETHANOL: 'ETHANOL',
  FLEX: 'FLEX',
  DIESEL: 'DIESEL',
  ELECTRIC: 'ELECTRIC',
  HYBRID: 'HYBRID',
  GNV: 'GNV',
} as const;
export type Fuel = (typeof Fuel)[keyof typeof Fuel];

export const DocumentType = {
  CNH: 'CNH',
  CRLV: 'CRLV',
  ID: 'ID',
  ADDRESS_PROOF: 'ADDRESS_PROOF',
  PROPOSAL: 'PROPOSAL',
  OTHER: 'OTHER',
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const DocumentStatus = {
  PENDING: 'PENDING',
  RECEIVED: 'RECEIVED',
  VALIDATED: 'VALIDATED',
  REJECTED: 'REJECTED',
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const InsuranceType = { AUTO: 'AUTO' } as const;
export type InsuranceType = (typeof InsuranceType)[keyof typeof InsuranceType];

export const QuoteStatus = {
  NEW: 'NEW',
  WAITING_DOCUMENTS: 'WAITING_DOCUMENTS',
  DATA_COMPLETE: 'DATA_COMPLETE',
  QUOTING: 'QUOTING',
  WAITING_PROPOSALS: 'WAITING_PROPOSALS',
  PROPOSALS_RECEIVED: 'PROPOSALS_RECEIVED',
  PROPOSAL_SENT: 'PROPOSAL_SENT',
  NEGOTIATION: 'NEGOTIATION',
  WON: 'WON',
  LOST: 'LOST',
  CANCELLED: 'CANCELLED',
} as const;
export type QuoteStatus = (typeof QuoteStatus)[keyof typeof QuoteStatus];

/** Ordem do pipeline (Kanban). Terminais LOST/CANCELLED ficam fora do fluxo linear. */
export const QUOTE_PIPELINE: QuoteStatus[] = [
  'NEW',
  'WAITING_DOCUMENTS',
  'DATA_COMPLETE',
  'QUOTING',
  'WAITING_PROPOSALS',
  'PROPOSALS_RECEIVED',
  'PROPOSAL_SENT',
  'NEGOTIATION',
  'WON',
];
export const QUOTE_OPEN_STATUSES: QuoteStatus[] = QUOTE_PIPELINE.filter((s) => s !== 'WON');
export const QUOTE_CLOSED_STATUSES: QuoteStatus[] = ['WON', 'LOST', 'CANCELLED'];

export const Priority = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' } as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const LostReason = {
  PRICE: 'PRICE',
  CLIENT_GAVE_UP: 'CLIENT_GAVE_UP',
  COMPETITOR: 'COMPETITOR',
  INSURER_REFUSED: 'INSURER_REFUSED',
  NO_RESPONSE: 'NO_RESPONSE',
  OTHER: 'OTHER',
} as const;
export type LostReason = (typeof LostReason)[keyof typeof LostReason];

export const QuoteInsurerStatus = {
  NOT_STARTED: 'NOT_STARTED',
  REQUESTED: 'REQUESTED',
  WAITING: 'WAITING',
  RECEIVED: 'RECEIVED',
  REFUSED: 'REFUSED',
  NO_RESPONSE: 'NO_RESPONSE',
  CANCELLED: 'CANCELLED',
} as const;
export type QuoteInsurerStatus = (typeof QuoteInsurerStatus)[keyof typeof QuoteInsurerStatus];

export const ProposalStatus = {
  RECEIVED: 'RECEIVED',
  SELECTED: 'SELECTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;
export type ProposalStatus = (typeof ProposalStatus)[keyof typeof ProposalStatus];

export const DeductibleType = {
  STANDARD: 'STANDARD',
  REDUCED: 'REDUCED',
  INCREASED: 'INCREASED',
  NONE: 'NONE',
} as const;
export type DeductibleType = (typeof DeductibleType)[keyof typeof DeductibleType];

export const TaskStatus = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const NotificationType = {
  NEW_TASK: 'NEW_TASK',
  TASK_OVERDUE: 'TASK_OVERDUE',
  DOCUMENT_RECEIVED: 'DOCUMENT_RECEIVED',
  DOCUMENT_PENDING: 'DOCUMENT_PENDING',
  PROPOSAL_RECEIVED: 'PROPOSAL_RECEIVED',
  PROPOSAL_EXPIRING: 'PROPOSAL_EXPIRING',
  STALE_QUOTE: 'STALE_QUOTE',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const AuditAction = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  STATUS_CHANGE: 'STATUS_CHANGE',
  UPLOAD: 'UPLOAD',
  SEND: 'SEND',
  SELECT_PROPOSAL: 'SELECT_PROPOSAL',
  LOGIN: 'LOGIN',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

const values = <T extends Record<string, string>>(o: T) => Object.values(o) as [T[keyof T], ...T[keyof T][]];
export const ROLE_VALUES = values(Role);
export const CLIENT_TYPE_VALUES = values(ClientType);
export const MARITAL_STATUS_VALUES = values(MaritalStatus);
export const FUEL_VALUES = values(Fuel);
export const DOCUMENT_TYPE_VALUES = values(DocumentType);
export const DOCUMENT_STATUS_VALUES = values(DocumentStatus);
export const INSURANCE_TYPE_VALUES = values(InsuranceType);
export const QUOTE_STATUS_VALUES = values(QuoteStatus);
export const PRIORITY_VALUES = values(Priority);
export const LOST_REASON_VALUES = values(LostReason);
export const QUOTE_INSURER_STATUS_VALUES = values(QuoteInsurerStatus);
export const PROPOSAL_STATUS_VALUES = values(ProposalStatus);
export const DEDUCTIBLE_TYPE_VALUES = values(DeductibleType);
export const TASK_STATUS_VALUES = values(TaskStatus);
export const NOTIFICATION_TYPE_VALUES = values(NotificationType);
export const AUDIT_ACTION_VALUES = values(AuditAction);
