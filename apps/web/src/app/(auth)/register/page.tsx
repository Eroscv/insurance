'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@insurance/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { useRegister } from '@/lib/queries/auth';

export default function RegisterPage() {
  const router = useRouter();
  const register = useRegister();
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { organizationName: '', name: '', email: '', password: '' },
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await register.mutateAsync(values);
      toast.success('Conta criada. Bem-vindo!');
      router.replace('/dashboard');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível criar a conta.');
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>Cadastre sua corretora e o usuário administrador.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FormField label="Nome da corretora" htmlFor="organizationName" error={errors.organizationName?.message} required>
            <Input id="organizationName" {...form.register('organizationName')} />
          </FormField>
          <FormField label="Seu nome" htmlFor="name" error={errors.name?.message} required>
            <Input id="name" autoComplete="name" {...form.register('name')} />
          </FormField>
          <FormField label="E-mail" htmlFor="email" error={errors.email?.message} required>
            <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
          </FormField>
          <FormField label="Senha" htmlFor="password" error={errors.password?.message} hint="Mínimo 8 caracteres, com letras e números." required>
            <Input id="password" type="password" autoComplete="new-password" {...form.register('password')} />
          </FormField>
          <Button type="submit" loading={register.isPending} className="w-full">
            Criar conta
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Entrar
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
