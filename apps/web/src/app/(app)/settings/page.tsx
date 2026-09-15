'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_VALUES,
  formatDocument,
  updateOrganizationSchema,
  updateOrganizationSettingsSchema,
  type DocumentType,
  type UpdateOrganizationInput,
  type UpdateOrganizationSettingsInput,
} from '@insurance/shared';
import { useEffect, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { handleApiError } from '@/lib/handle-error';
import { useMe } from '@/lib/queries/auth';
import { useOrganization, useUpdateOrganization, useUpdateOrganizationSettings, useUploadLogo } from '@/lib/queries/organization';

const REQUIRED_CANDIDATES = DOCUMENT_TYPE_VALUES.filter((t) => t !== 'PROPOSAL');

export default function OrganizationSettingsPage() {
  const { data: me } = useMe();
  const { data: org, isLoading } = useOrganization();
  const update = useUpdateOrganization();
  const updateSettings = useUpdateOrganizationSettings();
  const upload = useUploadLogo();
  const fileRef = useRef<HTMLInputElement>(null);

  const orgForm = useForm<UpdateOrganizationInput>({ resolver: zodResolver(updateOrganizationSchema) });
  type SettingsFormValues = z.input<typeof updateOrganizationSettingsSchema>;
  const settingsForm = useForm<SettingsFormValues, unknown, UpdateOrganizationSettingsInput>({ resolver: zodResolver(updateOrganizationSettingsSchema) });

  useEffect(() => {
    if (!org) return;
    orgForm.reset({ name: org.name, legalName: org.legalName ?? '', document: org.document ? formatDocument(org.document) : '', email: org.email ?? '', phone: org.phone ?? '' });
    settingsForm.reset({
      commissionPercentage: Number(org.settings?.commissionPercentage ?? 10),
      staleQuoteDays: org.settings?.staleQuoteDays ?? 5,
      requiredDocumentTypes: org.settings?.requiredDocumentTypes ?? ['CNH', 'CRLV'],
      proposalValidityDays: org.settings?.proposalValidityDays ?? 7,
      proposalFooterText: org.settings?.proposalFooterText ?? '',
      iofRatePercent: Number(org.settings?.iofRatePercent ?? 7.38),
      monthlyRevenueGoal: org.settings?.monthlyRevenueGoal ?? '',
    });
  }, [org, orgForm, settingsForm]);

  if (me && me.role !== 'ADMIN') return <p className="text-sm text-muted-foreground">Apenas administradores acessam esta página.</p>;
  if (isLoading || !org) return <Skeleton className="h-64" />;

  const oe = orgForm.formState.errors;
  const se = settingsForm.formState.errors;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Dados da corretora</CardTitle>
          <CardDescription>Aparecem na proposta comercial gerada em PDF.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={orgForm.handleSubmit(async (v) => {
              try {
                await update.mutateAsync(v);
                toast.success('Dados salvos.');
              } catch (e) {
                handleApiError(e);
              }
            })}
          >
            <div className="flex items-center gap-4">
              {org.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={org.logoUrl} alt="Logo" className="size-16 rounded-md border object-contain" />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">Logo</div>
              )}
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      await upload.mutateAsync(f);
                      toast.success('Logo atualizada.');
                    } catch (err) {
                      handleApiError(err);
                    } finally {
                      e.target.value = '';
                    }
                  }}
                />
                <Button type="button" variant="outline" size="sm" loading={upload.isPending} onClick={() => fileRef.current?.click()}>
                  Enviar logo
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">PNG, JPG ou WEBP até 2 MB.</p>
              </div>
            </div>
            <FormField label="Nome fantasia" htmlFor="name" error={oe.name?.message} required>
              <Input id="name" {...orgForm.register('name')} />
            </FormField>
            <FormField label="Razão social" htmlFor="legalName" error={oe.legalName?.message}>
              <Input id="legalName" {...orgForm.register('legalName')} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="CNPJ" htmlFor="document" error={oe.document?.message}>
                <Input id="document" {...orgForm.register('document')} />
              </FormField>
              <FormField label="Telefone" htmlFor="phone" error={oe.phone?.message}>
                <Input id="phone" {...orgForm.register('phone')} />
              </FormField>
            </div>
            <FormField label="E-mail" htmlFor="email" error={oe.email?.message}>
              <Input id="email" type="email" {...orgForm.register('email')} />
            </FormField>
            <div>
              <Button type="submit" loading={update.isPending}>
                Salvar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regras operacionais</CardTitle>
          <CardDescription>Parâmetros usados nas automações e nos cálculos.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={settingsForm.handleSubmit(async (v) => {
              try {
                await updateSettings.mutateAsync(v);
                toast.success('Regras salvas.');
              } catch (e) {
                handleApiError(e);
              }
            })}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Comissão padrão (%)" htmlFor="commissionPercentage" error={se.commissionPercentage?.message}>
                <Input id="commissionPercentage" type="number" step="0.01" min={0} max={100} {...settingsForm.register('commissionPercentage', { valueAsNumber: true })} />
              </FormField>
              <FormField label="Cotação parada após (dias)" htmlFor="staleQuoteDays" error={se.staleQuoteDays?.message}>
                <Input id="staleQuoteDays" type="number" min={1} {...settingsForm.register('staleQuoteDays', { valueAsNumber: true })} />
              </FormField>
              <FormField label="Validade padrão da proposta (dias)" htmlFor="proposalValidityDays" error={se.proposalValidityDays?.message}>
                <Input id="proposalValidityDays" type="number" min={1} {...settingsForm.register('proposalValidityDays', { valueAsNumber: true })} />
              </FormField>
              <FormField label="Alíquota de IOF (%)" htmlFor="iofRatePercent" error={se.iofRatePercent?.message} hint="Usada para decompor o prêmio em líquido + IOF no comparativo.">
                <Input id="iofRatePercent" type="number" step="0.01" min={0} max={100} {...settingsForm.register('iofRatePercent', { valueAsNumber: true })} />
              </FormField>
              <FormField label="Meta mensal de prêmio fechado (R$)" htmlFor="monthlyRevenueGoal" error={se.monthlyRevenueGoal?.message} hint="Vazio = sem meta no dashboard.">
                <Input id="monthlyRevenueGoal" inputMode="decimal" placeholder="Ex.: 50000" {...settingsForm.register('monthlyRevenueGoal')} />
              </FormField>
            </div>
            <FormField label="Documentos obrigatórios" error={se.requiredDocumentTypes?.message} hint="Necessários para marcar a cotação como “Dados completos”.">
              <Controller
                control={settingsForm.control}
                name="requiredDocumentTypes"
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {REQUIRED_CANDIDATES.map((t) => {
                      const checked = field.value?.includes(t) ?? false;
                      return (
                        <label key={t} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => field.onChange(c ? [...(field.value ?? []), t] : (field.value ?? []).filter((x: DocumentType) => x !== t))}
                          />
                          {DOCUMENT_TYPE_LABELS[t]}
                        </label>
                      );
                    })}
                  </div>
                )}
              />
            </FormField>
            <FormField label="Texto adicional do rodapé da proposta" htmlFor="proposalFooterText" error={se.proposalFooterText?.message}>
              <Textarea id="proposalFooterText" rows={3} {...settingsForm.register('proposalFooterText')} />
            </FormField>
            <div>
              <Button type="submit" loading={updateSettings.isPending}>
                Salvar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
