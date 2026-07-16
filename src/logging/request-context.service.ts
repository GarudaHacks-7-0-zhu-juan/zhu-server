import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

type RequestContext = {
  requestId: string;
  startedAt: number;
};

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  run(requestId: string, callback: () => void): void {
    this.storage.run({ requestId, startedAt: Date.now() }, callback);
  }

  get requestId(): string | undefined {
    return this.storage.getStore()?.requestId;
  }

  get durationMs(): number | undefined {
    const startedAt = this.storage.getStore()?.startedAt;
    return startedAt === undefined ? undefined : Date.now() - startedAt;
  }
}
