import { Test, TestingModule } from '@nestjs/testing';
import { KafkaService } from '../kafka/kafka.service';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxDispatchService } from './outbox-dispatch.service';

describe('OutboxDispatchService', () => {
  let service: OutboxDispatchService;
  let prisma: PrismaService;
  let kafka: KafkaService;

  const mockPrisma = {
    userEventOutbox: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockKafka = {
    publishUserEvent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxDispatchService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: KafkaService, useValue: mockKafka },
      ],
    }).compile();

    service = module.get<OutboxDispatchService>(OutboxDispatchService);
    prisma = module.get<PrismaService>(PrismaService);
    kafka = module.get<KafkaService>(KafkaService);

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-16T12:00:00.000Z'));

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('dispatchBatch', () => {
    it('publishes pending rows in order and marks them published', async () => {
      const now = new Date();
      const rows = [
        {
          id: 'a-1',
          userId: 'user-a',
          sequence: 1,
          eventType: 'user.location.updated',
          createdAt: now,
          payload: { lat: 1 },
        },
        {
          id: 'a-2',
          userId: 'user-a',
          sequence: 2,
          eventType: 'user.location.updated',
          createdAt: now,
          payload: { lat: 2 },
        },
        {
          id: 'b-1',
          userId: 'user-b',
          sequence: 1,
          eventType: 'user.location.updated',
          createdAt: now,
          payload: { lat: 3 },
        },
      ];

      mockPrisma.userEventOutbox.findMany.mockResolvedValue(rows);

      const findManySpy = jest.spyOn(prisma.userEventOutbox, 'findMany');
      const publishSpy = jest.spyOn(kafka, 'publishUserEvent');
      const updateSpy = jest.spyOn(prisma.userEventOutbox, 'update');

      await service.dispatchBatch();

      expect(findManySpy).toHaveBeenCalledWith({
        where: { publishedAt: null },
        orderBy: [{ userId: 'asc' }, { sequence: 'asc' }],
        take: 100,
      });

      expect(publishSpy).toHaveBeenCalledTimes(3);
      expect(publishSpy).toHaveBeenNthCalledWith(1, {
        eventId: 'a-1',
        userId: 'user-a',
        sequence: 1,
        eventType: 'user.location.updated',
        occurredAt: now.toISOString(),
        payload: { lat: 1 },
      });
      expect(publishSpy).toHaveBeenNthCalledWith(2, {
        eventId: 'a-2',
        userId: 'user-a',
        sequence: 2,
        eventType: 'user.location.updated',
        occurredAt: now.toISOString(),
        payload: { lat: 2 },
      });
      expect(publishSpy).toHaveBeenNthCalledWith(3, {
        eventId: 'b-1',
        userId: 'user-b',
        sequence: 1,
        eventType: 'user.location.updated',
        occurredAt: now.toISOString(),
        payload: { lat: 3 },
      });

      expect(updateSpy).toHaveBeenCalledTimes(3);
      expect(updateSpy).toHaveBeenNthCalledWith(1, {
        where: { id: 'a-1' },
        data: { publishedAt: now },
      });
      expect(updateSpy).toHaveBeenNthCalledWith(2, {
        where: { id: 'a-2' },
        data: { publishedAt: now },
      });
      expect(updateSpy).toHaveBeenNthCalledWith(3, {
        where: { id: 'b-1' },
        data: { publishedAt: now },
      });
    });
  });
});
