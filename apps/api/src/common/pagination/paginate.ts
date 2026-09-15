import type { PaginationQuery } from '@insurance/shared';

export interface Page<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export function pageArgs(q: PaginationQuery) {
  return { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}

export function toPage<T>(data: T[], total: number, q: PaginationQuery): Page<T> {
  return {
    data,
    meta: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) },
  };
}

/** Converte "field:asc" em orderBy, restrito a uma allowlist de campos. */
export function parseSort(
  sort: string | undefined,
  allowed: readonly string[],
  fallback: Record<string, 'asc' | 'desc'>,
): Record<string, 'asc' | 'desc'> {
  if (!sort) return fallback;
  const [field, dir] = sort.split(':') as [string, 'asc' | 'desc'];
  if (!allowed.includes(field)) return fallback;
  return { [field]: dir };
}
