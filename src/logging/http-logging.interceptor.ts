import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { httpRoute } from './http-route';
import { RequestContextService } from './request-context.service';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpLoggingInterceptor.name);

  constructor(private readonly requestContext: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        this.logger.log({
          event: 'http.request.completed',
          requestId: this.requestContext.requestId,
          method: request.method,
          route: httpRoute(request),
          statusCode: response.statusCode,
          durationMs: this.requestContext.durationMs,
        });
      }),
    );
  }
}
