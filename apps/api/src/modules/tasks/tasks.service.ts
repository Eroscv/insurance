import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, TaskStatus } from '@insurance/database';
import { formatQuoteNumber, type ListTasksQuery, type TaskInput } from '@insurance/shared';
import { pageArgs, parseSort, toPage } from '../../common/pagination/paginate';
import { orgId, TenantContext } from '../../common/tenant/tenant-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

const include = {
  user: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  client: { select: { id: true, name: true } },
  quote: { select: { id: true, quoteNumber: true, status: true } },
} satisfies Prisma.TaskInclude;

const OPEN: TaskStatus[] = ['TODO', 'IN_PROGRESS'];

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(q: ListTasksQuery) {
    const now = new Date();
    const where: Prisma.TaskWhereInput = {
      status: q.status ?? (q.open === true ? { in: OPEN } : q.open === false ? { in: ['DONE', 'CANCELLED'] } : undefined),
      userId: q.userId,
      clientId: q.clientId,
      quoteId: q.quoteId,
      ...(q.overdue ? { status: { in: OPEN }, dueDate: { lt: now } } : {}),
      dueDate: q.from || q.to ? { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(`${q.to}T23:59:59.999Z`) : undefined, ...(q.overdue ? { lt: now } : {}) } : q.overdue ? { lt: now } : undefined,
      title: q.search ? { contains: q.search, mode: 'insensitive' } : undefined,
    };
    const [rows, total] = await Promise.all([
      this.prisma.tenant.task.findMany({ where, include, orderBy: parseSort(q.sort, ['dueDate', 'priority', 'createdAt', 'status'], { dueDate: 'asc' }), ...pageArgs(q) }),
      this.prisma.tenant.task.count({ where }),
    ]);
    return toPage(rows.map((t) => ({ ...t, overdue: this.isOverdue(t) })), total, q);
  }

  isOverdue(t: { status: TaskStatus; dueDate: Date | null }): boolean {
    return OPEN.includes(t.status) && t.dueDate !== null && t.dueDate < new Date();
  }

  async get(id: string) {
    const t = await this.prisma.tenant.task.findUnique({ where: { id }, include });
    if (!t) throw new NotFoundException('Tarefa não encontrada.');
    return { ...t, overdue: this.isOverdue(t) };
  }

  async create(input: TaskInput) {
    const ctx = TenantContext.require();
    const userId = input.userId ?? ctx.userId!;
    const task = await this.prisma.tenant.task.create({
      data: { organizationId: orgId(), userId, createdById: ctx.userId!, title: input.title, description: input.description ?? null, priority: input.priority, clientId: input.clientId ?? null, quoteId: input.quoteId ?? null, dueDate: input.dueDate ? new Date(input.dueDate) : null },
      include,
    });
    await this.audit.record({ entity: 'task', entityId: task.id, action: 'CREATE', newData: { title: task.title, userId, quoteId: task.quoteId } });
    if (userId !== ctx.userId) {
      await this.notifications.notify({ organizationId: orgId(), userId, type: 'NEW_TASK', title: `Nova tarefa: ${task.title}`, body: task.quote ? `Cotação ${formatQuoteNumber(task.quote.quoteNumber)}` : null, entity: 'task', entityId: task.id });
    }
    if (task.quoteId) await this.prisma.tenant.quote.update({ where: { id: task.quoteId }, data: { lastActivityAt: new Date() } });
    return { ...task, overdue: this.isOverdue(task) };
  }

  async update(id: string, input: TaskInput) {
    const before = await this.get(id);
    const task = await this.prisma.tenant.task.update({
      where: { id },
      data: { title: input.title, description: input.description ?? null, priority: input.priority, userId: input.userId ?? before.userId, clientId: input.clientId ?? null, quoteId: input.quoteId ?? null, dueDate: input.dueDate ? new Date(input.dueDate) : null },
      include,
    });
    await this.audit.record({ entity: 'task', entityId: id, action: 'UPDATE', oldData: { title: before.title, dueDate: before.dueDate, userId: before.userId }, newData: { title: task.title, dueDate: task.dueDate, userId: task.userId } });
    return { ...task, overdue: this.isOverdue(task) };
  }

  async setStatus(id: string, status: TaskStatus) {
    const before = await this.get(id);
    const task = await this.prisma.tenant.task.update({ where: { id }, data: { status, completedAt: status === 'DONE' ? new Date() : null }, include });
    await this.audit.record({ entity: 'task', entityId: id, action: 'STATUS_CHANGE', oldData: { status: before.status }, newData: { status, title: task.title } });
    if (task.quoteId) await this.prisma.tenant.quote.update({ where: { id: task.quoteId }, data: { lastActivityAt: new Date() } });
    return { ...task, overdue: this.isOverdue(task) };
  }

  async remove(id: string) {
    const task = await this.get(id);
    await this.prisma.tenant.task.delete({ where: { id } });
    await this.audit.record({ entity: 'task', entityId: id, action: 'DELETE', oldData: { title: task.title } });
  }
}
