import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDatabase } from './app.factory';
import { auth, registerOrg } from './helpers';

const CLIENT = { type: 'INDIVIDUAL', name: 'Cliente Teste', document: '529.982.247-25', phone: '(11) 98765-4321', email: 'cliente@teste.local', state: 'sp' };
const VEHICLE = { brand: 'Fiat', model: 'Argo', manufacturingYear: 2022, modelYear: 2023, plate: 'abc-1d23', fuel: 'FLEX', zeroKm: false };
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');

describe('clients, vehicles, documents', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetDatabase(app));
  afterAll(() => app.close());

  it('creates client normalizing document/phone, rejects duplicates and invalid CPF', async () => {
    const s = await registerOrg(app);
    const res = await request(app.getHttpServer()).post('/api/v1/clients').set(auth(s)).send(CLIENT).expect(201);
    expect(res.body.document).toBe('52998224725');
    expect(res.body.phone).toBe('11987654321');
    expect(res.body.state).toBe('SP');
    const dup = await request(app.getHttpServer()).post('/api/v1/clients').set(auth(s)).send({ ...CLIENT, name: 'Outro' }).expect(409);
    expect(dup.body.existingId).toBe(res.body.id);
    await request(app.getHttpServer()).post('/api/v1/clients').set(auth(s)).send({ ...CLIENT, document: '529.982.247-26' }).expect(400);
    await request(app.getHttpServer()).post('/api/v1/clients').set(auth(s)).send({ ...CLIENT, type: 'COMPANY' }).expect(400);
  });

  it('search and list with pagination; tenant isolation on get/update', async () => {
    const a = await registerOrg(app, 'Org A');
    const b = await registerOrg(app, 'Org B');
    const created = await request(app.getHttpServer()).post('/api/v1/clients').set(auth(a)).send(CLIENT).expect(201);
    // mesma CPF em outra org é permitido
    await request(app.getHttpServer()).post('/api/v1/clients').set(auth(b)).send(CLIENT).expect(201);
    const list = await request(app.getHttpServer()).get('/api/v1/clients').query({ search: '529982' }).set(auth(a)).expect(200);
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data[0].quotesCount).toBe(0);
    await request(app.getHttpServer()).get(`/api/v1/clients/${created.body.id}`).set(auth(b)).expect(404);
    await request(app.getHttpServer()).patch(`/api/v1/clients/${created.body.id}`).set(auth(b)).send(CLIENT).expect(404);
    await request(app.getHttpServer()).get(`/api/v1/clients/${created.body.id}`).set(auth(a)).expect(200);
  });

  it('vehicles CRUD with year validation', async () => {
    const s = await registerOrg(app);
    const client = await request(app.getHttpServer()).post('/api/v1/clients').set(auth(s)).send(CLIENT).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/clients/${client.body.id}/vehicles`).set(auth(s)).send({ ...VEHICLE, modelYear: 2025 }).expect(400);
    const v = await request(app.getHttpServer()).post(`/api/v1/clients/${client.body.id}/vehicles`).set(auth(s)).send(VEHICLE).expect(201);
    expect(v.body.plate).toBe('ABC1D23');
    const detail = await request(app.getHttpServer()).get(`/api/v1/clients/${client.body.id}`).set(auth(s)).expect(200);
    expect(detail.body.vehicles).toHaveLength(1);
    await request(app.getHttpServer()).delete(`/api/v1/vehicles/${v.body.id}`).set(auth(s)).expect(204);
    const after = await request(app.getHttpServer()).get(`/api/v1/clients/${client.body.id}`).set(auth(s)).expect(200);
    expect(after.body.vehicles).toHaveLength(0);
  });

  it('document upload validates magic bytes, presigns download, status change, tenant isolation', async () => {
    const s = await registerOrg(app);
    const other = await registerOrg(app, 'Outra');
    const client = await request(app.getHttpServer()).post('/api/v1/clients').set(auth(s)).send(CLIENT).expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set(auth(s))
      .field('type', 'CNH')
      .field('clientId', client.body.id)
      .attach('file', Buffer.from('not an image'), { filename: 'fake.png', contentType: 'image/png' })
      .expect(400);
    const up = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set(auth(s))
      .field('type', 'CNH')
      .field('clientId', client.body.id)
      .attach('file', PNG, { filename: 'cnh.png', contentType: 'image/png' })
      .expect(201);
    expect(up.body.status).toBe('RECEIVED');
    expect(up.body.mimeType).toBe('image/png');
    const dl = await request(app.getHttpServer()).get(`/api/v1/documents/${up.body.id}/download`).set(auth(s)).expect(200);
    expect(dl.body.url).toContain('X-Amz-Signature');
    await request(app.getHttpServer()).get(`/api/v1/documents/${up.body.id}/download`).set(auth(other)).expect(404);
    const val = await request(app.getHttpServer()).patch(`/api/v1/documents/${up.body.id}/status`).set(auth(s)).send({ status: 'VALIDATED' }).expect(200);
    expect(val.body.validatedBy.id).toBe(s.user.id);
    const list = await request(app.getHttpServer()).get('/api/v1/documents').query({ clientId: client.body.id, status: 'VALIDATED' }).set(auth(s)).expect(200);
    expect(list.body.meta.total).toBe(1);
  });
});
