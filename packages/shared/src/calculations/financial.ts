import Decimal from 'decimal.js';

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

type Money = Decimal.Value;
const D = (v: Money) => new Decimal(v);
const round2 = (d: Decimal): string => d.toDecimalPlaces(2).toFixed(2);

/** Alíquota padrão de IOF sobre seguros no Brasil (parametrizável por organização). */
export const IOF_DEFAULT_RATE = '7.38';

/**
 * O corretor digita o prêmio total (com IOF embutido, como consta na proposta da seguradora).
 * Estas funções apenas decompõem esse valor — não recalculam a tarifação da seguradora.
 */

/** Prêmio líquido = total / (1 + aliquota/100). */
export function netPremiumFromGross(grossPremium: Money, iofRatePercent: Money = IOF_DEFAULT_RATE): string {
  const rate = D(iofRatePercent).div(100);
  return round2(D(grossPremium).div(D(1).plus(rate)));
}

/** IOF = total − líquido. */
export function iofFromGross(grossPremium: Money, iofRatePercent: Money = IOF_DEFAULT_RATE): string {
  const net = netPremiumFromGross(grossPremium, iofRatePercent);
  return round2(D(grossPremium).minus(net));
}

export interface GrossBreakdown {
  netPremium: string;
  iofAmount: string;
  iofRatePercent: string;
  grossPremium: string;
}

/** Decomposição completa do prêmio total em líquido + IOF, para exibição. */
export function breakdownGrossPremium(grossPremium: Money, iofRatePercent: Money = IOF_DEFAULT_RATE): GrossBreakdown {
  return {
    netPremium: netPremiumFromGross(grossPremium, iofRatePercent),
    iofAmount: iofFromGross(grossPremium, iofRatePercent),
    iofRatePercent: D(iofRatePercent).toFixed(2),
    grossPremium: round2(D(grossPremium)),
  };
}

export interface InstallmentSimulation {
  installmentAmount: string;
  totalAmount: string;
  totalInterest: string;
}

/**
 * Parcelamento com juros compostos (tabela Price / PMT), para simular o valor da parcela
 * quando a seguradora não informa um valor fixo. Não substitui o valor digitado pelo corretor.
 */
export function installmentWithInterest(principal: Money, installments: number, monthlyRatePercent: Money): InstallmentSimulation {
  if (!Number.isInteger(installments) || installments < 1) throw new Error('installments must be an integer >= 1');
  const p = D(principal);
  const i = D(monthlyRatePercent).div(100);
  if (i.isZero()) {
    const amount = round2(p.div(installments));
    return { installmentAmount: amount, totalAmount: round2(p), totalInterest: '0.00' };
  }
  // PMT = P * i * (1+i)^n / ((1+i)^n - 1)
  const factor = D(1).plus(i).pow(installments);
  const pmt = p.mul(i).mul(factor).div(factor.minus(1));
  const total = pmt.mul(installments);
  return { installmentAmount: round2(pmt), totalAmount: round2(total), totalInterest: round2(total.minus(p)) };
}

/** Valor proporcional (pro-rata dia) para cancelamento ou vigência em período curto. */
export function proRataPremium(annualPremium: Money, daysElapsed: number, daysInYear = 365): string {
  if (daysElapsed < 0 || daysInYear <= 0) throw new Error('invalid period');
  return round2(D(annualPremium).mul(daysElapsed).div(daysInYear));
}

export interface RenewalComparison {
  savings: string;
  savingsPercentage: string | null;
  isCheaper: boolean;
}

/** Compara o novo prêmio com o da apólice vigente (informado manualmente pelo corretor na renovação). */
export function renewalComparison(newTotal: Money, expiringTotal: Money): RenewalComparison {
  const savings = round2(D(expiringTotal).minus(newTotal));
  const expiring = D(expiringTotal);
  const savingsPercentage = expiring.isZero() ? null : round2(D(savings).div(expiring).mul(100));
  return { savings, savingsPercentage, isCheaper: D(savings).gt(0) };
}
