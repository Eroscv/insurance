'use client';
import type { QuoteDetail } from '@/lib/queries/quotes';

export function QuoteComparisonTab({ quote }: { quote: QuoteDetail }) {
  void quote;
  return <p className="text-sm text-muted-foreground">Em construção.</p>;
}
