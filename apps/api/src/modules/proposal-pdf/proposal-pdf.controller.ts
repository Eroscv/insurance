import { Controller, Get, Header, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { ProposalPdfService } from './proposal-pdf.service';

const q = z.object({ proposalId: z.string().uuid().optional() });

@Controller('quotes')
export class ProposalPdfController {
  constructor(private readonly service: ProposalPdfService) {}

  @Post(':id/proposal-pdf')
  generate(@Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(q)) query: { proposalId?: string }) {
    return this.service.generate(id, query.proposalId);
  }

  @Get(':id/proposal-preview')
  @Header('Content-Type', 'text/html; charset=utf-8')
  preview(@Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(q)) query: { proposalId?: string }) {
    return this.service.previewHtml(id, query.proposalId);
  }

  @Get(':id/message-template')
  message(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.messageTemplate(id);
  }
}
