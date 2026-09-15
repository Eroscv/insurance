import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  listDocumentsSchema,
  updateDocumentStatusSchema,
  uploadDocumentSchema,
  type ListDocumentsQuery,
  type UpdateDocumentStatusInput,
  type UploadDocumentInput,
} from '@insurance/shared';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import type { UploadedFile as Upload } from '../../infra/storage/upload';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listDocumentsSchema)) q: ListDocumentsQuery) {
    return this.service.list(q);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  upload(@Body(new ZodValidationPipe(uploadDocumentSchema)) body: UploadDocumentInput, @UploadedFile() file?: Upload) {
    return this.service.upload(body, file);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Get(':id/download')
  download(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.downloadUrl(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateDocumentStatusSchema)) body: UpdateDocumentStatusInput) {
    return this.service.updateStatus(id, body);
  }

  @HttpCode(204)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
