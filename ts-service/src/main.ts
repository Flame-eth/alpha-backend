import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('TalentFlow API')
    .setDescription(
      'Candidate document intake and async summary generation service. ' +
        'All protected endpoints require the `x-user-id` and `x-workspace-id` headers.',
    )
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-user-id' }, 'x-user-id')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-workspace-id' }, 'x-workspace-id')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

bootstrap();
