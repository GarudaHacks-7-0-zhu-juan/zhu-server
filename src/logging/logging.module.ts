import { Global, Module } from '@nestjs/common';
import { HttpExceptionLoggingFilter } from './http-exception-logging.filter';
import { HttpLoggingInterceptor } from './http-logging.interceptor';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';

@Global()
@Module({
  providers: [
    RequestContextService,
    RequestContextMiddleware,
    HttpLoggingInterceptor,
    HttpExceptionLoggingFilter,
  ],
  exports: [RequestContextService],
})
export class LoggingModule {}
