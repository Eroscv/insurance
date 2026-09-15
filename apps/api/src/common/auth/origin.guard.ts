import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { type ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Env } from '../../config/env';

/** Mitigação CSRF: mutações autenticadas por cookie devem vir do WEB_URL. Bearer tokens (testes/API) são isentos. */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    if (req.headers.authorization?.startsWith('Bearer ')) return true;
    const origin = req.headers.origin ?? (req.headers.referer ? new URL(req.headers.referer).origin : undefined);
    if (!origin) return true; // clientes não-browser sem cookie
    const allowed = new URL(this.config.get('WEB_URL', { infer: true })).origin;
    if (origin !== allowed) throw new ForbiddenException('Origem não permitida.');
    return true;
  }
}
