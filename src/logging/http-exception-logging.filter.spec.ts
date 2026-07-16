import { BadRequestException, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request } from 'express';
import { HttpExceptionLoggingFilter } from './http-exception-logging.filter';
import { RequestContextService } from './request-context.service';

describe('HttpExceptionLoggingFilter', () => {
  it('logs failed requests without exception details', () => {
    const context = new RequestContextService();
    const adapter = {
      isHeadersSent: jest.fn().mockReturnValue(false),
      reply: jest.fn(),
    };
    const filter = new HttpExceptionLoggingFilter(context, {
      httpAdapter: adapter,
    } as HttpAdapterHost);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const request = {
      method: 'POST',
      baseUrl: '/api',
      route: { path: '/auth/login' },
    } as unknown as Request;
    const host = {
      getType: () => 'http',
      getArgByIndex: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: jest.fn(),
      }),
    };

    context.run('request-1', () => {
      filter.catch(new BadRequestException('password=secret'), host as never);
    });

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'http.request.failed',
        requestId: 'request-1',
        route: '/api/auth/login',
        statusCode: 400,
        error: 'BadRequestException',
      }),
    );
    expect(warn).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.anything() }),
    );
    warn.mockRestore();
  });
});
