import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDatabase } from './app.factory';
import { auth, createUserAndLogin, registerOrg, type Session } from './helpers';

const CLIENT = { type: 'INDIVIDUAL', name: 'Cliente Teste', document: '52998224725' };
const VEHICLE = { brand: 'Fiat', model: 'Argo', manufacturingYear: 2022, modelYear: 2023 };
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');

async function setupClient(app: NestExpressApplication, s: Session) {
  const client = await request(app.getHttpServer()).post('/api/v1/clients').set(auth(s)).send(CLIENT).expect(201);
  const vehicle = await request(app.getHttpServer()).post(`/api/v1/clients/${client.body.id}/vehicles`).set(auth(s)).send(VEHICLE).expect(201);
  return { clientId: client.body.id as string, vehicleId: vehicle.body.id as string };
}
async function validateDoc(app: NestExpressApplication, s: Session, type: string, clientId: string) {
  const up = await request(app.getHttpServer()).post('/api/v1/documents').set(auth(s)).field('type', type).field('clientId', clientId).attach('file', PNG, { filename: `${type}.png`, contentType: 'image/png' }).expect(201);
  await request(app.getHttpServer()).patch(`/api/v1/documents/${up.body.id}/status`).set(auth(s)).send({ status: 'VALIDATED' }).expect(200);
}

describe('quotes', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetDatabase(app));
  afterAll(() => app.close());

  it('sequential numbering per organization; assigned to creator by default', async () => {
    const a = await registerOrg(app, 'Org A');
    const b = await registerOrg(app, 'Org B');
    const ca = await setupClient(app, a);
    const cb = await setupClient(app, b);
    const q1 = await request(app.getHttpServer()).post('/api/v1/quotes').set(auth(a)).send({ clientId: ca.clientId }).expect(201);
    const q2 = await request(app.getHttpServer()).post('/api/v1/quotes').set(auth(a)).send({ clientId: ca.clientId, vehicleId: ca.vehicleId }).expect(201);
    const qb = await request(app.getHttpServer()).post('/api/v1/quotes').set(auth(b)).send({ clientId: cb.clientId }).expect(201);
    expect([q1.body.quoteNumber, q2.body.quoteNumber, qb.body.quoteNumber]).toEqual([1, 2, 1]);
    expect(q1.body.status).toBe('NEW');
    expect(q1.body.assignedUser.id).toBe(a.user.id);
    expect(q1.body.pendingRequiredDocs).toEqual(['CNH', 'CRLV']);
    // cliente de outra org
    await request(app.getHttpServer()).post('/api/v1/quotes').set(auth(b)).send({ clientId: ca.clientId }).expect(404);
    await request(app.getHttpServer()).get(`/api/v1/quotes/${q1.body.id}`).set(auth(b)).expect(404);
  });

  it('status machine enforced with real data (docs, vehicle, lost reason, reopen)', async () => {
    const s = await registerOrg(app);
    const { clientId, vehicleId } = await setupClient(app, s);
    const q = await request(app.getHttpServer()).post('/api/v1/quotes').set(auth(s)).send({ clientId }).expect(201);
    const url = `/api/v1/quotes/${q.body.id}/status`;
    const set = (status: string, extra = {}) => request(app.getHttpServer()).patch(url).set(auth(s)).send({ status, ...extra });

    let r = await set('DATA_COMPLETE').expect(400);
    expect(r.body.message).toMatch(/documento/i);
    await set('WAITING_DOCUMENTS').expect(200);
    await validateDoc(app, s, 'CNH', clientId);
    await validateDoc(app, s, 'CRLV', clientId);
    r = await set('DATA_COMPLETE').expect(400);
    expect(r.body.message).toMatch(/veículo/i);
    await request(app.getHttpServer()).patch(`/api/v1/quotes/${q.body.id}`).set(auth(s)).send({ vehicleId }).expect(200);
    await set('DATA_COMPLETE').expect(200);
    await set('QUOTING').expect(200);
    await set('WAITING_PROPOSALS').expect(200);
    await set('PROPOSALS_RECEIVED').expect(200);
    r = await set('PROPOSAL_SENT').expect(400);
    expect(r.body.message).toMatch(/proposta/i);
    await set('LOST').expect(400);
    r = await set('LOST', { lostReason: 'OTHER' }).expect(400);
    await set('LOST', { lostReason: 'PRICE' }).expect(200);
    const lost = await request(app.getHttpServer()).get(`/api/v1/quotes/${q.body.id}`).set(auth(s)).expect(200);
    expect(lost.body.lostReason).toBe('PRICE');
    expect(lost.body.closedAt).toBeTruthy();
    await set('NEGOTIATION').expect(200); // ADMIN reabre
    const hist = await request(app.getHttpServer()).get(`/api/v1/quotes/${q.body.id}/history`).set(auth(s)).expect(200);
    expect(hist.body.statusHistory.map((h: { toStatus: string }) => h.toStatus)).toEqual(['NEGOTIATION', 'LOST', 'PROPOSALS_RECEIVED', 'WAITING_PROPOSALS', 'QUOTING', 'DATA_COMPLETE', 'WAITING_DOCUMENTS', 'NEW']);
  });

  it('BROKER cannot edit quotes of other brokers nor reassign; MANAGER can', async () => {
    const admin = await registerOrg(app);
    const b1 = await createUserAndLogin(app, admin, 'BROKER');
    const b2 = await createUserAndLogin(app, admin, 'BROKER');
    const manager = await createUserAndLogin(app, admin, 'MANAGER');
    const { clientId } = await setupClient(app, admin);
    const q = await request(app.getHttpServer()).post('/api/v1/quotes').set(auth(b1)).send({ clientId }).expect(201);
    await request(app.getHttpServer()).patch(`/api/v1/quotes/${q.body.id}`).set(auth(b2)).send({ priority: 'HIGH' }).expect(403);
    await request(app.getHttpServer()).get(`/api/v1/quotes/${q.body.id}`).set(auth(b2)).expect(200); // visualizar pode
    await request(app.getHttpServer()).patch(`/api/v1/quotes/${q.body.id}/assign`).set(auth(b1)).send({ assignedUserId: b2.user.id }).expect(403);
    await request(app.getHttpServer()).patch(`/api/v1/quotes/${q.body.id}/assign`).set(auth(manager)).send({ assignedUserId: b2.user.id }).expect(200);
    await request(app.getHttpServer()).patch(`/api/v1/quotes/${q.body.id}`).set(auth(b2)).send({ priority: 'HIGH' }).expect(200);
  });

  it('list filters and kanban grouping', async () => {
    const s = await registerOrg(app);
    const { clientId } = await setupClient(app, s);
    await request(app.getHttpServer()).post('/api/v1/quotes').set(auth(s)).send({ clientId, priority: 'HIGH' }).expect(201);
    const q2 = await request(app.getHttpServer()).post('/api/v1/quotes').set(auth(s)).send({ clientId }).expect(201);
    await request(app.getHttpServer()).patch(`/api/v1/quotes/${q2.body.id}/status`).set(auth(s)).send({ status: 'CANCELLED' }).expect(200);
    const high = await request(app.getHttpServer()).get('/api/v1/quotes').query({ priority: 'HIGH' }).set(auth(s)).expect(200);
    expect(high.body.meta.total).toBe(1);
    const open = await request(app.getHttpServer()).get('/api/v1/quotes').query({ open: 'true' }).set(auth(s)).expect(200);
    expect(open.body.meta.total).toBe(1);
    const byNumber = await request(app.getHttpServer()).get('/api/v1/quotes').query({ search: '#000002' }).set(auth(s)).expect(200);
    expect(byNumber.body.data[0].quoteNumber).toBe(2);
    const kanban = await request(app.getHttpServer()).get('/api/v1/quotes/kanban').set(auth(s)).expect(200);
    expect(kanban.body.NEW).toHaveLength(1);
    expect(kanban.body.CANCELLED).toBeUndefined();
  });

  it('auto details upsert', async () => {
    const s = await registerOrg(app);
    const { clientId } = await setupClient(app, s);
    const q = await request(app.getHttpServer()).post('/api/v1/quotes').set(auth(s)).send({ clientId, autoDetails: { profession: 'Engenheira', hasHomeGarage: true } }).expect(201);
    expect(q.body.autoDetails.profession).toBe('Engenheira');
    const d = await request(app.getHttpServer()).patch(`/api/v1/quotes/${q.body.id}/auto-details`).set(auth(s)).send({ profession: 'Médica', numberOfDrivers: 2, maritalStatus: '' }).expect(200);
    expect(d.body.profession).toBe('Médica');
    expect(d.body.numberOfDrivers).toBe(2);
    expect(d.body.maritalStatus).toBeNull();
  });
});
