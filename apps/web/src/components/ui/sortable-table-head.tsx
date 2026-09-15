'use client';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { TableHead } from './table';
import { cn } from '@/lib/utils';

export interface ParsedSort {
  field: string;
  direction: 'asc' | 'desc';
}

/** Lê "campo:asc"/"campo:desc" do estado de filtros usado pelas listagens. */
export function parseSort(sort: string | undefined): ParsedSort | null {
  if (!sort) return null;
  const [field, direction] = sort.split(':');
  if (!field || (direction !== 'asc' && direction !== 'desc')) return null;
  return { field, direction };
}

interface SortableTableHeadProps extends React.ComponentProps<'th'> {
  /** Campo aceito pela API para este cabeçalho (deve casar com o allowlist do backend). */
  sortKey: string;
  /** Valor atual de `sort` no estado de filtros, ex.: "name:asc". */
  sort: string | undefined;
  /** Chamado com o novo valor de `sort` a aplicar. */
  onSort: (sort: string) => void;
  /** Direção inicial ao clicar pela primeira vez neste campo (padrão: "asc"). */
  defaultDirection?: 'asc' | 'desc';
}

/**
 * Cabeçalho de tabela clicável para ordenação server-side. Alterna asc → desc → asc a cada clique
 * no mesmo campo; clicar em outro campo começa em `defaultDirection`.
 */
export function SortableTableHead({ sortKey, sort, onSort, defaultDirection = 'asc', className, children, ...props }: SortableTableHeadProps) {
  const current = parseSort(sort);
  const active = current?.field === sortKey;
  const nextDirection = active ? (current.direction === 'asc' ? 'desc' : 'asc') : defaultDirection;
  return (
    <TableHead
      role="columnheader"
      aria-sort={active ? (current.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('cursor-pointer select-none whitespace-nowrap hover:text-foreground', className)}
      onClick={() => onSort(`${sortKey}:${nextDirection}`)}
      {...props}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active ? (
          current.direction === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
        ) : (
          <ChevronsUpDown className="size-3 opacity-30" />
        )}
      </span>
    </TableHead>
  );
}
