'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { createUserSchema, ROLE_LABELS, ROLE_VALUES, updateUserSchema, type CreateUserInput, type UpdateUserInput } from '@insurance/shared';
import { Plus, UserCog } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { handleApiError } from '@/lib/handle-error';
import { useMe } from '@/lib/queries/auth';
import { useCreateUser, useSetUserActive, useUpdateUser, useUsers, type User } from '@/lib/queries/users';

export default function UsersPage() {
  const { data: me } = useMe();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useUsers({ search, page, pageSize: 20 });
  const setActive = useSetUserActive();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  if (me && me.role !== 'ADMIN') return <p className="text-sm text-muted-foreground">Apenas administradores acessam esta página.</p>;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Buscar por nome ou e-mail" className="sm:w-80" />
        <Button onClick={() => setCreating(true)}>
          <Plus /> Novo usuário
        </Button>
      </div>
      {isLoading ? (
        <TableSkeleton />
      ) : !data || data.data.length === 0 ? (
        <EmptyState icon={UserCog} title="Nenhum usuário encontrado" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}{u.id === me?.id ? <span className="ml-1 text-xs text-muted-foreground">(você)</span> : null}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell><Badge variant="secondary">{ROLE_LABELS[u.role]}</Badge></TableCell>
                  <TableCell>
                    <Switch
                      checked={u.active}
                      disabled={u.id === me?.id || setActive.isPending}
                      onCheckedChange={async (active) => {
                        try {
                          await setActive.mutateAsync({ id: u.id, active });
                          toast.success(active ? 'Usuário ativado.' : 'Usuário desativado.');
                        } catch (e) {
                          handleApiError(e);
                        }
                      }}
                      aria-label={u.active ? 'Desativar' : 'Ativar'}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(u)}>Editar</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination meta={data.meta} onPageChange={setPage} />
        </>
      )}
      <CreateUserDialog open={creating} onOpenChange={setCreating} />
      <EditUserDialog user={editing} onOpenChange={(o) => !o && setEditing(null)} selfId={me?.id} />
    </div>
  );
}

function CreateUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateUser();
  const form = useForm<CreateUserInput>({ resolver: zodResolver(createUserSchema), defaultValues: { name: '', email: '', role: 'BROKER', password: '' } });
  const e = form.formState.errors;
  useEffect(() => { if (!open) form.reset(); }, [open, form]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>Informe os dados e uma senha inicial. O usuário poderá alterá-la depois.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={form.handleSubmit(async (v) => {
            try {
              await create.mutateAsync(v);
              toast.success('Usuário criado.');
              onOpenChange(false);
            } catch (err) {
              handleApiError(err);
            }
          })}
        >
          <FormField label="Nome" htmlFor="c-name" error={e.name?.message} required><Input id="c-name" {...form.register('name')} /></FormField>
          <FormField label="E-mail" htmlFor="c-email" error={e.email?.message} required><Input id="c-email" type="email" {...form.register('email')} /></FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Perfil" htmlFor="c-role" error={e.role?.message} required>
              <Select id="c-role" {...form.register('role')}>
                {ROLE_VALUES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </Select>
            </FormField>
            <FormField label="Telefone" htmlFor="c-phone" error={e.phone?.message}><Input id="c-phone" {...form.register('phone')} /></FormField>
          </div>
          <FormField label="Senha inicial" htmlFor="c-password" error={e.password?.message} required><Input id="c-password" type="password" autoComplete="new-password" {...form.register('password')} /></FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" loading={create.isPending}>Criar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, onOpenChange, selfId }: { user: User | null; onOpenChange: (o: boolean) => void; selfId?: string }) {
  const update = useUpdateUser();
  const form = useForm<UpdateUserInput>({ resolver: zodResolver(updateUserSchema) });
  const e = form.formState.errors;
  useEffect(() => { if (user) form.reset({ name: user.name, role: user.role, phone: user.phone ?? '', password: undefined }); }, [user, form]);
  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={form.handleSubmit(async (v) => {
            if (!user) return;
            try {
              await update.mutateAsync({ id: user.id, ...v, password: v.password || undefined });
              toast.success('Usuário atualizado.');
              onOpenChange(false);
            } catch (err) {
              handleApiError(err);
            }
          })}
        >
          <FormField label="Nome" htmlFor="e-name" error={e.name?.message} required><Input id="e-name" {...form.register('name')} /></FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Perfil" htmlFor="e-role" error={e.role?.message}>
              <Select id="e-role" disabled={user?.id === selfId} {...form.register('role')}>
                {ROLE_VALUES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </Select>
            </FormField>
            <FormField label="Telefone" htmlFor="e-phone" error={e.phone?.message}><Input id="e-phone" {...form.register('phone')} /></FormField>
          </div>
          <FormField label="Nova senha" htmlFor="e-password" error={e.password?.message} hint="Deixe em branco para manter a atual."><Input id="e-password" type="password" autoComplete="new-password" {...form.register('password')} /></FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" loading={update.isPending}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
