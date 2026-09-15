import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@insurance/database';
import { QUOTE_OPEN_STATUSES, type ClientInput, type ListClientsQuery } from '@insurance/shared';
import { pageArgs, parseSort, toPage } from '../../common/pagination/paginate';
import { orgId } from '../../common/tenant/tenant-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListClientsQuery) {
    const digits = q.search?.replace(/\D/g, '') ?? '';
    const where: Prisma.ClientWhereInput = {
      type: q.type,
      city: q.city ? { contains: q.city, mode: 'insensitive' } : undefined,
      OR: q.search
        ? [
            { name: { contains: q.search, mode: 'insensitive' } },
            { email: { contains: q.search, mode: 'insensitive' } },
            ...(digits.length >= 3 ? [{ document: { contains: digits } }, { phone: { contains: digits } }, { whatsapp: { contains: digits } }] : []),
          ]
        : undefined,
    };
    const [rows, total] = await Promise.all([
      this.prisma.tenant.client.findMany({
        where,
        orderBy: parseSort(q.sort, ['name', 'createdAt', 'city'], { name: 'asc' }),
        ...pageArgs(q),
        include: {
          _count: { select: { quotes: { where: { deletedAt: null } } } },
          quotes: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, quoteNumber: true, status: true, createdAt: true } },
        },
      }),
      this.prisma.tenant.client.count({ where }),
    ]);
    const data = rows.map(({ _count, quotes, ...c }) => ({ ...c, quotesCount: _count.quotes, lastQuote: quotes[0] ?? null }));
    return toPage(data, total, q);
  }

  async get(id: string) {
    const client = await this.prisma.tenant.client.findUnique({
      where: { id },
      include: {
        vehicles: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
        _count: { select: { quotes: { where: { deletedAt: null } }, documents: { where: { deletedAt: null } } } },
      },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado.');
    return client;
  }

  async create(input: ClientInput) {
    await this.assertUniqueDocument(input.document);
    const client = await this.prisma.tenant.client.create({ data: { ...this.toData(input), organizationId: orgId() } });
    await this.audit.record({ entity: 'client', entityId: client.id, action: 'CREATE', newData: client });
    return client;
  }

  async update(id: string, input: ClientInput) {
    const before = await this.get(id);
    if (before.document !== input.document) await this.assertUniqueDocument(input.document, id);
    const client = await this.prisma.tenant.client.update({ where: { id }, data: this.toData(input) });
    await this.audit.record({ entity: 'client', entityId: id, action: 'UPDATE', oldData: before, newData: client });
    return client;
  }

  async remove(id: string) {
    const client = await this.get(id);
    const open = await this.prisma.tenant.quote.count({ where: { clientId: id, status: { in: QUOTE_OPEN_STATUSES } } });
    if (open > 0) throw new BadRequestException('Cliente possui cotações em aberto e não pode ser excluído.');
    await this.prisma.tenant.client.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record({ entity: 'client', entityId: id, action: 'DELETE', oldData: { name: client.name, document: client.document } });
  }

  quotes(clientId: string) {
    return this.prisma.tenant.quote.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: { vehicle: { select: { brand: true, model: true, plate: true } }, assignedUser: { select: { id: true, name: true } } },
    });
  }

  async history(clientId: string) {
    await this.get(clientId);
    const [vehicles, documents] = await Promise.all([
      this.prisma.tenant.vehicle.findMany({ where: { clientId }, select: { id: true } }),
      this.prisma.tenant.document.findMany({ where: { clientId }, select: { id: true } }),
    ]);
    const ids = [clientId, ...vehicles.map((v) => v.id), ...documents.map((d) => d.id)];
    return this.prisma.tenant.auditLog.findMany({
      where: { entityId: { in: ids } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { id: true, name: true } } },
    });
  }

  /** Busca rápida para o wizard de cotação. */
  async search(term: string, take = 10) {
    const digits = term.replace(/\D/g, '');
    return this.prisma.tenant.client.findMany({
      where: {
        OR: [{ name: { contains: term, mode: 'insensitive' } }, ...(digits.length >= 3 ? [{ document: { contains: digits } }, { phone: { contains: digits } }] : [])],
      },
      select: { id: true, name: true, document: true, type: true, phone: true, city: true },
      orderBy: { name: 'asc' },
      take,
    });
  }

  private async assertUniqueDocument(document: string, exceptId?: string) {
    const existing = await this.prisma.tenant.client.findFirst({ where: { document, id: exceptId ? { not: exceptId } : undefined }, select: { id: true, name: true } });
    if (existing) {
      throw new ConflictException({ statusCode: 409, error: 'Conflict', message: `Já existe um cliente com este CPF/CNPJ: ${existing.name}.`, existingId: existing.id });
    }
  }

  private toData(input: ClientInput): Prisma.ClientUncheckedCreateInput {
    return {
      type: input.type,
      name: input.name,
      document: input.document,
      birthDate: input.birthDate ? new Date(input.birthDate) : null,
      maritalStatus: input.maritalStatus ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      whatsapp: input.whatsapp ?? null,
      zipCode: input.zipCode ?? null,
      street: input.street ?? null,
      number: input.number ?? null,
      complement: input.complement ?? null,
      neighborhood: input.neighborhood ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      notes: input.notes ?? null,
      organizationId: orgId(),
    };
  }
}
