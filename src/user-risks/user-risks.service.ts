import { Injectable } from '@nestjs/common';
import { RiskLevel, RiskType, UserRisk, UserRiskEvent } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserRisksService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateRisk(
    userId: string,
    latitude: number,
    longitude: number,
    detectedAt: Date,
  ): Promise<{ risk: UserRisk; event: UserRiskEvent }> {
    const riskLevel = this.evaluateRiskLevel(latitude, longitude);
    const livenessCheckEnabled = this.isHighOrCritical(riskLevel);

    const [risk, event] = await this.prisma.$transaction([
      this.prisma.userRisk.upsert({
        where: {
          userId_riskType: {
            userId,
            riskType: RiskType.HIGH_RISK_AREA,
          },
        },
        create: {
          userId,
          riskType: RiskType.HIGH_RISK_AREA,
          riskLevel,
          livenessCheckEnabled,
          updatedAt: detectedAt,
        },
        update: {
          riskLevel,
          livenessCheckEnabled,
          updatedAt: detectedAt,
        },
      }),
      this.prisma.userRiskEvent.create({
        data: {
          userId,
          riskType: RiskType.HIGH_RISK_AREA,
          riskLevel,
          detectedAt,
        },
      }),
    ]);

    return { risk, event };
  }

  async setLivenessCheckEnabled(
    userId: string,
    riskType: RiskType,
    enabled: boolean,
  ): Promise<UserRisk> {
    return this.prisma.userRisk.upsert({
      where: {
        userId_riskType: {
          userId,
          riskType,
        },
      },
      create: {
        userId,
        riskType,
        riskLevel: RiskLevel.NONE,
        livenessCheckEnabled: enabled,
        updatedAt: new Date(),
      },
      update: {
        livenessCheckEnabled: enabled,
      },
    });
  }

  async getLivenessCheckStatuses(userId: string): Promise<
    {
      riskType: RiskType;
      livenessCheckEnabled: boolean;
    }[]
  > {
    const risks = await this.prisma.userRisk.findMany({
      where: { userId },
      select: {
        riskType: true,
        livenessCheckEnabled: true,
      },
    });

    return risks;
  }

  async setDisasterRisk(
    userId: string,
    riskLevel: RiskLevel,
    detectedAt: Date,
  ): Promise<{ risk: UserRisk; event: UserRiskEvent }> {
    const livenessCheckEnabled = this.isHighOrCritical(riskLevel);

    const [risk, event] = await this.prisma.$transaction([
      this.prisma.userRisk.upsert({
        where: {
          userId_riskType: {
            userId,
            riskType: RiskType.DISASTER,
          },
        },
        create: {
          userId,
          riskType: RiskType.DISASTER,
          riskLevel,
          livenessCheckEnabled,
          updatedAt: detectedAt,
        },
        update: {
          riskLevel,
          livenessCheckEnabled,
          updatedAt: detectedAt,
        },
      }),
      this.prisma.userRiskEvent.create({
        data: {
          userId,
          riskType: RiskType.DISASTER,
          riskLevel,
          detectedAt,
        },
      }),
    ]);

    return { risk, event };
  }

  async setAccidentRisk(
    userId: string,
    riskLevel: RiskLevel,
    detectedAt: Date,
  ): Promise<{ risk: UserRisk; event: UserRiskEvent }> {
    const livenessCheckEnabled = this.isHighOrCritical(riskLevel);

    const [risk, event] = await this.prisma.$transaction([
      this.prisma.userRisk.upsert({
        where: {
          userId_riskType: {
            userId,
            riskType: RiskType.ACCIDENT,
          },
        },
        create: {
          userId,
          riskType: RiskType.ACCIDENT,
          riskLevel,
          livenessCheckEnabled,
          updatedAt: detectedAt,
        },
        update: {
          riskLevel,
          livenessCheckEnabled,
          updatedAt: detectedAt,
        },
      }),
      this.prisma.userRiskEvent.create({
        data: {
          userId,
          riskType: RiskType.ACCIDENT,
          riskLevel,
          detectedAt,
        },
      }),
    ]);

    return { risk, event };
  }

  async respondToLivenessCheck(
    userId: string,
    riskType: RiskType,
    isOkay: boolean,
  ): Promise<{ risk: UserRisk; event: UserRiskEvent }> {
    const respondedAt = new Date();
    const existingRisk = await this.prisma.userRisk.findUnique({
      where: { userId_riskType: { userId, riskType } },
    });
    const riskLevel = isOkay
      ? RiskLevel.NONE
      : (existingRisk?.riskLevel ?? RiskLevel.NONE);
    const livenessCheckEnabled = isOkay
      ? false
      : (existingRisk?.livenessCheckEnabled ?? false);

    const [risk, event] = await this.prisma.$transaction([
      this.prisma.userRisk.upsert({
        where: {
          userId_riskType: {
            userId,
            riskType,
          },
        },
        create: {
          userId,
          riskType,
          riskLevel,
          livenessCheckEnabled,
          updatedAt: respondedAt,
        },
        update: {
          riskLevel,
          livenessCheckEnabled,
          updatedAt: respondedAt,
        },
      }),
      this.prisma.userRiskEvent.create({
        data: {
          userId,
          riskType,
          riskLevel,
          detectedAt: respondedAt,
          isOkay,
        },
      }),
    ]);

    return { risk, event };
  }

  private evaluateRiskLevel(latitude: number, longitude: number): RiskLevel {
    const isNegativeQuadrant = latitude < 0 && longitude < 0;

    if (isNegativeQuadrant) {
      return Math.random() < 0.5 ? RiskLevel.HIGH : RiskLevel.CRITICAL;
    }

    return Math.random() < 0.5 ? RiskLevel.LOW : RiskLevel.NONE;
  }

  private isHighOrCritical(riskLevel: RiskLevel): boolean {
    return riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.CRITICAL;
  }
}
