import { describe, expect, it } from 'vitest';
import { breakdownGrossPremium, installmentWithInterest, iofFromGross, netPremiumFromGross, proRataPremium, renewalComparison } from './financial';

describe('financial calculations', () => {
  it('netPremiumFromGross / iofFromGross decompose the gross premium', () => {
    // gross = net * 1.0738 → net = gross / 1.0738
    expect(netPremiumFromGross('1073.80', '7.38')).toBe('1000.00');
    expect(iofFromGross('1073.80', '7.38')).toBe('73.80');
  });
  it('breakdownGrossPremium uses the default rate when omitted', () => {
    const b = breakdownGrossPremium('1073.80');
    expect(b).toEqual({ netPremium: '1000.00', iofAmount: '73.80', iofRatePercent: '7.38', grossPremium: '1073.80' });
  });
  it('installmentWithInterest computes PMT (Price table)', () => {
    const r = installmentWithInterest(1000, 12, 2);
    // PMT conhecido para 12x de 1000 a 2% a.m. ≈ 94.56
    expect(r.installmentAmount).toBe('94.56');
    expect(r.totalAmount).toBe('1134.72');
    expect(r.totalInterest).toBe('134.72');
  });
  it('installmentWithInterest with zero rate is a plain division', () => {
    const r = installmentWithInterest(1200, 12, 0);
    expect(r.installmentAmount).toBe('100.00');
    expect(r.totalInterest).toBe('0.00');
  });
  it('installmentWithInterest rejects invalid installments', () => {
    expect(() => installmentWithInterest(100, 0, 2)).toThrow();
  });
  it('proRataPremium', () => {
    expect(proRataPremium(1200, 182)).toBe('598.36');
    expect(proRataPremium(1200, 0)).toBe('0.00');
    expect(proRataPremium(1200, 365)).toBe('1200.00');
  });
  it('renewalComparison flags savings on renewal', () => {
    expect(renewalComparison(2900, 3200)).toEqual({ savings: '300.00', savingsPercentage: '9.38', isCheaper: true });
    expect(renewalComparison(3400, 3200)).toEqual({ savings: '-200.00', savingsPercentage: '-6.25', isCheaper: false });
    expect(renewalComparison(100, 0)).toEqual({ savings: '-100.00', savingsPercentage: null, isCheaper: false });
  });
});
