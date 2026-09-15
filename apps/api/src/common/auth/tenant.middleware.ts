import { Injectable, type NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { NextFunction, Request, Response } from 'express';
import { TenantContext } from '../tenant/tenant-context';
import { ACCESS_COOKIE, type AccessTokenPayload } from './access-token';
import type { AuthUser } from './decorators';

/**
 * Lê o access token (cookie httpOnly ou Authorization: Bearer), popula req.user e
 * envolve o restante do pipeline no TenantContext (AsyncLocalStorage).
 * Não rejeita requisições: quem exige autenticação é o JwtAuthGuard.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly jwt: JwtService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const token = this.extract(req);
    if (!token) return next();
    let payload: AccessTokenPayload;
    try {
      payload = this.jwt.verify<AccessTokenPayload>(token);
    } catch {
      return next();
    }
    const user: AuthUser = {
      id: payload.sub,
      organizationId: payload.org,
      role: payload.role,
      email: payload.email,
      name: payload.name,
    };
    (req as Request & { user: AuthUser }).user = user;
    TenantContext.run({ organizationId: user.organizationId, userId: user.id, role: user.role }, () => next());
  }

  private extract(req: Request): string | undefined {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    return cookies?.[ACCESS_COOKIE];
  }
}
