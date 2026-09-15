import { describe, expect, it } from 'vitest';
import { isValidCnpj, isValidCpf, isValidCpfOrCnpj, isValidPlate } from './document';

describe('validators', () => {
  it('cpf', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('529.982.247-26')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
  });
  it('cnpj', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11222333000181')).toBe(true);
    expect(isValidCnpj('11.222.333/0001-82')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
  });
  it('cpf or cnpj', () => {
    expect(isValidCpfOrCnpj('52998224725')).toBe(true);
    expect(isValidCpfOrCnpj('11222333000181')).toBe(true);
    expect(isValidCpfOrCnpj('123456')).toBe(false);
  });
  it('plate', () => {
    expect(isValidPlate('ABC1234')).toBe(true);
    expect(isValidPlate('abc-1234')).toBe(true);
    expect(isValidPlate('ABC1D23')).toBe(true);
    expect(isValidPlate('AB12345')).toBe(false);
  });
});
