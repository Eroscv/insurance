import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import type { User } from '@insurance/database';
import type { LoginInput, RegisterInput } from '@insurance/shared';
import type { AccessTokenPayload } from '../../common/auth/access-token';
import type { AuthUser } from '../../common/auth/decorators';
import type { Env } from '../../config/env';
import { MailerService } from '../../infra/mailer/mailer.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly mailer: MailerService,
    private readonly audit: AuditService,
  ) {}

  async register(input: RegisterInput, meta: { userAgent?: string; ip?: string }) {
    const existing = await this.prisma.system.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException('Já existe uma conta com este e-mail.');

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const user = await this.prisma.system.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: input.organizationName,
          document: input.organizationDocument ?? null,
          phone: input.organizationPhone ?? null,
          email: input.email,
          settings: { create: {} },
          quoteCounter: { create: {} },
        },
      });
      return tx.user.create({
        data: { organizationId: org.id, name: input.name, email: input.email, passwordHash, role: 'ADMIN' },
      });
    });
    await this.audit.record({ organizationId: user.organizationId, userId: user.id, entity: 'user', entityId: user.id, action: 'CREATE', newData: { email: user.email, role: user.role } });
    return { user: this.toAuthUser(user), tokens: await this.issueTokens(user, meta) };
  }

  async login(input: LoginInput, meta: { userAgent?: string; ip?: string }) {
    const user = await this.prisma.system.user.findUnique({ where: { email: input.email } });
    const valid = user && user.active && !user.deletedAt && (await argon2.verify(user.passwordHash, input.password));
    if (!valid || !user) throw new UnauthorizedException('E-mail ou senha inválidos.');
    await this.audit.record({ organizationId: user.organizationId, userId: user.id, entity: 'user', entityId: user.id, action: 'LOGIN' });
    return { user: this.toAuthUser(user), tokens: await this.issueTokens(user, meta) };
  }

  async refresh(refreshToken: string | undefined, meta: { userAgent?: string; ip?: string }) {
    if (!refreshToken) throw new UnauthorizedException('Sessão expirada.');
    const session = await this.prisma.system.session.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Sessão expirada.');
    }
    if (!session.user.active || session.user.deletedAt) throw new UnauthorizedException('Usuário inativo.');
    // rotação: revoga a sessão atual e emite nova
    await this.prisma.system.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return { user: this.toAuthUser(session.user), tokens: await this.issueTokens(session.user, meta) };
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    await this.prisma.system.session.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string) {
    const user = await this.prisma.system.user.findFirst({
      where: { id: userId, active: true, deletedAt: null },
      include: { organization: { select: { id: true, name: true, logoKey: true } } },
    });
    if (!user) throw new UnauthorizedException('Usuário inativo.');
    return { ...this.toAuthUser(user), phone: user.phone, organization: user.organization };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.system.user.findUnique({ where: { email } });
    if (!user || !user.active || user.deletedAt) return; // resposta idêntica para não vazar existência
    const token = randomBytes(32).toString('hex');
    await this.prisma.system.passwordReset.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    const link = `${this.config.get('WEB_URL', { infer: true })}/reset-password?token=${token}`;
    await this.mailer.send({
      to: user.email,
      subject: 'Redefinição de senha',
      text: `Olá, ${user.name}. Para redefinir sua senha acesse: ${link}\nO link expira em 1 hora.`,
    });
  }

  async resetPassword(token: string, password: string) {
    const reset = await this.prisma.system.passwordReset.findUnique({ where: { tokenHash: sha256(token) } });
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      throw new BadRequestException('Link inválido ou expirado.');
    }
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await this.prisma.system.$transaction([
      this.prisma.system.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
      this.prisma.system.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      this.prisma.system.session.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  }

  private async issueTokens(user: User, meta: { userAgent?: string; ip?: string }): Promise<TokenPair> {
    const payload: AccessTokenPayload = { sub: user.id, org: user.organizationId, role: user.role, email: user.email, name: user.name };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = randomBytes(32).toString('hex');
    const days = this.config.get('REFRESH_TTL_DAYS', { infer: true });
    const refreshExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await this.prisma.system.session.create({
      data: { userId: user.id, tokenHash: sha256(refreshToken), userAgent: meta.userAgent?.slice(0, 255), ip: meta.ip, expiresAt: refreshExpiresAt },
    });
    return { accessToken, refreshToken, refreshExpiresAt };
  }

  private toAuthUser(user: User): AuthUser {
    return { id: user.id, organizationId: user.organizationId, role: user.role, email: user.email, name: user.name };
  }
}
