import { PrismaClient, type QuoteStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

// Dados claramente fictícios. Documentos válidos por dígito verificador, mas inexistentes.
export const DEMO_PASSWORD = 'Demo@12345';
const ORG_DOCUMENT = '00000000000191';
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const daysAhead = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

async function main() {
  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  let org = await prisma.organization.findFirst({ where: { document: ORG_DOCUMENT } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'Corretora Demo',
        legalName: 'Corretora Demo de Seguros Ltda (fictícia)',
        document: ORG_DOCUMENT,
        email: 'contato@demo.local',
        phone: '11999990000',
        settings: { create: { commissionPercentage: 15 } },
        quoteCounter: { create: {} },
      },
    });
  }
  const orgId = org.id;

  const usersSpec = [
    { name: 'Ana Admin (demo)', email: 'admin@demo.local', role: 'ADMIN' as const },
    { name: 'Gustavo Gestor (demo)', email: 'gestor@demo.local', role: 'MANAGER' as const },
    { name: 'Carla Corretora (demo)', email: 'corretor@demo.local', role: 'BROKER' as const },
  ];
  const users = [];
  for (const u of usersSpec) {
    users.push(await prisma.user.upsert({ where: { email: u.email }, update: { name: u.name, role: u.role, active: true, deletedAt: null }, create: { ...u, organizationId: orgId, passwordHash } }));
  }
  const [admin, manager, broker] = users as [typeof users[0], typeof users[0], typeof users[0]];

  const insurerNames = ['Porto Seguro', 'Azul Seguros', 'Tokio Marine', 'Allianz'];
  const insurers = [];
  for (const name of insurerNames) {
    const existing = await prisma.insurer.findFirst({ where: { organizationId: orgId, name } });
    insurers.push(existing ?? (await prisma.insurer.create({ data: { organizationId: orgId, name, active: true, email: `cotacao@${name.toLowerCase().split(' ')[0]}.demo.local` } })));
  }

  const alreadySeeded = await prisma.client.count({ where: { organizationId: orgId } });
  if (alreadySeeded > 0) {
    console.log(`Seed: organização "${org.name}" já possui ${alreadySeeded} cliente(s); usuários e seguradoras atualizados.`);
    return;
  }

  const clientsSpec = [
    { name: 'Cliente Demo 1 – João da Silva', document: '52998224725', phone: '11987650001', city: 'São Paulo', state: 'SP', vehicle: { brand: 'Fiat', model: 'Argo', manufacturingYear: 2022, modelYear: 2023, plate: 'DEM1A01' } },
    { name: 'Cliente Demo 2 – Maria Souza', document: '11144477735', phone: '11987650002', city: 'Campinas', state: 'SP', vehicle: { brand: 'Honda', model: 'Civic', manufacturingYear: 2021, modelYear: 2021, plate: 'DEM2B02' } },
    { name: 'Cliente Demo 3 – Pedro Santos', document: '93541134780', phone: '21987650003', city: 'Rio de Janeiro', state: 'RJ', vehicle: { brand: 'Toyota', model: 'Corolla', manufacturingYear: 2023, modelYear: 2024, plate: 'DEM3C03' } },
    { name: 'Cliente Demo 4 – Ana Oliveira', document: '28625583880', phone: '31987650004', city: 'Belo Horizonte', state: 'MG', vehicle: { brand: 'Volkswagen', model: 'Polo', manufacturingYear: 2020, modelYear: 2020, plate: 'DEM4D04' } },
    { name: 'Cliente Demo 5 – Transportes Fictícios Ltda', document: '11222333000181', phone: '41987650005', city: 'Curitiba', state: 'PR', type: 'COMPANY' as const, vehicle: { brand: 'Chevrolet', model: 'S10', manufacturingYear: 2022, modelYear: 2022, plate: 'DEM5E05' } },
  ];
  const clients = [];
  for (const c of clientsSpec) {
    const { vehicle, ...data } = c;
    const client = await prisma.client.create({ data: { organizationId: orgId, type: data.type ?? 'INDIVIDUAL', name: data.name, document: data.document, phone: data.phone, whatsapp: data.phone, city: data.city, state: data.state, email: `cliente${clients.length + 1}@demo.local` } });
    const v = await prisma.vehicle.create({ data: { organizationId: orgId, clientId: client.id, ...vehicle, fuel: 'FLEX' } });
    clients.push({ client, vehicle: v });
  }

  // 10 cotações em status variados
  const statuses: QuoteStatus[] = ['NEW', 'WAITING_DOCUMENTS', 'DATA_COMPLETE', 'QUOTING', 'WAITING_PROPOSALS', 'PROPOSALS_RECEIVED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST'];
  const flow: QuoteStatus[] = ['NEW', 'WAITING_DOCUMENTS', 'DATA_COMPLETE', 'QUOTING', 'WAITING_PROPOSALS', 'PROPOSALS_RECEIVED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON'];
  const owners = [broker, broker, manager, broker, admin, broker, manager, broker, broker, manager];
  let number = 0;
  for (let i = 0; i < statuses.length; i++) {
    const status = statuses[i]!;
    const { client, vehicle } = clients[i % clients.length]!;
    const owner = owners[i]!;
    number++;
    const createdAt = daysAgo(30 - i * 2);
    const idx = status === 'LOST' ? 5 : flow.indexOf(status);
    const path = status === 'LOST' ? [...flow.slice(0, 6), 'LOST' as QuoteStatus] : flow.slice(0, idx + 1);
    const quote = await prisma.quote.create({
      data: {
        organizationId: orgId,
        quoteNumber: number,
        clientId: client.id,
        vehicleId: idx >= 2 || status === 'LOST' ? vehicle.id : null,
        assignedUserId: owner.id,
        status,
        priority: i % 3 === 0 ? 'HIGH' : i % 3 === 1 ? 'MEDIUM' : 'LOW',
        createdAt,
        lastActivityAt: i === 3 ? daysAgo(9) : daysAgo(Math.max(0, 10 - i)),
        closedAt: status === 'WON' || status === 'LOST' ? daysAgo(1) : null,
        lostReason: status === 'LOST' ? 'PRICE' : null,
        autoDetails: { create: { mainDriverName: client.name.split('– ')[1] ?? client.name, profession: 'Autônomo(a)', hasHomeGarage: true, numberOfDrivers: 1, deductibleType: 'STANDARD', desiredCoverage: 'Compreensiva, terceiros, carro reserva' } },
        statusHistory: { create: path.map((to, k) => ({ organizationId: orgId, fromStatus: k === 0 ? null : path[k - 1]!, toStatus: to, userId: owner.id, createdAt: new Date(createdAt.getTime() + k * 6 * 60 * 60 * 1000) })) },
      },
    });
    // documentos validados a partir de DATA_COMPLETE
    if (idx >= 2) {
      for (const type of ['CNH', 'CRLV'] as const) {
        await prisma.document.create({ data: { organizationId: orgId, clientId: client.id, quoteId: quote.id, type, fileName: `${type.toLowerCase()}-demo.pdf`, storageKey: `seed/${quote.id}/${type}.pdf`, mimeType: 'application/pdf', size: 1024, status: 'VALIDATED', uploadedById: owner.id, validatedById: owner.id, validatedAt: createdAt, notes: 'Arquivo fictício do seed (não existe no storage).' } });
      }
    } else if (idx === 1) {
      await prisma.document.create({ data: { organizationId: orgId, clientId: client.id, quoteId: quote.id, type: 'CNH', fileName: 'cnh-demo.jpg', storageKey: `seed/${quote.id}/CNH.jpg`, mimeType: 'image/jpeg', size: 2048, status: 'RECEIVED', uploadedById: owner.id } });
    }
    // seguradoras a partir de QUOTING
    if (idx >= 3 || status === 'LOST') {
      const chosen = insurers.slice(0, 2 + (i % 3));
      const qiStatus = idx >= 5 || status === 'LOST' ? 'RECEIVED' : idx === 4 ? 'REQUESTED' : 'NOT_STARTED';
      for (const [k, ins] of chosen.entries()) {
        const qi = await prisma.quoteInsurer.create({ data: { organizationId: orgId, quoteId: quote.id, insurerId: ins.id, createdById: owner.id, status: qiStatus, requestedAt: qiStatus === 'NOT_STARTED' ? null : createdAt, respondedAt: qiStatus === 'RECEIVED' ? createdAt : null } });
        if (qiStatus === 'RECEIVED') {
          const base = 2800 + k * 350 + i * 40;
          const selected = (status === 'WON' || idx >= 6) && k === 1;
          await prisma.proposal.create({
            data: {
              organizationId: orgId,
              quoteInsurerId: qi.id,
              proposalNumber: `DEMO-${number}-${k + 1}`,
              totalAmount: base,
              installments: 10,
              installmentAmount: (base / 10).toFixed(2),
              firstInstallment: (base / 10).toFixed(2),
              deductibleAmount: 4500 - k * 500,
              deductibleType: 'STANDARD',
              validityDate: status === 'LOST' ? daysAgo(3) : daysAhead(i === 7 ? 3 : 10),
              status: status === 'LOST' ? 'EXPIRED' : selected ? 'SELECTED' : idx >= 6 ? 'REJECTED' : 'RECEIVED',
              coverages: { create: [{ name: 'Casco (compreensiva)', insuredAmount: null, included: true, notes: 'FIPE 100%' }, { name: 'Danos materiais a terceiros', insuredAmount: 100000 + k * 50000, included: true }, { name: 'Danos corporais a terceiros', insuredAmount: 100000, included: true }, { name: 'Danos morais', insuredAmount: 20000, included: k > 0 }] },
              assistances: { create: [{ name: 'Assistência 24h', included: true }, { name: 'Carro reserva', included: k !== 0, description: k !== 0 ? '15 dias' : undefined }, { name: 'Vidros', included: true }, { name: 'Guincho', included: true, description: '500 km' }] },
            },
          });
        }
      }
    }
    // tarefas
    if (idx >= 1 && idx <= 7) {
      await prisma.task.create({ data: { organizationId: orgId, userId: owner.id, createdById: owner.id, clientId: client.id, quoteId: quote.id, title: i % 2 === 0 ? 'Cobrar documentos do cliente' : 'Retornar ao cliente com as propostas', priority: i % 2 === 0 ? 'HIGH' : 'MEDIUM', status: 'TODO', dueDate: i === 1 ? daysAgo(2) : daysAhead(2) } });
    }
    await prisma.auditLog.create({ data: { organizationId: orgId, userId: owner.id, entity: 'quote', entityId: quote.id, action: 'CREATE', newData: { quoteNumber: number, clientId: client.id }, createdAt } });
  }
  await prisma.organizationQuoteCounter.update({ where: { organizationId: orgId }, data: { lastNumber: number } });

  console.log(`Seed OK: "${org.name}" · ${users.length} usuários (senha ${DEMO_PASSWORD}) · ${insurers.length} seguradoras · ${clients.length} clientes · ${number} cotações.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
