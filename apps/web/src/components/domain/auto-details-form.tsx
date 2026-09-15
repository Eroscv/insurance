'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { DEDUCTIBLE_TYPE_LABELS, DEDUCTIBLE_TYPE_VALUES, formatCep, formatDocument, MARITAL_STATUS_LABELS, MARITAL_STATUS_VALUES, quoteAutoDetailsSchema, type QuoteAutoDetailsInput } from '@insurance/shared';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { QuoteAutoDetails } from '@/lib/queries/quotes';

export type AutoDetailsFormValues = z.input<typeof quoteAutoDetailsSchema>;

export function toAutoDetailsForm(d?: Partial<QuoteAutoDetails> | null): AutoDetailsFormValues {
  return {
    mainDriverName: d?.mainDriverName ?? '',
    mainDriverDocument: d?.mainDriverDocument ? formatDocument(d.mainDriverDocument) : '',
    mainDriverBirthDate: d?.mainDriverBirthDate ? d.mainDriverBirthDate.slice(0, 10) : '',
    maritalStatus: d?.maritalStatus ?? '',
    profession: d?.profession ?? '',
    residenceZipCode: d?.residenceZipCode ? formatCep(d.residenceZipCode) : '',
    vehicleUsage: d?.vehicleUsage ?? '',
    annualMileage: d?.annualMileage ?? null,
    hasHomeGarage: d?.hasHomeGarage ?? false,
    hasWorkGarage: d?.hasWorkGarage ?? false,
    commercialUse: d?.commercialUse ?? false,
    appUsage: d?.appUsage ?? false,
    numberOfDrivers: d?.numberOfDrivers ?? 1,
    deductibleType: d?.deductibleType ?? '',
    desiredCoverage: d?.desiredCoverage ?? '',
  };
}

const BOOLS: { name: 'hasHomeGarage' | 'hasWorkGarage' | 'commercialUse' | 'appUsage'; label: string }[] = [
  { name: 'hasHomeGarage', label: 'Garagem em casa' },
  { name: 'hasWorkGarage', label: 'Garagem no trabalho' },
  { name: 'commercialUse', label: 'Uso comercial' },
  { name: 'appUsage', label: 'Uso em aplicativo' },
];

export function AutoDetailsForm({ initial, onSubmit, onCancel, submitLabel = 'Salvar', formId }: { initial?: Partial<QuoteAutoDetails> | null; onSubmit: (v: QuoteAutoDetailsInput) => Promise<void>; onCancel?: () => void; submitLabel?: string; formId?: string }) {
  const form = useForm<AutoDetailsFormValues, unknown, QuoteAutoDetailsInput>({ resolver: zodResolver(quoteAutoDetailsSchema), defaultValues: toAutoDetailsForm(initial) });
  const e = form.formState.errors;
  useEffect(() => { form.reset(toAutoDetailsForm(initial)); }, [initial, form]);
  const num = (v: string) => (v === '' ? null : Number(v));
  return (
    <form id={formId} className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <p className="text-sm font-medium">Condutor principal</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Nome" htmlFor="mdn" error={e.mainDriverName?.message}><Input id="mdn" {...form.register('mainDriverName')} /></FormField>
        <FormField label="CPF" htmlFor="mdd" error={e.mainDriverDocument?.message}><Input id="mdd" inputMode="numeric" {...form.register('mainDriverDocument')} onChange={(ev) => form.setValue('mainDriverDocument', formatDocument(ev.target.value))} /></FormField>
        <FormField label="Nascimento" htmlFor="mdb" error={e.mainDriverBirthDate?.message}><Input id="mdb" type="date" {...form.register('mainDriverBirthDate')} /></FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Estado civil" htmlFor="ms" error={e.maritalStatus?.message}>
          <Select id="ms" {...form.register('maritalStatus')}><option value="">—</option>{MARITAL_STATUS_VALUES.map((m) => <option key={m} value={m}>{MARITAL_STATUS_LABELS[m]}</option>)}</Select>
        </FormField>
        <FormField label="Profissão" htmlFor="prof" error={e.profession?.message}><Input id="prof" {...form.register('profession')} /></FormField>
        <FormField label="CEP de pernoite" htmlFor="rz" error={e.residenceZipCode?.message}><Input id="rz" inputMode="numeric" {...form.register('residenceZipCode')} onChange={(ev) => form.setValue('residenceZipCode', formatCep(ev.target.value))} /></FormField>
      </div>
      <p className="text-sm font-medium">Perfil de uso</p>
      <div className="grid gap-4 sm:grid-cols-4">
        <FormField label="Uso do veículo" htmlFor="vu" error={e.vehicleUsage?.message} hint="Ex.: lazer, trabalho"><Input id="vu" {...form.register('vehicleUsage')} /></FormField>
        <FormField label="Km anual" htmlFor="am" error={e.annualMileage?.message}><Input id="am" type="number" min={0} {...form.register('annualMileage', { setValueAs: num })} /></FormField>
        <FormField label="Nº de condutores" htmlFor="nd" error={e.numberOfDrivers?.message}><Input id="nd" type="number" min={1} {...form.register('numberOfDrivers', { setValueAs: num })} /></FormField>
        <FormField label="Tipo de franquia" htmlFor="dt" error={e.deductibleType?.message}>
          <Select id="dt" {...form.register('deductibleType')}><option value="">—</option>{DEDUCTIBLE_TYPE_VALUES.map((d) => <option key={d} value={d}>{DEDUCTIBLE_TYPE_LABELS[d]}</option>)}</Select>
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {BOOLS.map((b) => (
          <Controller key={b.name} control={form.control} name={b.name} render={({ field }) => (
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!field.value} onCheckedChange={(c) => field.onChange(c === true)} /> {b.label}</label>
          )} />
        ))}
      </div>
      <FormField label="Coberturas desejadas" htmlFor="dc" error={e.desiredCoverage?.message} hint="Descreva livremente: compreensiva, terceiros, carro reserva, vidros…">
        <Textarea id="dc" rows={3} {...form.register('desiredCoverage')} />
      </FormField>
      {!formId ? (
        <div className="flex justify-end gap-2">
          {onCancel ? <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button> : null}
          <Button type="submit" loading={form.formState.isSubmitting}>{submitLabel}</Button>
        </div>
      ) : null}
    </form>
  );
}
