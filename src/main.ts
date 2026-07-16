import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionLoggingFilter } from './logging/http-exception-logging.filter';
import { HttpLoggingInterceptor } from './logging/http-logging.interceptor';
import { RequestContextMiddleware } from './logging/request-context.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(new ConsoleLogger({ json: true, timestamp: true }));
  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
  const requestContextMiddleware = app.get(RequestContextMiddleware);
  app.use(requestContextMiddleware.use.bind(requestContextMiddleware));
  app.useGlobalInterceptors(app.get(HttpLoggingInterceptor));
  app.useGlobalFilters(app.get(HttpExceptionLoggingFilter));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000, '127.0.0.1');
}
void bootstrap();
