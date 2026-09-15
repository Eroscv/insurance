import { describe, expect, it } from 'vitest';
import {
  commission,
  difference,
  differencesFromCheapest,
  highlightBest,
  installmentTotal,
  percentageDifference,
} from './index';

describe('calculations', () => {
  it('difference', () => {
    expect(difference(3200, 2900)).toBe('300.00');
    expect(difference('2900.10', '3200.05')).toBe('-299.95');
  });
  it('percentageDifference', () => {
    expect(percentageDifference(3200, 2900)).toBe('10.34');
    expect(percentageDifference(2900, 3200)).toBe('-9.38');
    expect(percentageDifference(100, 0)).toBeNull();
  });
  it('installmentTotal', () => {
    expect(installmentTotal('266.67', 12)).toBe('3200.04');
    expect(installmentTotal(0.1, 3)).toBe('0.30');
    expect(() => installmentTotal(10, 0)).toThrow();
  });
  it('commission', () => {
    expect(commission(3200, 15)).toBe('480.00');
    expect(commission('2999.99', '12.5')).toBe('375.00');
  });
  it('highlightBest with ties and null deductible', () => {
    const r = highlightBest([
      { id: 'porto', totalAmount: 3200, deductibleAmount: 4000 },
      { id: 'azul', totalAmount: 2900, deductibleAmount: 5000 },
      { id: 'tokio', totalAmount: '2900.00', deductibleAmount: null },
      { id: 'allianz', totalAmount: 3450, deductibleAmount: 3500 },
    ]);
    expect(r.lowestPremiumIds).toEqual(['azul', 'tokio']);
    expect(r.lowestDeductibleIds).toEqual(['allianz']);
    expect(highlightBest([])).toEqual({ lowestPremiumIds: [], lowestDeductibleIds: [] });
  });
  it('differencesFromCheapest', () => {
    const r = differencesFromCheapest([
      { id: 'a', totalAmount: 3200 },
      { id: 'b', totalAmount: 2900 },
    ]);
    expect(r.a).toEqual({ difference: '300.00', percentage: '10.34' });
    expect(r.b).toEqual({ difference: '0.00', percentage: '0.00' });
  });
});
