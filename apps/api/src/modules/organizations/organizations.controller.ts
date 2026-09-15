import { Body, Controller, Get, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  Permission,
  updateOrganizationSchema,
  updateOrganizationSettingsSchema,
  type UpdateOrganizationInput,
  type UpdateOrganizationSettingsInput,
} from '@insurance/shared';
import { RequirePermission } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import type { UploadedFile as Upload } from '../../infra/storage/upload';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Get('current')
  current() {
    return this.service.current();
  }

  @RequirePermission(Permission.ORG_MANAGE)
  @Patch('current')
  update(@Body(new ZodValidationPipe(updateOrganizationSchema)) body: UpdateOrganizationInput) {
    return this.service.update(body);
  }

  @RequirePermission(Permission.ORG_MANAGE)
  @Patch('current/settings')
  updateSettings(@Body(new ZodValidationPipe(updateOrganizationSettingsSchema)) body: UpdateOrganizationSettingsInput) {
    return this.service.updateSettings(body);
  }

  @RequirePermission(Permission.ORG_MANAGE)
  @Post('current/logo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  uploadLogo(@UploadedFile() file?: Upload) {
    return this.service.uploadLogo(file);
  }
}
