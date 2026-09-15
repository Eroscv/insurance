import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { JobsService } from '../src/infra/scheduler/jobs.service';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { createTestApp, resetDatabase } from './app.factory';
import { auth, createUserAndLogin, registerOrg } from './helpers';

describe('tasks, notifications and jobs', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetDatabase(app));
  afterAll(() => app.close());

  it('task CRUD, overdue derived, notification on assignment to other user', async () => {
    const admin = await registerOrg(app);
    const broker = await createUserAndLogin(app, admin, 'BROKER');
    const past = new Date(Date.now() - 60_000).toISOString();
    const t = await request(app.getHttpServer()).post('/api/v1/tasks').set(auth(admin)).send({ title: 'Ligar para cliente', userId: broker.user.id, dueDate: past, priority: 'HIGH' }).expect(201);
    expect(t.body.overdue).toBe(true);
    const notif = await request(app.getHttpServer()).get('/api/v1/notifications').set(auth(broker)).expect(200);
    expect(notif.body.unread).toBe(1);
    expect(notif.body.data[0].type).toBe('NEW_TASK');
    const overdue = await request(app.getHttpServer()).get('/api/v1/tasks').query({ overdue: 'true' }).set(auth(admin)).expect(200);
    expect(overdue.body.meta.total).toBe(1);
    await request(app.getHttpServer()).patch(`/api/v1/tasks/${t.body.id}/status`).set(auth(broker)).send({ status: 'DONE' }).expect(200);
    const open = await request(app.getHttpServer()).get('/api/v1/tasks').query({ open: 'true' }).set(auth(admin)).expect(200);
    expect(open.body.meta.total).toBe(0);
    await request(app.getHttpServer()).patch(`/api/v1/notifications/${notif.body.data[0].id}/read`).set(auth(broker)).expect(204);
    const unread = await request(app.getHttpServer()).get('/api/v1/notifications/unread-count').set(auth(broker)).expect(200);
    expect(unread.body.unread).toBe(0);
  });

  it('jobs are idempotent: stale quotes, expiring/expired proposals, overdue tasks', async () => {
    const admin = await registerOrg(app);
    const prisma = app.get(PrismaService).system;
    const jobs = app.get(JobsService);
    const client = await request(app.getHttpServer()).post('/api/v1/clients').set(auth(admin)).send({ type: 'INDIVIDUAL', name: 'Cliente', document: '52998224725' }).expect(201);
    const quote = await request(app.getHttpServer()).post('/api/v1/quotes').set(auth(admin)).send({ clientId: client.body.id }).expect(201);
    const insurer = await request(app.getHttpServer()).post('/api/v1/insurers').set(auth(admin)).send({ name: 'Porto', active: true }).expect(201);
    const qis = await request(app.getHttpServer()).post(`/api/v1/quotes/${quote.body.id}/insurers`).set(auth(admin)).send({ insurerIds: [insurer.body.id] }).expect(201);
    const in3 = new Date(); in3.setUTCHours(0, 0, 0, 0); in3.setUTCDate(in3.getUTCDate() + 3);
    const p1 = await request(app.getHttpServer()).post(`/api/v1/quote-insurers/${qis.body[0].id}/proposals`).set(auth(admin)).send({ totalAmount: '1000', validityDate: in3.toISOString().slice(0, 10) }).expect(201);
    const p2 = await request(app.getHttpServer()).post(`/api/v1/quote-insurers/${qis.body[0].id}/proposals`).set(auth(admin)).send({ totalAmount: '900', validityDate: '2020-01-01' }).expect(201);

    // cotação parada: força lastActivityAt antigo
    await prisma.quote.update({ where: { id: quote.body.id }, data: { lastActivityAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) } });
    expect(await jobs.staleQuotes()).toBe(1);
    expect(await jobs.staleQuotes()).toBe(0); // mesma data → idempotente

    const r1 = await jobs.expiringProposals();
    expect(r1).toEqual({ expiring: 1, expired: 1 });
    const r2 = await jobs.expiringProposals();
    expect(r2).toEqual({ expiring: 0, expired: 0 });
    const tasks = await request(app.getHttpServer()).get('/api/v1/tasks').set(auth(admin)).expect(200);
    expect(tasks.body.data.some((t: { title: string }) => t.title.includes('Porto'))).toBe(true);
    const p2Now = await prisma.proposal.findUniqueOrThrow({ where: { id: p2.body.id } });
    expect(p2Now.status).toBe('EXPIRED');
    const p1Now = await prisma.proposal.findUniqueOrThrow({ where: { id: p1.body.id } });
    expect(p1Now.status).toBe('RECEIVED');

    await request(app.getHttpServer()).post('/api/v1/tasks').set(auth(admin)).send({ title: 'Atrasada', dueDate: new Date(Date.now() - 1000).toISOString() }).expect(201);
    expect(await jobs.overdueTasks()).toBe(1);
    expect(await jobs.overdueTasks()).toBe(0);

    const notifs = await request(app.getHttpServer()).get('/api/v1/notifications').set(auth(admin)).expect(200);
    const types = notifs.body.data.map((n: { type: string }) => n.type).sort();
    expect(types).toEqual(['PROPOSAL_EXPIRING', 'STALE_QUOTE', 'TASK_OVERDUE']);
  });
});
