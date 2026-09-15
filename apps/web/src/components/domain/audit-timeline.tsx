import { AUDIT_ACTION_LABELS, formatDateTime, type AuditAction } from '@insurance/shared';
import { History } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import type { AuditRow } from '@/lib/queries/clients';

const ENTITY_LABELS: Record<string, string> = {
  client: 'Cliente',
  vehicle: 'Veículo',
  document: 'Documento',
  quote: 'Cotação',
  quote_insurer: 'Consulta à seguradora',
  proposal: 'Proposta',
  task: 'Tarefa',
  user: 'Usuário',
  organization: 'Organização',
  organization_settings: 'Configurações',
};

function summarize(row: AuditRow): string | null {
  const n = row.newData ?? {};
  const o = row.oldData ?? {};
  if (row.action === 'STATUS_CHANGE' && 'status' in n) return `${String(o.status ?? '—')} → ${String(n.status)}`;
  if (row.entity === 'document' && 'fileName' in n) return String(n.fileName);
  if (row.entity === 'document' && 'fileName' in o) return String(o.fileName);
  if ('name' in n) return String(n.name);
  if ('name' in o) return String(o.name);
  return null;
}

export function AuditTimeline({ rows }: { rows: AuditRow[] }) {
  if (rows.length === 0) return <EmptyState icon={History} title="Sem histórico ainda" />;
  return (
    <ol className="relative ml-2 border-l pl-6">
      {rows.map((r) => (
        <li key={r.id} className="mb-5">
          <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-background bg-primary" />
          <p className="text-sm">
            <span className="font-medium">{AUDIT_ACTION_LABELS[r.action as AuditAction] ?? r.action}</span>
            <span className="text-muted-foreground"> · {ENTITY_LABELS[r.entity] ?? r.entity}</span>
            {summarize(r) ? <span className="text-muted-foreground"> · {summarize(r)}</span> : null}
          </p>
          <p className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}{r.user ? ` · ${r.user.name}` : ''}</p>
        </li>
      ))}
    </ol>
  );
}
