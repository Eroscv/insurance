import { ShieldCheck } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-primary">
          <ShieldCheck className="size-7" />
          <span className="text-xl font-semibold tracking-tight">Insurance</span>
        </div>
        {children}
      </div>
    </div>
  );
}
