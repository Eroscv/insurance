import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { insurerSchema, listInsurersSchema, Permission, type InsurerInput, type ListInsurersQuery } from '@insurance/shared';
import { RequirePermission } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import type { UploadedFile as Upload } from '../../infra/storage/upload';
import { InsurersService } from './insurers.service';

@Controller('insurers')
export class InsurersController {
  constructor(private readonly service: InsurersService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listInsurersSchema)) q: ListInsurersQuery) {
    return this.service.list(q);
  }

  @Get('options')
  options() {
    return this.service.options();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @RequirePermission(Permission.INSURERS_MANAGE)
  @Post()
  create(@Body(new ZodValidationPipe(insurerSchema)) body: InsurerInput) {
    return this.service.create(body);
  }

  @RequirePermission(Permission.INSURERS_MANAGE)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(insurerSchema)) body: InsurerInput) {
    return this.service.update(id, body);
  }

  @RequirePermission(Permission.INSURERS_MANAGE)
  @HttpCode(204)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  @RequirePermission(Permission.INSURERS_MANAGE)
  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  uploadLogo(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file?: Upload) {
    return this.service.uploadLogo(id, file);
  }
}
