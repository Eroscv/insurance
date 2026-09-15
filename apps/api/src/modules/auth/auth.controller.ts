import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type LoginInput,
  type RegisterInput,
} from '@insurance/shared';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../../common/auth/access-token';
import { CurrentUser, Public, type AuthUser } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import type { Env } from '../../config/env';
import { AuthService, type TokenPair } from './auth.service';

type Req = Request & { cookies?: Record<string, string> };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(@Body(new ZodValidationPipe(registerSchema)) body: RegisterInput, @Req() req: Req, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.auth.register(body, this.meta(req));
    this.setCookies(res, tokens);
    return { user, accessToken: tokens.accessToken };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput, @Req() req: Req, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.auth.login(body, this.meta(req));
    this.setCookies(res, tokens);
    return { user, accessToken: tokens.accessToken };
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Req, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.auth.refresh(req.cookies?.[REFRESH_COOKIE] ?? (req.body?.refreshToken as string | undefined), this.meta(req));
    this.setCookies(res, tokens);
    return { user, accessToken: tokens.accessToken };
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Req() req: Req, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    this.clearCookies(res);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(200)
  @Post('forgot-password')
  async forgot(@Body(new ZodValidationPipe(forgotPasswordSchema)) body: { email: string }) {
    await this.auth.forgotPassword(body.email);
    return { message: 'Se o e-mail existir, enviaremos instruções para redefinir a senha.' };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('reset-password')
  async reset(@Body(new ZodValidationPipe(resetPasswordSchema)) body: { token: string; password: string }) {
    await this.auth.resetPassword(body.token, body.password);
    return { message: 'Senha redefinida com sucesso.' };
  }

  private meta(req: Req) {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }

  private cookieBase() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.config.get('COOKIE_SECURE', { infer: true }) || this.config.get('NODE_ENV', { infer: true }) === 'production',
      domain: this.config.get('COOKIE_DOMAIN', { infer: true }),
      path: '/',
    };
  }

  private setCookies(res: Response, tokens: TokenPair) {
    const base = this.cookieBase();
    res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...base, maxAge: 15 * 60 * 1000 });
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...base, expires: tokens.refreshExpiresAt });
  }

  private clearCookies(res: Response) {
    const base = this.cookieBase();
    res.clearCookie(ACCESS_COOKIE, base);
    res.clearCookie(REFRESH_COOKIE, base);
  }
}
