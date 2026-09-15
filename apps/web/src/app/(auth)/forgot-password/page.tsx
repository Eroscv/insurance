'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema } from '@insurance/shared';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';

type Input_ = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const form = useForm<Input_>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });
  const onSubmit = form.handleSubmit(async (values) => {
    await apiClient.post('/auth/forgot-password', values).catch(() => undefined);
    setSent(true);
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recuperar senha</CardTitle>
        <CardDescription>Informe seu e-mail para receber o link de redefinição.</CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p className="text-sm">Se o e-mail existir, enviaremos as instruções em instantes.</p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <FormField label="E-mail" htmlFor="email" error={form.formState.errors.email?.message} required>
              <Input id="email" type="email" {...form.register('email')} />
            </FormField>
            <Button type="submit" loading={form.formState.isSubmitting} className="w-full">
              Enviar link
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="text-muted-foreground hover:underline">
            Voltar ao login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
