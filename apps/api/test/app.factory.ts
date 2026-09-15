import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/main';
import { PrismaService } from '../src/infra/prisma/prisma.service';

let migrated = false;

/** Aplica migrations no banco de teste uma única vez por processo. */
export function ensureTestDatabase() {
  if (migrated) return;
  execSync('npx prisma migrate deploy', {
    cwd: resolve(__dirname, '../../../packages/database'),
    env: { ...process.env },
    stdio: 'pipe',
  });
  migrated = true;
}

export async function createTestApp(): Promise<NestExpressApplication> {
  ensureTestDatabase();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  await configureApp(app);
  await app.init();
  return app;
}

/** Limpa todas as tabelas (ordem por cascade a partir de organizations). */
export async function resetDatabase(app: NestExpressApplication) {
  const prisma = app.get(PrismaService).system;
  await prisma.$executeRawUnsafe('TRUNCATE TABLE organizations CASCADE');
}
