import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { proposalSchema, type ProposalInput } from '@insurance/shared';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import type { UploadedFile as Upload } from '../../infra/storage/upload';
import { ProposalsService } from './proposals.service';

@Controller()
export class ProposalsController {
  constructor(private readonly service: ProposalsService) {}

  @Get('quotes/:quoteId/proposals')
  list(@Param('quoteId', ParseUUIDPipe) quoteId: string) {
    return this.service.listByQuote(quoteId);
  }

  @Post('quote-insurers/:quoteInsurerId/proposals')
  create(@Param('quoteInsurerId', ParseUUIDPipe) quoteInsurerId: string, @Body(new ZodValidationPipe(proposalSchema)) body: ProposalInput) {
    return this.service.create(quoteInsurerId, body);
  }

  @Get('proposals/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Patch('proposals/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(proposalSchema)) body: ProposalInput) {
    return this.service.update(id, body);
  }

  @Post('proposals/:id/select')
  select(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.select(id);
  }

  @Post('proposals/:id/file')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  upload(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file?: Upload) {
    return this.service.uploadFile(id, file);
  }

  @Get('proposals/:id/file')
  fileUrl(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.fileUrl(id);
  }

  @HttpCode(204)
  @Delete('proposals/:id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
