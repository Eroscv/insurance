import type * as E from './enums';

export const ROLE_LABELS: Record<E.Role, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gestor',
  BROKER: 'Corretor',
};
export const CLIENT_TYPE_LABELS: Record<E.ClientType, string> = {
  INDIVIDUAL: 'Pessoa física',
  COMPANY: 'Pessoa jurídica',
};
export const MARITAL_STATUS_LABELS: Record<E.MaritalStatus, string> = {
  SINGLE: 'Solteiro(a)',
  MARRIED: 'Casado(a)',
  DIVORCED: 'Divorciado(a)',
  WIDOWED: 'Viúvo(a)',
  STABLE_UNION: 'União estável',
};
export const FUEL_LABELS: Record<E.Fuel, string> = {
  GASOLINE: 'Gasolina',
  ETHANOL: 'Etanol',
  FLEX: 'Flex',
  DIESEL: 'Diesel',
  ELECTRIC: 'Elétrico',
  HYBRID: 'Híbrido',
  GNV: 'GNV',
};
export const DOCUMENT_TYPE_LABELS: Record<E.DocumentType, string> = {
  CNH: 'CNH',
  CRLV: 'CRLV',
  ID: 'Documento de identidade',
  ADDRESS_PROOF: 'Comprovante de endereço',
  PROPOSAL: 'Proposta',
  OTHER: 'Outro',
};
export const DOCUMENT_STATUS_LABELS: Record<E.DocumentStatus, string> = {
  PENDING: 'Pendente',
  RECEIVED: 'Recebido',
  VALIDATED: 'Validado',
  REJECTED: 'Rejeitado',
};
export const INSURANCE_TYPE_LABELS: Record<E.InsuranceType, string> = { AUTO: 'Auto' };
export const QUOTE_STATUS_LABELS: Record<E.QuoteStatus, string> = {
  NEW: 'Nova',
  WAITING_DOCUMENTS: 'Aguardando documentos',
  DATA_COMPLETE: 'Dados completos',
  QUOTING: 'Cotando',
  WAITING_PROPOSALS: 'Aguardando propostas',
  PROPOSALS_RECEIVED: 'Propostas recebidas',
  PROPOSAL_SENT: 'Proposta enviada',
  NEGOTIATION: 'Negociação',
  WON: 'Fechada',
  LOST: 'Perdida',
  CANCELLED: 'Cancelada',
};
export const PRIORITY_LABELS: Record<E.Priority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
};
export const LOST_REASON_LABELS: Record<E.LostReason, string> = {
  PRICE: 'Preço',
  CLIENT_GAVE_UP: 'Cliente desistiu',
  COMPETITOR: 'Concorrente',
  INSURER_REFUSED: 'Recusa da seguradora',
  NO_RESPONSE: 'Sem retorno',
  OTHER: 'Outro',
};
export const QUOTE_INSURER_STATUS_LABELS: Record<E.QuoteInsurerStatus, string> = {
  NOT_STARTED: 'Não iniciada',
  REQUESTED: 'Solicitada',
  WAITING: 'Aguardando',
  RECEIVED: 'Recebida',
  REFUSED: 'Recusada',
  NO_RESPONSE: 'Sem resposta',
  CANCELLED: 'Cancelada',
};
export const PROPOSAL_STATUS_LABELS: Record<E.ProposalStatus, string> = {
  RECEIVED: 'Recebida',
  SELECTED: 'Selecionada',
  REJECTED: 'Rejeitada',
  EXPIRED: 'Vencida',
};
export const DEDUCTIBLE_TYPE_LABELS: Record<E.DeductibleType, string> = {
  STANDARD: 'Normal',
  REDUCED: 'Reduzida',
  INCREASED: 'Majorada',
  NONE: 'Sem franquia',
};
export const TASK_STATUS_LABELS: Record<E.TaskStatus, string> = {
  TODO: 'A fazer',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluída',
  CANCELLED: 'Cancelada',
};
export const NOTIFICATION_TYPE_LABELS: Record<E.NotificationType, string> = {
  NEW_TASK: 'Nova tarefa',
  TASK_OVERDUE: 'Tarefa vencida',
  DOCUMENT_RECEIVED: 'Documento recebido',
  DOCUMENT_PENDING: 'Documento pendente',
  PROPOSAL_RECEIVED: 'Proposta recebida',
  PROPOSAL_EXPIRING: 'Proposta próxima do vencimento',
  STALE_QUOTE: 'Cotação parada',
};
export const AUDIT_ACTION_LABELS: Record<E.AuditAction, string> = {
  CREATE: 'Criação',
  UPDATE: 'Alteração',
  DELETE: 'Exclusão',
  STATUS_CHANGE: 'Mudança de status',
  UPLOAD: 'Upload',
  SEND: 'Envio',
  SELECT_PROPOSAL: 'Seleção de proposta',
  LOGIN: 'Login',
};
