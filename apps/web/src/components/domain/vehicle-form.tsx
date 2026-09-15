'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { FUEL_LABELS, FUEL_VALUES, formatPlate, vehicleSchema, type VehicleInput } from '@insurance/shared';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { Vehicle } from '@/lib/queries/clients';

export type VehicleFormValues = z.input<typeof vehicleSchema>;

export function toVehicleForm(v?: Partial<Vehicle> | null): VehicleFormValues {
  const year = new Date().getFullYear();
  return {
    brand: v?.brand ?? '',
    model: v?.model ?? '',
    version: v?.version ?? '',
    manufacturingYear: v?.manufacturingYear ?? year,
    modelYear: v?.modelYear ?? year,
    plate: v?.plate ? formatPlate(v.plate) : '',
    chassis: v?.chassis ?? '',
    renavam: v?.renavam ?? '',
    fuel: v?.fuel ?? '',
    zeroKm: v?.zeroKm ?? false,
    usageType: v?.usageType ?? '',
    overnightLocation: v?.overnightLocation ?? '',
  };
}

export function VehicleForm({ initial, onSubmit, onCancel, submitLabel = 'Salvar' }: { initial?: Partial<Vehicle> | null; onSubmit: (v: VehicleInput) => Promise<void>; onCancel?: () => void; submitLabel?: string }) {
  const form = useForm<VehicleFormValues, unknown, VehicleInput>({ resolver: zodResolver(vehicleSchema), defaultValues: toVehicleForm(initial) });
  const e = form.formState.errors;
  useEffect(() => { form.reset(toVehicleForm(initial)); }, [initial, form]);
  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Marca" htmlFor="brand" error={e.brand?.message} required><Input id="brand" {...form.register('brand')} /></FormField>
        <FormField label="Modelo" htmlFor="model" error={e.model?.message} required><Input id="model" {...form.register('model')} /></FormField>
        <FormField label="Versão" htmlFor="version" error={e.version?.message}><Input id="version" {...form.register('version')} /></FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <FormField label="Ano fabricação" htmlFor="manufacturingYear" error={e.manufacturingYear?.message} required><Input id="manufacturingYear" type="number" {...form.register('manufacturingYear', { valueAsNumber: true })} /></FormField>
        <FormField label="Ano modelo" htmlFor="modelYear" error={e.modelYear?.message} required><Input id="modelYear" type="number" {...form.register('modelYear', { valueAsNumber: true })} /></FormField>
        <FormField label="Placa" htmlFor="plate" error={e.plate?.message}><Input id="plate" className="uppercase" {...form.register('plate')} /></FormField>
        <FormField label="Combustível" htmlFor="fuel" error={e.fuel?.message}>
          <Select id="fuel" {...form.register('fuel')}>
            <option value="">—</option>
            {FUEL_VALUES.map((f) => <option key={f} value={f}>{FUEL_LABELS[f]}</option>)}
          </Select>
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Chassi" htmlFor="chassis" error={e.chassis?.message}><Input id="chassis" className="uppercase" {...form.register('chassis')} /></FormField>
        <FormField label="Renavam" htmlFor="renavam" error={e.renavam?.message}><Input id="renavam" inputMode="numeric" {...form.register('renavam')} /></FormField>
        <FormField label="Uso" htmlFor="usageType" error={e.usageType?.message} hint="Ex.: particular, trabalho, aplicativo"><Input id="usageType" {...form.register('usageType')} /></FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Local de pernoite" htmlFor="overnightLocation" error={e.overnightLocation?.message} className="sm:col-span-2"><Input id="overnightLocation" {...form.register('overnightLocation')} /></FormField>
        <Controller control={form.control} name="zeroKm" render={({ field }) => (
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><Checkbox checked={field.value ?? false} onCheckedChange={(c) => field.onChange(c === true)} /> Zero km</label>
        )} />
      </div>
      <div className="flex justify-end gap-2">
        {onCancel ? <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button> : null}
        <Button type="submit" loading={form.formState.isSubmitting}>{submitLabel}</Button>
      </div>
    </form>
  );
}
