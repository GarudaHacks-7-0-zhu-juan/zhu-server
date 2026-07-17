import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { AccidentEventType, UserAccidentEvent } from '@prisma/client';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AccidentsController } from './accidents.controller';
import { AccidentsService } from './accidents.service';
import { CreateAccidentEventDto } from './dto/create-accident-event.dto';

type AuthenticatedRequest = Request & { user: JwtPayload };

describe('AccidentsController', () => {
  let controller: AccidentsController;
  let service: AccidentsService;

  const mockEvent = {
    id: 'event-1',
    userId: 'user-1',
    eventType: AccidentEventType.FALL_DETECTED,
    detectedAt: new Date('2026-07-16T12:00:00.000Z'),
  } as UserAccidentEvent;

  const mockAccidentsService = {
    recordEvent: jest.fn().mockResolvedValue(mockEvent),
    recordFall: jest.fn().mockResolvedValue(mockEvent),
  };

  const request = {
    user: { sub: 'user-1', email: 'test@example.com' },
  } as unknown as AuthenticatedRequest;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccidentsController],
      providers: [
        { provide: AccidentsService, useValue: mockAccidentsService },
      ],
    }).compile();

    controller = module.get<AccidentsController>(AccidentsController);
    service = module.get<AccidentsService>(AccidentsService);

    jest.clearAllMocks();
  });

  it('records a fall event for the authenticated user', async () => {
    const dto: CreateAccidentEventDto = {
      eventType: AccidentEventType.FALL_DETECTED,
    };
    const recordSpy = jest.spyOn(service, 'recordFall');

    const result = await controller.createEvent(request, dto);

    expect(recordSpy).toHaveBeenCalledWith('user-1', expect.any(Date));
    expect(result).toBe(mockEvent);
  });

  it('uses the provided detectedAt timestamp when given', async () => {
    const detectedAt = '2026-07-16T10:00:00.000Z';
    const dto: CreateAccidentEventDto = {
      eventType: AccidentEventType.MOVEMENT,
      detectedAt,
    };
    const recordSpy = jest.spyOn(service, 'recordEvent');

    await controller.createEvent(request, dto);

    expect(recordSpy).toHaveBeenCalledWith({
      userId: 'user-1',
      eventType: AccidentEventType.MOVEMENT,
      detectedAt: new Date(detectedAt),
    });
  });
});
