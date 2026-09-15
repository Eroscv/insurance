import Decimal from 'decimal.js';

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export type Money = Decimal.Value; // number | string | Decimal

const D = (v: Money) => new Decimal(v);
const round2 = (d: Decimal): string => d.toDecimalPlaces(2).toFixed(2);

/** difference = a - b */
export function difference(a: Money, b: Money): string {
  return round2(D(a).minus(b));
}

/** percentage_difference = ((a - b) / b) * 100 ; b = 0 → null */
export function percentageDifference(a: Money, b: Money): string | null {
  const db = D(b);
  if (db.isZero()) return null;
  return round2(D(a).minus(db).div(db).mul(100));
}

/** total = installment_amount * installments */
export function installmentTotal(installmentAmount: Money, installments: number): string {
  if (!Number.isInteger(installments) || installments < 1) {
    throw new Error('installments must be an integer >= 1');
  }
  return round2(D(installmentAmount).mul(installments));
}

/** commission = premium * percentage / 100 */
export function commission(premium: Money, percentage: Money): string {
  return round2(D(premium).mul(percentage).div(100));
}

export interface ComparableProposal {
  id: string;
  totalAmount: Money;
  deductibleAmount?: Money | null;
}

export interface Highlights {
  lowestPremiumIds: string[];
  lowestDeductibleIds: string[];
}

/** Menor prêmio e menor franquia (empates incluídos). Franquia nula é ignorada. */
export function highlightBest(proposals: ComparableProposal[]): Highlights {
  const result: Highlights = { lowestPremiumIds: [], lowestDeductibleIds: [] };
  if (proposals.length === 0) return result;

  let minPremium: Decimal | null = null;
  for (const p of proposals) {
    const v = D(p.totalAmount);
    if (minPremium === null || v.lt(minPremium)) minPremium = v;
  }
  result.lowestPremiumIds = proposals.filter((p) => D(p.totalAmount).eq(minPremium as Decimal)).map((p) => p.id);

  let minDeductible: Decimal | null = null;
  for (const p of proposals) {
    if (p.deductibleAmount === null || p.deductibleAmount === undefined) continue;
    const v = D(p.deductibleAmount);
    if (minDeductible === null || v.lt(minDeductible)) minDeductible = v;
  }
  if (minDeductible !== null) {
    result.lowestDeductibleIds = proposals
      .filter((p) => p.deductibleAmount !== null && p.deductibleAmount !== undefined && D(p.deductibleAmount).eq(minDeductible as Decimal))
      .map((p) => p.id);
  }
  return result;
}

/** Diferença de cada proposta em relação à mais barata. */
export function differencesFromCheapest(
  proposals: ComparableProposal[],
): Record<string, { difference: string; percentage: string | null }> {
  const out: Record<string, { difference: string; percentage: string | null }> = {};
  if (proposals.length === 0) return out;
  const cheapest = proposals.reduce((m, p) => (D(p.totalAmount).lt(m.totalAmount) ? p : m));
  for (const p of proposals) {
    out[p.id] = {
      difference: difference(p.totalAmount, cheapest.totalAmount),
      percentage: percentageDifference(p.totalAmount, cheapest.totalAmount),
    };
  }
  return out;
}
