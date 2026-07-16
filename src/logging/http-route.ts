import { Request } from 'express';

export function httpRoute(request: Request): string {
  return request.route?.path
    ? `${request.baseUrl}${request.route.path}`
    : 'unmatched';
}
