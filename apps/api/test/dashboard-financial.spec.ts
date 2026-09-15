import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDatabase } from './app.factory';
import { auth, createUserAndLogin, registerOrg, type Session } from './helpers';

const VALID_CPFS = ['52998224725', '11144477735', '93541134780', '28625583880'];
let cpfIndex = 0;

async function closeWonQuote(app: NestExpressApplication, s: Session, brokerSession: Session, totalAmount: string) {
  const client = await request(app.getHttpServer()).post('/api/v1/clients').set(auth(s)).send({ type: 'INDIVIDUAL', name: `Cliente ${totalAmount}`, document: VALID_CPFS[cpfIndex++ % VALID_CPFS.length] }).expect(201);
  const vehicle = await request(app.getHttpServer()).post(`/api/v1/clients/${client.body.id}/vehicles`).set(auth(s)).send({ brand: 'VW', model: 'Gol', manufacturingYear: 2023, modelYear: 2023 }).expect(201);
  const quote = await request(app.getHttpServer()).post('/api/v1/quotes').set(auth(brokerSession)).send({ clientId: client.body.id, vehicleId: vehicle.body.id }).expect(201);
  for (const type of ['CNH', 'CRLV']) {
    const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');
    const up = await request(app.getHttpServer()).post('/api/v1/documents').set(auth(brokerSession)).field('type', type).field('clientId', client.body.id).attach('file', PNG, { filename: `${type}.png`, contentType: 'image/png' }).expect(201);
    await request(app.getHttpServer()).patch(`/api/v1/documents/${up.body.id}/status`).set(auth(brokerSession)).send({ status: 'VALIDATED' }).expect(200);
  }
  await request(app.getHttpServer()).patch(`/api/v1/quotes/${quote.body.id}/status`).set(auth(brokerSession)).send({ status: 'DATA_COMPLETE' }).expect(200);
  const insurer = await request(app.getHttpServer()).post('/api/v1/insurers').set(auth(s)).send({ name: `Seguradora ${totalAmount}`, active: true }).expect(201);
  const qi = await request(app.getHttpServer()).post(`/api/v1/quotes/${quote.body.id}/insurers`).set(auth(brokerSession)).send({ insurerIds: [insurer.body.id] }).expect(201);
  const proposal = await request(app.getHttpServer()).post(`/api/v1/quote-insurers/${qi.body[0].id}/proposals`).set(auth(brokerSession)).send({ totalAmount }).expect(201);
  await request(app.getHttpServer()).post(`/api/v1/proposals/${proposal.body.id}/select`).set(auth(brokerSession)).expect(201);
  await request(app.getHttpServer()).patch(`/api/v1/quotes/${quote.body.id}/status`).set(auth(brokerSession)).send({ status: 'PROPOSAL_SENT' }).expect(200);
  await request(app.getHttpServer()).patch(`/api/v1/quotes/${quote.body.id}/status`).set(auth(brokerSession)).send({ status: 'WON' }).expect(200);
  return { quoteId: quote.body.id as string, proposalId: proposal.body.id as string };
}

describe('dashboard: indicadores financeiros', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetDatabase(app));
  afterAll(() => app.close());

  it('organization settings accept iofRatePercent and monthlyRevenueGoal', async () => {
    const admin = await registerOrg(app);
    const body = { commissionPercentage: 10, staleQuoteDays: 5, requiredDocumentTypes: ['CNH', 'CRLV'], proposalValidityDays: 7, proposalFooterText: null, iofRatePercent: 6.5, monthlyRevenueGoal: '50000' };
    const res = await request(app.getHttpServer()).patch('/api/v1/organizations/current/settings').set(auth(admin)).send(body).expect(200);
    expect(Number(res.body.iofRatePercent)).toBe(6.5);
    expect(Number(res.body.monthlyRevenueGoal)).toBe(50000);
  });

  it('summary reports won premium/commission this month, goal progress and pipeline projection', async () => {
    const admin = await registerOrg(app);
    const broker = await createUserAndLogin(app, admin, 'BROKER');
    await request(app.getHttpServer()).patch('/api/v1/organizations/current/settings').set(auth(admin)).send({ commissionPercentage: 10, staleQuoteDays: 5, requiredDocumentTypes: ['CNH', 'CRLV'], proposalValidityDays: 7, proposalFooterText: null, iofRatePercent: 7.38, monthlyRevenueGoal: '5000' }).expect(200);

    await closeWonQuote(app, admin, broker, '3000');
    await closeWonQuote(app, admin, broker, '2000');

    const summary = await request(app.getHttpServer()).get('/api/v1/dashboard/summary').set(auth(admin)).expect(200);
    expect(summary.body.financial.wonPremiumMonth).toBe('5000.00');
    expect(summary.body.financial.wonCommissionMonth).toBe('500.00'); // 10% de 5000
    expect(Number(summary.body.financial.monthlyGoal)).toBe(5000);
    expect(summary.body.financial.goalProgressPercent).toBe('100.0');
    expect(summary.body.financial.projectedCommission).toBe('0.00'); // nada em aberto com proposta selecionada

    expect(summary.body.monthlyEvolution).toHaveLength(6);
    expect(summary.body.monthlyEvolution.at(-1)).toMatchObject({ won: 2, wonPremium: '5000.00' });

    expect(summary.body.brokerRanking).toEqual([{ userId: broker.user.id, name: 'BROKER', wonCount: 2, wonPremium: '5000.00' }]);

    // BROKER não vê o ranking de outros corretores
    const brokerSummary = await request(app.getHttpServer()).get('/api/v1/dashboard/summary').set(auth(broker)).expect(200);
    expect(brokerSummary.body.brokerRanking).toBeNull();
  });
});
