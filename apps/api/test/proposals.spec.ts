import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDatabase } from './app.factory';
import { auth, registerOrg, type Session } from './helpers';

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');

async function readyQuote(app: NestExpressApplication, s: Session) {
  const client = await request(app.getHttpServer()).post('/api/v1/clients').set(auth(s)).send({ type: 'INDIVIDUAL', name: 'Cliente Teste', document: '52998224725' }).expect(201);
  const vehicle = await request(app.getHttpServer()).post(`/api/v1/clients/${client.body.id}/vehicles`).set(auth(s)).send({ brand: 'VW', model: 'Polo', manufacturingYear: 2023, modelYear: 2023 }).expect(201);
  for (const type of ['CNH', 'CRLV']) {
    const up = await request(app.getHttpServer()).post('/api/v1/documents').set(auth(s)).field('type', type).field('clientId', client.body.id).attach('file', PNG, { filename: `${type}.png`, contentType: 'image/png' }).expect(201);
    await request(app.getHttpServer()).patch(`/api/v1/documents/${up.body.id}/status`).set(auth(s)).send({ status: 'VALIDATED' }).expect(200);
  }
  const quote = await request(app.getHttpServer()).post('/api/v1/quotes').set(auth(s)).send({ clientId: client.body.id, vehicleId: vehicle.body.id }).expect(201);
  await request(app.getHttpServer()).patch(`/api/v1/quotes/${quote.body.id}/status`).set(auth(s)).send({ status: 'DATA_COMPLETE' }).expect(200);
  const insurers = await Promise.all(['Porto', 'Azul', 'Tokio'].map((name) => request(app.getHttpServer()).post('/api/v1/insurers').set(auth(s)).send({ name, active: true }).expect(201)));
  return { quoteId: quote.body.id as string, insurerIds: insurers.map((i) => i.body.id as string) };
}

const PROPOSAL = { totalAmount: '3200.00', installments: 12, installmentAmount: '266.67', deductibleAmount: '4000', coverages: [{ name: 'Danos materiais', insuredAmount: '100000' }], assistances: [{ name: 'Carro reserva', included: true }, { name: 'Vidros', included: false }] };

describe('quote insurers + proposals', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetDatabase(app));
  afterAll(() => app.close());

  it('adding insurers auto-advances DATA_COMPLETE → QUOTING; requesting all → WAITING_PROPOSALS', async () => {
    const s = await registerOrg(app);
    const { quoteId, insurerIds } = await readyQuote(app, s);
    const added = await request(app.getHttpServer()).post(`/api/v1/quotes/${quoteId}/insurers`).set(auth(s)).send({ insurerIds: insurerIds.slice(0, 2) }).expect(201);
    expect(added.body).toHaveLength(2);
    let q = await request(app.getHttpServer()).get(`/api/v1/quotes/${quoteId}`).set(auth(s)).expect(200);
    expect(q.body.status).toBe('QUOTING');
    // duplicado é ignorado
    const again = await request(app.getHttpServer()).post(`/api/v1/quotes/${quoteId}/insurers`).set(auth(s)).send({ insurerIds: [insurerIds[0]] }).expect(201);
    expect(again.body).toHaveLength(2);
    await request(app.getHttpServer()).patch(`/api/v1/quote-insurers/${added.body[0].id}`).set(auth(s)).send({ status: 'REQUESTED' }).expect(200);
    q = await request(app.getHttpServer()).get(`/api/v1/quotes/${quoteId}`).set(auth(s));
    expect(q.body.status).toBe('QUOTING');
    await request(app.getHttpServer()).patch(`/api/v1/quote-insurers/${added.body[1].id}`).set(auth(s)).send({ status: 'REQUESTED' }).expect(200);
    q = await request(app.getHttpServer()).get(`/api/v1/quotes/${quoteId}`).set(auth(s));
    expect(q.body.status).toBe('WAITING_PROPOSALS');
    expect(q.body.quoteInsurers[0].requestedAt).toBeTruthy();
  });

  it('proposal create → insurer RECEIVED and quote PROPOSALS_RECEIVED; select rejects others; WON allowed', async () => {
    const s = await registerOrg(app);
    const { quoteId, insurerIds } = await readyQuote(app, s);
    const qis = await request(app.getHttpServer()).post(`/api/v1/quotes/${quoteId}/insurers`).set(auth(s)).send({ insurerIds }).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/quote-insurers/${qis.body[0].id}/proposals`).set(auth(s)).send({ ...PROPOSAL, installments: 3, installmentAmount: null }).expect(400);
    const p1 = await request(app.getHttpServer()).post(`/api/v1/quote-insurers/${qis.body[0].id}/proposals`).set(auth(s)).send(PROPOSAL).expect(201);
    expect(p1.body.status).toBe('RECEIVED');
    expect(p1.body.coverages).toHaveLength(1);
    expect(p1.body.validityDate).toBeTruthy(); // default = hoje + 7
    const p2 = await request(app.getHttpServer()).post(`/api/v1/quote-insurers/${qis.body[1].id}/proposals`).set(auth(s)).send({ ...PROPOSAL, totalAmount: '2900' }).expect(201);
    let q = await request(app.getHttpServer()).get(`/api/v1/quotes/${quoteId}`).set(auth(s));
    expect(q.body.status).toBe('PROPOSALS_RECEIVED');
    expect(q.body.quoteInsurers.find((x: { id: string }) => x.id === qis.body[0].id).status).toBe('RECEIVED');

    await request(app.getHttpServer()).patch(`/api/v1/quotes/${quoteId}/status`).set(auth(s)).send({ status: 'WON' }).expect(400); // sem seleção não há transição válida (precisa PROPOSAL_SENT)
    await request(app.getHttpServer()).post(`/api/v1/proposals/${p2.body.id}/select`).set(auth(s)).expect(201);
    const list = await request(app.getHttpServer()).get(`/api/v1/quotes/${quoteId}/proposals`).set(auth(s)).expect(200);
    const byId = Object.fromEntries(list.body.map((p: { id: string; status: string }) => [p.id, p.status]));
    expect(byId[p1.body.id]).toBe('REJECTED');
    expect(byId[p2.body.id]).toBe('SELECTED');
    await request(app.getHttpServer()).patch(`/api/v1/quotes/${quoteId}/status`).set(auth(s)).send({ status: 'PROPOSAL_SENT' }).expect(200);
    await request(app.getHttpServer()).patch(`/api/v1/quotes/${quoteId}/status`).set(auth(s)).send({ status: 'WON' }).expect(200);
    q = await request(app.getHttpServer()).get(`/api/v1/quotes/${quoteId}`).set(auth(s));
    expect(q.body.status).toBe('WON');
  });

  it('proposal file upload + presigned url; delete blocked when proposals exist', async () => {
    const s = await registerOrg(app);
    const { quoteId, insurerIds } = await readyQuote(app, s);
    const qis = await request(app.getHttpServer()).post(`/api/v1/quotes/${quoteId}/insurers`).set(auth(s)).send({ insurerIds: [insurerIds[0]] }).expect(201);
    const p = await request(app.getHttpServer()).post(`/api/v1/quote-insurers/${qis.body[0].id}/proposals`).set(auth(s)).send(PROPOSAL).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/proposals/${p.body.id}/file`).set(auth(s)).attach('file', PNG, { filename: 'proposta.png', contentType: 'image/png' }).expect(201);
    const url = await request(app.getHttpServer()).get(`/api/v1/proposals/${p.body.id}/file`).set(auth(s)).expect(200);
    expect(url.body.url).toContain('X-Amz-Signature');
    await request(app.getHttpServer()).delete(`/api/v1/quote-insurers/${qis.body[0].id}`).set(auth(s)).expect(400);
    await request(app.getHttpServer()).delete(`/api/v1/proposals/${p.body.id}`).set(auth(s)).expect(204);
    await request(app.getHttpServer()).delete(`/api/v1/quote-insurers/${qis.body[0].id}`).set(auth(s)).expect(204);
  });
});
