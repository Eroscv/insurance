'use client';
import * as Popover from '@radix-ui/react-popover';
import { formatDateTime } from '@insurance/shared';
import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useMarkAllRead, useMarkNotificationRead, useNotifications, type Notification } from '@/lib/queries/tasks';
import { cn } from '@/lib/utils';

function hrefFor(n: Notification): string | null {
  if (n.entity === 'quote' && n.entityId) return `/quotes/${n.entityId}`;
  if (n.entity === 'task') return '/tasks';
  return null;
}

export function NotificationsBell() {
  const { data } = useNotifications(false);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();
  const unread = data?.unread ?? 0;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ''}`} className="relative">
          <Bell />
          {unread > 0 ? <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">{unread > 99 ? '99+' : unread}</span> : null}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 w-80 rounded-lg border bg-popover p-0 shadow-md sm:w-96">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-sm font-medium">Notificações</p>
            <Button variant="ghost" size="sm" disabled={unread === 0 || markAll.isPending} onClick={() => markAll.mutate()}><CheckCheck /> Ler todas</Button>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {!data || data.data.length === 0 ? <li className="p-4 text-center text-sm text-muted-foreground">Nenhuma notificação.</li> : null}
            {data?.data.map((n) => {
              const href = hrefFor(n);
              const content = (
                <div className={cn('px-3 py-2 text-sm hover:bg-muted', !n.readAt && 'bg-primary/5')} onClick={() => !n.readAt && markRead.mutate(n.id)}>
                  <p className={cn(!n.readAt && 'font-medium')}>{n.title}</p>
                  {n.body ? <p className="text-xs text-muted-foreground">{n.body}</p> : null}
                  <p className="text-[11px] text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                </div>
              );
              return <li key={n.id} className="border-b last:border-0">{href ? <Popover.Close asChild><Link href={href}>{content}</Link></Popover.Close> : content}</li>;
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
