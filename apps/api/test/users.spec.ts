import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDatabase } from './app.factory';
import { auth, createUserAndLogin, registerOrg } from './helpers';

describe('users + organizations (RBAC e tenant)', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetDatabase(app));
  afterAll(() => app.close());

  it('ADMIN creates users; BROKER cannot; MANAGER cannot', async () => {
    const admin = await registerOrg(app);
    const broker = await createUserAndLogin(app, admin, 'BROKER');
    const manager = await createUserAndLogin(app, admin, 'MANAGER');
    const payload = { name: 'Xavier', email: 'x@teste.local', role: 'BROKER', password: 'Senha12345' };
    await request(app.getHttpServer()).post('/api/v1/users').set(auth(broker)).send(payload).expect(403);
    await request(app.getHttpServer()).post('/api/v1/users').set(auth(manager)).send(payload).expect(403);
    await request(app.getHttpServer()).post('/api/v1/users').set(auth(admin)).send(payload).expect(201);
  });

  it('users of one org are invisible to another org (tenant isolation)', async () => {
    const a = await registerOrg(app, 'Org A');
    const b = await registerOrg(app, 'Org B');
    await createUserAndLogin(app, a, 'BROKER');
    const listA = await request(app.getHttpServer()).get('/api/v1/users').set(auth(a)).expect(200);
    const listB = await request(app.getHttpServer()).get('/api/v1/users').set(auth(b)).expect(200);
    expect(listA.body.meta.total).toBe(2);
    expect(listB.body.meta.total).toBe(1);
    const brokerId = listA.body.data.find((u: { role: string }) => u.role === 'BROKER').id;
    await request(app.getHttpServer()).patch(`/api/v1/users/${brokerId}`).set(auth(b)).send({ name: 'hack' }).expect(404);
  });

  it('cannot deactivate self or last admin; deactivation revokes sessions', async () => {
    const admin = await registerOrg(app);
    await request(app.getHttpServer()).patch(`/api/v1/users/${admin.user.id}/active`).set(auth(admin)).send({ active: false }).expect(400);
    const broker = await createUserAndLogin(app, admin, 'BROKER');
    await request(app.getHttpServer()).patch(`/api/v1/users/${broker.user.id}/active`).set(auth(admin)).send({ active: false }).expect(200);
    await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth(broker)).expect(401);
  });

  it('organization settings are editable by ADMIN only and read by all', async () => {
    const admin = await registerOrg(app);
    const broker = await createUserAndLogin(app, admin, 'BROKER');
    const body = { commissionPercentage: 12.5, staleQuoteDays: 7, requiredDocumentTypes: ['CNH'], proposalValidityDays: 10, proposalFooterText: null };
    await request(app.getHttpServer()).patch('/api/v1/organizations/current/settings').set(auth(broker)).send(body).expect(403);
    const res = await request(app.getHttpServer()).patch('/api/v1/organizations/current/settings').set(auth(admin)).send(body).expect(200);
    expect(res.body.staleQuoteDays).toBe(7);
    const cur = await request(app.getHttpServer()).get('/api/v1/organizations/current').set(auth(broker)).expect(200);
    expect(cur.body.settings.requiredDocumentTypes).toEqual(['CNH']);
  });

  it('profile and password change', async () => {
    const admin = await registerOrg(app);
    await request(app.getHttpServer()).patch('/api/v1/users/me').set(auth(admin)).send({ name: 'Novo Nome' }).expect(200);
    await request(app.getHttpServer()).patch('/api/v1/users/me/password').set(auth(admin)).send({ currentPassword: 'errada', newPassword: 'Outra12345' }).expect(403);
    await request(app.getHttpServer()).patch('/api/v1/users/me/password').set(auth(admin)).send({ currentPassword: 'Senha12345', newPassword: 'Outra12345' }).expect(204);
    await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: admin.user.email, password: 'Outra12345' }).expect(200);
  });
});
