'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { formatDocument, formatPhone, insurerSchema, type InsurerInput } from '@insurance/shared';
import { Building2, ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { handleApiError } from '@/lib/handle-error';
import { useMe } from '@/lib/queries/auth';
import { useCreateInsurer, useDeleteInsurer, useInsurers, useUpdateInsurer, useUploadInsurerLogo, type InsurerRow } from '@/lib/queries/insurers';

type FormValues = z.input<typeof insurerSchema>;
const toForm = (i?: InsurerRow | null): FormValues => ({ name: i?.name ?? '', document: i?.document ? formatDocument(i.document) : '', email: i?.email ?? '', phone: i?.phone ? formatPhone(i.phone) : '', website: i?.website ?? '', active: i?.active ?? true, notes: i?.notes ?? '' });

export default function InsurersPage() {
  const { data: me } = useMe();
  const isAdmin = me?.role === 'ADMIN';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('name:asc');
  const { data, isLoading } = useInsurers({ search, page, pageSize: 20, sort });
  const [editing, setEditing] = useState<InsurerRow | null | 'new'>(null);
  const [deleting, setDeleting] = useState<InsurerRow | null>(null);
  const del = useDeleteInsurer();
  const upload = useUploadInsurerLogo();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoTarget, setLogoTarget] = useState<string | null>(null);

  return (
    <>
      <PageHeader title="Seguradoras" description="Seguradoras consultadas nas cotações. Sem integração automática: registro manual das propostas." actions={isAdmin ? <Button onClick={() => setEditing('new')}><Plus /> Nova seguradora</Button> : undefined} />
      <div className="mb-4"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Buscar seguradora" className="sm:w-80" /></div>
      {isLoading ? <TableSkeleton /> : !data || data.data.length === 0 ? (
        <EmptyState icon={Building2} title="Nenhuma seguradora" description={isAdmin ? 'Cadastre as seguradoras com que você trabalha.' : 'Peça ao administrador para cadastrar.'} action={isAdmin ? <Button onClick={() => setEditing('new')}><Plus /> Nova seguradora</Button> : undefined} />
      ) : (
        <>
          <Table>
            <TableHeader><TableRow><SortableTableHead sortKey="name" sort={sort} onSort={(s) => { setSort(s); setPage(1); }}>Seguradora</SortableTableHead><TableHead>Contato</TableHead><TableHead className="text-center">Consultas</TableHead><TableHead>Ativa</TableHead>{isAdmin ? <TableHead className="w-32" /> : null}</TableRow></TableHeader>
            <TableBody>
              {data.data.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {i.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={i.logoUrl} alt="" className="size-8 rounded border object-contain" />
                      ) : <div className="flex size-8 items-center justify-center rounded border bg-muted text-xs">{i.name.slice(0, 2).toUpperCase()}</div>}
                      <div><p className="font-medium">{i.name}</p>{i.website ? <a href={i.website.startsWith('http') ? i.website : `https://${i.website}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline">{i.website}</a> : null}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{[i.email, formatPhone(i.phone)].filter(Boolean).join(' · ') || '—'}</TableCell>
                  <TableCell className="text-center">{i.quotesCount}</TableCell>
                  <TableCell>{i.active ? <Badge variant="success">Ativa</Badge> : <Badge variant="muted">Inativa</Badge>}</TableCell>
                  {isAdmin ? (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Logo" onClick={() => { setLogoTarget(i.id); fileRef.current?.click(); }}><ImagePlus /></Button>
                        <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditing(i)}><Pencil /></Button>
                        <Button variant="ghost" size="icon" title="Excluir" onClick={() => setDeleting(i)}><Trash2 /></Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination meta={data.meta} onPageChange={setPage} />
        </>
      )}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f || !logoTarget) return; try { await upload.mutateAsync({ id: logoTarget, file: f }); toast.success('Logo atualizada.'); } catch (err) { handleApiError(err); } finally { e.target.value = ''; } }} />
      <InsurerDialog insurer={editing} onOpenChange={(o) => !o && setEditing(null)} />
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Excluir seguradora?" description="Seguradoras com consultas vinculadas devem ser desativadas." confirmLabel="Excluir" destructive loading={del.isPending}
        onConfirm={async () => { if (!deleting) return; try { await del.mutateAsync(deleting.id); toast.success('Seguradora excluída.'); setDeleting(null); } catch (e) { handleApiError(e); } }} />
    </>
  );
}

function InsurerDialog({ insurer, onOpenChange }: { insurer: InsurerRow | null | 'new'; onOpenChange: (o: boolean) => void }) {
  const create = useCreateInsurer();
  const update = useUpdateInsurer();
  const form = useForm<FormValues, unknown, InsurerInput>({ resolver: zodResolver(insurerSchema), defaultValues: toForm() });
  const e = form.formState.errors;
  useEffect(() => { form.reset(toForm(insurer === 'new' ? null : insurer)); }, [insurer, form]);
  return (
    <Dialog open={!!insurer} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{insurer === 'new' ? 'Nova seguradora' : 'Editar seguradora'}</DialogTitle></DialogHeader>
        <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit(async (v) => {
          try {
            if (insurer && insurer !== 'new') await update.mutateAsync({ id: insurer.id, ...v }); else await create.mutateAsync(v);
            toast.success('Seguradora salva.'); onOpenChange(false);
          } catch (err) { handleApiError(err); }
        })}>
          <FormField label="Nome" htmlFor="i-name" error={e.name?.message} required><Input id="i-name" {...form.register('name')} /></FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="CNPJ" htmlFor="i-doc" error={e.document?.message}><Input id="i-doc" {...form.register('document')} /></FormField>
            <FormField label="Telefone" htmlFor="i-phone" error={e.phone?.message}><Input id="i-phone" {...form.register('phone')} /></FormField>
            <FormField label="E-mail" htmlFor="i-email" error={e.email?.message}><Input id="i-email" type="email" {...form.register('email')} /></FormField>
            <FormField label="Site" htmlFor="i-web" error={e.website?.message}><Input id="i-web" {...form.register('website')} /></FormField>
          </div>
          <FormField label="Observações" htmlFor="i-notes" error={e.notes?.message}><Textarea id="i-notes" rows={2} {...form.register('notes')} /></FormField>
          <Controller control={form.control} name="active" render={({ field }) => (
            <label className="flex items-center gap-2 text-sm"><Switch checked={field.value ?? true} onCheckedChange={field.onChange} /> Ativa (disponível para novas cotações)</label>
          )} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" loading={create.isPending || update.isPending}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
