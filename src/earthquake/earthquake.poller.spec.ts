import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RiskLevel } from '@prisma/client';
import { BmkgGateway } from '../bmkg/bmkg.gateway';
import { BmkgEarthquake } from '../bmkg/bmkg.types';
import { PrismaService } from '../prisma/prisma.service';
import { UserRisksService } from '../user-risks/user-risks.service';
import { EarthquakePollerService } from './earthquake.poller';

const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

describe('EarthquakePollerService', () => {
  let service: EarthquakePollerService;

  const mockBmkg = {
    fetchRecentEarthquakes: jest.fn(),
  };

  const mockPrisma = {
    earthquakeEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    userLocation: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  };

  const mockUserRisks = {
    setDisasterRisk: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EarthquakePollerService,
        { provide: BmkgGateway, useValue: mockBmkg },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UserRisksService, useValue: mockUserRisks },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<EarthquakePollerService>(EarthquakePollerService);

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-16T12:00:00.000Z'));
    jest.clearAllMocks();
    consoleSpy.mockClear();

    mockBmkg.fetchRecentEarthquakes.mockResolvedValue([]);
    mockPrisma.earthquakeEvent.findUnique.mockResolvedValue(null);
    mockPrisma.userLocation.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockUserRisks.setDisasterRisk.mockResolvedValue(undefined);
    mockPrisma.earthquakeEvent.create.mockResolvedValue({});
    mockConfig.get.mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  const makeQuake = (
    overrides: Partial<BmkgEarthquake> = {},
  ): BmkgEarthquake => ({
    dateTime: new Date('2026-07-16T12:00:00.000Z'),
    magnitude: 6.2,
    depthKm: 10,
    latitude: 1.0,
    longitude: 118.0,
    region: 'Test region',
    potential: 'Tidak berpotensi tsunami',
    ...overrides,
  });

  it('does nothing for already processed earthquakes', async () => {
    mockBmkg.fetchRecentEarthquakes.mockResolvedValue([makeQuake()]);
    mockPrisma.earthquakeEvent.findUnique.mockResolvedValue({ id: 'existing' });

    await service.poll();

    expect(mockPrisma.earthquakeEvent.create).not.toHaveBeenCalled();
    expect(mockUserRisks.setDisasterRisk).not.toHaveBeenCalled();
  });

  it('broadcasts HIGH risk to all users when magnitude >= 6.0', async () => {
    mockBmkg.fetchRecentEarthquakes.mockResolvedValue([
      makeQuake({ magnitude: 6.2 }),
    ]);
    mockPrisma.earthquakeEvent.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'user-1' },
      { id: 'user-2' },
    ]);

    await service.poll();

    expect(mockPrisma.user.findMany).toHaveBeenCalled();
    expect(mockUserRisks.setDisasterRisk).toHaveBeenCalledTimes(2);
    expect(mockUserRisks.setDisasterRisk).toHaveBeenCalledWith(
      'user-1',
      RiskLevel.HIGH,
      expect.any(Date),
    );
    expect(mockPrisma.earthquakeEvent.create).toHaveBeenCalled();
  });

  it('notifies nearby users for 5.5 <= magnitude < 6.0', async () => {
    mockBmkg.fetchRecentEarthquakes.mockResolvedValue([
      makeQuake({
        magnitude: 5.7,
        latitude: 0,
        longitude: 0,
      }),
    ]);
    mockPrisma.earthquakeEvent.findUnique.mockResolvedValue(null);
    mockPrisma.userLocation.findMany.mockResolvedValue([
      { userId: 'near-1', latitude: 0.5, longitude: 0.5 }, // ~79 km
      { userId: 'far-1', latitude: 5.0, longitude: 5.0 }, // ~785 km
    ]);
    mockConfig.get.mockReturnValue('200');

    await service.poll();

    expect(mockUserRisks.setDisasterRisk).toHaveBeenCalledTimes(1);
    expect(mockUserRisks.setDisasterRisk).toHaveBeenCalledWith(
      'near-1',
      RiskLevel.HIGH,
      expect.any(Date),
    );
  });

  it('forces CRITICAL for tsunami potential', async () => {
    mockBmkg.fetchRecentEarthquakes.mockResolvedValue([
      makeQuake({
        magnitude: 5.8,
        latitude: 0,
        longitude: 0,
        potential: 'Berpotensi tsunami',
      }),
    ]);
    mockPrisma.earthquakeEvent.findUnique.mockResolvedValue(null);
    mockPrisma.userLocation.findMany.mockResolvedValue([
      { userId: 'user-1', latitude: 0.5, longitude: 0.5 },
    ]);

    await service.poll();

    expect(mockUserRisks.setDisasterRisk).toHaveBeenCalledWith(
      'user-1',
      RiskLevel.CRITICAL,
      expect.any(Date),
    );
  });

  it('skips small earthquakes below 5.5', async () => {
    mockBmkg.fetchRecentEarthquakes.mockResolvedValue([
      makeQuake({ magnitude: 4.5 }),
    ]);
    mockPrisma.earthquakeEvent.findUnique.mockResolvedValue(null);

    await service.poll();

    expect(mockUserRisks.setDisasterRisk).not.toHaveBeenCalled();
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.userLocation.findMany).not.toHaveBeenCalled();
  });
});
