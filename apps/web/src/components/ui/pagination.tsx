'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function Pagination({ meta, onPageChange }: { meta: PageMeta; onPageChange: (page: number) => void }) {
  if (meta.total === 0) return null;
  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);
  return (
    <div className="flex items-center justify-between gap-3 py-3 text-sm text-muted-foreground">
      <span>
        {from}–{to} de {meta.total}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)} aria-label="Página anterior">
          <ChevronLeft />
        </Button>
        <span className="px-2">
          {meta.page} / {meta.totalPages}
        </span>
        <Button variant="outline" size="icon" disabled={meta.page >= meta.totalPages} onClick={() => onPageChange(meta.page + 1)} aria-label="Próxima página">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
