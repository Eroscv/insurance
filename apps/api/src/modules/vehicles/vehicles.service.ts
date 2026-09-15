import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@insurance/database';
import { QUOTE_OPEN_STATUSES, type VehicleInput } from '@insurance/shared';
import { orgId } from '../../common/tenant/tenant-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listByClient(clientId: string) {
    return this.prisma.tenant.vehicle.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } });
  }

  async get(id: string) {
    const v = await this.prisma.tenant.vehicle.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Veículo não encontrado.');
    return v;
  }

  async create(clientId: string, input: VehicleInput) {
    const client = await this.prisma.tenant.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) throw new NotFoundException('Cliente não encontrado.');
    const vehicle = await this.prisma.tenant.vehicle.create({ data: { ...this.toData(input), clientId, organizationId: orgId() } });
    await this.audit.record({ entity: 'vehicle', entityId: vehicle.id, action: 'CREATE', newData: vehicle });
    return vehicle;
  }

  async update(id: string, input: VehicleInput) {
    const before = await this.get(id);
    const vehicle = await this.prisma.tenant.vehicle.update({ where: { id }, data: this.toData(input) });
    await this.audit.record({ entity: 'vehicle', entityId: id, action: 'UPDATE', oldData: before, newData: vehicle });
    return vehicle;
  }

  async remove(id: string) {
    const vehicle = await this.get(id);
    const open = await this.prisma.tenant.quote.count({ where: { vehicleId: id, status: { in: QUOTE_OPEN_STATUSES } } });
    if (open > 0) throw new BadRequestException('Veículo está vinculado a cotações em aberto.');
    await this.prisma.tenant.vehicle.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record({ entity: 'vehicle', entityId: id, action: 'DELETE', oldData: { brand: vehicle.brand, model: vehicle.model, plate: vehicle.plate } });
  }

  private toData(input: VehicleInput): Omit<Prisma.VehicleUncheckedCreateInput, 'clientId' | 'organizationId'> {
    return {
      brand: input.brand,
      model: input.model,
      version: input.version ?? null,
      manufacturingYear: input.manufacturingYear,
      modelYear: input.modelYear,
      plate: input.plate ?? null,
      chassis: input.chassis ?? null,
      renavam: input.renavam ?? null,
      fuel: input.fuel ?? null,
      zeroKm: input.zeroKm,
      usageType: input.usageType ?? null,
      overnightLocation: input.overnightLocation ?? null,
    };
  }
}
