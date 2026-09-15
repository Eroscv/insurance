import { describe, expect, it } from 'vitest';
import { formatBRL, formatCnpj, formatCpf, formatPhone, formatQuoteNumber, maskDocument } from './index';

describe('formatters', () => {
  it('cpf/cnpj', () => {
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(maskDocument('52998224725')).toBe('529.***.***-25');
    expect(maskDocument('11222333000181')).toBe('11.***.***/0001-81');
  });
  it('phone', () => {
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
  });
  it('brl and quote number', () => {
    expect(formatBRL('3200.5').replace(/\u00a0/g, ' ')).toBe('R$ 3.200,50');
    expect(formatQuoteNumber(123)).toBe('#000123');
  });
});
