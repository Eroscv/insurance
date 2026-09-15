import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { Prisma } from '@insurance/database';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from '@insurance/shared';
import { pageArgs, parseSort, toPage } from '../../common/pagination/paginate';
import { orgId, TenantContext } from '../../common/tenant/tenant-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListUsersQuery) {
    const where: Prisma.UserWhereInput = {
      role: q.role,
      active: q.active,
      OR: q.search ? [{ name: { contains: q.search, mode: 'insensitive' } }, { email: { contains: q.search, mode: 'insensitive' } }] : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.tenant.user.findMany({ where, select: userSelect, orderBy: parseSort(q.sort, ['name', 'email', 'role', 'createdAt'], { name: 'asc' }), ...pageArgs(q) }),
      this.prisma.tenant.user.count({ where }),
    ]);
    return toPage(data, total, q);
  }

  /** Lista enxuta para selects (responsável da cotação etc.). */
  listActive() {
    return this.prisma.tenant.user.findMany({ where: { active: true }, select: { id: true, name: true, role: true }, orderBy: { name: 'asc' } });
  }

  async create(input: CreateUserInput) {
    const exists = await this.prisma.system.user.findUnique({ where: { email: input.email } });
    if (exists) throw new ConflictException('Já existe um usuário com este e-mail.');
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const user = await this.prisma.tenant.user.create({
      data: { organizationId: orgId(), name: input.name, email: input.email, role: input.role, phone: input.phone ?? null, passwordHash },
      select: userSelect,
    });
    await this.audit.record({ entity: 'user', entityId: user.id, action: 'CREATE', newData: user });
    return user;
  }

  async update(id: string, input: UpdateUserInput) {
    const before = await this.findOrThrow(id);
    const ctx = TenantContext.require();
    if (before.id === ctx.userId && input.role && input.role !== before.role) {
      throw new BadRequestException('Você não pode alterar o próprio perfil de acesso.');
    }
    const data: Prisma.UserUpdateInput = { name: input.name, role: input.role, phone: input.phone };
    if (input.password) data.passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const user = await this.prisma.tenant.user.update({ where: { id }, data, select: userSelect });
    await this.audit.record({ entity: 'user', entityId: id, action: 'UPDATE', oldData: before, newData: user });
    return user;
  }

  async setActive(id: string, active: boolean) {
    const before = await this.findOrThrow(id);
    const ctx = TenantContext.require();
    if (before.id === ctx.userId && !active) throw new BadRequestException('Você não pode desativar a si mesmo.');
    if (!active && before.role === 'ADMIN') {
      const admins = await this.prisma.tenant.user.count({ where: { role: 'ADMIN', active: true } });
      if (admins <= 1) throw new BadRequestException('A organização precisa de pelo menos um administrador ativo.');
    }
    const user = await this.prisma.tenant.user.update({ where: { id }, data: { active }, select: userSelect });
    if (!active) await this.prisma.system.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.record({ entity: 'user', entityId: id, action: 'UPDATE', oldData: { active: before.active }, newData: { active } });
    return user;
  }

  async updateProfile(userId: string, input: { name: string; phone?: string | null }) {
    const user = await this.prisma.tenant.user.update({ where: { id: userId }, data: { name: input.name, phone: input.phone ?? null }, select: userSelect });
    await this.audit.record({ entity: 'user', entityId: userId, action: 'UPDATE', newData: input });
    return user;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.tenant.user.findUnique({ where: { id: userId } });
    if (!user || !(await argon2.verify(user.passwordHash, currentPassword))) {
      throw new ForbiddenException('Senha atual incorreta.');
    }
    await this.prisma.tenant.user.update({ where: { id: userId }, data: { passwordHash: await argon2.hash(newPassword, { type: argon2.argon2id }) } });
    await this.prisma.system.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private async findOrThrow(id: string) {
    const user = await this.prisma.tenant.user.findUnique({ where: { id }, select: userSelect });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }
}
