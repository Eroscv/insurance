'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@insurance/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { useLogin } from '@/lib/queries/auth';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      router.replace(params.get('next') || '/dashboard');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível entrar.');
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Acesse a plataforma da sua corretora.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FormField label="E-mail" htmlFor="email" error={form.formState.errors.email?.message} required>
            <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
          </FormField>
          <FormField label="Senha" htmlFor="password" error={form.formState.errors.password?.message} required>
            <Input id="password" type="password" autoComplete="current-password" {...form.register('password')} />
          </FormField>
          <Button type="submit" loading={login.isPending} className="w-full">
            Entrar
          </Button>
          <div className="flex justify-between text-sm">
            <Link href="/forgot-password" className="text-muted-foreground hover:underline">
              Esqueci minha senha
            </Link>
            <Link href="/register" className="text-primary hover:underline">
              Criar conta
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
