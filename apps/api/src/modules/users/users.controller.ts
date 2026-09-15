import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  changePasswordSchema,
  createUserSchema,
  listUsersSchema,
  Permission,
  setUserActiveSchema,
  updateProfileSchema,
  updateUserSchema,
  type CreateUserInput,
  type ListUsersQuery,
  type UpdateUserInput,
} from '@insurance/shared';
import { CurrentUser, RequirePermission, type AuthUser } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listUsersSchema)) q: ListUsersQuery) {
    return this.service.list(q);
  }

  @Get('options')
  options() {
    return this.service.listActive();
  }

  @RequirePermission(Permission.USERS_MANAGE)
  @Post()
  create(@Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput) {
    return this.service.create(body);
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(updateProfileSchema)) body: { name: string; phone?: string | null }) {
    return this.service.updateProfile(user.id, body);
  }

  @HttpCode(204)
  @Patch('me/password')
  async changePassword(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(changePasswordSchema)) body: { currentPassword: string; newPassword: string }) {
    await this.service.changePassword(user.id, body.currentPassword, body.newPassword);
  }

  @RequirePermission(Permission.USERS_MANAGE)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput) {
    return this.service.update(id, body);
  }

  @RequirePermission(Permission.USERS_MANAGE)
  @Patch(':id/active')
  setActive(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(setUserActiveSchema)) body: { active: boolean }) {
    return this.service.setActive(id, body.active);
  }
}
