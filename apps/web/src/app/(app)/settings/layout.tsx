'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { useMe } from '@/lib/queries/auth';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/settings', label: 'Organização', admin: true },
  { href: '/settings/users', label: 'Usuários', admin: true },
  { href: '/settings/profile', label: 'Meu perfil', admin: false },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: me } = useMe();
  const isAdmin = me?.role === 'ADMIN';
  return (
    <>
      <PageHeader title="Configurações" />
      <div className="mb-6 flex gap-1 overflow-x-auto border-b">
        {TABS.filter((t) => !t.admin || isAdmin).map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground whitespace-nowrap hover:text-foreground',
              pathname === t.href && 'border-primary text-foreground',
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {children}
    </>
  );
}
