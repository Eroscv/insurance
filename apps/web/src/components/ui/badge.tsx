import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary text-primary-foreground',
      secondary: 'border-transparent bg-secondary text-secondary-foreground',
      outline: 'text-foreground',
      success: 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400',
      warning: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
      destructive: 'border-transparent bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400',
      info: 'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-400',
      muted: 'border-transparent bg-muted text-muted-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { Badge, badgeVariants };
