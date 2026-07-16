import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { Request } from 'express';
import { httpRoute } from './http-route';
import { RequestContextService } from './request-context.service';

@Catch()
export class HttpExceptionLoggingFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(HttpExceptionLoggingFilter.name);

  constructor(
    private readonly requestContext: RequestContextService,
    adapterHost: HttpAdapterHost,
  ) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() === 'http') {
      const request = host.switchToHttp().getRequest<Request>();
      const statusCode =
        exception instanceof HttpException ? exception.getStatus() : 500;
      const entry = {
        event: 'http.request.failed',
        requestId: this.requestContext.requestId,
        method: request.method,
        route: httpRoute(request),
        statusCode,
        durationMs: this.requestContext.durationMs,
        error: exception instanceof Error ? exception.name : 'UnknownException',
      };

      if (statusCode >= 500) {
        this.logger.error(entry);
      } else {
        this.logger.warn(entry);
      }
    }

    super.catch(exception, host);
  }
}
