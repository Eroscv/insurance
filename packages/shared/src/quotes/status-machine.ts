import type { LostReason, QuoteStatus, Role } from '../enums';
import { hasPermission, Permission } from '../permissions';

/** Snapshot determinístico do estado da cotação usado pelos guards. Montado pelo service com dados do banco. */
export interface QuoteSnapshot {
  pendingRequiredDocs: number;
  hasVehicle: boolean;
  proposalCount: number;
  hasSelectedProposal: boolean;
  lostReason?: LostReason | null;
  lostNotes?: string | null;
}

export type TransitionResult = { ok: true } | { ok: false; reason: string };

const OPEN: QuoteStatus[] = [
  'NEW',
  'WAITING_DOCUMENTS',
  'DATA_COMPLETE',
  'QUOTING',
  'WAITING_PROPOSALS',
  'PROPOSALS_RECEIVED',
  'PROPOSAL_SENT',
  'NEGOTIATION',
];

const NEXT: Record<QuoteStatus, QuoteStatus[]> = {
  NEW: ['WAITING_DOCUMENTS', 'DATA_COMPLETE'],
  WAITING_DOCUMENTS: ['DATA_COMPLETE', 'NEW'],
  DATA_COMPLETE: ['QUOTING', 'WAITING_DOCUMENTS'],
  QUOTING: ['WAITING_PROPOSALS', 'DATA_COMPLETE'],
  WAITING_PROPOSALS: ['PROPOSALS_RECEIVED', 'QUOTING'],
  PROPOSALS_RECEIVED: ['PROPOSAL_SENT', 'WAITING_PROPOSALS'],
  PROPOSAL_SENT: ['NEGOTIATION', 'WON', 'PROPOSALS_RECEIVED'],
  NEGOTIATION: ['WON', 'PROPOSAL_SENT'],
  WON: [],
  LOST: ['PROPOSALS_RECEIVED', 'NEGOTIATION'],
  CANCELLED: ['PROPOSALS_RECEIVED', 'NEGOTIATION'],
};

const REQUIRES_DATA_COMPLETE = new Set<QuoteStatus>([
  'DATA_COMPLETE',
  'QUOTING',
  'WAITING_PROPOSALS',
  'PROPOSALS_RECEIVED',
  'PROPOSAL_SENT',
  'NEGOTIATION',
  'WON',
]);

export function isOpenStatus(s: QuoteStatus): boolean {
  return OPEN.includes(s);
}
export function isTerminalStatus(s: QuoteStatus): boolean {
  return !isOpenStatus(s);
}

export function allowedTransitions(from: QuoteStatus): QuoteStatus[] {
  const base = NEXT[from];
  return isOpenStatus(from) ? [...base, 'LOST', 'CANCELLED'] : base;
}

/**
 * Verifica se a transição from → to é permitida e se os guards passam.
 * Função pura: sem banco, sem HTTP. Usada pelo backend (fonte da verdade) e pelo frontend (UX).
 */
export function canTransition(
  from: QuoteStatus,
  to: QuoteStatus,
  snapshot: QuoteSnapshot,
  role: Role = 'ADMIN',
): TransitionResult {
  if (from === to) return { ok: false, reason: 'A cotação já está neste status.' };
  if (!allowedTransitions(from).includes(to)) {
    return { ok: false, reason: `Transição de ${from} para ${to} não é permitida.` };
  }
  if (isTerminalStatus(from) && !hasPermission(role, Permission.QUOTES_REOPEN)) {
    return { ok: false, reason: 'Apenas administradores e gestores podem reabrir cotações.' };
  }

  const fromBeforeDataComplete = from === 'NEW' || from === 'WAITING_DOCUMENTS';
  if (fromBeforeDataComplete && REQUIRES_DATA_COMPLETE.has(to)) {
    if (snapshot.pendingRequiredDocs > 0) {
      return {
        ok: false,
        reason: `Existem ${snapshot.pendingRequiredDocs} documento(s) obrigatório(s) pendente(s).`,
      };
    }
    if (!snapshot.hasVehicle) return { ok: false, reason: 'Vincule um veículo à cotação.' };
  }
  if (to === 'PROPOSAL_SENT' && snapshot.proposalCount < 1) {
    return { ok: false, reason: 'Cadastre pelo menos uma proposta antes de marcar como enviada.' };
  }
  if (to === 'WON' && !snapshot.hasSelectedProposal) {
    return { ok: false, reason: 'Selecione uma proposta antes de fechar a cotação.' };
  }
  if (to === 'LOST') {
    if (!snapshot.lostReason) return { ok: false, reason: 'Informe o motivo da perda.' };
    if (snapshot.lostReason === 'OTHER' && !snapshot.lostNotes?.trim()) {
      return { ok: false, reason: 'Descreva o motivo da perda.' };
    }
  }
  return { ok: true };
}
