import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const corsOrigin = config.get<string>('CORS_ORIGIN');
  app.enableCors({
    origin: corsOrigin
      ? corsOrigin.split(',').map((o) => o.trim())
      : /^http:\/\/localhost(:\d+)?$/,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api/v1');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PredictFi API')
    .setDescription('Decentralized Prediction Market on Stellar — REST API')
    .setVersion('1.0')
    .addTag('markets')
    .addTag('positions')
    .addTag('reputation')
    .addTag('leaderboard')
    .addTag('oracle')
    .addTag('users')
    .addTag('analytics')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Health check — used by Docker, Railway, Render, load balancers
  app.getHttpAdapter().get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const port = Number(process.env.PORT) || config.get<number>('API_PORT', 4000);
  await app.listen(port);
  console.log(`\n🚀 PredictFi API running on http://localhost:${port}`);
  console.log(`📖 Swagger docs: http://localhost:${port}/api/docs\n`);
}

bootstrap();
