import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@insurance/database';
import type { InsurerInput, ListInsurersQuery } from '@insurance/shared';
import { pageArgs, parseSort, toPage } from '../../common/pagination/paginate';
import { orgId } from '../../common/tenant/tenant-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { IMAGE_MIME, validateUpload, type UploadedFile } from '../../infra/storage/upload';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class InsurersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListInsurersQuery) {
    const where: Prisma.InsurerWhereInput = { active: q.active, name: q.search ? { contains: q.search, mode: 'insensitive' } : undefined };
    const [rows, total] = await Promise.all([
      this.prisma.tenant.insurer.findMany({ where, orderBy: parseSort(q.sort, ['name', 'createdAt'], { name: 'asc' }), ...pageArgs(q), include: { _count: { select: { quoteInsurers: true } } } }),
      this.prisma.tenant.insurer.count({ where }),
    ]);
    const data = await Promise.all(rows.map(async ({ _count, ...i }) => ({ ...i, quotesCount: _count.quoteInsurers, logoUrl: i.logoKey ? await this.storage.presignedGetUrl(i.logoKey, undefined, 3600) : null })));
    return toPage(data, total, q);
  }

  options() {
    return this.prisma.tenant.insurer.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
  }

  async get(id: string) {
    const i = await this.prisma.tenant.insurer.findUnique({ where: { id } });
    if (!i) throw new NotFoundException('Seguradora não encontrada.');
    return { ...i, logoUrl: i.logoKey ? await this.storage.presignedGetUrl(i.logoKey, undefined, 3600) : null };
  }

  async create(input: InsurerInput) {
    const insurer = await this.prisma.tenant.insurer.create({ data: { ...this.toData(input), organizationId: orgId() } });
    await this.audit.record({ entity: 'insurer', entityId: insurer.id, action: 'CREATE', newData: insurer });
    return insurer;
  }

  async update(id: string, input: InsurerInput) {
    const before = await this.get(id);
    const insurer = await this.prisma.tenant.insurer.update({ where: { id }, data: this.toData(input) });
    await this.audit.record({ entity: 'insurer', entityId: id, action: 'UPDATE', oldData: before, newData: insurer });
    return insurer;
  }

  async remove(id: string) {
    const insurer = await this.get(id);
    const used = await this.prisma.tenant.quoteInsurer.count({ where: { insurerId: id } });
    if (used > 0) throw new BadRequestException('Seguradora possui consultas vinculadas. Desative-a em vez de excluir.');
    await this.prisma.tenant.insurer.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record({ entity: 'insurer', entityId: id, action: 'DELETE', oldData: { name: insurer.name } });
  }

  async uploadLogo(id: string, file: UploadedFile | undefined) {
    const before = await this.get(id);
    const mime = validateUpload(file, 2, IMAGE_MIME);
    const key = this.storage.buildKey(orgId(), `insurers/${id}`, file!.originalname);
    await this.storage.put(key, file!.buffer, mime);
    if (before.logoKey) await this.storage.delete(before.logoKey).catch(() => undefined);
    await this.prisma.tenant.insurer.update({ where: { id }, data: { logoKey: key } });
    return { logoUrl: await this.storage.presignedGetUrl(key, undefined, 3600) };
  }

  private toData(input: InsurerInput): Omit<Prisma.InsurerUncheckedCreateInput, 'organizationId'> {
    return { name: input.name, document: input.document ?? null, email: input.email ?? null, phone: input.phone ?? null, website: input.website ?? null, active: input.active, notes: input.notes ?? null };
  }
}
