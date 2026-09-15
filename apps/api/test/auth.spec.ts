import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDatabase } from './app.factory';

const REGISTER = {
  organizationName: 'Corretora Teste',
  name: 'Admin Teste',
  email: 'admin@teste.local',
  password: 'Senha12345',
};

describe('auth', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetDatabase(app));
  afterAll(() => app.close());

  it('registers org + admin, sets cookies, and /me works', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/register').send(REGISTER).expect(201);
    expect(res.body.user.role).toBe('ADMIN');
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('access_token=') && c.includes('HttpOnly'))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refresh_token='))).toBe(true);

    const me = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', cookies).expect(200);
    expect(me.body.email).toBe(REGISTER.email);
    expect(me.body.organization.name).toBe('Corretora Teste');
  });

  it('rejects duplicate email and weak password', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/register').send(REGISTER).expect(201);
    await request(app.getHttpServer()).post('/api/v1/auth/register').send(REGISTER).expect(409);
    const bad = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...REGISTER, email: 'x@y.local', password: 'short' })
      .expect(400);
    expect(bad.body.details[0].path).toBe('password');
  });

  it('login, refresh rotates session, logout revokes', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/register').send(REGISTER);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: REGISTER.email, password: 'errada123' })
      .expect(401);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: REGISTER.email, password: REGISTER.password })
      .expect(200);
    const cookies = login.headers['set-cookie'] as unknown as string[];

    const refreshed = await request(app.getHttpServer()).post('/api/v1/auth/refresh').set('Cookie', cookies).expect(200);
    const cookies2 = refreshed.headers['set-cookie'] as unknown as string[];
    // token antigo foi revogado
    await request(app.getHttpServer()).post('/api/v1/auth/refresh').set('Cookie', cookies).expect(401);

    await request(app.getHttpServer()).post('/api/v1/auth/logout').set('Cookie', cookies2).expect(204);
    await request(app.getHttpServer()).post('/api/v1/auth/refresh').set('Cookie', cookies2).expect(401);
  });

  it('protected route without token → 401; bearer works', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    const reg = await request(app.getHttpServer()).post('/api/v1/auth/register').send(REGISTER);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`)
      .expect(200);
  });

  it('forgot/reset password flow via mail stub', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/register').send(REGISTER);
    await request(app.getHttpServer()).post('/api/v1/auth/forgot-password').send({ email: REGISTER.email }).expect(200);
    const { MailerService } = await import('../src/infra/mailer/mailer.service');
    const mailer = app.get(MailerService);
    const link = mailer.sent.at(-1)?.text.match(/token=([a-f0-9]+)/)?.[1];
    expect(link).toBeTruthy();
    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: link, password: 'NovaSenha123' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: REGISTER.email, password: 'NovaSenha123' })
      .expect(200);
  });
});
