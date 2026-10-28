import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import type { Env } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.setGlobalPrefix('api');

  const rawCors = config.get('CORS_ORIGIN', { infer: true });
  const corsOrigins = rawCors === '*' ? true : rawCors.split(',').map((origin) => origin.trim());

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove campos não declarados nos DTOs
      forbidNonWhitelisted: true, // e rejeita a requisição se vierem campos extras
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  // Suporte a front-end estatico integrado em producao (Docker unificado)
  const publicDir = path.resolve(__dirname, 'public');
  if (fs.existsSync(publicDir)) {
    app.useStaticAssets(publicDir);
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
        res.sendFile(path.join(publicDir, 'index.html'));
      } else {
        next();
      }
    });
    Logger.log(`Front-end estatico integrado ativado a partir de ${publicDir}`, 'Bootstrap');
  }

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`API disponível em http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
