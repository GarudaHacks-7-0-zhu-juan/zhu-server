import { Test, TestingModule } from '@nestjs/testing';
import { UserLocation, UserLocationEvent } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationsService } from './locations.service';

describe('LocationsService', () => {
  let service: LocationsService;
  let prisma: PrismaService;

  const mockPrisma = {
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    userLocation: { upsert: jest.fn() },
    userLocationEvent: { create: jest.fn() },
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-16T12:00:00.000Z'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LocationsService>(LocationsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('updateLocation', () => {
    it('upserts the latest location and appends a location event', async () => {
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

      const upsertSpy = jest
        .spyOn(prisma.userLocation, 'upsert')
        .mockResolvedValue(mockLocation);
      const createSpy = jest
        .spyOn(prisma.userLocationEvent, 'create')
        .mockResolvedValue(mockEvent);

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

      expect(createSpy).toHaveBeenCalledWith({
        data: {
          userId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          detectedAt: now,
        },
      });

      expect(result).toEqual({ location: mockLocation, event: mockEvent });
    });
  });
});
