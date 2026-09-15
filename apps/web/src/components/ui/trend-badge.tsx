import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Indicador de tendência (↑/↓ %) para KPIs com uma base histórica real de comparação.
 * `percentage` deve vir de um cálculo determinístico (ex.: percentageDifference do mês
 * atual vs anterior) — nunca inventar tendência sem um valor de referência genuíno.
 */
export function TrendBadge({ percentage, className }: { percentage: number | null; className?: string }) {
  if (percentage === null || !Number.isFinite(percentage)) return null;
  const flat = Math.abs(percentage) < 0.5;
  const up = percentage > 0;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium',
        flat ? 'bg-muted text-muted-foreground' : up ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400',
        className,
      )}
    >
      <Icon className="size-3" />
      {flat ? '—' : `${up ? '+' : ''}${percentage.toFixed(1)}%`}
    </span>
  );
}
