import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDatabase } from './app.factory';
import { auth, registerOrg, type Session } from './helpers';

async function quoteWithProposals(app: NestExpressApplication, s: Session) {
  const client = await request(app.getHttpServer()).post('/api/v1/clients').set(auth(s)).send({ type: 'INDIVIDUAL', name: 'Maria Teste', document: '52998224725', phone: '11987654321' }).expect(201);
  const vehicle = await request(app.getHttpServer()).post(`/api/v1/clients/${client.body.id}/vehicles`).set(auth(s)).send({ brand: 'Honda', model: 'Civic', manufacturingYear: 2022, modelYear: 2022, plate: 'ABC1D23' }).expect(201);
  const quote = await request(app.getHttpServer()).post('/api/v1/quotes').set(auth(s)).send({ clientId: client.body.id, vehicleId: vehicle.body.id }).expect(201);
  const names = ['Porto', 'Azul', 'Tokio'];
  const insurers = await Promise.all(names.map((name) => request(app.getHttpServer()).post('/api/v1/insurers').set(auth(s)).send({ name, active: true }).expect(201)));
  const qis = await request(app.getHttpServer()).post(`/api/v1/quotes/${quote.body.id}/insurers`).set(auth(s)).send({ insurerIds: insurers.map((i) => i.body.id) }).expect(201);
  const specs = [
    { totalAmount: '3200', deductibleAmount: '4000', coverages: [{ name: 'Danos materiais', insuredAmount: '100000' }], assistances: [{ name: 'Carro reserva', included: true }, { name: 'Vidros', included: true }] },
    { totalAmount: '2900', deductibleAmount: '5000', installments: 10, installmentAmount: '290', coverages: [{ name: 'Danos materiais', insuredAmount: '80000' }, { name: 'Danos morais', insuredAmount: '20000' }], assistances: [{ name: 'Carro reserva', included: true }, { name: 'Vidros', included: true }] },
    { totalAmount: '3450', deductibleAmount: '3500', coverages: [], assistances: [{ name: 'Carro reserva', included: false }, { name: 'Vidros', included: true }] },
  ];
  const proposals = [];
  for (let i = 0; i < specs.length; i++) {
    const qi = qis.body.find((x: { insurer: { name: string } }) => x.insurer.name === names[i]);
    proposals.push((await request(app.getHttpServer()).post(`/api/v1/quote-insurers/${qi.id}/proposals`).set(auth(s)).send(specs[i]).expect(201)).body);
  }
  return { quoteId: quote.body.id as string, proposals };
}

describe('comparison, message template and PDF', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetDatabase(app));
  afterAll(() => app.close());

  it('comparison highlights lowest premium/deductible and computes differences', async () => {
    const s = await registerOrg(app);
    const { quoteId, proposals } = await quoteWithProposals(app, s);
    const res = await request(app.getHttpServer()).get(`/api/v1/quotes/${quoteId}/comparison`).set(auth(s)).expect(200);
    const byName = Object.fromEntries(res.body.columns.map((c: { insurerName: string }) => [c.insurerName, c]));
    expect(res.body.highlights.lowestPremiumIds).toEqual([proposals[1].id]);
    expect(res.body.highlights.lowestDeductibleIds).toEqual([proposals[2].id]);
    expect(byName.Porto.difference).toBe('300.00');
    expect(byName.Porto.percentageDifference).toBe('10.34');
    expect(byName.Azul.installmentTotal).toBe('2900.00');
    expect(byName.Azul.commissionAmount).toBe('290.00'); // 10% padrão
    expect(res.body.coverageNames).toEqual(['Danos materiais', 'Danos morais']);
    expect(byName.Tokio.assistances['Carro reserva']).toBe(false);
  });

  it('comparison exposes IOF/net premium breakdown and renewal savings when expiringPremium is set', async () => {
    const s = await registerOrg(app);
    const { quoteId, proposals } = await quoteWithProposals(app, s);
    const res = await request(app.getHttpServer()).get(`/api/v1/quotes/${quoteId}/comparison`).set(auth(s)).expect(200);
    expect(res.body.iofRatePercent).toBe('7.38');
    expect(res.body.expiringPremium).toBeNull();
    const porto = res.body.columns.find((c: { proposalId: string }) => c.proposalId === proposals[0].id);
    // total 3200 = líquido + IOF a 7.38%
    expect(porto.netPremium).toBe('2980.07');
    expect(porto.iofAmount).toBe('219.93');
    expect(porto.renewal).toBeNull();

    await request(app.getHttpServer()).patch(`/api/v1/quotes/${quoteId}`).set(auth(s)).send({ expiringPremium: '3500' }).expect(200);
    const res2 = await request(app.getHttpServer()).get(`/api/v1/quotes/${quoteId}/comparison`).set(auth(s)).expect(200);
    expect(res2.body.expiringPremium).toBe('3500');
    const azul = res2.body.columns.find((c: { proposalId: string }) => c.proposalId === proposals[1].id);
    expect(azul.renewal).toEqual({ savings: '600.00', savingsPercentage: '17.14', isCheaper: true });
  });

  it('message template lists proposals sorted by price', async () => {
    const s = await registerOrg(app);
    const { quoteId } = await quoteWithProposals(app, s);
    const res = await request(app.getHttpServer()).get(`/api/v1/quotes/${quoteId}/message-template`).set(auth(s)).expect(200);
    expect(res.body.text).toContain('Olá, Maria!');
    expect(res.body.text.indexOf('Azul')).toBeLessThan(res.body.text.indexOf('Porto'));
    expect(res.body.text).toContain('Honda Civic 2022');
  });

  it('PDF requires selected proposal, then generates a document of type PROPOSAL', async () => {
    const s = await registerOrg(app);
    const { quoteId, proposals } = await quoteWithProposals(app, s);
    await request(app.getHttpServer()).post(`/api/v1/quotes/${quoteId}/proposal-pdf`).set(auth(s)).expect(400);
    await request(app.getHttpServer()).post(`/api/v1/proposals/${proposals[1].id}/select`).set(auth(s)).expect(201);
    const html = await request(app.getHttpServer()).get(`/api/v1/quotes/${quoteId}/proposal-preview`).set(auth(s)).expect(200);
    expect(html.text).toContain('não representa, isoladamente, emissão da apólice');
    expect(html.text).toContain('Azul');
    const pdf = await request(app.getHttpServer()).post(`/api/v1/quotes/${quoteId}/proposal-pdf`).set(auth(s)).expect(201);
    expect(pdf.body.fileName).toMatch(/^proposta-000001-azul\.pdf$/);
    expect(pdf.body.url).toContain('X-Amz-Signature');
    const docs = await request(app.getHttpServer()).get('/api/v1/documents').query({ quoteId, type: 'PROPOSAL' }).set(auth(s)).expect(200);
    expect(docs.body.meta.total).toBe(1);
    expect(docs.body.data[0].mimeType).toBe('application/pdf');
    expect(docs.body.data[0].size).toBeGreaterThan(1000);
  }, 60_000);
});
