import { Test, TestingModule } from '@nestjs/testing';
import { AccidentEventType, UserAccidentEvent } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccidentsService } from './accidents.service';

describe('AccidentsService', () => {
  let service: AccidentsService;
  let prisma: PrismaService;

  const mockPrisma = {
    userAccidentEvent: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccidentsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AccidentsService>(AccidentsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('records a fall event', async () => {
    const detectedAt = new Date('2026-07-16T12:00:00.000Z');
    const mockEvent = {
      id: 'event-1',
      userId: 'user-1',
      eventType: AccidentEventType.FALL_DETECTED,
      detectedAt,
    } as UserAccidentEvent;

    const createSpy = jest
      .spyOn(prisma.userAccidentEvent, 'create')
      .mockResolvedValue(mockEvent);

    const result = await service.recordFall('user-1', detectedAt);

    expect(createSpy).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        eventType: AccidentEventType.FALL_DETECTED,
        detectedAt,
      },
    });
    expect(result).toBe(mockEvent);
  });

  it('records a movement event', async () => {
    const detectedAt = new Date('2026-07-16T12:00:00.000Z');
    const mockEvent = {
      id: 'event-2',
      userId: 'user-1',
      eventType: AccidentEventType.MOVEMENT,
      detectedAt,
    } as UserAccidentEvent;

    const createSpy = jest
      .spyOn(prisma.userAccidentEvent, 'create')
      .mockResolvedValue(mockEvent);

    const result = await service.recordMovement('user-1', detectedAt);

    expect(createSpy).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        eventType: AccidentEventType.MOVEMENT,
        detectedAt,
      },
    });
    expect(result).toBe(mockEvent);
  });
});
