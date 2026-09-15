'use client';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Input } from './input';

/** Campo de busca com debounce. */
export function SearchInput({ value, onChange, placeholder = 'Buscar...', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (local !== value) onChange(local);
    }, 350);
    return () => clearTimeout(t);
  }, [local, value, onChange]);
  return (
    <div className={className}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder={placeholder} className="pl-8" />
      </div>
    </div>
  );
}
