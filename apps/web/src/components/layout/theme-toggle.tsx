'use client';
import * as Popover from '@radix-ui/react-popover';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { applyTheme, getStoredTheme, type Theme } from '@/lib/theme';
import { cn } from '@/lib/utils';

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

/** Alterna entre claro/escuro/sistema. Aplica imediatamente e persiste (exceto 'system'). */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  const select = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
  };

  const CurrentIcon = OPTIONS.find((o) => o.value === theme)?.icon ?? Monitor;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Tema: ${OPTIONS.find((o) => o.value === theme)?.label}`} title={`Tema: ${OPTIONS.find((o) => o.value === theme)?.label}`}>
          <CurrentIcon />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 w-40 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md">
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <Popover.Close key={value} asChild>
              <button
                type="button"
                onClick={() => select(value)}
                className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted', theme === value && 'font-medium')}
              >
                <Icon className="size-4" />
                {label}
                {theme === value ? <Check className="ml-auto size-3.5" /> : null}
              </button>
            </Popover.Close>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
