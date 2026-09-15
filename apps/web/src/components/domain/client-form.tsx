'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { CLIENT_TYPE_LABELS, CLIENT_TYPE_VALUES, clientSchema, formatCep, formatDocument, formatPhone, MARITAL_STATUS_LABELS, MARITAL_STATUS_VALUES, type ClientInput } from '@insurance/shared';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Client } from '@/lib/queries/clients';

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export type ClientFormValues = z.input<typeof clientSchema>;

export function toClientForm(c?: Partial<Client> | null): ClientFormValues {
  return {
    type: c?.type ?? 'INDIVIDUAL',
    name: c?.name ?? '',
    document: c?.document ? formatDocument(c.document) : '',
    birthDate: c?.birthDate ? c.birthDate.slice(0, 10) : '',
    maritalStatus: c?.maritalStatus ?? '',
    email: c?.email ?? '',
    phone: c?.phone ? formatPhone(c.phone) : '',
    whatsapp: c?.whatsapp ? formatPhone(c.whatsapp) : '',
    zipCode: c?.zipCode ? formatCep(c.zipCode) : '',
    street: c?.street ?? '',
    number: c?.number ?? '',
    complement: c?.complement ?? '',
    neighborhood: c?.neighborhood ?? '',
    city: c?.city ?? '',
    state: c?.state ?? '',
    notes: c?.notes ?? '',
  };
}

interface ClientFormProps {
  initial?: Partial<Client> | null;
  onSubmit: (values: ClientInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  compact?: boolean;
}

export function ClientForm({ initial, onSubmit, onCancel, submitLabel = 'Salvar', compact }: ClientFormProps) {
  const form = useForm<ClientFormValues, unknown, ClientInput>({ resolver: zodResolver(clientSchema), defaultValues: toClientForm(initial) });
  const e = form.formState.errors;
  const type = form.watch('type');
  useEffect(() => { form.reset(toClientForm(initial)); }, [initial, form]);

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Tipo" htmlFor="type" error={e.type?.message} required>
          <Select id="type" {...form.register('type')}>
            {CLIENT_TYPE_VALUES.map((t) => <option key={t} value={t}>{CLIENT_TYPE_LABELS[t]}</option>)}
          </Select>
        </FormField>
        <FormField label={type === 'COMPANY' ? 'Razão social / Nome' : 'Nome completo'} htmlFor="name" error={e.name?.message} required className="sm:col-span-2">
          <Input id="name" {...form.register('name')} />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label={type === 'COMPANY' ? 'CNPJ' : 'CPF'} htmlFor="document" error={e.document?.message} required>
          <Input id="document" inputMode="numeric" {...form.register('document')} onChange={(ev) => form.setValue('document', formatDocument(ev.target.value))} />
        </FormField>
        <FormField label="Data de nascimento" htmlFor="birthDate" error={e.birthDate?.message}>
          <Input id="birthDate" type="date" {...form.register('birthDate')} />
        </FormField>
        <FormField label="Estado civil" htmlFor="maritalStatus" error={e.maritalStatus?.message}>
          <Select id="maritalStatus" {...form.register('maritalStatus')}>
            <option value="">—</option>
            {MARITAL_STATUS_VALUES.map((m) => <option key={m} value={m}>{MARITAL_STATUS_LABELS[m]}</option>)}
          </Select>
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="E-mail" htmlFor="email" error={e.email?.message}>
          <Input id="email" type="email" {...form.register('email')} />
        </FormField>
        <FormField label="Telefone" htmlFor="phone" error={e.phone?.message}>
          <Input id="phone" inputMode="tel" {...form.register('phone')} onChange={(ev) => form.setValue('phone', formatPhone(ev.target.value))} />
        </FormField>
        <FormField label="WhatsApp" htmlFor="whatsapp" error={e.whatsapp?.message}>
          <Input id="whatsapp" inputMode="tel" {...form.register('whatsapp')} onChange={(ev) => form.setValue('whatsapp', formatPhone(ev.target.value))} />
        </FormField>
      </div>
      {!compact ? (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <FormField label="CEP" htmlFor="zipCode" error={e.zipCode?.message}>
              <Input id="zipCode" inputMode="numeric" {...form.register('zipCode')} onChange={(ev) => form.setValue('zipCode', formatCep(ev.target.value))} />
            </FormField>
            <FormField label="Logradouro" htmlFor="street" error={e.street?.message} className="sm:col-span-2">
              <Input id="street" {...form.register('street')} />
            </FormField>
            <FormField label="Número" htmlFor="number" error={e.number?.message}>
              <Input id="number" {...form.register('number')} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <FormField label="Complemento" htmlFor="complement" error={e.complement?.message}>
              <Input id="complement" {...form.register('complement')} />
            </FormField>
            <FormField label="Bairro" htmlFor="neighborhood" error={e.neighborhood?.message}>
              <Input id="neighborhood" {...form.register('neighborhood')} />
            </FormField>
            <FormField label="Cidade" htmlFor="city" error={e.city?.message}>
              <Input id="city" {...form.register('city')} />
            </FormField>
            <FormField label="UF" htmlFor="state" error={e.state?.message}>
              <Select id="state" {...form.register('state')}>
                <option value="">—</option>
                {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </Select>
            </FormField>
          </div>
          <FormField label="Observações" htmlFor="notes" error={e.notes?.message}>
            <Textarea id="notes" rows={3} {...form.register('notes')} />
          </FormField>
        </>
      ) : null}
      <div className="flex justify-end gap-2">
        {onCancel ? <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button> : null}
        <Button type="submit" loading={form.formState.isSubmitting}>{submitLabel}</Button>
      </div>
    </form>
  );
}
