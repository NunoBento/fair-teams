import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const clientDirectory = join(__dirname, '../../web/dist/web/browser');
  const clientIndex = join(clientDirectory, 'index.html');
  if (existsSync(clientIndex)) {
    app.use(express.static(clientDirectory, { index: false }));
    app.use((request: Request, response: Response, next: NextFunction) => {
      if (
        request.method !== 'GET' ||
        request.path === '/api' ||
        request.path.startsWith('/api/')
      ) {
        return next();
      }
      return response.sendFile(clientIndex);
    });
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `Angular production files not found at ${clientDirectory}.`,
    );
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
