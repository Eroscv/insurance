'use client';
import { PRIORITY_LABELS, PRIORITY_VALUES, QUOTE_STATUS_LABELS, QUOTE_STATUS_VALUES, type Priority, type QuoteStatus } from '@insurance/shared';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useInsurerOptions } from '@/lib/queries/insurers';
import type { QuoteFilters as Filters } from '@/lib/queries/quotes';
import { useUserOptions } from '@/lib/queries/users';

export function QuoteFilters({ value, onChange, showStatus = true }: { value: Filters; onChange: (f: Filters) => void; showStatus?: boolean }) {
  const { data: users } = useUserOptions();
  const { data: insurers } = useInsurerOptions();
  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch, page: 1 });
  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <SearchInput value={value.search ?? ''} onChange={(v) => set({ search: v })} placeholder="Nº, cliente, CPF ou placa" className="sm:col-span-3 lg:col-span-2" />
      {showStatus ? (
        <Select value={value.status?.[0] ?? ''} onChange={(e) => set({ status: e.target.value ? [e.target.value as QuoteStatus] : undefined, open: undefined })}>
          <option value="">Todos os status</option>
          {QUOTE_STATUS_VALUES.map((s) => <option key={s} value={s}>{QUOTE_STATUS_LABELS[s]}</option>)}
        </Select>
      ) : null}
      <Select value={value.assignedUserId ?? ''} onChange={(e) => set({ assignedUserId: e.target.value || undefined })}>
        <option value="">Todos os corretores</option>
        {users?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </Select>
      <Select value={value.insurerId ?? ''} onChange={(e) => set({ insurerId: e.target.value || undefined })}>
        <option value="">Todas as seguradoras</option>
        {insurers?.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
      </Select>
      <Select value={value.priority ?? ''} onChange={(e) => set({ priority: (e.target.value || undefined) as Priority | undefined })}>
        <option value="">Toda prioridade</option>
        {PRIORITY_VALUES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
      </Select>
      <div className="flex items-center gap-2 sm:col-span-3 lg:col-span-2">
        <Input type="date" value={value.from ?? ''} onChange={(e) => set({ from: e.target.value || undefined })} aria-label="De" />
        <span className="text-xs text-muted-foreground">até</span>
        <Input type="date" value={value.to ?? ''} onChange={(e) => set({ to: e.target.value || undefined })} aria-label="Até" />
      </div>
    </div>
  );
}
