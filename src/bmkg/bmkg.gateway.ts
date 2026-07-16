import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BMKG_GEMPATERKINI_URL_ENV,
  DEFAULT_BMKG_GEMPATERKINI_URL,
} from './bmkg.constants';
import {
  BmkgApiEarthquake,
  BmkgApiResponse,
  BmkgEarthquake,
} from './bmkg.types';

@Injectable()
export class BmkgGateway {
  constructor(private readonly config: ConfigService) {}

  async fetchRecentEarthquakes(): Promise<BmkgEarthquake[]> {
    const url =
      this.config.get<string>(BMKG_GEMPATERKINI_URL_ENV) ??
      DEFAULT_BMKG_GEMPATERKINI_URL;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `BMKG request failed: ${response.status} ${response.statusText}`,
      );
    }

    const raw = (await response.json()) as BmkgApiResponse;
    const list = raw?.Infogempa?.gempa;

    if (!Array.isArray(list)) {
      throw new Error('Unexpected BMKG response structure');
    }

    return list
      .map((item) => this.parseEarthquake(item))
      .sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime());
  }

  private parseEarthquake(item: BmkgApiEarthquake): BmkgEarthquake {
    const [latitude, longitude] = item.Coordinates.split(',').map((part) =>
      Number.parseFloat(part.trim()),
    );

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      throw new Error(`Invalid BMKG coordinates: "${item.Coordinates}"`);
    }

    const magnitude = Number.parseFloat(item.Magnitude);
    if (Number.isNaN(magnitude)) {
      throw new Error(`Invalid BMKG magnitude: "${item.Magnitude}"`);
    }

    const depthKm = this.parseDepth(item.Kedalaman);
    const dateTime = new Date(item.DateTime);
    if (Number.isNaN(dateTime.getTime())) {
      throw new Error(`Invalid BMKG datetime: "${item.DateTime}"`);
    }

    return {
      dateTime,
      magnitude,
      depthKm,
      latitude,
      longitude,
      region: item.Wilayah,
      potential: item.Potensi,
    };
  }

  private parseDepth(raw: string): number {
    const match = raw.match(/(\d+(?:\.\d+)?)/);
    if (!match) {
      throw new Error(`Invalid BMKG depth: "${raw}"`);
    }
    return Number.parseFloat(match[1]);
  }
}
