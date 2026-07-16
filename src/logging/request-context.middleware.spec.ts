import { Request, Response } from 'express';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';

describe('RequestContextMiddleware', () => {
  it('returns and stores a supplied request ID', () => {
    const context = new RequestContextService();
    const middleware = new RequestContextMiddleware(context);
    const request = {
      header: jest.fn().mockReturnValue('request-1'),
    } as unknown as Request;
    const response = { setHeader: jest.fn() } as unknown as Response;

    middleware.use(request, response, () => {
      expect(context.requestId).toBe('request-1');
    });

    expect(response.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      'request-1',
    );
  });

  it('replaces an unsafe request ID', () => {
    const context = new RequestContextService();
    const middleware = new RequestContextMiddleware(context);
    const request = {
      header: jest.fn().mockReturnValue('request\ninvalid'),
    } as unknown as Request;
    const response = { setHeader: jest.fn() } as unknown as Response;

    middleware.use(request, response, () => undefined);

    expect(response.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      expect.stringMatching(/^[A-Za-z0-9._-]{1,128}$/),
    );
  });
});
