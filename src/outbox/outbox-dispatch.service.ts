import { Injectable } from '@nestjs/common';
import { KafkaService } from '../kafka/kafka.service';
import { UserEvent } from '../kafka/kafka.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OutboxDispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaService,
  ) {}

  async dispatchBatch(): Promise<void> {
    const pending = await this.prisma.userEventOutbox.findMany({
      where: { publishedAt: null },
      orderBy: [{ userId: 'asc' }, { sequence: 'asc' }],
      take: 100,
    });

    for (const row of pending) {
      const event: UserEvent = {
        eventId: row.id,
        userId: row.userId,
        sequence: row.sequence,
        eventType: row.eventType,
        occurredAt: row.createdAt.toISOString(),
        payload: row.payload,
      };

      await this.kafka.publishUserEvent(event);

      await this.prisma.userEventOutbox.update({
        where: { id: row.id },
        data: { publishedAt: new Date() },
      });
    }
  }
}
