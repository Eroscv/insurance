'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema } from '@insurance/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ApiError, apiClient } from '@/lib/api-client';

const schema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'As senhas não conferem' });

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } });
  const onSubmit = form.handleSubmit(async ({ password }) => {
    try {
      await apiClient.post('/auth/reset-password', { token, password });
      toast.success('Senha redefinida. Faça login.');
      router.replace('/login');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível redefinir.');
    }
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova senha</CardTitle>
        <CardDescription>Defina uma nova senha para sua conta.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FormField label="Nova senha" htmlFor="password" error={form.formState.errors.password?.message} required>
            <Input id="password" type="password" autoComplete="new-password" {...form.register('password')} />
          </FormField>
          <FormField label="Confirmar senha" htmlFor="confirm" error={form.formState.errors.confirm?.message} required>
            <Input id="confirm" type="password" autoComplete="new-password" {...form.register('confirm')} />
          </FormField>
          <Button type="submit" loading={form.formState.isSubmitting} className="w-full">
            Salvar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
