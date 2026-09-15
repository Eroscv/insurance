'use client';
import { CLIENT_TYPE_LABELS, FUEL_LABELS, formatCep, formatDate, formatDocument, formatPhone, formatPlate, formatQuoteNumber, MARITAL_STATUS_LABELS } from '@insurance/shared';
import { Car, FileText, MessageCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { AuditTimeline } from '@/components/domain/audit-timeline';
import { ClientForm } from '@/components/domain/client-form';
import { DocumentList } from '@/components/domain/document-list';
import { DocumentUploadDialog } from '@/components/domain/document-upload-dialog';
import { PriorityBadge, QuoteStatusBadge } from '@/components/domain/status-badges';
import { VehicleForm } from '@/components/domain/vehicle-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { handleApiError } from '@/lib/handle-error';
import { useMe } from '@/lib/queries/auth';
import { useClient, useClientHistory, useClientQuotes, useCreateVehicle, useDeleteClient, useDeleteVehicle, useUpdateClient, useUpdateVehicle, type Vehicle } from '@/lib/queries/clients';
import { useDocuments } from '@/lib/queries/documents';

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground uppercase tracking-wide">{label}</dt>
      <dd className="text-sm">{value || '—'}</dd>
    </div>
  );
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const tab = useSearchParams().get('tab') ?? 'data';
  const { data: me } = useMe();
  const { data: client, isLoading } = useClient(id);
  const update = useUpdateClient(id);
  const del = useDeleteClient();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (isLoading || !client) return <Skeleton className="h-64" />;
  const canDelete = me?.role !== 'BROKER';
  const wa = client.whatsapp ?? client.phone;

  return (
    <>
      <PageHeader
        title={client.name}
        description={`${CLIENT_TYPE_LABELS[client.type]} · ${formatDocument(client.document)}${client.phone ? ' · ' + formatPhone(client.phone) : ''}`}
        actions={
          <>
            {wa ? (
              <Button variant="outline" asChild>
                <a href={`https://wa.me/55${wa}`} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a>
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setEditing(true)}><Pencil /> Editar</Button>
            {canDelete ? <Button variant="ghost" size="icon" onClick={() => setDeleting(true)} title="Excluir"><Trash2 /></Button> : null}
            <Button asChild><Link href={`/quotes/new?clientId=${client.id}`}><Plus /> Nova cotação</Link></Button>
          </>
        }
      />
      <Tabs value={tab} onValueChange={(v) => router.replace(`/clients/${id}?tab=${v}`)}>
        <TabsList>
          <TabsTrigger value="data">Dados</TabsTrigger>
          <TabsTrigger value="quotes">Cotações ({client._count.quotes})</TabsTrigger>
          <TabsTrigger value="documents">Documentos ({client._count.documents})</TabsTrigger>
          <TabsTrigger value="vehicles">Veículos ({client.vehicles.length})</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="data">
          <Card>
            <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
              <Field label="E-mail" value={client.email} />
              <Field label="Telefone" value={formatPhone(client.phone)} />
              <Field label="WhatsApp" value={formatPhone(client.whatsapp)} />
              <Field label="Nascimento" value={client.birthDate ? formatDate(client.birthDate) : null} />
              <Field label="Estado civil" value={client.maritalStatus ? MARITAL_STATUS_LABELS[client.maritalStatus] : null} />
              <Field label="CEP" value={formatCep(client.zipCode)} />
              <Field label="Endereço" value={[client.street, client.number, client.complement].filter(Boolean).join(', ')} />
              <Field label="Bairro" value={client.neighborhood} />
              <Field label="Cidade/UF" value={client.city ? `${client.city}${client.state ? '/' + client.state : ''}` : null} />
              <div className="sm:col-span-3"><Field label="Observações" value={client.notes} /></div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="quotes"><ClientQuotesTab clientId={id} /></TabsContent>
        <TabsContent value="documents"><ClientDocumentsTab clientId={id} /></TabsContent>
        <TabsContent value="vehicles"><VehiclesTab clientId={id} vehicles={client.vehicles} /></TabsContent>
        <TabsContent value="history"><HistoryTab clientId={id} /></TabsContent>
      </Tabs>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Editar cliente</DialogTitle></DialogHeader>
          <ClientForm initial={client} onCancel={() => setEditing(false)} onSubmit={async (v) => { try { await update.mutateAsync(v); toast.success('Cliente atualizado.'); setEditing(false); } catch (e) { handleApiError(e); } }} />
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={deleting} onOpenChange={setDeleting} title="Excluir cliente?" description="O cliente e seus dados deixarão de aparecer nas listagens. Cotações em aberto impedem a exclusão." confirmLabel="Excluir" destructive loading={del.isPending}
        onConfirm={async () => { try { await del.mutateAsync(id); toast.success('Cliente excluído.'); router.replace('/clients'); } catch (e) { handleApiError(e); setDeleting(false); } }} />
    </>
  );
}

function ClientQuotesTab({ clientId }: { clientId: string }) {
  const { data, isLoading } = useClientQuotes(clientId);
  if (isLoading) return <TableSkeleton />;
  if (!data || data.length === 0) return <EmptyState icon={FileText} title="Nenhuma cotação" action={<Button asChild><Link href={`/quotes/new?clientId=${clientId}`}><Plus /> Nova cotação</Link></Button>} />;
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Nº</TableHead><TableHead>Veículo</TableHead><TableHead>Status</TableHead><TableHead>Prioridade</TableHead><TableHead>Corretor</TableHead><TableHead>Criada</TableHead></TableRow></TableHeader>
      <TableBody>
        {data.map((q) => (
          <TableRow key={q.id}>
            <TableCell><Link href={`/quotes/${q.id}`} className="font-mono text-xs hover:underline">{formatQuoteNumber(q.quoteNumber)}</Link></TableCell>
            <TableCell>{q.vehicle ? `${q.vehicle.brand} ${q.vehicle.model}${q.vehicle.plate ? ' · ' + formatPlate(q.vehicle.plate) : ''}` : '—'}</TableCell>
            <TableCell><QuoteStatusBadge status={q.status} /></TableCell>
            <TableCell><PriorityBadge priority={q.priority as 'LOW' | 'MEDIUM' | 'HIGH'} /></TableCell>
            <TableCell>{q.assignedUser?.name ?? '—'}</TableCell>
            <TableCell className="text-muted-foreground">{formatDate(q.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ClientDocumentsTab({ clientId }: { clientId: string }) {
  const [uploading, setUploading] = useState(false);
  const { data, isLoading } = useDocuments({ clientId, pageSize: 100 });
  const action = <Button onClick={() => setUploading(true)}><Plus /> Enviar documento</Button>;
  return (
    <>
      <div className="mb-3 flex justify-end">{action}</div>
      {isLoading ? <TableSkeleton /> : <DocumentList docs={data?.data ?? []} showQuote emptyAction={action} />}
      <DocumentUploadDialog open={uploading} onOpenChange={setUploading} clientId={clientId} />
    </>
  );
}

function VehiclesTab({ clientId, vehicles }: { clientId: string; vehicles: Vehicle[] }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [deleting, setDeleting] = useState<Vehicle | null>(null);
  const create = useCreateVehicle(clientId);
  const update = useUpdateVehicle(clientId);
  const del = useDeleteVehicle(clientId);
  const action = <Button onClick={() => setCreating(true)}><Plus /> Adicionar veículo</Button>;
  return (
    <>
      <div className="mb-3 flex justify-end">{action}</div>
      {vehicles.length === 0 ? (
        <EmptyState icon={Car} title="Nenhum veículo" description="Cadastre o veículo para cotar o seguro auto." action={action} />
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Veículo</TableHead><TableHead>Ano</TableHead><TableHead>Placa</TableHead><TableHead>Combustível</TableHead><TableHead>Uso</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
          <TableBody>
            {vehicles.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.brand} {v.model}{v.version ? <span className="text-muted-foreground"> {v.version}</span> : null}{v.zeroKm ? <span className="ml-2 text-xs text-muted-foreground">0 km</span> : null}</TableCell>
                <TableCell>{v.manufacturingYear}/{v.modelYear}</TableCell>
                <TableCell className="font-mono text-xs">{formatPlate(v.plate) || '—'}</TableCell>
                <TableCell>{v.fuel ? FUEL_LABELS[v.fuel] : '—'}</TableCell>
                <TableCell>{v.usageType || '—'}</TableCell>
                <TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => setEditing(v)}><Pencil /></Button><Button variant="ghost" size="icon" onClick={() => setDeleting(v)}><Trash2 /></Button></div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Dialog open={creating || !!editing} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{editing ? 'Editar veículo' : 'Novo veículo'}</DialogTitle></DialogHeader>
          <VehicleForm initial={editing} onCancel={() => { setCreating(false); setEditing(null); }} onSubmit={async (v) => {
            try {
              if (editing) await update.mutateAsync({ id: editing.id, ...v }); else await create.mutateAsync(v);
              toast.success(editing ? 'Veículo atualizado.' : 'Veículo adicionado.');
              setCreating(false); setEditing(null);
            } catch (e) { handleApiError(e); }
          }} />
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Excluir veículo?" description={deleting ? `${deleting.brand} ${deleting.model}` : undefined} confirmLabel="Excluir" destructive loading={del.isPending}
        onConfirm={async () => { if (!deleting) return; try { await del.mutateAsync(deleting.id); toast.success('Veículo excluído.'); setDeleting(null); } catch (e) { handleApiError(e); } }} />
    </>
  );
}

function HistoryTab({ clientId }: { clientId: string }) {
  const { data, isLoading } = useClientHistory(clientId);
  if (isLoading) return <Skeleton className="h-40" />;
  return <AuditTimeline rows={data ?? []} />;
}
