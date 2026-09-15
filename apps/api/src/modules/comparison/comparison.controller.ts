import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ComparisonService } from './comparison.service';

@Controller('quotes')
export class ComparisonController {
  constructor(private readonly service: ComparisonService) {}

  @Get(':id/comparison')
  comparison(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.forQuote(id);
  }
}
