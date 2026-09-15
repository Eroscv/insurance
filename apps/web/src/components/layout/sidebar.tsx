'use client';
import { Building2, CheckSquare, FileText, LayoutDashboard, Settings, ShieldCheck, Users, FolderOpen, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clientes', icon: Users },
  { href: '/quotes', label: 'Cotações', icon: FileText },
  { href: '/insurers', label: 'Seguradoras', icon: Building2 },
  { href: '/tasks', label: 'Tarefas', icon: CheckSquare },
  { href: '/documents', label: 'Documentos', icon: FolderOpen },
  { href: '/settings', label: 'Configurações', icon: Settings },
];

export function Sidebar({ open, onClose, orgName }: { open: boolean; onClose: () => void; orgName?: string }) {
  const pathname = usePathname();
  return (
    <>
      {open ? <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} aria-hidden /> : null}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-5" />
            <span className="truncate">{orgName ?? 'Insurance'}</span>
          </Link>
          <button className="lg:hidden" onClick={onClose} aria-label="Fechar menu">
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent',
                  active && 'bg-sidebar-accent font-medium',
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
