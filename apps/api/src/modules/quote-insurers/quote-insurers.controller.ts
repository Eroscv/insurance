import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { addQuoteInsurersSchema, updateQuoteInsurerSchema, type UpdateQuoteInsurerInput } from '@insurance/shared';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { QuoteInsurersService } from './quote-insurers.service';

@Controller()
export class QuoteInsurersController {
  constructor(private readonly service: QuoteInsurersService) {}

  @Get('quotes/:quoteId/insurers')
  list(@Param('quoteId', ParseUUIDPipe) quoteId: string) {
    return this.service.listByQuote(quoteId);
  }

  @Post('quotes/:quoteId/insurers')
  add(@Param('quoteId', ParseUUIDPipe) quoteId: string, @Body(new ZodValidationPipe(addQuoteInsurersSchema)) body: { insurerIds: string[] }) {
    return this.service.add(quoteId, body.insurerIds);
  }

  @Patch('quote-insurers/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateQuoteInsurerSchema)) body: UpdateQuoteInsurerInput) {
    return this.service.update(id, body);
  }

  @HttpCode(204)
  @Delete('quote-insurers/:id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
