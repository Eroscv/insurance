import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { type Reflector } from '@nestjs/core';
import type { Role } from '@insurance/database';
import { hasPermission, type Permission } from '@insurance/shared';
import { PERMISSION_KEY, ROLES_KEY, type AuthUser } from './decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    const permission = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION_KEY, targets);
    if (!roles && !permission) return true;
    const user = ctx.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user) return true; // JwtAuthGuard já rejeitou; rotas públicas não têm roles
    if (roles && !roles.includes(user.role)) throw new ForbiddenException('Sem permissão para esta ação.');
    if (permission && !hasPermission(user.role, permission)) {
      throw new ForbiddenException('Sem permissão para esta ação.');
    }
    return true;
  }
}
