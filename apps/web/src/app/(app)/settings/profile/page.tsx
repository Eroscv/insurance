'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema, updateProfileSchema } from '@insurance/shared';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { handleApiError } from '@/lib/handle-error';
import { useMe } from '@/lib/queries/auth';
import { useChangePassword, useUpdateProfile } from '@/lib/queries/users';

type Profile = z.infer<typeof updateProfileSchema>;
type Pwd = z.infer<typeof changePasswordSchema>;

export default function ProfilePage() {
  const { data: me } = useMe();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const pf = useForm<Profile>({ resolver: zodResolver(updateProfileSchema) });
  const pw = useForm<Pwd>({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: '', newPassword: '' } });
  useEffect(() => { if (me) pf.reset({ name: me.name, phone: me.phone ?? '' }); }, [me, pf]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Meus dados</CardTitle><CardDescription>{me?.email}</CardDescription></CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" noValidate onSubmit={pf.handleSubmit(async (v) => { try { await updateProfile.mutateAsync(v); toast.success('Perfil salvo.'); } catch (e) { handleApiError(e); } })}>
            <FormField label="Nome" htmlFor="p-name" error={pf.formState.errors.name?.message} required><Input id="p-name" {...pf.register('name')} /></FormField>
            <FormField label="Telefone" htmlFor="p-phone" error={pf.formState.errors.phone?.message}><Input id="p-phone" {...pf.register('phone')} /></FormField>
            <div><Button type="submit" loading={updateProfile.isPending}>Salvar</Button></div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Alterar senha</CardTitle><CardDescription>Ao alterar, as demais sessões serão encerradas.</CardDescription></CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" noValidate onSubmit={pw.handleSubmit(async (v) => { try { await changePassword.mutateAsync(v); toast.success('Senha alterada.'); pw.reset(); } catch (e) { handleApiError(e); } })}>
            <FormField label="Senha atual" htmlFor="cur" error={pw.formState.errors.currentPassword?.message} required><Input id="cur" type="password" autoComplete="current-password" {...pw.register('currentPassword')} /></FormField>
            <FormField label="Nova senha" htmlFor="new" error={pw.formState.errors.newPassword?.message} required><Input id="new" type="password" autoComplete="new-password" {...pw.register('newPassword')} /></FormField>
            <div><Button type="submit" loading={changePassword.isPending}>Alterar senha</Button></div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
