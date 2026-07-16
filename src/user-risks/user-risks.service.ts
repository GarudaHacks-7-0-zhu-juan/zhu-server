import { Injectable } from '@nestjs/common';
import { RiskLevel, RiskType, UserRisk, UserRiskEvent } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const RISK_LEVELS: RiskLevel[] = [
  RiskLevel.LOW,
  RiskLevel.MEDIUM,
  RiskLevel.HIGH,
  RiskLevel.CRITICAL,
];

@Injectable()
export class UserRisksService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateRisk(
    userId: string,
    latitude: number,
    longitude: number,
    detectedAt: Date,
  ): Promise<{ risk: UserRisk; event: UserRiskEvent }> {
    const riskLevel = this.randomRiskLevel();

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
          updatedAt: detectedAt,
        },
        update: {
          riskLevel,
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

  private randomRiskLevel(): RiskLevel {
    const index = Math.floor(Math.random() * RISK_LEVELS.length);
    return RISK_LEVELS[index];
  }
}
