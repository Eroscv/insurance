import { onlyDigits } from '../validators/document';

export function formatCpf(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, e) => `${a}.${b}.${c}${e ? '-' + e : ''}`);
}
export function formatCnpj(v: string): string {
  const d = onlyDigits(v).slice(0, 14);
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, (_, a, b, c, e, f) => `${a}.${b}.${c}/${e}${f ? '-' + f : ''}`);
}
export function formatDocument(v: string | null | undefined): string {
  if (!v) return '';
  const d = onlyDigits(v);
  return d.length > 11 ? formatCnpj(d) : formatCpf(d);
}
/** Mascara para listagens: 529.***.***-25 ou 11.***.***\/0001-81 */
export function maskDocument(v: string | null | undefined): string {
  if (!v) return '';
  const d = onlyDigits(v);
  if (d.length === 11) return `${d.slice(0, 3)}.***.***-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.***.***/${d.slice(8, 12)}-${d.slice(12)}`;
  return '***';
}
export function formatPhone(v: string | null | undefined): string {
  if (!v) return '';
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, (_, a, b, c) => `(${a}) ${b}${c ? '-' + c : ''}`);
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, (_, a, b, c) => `(${a}) ${b}${c ? '-' + c : ''}`);
}
export function formatCep(v: string | null | undefined): string {
  if (!v) return '';
  const d = onlyDigits(v).slice(0, 8);
  return d.replace(/(\d{5})(\d{0,3})/, (_, a, b) => `${a}${b ? '-' + b : ''}`);
}
export function formatPlate(v: string | null | undefined): string {
  if (!v) return '';
  const p = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return p.length === 7 ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export function formatBRL(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? brl.format(n) : '—';
}
export function formatQuoteNumber(n: number): string {
  return `#${String(n).padStart(6, '0')}`;
}
export function formatDate(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}
export function formatDateTime(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v) : v;
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
