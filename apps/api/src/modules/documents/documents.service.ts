import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DocumentType, Prisma } from '@insurance/database';
import type { ListDocumentsQuery, UpdateDocumentStatusInput, UploadDocumentInput } from '@insurance/shared';
import { pageArgs, parseSort, toPage } from '../../common/pagination/paginate';
import { orgId, TenantContext } from '../../common/tenant/tenant-context';
import type { Env } from '../../config/env';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { validateUpload, type UploadedFile } from '../../infra/storage/upload';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DOCUMENT_TYPE_LABELS, formatQuoteNumber } from '@insurance/shared';

const documentInclude = {
  uploadedBy: { select: { id: true, name: true } },
  validatedBy: { select: { id: true, name: true } },
  client: { select: { id: true, name: true } },
  quote: { select: { id: true, quoteNumber: true, status: true } },
} satisfies Prisma.DocumentInclude;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
    private readonly notifications: NotificationsService,
  ) {}

  async list(q: ListDocumentsQuery) {
    const where: Prisma.DocumentWhereInput = {
      status: q.status,
      type: q.type,
      clientId: q.clientId,
      quoteId: q.quoteId,
      OR: q.search ? [{ fileName: { contains: q.search, mode: 'insensitive' } }, { client: { name: { contains: q.search, mode: 'insensitive' } } }] : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.tenant.document.findMany({ where, include: documentInclude, orderBy: parseSort(q.sort, ['uploadedAt', 'type', 'status'], { uploadedAt: 'desc' }), ...pageArgs(q) }),
      this.prisma.tenant.document.count({ where }),
    ]);
    return toPage(data, total, q);
  }

  async get(id: string) {
    const doc = await this.prisma.tenant.document.findUnique({ where: { id }, include: documentInclude });
    if (!doc) throw new NotFoundException('Documento não encontrado.');
    return doc;
  }

  async upload(input: UploadDocumentInput, file: UploadedFile | undefined) {
    if (!input.clientId && !input.quoteId) throw new BadRequestException('Informe o cliente ou a cotação.');
    const mime = validateUpload(file, this.config.get('MAX_UPLOAD_MB', { infer: true }));
    let clientId = input.clientId ?? null;
    if (input.quoteId) {
      const quote = await this.prisma.tenant.quote.findUnique({ where: { id: input.quoteId }, select: { id: true, clientId: true } });
      if (!quote) throw new NotFoundException('Cotação não encontrada.');
      clientId = clientId ?? quote.clientId;
    }
    if (clientId) {
      const client = await this.prisma.tenant.client.findUnique({ where: { id: clientId }, select: { id: true } });
      if (!client) throw new NotFoundException('Cliente não encontrado.');
    }
    const folder = input.quoteId ? `quotes/${input.quoteId}` : `clients/${clientId}`;
    const key = this.storage.buildKey(orgId(), folder, file!.originalname);
    await this.storage.put(key, file!.buffer, mime);

    const doc = await this.prisma.tenant.document.create({
      data: {
        organizationId: orgId(),
        clientId,
        quoteId: input.quoteId ?? null,
        type: input.type,
        fileName: file!.originalname.slice(0, 255),
        storageKey: key,
        mimeType: mime,
        size: file!.size,
        status: 'RECEIVED',
        uploadedById: TenantContext.require().userId!,
        notes: input.notes ?? null,
      },
      include: documentInclude,
    });
    if (input.quoteId) {
      const quote = await this.prisma.tenant.quote.update({ where: { id: input.quoteId }, data: { lastActivityAt: new Date() } });
      if (quote.assignedUserId && quote.assignedUserId !== TenantContext.require().userId) {
        await this.notifications.notifyQuoteOwner(quote, { type: 'DOCUMENT_RECEIVED', title: `Documento recebido: ${DOCUMENT_TYPE_LABELS[doc.type]}`, body: `Cotação ${formatQuoteNumber(quote.quoteNumber)} · ${doc.fileName}` });
      }
    }
    await this.audit.record({ entity: 'document', entityId: doc.id, action: 'UPLOAD', newData: { type: doc.type, fileName: doc.fileName, quoteId: doc.quoteId, clientId: doc.clientId } });
    return doc;
  }

  async downloadUrl(id: string) {
    const doc = await this.get(id);
    return { url: await this.storage.presignedGetUrl(doc.storageKey, doc.fileName, 60), fileName: doc.fileName, mimeType: doc.mimeType, expiresIn: 60 };
  }

  async updateStatus(id: string, input: UpdateDocumentStatusInput) {
    const before = await this.get(id);
    const isValidation = input.status === 'VALIDATED' || input.status === 'REJECTED';
    const doc = await this.prisma.tenant.document.update({
      where: { id },
      data: {
        status: input.status,
        notes: input.notes === undefined ? undefined : input.notes,
        validatedById: isValidation ? TenantContext.require().userId : null,
        validatedAt: isValidation ? new Date() : null,
      },
      include: documentInclude,
    });
    if (doc.quoteId) await this.prisma.tenant.quote.update({ where: { id: doc.quoteId }, data: { lastActivityAt: new Date() } });
    await this.audit.record({ entity: 'document', entityId: id, action: 'STATUS_CHANGE', oldData: { status: before.status }, newData: { status: doc.status, notes: doc.notes } });
    return doc;
  }

  async remove(id: string) {
    const doc = await this.get(id);
    await this.prisma.tenant.document.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record({ entity: 'document', entityId: id, action: 'DELETE', oldData: { type: doc.type, fileName: doc.fileName } });
  }

  /**
   * Tipos obrigatórios ainda sem documento VALIDATED para a cotação.
   * Documentos do cliente (sem quoteId) valem para todas as cotações dele.
   */
  async pendingRequiredTypes(quote: { id: string; clientId: string }): Promise<DocumentType[]> {
    const settings = await this.prisma.tenant.organizationSettings.findUnique({ where: { organizationId: orgId() } });
    const required = settings?.requiredDocumentTypes ?? ['CNH', 'CRLV'];
    if (required.length === 0) return [];
    const validated = await this.prisma.tenant.document.findMany({
      where: { status: 'VALIDATED', type: { in: required }, OR: [{ quoteId: quote.id }, { clientId: quote.clientId, quoteId: null }] },
      select: { type: true },
      distinct: ['type'],
    });
    const have = new Set(validated.map((d) => d.type));
    return required.filter((t) => !have.has(t));
  }
}
