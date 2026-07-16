import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { RequestContextService } from './request-context.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly context: RequestContextService) {}

  use(request: Request, response: Response, next: () => void): void {
    const header = request.header('x-request-id');
    const requestId =
      header && /^[A-Za-z0-9._-]{1,128}$/.test(header) ? header : randomUUID();

    response.setHeader('X-Request-Id', requestId);
    this.context.run(requestId, next);
  }
}
