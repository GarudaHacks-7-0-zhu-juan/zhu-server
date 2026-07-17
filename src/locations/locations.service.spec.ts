import { Test, TestingModule } from '@nestjs/testing';
import {
  UserLocation,
  UserLocationEvent,
  UserEventOutbox,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserRisksService } from '../user-risks/user-risks.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationsService } from './locations.service';

type MockTx = {
  userLocation: { upsert: jest.Mock };
  userLocationEvent: { create: jest.Mock };
  userEventOutbox: { aggregate: jest.Mock; create: jest.Mock };
};

describe('LocationsService', () => {
  let service: LocationsService;

  const mockTx: MockTx = {
    userLocation: { upsert: jest.fn() },
    userLocationEvent: { create: jest.fn() },
    userEventOutbox: { aggregate: jest.fn(), create: jest.fn() },
  };

  const mockPrisma = {
    $transaction: jest.fn((callback: (tx: MockTx) => Promise<unknown>) =>
      callback(mockTx),
    ),
  } as unknown as PrismaService;
  const mockUserRisks = {
    evaluateRisk: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UserRisksService, useValue: mockUserRisks },
      ],
    }).compile();

    service = module.get<LocationsService>(LocationsService);

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-16T12:00:00.000Z'));

    jest.clearAllMocks();
    mockUserRisks.evaluateRisk.mockResolvedValue({
      risk: { riskLevel: 'NONE', livenessCheckActivationMode: 'OFF' },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('updateLocation', () => {
    it('upserts latest location, appends event, and writes the next outbox sequence', async () => {
      const userId = 'user-1';
      const dto: UpdateLocationDto = { latitude: 1.23, longitude: 4.56 };
      const now = new Date();

      const mockLocation = {
        userId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        updatedAt: now,
      } as UserLocation;

      const mockEvent = {
        id: 'event-1',
        userId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        detectedAt: now,
      } as UserLocationEvent;

      const mockOutbox = {
        id: 'outbox-1',
        userId,
        sequence: 6,
        eventType: 'user.location.updated',
      } as UserEventOutbox;

      mockTx.userLocation.upsert.mockResolvedValue(mockLocation);
      mockTx.userLocationEvent.create.mockResolvedValue(mockEvent);
      mockTx.userEventOutbox.aggregate.mockResolvedValue({
        _max: { sequence: 5 },
      });
      mockTx.userEventOutbox.create.mockResolvedValue(mockOutbox);

      const upsertSpy = jest.spyOn(mockTx.userLocation, 'upsert');
      const createEventSpy = jest.spyOn(mockTx.userLocationEvent, 'create');
      const aggregateSpy = jest.spyOn(mockTx.userEventOutbox, 'aggregate');
      const createOutboxSpy = jest.spyOn(mockTx.userEventOutbox, 'create');

      const result = await service.updateLocation(userId, dto);

      expect(upsertSpy).toHaveBeenCalledWith({
        where: { userId },
        create: {
          userId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          updatedAt: now,
        },
        update: {
          latitude: dto.latitude,
          longitude: dto.longitude,
          updatedAt: now,
        },
      });

      expect(createEventSpy).toHaveBeenCalledWith({
        data: {
          userId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          detectedAt: now,
        },
      });

      expect(aggregateSpy).toHaveBeenCalledWith({
        where: { userId },
        _max: { sequence: true },
      });

      expect(createOutboxSpy).toHaveBeenCalledWith({
        data: {
          userId,
          sequence: 6,
          eventType: 'user.location.updated',
          payload: {
            latitude: dto.latitude,
            longitude: dto.longitude,
            detectedAt: now.toISOString(),
            locationEventId: mockEvent.id,
          },
        },
      });

      expect(mockUserRisks.evaluateRisk).toHaveBeenCalledWith(
        userId,
        dto.latitude,
        dto.longitude,
        now,
      );
      expect(result).toEqual({
        location: mockLocation,
        event: mockEvent,
        risk: { riskLevel: 'NONE', livenessCheckActivationMode: 'OFF' },
      });
    });

    it('starts outbox sequence at 1 for a new user', async () => {
      const userId = 'user-2';
      const dto: UpdateLocationDto = { latitude: 0, longitude: 0 };
      const now = new Date();

      mockTx.userLocation.upsert.mockResolvedValue({});
      mockTx.userLocationEvent.create.mockResolvedValue({ id: 'event-2' });
      mockTx.userEventOutbox.aggregate.mockResolvedValue({
        _max: { sequence: null },
      });
      mockTx.userEventOutbox.create.mockResolvedValue({});

      await service.updateLocation(userId, dto);

      expect(mockTx.userEventOutbox.create).toHaveBeenCalledWith({
        data: {
          userId,
          sequence: 1,
          eventType: 'user.location.updated',
          payload: {
            latitude: dto.latitude,
            longitude: dto.longitude,
            detectedAt: now.toISOString(),
            locationEventId: 'event-2',
          },
        },
      });
    });
  });
});
