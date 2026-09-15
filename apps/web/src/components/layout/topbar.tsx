'use client';
import { LogOut, Menu, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ROLE_LABELS } from '@insurance/shared';
import { Button } from '@/components/ui/button';
import { useLogout, type Me } from '@/lib/queries/auth';

export function Topbar({ onMenu, me, children }: { onMenu: () => void; me?: Me; children?: React.ReactNode }) {
  const router = useRouter();
  const logout = useLogout();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background px-4">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Abrir menu">
        <Menu />
      </Button>
      <div className="flex-1" />
      {children}
      {me ? (
        <div className="hidden items-center gap-2 text-sm sm:flex">
          <User className="size-4 text-muted-foreground" />
          <span className="font-medium">{me.name}</span>
          <span className="text-muted-foreground">· {ROLE_LABELS[me.role]}</span>
        </div>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Sair"
        onClick={async () => {
          await logout.mutateAsync();
          router.replace('/login');
        }}
      >
        <LogOut />
      </Button>
    </header>
  );
}
