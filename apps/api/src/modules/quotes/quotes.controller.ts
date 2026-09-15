import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  assignQuoteSchema,
  changeQuoteStatusSchema,
  createQuoteSchema,
  listQuotesSchema,
  Permission,
  quoteAutoDetailsSchema,
  updateQuoteSchema,
  type ChangeQuoteStatusInput,
  type CreateQuoteInput,
  type ListQuotesQuery,
  type QuoteAutoDetailsInput,
  type UpdateQuoteInput,
} from '@insurance/shared';
import { RequirePermission } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { QuotesService } from './quotes.service';

@Controller('quotes')
export class QuotesController {
  constructor(private readonly service: QuotesService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listQuotesSchema)) q: ListQuotesQuery) {
    return this.service.list(q);
  }

  @Get('kanban')
  kanban(@Query(new ZodValidationPipe(listQuotesSchema)) q: ListQuotesQuery) {
    return this.service.kanban(q);
  }

  @Post()
  create(@Body(new ZodValidationPipe(createQuoteSchema)) body: CreateQuoteInput) {
    return this.service.create(body);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateQuoteSchema)) body: UpdateQuoteInput) {
    return this.service.update(id, body);
  }

  @Patch(':id/auto-details')
  autoDetails(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(quoteAutoDetailsSchema)) body: QuoteAutoDetailsInput) {
    return this.service.updateAutoDetails(id, body);
  }

  @Patch(':id/status')
  changeStatus(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(changeQuoteStatusSchema)) body: ChangeQuoteStatusInput) {
    return this.service.changeStatus(id, body);
  }

  @RequirePermission(Permission.QUOTES_REASSIGN)
  @Patch(':id/assign')
  assign(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(assignQuoteSchema)) body: { assignedUserId: string | null }) {
    return this.service.assign(id, body.assignedUserId);
  }

  @Get(':id/history')
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.history(id);
  }

  @RequirePermission(Permission.RECORDS_DELETE)
  @HttpCode(204)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
