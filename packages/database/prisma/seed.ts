import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

// Dados claramente fictícios. CNPJ/CPFs válidos por dígito verificador, mas inexistentes.
export const DEMO_PASSWORD = 'Demo@12345';
const ORG_DOCUMENT = '00000000000191';

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

  const users = [
    { name: 'Ana Admin (demo)', email: 'admin@demo.local', role: 'ADMIN' as const },
    { name: 'Gustavo Gestor (demo)', email: 'gestor@demo.local', role: 'MANAGER' as const },
    { name: 'Carla Corretora (demo)', email: 'corretor@demo.local', role: 'BROKER' as const },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, active: true, deletedAt: null },
      create: { ...u, organizationId: org.id, passwordHash },
    });
  }

  const insurers = ['Porto Seguro', 'Azul Seguros', 'Tokio Marine', 'Allianz'];
  for (const name of insurers) {
    const existing = await prisma.insurer.findFirst({ where: { organizationId: org.id, name } });
    if (!existing) await prisma.insurer.create({ data: { organizationId: org.id, name, active: true } });
  }

  console.log(`Seed OK: organização "${org.name}", ${users.length} usuários (senha ${DEMO_PASSWORD}), ${insurers.length} seguradoras.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
