'use client';
import { DOCUMENT_TYPE_LABELS, formatDate, formatDateTime, formatDocument, formatPhone, formatPlate, formatQuoteNumber, INSURANCE_TYPE_LABELS, LOST_REASON_LABELS, PRIORITY_LABELS, PRIORITY_VALUES, QUOTE_STATUS_LABELS, type Priority } from '@insurance/shared';
import { AlertTriangle, ArrowRightLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { AuditTimeline } from '@/components/domain/audit-timeline';
import { AutoDetailsForm } from '@/components/domain/auto-details-form';
import { DocumentList } from '@/components/domain/document-list';
import { DocumentUploadDialog } from '@/components/domain/document-upload-dialog';
import { QuoteStatusDialog } from '@/components/domain/quote-status-dialog';
import { PriorityBadge, QuoteStatusBadge } from '@/components/domain/status-badges';
import { QuoteInsurersTab } from '@/components/domain/quote-insurers-tab';
import { QuoteProposalsTab } from '@/components/domain/quote-proposals-tab';
import { QuoteComparisonTab } from '@/components/domain/quote-comparison-tab';
import { QuoteTasksTab } from '@/components/domain/quote-tasks-tab';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { handleApiError } from '@/lib/handle-error';
import { useMe } from '@/lib/queries/auth';
import { useDocuments } from '@/lib/queries/documents';
import { useDeleteQuote, useQuote, useQuoteHistory, useUpdateAutoDetails, useUpdateQuote, type QuoteDetail } from '@/lib/queries/quotes';
import { useUserOptions } from '@/lib/queries/users';

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground uppercase tracking-wide">{label}</dt>
      <dd className="text-sm">{value || '—'}</dd>
    </div>
  );
}

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const tab = useSearchParams().get('tab') ?? 'overview';
  const { data: me } = useMe();
  const { data: quote, isLoading } = useQuote(id);
  const del = useDeleteQuote();
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  if (isLoading || !quote || !me) return <Skeleton className="h-64" />;
  const canDelete = me.role !== 'BROKER';

  return (
    <>
      <PageHeader
        title={`Cotação ${formatQuoteNumber(quote.quoteNumber)}`}
        description={`${INSURANCE_TYPE_LABELS[quote.insuranceType]} · criada em ${formatDate(quote.createdAt)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setStatusOpen(true)}><ArrowRightLeft /> Alterar status</Button>
            {canDelete ? <Button variant="ghost" size="icon" title="Excluir" onClick={() => setDeleting(true)}><Trash2 /></Button> : null}
          </>
        }
      />
      <div className="mb-4 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase">Cliente</p>
          <Link href={`/clients/${quote.client.id}`} className="font-medium hover:underline">{quote.client.name}</Link>
          <p className="text-xs text-muted-foreground">{formatDocument(quote.client.document)}{quote.client.phone ? ' · ' + formatPhone(quote.client.whatsapp ?? quote.client.phone) : ''}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase">Status</p>
          <QuoteStatusBadge status={quote.status} />
          {quote.status === 'LOST' && quote.lostReason ? <p className="mt-1 text-xs text-muted-foreground">{LOST_REASON_LABELS[quote.lostReason]}{quote.lostNotes ? ` — ${quote.lostNotes}` : ''}</p> : null}
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase">Corretor</p>
          <p className="text-sm">{quote.assignedUser?.name ?? 'Sem responsável'}</p>
          <PriorityBadge priority={quote.priority} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase">Veículo</p>
          <p className="text-sm">{quote.vehicle ? `${quote.vehicle.brand} ${quote.vehicle.model} ${quote.vehicle.manufacturingYear}/${quote.vehicle.modelYear}` : '—'}</p>
          <p className="text-xs text-muted-foreground">{quote.vehicle?.plate ? formatPlate(quote.vehicle.plate) : ''}</p>
        </div>
      </div>
      {quote.pendingRequiredDocs.length > 0 && !['WON', 'LOST', 'CANCELLED'].includes(quote.status) ? (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="size-4" /> Documentos obrigatórios pendentes: {quote.pendingRequiredDocs.map((t) => DOCUMENT_TYPE_LABELS[t]).join(', ')}.
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => router.replace(`/quotes/${id}?tab=${v}`)}>
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="data">Dados</TabsTrigger>
          <TabsTrigger value="documents">Documentos ({quote._count.documents})</TabsTrigger>
          <TabsTrigger value="insurers">Seguradoras ({quote.quoteInsurers.length})</TabsTrigger>
          <TabsTrigger value="proposals">Propostas ({quote.quoteInsurers.reduce((n, qi) => n + qi.proposals.length, 0)})</TabsTrigger>
          <TabsTrigger value="comparison">Comparativo</TabsTrigger>
          <TabsTrigger value="tasks">Tarefas ({quote._count.tasks})</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab quote={quote} canReassign={me.role !== 'BROKER'} /></TabsContent>
        <TabsContent value="data"><DataTab quote={quote} /></TabsContent>
        <TabsContent value="documents"><DocumentsTab quote={quote} /></TabsContent>
        <TabsContent value="insurers"><QuoteInsurersTab quote={quote} /></TabsContent>
        <TabsContent value="proposals"><QuoteProposalsTab quote={quote} /></TabsContent>
        <TabsContent value="comparison"><QuoteComparisonTab quote={quote} /></TabsContent>
        <TabsContent value="tasks"><QuoteTasksTab quote={quote} /></TabsContent>
        <TabsContent value="history"><HistoryTab quoteId={id} /></TabsContent>
      </Tabs>

      <QuoteStatusDialog quote={statusOpen ? quote : null} role={me.role} onOpenChange={setStatusOpen} />
      <ConfirmDialog open={deleting} onOpenChange={setDeleting} title="Excluir cotação?" description="A cotação deixará de aparecer nas listagens." confirmLabel="Excluir" destructive loading={del.isPending}
        onConfirm={async () => { try { await del.mutateAsync(id); toast.success('Cotação excluída.'); router.replace('/quotes'); } catch (e) { handleApiError(e); setDeleting(false); } }} />
    </>
  );
}

function OverviewTab({ quote, canReassign }: { quote: QuoteDetail; canReassign: boolean }) {
  const update = useUpdateQuote(quote.id);
  const { data: users } = useUserOptions();
  const [notes, setNotes] = useState(quote.notes ?? '');
  const [expiringPremium, setExpiringPremium] = useState(quote.expiringPremium ?? '');
  const save = async (patch: Parameters<typeof update.mutateAsync>[0]) => { try { await update.mutateAsync(patch); toast.success('Cotação atualizada.'); } catch (e) { handleApiError(e); } };
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Resumo</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Número" value={formatQuoteNumber(quote.quoteNumber)} />
          <Field label="Status" value={QUOTE_STATUS_LABELS[quote.status]} />
          <Field label="Última atividade" value={formatDateTime(quote.lastActivityAt)} />
          <Field label="Seguradoras consultadas" value={String(quote.quoteInsurers.length)} />
          <Field label="Propostas" value={String(quote.quoteInsurers.reduce((n, qi) => n + qi.proposals.length, 0))} />
          <Field label="Encerrada em" value={quote.closedAt ? formatDateTime(quote.closedAt) : null} />
          <FormField label="Prêmio da apólice vigente (renovação)" htmlFor="qexpiring" hint="Usado para calcular a economia no comparativo.">
            <Input
              id="qexpiring"
              inputMode="decimal"
              placeholder="Ex.: 3500.00"
              value={expiringPremium}
              onChange={(e) => setExpiringPremium(e.target.value)}
              onBlur={() => expiringPremium !== (quote.expiringPremium ?? '') && save({ expiringPremium: expiringPremium || null })}
            />
          </FormField>
          <div className="sm:col-span-3">
            <FormField label="Observações" htmlFor="qnotes">
              <Textarea id="qnotes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (quote.notes ?? '') && save({ notes })} />
            </FormField>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Atribuição</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FormField label="Prioridade" htmlFor="qprio">
            <Select id="qprio" value={quote.priority} onChange={(e) => save({ priority: e.target.value as Priority })}>
              {PRIORITY_VALUES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
            </Select>
          </FormField>
          <FormField label="Corretor responsável" htmlFor="qassg">
            <Select id="qassg" value={quote.assignedUserId ?? ''} disabled={!canReassign} onChange={(e) => save({ assignedUserId: e.target.value || null })}>
              <option value="">Sem responsável</option>
              {users?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </FormField>
          {quote.vehicle === null ? <p className="text-xs text-amber-700">Sem veículo vinculado. Selecione na aba Dados.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function DataTab({ quote }: { quote: QuoteDetail }) {
  const updateDetails = useUpdateAutoDetails(quote.id);
  const update = useUpdateQuote(quote.id);
  const vehicles = quote.client && 'vehicles' in quote.client ? (quote.client as unknown as { vehicles: { id: string; brand: string; model: string; plate: string | null }[] }).vehicles : [];
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><CardTitle>Veículo</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <FormField label="Veículo do cliente" htmlFor="qveh" className="sm:w-96">
            <Select id="qveh" value={quote.vehicleId ?? ''} onChange={async (e) => { try { await update.mutateAsync({ vehicleId: e.target.value || null }); toast.success('Veículo vinculado.'); } catch (err) { handleApiError(err); } }}>
              <option value="">Selecione…</option>
              {(vehicles.length ? vehicles : quote.vehicle ? [quote.vehicle] : []).map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model}{v.plate ? ' · ' + formatPlate(v.plate) : ''}</option>)}
            </Select>
          </FormField>
          <Button variant="outline" asChild><Link href={`/clients/${quote.clientId}?tab=vehicles`}><Plus /> Cadastrar veículo</Link></Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Dados do seguro auto</CardTitle></CardHeader>
        <CardContent>
          <AutoDetailsForm initial={quote.autoDetails} onSubmit={async (v) => { try { await updateDetails.mutateAsync(v); toast.success('Dados salvos.'); } catch (e) { handleApiError(e); } }} />
        </CardContent>
      </Card>
    </div>
  );
}

function DocumentsTab({ quote }: { quote: QuoteDetail }) {
  const [uploading, setUploading] = useState(false);
  const { data, isLoading } = useDocuments({ quoteId: quote.id, pageSize: 100 });
  const { data: clientDocs } = useDocuments({ clientId: quote.clientId, pageSize: 100 });
  const onlyClient = (clientDocs?.data ?? []).filter((d) => d.quoteId === null);
  const action = <Button onClick={() => setUploading(true)}><Plus /> Enviar documento</Button>;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium">Desta cotação</p>{action}</div>
        {isLoading ? <TableSkeleton /> : <DocumentList docs={data?.data ?? []} emptyAction={action} />}
      </div>
      {onlyClient.length > 0 ? (
        <div>
          <p className="mb-3 text-sm font-medium">Do cliente (válidos para todas as cotações)</p>
          <DocumentList docs={onlyClient} />
        </div>
      ) : null}
      <DocumentUploadDialog open={uploading} onOpenChange={setUploading} quoteId={quote.id} clientId={quote.clientId} />
    </div>
  );
}

function HistoryTab({ quoteId }: { quoteId: string }) {
  const { data, isLoading } = useQuoteHistory(quoteId);
  if (isLoading || !data) return <Skeleton className="h-40" />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <p className="mb-3 text-sm font-medium">Mudanças de status</p>
        <ol className="relative ml-2 border-l pl-6">
          {data.statusHistory.map((h) => (
            <li key={h.id} className="mb-4">
              <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-background bg-primary" />
              <p className="text-sm">{h.fromStatus ? `${QUOTE_STATUS_LABELS[h.fromStatus]} → ` : ''}<span className="font-medium">{QUOTE_STATUS_LABELS[h.toStatus]}</span>{h.reason ? <span className="text-muted-foreground"> · {h.reason}</span> : null}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(h.createdAt)}{h.user ? ` · ${h.user.name}` : ' · sistema'}</p>
            </li>
          ))}
        </ol>
      </div>
      <div>
        <p className="mb-3 text-sm font-medium">Auditoria</p>
        <AuditTimeline rows={data.auditLogs} />
      </div>
    </div>
  );
}
