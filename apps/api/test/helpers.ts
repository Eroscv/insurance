import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

export interface Session {
  token: string;
  user: { id: string; organizationId: string; role: string; email: string };
}

let counter = 0;

/** Cria organização + admin e retorna bearer token. */
export async function registerOrg(app: NestExpressApplication, name = `Org ${++counter}`): Promise<Session> {
  const email = `admin${counter}-${Date.now()}@teste.local`;
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ organizationName: name, name: 'Admin', email, password: 'Senha12345' })
    .expect(201);
  return { token: res.body.accessToken, user: res.body.user };
}

/** Cria usuário com role na org do admin e faz login. */
export async function createUserAndLogin(app: NestExpressApplication, admin: Session, role: 'MANAGER' | 'BROKER'): Promise<Session> {
  const email = `${role.toLowerCase()}${++counter}-${Date.now()}@teste.local`;
  await request(app.getHttpServer())
    .post('/api/v1/users')
    .set('Authorization', `Bearer ${admin.token}`)
    .send({ name: role, email, role, password: 'Senha12345' })
    .expect(201);
  const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password: 'Senha12345' }).expect(200);
  return { token: login.body.accessToken, user: login.body.user };
}

export const auth = (s: Session) => ({ Authorization: `Bearer ${s.token}` });
