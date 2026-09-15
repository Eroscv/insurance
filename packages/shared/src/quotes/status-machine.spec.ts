import { describe, expect, it } from 'vitest';
import { allowedTransitions, canTransition, type QuoteSnapshot } from './status-machine';

const ok: QuoteSnapshot = {
  pendingRequiredDocs: 0,
  hasVehicle: true,
  proposalCount: 2,
  hasSelectedProposal: true,
  lostReason: 'PRICE',
};

describe('status machine', () => {
  it('linear flow works with a complete snapshot', () => {
    const flow = [
      'NEW',
      'WAITING_DOCUMENTS',
      'DATA_COMPLETE',
      'QUOTING',
      'WAITING_PROPOSALS',
      'PROPOSALS_RECEIVED',
      'PROPOSAL_SENT',
      'NEGOTIATION',
      'WON',
    ] as const;
    for (let i = 0; i < flow.length - 1; i++) {
      expect(canTransition(flow[i], flow[i + 1], ok)).toEqual({ ok: true });
    }
  });
  it('rejects skipping steps and same status', () => {
    expect(canTransition('NEW', 'QUOTING', ok).ok).toBe(false);
    expect(canTransition('NEW', 'NEW', ok).ok).toBe(false);
    expect(canTransition('WON', 'NEW', ok).ok).toBe(false);
  });
  it('DATA_COMPLETE requires docs and vehicle', () => {
    expect(canTransition('WAITING_DOCUMENTS', 'DATA_COMPLETE', { ...ok, pendingRequiredDocs: 2 }).ok).toBe(false);
    expect(canTransition('NEW', 'DATA_COMPLETE', { ...ok, hasVehicle: false }).ok).toBe(false);
    expect(canTransition('NEW', 'WAITING_DOCUMENTS', { ...ok, pendingRequiredDocs: 2, hasVehicle: false }).ok).toBe(true);
  });
  it('PROPOSAL_SENT requires a proposal', () => {
    expect(canTransition('PROPOSALS_RECEIVED', 'PROPOSAL_SENT', { ...ok, proposalCount: 0 }).ok).toBe(false);
  });
  it('WON requires selected proposal', () => {
    expect(canTransition('NEGOTIATION', 'WON', { ...ok, hasSelectedProposal: false }).ok).toBe(false);
    expect(canTransition('PROPOSAL_SENT', 'WON', ok).ok).toBe(true);
  });
  it('LOST requires a reason; OTHER requires notes', () => {
    expect(canTransition('QUOTING', 'LOST', { ...ok, lostReason: null }).ok).toBe(false);
    expect(canTransition('QUOTING', 'LOST', { ...ok, lostReason: 'OTHER', lostNotes: '' }).ok).toBe(false);
    expect(canTransition('QUOTING', 'LOST', { ...ok, lostReason: 'OTHER', lostNotes: 'x' }).ok).toBe(true);
    expect(canTransition('NEW', 'LOST', { ...ok, pendingRequiredDocs: 5, hasVehicle: false }).ok).toBe(true);
  });
  it('reopen only for ADMIN/MANAGER', () => {
    expect(canTransition('LOST', 'NEGOTIATION', ok, 'BROKER').ok).toBe(false);
    expect(canTransition('LOST', 'NEGOTIATION', ok, 'MANAGER').ok).toBe(true);
    expect(canTransition('WON', 'NEGOTIATION', ok, 'ADMIN').ok).toBe(false);
  });
  it('allowedTransitions includes LOST/CANCELLED for open statuses only', () => {
    expect(allowedTransitions('NEW')).toContain('LOST');
    expect(allowedTransitions('WON')).toHaveLength(0);
    expect(allowedTransitions('LOST')).not.toContain('CANCELLED');
  });
});
