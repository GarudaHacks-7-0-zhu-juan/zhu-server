import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BmkgGateway } from './bmkg.gateway';
import { DEFAULT_BMKG_GEMPATERKINI_URL } from './bmkg.constants';

describe('BmkgGateway', () => {
  let gateway: BmkgGateway;

  const mockConfig = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BmkgGateway,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    gateway = module.get<BmkgGateway>(BmkgGateway);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('parses and returns earthquakes sorted newest first', async () => {
    const olderQuake = {
      Tanggal: '12 Jul 2026',
      Jam: '20:46:35 WIB',
      DateTime: '2026-07-12T13:46:35+00:00',
      Coordinates: '1.31,121.38',
      Lintang: '1.31 LU',
      Bujur: '121.38 BT',
      Magnitude: '5.4',
      Kedalaman: '10 km',
      Wilayah: '37 km TimurLaut BUOL-SULTENG',
      Potensi: 'Tidak berpotensi tsunami',
    };

    const newerQuake = {
      Tanggal: '14 Jul 2026',
      Jam: '22:49:37 WIB',
      DateTime: '2026-07-14T15:49:37+00:00',
      Coordinates: '5.34,125.06',
      Lintang: '5.34 LU',
      Bujur: '125.06 BT',
      Magnitude: '6.2',
      Kedalaman: '10 km',
      Wilayah: '198 km BaratLaut TAHUNA-KEP.SANGIHE-SULUT',
      Potensi: 'Tidak berpotensi tsunami',
    };

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          Infogempa: { gempa: [olderQuake, newerQuake] },
        }),
    } as Response);

    const result = await gateway.fetchRecentEarthquakes();

    expect(fetchSpy).toHaveBeenCalledWith(DEFAULT_BMKG_GEMPATERKINI_URL);
    expect(result).toHaveLength(2);
    expect(result[0].dateTime.toISOString()).toBe(
      new Date(newerQuake.DateTime).toISOString(),
    );
    expect(result[0].magnitude).toBe(6.2);
    expect(result[0].latitude).toBe(5.34);
    expect(result[0].longitude).toBe(125.06);
    expect(result[0].depthKm).toBe(10);
    expect(result[1].magnitude).toBe(5.4);
  });

  it('uses the configured URL when present', async () => {
    mockConfig.get.mockReturnValue('https://custom.bmkg.json');

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ Infogempa: { gempa: [] } }),
    } as Response);

    await gateway.fetchRecentEarthquakes();

    expect(global.fetch).toHaveBeenCalledWith('https://custom.bmkg.json');
  });

  it('throws when BMKG responds with an error status', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    } as Response);

    await expect(gateway.fetchRecentEarthquakes()).rejects.toThrow(
      'BMKG request failed: 503 Service Unavailable',
    );
  });

  it('throws when response structure is unexpected', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ Infogempa: {} }),
    } as Response);

    await expect(gateway.fetchRecentEarthquakes()).rejects.toThrow(
      'Unexpected BMKG response structure',
    );
  });
});
