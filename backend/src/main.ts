import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { Env } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config
      .get('CORS_ORIGIN', { infer: true })
      .split(',')
      .map((origin) => origin.trim()),
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

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`API disponível em http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
