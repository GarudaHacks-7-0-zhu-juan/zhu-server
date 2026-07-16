import { Logger } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { Request, Response } from 'express';
import { of } from 'rxjs';
import { HttpLoggingInterceptor } from './http-logging.interceptor';
import { RequestContextService } from './request-context.service';

describe('HttpLoggingInterceptor', () => {
  it('logs a completed request without request data', (done) => {
    const context = new RequestContextService();
    const interceptor = new HttpLoggingInterceptor(context);
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const request = {
      method: 'POST',
      baseUrl: '/api',
      route: { path: '/auth/login' },
      body: { password: 'secret', email: 'user@example.com' },
    } as unknown as Request;
    const response = { statusCode: 200 } as Response;
    const executionContext = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;

    context.run('request-1', () => {
      interceptor
        .intercept(executionContext, { handle: () => of(undefined) })
        .subscribe({
          complete: () => {
            expect(log).toHaveBeenCalledWith(
              expect.objectContaining({
                event: 'http.request.completed',
                requestId: 'request-1',
                method: 'POST',
                route: '/api/auth/login',
                statusCode: 200,
              }),
            );
            expect(log).not.toHaveBeenCalledWith(
              expect.objectContaining({ body: expect.anything() }),
            );
            log.mockRestore();
            done();
          },
        });
    });
  });
});
