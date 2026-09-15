import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { clientSchema, listClientsSchema, Permission, type ClientInput, type ListClientsQuery } from '@insurance/shared';
import { z } from 'zod';
import { RequirePermission } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { ClientsService } from './clients.service';

@Controller('clients')
export class ClientsController {
  constructor(private readonly service: ClientsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listClientsSchema)) q: ListClientsQuery) {
    return this.service.list(q);
  }

  @Get('search')
  search(@Query(new ZodValidationPipe(z.object({ q: z.string().trim().min(1).max(100) }))) query: { q: string }) {
    return this.service.search(query.q);
  }

  @Post()
  create(@Body(new ZodValidationPipe(clientSchema)) body: ClientInput) {
    return this.service.create(body);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(clientSchema)) body: ClientInput) {
    return this.service.update(id, body);
  }

  @RequirePermission(Permission.RECORDS_DELETE)
  @HttpCode(204)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  @Get(':id/quotes')
  quotes(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.quotes(id);
  }

  @Get(':id/history')
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.history(id);
  }
}
