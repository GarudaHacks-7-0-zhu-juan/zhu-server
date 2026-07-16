import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RiskLevel } from '@prisma/client';
import { BmkgGateway } from '../bmkg/bmkg.gateway';
import { BmkgEarthquake } from '../bmkg/bmkg.types';
import { PrismaService } from '../prisma/prisma.service';
import { UserRisksService } from '../user-risks/user-risks.service';
import {
  DEFAULT_EARTHQUAKE_AFFECTED_RADIUS_KM,
  EARTHQUAKE_AFFECTED_RADIUS_KM_ENV,
  EARTHQUAKE_BROADCAST_MAGNITUDE_THRESHOLD,
  EARTHQUAKE_CRITICAL_MAGNITUDE_THRESHOLD,
  EARTHQUAKE_HIGH_RISK_MIN_MAGNITUDE,
} from './earthquake.constants';

const EARTH_RADIUS_KM = 6_371;

@Injectable()
export class EarthquakePollerService {
  constructor(
    private readonly bmkg: BmkgGateway,
    private readonly prisma: PrismaService,
    private readonly userRisks: UserRisksService,
    private readonly config: ConfigService,
  ) {}

  async poll(): Promise<void> {
    const startedAt = new Date();
    console.log(`[earthquake] ${startedAt.toISOString()} - polling BMKG`);

    const quakes = await this.bmkg.fetchRecentEarthquakes();

    for (const quake of quakes) {
      const existing = await this.prisma.earthquakeEvent.findUnique({
        where: { bmkgDateTime: quake.dateTime },
      });

      if (existing) {
        continue;
      }

      const riskLevel = this.evaluateDisasterRisk(quake);

      if (!this.isHighOrCritical(riskLevel)) {
        await this.recordEarthquakeEvent(quake);
        continue;
      }

      const affected = await this.findAffectedUsers(quake);

      for (const userId of affected.userIds) {
        await this.userRisks.setDisasterRisk(userId, riskLevel, quake.dateTime);
      }

      await this.recordEarthquakeEvent(quake);

      console.log(
        `[earthquake] ${startedAt.toISOString()} - ` +
          `M${quake.magnitude} ${quake.region} | ` +
          `risk=${riskLevel} affected=${affected.userIds.length} ` +
          `(broadcast=${affected.broadcast}, radiusKm=${affected.radiusKm})`,
      );
    }
  }

  private evaluateDisasterRisk(quake: BmkgEarthquake): RiskLevel {
    const potential = quake.potential.toLowerCase();
    const hasTsunamiPotential =
      potential.includes('tsunami') && !potential.includes('tidak');

    if (
      quake.magnitude > EARTHQUAKE_CRITICAL_MAGNITUDE_THRESHOLD ||
      hasTsunamiPotential
    ) {
      return RiskLevel.CRITICAL;
    }

    if (quake.magnitude >= EARTHQUAKE_HIGH_RISK_MIN_MAGNITUDE) {
      return RiskLevel.HIGH;
    }

    return quake.magnitude >= 5.0 ? RiskLevel.MEDIUM : RiskLevel.LOW;
  }

  private async findAffectedUsers(
    quake: BmkgEarthquake,
  ): Promise<{ userIds: string[]; radiusKm: number; broadcast: boolean }> {
    if (quake.magnitude >= EARTHQUAKE_BROADCAST_MAGNITUDE_THRESHOLD) {
      const users = await this.prisma.user.findMany({
        select: { id: true },
      });
      return {
        userIds: users.map((u) => u.id),
        radiusKm: 0,
        broadcast: true,
      };
    }

    const radiusKm = this.affectedRadiusKm();
    const locations = await this.prisma.userLocation.findMany({
      select: { userId: true, latitude: true, longitude: true },
    });

    const userIds = locations
      .filter((loc) => {
        const distanceKm = this.haversineDistance(
          Number(loc.latitude),
          Number(loc.longitude),
          quake.latitude,
          quake.longitude,
        );
        return distanceKm <= radiusKm;
      })
      .map((loc) => loc.userId);

    return { userIds, radiusKm, broadcast: false };
  }

  private affectedRadiusKm(): number {
    return Number(
      this.config.get<string>(EARTHQUAKE_AFFECTED_RADIUS_KM_ENV) ??
        DEFAULT_EARTHQUAKE_AFFECTED_RADIUS_KM,
    );
  }

  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
  }

  private isHighOrCritical(riskLevel: RiskLevel): boolean {
    return riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.CRITICAL;
  }

  private async recordEarthquakeEvent(quake: BmkgEarthquake): Promise<void> {
    await this.prisma.earthquakeEvent.create({
      data: {
        bmkgDateTime: quake.dateTime,
        magnitude: quake.magnitude,
        depthKm: quake.depthKm,
        latitude: quake.latitude,
        longitude: quake.longitude,
        region: quake.region,
        potential: quake.potential,
        fetchedAt: new Date(),
      },
    });
  }
}
