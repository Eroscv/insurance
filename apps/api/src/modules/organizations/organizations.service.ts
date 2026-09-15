import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UpdateOrganizationInput, UpdateOrganizationSettingsInput } from '@insurance/shared';
import { TenantContext } from '../../common/tenant/tenant-context';
import type { Env } from '../../config/env';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { IMAGE_MIME, validateUpload, type UploadedFile } from '../../infra/storage/upload';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async current() {
    const { organizationId } = TenantContext.require();
    const org = await this.prisma.system.organization.findUnique({
      where: { id: organizationId },
      include: { settings: true },
    });
    if (!org) throw new NotFoundException('Organização não encontrada.');
    const logoUrl = org.logoKey ? await this.storage.presignedGetUrl(org.logoKey, undefined, 3600) : null;
    return { ...org, logoUrl };
  }

  async update(input: UpdateOrganizationInput) {
    const { organizationId } = TenantContext.require();
    const before = await this.prisma.system.organization.findUniqueOrThrow({ where: { id: organizationId } });
    const org = await this.prisma.system.organization.update({ where: { id: organizationId }, data: input });
    await this.audit.record({ entity: 'organization', entityId: org.id, action: 'UPDATE', oldData: before, newData: org });
    return org;
  }

  async updateSettings(input: UpdateOrganizationSettingsInput) {
    const { organizationId } = TenantContext.require();
    const before = await this.prisma.tenant.organizationSettings.findUnique({ where: { organizationId } });
    const settings = await this.prisma.tenant.organizationSettings.upsert({
      where: { organizationId },
      update: input,
      create: { ...input, organizationId },
    });
    await this.audit.record({ entity: 'organization_settings', entityId: organizationId, action: 'UPDATE', oldData: before, newData: settings });
    return settings;
  }

  async uploadLogo(file: UploadedFile | undefined) {
    const { organizationId } = TenantContext.require();
    const mime = validateUpload(file, 2, IMAGE_MIME);
    const key = this.storage.buildKey(organizationId, 'logo', file!.originalname);
    await this.storage.put(key, file!.buffer, mime);
    const before = await this.prisma.system.organization.findUniqueOrThrow({ where: { id: organizationId } });
    if (before.logoKey) await this.storage.delete(before.logoKey).catch(() => undefined);
    const org = await this.prisma.system.organization.update({ where: { id: organizationId }, data: { logoKey: key } });
    await this.audit.record({ entity: 'organization', entityId: org.id, action: 'UPLOAD', newData: { logoKey: key } });
    return { logoUrl: await this.storage.presignedGetUrl(key, undefined, 3600) };
  }
}
