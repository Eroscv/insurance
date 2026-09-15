import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import type { Env } from './config/env';

export async function configureApp(app: NestExpressApplication) {
  const config = app.get(ConfigService<Env, true>);
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.enableCors({ origin: config.get('WEB_URL', { infer: true }), credentials: true });
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  return app;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  await configureApp(app);
  const port = app.get(ConfigService<Env, true>).get('API_PORT', { infer: true });
  await app.listen(port);
  app.get(Logger).log(`API em http://localhost:${port}/api/v1`);
}

if (require.main === module) {
  void bootstrap();
}
