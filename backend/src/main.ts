import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
 // ✅ DEBUG (correct place)
  // console.log('DATABASE_URL:', process.env.DATABASE_URL);
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

 

  // ✅ Enable CORS
  app.enableCors({
    origin: 'http://localhost:3001',
    methods: 'GET,POST,PUT,DELETE,OPTIONS',
    credentials: true,
  });

  // ✅ Global ValidationPipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();