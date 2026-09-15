'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { COMMON_ASSISTANCES, COMMON_COVERAGES, DEDUCTIBLE_TYPE_LABELS, DEDUCTIBLE_TYPE_VALUES, installmentTotal, proposalSchema, type ProposalInput } from '@insurance/shared';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Proposal } from '@/lib/queries/proposals';

export type ProposalFormValues = z.input<typeof proposalSchema>;

export function toProposalForm(p?: Proposal | null): ProposalFormValues {
  return {
    proposalNumber: p?.proposalNumber ?? '',
    totalAmount: p?.totalAmount ?? '',
    firstInstallment: p?.firstInstallment ?? '',
    installmentAmount: p?.installmentAmount ?? '',
    installments: p?.installments ?? 1,
    deductibleAmount: p?.deductibleAmount ?? '',
    deductibleType: p?.deductibleType ?? '',
    commissionPercentage: p?.commissionPercentage ? Number(p.commissionPercentage) : null,
    validityDate: p?.validityDate ? p.validityDate.slice(0, 10) : '',
    notes: p?.notes ?? '',
    coverages: p?.coverages.map((c) => ({ name: c.name, insuredAmount: c.insuredAmount ?? '', included: c.included, notes: c.notes ?? '' })) ?? COMMON_COVERAGES.slice(0, 4).map((name) => ({ name, insuredAmount: '', included: true, notes: '' })),
    assistances: p?.assistances.map((a) => ({ name: a.name, included: a.included, description: a.description ?? '' })) ?? COMMON_ASSISTANCES.slice(0, 5).map((name) => ({ name, included: true, description: '' })),
  };
}

export function ProposalForm({ initial, onSubmit, onCancel, submitLabel = 'Salvar' }: { initial?: Proposal | null; onSubmit: (v: ProposalInput) => Promise<void>; onCancel?: () => void; submitLabel?: string }) {
  const form = useForm<ProposalFormValues, unknown, ProposalInput>({ resolver: zodResolver(proposalSchema), defaultValues: toProposalForm(initial) });
  const coverages = useFieldArray({ control: form.control, name: 'coverages' });
  const assistances = useFieldArray({ control: form.control, name: 'assistances' });
  const e = form.formState.errors;
  useEffect(() => { form.reset(toProposalForm(initial)); }, [initial, form]);
  const installments = Number(form.watch('installments') || 1);
  const installmentAmount = String(form.watch('installmentAmount') ?? '');
  const parceladoTotal = installments > 1 && /^\d+([.,]\d{1,2})?$/.test(installmentAmount) ? installmentTotal(installmentAmount.replace(',', '.'), installments) : null;
  const num = (v: string) => (v === '' ? null : Number(v));

  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-4 sm:grid-cols-4">
        <FormField label="Nº da proposta" htmlFor="pn" error={e.proposalNumber?.message}><Input id="pn" {...form.register('proposalNumber')} /></FormField>
        <FormField label="Prêmio total (R$)" htmlFor="ta" error={e.totalAmount?.message} required><Input id="ta" inputMode="decimal" placeholder="3200.00" {...form.register('totalAmount')} /></FormField>
        <FormField label="Validade" htmlFor="vd" error={e.validityDate?.message} hint="Vazio = validade padrão da corretora"><Input id="vd" type="date" {...form.register('validityDate')} /></FormField>
        <FormField label="Comissão (%)" htmlFor="cp" error={e.commissionPercentage?.message} hint="Vazio = padrão da corretora"><Input id="cp" type="number" step="0.01" min={0} max={100} {...form.register('commissionPercentage', { setValueAs: num })} /></FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <FormField label="Parcelas" htmlFor="in" error={e.installments?.message} required><Input id="in" type="number" min={1} max={24} {...form.register('installments', { valueAsNumber: true })} /></FormField>
        <FormField label="1ª parcela (R$)" htmlFor="fi" error={e.firstInstallment?.message}><Input id="fi" inputMode="decimal" {...form.register('firstInstallment')} /></FormField>
        <FormField label="Valor da parcela (R$)" htmlFor="ia" error={e.installmentAmount?.message} required={installments > 1} hint={parceladoTotal ? `Total parcelado: R$ ${parceladoTotal}` : undefined}><Input id="ia" inputMode="decimal" {...form.register('installmentAmount')} /></FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Franquia (R$)" htmlFor="da" error={e.deductibleAmount?.message}><Input id="da" inputMode="decimal" {...form.register('deductibleAmount')} /></FormField>
          <FormField label="Tipo" htmlFor="dt" error={e.deductibleType?.message}>
            <Select id="dt" {...form.register('deductibleType')}><option value="">—</option>{DEDUCTIBLE_TYPE_VALUES.map((d) => <option key={d} value={d}>{DEDUCTIBLE_TYPE_LABELS[d]}</option>)}</Select>
          </FormField>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Coberturas</p>
          <Button type="button" variant="outline" size="sm" onClick={() => coverages.append({ name: '', insuredAmount: '', included: true, notes: '' })}><Plus /> Cobertura</Button>
        </div>
        <div className="flex flex-col gap-2">
          {coverages.fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-[auto_1fr_10rem_auto] items-center gap-2">
              <Controller control={form.control} name={`coverages.${i}.included`} render={({ field }) => <Checkbox checked={!!field.value} onCheckedChange={(c) => field.onChange(c === true)} aria-label="Incluída" />} />
              <Input list="coverage-suggestions" placeholder="Nome da cobertura" {...form.register(`coverages.${i}.name`)} aria-invalid={!!e.coverages?.[i]?.name} />
              <Input inputMode="decimal" placeholder="Importância (R$)" {...form.register(`coverages.${i}.insuredAmount`)} />
              <Button type="button" variant="ghost" size="icon" onClick={() => coverages.remove(i)}><Trash2 /></Button>
            </div>
          ))}
          {coverages.fields.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma cobertura informada.</p> : null}
        </div>
        <datalist id="coverage-suggestions">{COMMON_COVERAGES.map((c) => <option key={c} value={c} />)}</datalist>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Assistências</p>
          <Button type="button" variant="outline" size="sm" onClick={() => assistances.append({ name: '', included: true, description: '' })}><Plus /> Assistência</Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {assistances.fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <Controller control={form.control} name={`assistances.${i}.included`} render={({ field }) => <Checkbox checked={!!field.value} onCheckedChange={(c) => field.onChange(c === true)} aria-label="Incluída" />} />
              <Input list="assistance-suggestions" placeholder="Nome da assistência" {...form.register(`assistances.${i}.name`)} aria-invalid={!!e.assistances?.[i]?.name} />
              <Button type="button" variant="ghost" size="icon" onClick={() => assistances.remove(i)}><Trash2 /></Button>
            </div>
          ))}
        </div>
        <datalist id="assistance-suggestions">{COMMON_ASSISTANCES.map((a) => <option key={a} value={a} />)}</datalist>
      </div>

      <FormField label="Observações" htmlFor="pnotes" error={e.notes?.message}><Textarea id="pnotes" rows={2} {...form.register('notes')} /></FormField>
      <div className="flex justify-end gap-2">
        {onCancel ? <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button> : null}
        <Button type="submit" loading={form.formState.isSubmitting}>{submitLabel}</Button>
      </div>
    </form>
  );
}
