'use client';
import { CLIENT_TYPE_LABELS, formatDocument, formatPlate, INSURANCE_TYPE_LABELS, INSURANCE_TYPE_VALUES, maskDocument, PRIORITY_LABELS, PRIORITY_VALUES, type InsuranceType, type Priority, type QuoteAutoDetailsInput } from '@insurance/shared';
import { Check, ChevronLeft, ChevronRight, Plus, Search, UserPlus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { AutoDetailsForm } from '@/components/domain/auto-details-form';
import { ClientForm } from '@/components/domain/client-form';
import { DocumentList } from '@/components/domain/document-list';
import { DocumentUploadDialog } from '@/components/domain/document-upload-dialog';
import { VehicleForm } from '@/components/domain/vehicle-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { handleApiError } from '@/lib/handle-error';
import { useClient, useCreateClient, useCreateVehicle, useSearchClients, type Vehicle } from '@/lib/queries/clients';
import { useDocuments } from '@/lib/queries/documents';
import { useInsurerOptions } from '@/lib/queries/insurers';
import { useCreateQuote } from '@/lib/queries/quotes';
import { useUserOptions } from '@/lib/queries/users';
import { useMe } from '@/lib/queries/auth';
import { cn } from '@/lib/utils';

const STEPS = ['Cliente', 'Tipo de seguro', 'Dados', 'Documentos', 'Seguradoras'];

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mb-6 flex flex-wrap gap-2">
      {STEPS.map((s, i) => (
        <li key={s} className={cn('flex items-center gap-2 rounded-full border px-3 py-1 text-xs', i === step ? 'border-primary bg-primary text-primary-foreground' : i < step ? 'border-primary/40 text-primary' : 'text-muted-foreground')}>
          <span className="flex size-4 items-center justify-center rounded-full bg-background/20 text-[10px]">{i < step ? <Check className="size-3" /> : i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}

function Wizard() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: me } = useMe();
  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState<string | null>(params.get('clientId'));
  const [insuranceType, setInsuranceType] = useState<InsuranceType>('AUTO');
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [autoDetails, setAutoDetails] = useState<QuoteAutoDetailsInput | null>(null);
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [assignedUserId, setAssignedUserId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [insurerIds, setInsurerIds] = useState<string[]>([]);
  const { data: client } = useClient(clientId ?? undefined);
  const create = useCreateQuote();
  useEffect(() => { if (me && !assignedUserId) setAssignedUserId(me.id); }, [me, assignedUserId]);
  useEffect(() => { if (client && client.vehicles.length === 1 && !vehicleId) setVehicleId(client.vehicles[0]!.id); }, [client, vehicleId]);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = async () => {
    if (!clientId) return;
    try {
      const q = await create.mutateAsync({ clientId, vehicleId, insuranceType, priority, assignedUserId: assignedUserId || null, notes: notes || null, autoDetails: autoDetails ?? undefined, insurerIds });
      toast.success(`Cotação #${String(q.quoteNumber).padStart(6, '0')} criada.`);
      router.replace(`/quotes/${q.id}`);
    } catch (e) {
      handleApiError(e);
    }
  };

  return (
    <>
      <PageHeader title="Nova cotação" description="Cinco etapas. Os dados do cliente são reaproveitados." />
      <Stepper step={step} />
      <Card>
        <CardContent className="p-5">
          {step === 0 ? <ClientStep clientId={clientId} onSelect={setClientId} /> : null}
          {step === 1 ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Tipo de seguro" htmlFor="it" required>
                <Select id="it" value={insuranceType} onChange={(e) => setInsuranceType(e.target.value as InsuranceType)}>
                  {INSURANCE_TYPE_VALUES.map((t) => <option key={t} value={t}>{INSURANCE_TYPE_LABELS[t]}</option>)}
                </Select>
              </FormField>
              <FormField label="Prioridade" htmlFor="pr">
                <Select id="pr" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  {PRIORITY_VALUES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                </Select>
              </FormField>
              <AssigneeSelect value={assignedUserId} onChange={setAssignedUserId} />
              <FormField label="Observações" htmlFor="nt" className="sm:col-span-3">
                <Input id="nt" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </FormField>
            </div>
          ) : null}
          {step === 2 && clientId ? (
            <DataStep clientId={clientId} vehicles={client?.vehicles ?? []} vehicleId={vehicleId} onVehicle={setVehicleId} autoDetails={autoDetails} onAutoDetails={setAutoDetails} onContinue={next} />
          ) : null}
          {step === 3 && clientId ? <DocumentsStep clientId={clientId} /> : null}
          {step === 4 ? <InsurersStep value={insurerIds} onChange={setInsurerIds} /> : null}
        </CardContent>
      </Card>
      <div className="mt-4 flex justify-between">
        <Button variant="outline" onClick={back} disabled={step === 0}><ChevronLeft /> Voltar</Button>
        {step < STEPS.length - 1 ? (
          step === 2 ? (
            <Button type="submit" form="auto-details-form">Continuar <ChevronRight /></Button>
          ) : (
            <Button onClick={next} disabled={step === 0 && !clientId}>Continuar <ChevronRight /></Button>
          )
        ) : (
          <Button onClick={finish} loading={create.isPending}><Check /> Criar cotação</Button>
        )}
      </div>
    </>
  );
}

function AssigneeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: users } = useUserOptions();
  return (
    <FormField label="Corretor responsável" htmlFor="as">
      <Select id="as" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sem responsável</option>
        {users?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </Select>
    </FormField>
  );
}

function ClientStep({ clientId, onSelect }: { clientId: string | null; onSelect: (id: string) => void }) {
  const [term, setTerm] = useState('');
  const [creating, setCreating] = useState(false);
  const { data: results, isFetching } = useSearchClients(term);
  const { data: selected } = useClient(clientId ?? undefined);
  const create = useCreateClient();
  return (
    <div className="flex flex-col gap-4">
      {selected ? (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3">
          <div>
            <p className="font-medium">{selected.name}</p>
            <p className="text-xs text-muted-foreground">{CLIENT_TYPE_LABELS[selected.type]} · {formatDocument(selected.document)}</p>
          </div>
          <span className="text-xs text-emerald-700">Selecionado</span>
        </div>
      ) : null}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar cliente existente por nome, CPF/CNPJ ou telefone" value={term} onChange={(e) => setTerm(e.target.value)} autoFocus />
        </div>
        <Button variant="outline" onClick={() => setCreating(true)}><UserPlus /> Novo cliente</Button>
      </div>
      {term.trim().length >= 2 ? (
        <div className="divide-y rounded-md border">
          {isFetching && !results ? <div className="p-3 text-sm text-muted-foreground">Buscando…</div> : null}
          {results?.length === 0 ? <div className="p-3 text-sm text-muted-foreground">Nenhum cliente encontrado. Cadastre um novo.</div> : null}
          {results?.map((c) => (
            <button key={c.id} type="button" className={cn('flex w-full items-center justify-between p-3 text-left text-sm hover:bg-muted', c.id === clientId && 'bg-muted')} onClick={() => { onSelect(c.id); setTerm(''); }}>
              <span><span className="font-medium">{c.name}</span><span className="ml-2 text-xs text-muted-foreground">{maskDocument(c.document)}</span></span>
              <span className="text-xs text-muted-foreground">{c.city ?? ''}</span>
            </button>
          ))}
        </div>
      ) : null}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
          <ClientForm compact onCancel={() => setCreating(false)} submitLabel="Cadastrar e selecionar" onSubmit={async (v) => { try { const c = await create.mutateAsync(v); onSelect(c.id); setCreating(false); toast.success('Cliente cadastrado.'); } catch (e) { handleApiError(e); } }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DataStep({ clientId, vehicles, vehicleId, onVehicle, autoDetails, onAutoDetails, onContinue }: { clientId: string; vehicles: Vehicle[]; vehicleId: string | null; onVehicle: (id: string | null) => void; autoDetails: QuoteAutoDetailsInput | null; onAutoDetails: (d: QuoteAutoDetailsInput) => void; onContinue: () => void }) {
  const [adding, setAdding] = useState(false);
  const createVehicle = useCreateVehicle(clientId);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">Veículo</p>
        {vehicles.length === 0 ? <p className="mb-2 text-sm text-muted-foreground">O cliente ainda não possui veículo cadastrado.</p> : null}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => (
            <button key={v.id} type="button" onClick={() => onVehicle(v.id)} className={cn('rounded-md border p-3 text-left text-sm hover:bg-muted', vehicleId === v.id && 'border-primary bg-primary/5')}>
              <p className="font-medium">{v.brand} {v.model}</p>
              <p className="text-xs text-muted-foreground">{v.manufacturingYear}/{v.modelYear}{v.plate ? ' · ' + formatPlate(v.plate) : ''}</p>
            </button>
          ))}
          <button type="button" onClick={() => setAdding(true)} className="flex items-center justify-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted"><Plus className="size-4" /> Adicionar veículo</button>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Dados do seguro auto</p>
        <AutoDetailsForm formId="auto-details-form" initial={autoDetails as never} onSubmit={async (v) => { onAutoDetails(v); onContinue(); }} />
      </div>
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Novo veículo</DialogTitle></DialogHeader>
          <VehicleForm onCancel={() => setAdding(false)} onSubmit={async (v) => { try { const created = await createVehicle.mutateAsync(v); onVehicle(created.id); setAdding(false); toast.success('Veículo adicionado.'); } catch (e) { handleApiError(e); } }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocumentsStep({ clientId }: { clientId: string }) {
  const [uploading, setUploading] = useState(false);
  const { data, isLoading } = useDocuments({ clientId, pageSize: 100 });
  const action = <Button onClick={() => setUploading(true)}><Plus /> Enviar documento</Button>;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Documentos do cliente valem para todas as suas cotações. Você pode pular e enviar depois.</p>
        {action}
      </div>
      {isLoading ? <Skeleton className="h-32" /> : <DocumentList docs={data?.data ?? []} emptyAction={action} />}
      <DocumentUploadDialog open={uploading} onOpenChange={setUploading} clientId={clientId} />
    </div>
  );
}

function InsurersStep({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { data: insurers, isLoading } = useInsurerOptions();
  if (isLoading) return <Skeleton className="h-32" />;
  if (!insurers || insurers.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma seguradora ativa. Cadastre em Seguradoras (administrador) ou adicione depois na cotação.</p>;
  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">Selecione as seguradoras que serão consultadas. Pode alterar depois.</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {insurers.map((i) => {
          const checked = value.includes(i.id);
          return (
            <label key={i.id} className={cn('flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm hover:bg-muted', checked && 'border-primary bg-primary/5')}>
              <Checkbox checked={checked} onCheckedChange={(c) => onChange(c ? [...value, i.id] : value.filter((x) => x !== i.id))} />
              {i.name}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function NewQuotePage() {
  return <Suspense><Wizard /></Suspense>;
}
